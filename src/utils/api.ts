export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}

export async function api<T>(path: string, data?: unknown, method?: 'POST' | 'DELETE'): Promise<T> {
	let response: Response;

	try {
		response = await fetch(`/api/${path}`, {
			method: method || (data === undefined ? 'GET' : 'POST'),
			headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
			body: data === undefined ? undefined : JSON.stringify(data),
			cache: 'no-store',
		});
	} catch {
		throw new ApiError('A ligação falhou. Verifica a internet e tenta novamente.', 0);
	}

	const payload = await response.json().catch(() => null);

	if (!response.ok || !payload) {
		throw new ApiError(
			payload?.error || 'Não foi possível concluir o pedido. Tenta novamente.',
			response.status,
		);
	}

	return payload as T;
}

export function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'A ligação falhou. Tenta novamente.';
}

export function safeDestination(value?: string) {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
		return '/';
	}

	return value;
}
