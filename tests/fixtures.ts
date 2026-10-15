import type { Question } from '../src/types/game';

// Synthetic questions only. These never approve or seed the family question bank.
export const fixtureQuestions: Question[] = Array.from({ length: 17 }, (_, index) => ({
	id: `test-${index + 1}`,
	order: index + 1,
	text: `Pergunta de teste ${index + 1}?`,
	options: [
		{ id: 'a', text: 'Resposta certa de teste' },
		{ id: 'b', text: 'Outra opção' },
		{ id: 'c', text: 'Terceira opção' },
		{ id: 'd', text: 'Quarta opção' },
	],
	correctOptionId: 'a',
	approved: true,
}));
