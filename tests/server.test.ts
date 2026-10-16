import type { Identity } from '../src/server/auth';
import type { RunnerSession } from '../src/types/runner';

import { MongoMemoryServer } from 'mongodb-memory-server';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { decodeIdentity, encodeIdentity } from '../src/server/auth';
import { closeDatabase, collections, database, ensureIndexes } from '../src/server/database';
import {
	changeSession,
	createPlayer,
	currentGame,
	leaderboard,
	ownedSession,
	startGame,
} from '../src/server/games';
import { handleApi } from '../src/server/http';
import { validateDisplayName } from '../src/server/moderation';
import { hashPassword, verifyPassword } from '../src/server/passwords';
import { publicSession } from '../src/server/quiz';
import { games } from '../src/settings/games';
import { fixtureQuestions } from './fixtures';

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock('next/headers', () => ({
	cookies: async () => ({
		get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
		set: (name: string, value: string) => jar.set(name, value),
		delete: (name: string) => jar.delete(name),
	}),
}));

let mongo: MongoMemoryServer;
const slug = 'bernardo-quiz';

describe('name moderation', () => {
	it('rejects normalized offensive names and accepts ordinary names', () => {
		expect(() => validateDisplayName('c.o.n.a')).toThrow('respeitosa');
		expect(() => validateDisplayName('PÍLA')).toThrow('respeitosa');
		expect(() => validateDisplayName('Benny Rex')).not.toThrow();
	});
});

async function request(path: string, data?: unknown, origin = 'http://localhost:3000') {
	return handleApi(
		new Request(`http://localhost:3000/api/${path}`, {
			method: data === undefined ? 'GET' : 'POST',
			headers: { origin, 'content-type': 'application/json' },
			body: data === undefined ? undefined : JSON.stringify(data),
		}),
		path.split('/'),
	);
}

async function playerIdentity(name = 'Ana'): Promise<Identity> {
	const player = await createPlayer(name, await hashPassword('uma-palavra-passe'));

	return { ownerId: randomUUID(), playerId: player._id, expires: Date.now() + 60_000 };
}

beforeAll(async () => {
	mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
	process.env.MONGODB_URI = mongo.getUri();
	process.env.MONGODB_DB = 'dino_tests';
	process.env.APP_ORIGIN = 'http://localhost:3000';
	process.env.SESSION_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
	await ensureIndexes();
});

beforeEach(async () => {
	jar.clear();
	const { sessions, players, questions } = await collections();
	await Promise.all([
		sessions.deleteMany({}),
		players.deleteMany({}),
		questions.deleteMany({}),
		(await database()).collection('rateLimits').deleteMany({}),
	]);
	await questions.insertMany(
		fixtureQuestions.slice(0, games[0].questionCount).map((q) => ({
			...q,
			_id: randomUUID(),
			gameSlug: slug,
			contentVersion: games[0].contentVersion,
		})),
	);
});

afterAll(async () => {
	await closeDatabase();
	await mongo?.stop();
});

