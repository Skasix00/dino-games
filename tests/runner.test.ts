import type { ObstacleKind, RunnerAction, RunnerInput } from '../src/types/runner';

import { describe, expect, it } from 'vitest';

import {
	initialRunnerState,
	MAX_BATCH_TICKS,
	runnerRow,
	runnerSpeed,
	simulateRunner,
	stepRunner,
} from '../src/utils/runner/engine';

function seedFor(kind: ObstacleKind) {
	for (let seed = 1; seed < 1000; seed++) {
		if (runnerRow(seed, 0).obstacles[0].kind === kind) {
			return seed;
		}
	}
	throw new Error('Missing test obstacle');
}

function hitObstacle(kind: ObstacleKind, action?: RunnerAction) {
	const seed = seedFor(kind);
	const state = initialRunnerState();
	const row = runnerRow(seed, 0);
	state.lane = row.obstacles[0].lane;

	while (state.distance < row.distance - 5) {
		stepRunner(state, seed);
	}

	stepRunner(state, seed, action);

	while (state.nextRow === 0) {
		stepRunner(state, seed);
	}

	return state;
}

describe('BennyRex deterministic runner', () => {
	it('generates reproducible obstacles and always leaves a clear lane', () => {
		for (let seed = 1; seed <= 20; seed++) {
			for (let row = 0; row < 100; row++) {
				const first = runnerRow(seed, row);
				expect(first).toEqual(runnerRow(seed, row));
				expect(first.obstacles.length).toBeLessThanOrEqual(2);
				expect(first.obstacles.some((item) => item.lane === first.coinLane)).toBe(false);
				expect(new Set(first.obstacles.map((item) => item.lane)).size).toBe(first.obstacles.length);
			}
		}
	});

	it('clamps lane changes and prevents repeated inputs within four ticks', () => {
		const state = initialRunnerState();
		stepRunner(state, 1, 'left');
		expect(state.lane).toBe(0);
		stepRunner(state, 1, 'right');
		expect(state.lane).toBe(0);
		for (let index = 0; index < 5; index++) {
			stepRunner(state, 1);
		}
		stepRunner(state, 1, 'left');
		expect(state.lane).toBe(0);
	});

	it('requires jumping over crates, sliding under arches and changing lanes for carts', () => {
		expect(hitObstacle('crate').dead).toBe(true);
		expect(hitObstacle('crate', 'jump').dead).toBe(false);
		expect(hitObstacle('crate', 'slide').dead).toBe(true);
		expect(hitObstacle('arch').dead).toBe(true);
		expect(hitObstacle('arch', 'slide').dead).toBe(false);
		expect(hitObstacle('arch', 'jump').dead).toBe(true);
		expect(hitObstacle('cart', 'jump').dead).toBe(true);
		expect(hitObstacle('cart', 'slide').dead).toBe(true);
	});

	it('collects coins and computes score from distance and coins only', () => {
		const state = initialRunnerState();
		state.lane = runnerRow(42, 0).coinLane;
		while (state.nextRow === 0) {
			stepRunner(state, 42);
		}
		expect(state.dead).toBe(false);
		expect(state.coins).toBe(5);
		expect(state.score).toBe(Math.floor(state.distance) + 50);
		expect(runnerSpeed({ ...state, tick: 100_000 })).toBe(27);
	});

	it('replays movement identically in whole or split checkpoints', () => {
		const inputs: RunnerInput[] = [
			{ tick: 10, action: 'left' },
			{ tick: 30, action: 'jump' },
			{ tick: 80, action: 'right' },
			{ tick: 100, action: 'slide' },
		];
		const first = simulateRunner(initialRunnerState(), 7, 60, inputs.slice(0, 2));
		const split = simulateRunner(first, 7, 150, inputs.slice(2));
		const whole = simulateRunner(initialRunnerState(), 7, 150, inputs);
		expect(split).toEqual(whole);
	});

	it('rejects excessive simulation windows, out-of-order inputs and play after collision', () => {
		const state = initialRunnerState();
		expect(() => simulateRunner(state, 1, MAX_BATCH_TICKS + 1, [])).toThrow();
		expect(() =>
			simulateRunner(state, 1, 10, [
				{ tick: 5, action: 'left' },
				{ tick: 5, action: 'right' },
			]),
		).toThrow();
		expect(() => simulateRunner(state, 1, 10, [{ tick: 11, action: 'left' }])).toThrow();
		const dead = hitObstacle('cart');
		expect(() => simulateRunner(dead, 1, dead.tick + 1, [])).toThrow();
	});
});
