import type { SharedGameSession } from '@/types/game';

export type RunnerAction = 'left' | 'right' | 'jump' | 'slide';

export type ObstacleKind = 'crate' | 'arch' | 'cart';

export interface RunnerInput {
	tick: number;
	action: RunnerAction;
}

export interface RunnerState {
	tick: number;
	distance: number;
	lane: number;
	coins: number;
	score: number;
	jumpUntil: number;
	slideUntil: number;
	lastInputTick: number;
	nextRow: number;
	dead: boolean;
}

export interface RunnerRow {
	index: number;
	distance: number;
	coinLane: number;
	obstacles: { lane: number; kind: ObstacleKind }[];
}

export interface RunnerSession extends SharedGameSession {
	type: 'runner';
	distance: number;
	coins: number;
	runner: {
		seed: number;
		state: RunnerState;
		lastBatchId?: string;
	};
}

export interface RunnerView {
	rulesVersion: string;
	id: string;
	status: 'active' | 'completed';
	revision: number;
	seed: number;
	state: RunnerState;
	rank?: number;
}

export interface RunnerBatch {
	sessionId: string;
	batchId: string;
	revision: number;
	toTick: number;
	inputs: RunnerInput[];
	finish: boolean;
}

export type RunnerMode = 'loading' | 'ready' | 'running' | 'paused' | 'saving' | 'finished';

export interface RunnerDisplay {
	rulesVersion: string;
	mode: RunnerMode;
	state: RunnerState;
	error: string;
	rank?: number;
	busy: boolean;
}
