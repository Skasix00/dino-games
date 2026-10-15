import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { checkOrigin, clearIdentity, requireIdentity, saveIdentity, throttle } from '@/server/auth';
import { collections, database } from '@/server/database';
import {
	availability,
	changeSession,
	createPlayer,
	currentGame,
	leaderboard,
	ownedSession,
	requireGame,
	sessionResponse,
	startGame,
} from '@/server/games';
import { hashPassword, verifyPassword } from '@/server/passwords';
import { GameError, normalizeName } from '@/server/quiz';
const uuid = z.string().uuid();
const answerSchema = z
	.object({
		sessionId: uuid,
		questionId: z.string().min(1).max(100),
		optionId: z.string().min(1).max(100).optional(),
	})
	.strict();

function json(value: unknown, status = 200) {
	return NextResponse.json(value, {
		status,
		headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) },
	});
}

async function body(request: Request) {
	const text = await request.text();
	if (text.length > 4096) {
		throw new GameError('Pedido demasiado grande.', 413);
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new GameError('Pedido inválido.');
	}
}

export async function handleApi(request: Request, path: string[]) {
	try {
		const route = path.join('/');
		const post = request.method === 'POST';
		if (post) {
			checkOrigin(request);
		}
		if (!post && route === 'health') {
			await (await database()).command({ ping: 1 });

			return json({ ok: true });
		}
		if (post && (route === 'auth/register' || route === 'auth/login')) {
			await throttle(request, 'accounts', 60);
			const { displayName, password } = z
				.object({
					displayName: z.string().min(2).max(32),
					password: z.string().min(8).max(128),
				})
				.strict()
				.parse(await body(request));

			await throttle(request, 'username', 15, normalizeName(displayName));
			const { players } = await collections();
			let player;

			if (route === 'auth/register') {
				player = await createPlayer(displayName, await hashPassword(password));
			} else {
				player = await players.findOne({ normalizedName: normalizeName(displayName) });
				const valid = await verifyPassword(password, player?.passwordHash);

				if (!player || !valid) {
					throw new GameError('Nome de utilizador ou palavra-passe incorretos.', 401);
				}
			}

			await saveIdentity(player._id);

			return json(
				{ player: { _id: player._id, displayName: player.displayName } },
				route === 'auth/register' ? 201 : 200,
			);
		}
		const auth = await requireIdentity();
		await throttle(request, post ? 'write' : 'read', post ? 120 : 240, auth.ownerId);
		const { players } = await collections();
		if (route === 'me' && !post) {
			const player = auth.playerId
				? await players.findOne({ _id: auth.playerId }, { projection: { _id: 1, displayName: 1 } })
				: null;

			return json({ player });
		}
		if (route === 'logout' && post) {
			await clearIdentity();

			return json({ ok: true });
		}
		if (path[0] === 'games' && path.length === 3) {
			const [, slug, action] = path;
			const game = requireGame(slug);
			if (!post && action === 'availability') {
				return json({ ready: (await availability(game)).ready });
			}
			if (!post && action === 'leaderboard') {
				return json({ rows: await leaderboard(slug) });
			}
			if (!post && action === 'current') {
				const session = await currentGame(auth, slug);

				return json({ session: session ? await sessionResponse(session) : null });
			}
			if (!post && action === 'result') {
				const id = uuid.parse(new URL(request.url).searchParams.get('sessionId'));
				const session = await ownedSession(auth, slug, id);
				if (session.status !== 'completed') {
					throw new GameError('A partida ainda não terminou.', 409);
				}

				return json({ session: await sessionResponse(session) });
			}
			if (post && action === 'start') {
				return json({ session: await sessionResponse(await startGame(auth, slug)) });
			}
			if (post && (action === 'answer' || action === 'next')) {
				const data = answerSchema.parse(await body(request));
				if (action === 'answer' && !data.optionId) {
					throw new GameError('Escolhe uma resposta.');
				}
				const session = await changeSession(
					auth,
					slug,
					data.sessionId,
					action,
					data.questionId,
					data.optionId,
				);

				return json({ session: await sessionResponse(session) });
			}
		}
		throw new GameError('Página não encontrada.', 404);
	} catch (error) {
		if (error instanceof GameError) {
			return json({ error: error.message }, error.status);
		}
		if (error instanceof ZodError) {
			return json({ error: 'Verifica os dados e tenta novamente.' }, 400);
		}
		// Do not log database credentials, passwords, question content or request bodies.
		console.error('API request failed:', error instanceof Error ? error.name : 'UnknownError');

		return json(
			{ error: 'Não foi possível ligar à festa. Tenta novamente dentro de instantes.' },
			503,
		);
	}
}
