import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	workers: 1,
	timeout: 90_000,
	use: {
		baseURL: 'http://127.0.0.1:3100',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: [
		{ name: 'mobile-chromium', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
	],
	webServer: {
		command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
		url: 'http://127.0.0.1:3100',
		reuseExistingServer: false,
		timeout: 120_000,
		env: { APP_ORIGIN: 'http://127.0.0.1:3100' },
	},
});
