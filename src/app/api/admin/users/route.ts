import { handleApi } from '@/server/http';
export const runtime = 'nodejs';

export async function GET(request: Request) {
	return handleApi(request, ['admin', 'users']);
}

export async function DELETE(request: Request) {
	return handleApi(request, ['admin', 'users']);
}
