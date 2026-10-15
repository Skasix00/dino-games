import HomePage from '@/components/home/HomePage';
import { availability } from '@/server/games';
import { cardData, games } from '@/settings/games';

export const dynamic = 'force-dynamic';

export default async function Page() {
	const cards = await Promise.all(
		games.map(async (game) => {
			const ready = await availability(game)
				.then((result) => result.ready)
				.catch(() => false);

			return { game: cardData(game), ready };
		}),
	);

	return <HomePage games={cards} />;
}
