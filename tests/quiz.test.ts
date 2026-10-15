import { describe, expect, it } from 'vitest';

import content from '../src/content/bernardo.json';
import {
	answerQuestion,
	isReady,
	newSession,
	nextQuestion,
	normalizeName,
	publicSession,
} from '../src/server/quiz';
import { games } from '../src/settings/games';
import { fixtureQuestions } from './fixtures';

const initial = new Date('2026-10-24T15:00:00Z');

function createSession() {
	return newSession(
		{
			ownerId: 'browser',
			playerId: 'player',
			gameSlug: 'bernardo-quiz',
			rulesVersion: '1',
			contentVersion: '1',
		},
		fixtureQuestions,
		initial,
	);
}

describe('quiz rules', () => {
	it('enables the 16 answered questions and retains the pending first-tooth question', () => {
		expect(content.questions).toHaveLength(17);
		expect(content.questions[3].correctOptionId).toBeNull();
		expect(content.questions[11].options[0].text).toBe('24/10/2025');
		expect(isReady(content.questions, 17)).toBe(false);
		const enabled = content.questions.filter((question) => question.enabled);
		expect(enabled).toHaveLength(16);
		expect(enabled.some((question) => question.id === 'q04')).toBe(false);
		expect(isReady(enabled, games[0].questionCount)).toBe(true);
		expect(games[0].contentVersion).toBe(content.contentVersion);
		expect(isReady(fixtureQuestions, 17)).toBe(true);
		expect(isReady(fixtureQuestions.slice(1), 17)).toBe(false);
	});

	it('rejects duplicate options, missing answers and unapproved content', () => {
		for (const change of [
			{ approved: false },
			{ enabled: false },
			{ correctOptionId: 'missing' },
			{ options: Array.from({ length: 4 }, () => ({ id: 'a', text: 'same' })) },
		]) {
			const bank = structuredClone(fixtureQuestions);
			Object.assign(bank[0], change);
			expect(isReady(bank, 17)).toBe(false);
		}
	});

	it('normalizes name case, Unicode width and whitespace', () => {
		expect(normalizeName('  Ｂｅｎｎｙ  Rex  ')).toBe('benny rex');
		expect(normalizeName('ANA')).toBe(normalizeName('ana'));
	});

	it('never exposes snapshots or the correct answer before submission', () => {
		const session = createSession();
		const visible = publicSession(session);
		expect(JSON.stringify(visible)).not.toContain('correctOptionId');
		expect(visible).not.toHaveProperty('quiz');
		expect(visible.question?.options).toHaveLength(4);
		expect(new Set(session.quiz.questions.map((q) => q.id)).size).toBe(17);
	});

	it('counts server time across refreshes and excludes feedback reading', () => {
		const session = createSession();
		const first = session.quiz.questions[0];
		expect(publicSession(session, initial.getTime() + 5000).question?.startedAt).toBe(
			initial.getTime(),
		);
		const answered = answerQuestion(
			session,
			first.id,
			'a',
			new Date(initial.getTime() + 5000),
			100,
		);
		expect(answered.score).toBe(100);
		expect(answered.totalTimeMs).toBe(5000);
		const next = nextQuestion(answered, first.id, new Date(initial.getTime() + 60_000));
		const second = answerQuestion(
			next,
			next.quiz.questions[1].id,
			'b',
			new Date(initial.getTime() + 62_000),
			100,
		);
		expect(second.totalTimeMs).toBe(7000);
		expect(second.correctAnswers).toBe(1);
		expect(second.status).toBe('active');
	});

	it('makes retries idempotent and rejects changed answers and skipping', () => {
		const session = createSession();
		const first = session.quiz.questions[0];
		const answered = answerQuestion(
			session,
			first.id,
			'a',
			new Date(initial.getTime() + 1000),
			100,
		);
		expect(answerQuestion(answered, first.id, 'a', new Date(), 100)).toBe(answered);
		expect(() => answerQuestion(answered, first.id, 'b', new Date(), 100)).toThrow();
		expect(() =>
			answerQuestion(session, session.quiz.questions[1].id, 'a', new Date(), 100),
		).toThrow();
		expect(() => nextQuestion(session, first.id, new Date())).toThrow();
		const next = nextQuestion(answered, first.id, new Date());
		expect(nextQuestion(next, first.id, new Date())).toBe(next);
	});

	it('plays every question, totals 1700, and locks completed runs', () => {
		let session = createSession();
		for (let index = 0; index < 17; index++) {
			const question = session.quiz.questions[index];
			session = answerQuestion(
				session,
				question.id,
				'a',
				new Date(session.quiz.questionStartedAt.getTime() + 1000),
				100,
			);
			if (index < 16) {
				session = nextQuestion(
					session,
					question.id,
					new Date(initial.getTime() + (index + 1) * 2000),
				);
			}
		}
		expect(session.status).toBe('completed');
		expect(session.score).toBe(1700);
		expect(session.totalTimeMs).toBe(17_000);
		expect(session.quiz.answers).toHaveLength(17);
		expect(session.completedAt).toBeInstanceOf(Date);
	});
});