describe('personal accounts and API boundaries', () => {
	it('registers without an event code, signs in, and never returns password hashes', async () => {
		const registration = await request('auth/register', {
			displayName: 'Ana',
			password: 'minha-palavra-passe',
		});
		expect(registration.status).toBe(201);
		expect(JSON.stringify(await registration.json())).not.toContain('password');
		expect(jar.get('dino-session')).toBeTruthy();
		expect((await request('me')).status).toBe(200);
		await request('logout', {});
		expect((await request('me')).status).toBe(401);
		expect(
			(await request('auth/login', { displayName: 'ANA', password: 'errada-123' })).status,
		).toBe(401);
		expect(
			(await request('auth/login', { displayName: 'ana', password: 'minha-palavra-passe' })).status,
		).toBe(200);
		expect((await request('players/select', { playerId: randomUUID() })).status).toBe(404);
	});

	it('stores salted hashes and rejects tampered or expired cookies', async () => {
		const first = await hashPassword('a-long-password');
		const second = await hashPassword('a-long-password');
		expect(first).not.toBe(second);
		expect(await verifyPassword('a-long-password', first)).toBe(true);
		expect(await verifyPassword('wrong-password', first)).toBe(false);
		const auth = await playerIdentity();
		const token = encodeIdentity(auth);
		expect(decodeIdentity(token)?.playerId).toBe(auth.playerId);
		expect(decodeIdentity(`${token}changed`)).toBeNull();
		expect(decodeIdentity(encodeIdentity({ ...auth, expires: 0 }))).toBeNull();
	});

	it('rejects duplicate normalized names, foreign origins and unauthenticated access', async () => {
		await playerIdentity('  Ana  Silva ');
		await expect(createPlayer('ANA SILVA', 'hash')).rejects.toMatchObject({ status: 409 });
		expect(
			(
				await request(
					'auth/register',
					{ displayName: 'Bruno', password: 'long-password' },
					'https://elsewhere.test',
				)
			).status,
		).toBe(403);
		for (const action of ['current', 'leaderboard', 'result', 'availability']) {
			expect((await request(`games/${slug}/${action}`)).status).toBe(401);
		}
	});

	it('throttles repeated sign-in attempts', async () => {
		for (let attempt = 0; attempt < 15; attempt++) {
			expect(
				(await request('auth/login', { displayName: 'Unknown', password: 'bad-password' })).status,
			).toBe(401);
		}
		const blocked = await request('auth/login', {
			displayName: 'Unknown',
			password: 'bad-password',
		});
		expect(blocked.status).toBe(429);
		expect(blocked.headers.get('retry-after')).toBe('60');
	});
});

describe('MongoDB sessions', () => {
	it('blocks launch if any question is pending', async () => {
		const auth = await playerIdentity();
		await (
			await collections()
		).questions.updateOne({ order: 4 }, { $set: { approved: false, correctOptionId: null } });
		await expect(startGame(auth, slug)).rejects.toMatchObject({ status: 423 });
	});

	it('returns one active run under concurrent starts and scores concurrent answers once', async () => {
		const auth = await playerIdentity();
		const runs = await Promise.all(Array.from({ length: 8 }, () => startGame(auth, slug)));
		expect(new Set(runs.map((run) => run._id)).size).toBe(1);
		const run = runs[0];
		const question = run.quiz.questions[0];
		await Promise.all(
			Array.from({ length: 8 }, () =>
				changeSession(auth, slug, run._id, 'answer', question.id, 'a'),
			),
		);
		const saved = await ownedSession(auth, slug, run._id);
		expect(saved.score).toBe(100);
		expect(saved.quiz.answers).toHaveLength(1);
		await expect(
			changeSession(auth, slug, run._id, 'answer', question.id, 'b'),
		).rejects.toMatchObject({ status: 409 });
		await Promise.all(
			Array.from({ length: 4 }, () => changeSession(auth, slug, run._id, 'next', question.id)),
		);
		expect((await ownedSession(auth, slug, run._id)).quiz.index).toBe(1);
	});

	it('restores exact snapshots after reconnect, content edits and refreshes', async () => {
		const auth = await playerIdentity();
		const run = await startGame(auth, slug);
		await (await collections()).questions.updateMany({}, { $set: { text: 'Changed bank' } });
		await closeDatabase();
		const recovered = await currentGame(auth, slug);
		expect(recovered?.quiz).toEqual(run.quiz);
		expect(publicSession(recovered!).question).toEqual(publicSession(run).question);
		expect(JSON.stringify(publicSession(run))).not.toContain('correctOptionId');
		await expect(
			ownedSession({ ...auth, ownerId: randomUUID() }, slug, run._id),
		).rejects.toMatchObject({ status: 404 });
	});

	it('ranks best attempts by accuracy, milliseconds, completion, and isolates games', async () => {
		const { sessions } = await collections();
		const names = ['Ana', 'Bruno', 'Carla', 'Diogo'];
		const accounts = await Promise.all(names.map((name) => playerIdentity(name)));
		const base = await startGame(accounts[0], slug);
		const results = [
			{
				playerId: accounts[0].playerId,
				score: 1600,
				totalTimeMs: 1000,
				completedAt: new Date(1000),
			},
			{
				playerId: accounts[0].playerId,
				score: 1700,
				totalTimeMs: 5000,
				completedAt: new Date(2000),
			},
			{
				playerId: accounts[1].playerId,
				score: 1700,
				totalTimeMs: 4999,
				completedAt: new Date(4000),
			},
			{
				playerId: accounts[2].playerId,
				score: 1700,
				totalTimeMs: 5000,
				completedAt: new Date(3000),
			},
			{ playerId: accounts[3].playerId, score: 1600, totalTimeMs: 1, completedAt: new Date(1000) },
		];
		await sessions.insertMany(
			results.map((result) => ({
				...base,
				...result,
				_id: randomUUID(),
				status: 'completed' as const,
				correctAnswers: result.score / 100,
			})),
		);
		await sessions.insertOne({
			...base,
			_id: randomUUID(),
			gameSlug: 'other-game',
			status: 'completed',
			score: 9999,
		});
		const ranking = await leaderboard(slug);
		expect(ranking.map((row) => row.displayName)).toEqual(['Bruno', 'Ana', 'Carla', 'Diogo']);
		expect(ranking).toHaveLength(4);
		games.push({ ...games[0], slug: 'other-game' });
		try {
			expect(await leaderboard('other-game')).toHaveLength(1);
		} finally {
			games.pop();
		}
	});
});

