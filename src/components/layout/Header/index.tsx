'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import styles from './styles.module.css';

const links = [
	{ href: '/', label: 'Jogos' },
	{ href: '/leaderboard', label: 'Ranking' },
	{ href: '/player', label: 'Jogador' },
];

export default function Header() {
	const pathname = usePathname();

	return (
		<header className={styles.header}>
			<Link aria-label="Dino Games — início" className={styles.brand} href="/">
				<span aria-hidden="true" className={styles.logo}>
					d.
				</span>
				<span>
					Dino<span className={styles.brandLight}>Games</span>
					<small>PEQUENOS JOGOS. GRANDES MEMÓRIAS.</small>
				</span>
			</Link>
			<nav aria-label="Navegação principal" className={styles.navigation}>
				{links.map((link) => (
					<Link
						key={link.href}
						aria-current={pathname === link.href ? 'page' : undefined}
						href={link.href}
					>
						{link.label}
					</Link>
				))}
			</nav>
		</header>
	);
}
