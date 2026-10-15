'use client';

import type { RunnerAction } from '@/types/runner';
import type { GameCardData } from '@/utils/game';

import Link from 'next/link';

import { useRunner } from '@/hooks/useRunner';

import styles from './styles.module.css';

const controls: { action: RunnerAction; symbol: string; label: string }[] = [
	{ action: 'left', symbol: '←', label: 'Esquerda' },
	{ action: 'jump', symbol: '↑', label: 'Saltar' },
	{ action: 'slide', symbol: '↓', label: 'Deslizar' },
	{ action: 'right', symbol: '→', label: 'Direita' },
];

export default function RunnerGame({ game }: { game: GameCardData }) {
	const { canvasRef, controllerRef, display } = useRunner();
	const { mode, state, error, busy } = display;
	const playing = mode !== 'ready' && mode !== 'loading';

	return (
		<div className={`${styles.page} ${playing ? styles.playing : ''}`}>
			<div className={styles.topbar}>
				<Link aria-label="Voltar aos jogos" href="/">
					← Jogos
				</Link>
				<span>{game.title}</span>
				<button
					aria-label="Pausar corrida"
					disabled={mode !== 'running'}
					onClick={() => controllerRef.current?.pause()}
					type="button"
				>
					Ⅱ
				</button>
			</div>
			<div className={styles.arena}>
				<canvas
					ref={canvasRef}
					aria-label="Corrida do dinossauro BennyRex. Usa os botões ou desliza para mudar de faixa, saltar e deslizar."
					className={styles.canvas}
					data-lane={state.lane}
					tabIndex={0}
					data-motion={
						state.jumpUntil > state.tick ? 'jump' : state.slideUntil > state.tick ? 'slide' : 'run'
					}
				>
					O teu browser precisa de suportar Canvas para jogar. Usa um browser atualizado.
				</canvas>
				<div aria-label="Pontuação da corrida" className={styles.hud}>
					<div>
						<span>PONTOS</span>
						<strong>{state.score.toLocaleString('pt-PT')}</strong>
					</div>
					<div>
						<span>METROS</span>
						<strong>{Math.floor(state.distance)}</strong>
					</div>
					<div>
						<span>MOEDAS</span>
						<strong>
							<span aria-hidden="true" className={styles.coin}>
								●
							</span>{' '}
							{state.coins}
						</strong>
					</div>
				</div>
				{mode !== 'running' && (
					<div className={styles.shade}>
						<section aria-label="Estado da corrida" className={styles.overlay}>
							{mode === 'loading' ? (
								<p role="status">A preparar a pista…</p>
							) : mode === 'ready' ? (
								<>
									<p className={styles.eyebrow}>PATAS À OBRA!</p>
									<h1>
										BennyRex
										<br />
										<em>Rush</em>
									</h1>
									<p>
										Um dinossauro. Três faixas.
										<br />
										Quantos metros consegues correr?
									</p>
									<div className={styles.instructions}>
										<span>↔ Muda de faixa</span>
										<span>↑ Salta caixas</span>
										<span>↓ Passa por baixo</span>
									</div>
									<button
										className={styles.primary}
										disabled={busy || !!error}
										onClick={() => void controllerRef.current?.start()}
										type="button"
									>
										{busy ? 'A preparar…' : 'Vamos correr! →'}
									</button>
									<small>
										Desliza no ecrã ou usa os botões.
										<br />
										No computador, usa as setas.
									</small>
								</>
							) : mode === 'finished' ? (
								<>
									<p className={styles.eyebrow}>GRANDE CORRIDA, PEQUENO REX!</p>
									<h2>{state.dead ? 'Ops! Uma colisão.' : 'Boa corrida!'}</h2>
									<strong className={styles.finalScore}>
										{state.score.toLocaleString('pt-PT')}
									</strong>
									<p>
										pontos · {Math.floor(state.distance)} m · {state.coins} moedas
									</p>
									{display.rank && (
										<p className={styles.rank}>
											Melhor resultado: <strong>{display.rank}º lugar</strong>
										</p>
									)}
									<button
										className={styles.primary}
										disabled={busy}
										onClick={() => void controllerRef.current?.start()}
										type="button"
									>
										Correr outra vez →
									</button>
									<Link className={styles.ranking} href={`/leaderboard?game=${game.slug}`}>
										Ver ranking da corrida
									</Link>
								</>
							) : mode === 'saving' ? (
								<>
									<h2>A guardar a corrida…</h2>
									<p role="status">Só um instante. Os teus pontos estão a chegar ao ranking.</p>
								</>
							) : (
								<>
									<p className={styles.eyebrow}>ATÉ OS DINOS RESPIRAM</p>
									<h2>Pausa para as patas.</h2>
									<p>
										A corrida está em pausa.
										<br />
										Continua quando estiveres pronto.
									</p>
									<button
										className={styles.primary}
										disabled={busy || !!error}
										onClick={() => controllerRef.current?.resume()}
										type="button"
									>
										{busy ? 'A guardar…' : 'Continuar →'}
									</button>
									<button
										className={styles.secondary}
										disabled={busy || !!error}
										onClick={() => controllerRef.current?.finish()}
										type="button"
									>
										Terminar e guardar pontos
									</button>
								</>
							)}
							{error && (
								<div className={styles.error} role="alert">
									<p>{error}</p>
									<button
										disabled={busy}
										onClick={() => controllerRef.current?.retry()}
										type="button"
									>
										Tentar novamente
									</button>
									<Link href={`/player?next=${encodeURIComponent(game.href)}`}>
										Entrar no meu utilizador
									</Link>
								</div>
							)}
						</section>
					</div>
				)}
			</div>
			<div aria-label="Controlos da corrida" className={styles.controls}>
				{controls.map((control) => (
					<button
						key={control.action}
						aria-label={control.label}
						disabled={mode !== 'running'}
						onClick={() => controllerRef.current?.input(control.action)}
						type="button"
					>
						<span aria-hidden="true">{control.symbol}</span>
						<small>{control.label}</small>
					</button>
				))}
			</div>
			<p className={styles.hint}>
				{mode === 'running'
					? 'Apanha moedas. Evita os carrinhos. Vai mais longe!'
					: '1 metro = 1 ponto · 1 moeda = 10 pontos'}
			</p>
		</div>
	);
}
