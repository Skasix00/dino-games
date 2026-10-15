import { MongoClient } from 'mongodb';
import { z } from 'zod';

import content from '../src/content/bernardo.json';
import { ensureIndexes } from '../src/server/database';
const questionSchema = z.object({
	id: z.string(),
	order: z.number().int().positive(),
	text: z.string().min(1),
	options: z.array(z.object({ id: z.string(), text: z.string().min(1) })).length(4),
	correctOptionId: z.string().nullable(),
	approved: z.boolean(),
	enabled: z.boolean().default(true),
});
const bank = z
	.object({
		gameSlug: z.string(),
		contentVersion: z.string(),
		questions: z.array(questionSchema).length(17),
	})
	.parse(content);
await ensureIndexes();
const client = await new MongoClient(process.env.MONGODB_URI!).connect();
try {
	const questions = client.db(process.env.MONGODB_DB || 'dino_games').collection('questions');
	await questions.bulkWrite(
		bank.questions.map((question) => ({
			updateOne: {
				filter: {
					gameSlug: bank.gameSlug,
					contentVersion: bank.contentVersion,
					order: question.order,
				},
				update: {
					$set: { ...question, gameSlug: bank.gameSlug, contentVersion: bank.contentVersion },
				},
				upsert: true,
			},
		})),
	);
	console.info(
		`Seeded ${bank.questions.length} questions. ${bank.questions.filter((q) => !q.approved || !q.correctOptionId).length} pending review.`,
	);
} finally {
	await client.close();
}
process.exit(0);
