import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { fixtureQuestions } from '../tests/fixtures';

const project = `dino-verify-${randomBytes(5).toString('hex')}`;
const directory = await mkdtemp(join(tmpdir(), 'dino-containers-'));
const network = `${project}-proxy`;
const compose = [
	'compose',
	'--project-name',
	project,
	'--env-file',
	join(directory, '.env'),
	'-f',
	resolve('deploy/compose.yml'),
	'-f',
	join(directory, 'override.yml'),
];

async function docker(args: string[]) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn('docker', args, { stdio: 'inherit' });
		child.on('error', reject);
		child.on('exit', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Docker command failed with exit ${code}`));
			}
		});
	});
}

const client = `
  import assert from 'node:assert/strict';
  let cookie = '';
  async function api(path, body) {
    const response = await fetch('http://127.0.0.1:3000/api/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { origin: 'https://bruno.castelo.net', 'content-type': 'application/json', cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /Secure/i);
      cookie = setCookie.split(';')[0];
    }
    return { status: response.status, data: await response.json() };
  }
`;

try {
	await writeFile(
		join(directory, '.env'),
		[
			'PUBLIC_DOMAIN=bruno.castelo.net',
			'MONGO_INITDB_ROOT_USERNAME=dino_test',
			`MONGO_INITDB_ROOT_PASSWORD=${randomBytes(24).toString('hex')}`,
			'MONGODB_DB=dino_container_tests',
			`SESSION_SECRET=${randomBytes(32).toString('hex')}`,
		].join('\n'),
		{ mode: 0o600 },
	);
	await writeFile(
		join(directory, 'override.yml'),
		`services:\n  app:\n    image: dino-games:validation\n    pull_policy: never\nnetworks:\n  proxy:\n    name: ${network}\n`,
	);
	await docker(['network', 'create', network]);
	await docker([...compose, 'up', '-d', '--wait', '--wait-timeout', '180']);
	await docker([...compose, 'exec', '-T', 'app', 'node', 'seed.mjs']);
	await docker([
		...compose,
		'exec',
		'-T',
		'app',
		'node',
		'--input-type=module',
		'-e',
		`${client}
    const registered = await api('auth/register', { displayName: 'Container Tester', password: 'container-test-password' });
    assert.equal(registered.status, 201);
    assert.equal((await api('games/bernardo-quiz/start', {})).status, 423);
    console.info('Production image: registration works and unapproved quiz stays locked.');
  `,
	]);

	// This project has its own randomly named volume. Production/local data is never selected.
	await docker([
		...compose,
		'exec',
		'-T',
		'app',
		'node',
		'--input-type=module',
		'-e',
		`
    import { MongoClient } from 'mongodb';
    const client = await new MongoClient(process.env.MONGODB_URI).connect();
    const questions = client.db(process.env.MONGODB_DB).collection('questions');
    await questions.deleteMany({});
    await questions.insertMany(${JSON.stringify(fixtureQuestions)}.map(q => ({ ...q, gameSlug: 'bernardo-quiz', contentVersion: '1' })));
    await client.close();
  `,
	]);
	await docker([
		...compose,
		'exec',
		'-T',
		'app',
		'node',
		'--input-type=module',
		'-e',
		`${client}
    assert.equal((await api('auth/login', { displayName: 'Container Tester', password: 'container-test-password' })).status, 200);
    let current = (await api('games/bernardo-quiz/start', {})).data.session;
    for (let index = 0; index < 17; index++) {
      const questionId = current.question.id;
      current = (await api('games/bernardo-quiz/answer', { sessionId: current.id, questionId, optionId: 'a' })).data.session;
      if (index < 16) current = (await api('games/bernardo-quiz/next', { sessionId: current.id, questionId })).data.session;
    }
    assert.equal(current.score, 1700);
    assert.equal(current.status, 'completed');
    const runner = (await api('games/bennyrex-rush/start', {})).data.session;
    const checkpoint = await api('games/bennyrex-rush/checkpoint', {
      sessionId: runner.id, batchId: crypto.randomUUID(), revision: 0,
      toTick: 30, inputs: [], finish: true,
    });
    assert.equal(checkpoint.status, 200);
    assert.equal(checkpoint.data.session.state.score, 6);
    console.info('Production image: quiz and dinosaur runner results saved separately.');
  `,
	]);
	await docker([...compose, 'up', '-d', '--force-recreate', '--wait', '--wait-timeout', '180']);
	await docker([
		...compose,
		'exec',
		'-T',
		'app',
		'node',
		'--input-type=module',
		'-e',
		`${client}
    assert.equal((await api('auth/login', { displayName: 'Container Tester', password: 'container-test-password' })).status, 200);
    const ranking = (await api('games/bernardo-quiz/leaderboard')).data.rows;
    assert.equal(ranking[0].displayName, 'Container Tester');
    assert.equal(ranking[0].score, 1700);
    const runnerRanking = (await api('games/bennyrex-rush/leaderboard')).data.rows;
    assert.equal(runnerRanking[0].score, 6);
    assert.equal(runnerRanking[0].distance, 6);
    console.info('Persistence verified: account, quiz and runner results survived container recreation.');
  `,
	]);
} finally {
	await docker([...compose, 'down', '--volumes', '--remove-orphans']).catch(() => undefined);
	await docker(['network', 'rm', network]).catch(() => undefined);
	await rm(directory, { recursive: true, force: true });
}
