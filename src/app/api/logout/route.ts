import { handleApi } from '@/server/http';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
	return handleApi(request, ['logout']);
}
