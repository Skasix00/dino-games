'use client';

import type { PublicSession } from '@/types/game';
import type { GameCardData } from '@/utils/game';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import Mascot from '@/components/common/Mascot';
import Notice from '@/components/common/Notice';
import { useQuestionTimer } from '@/hooks/useQuestionTimer';
import { api, errorMessage } from '@/utils/api';
import { formatTime } from '@/utils/game';

import styles from './styles.module.css';

interface QuizGameProps {
	game: GameCardData;
	hasPlayer: boolean;
}

export default function QuizGame({ game, hasPlayer }: QuizGameProps) {
	const [session, setSession] = useState<PublicSession | null>(null);
	const [ready, setReady] = useState(false);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [pendingOption, setPendingOption] = useState<string | null>(null);
	const base = `games/${game.slug}`;

	const load = useCallback(async () => {
		try {
			const [availability, current] = await Promise.all([
				api<{ ready: boolean }>(`${base}/availability`),
				api<{ session: PublicSession | null }>(`${base}/current`),
			]);
			setReady(availability.ready);
			setSession(current.session);
			setPendingOption(null);
			setError('');
		} catch (error) {
			setError(errorMessage(error));
		} finally {
			setLoading(false);
		}
	}, [base]);

	useEffect(() => {
		void Promise.resolve().then(load);
	}, [load]);

	async function act(action: 'start' | 'answer' | 'next', optionId?: string) {
		if (busy) {
			return;
		}

		setBusy(true);
		setError('');

		if (action === 'answer' && optionId) {
			setPendingOption(optionId);
		}

		try {
			const payload =
				action === 'start'
					? {}
					: {
							sessionId: session!.id,
							questionId: session!.question!.id,
							...(optionId ? { optionId } : {}),
						};
			const response = await api<{ session: PublicSession }>(`${base}/${action}`, payload);
			setSession(response.session);
			setPendingOption(null);
		} catch (error) {
			setError(errorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="page-container">
			<Link className="text-link" href="/">
				← Todos os jogos
			</Link>
			<div className={styles.header}>
				<p className="eyebrow">{game.label}</p>
				<h1 className="page-heading">{game.title}</h1>
			</div>
			{loading ? (
				<div className="panel narrow" role="status">
					A preparar a brincadeira…
				</div>
			) : !session ? (
				<section className="panel narrow stack text-center">
					<Mascot className="w-44 mx-auto" />
					<h2 className="text-2xl font-bold">Quanto sabes sobre o BennyRex?</h2>
					<p className="muted">
						{game.questionCount} perguntas, quatro respostas e muitas histórias para recordar. Cada
						resposta certa vale 100 pontos. A rapidez só desempata!
					</p>
					{!ready && (
						<p className="notice">
							Estamos a preparar as perguntas. O jogo estará disponível em breve!
						</p>
					)}
					{!hasPlayer ? (
						<Link className="button" href={`/player?next=${encodeURIComponent(game.href)}`}>
							Escolher jogador →
						</Link>
					) : (
						<button
							className="button"
							disabled={!ready || busy}
							onClick={() => void act('start')}
							type="button"
						>
							Começar →
						</button>
					)}
					<p className="muted text-xs">Sem limite de tempo. Podes falhar e continuar até ao fim.</p>
				</section>
			) : session.status === 'completed' ? (
				<section className="panel narrow stack text-center">
					<p className="eyebrow">UMA SALVA DE PALMAS!</p>
					<h2 className="page-heading">Boa, dinossauro!</h2>
					<p className="muted">Mais uma memória para a festa do BennyRex.</p>
					<div className={styles.results}>
						<div>
							<strong>
								{session.correctAnswers}/{session.totalQuestions}
							</strong>
							<span>respostas certas</span>
						</div>
						<div>
							<strong>{session.score}</strong>
							<span>pontos</span>
						</div>
						<div>
							<strong>{formatTime(session.totalTimeMs)}</strong>
							<span>tempo total</span>
						</div>
					</div>
					<p className="notice">
						O teu melhor resultado está em <strong>{session.rank}º lugar</strong> no ranking.
					</p>
					<button
						className="button"
						disabled={busy || !ready}
						onClick={() => void act('start')}
						type="button"
					>
						Jogar outra vez →
					</button>
					<Link className="text-link" href={`/leaderboard?game=${game.slug}`}>
						Ver o ranking da família
					</Link>
				</section>
			) : (
				<QuestionPanel
					key={`${session.id}:${session.position}`}
					busy={busy}
					onAnswer={(option) => void act('answer', option)}
					onNext={() => void act('next')}
					pendingOption={pendingOption}
					session={session}
				/>
			)}
			{error && (
				<div className="narrow mt-5">
					<Notice
						message={error}
						onRetry={() => (pendingOption ? void act('answer', pendingOption) : void load())}
					/>
				</div>
			)}
		</div>
	);
}

interface QuestionPanelProps {
	session: PublicSession;
	busy: boolean;
	pendingOption: string | null;
	onAnswer: (option: string) => void;
	onNext: () => void;
}

function QuestionPanel({ session, busy, pendingOption, onAnswer, onNext }: QuestionPanelProps) {
	const question = session.question!;
	const elapsed = useQuestionTimer(question.startedAt, session.serverNow, !session.feedback);

	return (
		<section className="panel narrow stack">
			<div className={styles.progressLabel}>
				<span>
					Pergunta {session.position} de {session.totalQuestions}
				</span>
				<span aria-label="Tempo decorrido">◷ {formatTime(elapsed)}</span>
			</div>
			<progress
				aria-label="Progresso do jogo"
				className={styles.progress}
				max={session.totalQuestions}
				value={session.position}
			/>
			<h2 className={styles.question}>{question.text}</h2>
			<div className={styles.options}>
				{question.options.map((option, index) => {
					const correct = session.feedback?.correctOptionId === option.id;
					const selected = (session.feedback?.selectedOptionId ?? pendingOption) === option.id;

					return (
						<button
							key={option.id}
							aria-pressed={selected}
							className={`${styles.option} ${correct ? styles.correct : ''} ${selected ? styles.selected : ''}`}
							disabled={busy || !!session.feedback || !!pendingOption}
							onClick={() => onAnswer(option.id)}
							type="button"
						>
							<span>{String.fromCharCode(65 + index)}</span>
							{option.text}
							{correct && <span aria-label="Resposta correta">✓</span>}
						</button>
					);
				})}
			</div>
			{session.feedback ? (
				<div aria-live="polite" className="stack">
					<p className="notice">
						{session.feedback.isCorrect
							? 'Boa! Acertaste. +100 pontos'
							: `Quase! A resposta certa é: ${session.feedback.correctText}. Vamos à próxima!`}
					</p>
					<button className="button" disabled={busy} onClick={onNext} type="button">
						Seguinte →
					</button>
				</div>
			) : (
				<p className="muted text-xs m-0">
					Escolhe uma resposta. Depois de enviada, não é possível alterá-la.
				</p>
			)}
		</section>
	);
}
