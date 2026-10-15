import type { GameCardData } from '@/utils/game';

import Link from 'next/link';

import Mascot from '@/components/common/Mascot';

import styles from './styles.module.css';

interface GameCardProps {
	game: GameCardData;
	ready: boolean;
}

export default function GameCard({ game, ready }: GameCardProps) {
	return (
		<article className={styles.card}>
			<div className={styles.art}>
				<span className={styles.sticker}>FEITO PARA A FAMÍLIA</span>
				<Mascot className={styles.mascot} />
				<span aria-hidden="true" className={styles.artCaption}>
					O pequeno grande protagonista.
				</span>
			</div>
			<div className={styles.content}>
				<div className={styles.tags}>
					<span>QUIZ</span>
					<span className={styles.availability}>{ready ? '● Disponível' : '○ Em preparação'}</span>
				</div>
				<h3>{game.title}</h3>
				<p>{game.description}</p>
				<div className={styles.details}>
					<span>{game.questionCount} perguntas</span>
					<span>Sem limite de tempo</span>
					<span>Em família</span>
				</div>
				<div className={styles.bottom}>
					<Link className="button" href={game.href}>
						{ready ? 'Jogar' : 'Conhecer o jogo'} <span aria-hidden="true">↗</span>
					</Link>
					<Link className="text-link" href={`/leaderboard?game=${game.slug}`}>
						Ver ranking →
					</Link>
				</div>
			</div>
		</article>
	);
}
