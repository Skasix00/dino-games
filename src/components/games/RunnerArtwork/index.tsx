import Mascot from '@/components/common/Mascot';

import styles from './styles.module.css';

export default function RunnerArtwork() {
	return (
		<div
			aria-label="BennyRex pronto para uma corrida de dinossauro"
			className={styles.scene}
			role="img"
		>
			<div aria-hidden="true" className={styles.sun} />
			<div aria-hidden="true" className={styles.hills} />
			<div aria-hidden="true" className={styles.road} />
			<div aria-hidden="true" className={styles.coins}>
				● ● ●
			</div>
			<Mascot className={styles.dinosaur} />
			<span className={styles.caption}>Patas pequenas. Grandes aventuras.</span>
		</div>
	);
}