describe('runner checkpoints and shared rankings', () => {
	it('starts immediately without approved quiz questions and resumes its saved state', async () => {
		const auth = await playerIdentity();
		await (await collections()).questions.deleteMany({});
		const { startRunner, currentRunner } = await import('../src/server/runner');
		const starts = await Promise.all([
			startRunner(auth, 'bennyrex-rush'),
			startRunner(auth, 'bennyrex-rush'),
		]);
		expect(starts[0]._id).toBe(starts[1]._id);
		expect((await currentRunner(auth, 'bennyrex-rush'))?.runner.state.tick).toBe(0);
	});

	it('validates scores on the server, handles concurrent retries and isolates runner rankings', async () => {
		const auth = await playerIdentity();
		const { startRunner, checkpointRunner, currentRunner, ownedRunner } =
			await import('../src/server/runner');
		const run = await startRunner(auth, 'bennyrex-rush');
		await (
			await database()
		)
			.collection<{ _id: string; startedAt: Date }>('gameSessions')
			.updateOne({ _id: run._id }, { $set: { startedAt: new Date(Date.now() - 10_000) } });
		const batch = {
			sessionId: run._id,
			batchId: randomUUID(),
			revision: 0,
			toTick: 120,
			inputs: [],
			finish: false,
		};
		const saved = await Promise.all([
			checkpointRunner(auth, 'bennyrex-rush', batch),
			checkpointRunner(auth, 'bennyrex-rush', batch),
		]);
		expect(saved[0].score).toBe(saved[1].score);
		expect(saved[0].revision).toBe(1);
		expect(saved[0].runner.state.tick).toBe(120);
		expect(saved[0].score).toBeGreaterThan(20);
		await closeDatabase();
		expect((await currentRunner(auth, 'bennyrex-rush'))?.runner.state).toEqual(
			saved[0].runner.state,
		);
		await expect(
			ownedRunner({ ...auth, ownerId: randomUUID() }, 'bennyrex-rush', run._id),
		).rejects.toMatchObject({ status: 404 });
		await expect(
			checkpointRunner(auth, 'bennyrex-rush', { ...batch, batchId: randomUUID() }),
		).rejects.toMatchObject({ status: 409 });
		const finished = await checkpointRunner(auth, 'bennyrex-rush', {
			...batch,
			batchId: randomUUID(),
			revision: 1,
			inputs: [],
			finish: true,
		});
		expect(finished.status).toBe('completed');
		expect((await leaderboard('bennyrex-rush'))[0].score).toBe(finished.score);
		expect(await leaderboard('bernardo-quiz')).toHaveLength(0);
		const replay = await startRunner(auth, 'bennyrex-rush');
		expect(replay._id).not.toBe(run._id);
	});

	it('rejects impossible time, browser-supplied score and quiz actions on the runner', async () => {
		const auth = await playerIdentity();
		jar.set('dino-session', encodeIdentity(auth));
		const { startRunner, checkpointRunner } = await import('../src/server/runner');
		const run = await startRunner(auth, 'bennyrex-rush');
		const batch = {
			sessionId: run._id,
			batchId: randomUUID(),
			revision: 0,
			toTick: 600,
			inputs: [],
			finish: false,
		};
		await expect(checkpointRunner(auth, 'bennyrex-rush', batch)).rejects.toMatchObject({
			status: 400,
		});
		expect(
			(await request('games/bennyrex-rush/checkpoint', { ...batch, score: 999999 })).status,
		).toBe(400);
		expect(
			(
				await request('games/bennyrex-rush/answer', {
					sessionId: run._id,
					questionId: 'q1',
					optionId: 'a',
				})
			).status,
		).toBe(404);
		await expect(changeSession(auth, 'bennyrex-rush', run._id, 'next', 'q1')).rejects.toMatchObject(
			{ status: 404 },
		);
		jar.clear();
		expect((await request('games/bennyrex-rush/checkpoint', batch)).status).toBe(401);
	});
});

