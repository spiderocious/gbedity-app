import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

interface MilConfig {
  questionCount: number;
  category?: string;
}

// Reuses the quiz_decks content (difficulty-graded MCQs). The ladder ordering is by the deck's
// natural order; admins can author dedicated graduated decks.
export const installMillionaireContent = (): void => {
  registerContentResolver(GameId.MILLIONAIRE, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as MilConfig;
    const questions = await contentService.resolveQuizQuestions({
      category: config.category ?? 'general',
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
