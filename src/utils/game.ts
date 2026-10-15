// Public presentation types only. Game rules and registration live on the server.
export interface GameCardData {
	slug: string;
	title: string;
	description: string;
	type: 'quiz' | 'runner';
	href: string;
	label: string;
	questionCount: number;
}

export function formatTime(ms: number) {
	const seconds = Math.floor(ms / 1000);

	return `${Math.floor(seconds / 60)
		.toString()
		.padStart(
			2,
			'0',
		)}:${(seconds % 60).toString().padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
}
