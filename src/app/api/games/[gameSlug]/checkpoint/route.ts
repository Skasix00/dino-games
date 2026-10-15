import { handleApi } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ gameSlug: string }> }) {
	const { gameSlug } = await context.params;

	return handleApi(request, ['games', gameSlug, 'checkpoint']);
}
