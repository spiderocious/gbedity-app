import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

// Resolves Quizzes content server-side: pull a rating-filtered deck for the configured category,
// cap to the round count. Returns the plugin's Content shape ({ questions }).

interface QuizConfig {
  category: string;
  rounds: number;
}

export const installQuizzesContent = (): void => {
  registerContentResolver(GameId.QUIZZES, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as QuizConfig;
    const questions = await contentService.resolveQuizQuestions({
      category: config.category,
      filter: input.ratingFilter,
      sample: Math.max(1, config.rounds),
    });
    return { questions: questions.map((q) => ({ prompt: q.prompt, options: q.options, answerIdx: q.answerIdx })) };
  });
};
