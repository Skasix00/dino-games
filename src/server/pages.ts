import { redirect } from 'next/navigation';

import { identity } from '@/server/auth';

export async function requirePageAccess(destination: string) {
	const auth = await identity();

	if (!auth) {
		redirect(`/player?next=${encodeURIComponent(destination)}`);
	}

	return auth;
}
