import { cookies } from 'next/headers';
import { createHash, createHmac, scrypt } from 'node:crypto';

import { GameError } from './quiz';

const ADMIN_COOKIE = 'dino-admin-session';
const ADMIN_MAX_AGE = 60 * 60 * 8;
const blockedTerms = ['cona', 'pila'];

function adminSecret() {
	const value = process.env.ADMIN_PASSWORD_HASH;
	if (!value || value.length < 32) {
		throw new Error('ADMIN_PASSWORD_HASH must contain a valid hash');
	}

	return value;
}

function signature(value: string) {
	return createHmac('sha256', adminSecret()).update(value).digest('base64url');
}

function normalized(value: string) {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/gu, '')
		.toLocaleLowerCase('pt-PT')
		.replace(/[^\p{L}\p{N}]+/gu, '');
}

export function validateDisplayName(name: string) {
	const value = normalized(name);
	if (blockedTerms.some((term) => value.includes(normalized(term)))) {
		throw new GameError('Escolhe um nome diferente para manter a festa respeitosa.', 422);
	}
}

function derive(password: string, salt: string) {
	return new Promise<Buffer>((resolve, reject) => {
		scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
			if (error) {
				reject(error);
			} else {
				resolve(key);
			}
		});
	});
}

export async function verifyAdminPassword(password: string) {
	const [version, salt, expected] = adminSecret().split(':');
	if (
		version !== 'scrypt-v1' ||
		!/^[a-f0-9]{32}$/.test(salt ?? '') ||
		!/^[a-f0-9]{128}$/.test(expected ?? '')
	) {
		return false;
	}
	const actual = await derive(password, salt);

	return (
		createHash('sha256').update(actual).digest('hex') ===
		createHash('sha256').update(expected, 'hex').digest('hex')
	);
}

export function adminUsername() {
	const value = process.env.ADMIN_USERNAME?.trim();
	if (!value || value.length < 2 || value.length > 64) {
		throw new Error('ADMIN_USERNAME is required');
	}

	return value;
}

export async function adminIdentity() {
	const token = (await cookies()).get(ADMIN_COOKIE)?.value;
	if (!token) {
		return false;
	}
	const [payload, sig] = token.split('.');

	return Boolean(payload && sig && sig === signature(payload) && Number(payload) > Date.now());
}

export async function requireAdmin() {
	if (!(await adminIdentity())) {
		throw new GameError('Acesso de administrador necessário.', 401);
	}
}

export async function saveAdminIdentity() {
	const expires = Date.now() + ADMIN_MAX_AGE * 1000;
	const payload = String(expires);
	(await cookies()).set(ADMIN_COOKIE, `${payload}.${signature(payload)}`, {
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: ADMIN_MAX_AGE,
	});
}

export async function clearAdminIdentity() {
	(await cookies()).delete(ADMIN_COOKIE);
}
