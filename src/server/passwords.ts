import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const PARAMETERS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(password, salt, KEY_LENGTH, PARAMETERS, (error, key) => {
			if (error) {
				reject(error);
			} else {
				resolve(key);
			}
		});
	});
}

export async function hashPassword(password: string) {
	const salt = randomBytes(16).toString('hex');
	const key = await derive(password, salt);

	return `scrypt-v1:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored?: string) {
	const [version, salt, expected] = (stored ?? '').split(':');
	const valid =
		version === 'scrypt-v1' &&
		/^[a-f0-9]{32}$/.test(salt ?? '') &&
		/^[a-f0-9]{128}$/.test(expected ?? '');
	// Missing usernames still perform the same expensive key derivation.
	const key = await derive(password, valid ? salt : '00000000000000000000000000000000');
	const expectedKey = valid ? Buffer.from(expected, 'hex') : Buffer.alloc(KEY_LENGTH);

	return timingSafeEqual(key, expectedKey) && valid;
}
