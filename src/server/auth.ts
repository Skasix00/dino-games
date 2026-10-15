import { cookies } from 'next/headers';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { database } from '@/server/database';

import { GameError } from './quiz';
const COOKIE = 'dino-session';
const MAX_AGE = 60 * 60 * 24 * 7;
const identitySchema = z.object({
	ownerId: z.string().uuid(),
	playerId: z.string().uuid(),
	expires: z.number(),
});
export type Identity = z.infer<typeof identitySchema>;

function secret() {
	const value = process.env.SESSION_SECRET;
	if (!value || value.length < 32) {
		throw new Error('SESSION_SECRET must contain at least 32 characters');
	}
	return value;
}

function signature(value: string) {
	return createHmac('sha256', secret()).update(value).digest('base64url');
}

export function matches(a: string, b: string) {
	return timingSafeEqual(
		createHash('sha256').update(a).digest(),
		createHash('sha256').update(b).digest(),
	);
}

export function encodeIdentity(identity: Identity) {
	const payload = Buffer.from(JSON.stringify(identity)).toString('base64url');

	return `${payload}.${signature(payload)}`;
}

export function decodeIdentity(token?: string): Identity | null {
	if (!token) {
		return null;
	}
	const [payload, sig, extra] = token.split('.');
	if (!payload || !sig || extra || !matches(sig, signature(payload))) {
		return null;
	}
	try {
		const value = identitySchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));

		return value.expires > Date.now() ? value : null;
	} catch {
		return null;
	}
}

export async function identity() {
	return decodeIdentity((await cookies()).get(COOKIE)?.value);
}

export async function requireIdentity() {
	const value = await identity();
	if (!value) {
		throw new GameError('Entra no teu utilizador para continuar.', 401);
	}

	return value;
}

export async function saveIdentity(playerId: string) {
	const current: Identity = { ownerId: randomUUID(), playerId, expires: Date.now() + MAX_AGE * 1000 };
	(await cookies()).set(COOKIE, encodeIdentity(current), {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: MAX_AGE,
	});

	return current;
}

export async function clearIdentity() {
	(await cookies()).delete(COOKIE);
}

export function checkOrigin(request: Request) {
	const expected = process.env.APP_ORIGIN;
	if (!expected) {
		throw new Error('APP_ORIGIN is required');
	}
	if (request.headers.get('origin') !== expected) {
		throw new GameError('Pedido não permitido.', 403);
	}
	if (!request.headers.get('content-type')?.startsWith('application/json')) {
		throw new GameError('Formato de pedido inválido.', 415);
	}
}

export async function throttle(request: Request, bucket: string, limit: number, ownerId?: string) {
	// X-Real-IP is trustworthy only when the app is reachable solely through our proxy.
	const address =
		process.env.TRUST_PROXY === 'true' ? request.headers.get('x-real-ip') || 'unknown' : 'local';
	const key = createHash('sha256')
		.update(`${bucket}:${ownerId || address}:${Math.floor(Date.now() / 60_000)}`)
		.digest('hex');
	const db = await database();
	const entry = await db
		.collection<{ _id: string; count: number; expiresAt: Date }>('rateLimits')
		.findOneAndUpdate(
			{ _id: key },
			{ $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 120_000) } },
			{ upsert: true, returnDocument: 'after' },
		);
	if (entry!.count > limit) {
		throw new GameError('Muitos pedidos. Espera um minuto e tenta novamente.', 429);
	}
}
