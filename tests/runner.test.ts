import type { ObstacleKind, RunnerAction, RunnerInput } from '../src/types/runner';

import { describe, expect, it } from 'vitest';

import {
	LEVEL_DISTANCE,
	runnerLevel,
	runnerLevelProgress,
	runnerRowDistance,
} from '../src/utils/runner/difficulty';
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
		expect(runnerSpeed({ ...state, distance: 100_000 })).toBeCloseTo(42);
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

describe('continuous runner levels', () => {
	it('levels up every 200 metres without a speed jump or a reset', () => {
		const state = initialRunnerState();
		expect(runnerLevel(state)).toBe(1);
		expect(runnerLevel({ distance: 199.99 })).toBe(1);
		expect(runnerLevel({ distance: 200 })).toBe(2);
		expect(runnerLevel({ distance: 2000 })).toBe(11);
		expect(runnerLevelProgress({ distance: 100 })).toBe(0.5);
		expect(runnerLevelProgress({ distance: 200 })).toBe(0);
		for (let level = 1; level <= 30; level++) {
			const distance = level * LEVEL_DISTANCE;
			const before = runnerSpeed({ ...state, distance: distance - 0.01 });
			const after = runnerSpeed({ ...state, distance });
			expect(after).toBeGreaterThan(before);
			expect(after - before).toBeLessThan(0.001);
			expect(after).toBeLessThanOrEqual(42);
		}
	});

	it('tightens obstacle spacing and increases density while preserving an escape route', () => {
		let previousGap = 25;
		for (let index = 1; index <= 400; index++) {
			const gap = runnerRowDistance(index) - runnerRowDistance(index - 1);
			expect(gap).toBeGreaterThanOrEqual(16 - 1e-9);
			expect(gap).toBeLessThanOrEqual(previousGap + 1e-9);
			previousGap = gap;
			const row = runnerRow(42, index);
			if (row.distance >= 200) {
				expect(row.obstacles).toHaveLength(2);
			}
			expect(row.obstacles.some((item) => item.lane === row.coinLane)).toBe(false);
		}
	});

	it('keeps legacy physics for existing attempts', () => {
		const state = initialRunnerState();
		expect(runnerSpeed(state, '1')).toBe(13);
		expect(runnerRow(42, 0, '1').distance).toBe(65);
		expect(runnerRow(42, 10, '1').distance).toBe(325);
		expect(simulateRunner(state, 42, 30, [], '1').score).toBe(6);
		expect(simulateRunner(state, 42, 30, [], '2').score).toBe(9);
	});

	it('replays a long safe route across levels identically after checkpoint recovery', () => {
		const state = initialRunnerState();
		const inputs: RunnerInput[] = [];
		const seed = 42;
		for (let tick = 1; tick <= 3600; tick++) {
			const lane = runnerRow(seed, state.nextRow).coinLane;
			const action =
				state.lane === lane || tick - state.lastInputTick < 4
					? undefined
					: state.lane < lane
						? 'right'
						: 'left';
			if (action) {
				inputs.push({ tick, action });
			}
			stepRunner(state, seed, action);
			expect(state.dead).toBe(false);
		}
		let recovered = initialRunnerState();
		for (let tick = 300; tick <= 3600; tick += 300) {
			recovered = simulateRunner(
				recovered,
				seed,
				tick,
				inputs.filter((input) => input.tick > tick - 300 && input.tick <= tick),
			);
		}
		expect(recovered).toEqual(state);
		expect(runnerLevel(recovered)).toBeGreaterThan(6);
		expect(recovered.coins).toBeGreaterThan(100);
	});
});
