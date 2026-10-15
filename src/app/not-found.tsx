import Link from 'next/link';

export default function NotFound() {
	return (
		<div className="page-container panel narrow stack">
			<h1 className="page-heading">Este dinossauro perdeu-se.</h1>
			<p className="muted">Não encontramos o jogo que procuras.</p>
			<Link className="button" href="/">
				Voltar aos jogos
			</Link>
		</div>
	);
}
