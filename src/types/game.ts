export interface Option {
	id: string;
	text: string;
}

export interface Question {
	id: string;
	order: number;
	text: string;
	options: Option[];
	correctOptionId: string | null;
	approved: boolean;
	enabled?: boolean;
}

export type Snapshot = Omit<Question, 'approved' | 'enabled'> & { correctOptionId: string };

export interface Answer {
	questionId: string;
	selectedOptionId: string;
	isCorrect: boolean;
	timeMs: number;
}

export interface SharedGameSession {
	_id: string;
	ownerId: string;
	playerId: string;
	gameSlug: string;
	rulesVersion: string;
	contentVersion: string;
	status: 'active' | 'completed';
	revision: number;
	startedAt: Date;
	completedAt?: Date;
	score: number;
	totalTimeMs: number;
}

export interface GameSession extends SharedGameSession {
	correctAnswers: number;
	quiz: { questions: Snapshot[]; index: number; questionStartedAt: Date; answers: Answer[] };
}

export interface PublicSession {
	id: string;
	gameSlug: string;
	status: 'active' | 'completed';
	score: number;
	correctAnswers: number;
	totalTimeMs: number;
	totalQuestions: number;
	position: number;
	serverNow: number;
	question?: { id: string; text: string; options: Option[]; startedAt: number };
	feedback?: {
		selectedOptionId: string;
		correctOptionId: string;
		correctText: string;
		isCorrect: boolean;
	};
	rank?: number;
}

export interface Player {
	_id: string;
	displayName: string;
	normalizedName: string;
	passwordHash: string;
	createdAt: Date;
}

export interface RankingRow {
	distance?: number;
	coins?: number;
	playerId: string;
	displayName: string;
	score: number;
	correctAnswers: number;
	totalTimeMs: number;
	completedAt: string;
	rank: number;
}
