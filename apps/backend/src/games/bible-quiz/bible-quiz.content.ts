import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

interface BibleConfig {
  rounds: number;
  translation?: string;
  testament?: string;
}

export const installBibleQuizContent = (): void => {
  registerContentResolver(GameId.BIBLE_QUIZ, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as BibleConfig;
    const questions = await contentService.resolveBibleQuestions({
      sample: Math.max(1, config.rounds),
      ...(config.translation !== undefined && { translation: config.translation }),
      ...(config.testament !== undefined && { testament: config.testament }),
    });
    return {
      questions:
        questions.length > 0
          ? questions.map((q) => ({ prompt: q.prompt, options: q.options, answerIdx: q.answerIdx }))
          : [{ prompt: 'Who built the ark?', options: ['Moses', 'Noah', 'Abraham', 'David'], answerIdx: 1 }],
    };
  });
};
