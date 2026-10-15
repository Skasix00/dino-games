import type { RunnerView } from '../../src/types/runner';
import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { runnerRow } from '../../src/utils/runner/engine';

async function account(page: Page, name: string) {
	const registration = await page.request.post('/api/auth/register', {
		headers: { origin: 'http://127.0.0.1:3100' },
		data: { displayName: name, password: 'runner-test-password' },
	});
	expect(registration.status()).toBe(201);
}

async function start(page: Page): Promise<RunnerView> {
	await page.goto('/games/bennyrex-rush');
	const response = page.waitForResponse((response) =>
		response.url().endsWith('/bennyrex-rush/start'),
	);
	await page.getByRole('button', { name: 'Vamos correr!' }).click();
	const result = await response;
	expect(result.status()).toBe(200);

	return (await result.json()).session;
}

async function swipe(page: Page, dx: number, dy: number) {
	const bounds = await page.locator('canvas').boundingBox();
	const x = bounds!.x + bounds!.width / 2;
	const y = bounds!.y + bounds!.height * 0.6;
	const client = await page.context().newCDPSession(page);
	await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
	await client.send('Input.dispatchTouchEvent', {
		type: 'touchMove',
		touchPoints: [{ x: x + dx, y: y + dy }],
	});
	await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await client.detach();
}

test('mobile dinosaur runner: swipes, jump, slide, pause, lost response retry, refresh and ranking', async ({
	page,
}) => {
	await account(page, 'Dino Mobile');
	await start(page);
	const canvas = page.locator('canvas');
	await expect(canvas).toHaveAttribute('aria-label', /dinossauro BennyRex/);
	await swipe(page, -90, 0);
	await expect(canvas).toHaveAttribute('data-lane', '0');
	await page.getByRole('button', { name: 'Direita', exact: true }).click();
	await expect(canvas).toHaveAttribute('data-lane', '1');
	await swipe(page, 0, -90);
	await expect(canvas).toHaveAttribute('data-motion', 'jump');
	await expect(canvas).toHaveAttribute('data-motion', 'run');
	await page.getByRole('button', { name: 'Deslizar', exact: true }).click();
	await expect(canvas).toHaveAttribute('data-motion', 'slide');
	await expect(canvas).toHaveAttribute('data-motion', 'run');
	await page.screenshot({ path: 'test-results/mobile-runner-playing.png' });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

	await page.route(
		'**/bennyrex-rush/checkpoint',
		async (route) => {
			await route.fetch();
			await route.abort('failed');
		},
		{ times: 1 },
	);
	await page.getByRole('button', { name: 'Pausar corrida' }).click();
	await expect(page.getByRole('heading', { name: 'Pausa para as patas.' })).toBeVisible();
	await page.getByRole('button', { name: 'Tentar novamente' }).click();
	await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();
	const score = await page
		.getByLabel('Pontuação da corrida')
		.locator('strong')
		.first()
		.textContent();
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Pausa para as patas.' })).toBeVisible();
	await expect(page.getByLabel('Pontuação da corrida').locator('strong').first()).toHaveText(
		score!,
	);
	await page.getByRole('button', { name: 'Terminar e guardar pontos' }).click();
	await expect(page.getByRole('heading', { name: 'Boa corrida!' })).toBeVisible();
	await page.getByRole('link', { name: 'Ver ranking da corrida' }).click();
	await expect(page.getByRole('columnheader', { name: 'Distância' })).toBeVisible();
	await expect(page.getByRole('rowheader', { name: 'Dino Mobile' })).toBeVisible();
	await page.getByLabel('Escolher jogo').selectOption('bernardo-quiz');
	await expect(page.getByRole('columnheader', { name: 'Certas' })).toBeVisible();
});

test('collision saves the run, replay starts fresh, and backgrounding pauses', async ({ page }) => {
	await account(page, 'Dino Collision');
	const session = await start(page);
	const blockedLane = runnerRow(session.seed, 0).obstacles[0].lane;

	if (blockedLane !== 1) {
		await page
			.getByRole('button', { name: blockedLane === 0 ? 'Esquerda' : 'Direita', exact: true })
			.click();
	}

	await expect(page.getByRole('heading', { name: 'Ops! Uma colisão.' })).toBeVisible({
		timeout: 15_000,
	});
	await expect(page.getByText(/Melhor resultado:/)).toBeVisible();
	await page.getByRole('button', { name: 'Correr outra vez' }).click();
	await expect(page.getByRole('button', { name: 'Pausar corrida' })).toBeEnabled();
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(page.getByRole('heading', { name: 'Pausa para as patas.' })).toBeVisible();
	await page.setViewportSize({ width: 320, height: 640 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: 'test-results/mobile-runner-paused-small.png' });
});
