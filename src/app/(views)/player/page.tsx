import AccountForm from '@/components/players/AccountForm';
import { identity } from '@/server/auth';
import { collections } from '@/server/database';
import { safeDestination } from '@/utils/api';

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
	const { next } = await searchParams;
	const auth = await identity();
	let player = null;

	if (auth) {
		const { players } = await collections();
		player = await players.findOne({ _id: auth.playerId });
	}

	return (
		<div className="page-container">
			<AccountForm
				destination={safeDestination(next)}
				player={player ? { displayName: player.displayName } : null}
			/>
		</div>
	);
}
