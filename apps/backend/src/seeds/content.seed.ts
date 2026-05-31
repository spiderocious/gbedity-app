import { connectDb, getDb, closeDb } from '../db/client';
import { logger } from '../lib/logger';

// Seed launch content for the games that need it (Q8/Q9): a Nigerian-coded quiz deck, hot-take
// prompts, plead scenarios, and the Plead rubric. Small launch set — admins add more via the
// content-authoring ports. Idempotent (upsert on a stable key). Run:
//   npx tsx --env-file=.env src/seeds/content.seed.ts

const QUIZ_DECK = {
  key: 'naija-general-1',
  title: 'Naija General Knowledge',
  category: 'nigerian',
  ratingTier: 'family',
  questions: [
    { prompt: 'What is the capital of Nigeria?', options: ['Lagos', 'Abuja', 'Kano', 'Ibadan'], answerIdx: 1, difficulty: 1 },
    { prompt: 'Which Nigerian won the Nobel Prize in Literature?', options: ['Chinua Achebe', 'Wole Soyinka', 'Ben Okri', 'Chimamanda Adichie'], answerIdx: 1, difficulty: 2 },
    { prompt: 'What does "Naija" colloquially refer to?', options: ['A food', 'Nigeria', 'A dance', 'A river'], answerIdx: 1, difficulty: 1 },
    { prompt: 'Which river is the longest in Nigeria?', options: ['Niger', 'Benue', 'Kaduna', 'Cross'], answerIdx: 0, difficulty: 2 },
    { prompt: 'Jollof rice is most associated with which region?', options: ['East Africa', 'West Africa', 'North Africa', 'Southern Africa'], answerIdx: 1, difficulty: 1 },
  ],
};

const HOT_TAKES = [
  { prompt: 'Suya is overrated.', ratingTier: 'family', tags: [] },
  { prompt: 'Jollof rice is better than fried rice, no debate.', ratingTier: 'family', tags: [] },
  { prompt: 'Owambe parties start too late.', ratingTier: 'family', tags: [] },
  { prompt: 'Lagos traffic builds character.', ratingTier: 'family', tags: [] },
  { prompt: 'Pounded yam is superior to eba.', ratingTier: 'family', tags: [] },
];

const PLEAD_SCENARIOS = [
  {
    key: 'borrowed-generator',
    charge: 'Failure to return a borrowed generator',
    defendant: 'A neighbour who borrowed a generator during a blackout',
    facts: 'The generator was borrowed for "one night" three weeks ago and has not been returned. The defendant says it developed a fault while in their care.',
    laws: 'Bailment requires return of borrowed property in the condition received, fair wear excepted.',
    precedents: 'In community disputes, good-faith effort to repair has reduced liability.',
    ratingTier: 'family',
    tags: [],
    difficulty: 1,
  },
];

const PLEAD_RUBRIC = {
  key: 'default',
  criteria: [
    { key: 'legal_soundness', label: 'Legal soundness', weight: 0.4 },
    { key: 'persuasiveness', label: 'Persuasiveness', weight: 0.35 },
    { key: 'use_of_precedent', label: 'Use of precedent', weight: 0.25 },
  ],
};

const run = async (): Promise<void> => {
  await connectDb();
  const db = getDb();

  await db.collection('quiz_decks').updateOne({ key: QUIZ_DECK.key }, { $set: QUIZ_DECK }, { upsert: true });

  for (const ht of HOT_TAKES) {
    await db.collection('hot_take_prompts').updateOne({ prompt: ht.prompt }, { $set: ht }, { upsert: true });
  }

  for (const sc of PLEAD_SCENARIOS) {
    await db.collection('plead_scenarios').updateOne({ key: sc.key }, { $set: sc }, { upsert: true });
  }

  await db.collection('plead_rubric').updateOne({ key: PLEAD_RUBRIC.key }, { $set: PLEAD_RUBRIC }, { upsert: true });

  logger.info(
    { quizDecks: 1, hotTakes: HOT_TAKES.length, pleadScenarios: PLEAD_SCENARIOS.length, rubric: 1 },
    'content seed complete',
  );
  await closeDb();
};

run().catch((err: unknown) => {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, 'content seed failed');
  process.exit(1);
});
