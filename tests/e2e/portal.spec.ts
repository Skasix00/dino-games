import { expect, test } from '@playwright/test';

test('mobile portal, own account, quiz completion, refresh, replay and ranking', async ({
	page,
}) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Hoje a festa/ })).toBeVisible();
	await expect(page.getByRole('article')).toHaveCount(1);
	await page.getByRole('link', { name: 'Jogar', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Cria o teu utilizador.' })).toBeVisible();
	await expect(page.getByText('Código da festa')).toHaveCount(0);
	await page.getByLabel('Nome de utilizador').fill('Jogador Mobile');
	await page.getByLabel('Palavra-passe', { exact: true }).fill('uma-password-mobile');
	await page.getByRole('button', { name: 'Criar e começar' }).click();
	await page.getByRole('button', { name: 'Começar' }).click();

	for (let index = 1; index <= 17; index++) {
		await expect(page.getByText(`Pergunta ${index} de 17`, { exact: true })).toBeVisible();
		if (index === 2) {
			const question = await page.getByRole('heading', { level: 2 }).textContent();
			await page.reload();
			await expect(page.getByRole('heading', { level: 2 })).toHaveText(question!);
		}
		await page.getByRole('button', { name: /Resposta certa de teste/ }).click();
		if (index < 17) {
			await expect(page.getByText('Boa! Acertaste. +100 pontos')).toBeVisible();
			await page.getByRole('button', { name: 'Seguinte' }).click();
		}
	}

	await expect(page.getByRole('heading', { name: 'Boa, dinossauro!' })).toBeVisible();
	await expect(page.getByText('1700', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Ver o ranking da família' }).click();
	await expect(page.getByRole('cell', { name: '1700', exact: true })).toBeVisible();
	await expect(page.getByRole('rowheader', { name: 'Jogador Mobile' })).toBeVisible();
	await page.getByRole('link', { name: 'Jogos', exact: true }).click();
	await page.getByRole('link', { name: 'Jogar', exact: true }).click();
	await page.getByRole('button', { name: 'Jogar outra vez' }).click();
	await expect(page.getByText('Pergunta 1 de 17', { exact: true })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true,
	);
	await page.screenshot({ path: 'test-results/mobile-quiz.png', fullPage: true });
});

test('account login from another browser and invalid sign-in feedback', async ({ page }) => {
	await page.goto('/player');
	await page.getByRole('button', { name: 'Já tenho utilizador' }).click();
	await page.getByLabel('Nome de utilizador').fill('Jogador Mobile');
	await page.getByLabel('Palavra-passe', { exact: true }).fill('wrong-password');
	await page.getByRole('button', { name: 'Entrar', exact: false }).click();
	await expect(page.getByRole('alert')).toContainText('incorretos');
	await page.getByLabel('Palavra-passe', { exact: true }).fill('uma-password-mobile');
	await page.getByRole('button', { name: 'Entrar', exact: false }).click();
	await expect(page).toHaveURL('/');
	await page.getByRole('link', { name: 'Jogador', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Olá, Jogador Mobile!' })).toBeVisible();
	await page.getByRole('button', { name: 'Terminar sessão' }).click();
	await expect(page.getByRole('heading', { name: 'Cria o teu utilizador.' })).toBeVisible();
});
