import type { GameSession, Player, Question } from '@/types/game';

import { MongoClient } from 'mongodb';
let connection: Promise<MongoClient> | undefined;
export async function database() {
	const uri = process.env.MONGODB_URI;
	if (!uri) {
		throw new Error('MONGODB_URI is required');
	}
	connection ??= new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 })
		.connect()
		.catch((error) => {
			connection = undefined;
			throw error;
		});

	return (await connection).db(process.env.MONGODB_DB || 'dino_games');
}

export type StoredQuestion = Question & { _id: string; gameSlug: string; contentVersion: string };

export async function collections() {
	const db = await database();

	return {
		players: db.collection<Player>('players'),
		questions: db.collection<StoredQuestion>('questions'),
		sessions: db.collection<GameSession>('gameSessions'),
	};
}

export async function ensureIndexes() {
	const db = await database();
	const { players, questions, sessions } = await collections();
	await Promise.all([
		players.createIndex({ normalizedName: 1 }, { unique: true }),
		questions.createIndex({ gameSlug: 1, contentVersion: 1, order: 1 }, { unique: true }),
		sessions.createIndex({ gameSlug: 1, playerId: 1, status: 1 }),
		sessions.createIndex(
			{ ownerId: 1, playerId: 1, gameSlug: 1 },
			{ unique: true, partialFilterExpression: { status: 'active' } },
		),
		db.collection('rateLimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
	]);
}

export async function closeDatabase() {
	if (connection) {
		await (await connection).close();
		connection = undefined;
	}
}
