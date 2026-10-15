export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.MONGODB_URI) {
		const { ensureIndexes } = await import('@/server/database');
		await ensureIndexes();
	}
}
