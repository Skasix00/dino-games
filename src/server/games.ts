import type { Identity } from './auth';
import type { GameSession, RankingRow } from '@/types/game';

import { MongoServerError } from 'mongodb';
import { randomUUID } from 'node:crypto';

import { collections } from '@/server/database';
import { type GameDefinition, getGame } from '@/settings/games';

import {
	answerQuestion,
	GameError,
	isReady,
	newSession,
	nextQuestion,
	normalizeName,
	publicSession,
} from './quiz';

import 'server-only';
export function requireGame(slug: string) {
	const game = getGame(slug);
	if (!game) {
		throw new GameError('Jogo não encontrado.', 404);
	}

	return game;
}

export async function availability(game: GameDefinition) {
	const { questions } = await collections();
	const bank = await questions
		.find({ gameSlug: game.slug, contentVersion: game.contentVersion })
		.sort({ order: 1 })
		.toArray();

	return { ready: isReady(bank, game.questionCount), bank };
}

export async function createPlayer(name: string, passwordHash: string) {
	const { players } = await collections();
	const displayName = name.normalize('NFKC').trim().replace(/\s+/gu, ' ');
	const normalizedName = normalizeName(name);
	if (displayName.length < 2 || displayName.length > 32 || /[\p{Cc}\p{Cf}]/u.test(displayName)) {
		throw new GameError('Usa um nome entre 2 e 32 caracteres.');
	}
	try {
		const player = {
			_id: randomUUID(),
			displayName,
			normalizedName,
			passwordHash,
			createdAt: new Date(),
		};
		await players.insertOne(player);

		return player;
	} catch (error) {
		if (error instanceof MongoServerError && error.code === 11000) {
			throw new GameError(
				'Esse nome já existe. Entra com a tua palavra-passe ou escolhe outro nome.',
				409,
			);
		}
		throw error;
	}
}

export async function requirePlayer(auth: Identity) {
	const { players } = await collections();
	const player = auth.playerId ? await players.findOne({ _id: auth.playerId }) : null;
	if (!player) {
		throw new GameError('Escolhe primeiro o teu nome.', 422);
	}

	return player;
}

export async function startGame(auth: Identity, slug: string) {
	const game = requireGame(slug);
	const player = await requirePlayer(auth);
	const { sessions } = await collections();
	const filter = {
		ownerId: auth.ownerId,
		playerId: player._id,
		gameSlug: slug,
		status: 'active' as const,
	};
	const existing = await sessions.findOne(filter);
	if (existing) {
		return existing;
	}
	const { ready, bank } = await availability(game);
	if (!ready) {
		throw new GameError('Estamos a preparar as perguntas. O jogo estará disponível em breve!', 423);
	}
	const session = newSession(
		{
			ownerId: auth.ownerId,
			playerId: player._id,
			gameSlug: slug,
			rulesVersion: game.rulesVersion,
			contentVersion: game.contentVersion,
		},
		bank,
		new Date(),
	);
	try {
		await sessions.insertOne(session);

		return session;
	} catch (error) {
		if (error instanceof MongoServerError && error.code === 11000) {
			const winner = await sessions.findOne(filter);
			if (winner) {
				return winner;
			}
		}
		throw error;
	}
}

export async function ownedSession(auth: Identity, slug: string, id: string) {
	requireGame(slug);
	const { sessions } = await collections();
	const session = await sessions.findOne({
		_id: id,
		ownerId: auth.ownerId,
		gameSlug: slug,
		playerId: auth.playerId,
	});
	if (!session) {
		throw new GameError('Partida não encontrada para este jogador.', 404);
	}

	return session;
}

export async function currentGame(auth: Identity, slug: string) {
	requireGame(slug);
	const { sessions } = await collections();
	if (!auth.playerId) {
		return null;
	}

	return sessions.findOne(
		{ ownerId: auth.ownerId, gameSlug: slug, playerId: auth.playerId },
		{ sort: { startedAt: -1, _id: -1 } },
	);
}

export async function changeSession(
	auth: Identity,
	slug: string,
	id: string,
	action: 'answer' | 'next',
	questionId: string,
	optionId?: string,
) {
	const game = requireGame(slug);
	const arrival = new Date();
	const { sessions } = await collections();
	for (let attempt = 0; attempt < 4; attempt++) {
		const current = await ownedSession(auth, slug, id);
		// Keep versioned scoring stable if new rules are introduced later.
		if (current.rulesVersion !== game.rulesVersion) {
			throw new GameError('Esta versão do jogo já não aceita respostas.', 409);
		}
		const changed =
			action === 'answer'
				? answerQuestion(current, questionId, optionId!, arrival, game.pointsPerAnswer)
				: nextQuestion(current, questionId, arrival);
		if (changed === current) {
			return current;
		}
		const result = await sessions.replaceOne(
			{ _id: id, revision: current.revision, ownerId: auth.ownerId },
			changed,
		);
		if (result.modifiedCount === 1) {
			return changed;
		}
	}
	throw new GameError('O jogo foi atualizado noutro separador. Tenta novamente.', 409);
}

export async function leaderboard(
	slug: string,
	version?: { rulesVersion: string; contentVersion: string },
): Promise<RankingRow[]> {
	const game = requireGame(slug);
	const { sessions } = await collections();
	const rows = await sessions
		.aggregate<Omit<RankingRow, 'rank'>>([
			{
				$match: {
					gameSlug: slug,
					status: 'completed',
					rulesVersion: version?.rulesVersion ?? game.rulesVersion,
					contentVersion: version?.contentVersion ?? game.contentVersion,
				},
			},
			{ $sort: game.ranking },
			{ $group: { _id: '$playerId', best: { $first: '$$ROOT' } } },
			{ $replaceRoot: { newRoot: '$best' } },
			{ $sort: game.ranking },
			{ $lookup: { from: 'players', localField: 'playerId', foreignField: '_id', as: 'player' } },
			{ $unwind: '$player' },
			{
				$project: {
					_id: 0,
					playerId: 1,
					displayName: '$player.displayName',
					score: 1,
					correctAnswers: 1,
					totalTimeMs: 1,
					completedAt: 1,
				},
			},
		])
		.toArray();

	return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function sessionResponse(session: GameSession) {
	const data = publicSession(session);
	if (session.status === 'completed') {
		const rows = await leaderboard(session.gameSlug, session);
		data.rank = rows.find((row) => row.playerId === session.playerId)?.rank;
	}

	return data;
}
