import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

interface TFConfig {
  rounds: number;
  passageLength?: string;
}

export const installTypingFastContent = (): void => {
  registerContentResolver(GameId.TYPING_FAST, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as TFConfig;
    const passages = await contentService.resolveTypingPassages({
      sample: Math.max(1, config.rounds),
      ...(config.passageLength !== undefined && { length: config.passageLength }),
    });
    return { passages: passages.length > 0 ? passages : ['The quick brown fox jumps over the lazy dog.'] };
  });
};
