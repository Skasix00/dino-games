import stylistic from '@stylistic/eslint-plugin';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import perfectionist from 'eslint-plugin-perfectionist';
import { defineConfig, globalIgnores } from 'eslint/config';

// Rules are owned by this repository; no shared organization config is imported.
export default defineConfig([
	...nextVitals,
	...nextTypescript,
	globalIgnores(['.next/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts']),
	{
		files: ['**/*.{js,mjs,ts,tsx}'],
		plugins: { '@stylistic': stylistic, perfectionist },
		rules: {
			eqeqeq: ['error', 'always', { null: 'ignore' }],
			curly: ['error', 'all'],
			'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
			'@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
			'@stylistic/semi': ['error', 'always'],
			'@stylistic/comma-dangle': ['error', 'always-multiline'],
			'@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxBOF: 0, maxEOF: 0 }],
			'@stylistic/padding-line-between-statements': [
				'error',
				{ blankLine: 'always', prev: '*', next: 'return' },
				{
					blankLine: 'always',
					prev: ['function', 'class', 'interface', 'type', 'export'],
					next: '*',
				},
				{ blankLine: 'always', prev: '*', next: ['function', 'class', 'interface', 'type'] },
			],
			'perfectionist/sort-imports': [
				'error',
				{
					type: 'natural',
					order: 'asc',
					newlinesBetween: 1,
					groups: [
						'type',
						['builtin', 'external'],
						'internal',
						['parent', 'sibling', 'index'],
						'style',
						'side-effect',
						'unknown',
					],
					internalPattern: ['^@/'],
				},
			],
			'perfectionist/sort-named-imports': ['error', { type: 'natural' }],
			'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
			'@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'react/jsx-sort-props': [
				'error',
				{ reservedFirst: true, shorthandLast: true, multiline: 'last', ignoreCase: true },
			],
			'@next/next/no-img-element': 'error',
		},
	},
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
		},
		rules: {
			'@typescript-eslint/await-thenable': 'error',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': [
				'error',
				{ checksVoidReturn: { attributes: false } },
			],
			'@typescript-eslint/switch-exhaustiveness-check': 'error',
		},
	},
]);
