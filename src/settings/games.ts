import type { GameCardData } from '@/utils/game';

import 'server-only';
export type GameDefinition = GameCardData & {
	rulesVersion: string;
	contentVersion: string;
	pointsPerAnswer: number;
	ranking: { score: -1; totalTimeMs: 1; completedAt: 1; _id: 1 };
};

export const games: GameDefinition[] = [
	{
		slug: 'bernardo-quiz',
		title: 'Quem Conhece Melhor o Bernardo?',
		description:
			'Dos primeiros dentinhos às pequenas aventuras. Será que sabes tudo sobre o nosso BennyRex?',
		type: 'quiz',
		href: '/games/bernardo-quiz',
		label: 'O QUIZ DO ANIVERSARIANTE',
		questionCount: 17,
		rulesVersion: '1',
		contentVersion: '1',
		pointsPerAnswer: 100,
		ranking: { score: -1, totalTimeMs: 1, completedAt: 1, _id: 1 },
	},
];

export function getGame(slug: string) {
	return games.find((game) => game.slug === slug);
}

export function cardData(game: GameDefinition): GameCardData {
	const { slug, title, description, type, href, label, questionCount } = game;

	return { slug, title, description, type, href, label, questionCount };
}