describe('released quiz and versioned runner difficulty', () => {
	it('starts the real 16-question bank while retaining the unanswered question in storage', async () => {
		const { default: content } = await import('../src/content/bernardo.json');
		const { questions } = await collections();
		await questions.deleteMany({});
		await questions.insertMany(
			content.questions.map((question) => ({
				...question,
				_id: randomUUID(),
				gameSlug: slug,
				contentVersion: content.contentVersion,
			})),
		);
		const run = await startGame(await playerIdentity(), slug);
		expect(run.quiz.questions).toHaveLength(16);
		expect(run.quiz.questions.some((question) => question.id === 'q04')).toBe(false);
		expect(run.quiz.questions.every((question) => question.correctOptionId)).toBe(true);
		expect(await questions.countDocuments({})).toBe(17);
		expect((await questions.findOne({ id: 'q04' }))?.correctOptionId).toBeNull();
	});

	it('finishes old runs using old physics and separates them from the new ranking', async () => {
		const { startRunner, checkpointRunner, runnerResponse } = await import('../src/server/runner');
		const auth = await playerIdentity();
		const run = await startRunner(auth, 'bennyrex-rush');
		const collection = (await database()).collection<RunnerSession>('gameSessions');
		await collection.updateOne({ _id: run._id }, { $set: { rulesVersion: '1' } });
		const legacy = await startRunner(auth, 'bennyrex-rush');
		expect((await runnerResponse(legacy)).rulesVersion).toBe('1');
		const completed = await checkpointRunner(auth, 'bennyrex-rush', {
			sessionId: legacy._id,
			batchId: randomUUID(),
			revision: 0,
			toTick: 30,
			inputs: [],
			finish: true,
		});
		expect(completed.score).toBe(6);
		expect(await leaderboard('bennyrex-rush')).toHaveLength(0);
		expect(await leaderboard('bennyrex-rush', completed)).toHaveLength(1);
		expect((await startRunner(auth, 'bennyrex-rush')).rulesVersion).toBe('2');
	});
});
