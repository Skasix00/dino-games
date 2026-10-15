import type { GameSession, PublicSession, Question, Snapshot } from '@/types/game';

import { randomInt, randomUUID } from 'node:crypto';
export class GameError extends Error {
	constructor(
		message: string,
		public status = 400,
	) {
		super(message);
	}
}

export function normalizeName(value: string) {
	return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-PT');
}

export function isReady(questions: Question[], count: number) {
	return (
		questions.length === count &&
		new Set(questions.map((q) => q.id)).size === count &&
		new Set(questions.map((q) => q.order)).size === count &&
		questions.every(
			(q) =>
				q.approved &&
				q.order >= 1 &&
				Number.isSafeInteger(q.order) &&
				q.enabled !== false &&
				q.text.trim() &&
				q.options.length === 4 &&
				new Set(q.options.map((o) => o.id)).size === 4 &&
				new Set(q.options.map((o) => o.text.trim().toLocaleLowerCase('pt-PT'))).size === 4 &&
				q.options.every((o) => o.text.trim() && o.id) &&
				q.correctOptionId &&
				q.options.some((o) => o.id === q.correctOptionId),
		)
	);
}

export function shuffle<T>(items: T[]): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[result[i], result[j]] = [result[j], result[i]];
	}

	return result;
}

export function newSession(
	input: {
		ownerId: string;
		playerId: string;
		gameSlug: string;
		rulesVersion: string;
		contentVersion: string;
	},
	questions: Question[],
	now: Date,
): GameSession {
	const snapshots: Snapshot[] = shuffle(questions).map((q) => ({
		id: q.id,
		order: q.order,
		text: q.text,
		options: shuffle(q.options),
		correctOptionId: q.correctOptionId!,
	}));

	return {
		...input,
		_id: randomUUID(),
		status: 'active',
		revision: 0,
		startedAt: now,
		score: 0,
		correctAnswers: 0,
		totalTimeMs: 0,
		quiz: { questions: snapshots, index: 0, questionStartedAt: now, answers: [] },
	};
}

export function answerQuestion(
	session: GameSession,
	questionId: string,
	optionId: string,
	now: Date,
	points: number,
): GameSession {
	const previous = session.quiz.answers.find((a) => a.questionId === questionId);
	if (previous) {
		if (previous.selectedOptionId !== optionId) {
			throw new GameError('Esta resposta já foi registada.', 409);
		}

		return session;
	}
	const question = session.quiz.questions[session.quiz.index];
	if (session.status !== 'active' || question.id !== questionId) {
		throw new GameError('Atualiza o jogo para continuar.', 409);
	}
	if (!question.options.some((o) => o.id === optionId)) {
		throw new GameError('Escolhe uma das respostas.');
	}
	const isCorrect = question.correctOptionId === optionId;
	const timeMs = Math.max(0, now.getTime() - session.quiz.questionStartedAt.getTime());
	const completed = session.quiz.index === session.quiz.questions.length - 1;

	return {
		...session,
		revision: session.revision + 1,
		status: completed ? 'completed' : 'active',
		...(completed ? { completedAt: now } : {}),
		score: session.score + (isCorrect ? points : 0),
		correctAnswers: session.correctAnswers + Number(isCorrect),
		totalTimeMs: session.totalTimeMs + timeMs,
		quiz: {
			...session.quiz,
			answers: [
				...session.quiz.answers,
				{ questionId, selectedOptionId: optionId, isCorrect, timeMs },
			],
		},
	};
}

export function nextQuestion(
	session: GameSession,
	answeredQuestionId: string,
	now: Date,
): GameSession {
	const index = session.quiz.questions.findIndex((q) => q.id === answeredQuestionId);
	if (index < 0 || !session.quiz.answers.some((a) => a.questionId === answeredQuestionId)) {
		throw new GameError('Responde primeiro à pergunta atual.', 409);
	}
	if (session.status === 'completed' || index < session.quiz.index) {
		return session;
	}

	return {
		...session,
		revision: session.revision + 1,
		quiz: { ...session.quiz, index: index + 1, questionStartedAt: now },
	};
}

export function publicSession(session: GameSession, now = Date.now()): PublicSession {
	const q = session.quiz.questions[session.quiz.index];
	const answer = session.quiz.answers.find((a) => a.questionId === q.id);

	return {
		id: session._id,
		gameSlug: session.gameSlug,
		status: session.status,
		score: session.score,
		correctAnswers: session.correctAnswers,
		totalTimeMs: session.totalTimeMs,
		totalQuestions: session.quiz.questions.length,
		position: session.quiz.index + 1,
		serverNow: now,
		question: {
			id: q.id,
			text: q.text,
			options: q.options,
			startedAt: session.quiz.questionStartedAt.getTime(),
		},
		...(answer
			? {
					feedback: {
						selectedOptionId: answer.selectedOptionId,
						correctOptionId: q.correctOptionId,
						correctText: q.options.find((o) => o.id === q.correctOptionId)!.text,
						isCorrect: answer.isCorrect,
					},
				}
			: {}),
	};
}
