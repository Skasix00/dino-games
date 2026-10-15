import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import content from '../src/content/bernardo.json';

const enabledQuestions = content.questions.filter((question) => question.enabled);
const answers = Object.fromEntries(
	enabledQuestions.map((question) => [question.id, question.correctOptionId]),
);

const project = `dino-verify-${randomBytes(5).toString('hex')}`;
const directory = await mkdtemp(join(tmpdir(), 'dino-containers-'));
const compose = [
	'compose',
	'--project-name',
	project,
	'--env-file',
	join(directory, '.env'),
	'-f',
	resolve('compose.yml'),
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

async function installTestCertificate() {
	const certificate = join(directory, 'test-ca.crt');
	await docker([...compose, 'cp', 'proxy:/data/caddy/pki/authorities/local/root.crt', certificate]);
	await chmod(certificate, 0o644);
	await docker([...compose, 'cp', certificate, 'app:/tmp/test-ca.crt']);
}

const client = `
  import http from 'node:http';
  import https from 'node:https';
  import { readFileSync } from 'node:fs';
  import assert from 'node:assert/strict';
  let cookie = '';
  async function api(path, body) {
    const response = await new Promise((resolve, reject) => {
      const request = https.request({ hostname: 'proxy', servername: 'localhost', port: 443, path: '/api/' + path, ca: readFileSync('/tmp/test-ca.crt'),
      method: body === undefined ? 'GET' : 'POST',
      headers: { host: 'localhost', origin: 'https://localhost', 'content-type': 'application/json', cookie },
      }, response => {
        let text = '';
        response.on('data', chunk => text += chunk);
        response.on('end', () => resolve({
          status: response.statusCode,
          headers: { get: name => response.headers[name]?.[0] },
          json: () => JSON.parse(text),
        }));
      });
      request.on('error', reject);
      request.end(body === undefined ? undefined : JSON.stringify(body));
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
			'PUBLIC_DOMAIN=localhost',
			'MONGO_INITDB_ROOT_USERNAME=dino_test',
			'ACME_EMAIL=container-tests@example.com',
			`MONGO_INITDB_ROOT_PASSWORD=${randomBytes(24).toString('hex')}`,
			'MONGODB_DB=dino_container_tests',
			`SESSION_SECRET=${randomBytes(32).toString('hex')}`,
		].join('\n'),
		{ mode: 0o600 },
	);
	await writeFile(
		join(directory, 'override.yml'),
		'services:\n  app:\n    image: dino-games:validation\n    pull_policy: never\n  proxy:\n    ports: !reset []\n',
	);
	await docker([...compose, 'up', '-d', '--wait', '--wait-timeout', '180']);
	await installTestCertificate();
	await docker([
		...compose,
		'exec',
		'-T',
		'proxy',
		'caddy',
		'validate',
		'--config',
		'/etc/caddy/Caddyfile',
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
    const redirect = await new Promise((resolve, reject) => {
      http.get('http://proxy/api/health', { headers: { host: 'localhost' } }, response => {
        response.resume();
        resolve({ status: response.statusCode, location: response.headers.location });
      }).on('error', reject);
    });
    assert.equal(redirect.status, 308);
    assert.equal(redirect.location, 'https://localhost/api/health');
    const registered = await api('auth/register', { displayName: 'Container Tester', password: 'container-test-password' });
    assert.equal(registered.status, 201);
    assert.equal((await api('games/bernardo-quiz/availability')).data.ready, true);
    console.info('Production image: registration works and the 16-question quiz is available.');
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
    assert.equal(current.totalQuestions, ${enabledQuestions.length});
    const answers = ${JSON.stringify(answers)};
    for (let index = 0; index < ${enabledQuestions.length}; index++) {
      const questionId = current.question.id;
      assert.notEqual(questionId, 'q04');
      current = (await api('games/bernardo-quiz/answer', { sessionId: current.id, questionId, optionId: answers[questionId] })).data.session;
      if (index < ${enabledQuestions.length - 1}) current = (await api('games/bernardo-quiz/next', { sessionId: current.id, questionId })).data.session;
    }
    assert.equal(current.score, ${enabledQuestions.length * 100});
    assert.equal(current.status, 'completed');
    const runner = (await api('games/bennyrex-rush/start', {})).data.session;
    const checkpoint = await api('games/bennyrex-rush/checkpoint', {
      sessionId: runner.id, batchId: crypto.randomUUID(), revision: 0,
      toTick: 30, inputs: [], finish: true,
    });
    assert.equal(checkpoint.status, 200);
    assert.equal(checkpoint.data.session.state.score, 9);
    console.info('Production image: quiz and dinosaur runner results saved separately.');
  `,
	]);
	// Remove the entire stack without --volumes, then recover the same persisted data.
	await docker([...compose, 'down']);
	await docker([...compose, 'up', '-d', '--wait', '--wait-timeout', '180']);
	await installTestCertificate();
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
    assert.equal(ranking[0].score, ${enabledQuestions.length * 100});
    const runnerRanking = (await api('games/bennyrex-rush/leaderboard')).data.rows;
    assert.equal(runnerRanking[0].score, 9);
    assert.equal(runnerRanking[0].distance, 9);
    console.info('Persistence verified: account, quiz and runner results survived full stack removal and recreation over HTTPS.');
  `,
	]);
} finally {
	await docker([...compose, 'down', '--volumes', '--remove-orphans']).catch(() => undefined);
	await rm(directory, { recursive: true, force: true });
}
