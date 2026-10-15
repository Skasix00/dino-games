import type {
	ObstacleKind,
	RunnerAction,
	RunnerInput,
	RunnerRow,
	RunnerState,
} from '@/types/runner';

export const RUNNER_FPS = 60;

export const JUMP_TICKS = 54;

export const SLIDE_TICKS = 48;

export const ROW_SPACING = 26;

export const FIRST_ROW = 65;

export const MAX_BATCH_TICKS = 600;

export function initialRunnerState(): RunnerState {
	return {
		tick: 0,
		distance: 0,
		lane: 1,
		coins: 0,
		score: 0,
		jumpUntil: 0,
		slideUntil: 0,
		lastInputTick: -10,
		nextRow: 0,
		dead: false,
	};
}

function randomForRow(seed: number, row: number) {
	let value = (seed ^ Math.imul(row + 1, 0x9e3779b9)) >>> 0;
	value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
	value = Math.imul(value ^ (value >>> 15), 0x735a2d97);

	return (value ^ (value >>> 15)) >>> 0;
}

export function runnerRow(seed: number, index: number): RunnerRow {
	const value = randomForRow(seed, index);
	const coinLane = value % 3;
	const kinds: ObstacleKind[] = ['crate', 'arch', 'cart'];
	const blockedLane = (coinLane + 1 + ((value >>> 4) % 2)) % 3;
	const obstacles: RunnerRow['obstacles'] = [{ lane: blockedLane, kind: kinds[(value >>> 8) % 3] }];

	// Every row always has a completely clear lane. Early rows teach one obstacle at a time.
	if (index > 3 && (value >>> 12) % 3 !== 0) {
		obstacles.push({ lane: 3 - coinLane - blockedLane, kind: kinds[(value >>> 16) % 3] });
	}

	return { index, distance: FIRST_ROW + index * ROW_SPACING, coinLane, obstacles };
}

export function runnerSpeed(state: RunnerState) {
	return Math.min(27, 13 + state.tick / (RUNNER_FPS * 12));
}

export function jumpHeight(state: RunnerState) {
	const remaining = state.jumpUntil - state.tick;

	return remaining > 0 ? Math.sin((1 - remaining / JUMP_TICKS) * Math.PI) : 0;
}

function applyInput(state: RunnerState, action: RunnerAction) {
	if (state.tick - state.lastInputTick < 4) {
		return;
	}

	state.lastInputTick = state.tick;

	if (action === 'left') {
		state.lane = Math.max(0, state.lane - 1);
	} else if (action === 'right') {
		state.lane = Math.min(2, state.lane + 1);
	} else if (action === 'jump' && state.jumpUntil <= state.tick && state.slideUntil <= state.tick) {
		state.jumpUntil = state.tick + JUMP_TICKS;
	} else if (
		action === 'slide' &&
		state.slideUntil <= state.tick &&
		state.jumpUntil <= state.tick
	) {
		state.slideUntil = state.tick + SLIDE_TICKS;
	}
}

// One deterministic fixed step. Both browser animation and server validation use this function.
export function stepRunner(state: RunnerState, seed: number, action?: RunnerAction) {
	if (state.dead) {
		return;
	}

	state.tick += 1;

	if (action) {
		applyInput(state, action);
	}

	state.distance += runnerSpeed(state) / RUNNER_FPS;
	const row = runnerRow(seed, state.nextRow);

	if (state.distance >= row.distance) {
		const obstacle = row.obstacles.find((item) => item.lane === state.lane);
		const jumping = jumpHeight(state) >= 0.45;
		const sliding = state.slideUntil > state.tick;

		if (
			obstacle &&
			(obstacle.kind === 'cart' ||
				(obstacle.kind === 'crate' && !jumping) ||
				(obstacle.kind === 'arch' && !sliding))
		) {
			state.dead = true;
		} else if (state.lane === row.coinLane) {
			state.coins += 5;
		}

		state.nextRow += 1;
	}

	state.score = Math.floor(state.distance) + state.coins * 10;
}

export function simulateRunner(
	state: RunnerState,
	seed: number,
	toTick: number,
	inputs: RunnerInput[],
) {
	if (
		!Number.isSafeInteger(toTick) ||
		toTick < state.tick ||
		toTick - state.tick > MAX_BATCH_TICKS
	) {
		throw new Error('Invalid simulation window');
	}

	let previousTick = state.tick;

	for (const input of inputs) {
		if (!Number.isSafeInteger(input.tick) || input.tick <= previousTick || input.tick > toTick) {
			throw new Error('Invalid input order');
		}
		previousTick = input.tick;
	}

	const result = structuredClone(state);
	let cursor = 0;

	while (result.tick < toTick && !result.dead) {
		const input = inputs[cursor];
		const action = input?.tick === result.tick + 1 ? input.action : undefined;
		stepRunner(result, seed, action);

		if (action) {
			cursor += 1;
		}
	}

	if (result.tick !== toTick || cursor !== inputs.length) {
		throw new Error('Inputs continue beyond collision');
	}

	return result;
}
