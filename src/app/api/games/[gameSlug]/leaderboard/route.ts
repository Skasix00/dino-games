import { handleApi } from '@/server/http';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ gameSlug: string }> }) {
	const { gameSlug } = await context.params;

	return handleApi(request, ['games', gameSlug, 'leaderboard']);
}
