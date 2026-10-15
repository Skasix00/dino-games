import type { RunnerState } from '@/types/runner';

export const CURRENT_RUNNER_RULES = '2';

export const LEVEL_DISTANCE = 200;

export function runnerLevel(
	state: Pick<RunnerState, 'distance'>,
	rulesVersion = CURRENT_RUNNER_RULES,
) {
	return rulesVersion === '1' ? 1 : Math.floor(state.distance / LEVEL_DISTANCE) + 1;
}

export function runnerLevelProgress(state: Pick<RunnerState, 'distance'>) {
	return (state.distance % LEVEL_DISTANCE) / LEVEL_DISTANCE;
}

// Reduce spacing gradually from 24 m to 16 m, then keep a playable minimum gap.
export function runnerRowDistance(index: number, rulesVersion = CURRENT_RUNNER_RULES) {
	if (rulesVersion === '1') {
		return 65 + index * 26;
	}

	const tighteningRows = Math.min(index, 160);

	return (
		55 +
		tighteningRows * 24 -
		0.025 * tighteningRows * (tighteningRows - 1) +
		Math.max(0, index - 160) * 16
	);
}
