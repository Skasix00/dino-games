import type { ReactNode } from 'react';

import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';

export default function ViewsLayout({ children }: { children: ReactNode }) {
	return (
		<>
			<a className="skip-link" href="#main">
				Saltar para o conteúdo
			</a>
			<Header />
			<main id="main">{children}</main>
			<Footer />
		</>
	);
}
