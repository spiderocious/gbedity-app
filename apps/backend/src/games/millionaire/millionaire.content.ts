import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

interface MilConfig {
  questionCount: number;
  category?: string;
}

// Reuses the quiz_decks content (difficulty-graded MCQs). The resolver RANDOM-samples questions and
// orders them easy→hard so the ladder climbs and every game is a fresh mix. With no category set we
// draw from ALL categories (never starve the game on a category mismatch); a room may pin one.
export const installMillionaireContent = (): void => {
  registerContentResolver(GameId.MILLIONAIRE, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as MilConfig;
    const questions = await contentService.resolveQuizQuestions({
      ...(config.category !== undefined && config.category !== '' ? { category: config.category } : {}),
      sample: Math.max(1, config.questionCount ?? 15),
    });
    return {
      questions:
        questions.length > 0
          ? questions.map((q) => ({ prompt: q.prompt, options: q.options, answerIdx: q.answerIdx }))
          : [{ prompt: 'What is 2 + 2?', options: ['3', '4', '5', '6'], answerIdx: 1 }],
    };
  });
};
