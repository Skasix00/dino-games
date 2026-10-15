import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';

import { fixtureQuestions } from '../tests/fixtures';

const mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
const client = await new MongoClient(mongo.getUri()).connect();

try {
	await client
		.db('dino_browser_tests')
		.collection('questions')
		.insertMany(
			fixtureQuestions.map((question) => ({
				...question,
				gameSlug: 'bernardo-quiz',
				contentVersion: '1',
			})),
		);
	await client.close();
	const code = await new Promise<number>((resolve, reject) => {
		const child = spawn('npx', ['playwright', 'test'], {
			stdio: 'inherit',
			env: {
				...process.env,
				MONGODB_URI: mongo.getUri(),
				MONGODB_DB: 'dino_browser_tests',
				SESSION_SECRET: 'browser-tests-secret-at-least-thirty-two-characters',
				TRUST_PROXY: 'false',
			},
		});
		child.on('error', reject);
		child.on('exit', (code) => resolve(code ?? 1));
	});
	process.exitCode = code;
} finally {
	await client.close();
	await mongo.stop();
}
