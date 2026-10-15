'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
	return (
		<div className="page-container panel narrow stack">
			<h1 className="page-heading">Uma pequena pausa na festa.</h1>
			<p className="muted">
				Não foi possível abrir esta página. Tenta novamente dentro de instantes.
			</p>
			<button className="button" onClick={reset} type="button">
				Tentar novamente
			</button>
		</div>
	);
}
