import Leaderboard from '@/components/ranking/Leaderboard';
import { requirePageAccess } from '@/server/pages';
import { cardData, games } from '@/settings/games';

export default async function Page({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
	const { game } = await searchParams;
	const initialGame = games.find((item) => item.slug === game)?.slug ?? games[0].slug;
	await requirePageAccess(`/leaderboard?game=${initialGame}`);

	return <Leaderboard games={games.map(cardData)} initialGame={initialGame} />;
}
