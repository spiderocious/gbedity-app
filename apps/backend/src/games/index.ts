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
// Wave 2
import { missingLettersGame } from './missing-letters/missing-letters.plugin';
import { installMissingLettersContent } from './missing-letters/missing-letters.content';
import { scrambledWordGame } from './scrambled-word/scrambled-word.plugin';
import { installScrambledWordContent } from './scrambled-word/scrambled-word.content';
import { spellingFastGame } from './spelling-fast/spelling-fast.plugin';
import { installSpellingFastContent } from './spelling-fast/spelling-fast.content';
import { definitionRaceGame } from './definition-race/definition-race.plugin';
import { installDefinitionRaceContent } from './definition-race/definition-race.content';
import { synonymsGame, antonymsGame, installRelationContent } from './relation/relation.games';
import { catchTheLieGame } from './catch-the-lie/catch-the-lie.plugin';
import { truthOrDareGame } from './truth-or-dare/truth-or-dare.plugin';
import { installTruthOrDareContent } from './truth-or-dare/truth-or-dare.content';

// Registers every real catalogue game plugin + its server-side content resolver. The remaining
// games slot in here the same way.
let registered = false;

export const registerGames = (): void => {
  if (registered) return;

  // Wave 1
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

  // Wave 2
  registerPlugin(missingLettersGame);
  installMissingLettersContent();
  registerPlugin(scrambledWordGame);
  installScrambledWordContent();
  registerPlugin(spellingFastGame);
  installSpellingFastContent();
  registerPlugin(definitionRaceGame);
  installDefinitionRaceContent();
  registerPlugin(synonymsGame);
  registerPlugin(antonymsGame);
  installRelationContent();
  registerPlugin(catchTheLieGame); // player-generated content — no resolver
  registerPlugin(truthOrDareGame);
  installTruthOrDareContent();

  registered = true;
};
