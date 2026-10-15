import styles from './styles.module.css';

export default function Footer() {
	return (
		<footer className={styles.footer}>
			<span>
				Feito com carinho, para jogar em família. <span aria-hidden="true">♡</span>
			</span>
			<a href="https://nicenails.pt" rel="noreferrer" target="_blank">
				Outros projetos → <strong>NiceNails</strong>
			</a>
		</footer>
	);
}
