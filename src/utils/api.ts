export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}

export async function api<T>(path: string, data?: unknown): Promise<T> {
	const response = await fetch(`/api/${path}`, {
		method: data === undefined ? 'GET' : 'POST',
		headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
		body: data === undefined ? undefined : JSON.stringify(data),
		cache: 'no-store',
	});
	const payload = await response.json();

	if (!response.ok) {
		throw new ApiError(payload.error || 'Não foi possível concluir o pedido.', response.status);
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
