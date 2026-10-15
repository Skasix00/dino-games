import type { GameCardData } from '@/utils/game';

import Mascot from '@/components/common/Mascot';
import GameCard from '@/components/home/GameCard';

import styles from './styles.module.css';

interface HomePageProps {
	games: { game: GameCardData; ready: boolean }[];
}

export default function HomePage({ games }: HomePageProps) {
	return (
		<div className="page-container">
			<section className={styles.hero}>
				<div className={styles.heroContent}>
					<span className={styles.partyLabel}>
						<span aria-hidden="true">✦</span> BEM-VINDOS À FESTA DO BENNYREX
					</span>
					<h1>
						Hoje a festa
						<br />é <em>brincar juntos.</em>
					</h1>
					<p>
						Um bocadinho de competição, muitas gargalhadas
						<br className={styles.desktopBreak} /> e memórias para guardar. Vamos jogar?
					</p>
					<a className="button" href="#games">
						Escolher um jogo <span aria-hidden="true">↓</span>
					</a>
					<span className={styles.heroNote}>Para miúdos, graúdos e dinossauros.</span>
				</div>
				<div className={styles.heroArt}>
					<span className={styles.birthdayBadge}>
						1<span>ANINHO</span>
					</span>
					<Mascot className={styles.heroMascot} />
					<span className={styles.signature}>Ciao, sou o BennyRex!</span>
				</div>
			</section>
			<section aria-labelledby="games-heading" className={styles.games} id="games">
				<div className={styles.sectionHeader}>
					<div>
						<p className="eyebrow">A DIVERSÃO COMEÇA AQUI</p>
						<h2 id="games-heading">Escolhe a tua aventura</h2>
					</div>
					<span>
						{games.length} {games.length === 1 ? 'jogo para descobrir' : 'jogos para descobrir'}
					</span>
				</div>
				<div className={styles.gameGrid}>
					{games.map(({ game, ready }) => (
						<GameCard key={game.slug} game={game} ready={ready} />
					))}
				</div>
			</section>
			<section aria-label="Como jogar" className={styles.steps}>
				<div>
					<span>01</span>
					<p>
						<strong>Escolhe o teu nome</strong>
						<small>A família toda está convidada.</small>
					</p>
				</div>
				<div>
					<span>02</span>
					<p>
						<strong>Entra na brincadeira</strong>
						<small>Escolhe um jogo e diverte-te.</small>
					</p>
				</div>
				<div>
					<span>03</span>
					<p>
						<strong>Espreita o ranking</strong>
						<small>O importante é jogar juntos!</small>
					</p>
				</div>
			</section>
		</div>
	);
}
