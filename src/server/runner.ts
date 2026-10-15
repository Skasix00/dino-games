import type { Identity } from '@/server/auth';
import type { RunnerBatch, RunnerSession, RunnerView } from '@/types/runner';

import { MongoServerError } from 'mongodb';
import { randomInt, randomUUID } from 'node:crypto';

import { database } from '@/server/database';
import { leaderboard, requireGame, requirePlayer } from '@/server/games';
import { GameError } from '@/server/quiz';
import { initialRunnerState, RUNNER_FPS, simulateRunner } from '@/utils/runner/engine';

import 'server-only';

async function runs() {
	return (await database()).collection<RunnerSession>('gameSessions');
}

function requireRunner(slug: string) {
	const game = requireGame(slug);

	if (game.type !== 'runner') {
		throw new GameError('Este jogo não é uma corrida.', 404);
	}

	return game;
}

export async function currentRunner(auth: Identity, slug: string) {
	requireRunner(slug);

	return (await runs()).findOne(
		{ ownerId: auth.ownerId, playerId: auth.playerId, gameSlug: slug },
		{ sort: { startedAt: -1 } },
	);
}

export async function ownedRunner(auth: Identity, slug: string, id: string) {
	requireRunner(slug);
	const run = await (
		await runs()
	).findOne({ _id: id, ownerId: auth.ownerId, playerId: auth.playerId, gameSlug: slug });

	if (!run) {
		throw new GameError('Corrida não encontrada para este jogador.', 404);
	}

	return run;
}

export async function startRunner(auth: Identity, slug: string) {
	const game = requireRunner(slug);
	await requirePlayer(auth);
	const collection = await runs();
	const filter = {
		ownerId: auth.ownerId,
		playerId: auth.playerId,
		gameSlug: slug,
		status: 'active' as const,
	};
	const existing = await collection.findOne(filter);

	if (existing) {
		return existing;
	}

	const run: RunnerSession = {
		_id: randomUUID(),
		ownerId: auth.ownerId,
		playerId: auth.playerId,
		gameSlug: slug,
		type: 'runner',
		rulesVersion: game.rulesVersion,
		contentVersion: game.contentVersion,
		status: 'active',
		revision: 0,
		startedAt: new Date(),
		score: 0,
		distance: 0,
		coins: 0,
		totalTimeMs: 0,
		runner: { seed: randomInt(0, 0x7fffffff), state: initialRunnerState() },
	};

	try {
		await collection.insertOne(run);
	} catch (error) {
		if (error instanceof MongoServerError && error.code === 11000) {
			const winner = await collection.findOne(filter);

			if (winner) {
				return winner;
			}
		}
		throw error;
	}

	return run;
}

export async function checkpointRunner(auth: Identity, slug: string, batch: RunnerBatch) {
	const game = requireRunner(slug);
	const current = await ownedRunner(auth, slug, batch.sessionId);

	if (current.runner.lastBatchId === batch.batchId) {
		return current;
	}

	if (current.status !== 'active' || current.revision !== batch.revision) {
		throw new GameError(
			'A corrida foi atualizada noutro separador. Retoma a última gravação.',
			409,
		);
	}

	if (current.rulesVersion !== game.rulesVersion) {
		throw new GameError('Esta versão da corrida já não está disponível.', 409);
	}

	if ((batch.toTick * 1000) / RUNNER_FPS > Date.now() - current.startedAt.getTime() + 1000) {
		throw new GameError('O tempo da corrida não é válido.', 400);
	}

	let state;

	try {
		state = simulateRunner(current.runner.state, current.runner.seed, batch.toTick, batch.inputs);
	} catch {
		throw new GameError('Os movimentos da corrida não são válidos.', 400);
	}

	const completed = state.dead || batch.finish;
	const updated: RunnerSession = {
		...current,
		revision: current.revision + 1,
		status: completed ? 'completed' : 'active',
		...(completed ? { completedAt: new Date() } : {}),
		score: state.score,
		distance: Math.floor(state.distance),
		coins: state.coins,
		totalTimeMs: Math.round((state.tick * 1000) / RUNNER_FPS),
		runner: { seed: current.runner.seed, state, lastBatchId: batch.batchId },
	};
	const result = await (
		await runs()
	).replaceOne({ _id: current._id, revision: current.revision, status: 'active' }, updated);

	if (result.modifiedCount !== 1) {
		const winner = await ownedRunner(auth, slug, batch.sessionId);

		if (winner.runner.lastBatchId === batch.batchId) {
			return winner;
		}

		throw new GameError(
			'A corrida foi atualizada noutro separador. Retoma a última gravação.',
			409,
		);
	}

	return updated;
}

export async function runnerResponse(run: RunnerSession): Promise<RunnerView> {
	const view: RunnerView = {
		id: run._id,
		status: run.status,
		revision: run.revision,
		seed: run.runner.seed,
		state: run.runner.state,
	};

	if (run.status === 'completed') {
		view.rank = (await leaderboard(run.gameSlug, run)).find(
			(row) => row.playerId === run.playerId,
		)?.rank;
	}

	return view;
}
