import type {
	RunnerAction,
	RunnerBatch,
	RunnerDisplay,
	RunnerInput,
	RunnerMode,
	RunnerView,
} from '@/types/runner';

import { api, ApiError, errorMessage } from '@/utils/api';
import { runnerBatchId } from '@/utils/runner/batch-id';
import { initialRunnerState, RUNNER_FPS, stepRunner } from '@/utils/runner/engine';
import { drawRunner } from '@/utils/runner/renderer';

const BASE = 'games/bennyrex-rush';
const STEP_MS = 1000 / RUNNER_FPS;

export class RunnerController {
	private mode: RunnerMode = 'loading';
	private state = initialRunnerState();
	private session: RunnerView | null = null;
	private inputs: RunnerInput[] = [];
	private action?: RunnerAction;
	private batch: RunnerBatch | null = null;
	private sending = false;
	private starting = false;
	private wantsFinish = false;
	private error = '';
	private destroyed = false;
	private frameId = 0;
	private previousFrame = 0;
	private accumulated = 0;
	private lastEmit = 0;
	private visualLane = 1;
	private paintedTick = -1;
	private paintedMode: RunnerMode | null = null;
	private paintedWidth = 0;
	private paintedHeight = 0;
	private pointer: { x: number; y: number; id: number } | null = null;

	constructor(
		private canvas: HTMLCanvasElement,
		private onChange: (display: RunnerDisplay) => void,
	) {
		this.canvas.addEventListener('pointerdown', this.pointerDown);
		this.canvas.addEventListener('pointerup', this.pointerUp);
		this.canvas.addEventListener('pointercancel', this.pointerCancel);
		window.addEventListener('keydown', this.keyDown);
		window.addEventListener('blur', this.pause);
		document.addEventListener('visibilitychange', this.visibilityChange);
		this.frameId = requestAnimationFrame(this.frame);
		void this.load();
	}

	private emit() {
		if (!this.destroyed) {
			this.onChange({
				mode: this.mode,
				state: { ...this.state },
				error: this.error,
				rank: this.session?.rank,
				busy: this.sending || this.starting,
			});
		}
	}

	private install(session: RunnerView) {
		this.session = session;
		this.state = structuredClone(session.state);
		this.visualLane = this.state.lane;
		this.inputs = [];
		this.action = undefined;
		this.accumulated = 0;
		this.wantsFinish = false;
		this.batch = null;
		this.mode = session.status === 'completed' ? 'finished' : 'paused';
	}

	private async load() {
		try {
			const { session } = await api<{ session: RunnerView | null }>(`${BASE}/current`);

			if (this.destroyed) {
				return;
			}

			if (session) {
				this.install(session);
			} else {
				this.mode = 'ready';
			}
			this.error = '';
		} catch (error) {
			this.error = errorMessage(error);
			this.mode = 'ready';
		}
		this.emit();
	}

	async start() {
		if (this.starting || this.sending || this.batch) {
			return;
		}

		this.starting = true;
		this.error = '';
		this.emit();

		try {
			const { session } = await api<{ session: RunnerView }>(`${BASE}/start`, {});

			if (this.destroyed) {
				return;
			}

			this.install(session);
			this.resume();
		} catch (error) {
			this.error = errorMessage(error);
		} finally {
			this.starting = false;
			this.emit();
		}
	}

	resume() {
		if (!this.session || this.state.dead || this.batch || this.sending || this.wantsFinish) {
			return;
		}

		this.error = '';
		this.mode = 'running';
		this.previousFrame = 0;
		this.accumulated = 0;
		this.canvas.focus({ preventScroll: true });
		this.emit();
	}

	pause = () => {
		if (this.mode !== 'running') {
			return;
		}

		this.mode = 'paused';
		this.action = undefined;
		this.emit();
		void this.flush();
	};

	finish() {
		if (!this.session || this.mode === 'finished') {
			return;
		}

		this.wantsFinish = true;
		this.mode = 'saving';
		this.emit();
		void this.flush();
	}

	retry() {
		this.error = '';
		this.emit();

		if (this.session) {
			void this.flush();
		} else {
			void this.load();
		}
	}

	input(action: RunnerAction) {
		if (this.mode === 'running') {
			this.action = action;
		}
	}

