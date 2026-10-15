import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@/themes/globals.css';

export const metadata: Metadata = {
	title: { default: 'Dino Games · A festa do BennyRex', template: '%s · Dino Games' },
	description: 'Pequenos jogos, grandes memórias. O cantinho de jogos da família BennyRex.',
	robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="pt-PT">
			<body>{children}</body>
		</html>
	);
}
