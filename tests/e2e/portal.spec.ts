import { expect, test } from '@playwright/test';

test('mobile portal, own account, quiz completion, refresh, replay and ranking', async ({
	page,
}) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Hoje a festa/ })).toBeVisible();
	await expect(page.getByRole('article')).toHaveCount(2);
	await page
		.getByRole('article')
		.filter({ hasText: 'Quem Conhece Melhor o Bernardo?' })
		.getByRole('link', { name: 'Jogar', exact: true })
		.click();
	await expect(page.getByRole('heading', { name: 'Cria o teu utilizador.' })).toBeVisible();
	await expect(page.getByText('Código da festa')).toHaveCount(0);
	await page.getByLabel('Nome de utilizador').fill('Jogador Mobile');
	await page.getByLabel('Palavra-passe', { exact: true }).fill('uma-password-mobile');
	await page.getByRole('button', { name: 'Criar e começar' }).click();
	await page.getByRole('button', { name: 'Começar' }).click();
	await page.route(
		'**/api/games/bernardo-quiz/answer',
		async (route) => {
			await route.fetch();
			await route.abort('failed');
		},
		{ times: 1 },
	);

	for (let index = 1; index <= 16; index++) {
		await expect(page.getByText(`Pergunta ${index} de 16`, { exact: true })).toBeVisible();
		if (index === 2) {
			const question = await page.getByRole('heading', { level: 2 }).textContent();
			await page.reload();
			await expect(page.getByRole('heading', { level: 2 })).toHaveText(question!);
		}
		await page.getByRole('button', { name: /Resposta certa de teste/ }).click();
		if (index === 1) {
			await page.getByRole('button', { name: 'Tentar novamente' }).click();
		}
		if (index < 16) {
			await expect(page.getByText('Boa! Acertaste. +100 pontos')).toBeVisible();
			await page.getByRole('button', { name: 'Seguinte' }).click();
		}
	}

	await expect(page.getByRole('heading', { name: 'Boa, dinossauro!' })).toBeVisible();
	await expect(page.getByText('1600', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Ver o ranking da família' }).click();
	await expect(page.getByRole('cell', { name: '1600', exact: true })).toBeVisible();
	await expect(page.getByRole('rowheader', { name: 'Jogador Mobile' })).toBeVisible();
	await page.getByRole('link', { name: 'Jogos', exact: true }).click();
	await page
		.getByRole('article')
		.filter({ hasText: 'Quem Conhece Melhor o Bernardo?' })
		.getByRole('link', { name: 'Jogar', exact: true })
		.click();
	await page.getByRole('button', { name: 'Jogar outra vez' }).click();
	await expect(page.getByText('Pergunta 1 de 16', { exact: true })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true,
	);
	await page.screenshot({ path: 'test-results/mobile-quiz.png', fullPage: true });
});

test('account login from another browser and invalid sign-in feedback', async ({ page }) => {
	const registration = await page.request.post('/api/auth/register', {
		headers: { origin: 'http://127.0.0.1:3100' },
		data: { displayName: 'Jogador Login', password: 'uma-password-mobile' },
	});
	expect(registration.status()).toBe(201);
	await page.context().clearCookies();
	await page.goto('/player');
	await page.getByRole('button', { name: 'Já tenho utilizador' }).click();
	await page.getByLabel('Nome de utilizador').fill('Jogador Login');
	await page.getByLabel('Palavra-passe', { exact: true }).fill('wrong-password');
	await page.getByRole('button', { name: 'Entrar', exact: false }).click();
	await expect(page.getByText('Nome de utilizador ou palavra-passe incorretos.')).toBeVisible();
	await page.getByLabel('Palavra-passe', { exact: true }).fill('uma-password-mobile');
	await page.getByRole('button', { name: 'Entrar', exact: false }).click();
	await expect(page).toHaveURL('/');
	await page.getByRole('link', { name: 'Jogador', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Olá, Jogador Login!' })).toBeVisible();
	await page.getByRole('button', { name: 'Terminar sessão' }).click();
	await expect(page.getByRole('heading', { name: 'Cria o teu utilizador.' })).toBeVisible();
});

test('small mobile screens keep the portal and registration within the viewport', async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 740 });
	for (const path of ['/', '/player']) {
		await page.goto(path);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
		).toBe(true);
	}
	await page.screenshot({ path: 'test-results/mobile-account-small.png', fullPage: true });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await page.screenshot({ path: 'test-results/mobile-portal.png', fullPage: true });
});
