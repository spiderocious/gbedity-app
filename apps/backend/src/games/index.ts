import { registerPlugin } from '@engine/registry';

import { quizzesGame } from './quizzes/quizzes.plugin';
import { installQuizzesContent } from './quizzes/quizzes.content';
import { wordshotGame } from './wordshot/wordshot.plugin';
import { installWordshotContent } from './wordshot/wordshot.content';
import { wordBombGame } from './word-bomb/word-bomb.plugin';
import { installWordBombContent } from './word-bomb/word-bomb.content';
import { hotTakeCourtGame } from './hot-take-court/hot-take-court.plugin';
import { installHotTakeContent } from './hot-take-court/hot-take-court.content';
import { pleadYourCaseGame } from './plead-your-case/plead-your-case.plugin';
import { installPleadContent } from './plead-your-case/plead-your-case.content';

// Registers every real catalogue game plugin + its server-side content resolver. Called at boot
// (alongside the engine's test-game bootstrap). The other 13 games slot in here the same way.
let registered = false;

export const registerGames = (): void => {
  if (registered) return;

  registerPlugin(quizzesGame);
  installQuizzesContent();

  registerPlugin(wordshotGame);
  installWordshotContent();

  registerPlugin(wordBombGame);
  installWordBombContent();

  registerPlugin(hotTakeCourtGame);
  installHotTakeContent();

  registerPlugin(pleadYourCaseGame);
  installPleadContent();

  registered = true;
};