	private async flush() {
		if (!this.session || this.sending || this.mode === 'finished') {
			return;
		}

		if (!this.batch) {
			if (this.state.tick === this.session.state.tick && !this.wantsFinish && !this.state.dead) {
				return;
			}

			this.batch = {
				sessionId: this.session.id,
				batchId: runnerBatchId(),
				revision: this.session.revision,
				toTick: this.state.tick,
				inputs: this.inputs.filter((input) => input.tick <= this.state.tick),
				finish: this.wantsFinish || this.state.dead,
			};
		}

		this.sending = true;
		this.emit();
		let succeeded = false;

		try {
			const { session } = await api<{ session: RunnerView }>(`${BASE}/checkpoint`, this.batch);
			this.session = session;
			this.inputs = this.inputs.filter((input) => input.tick > session.state.tick);
			this.batch = null;
			this.error = '';
			succeeded = true;

			if (session.status === 'completed') {
				this.install(session);
			}
		} catch (error) {
			this.mode = 'paused';
			this.error = errorMessage(error);

			if (error instanceof ApiError && (error.status === 409 || error.status === 400)) {
				// Restore authoritative state instead of replaying a stale/conflicting batch forever.
				await this.load();
				this.error = 'A corrida foi retomada da última gravação. Podes continuar.';
			}
		} finally {
			this.sending = false;
			this.emit();
		}

		if (
			succeeded &&
			!this.destroyed &&
			this.session?.status !== 'completed' &&
			(this.wantsFinish || this.state.dead || this.mode === 'paused')
		) {
			void this.flush();
		}
	}

	private frame = (now: number) => {
		if (this.destroyed) {
			return;
		}

		const delta = this.previousFrame ? now - this.previousFrame : 0;
		this.previousFrame = now;

		if (this.mode === 'running' && this.session) {
			if (delta > 750) {
				this.pause();
			} else {
				this.accumulated += Math.min(delta, 100);

				while (this.accumulated >= STEP_MS && this.mode === 'running') {
					const action =
						this.state.tick + 1 - this.state.lastInputTick >= 4 ? this.action : undefined;

					if (action) {
						this.inputs.push({ tick: this.state.tick + 1, action });
						this.action = undefined;
					}

					stepRunner(this.state, this.session.seed, action);
					this.accumulated -= STEP_MS;

					if (this.state.dead) {
						this.mode = 'saving';
						void this.flush();
					} else if (this.state.tick - this.session.state.tick >= 480 || this.inputs.length >= 64) {
						this.pause();
					}
				}

				if (this.state.tick - this.session.state.tick >= 180 && !this.error) {
					void this.flush();
				}
			}
		}

		this.visualLane += (this.state.lane - this.visualLane) * Math.min(1, delta / 65);
		if (
			this.mode === 'running' ||
			this.paintedTick !== this.state.tick ||
			this.paintedMode !== this.mode ||
			this.paintedWidth !== this.canvas.clientWidth ||
			this.paintedHeight !== this.canvas.clientHeight
		) {
			drawRunner(this.canvas, this.state, this.session?.seed ?? 12345, this.visualLane);
			this.paintedTick = this.state.tick;
			this.paintedMode = this.mode;
			this.paintedWidth = this.canvas.clientWidth;
			this.paintedHeight = this.canvas.clientHeight;
		}

		if (this.mode === 'running' && now - this.lastEmit > 100) {
			this.lastEmit = now;
			this.emit();
		}

		this.frameId = requestAnimationFrame(this.frame);
	};

	private visibilityChange = () => {
		if (document.hidden) {
			this.pause();
		}
	};

	private keyDown = (event: KeyboardEvent) => {
		if (this.mode !== 'running') {
			return;
		}

		const actions: Record<string, RunnerAction> = {
			ArrowLeft: 'left',
			ArrowRight: 'right',
			ArrowUp: 'jump',
			ArrowDown: 'slide',
			' ': 'jump',
			a: 'left',
			d: 'right',
			w: 'jump',
			s: 'slide',
		};

		if (actions[event.key]) {
			event.preventDefault();
			this.input(actions[event.key]);
		} else if (event.key === 'Escape' || event.key === 'p') {
			event.preventDefault();
			this.pause();
		}
	};

	private pointerDown = (event: PointerEvent) => {
		if (this.mode === 'running') {
			this.pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
			this.canvas.setPointerCapture(event.pointerId);
		}
	};

	private pointerUp = (event: PointerEvent) => {
		if (!this.pointer || this.pointer.id !== event.pointerId) {
			return;
		}

		const dx = event.clientX - this.pointer.x;
		const dy = event.clientY - this.pointer.y;
		this.pointer = null;

		if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) {
			return;
		}

		this.input(
			Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'jump' : 'slide',
		);
	};

	private pointerCancel = () => {
		this.pointer = null;
	};

	destroy() {
		this.pause();
		this.destroyed = true;
		cancelAnimationFrame(this.frameId);
		this.canvas.removeEventListener('pointerdown', this.pointerDown);
		this.canvas.removeEventListener('pointerup', this.pointerUp);
		this.canvas.removeEventListener('pointercancel', this.pointerCancel);
		window.removeEventListener('keydown', this.keyDown);
		window.removeEventListener('blur', this.pause);
		document.removeEventListener('visibilitychange', this.visibilityChange);
	}
}
