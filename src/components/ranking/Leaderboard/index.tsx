'use client';

import type { RankingRow } from '@/types/game';
import type { GameCardData } from '@/utils/game';
import type { ChangeEvent } from 'react';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import Notice from '@/components/common/Notice';
import { api, errorMessage } from '@/utils/api';
import { formatTime } from '@/utils/game';

import styles from './styles.module.css';

interface LeaderboardProps {
	games: GameCardData[];
	initialGame: string;
}

export default function Leaderboard({ games, initialGame }: LeaderboardProps) {
	const [slug, setSlug] = useState(initialGame);
	const requestVersion = useRef(0);
	const [rows, setRows] = useState<RankingRow[]>([]);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(true);
	const game = games.find((item) => item.slug === slug)!;

	const load = useCallback(async () => {
		const version = ++requestVersion.current;
		setLoading(true);

		try {
			const response = await api<{ rows: RankingRow[] }>(`games/${slug}/leaderboard`);
			if (version !== requestVersion.current) {
				return;
			}
			setRows(response.rows);
			setError('');
		} catch (error) {
			if (version === requestVersion.current) {
				setError(errorMessage(error));
			}
		} finally {
			if (version === requestVersion.current) {
				setLoading(false);
			}
		}
	}, [slug]);

	useEffect(() => {
		void Promise.resolve().then(load);
	}, [load]);

	function selectGame(event: ChangeEvent<HTMLSelectElement>) {
		setLoading(true);
		setSlug(event.target.value);
	}

	return (
		<div className="page-container">
			<p className="eyebrow">A NOSSA PEQUENA COMPETIÇÃO</p>
			<h1 className="page-heading">O pódio da família.</h1>
			<p className="muted">Cada jogador, o seu melhor resultado. E uma boa dose de orgulho!</p>
			<section className="panel mt-8">
				<div className={styles.toolbar}>
					<div>
						<label htmlFor="ranking-game">Escolher jogo</label>
						<select id="ranking-game" onChange={selectGame} value={slug}>
							{games.map((item) => (
								<option key={item.slug} value={item.slug}>
									{item.title}
								</option>
							))}
						</select>
					</div>
					<button
						className="button secondary"
						disabled={loading}
						onClick={() => void load()}
						type="button"
					>
						Atualizar ranking
					</button>
				</div>
				{error && <Notice message={error} onRetry={() => void load()} />}
				{loading ? (
					<p className="muted py-8" role="status">
						A contar os pontos…
					</p>
				) : rows.length === 0 ? (
					<div className={styles.empty}>
						<span aria-hidden="true">✦</span>
						<h2>O pódio está à tua espera.</h2>
						<p className="muted">
							Ainda não há partidas terminadas neste jogo.
							<br />
							Quem será o primeiro dinossauro a chegar?
						</p>
						<Link className="button" href={game.href}>
							Conhecer o jogo →
						</Link>
					</div>
				) : (
					<div className={styles.tableWrapper}>
						<table className={styles.table}>
							<caption className="sr-only">Ranking de {game.title}</caption>
							<thead>
								<tr>
									<th scope="col">Lugar</th>
									<th scope="col">Jogador</th>
									<th scope="col">{game.type === 'runner' ? 'Distância' : 'Certas'}</th>
									<th scope="col">Pontos</th>
									<th scope="col">{game.type === 'runner' ? 'Moedas' : 'Tempo'}</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr key={row.playerId}>
										<td>
											<span className={styles.place}>{row.rank}º</span>
										</td>
										<th scope="row">{row.displayName}</th>
										<td>
											{game.type === 'runner'
												? `${row.distance ?? 0} m`
												: `${row.correctAnswers}/${game.questionCount}`}
										</td>
										<td>{row.score}</td>
										<td>
											{game.type === 'runner' ? (
												(row.coins ?? 0)
											) : (
												<span title={`${row.totalTimeMs} ms`}>{formatTime(row.totalTimeMs)}</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				<p className="muted text-xs mt-6 mb-0">
					{game.type === 'runner'
						? 'Cada metro vale 1 ponto e cada moeda vale 10. Em caso de empate, conta a maior distância e depois quem terminou primeiro.'
						: 'Mais respostas certas primeiro. Em caso de empate, ganha o menor tempo; depois, quem terminou primeiro.'}{' '}
					Só conta a melhor partida de cada jogador.
				</p>
			</section>
		</div>
	);
}
