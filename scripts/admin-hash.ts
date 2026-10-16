import { randomBytes, scrypt } from 'node:crypto';

function hash(password: string) {
	const salt = randomBytes(16).toString('hex');

	return new Promise<string>((resolve, reject) => {
		scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
			if (error) {
				reject(error);
			} else {
				resolve(`scrypt-v1:${salt}:${key.toString('hex')}`);
			}
		});
	});
}

const passwordIndex = process.argv.indexOf('--password');
const password = passwordIndex >= 0 ? process.argv[passwordIndex + 1] : undefined;

if (!password || password.length < 8) {
	throw new Error('Use: npm run admin:hash -- --password "..."');
}

console.info(await hash(password));
