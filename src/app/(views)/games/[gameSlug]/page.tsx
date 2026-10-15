import { notFound } from 'next/navigation';

import QuizGame from '@/components/games/QuizGame';
import { requirePageAccess } from '@/server/pages';
import { cardData, getGame } from '@/settings/games';

export default async function Page({ params }: { params: Promise<{ gameSlug: string }> }) {
	const { gameSlug } = await params;
	const game = getGame(gameSlug);

	if (!game) {
		notFound();
	}

	const auth = await requirePageAccess(game.href);

	return <QuizGame game={cardData(game)} hasPlayer={!!auth.playerId} />;
}
