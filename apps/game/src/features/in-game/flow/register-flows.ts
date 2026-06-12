import { MissingLettersFlow } from '../games/missing-letters/missing-letters-flow.tsx';
import { QuizzesFlow } from '../games/quizzes/quizzes-flow.tsx';
import { AntonymsFlow, DefinitionRaceFlow, ScrambledWordFlow, SynonymsFlow } from '../games/race/race-flows.ts';
import { WordshotFlow } from '../games/wordshot/wordshot-flow.tsx';
import { TypingFastFlow } from '../games/typing/typing-flow.tsx';
import { SpellingFastFlow } from '../games/spelling/spelling-flow.tsx';
import { WordBombFlow } from '../games/word-bomb/word-bomb-flow.tsx';
import { TruthOrDareFlow } from '../games/truth-or-dare/truth-or-dare-flow.tsx';
import { PresentationFlow } from '../games/presentation/presentation-flow.tsx';
import { MillionaireFlow } from '../games/millionaire/millionaire-flow.tsx';
import { HotTakeCourtFlow } from '../games/hot-take-court/hot-take-court-flow.tsx';
import { CatchTheLieFlow } from '../games/catch-the-lie/catch-the-lie-flow.tsx';
import { PleadYourCaseFlow } from '../games/plead-your-case/plead-your-case-flow.tsx';
import { InvestigationFlow } from '../games/investigation/investigation-flow.tsx';
import { LiveGameId } from '../resolve-live-game.ts';
import { registerGameFlow } from './flow-registry.tsx';

// Single registration point: each game's flow component is bound to its backend gameId here. The
// in-game screens import this module for its side-effect, then resolve a flow via getGameFlow(id) —
// no hardcoded `=== MISSING_LETTERS`. Add a game = add its flow module + one registerGameFlow line.
//
// Bible Quiz shares the exact MCQ shape, so it reuses QuizzesFlow.
registerGameFlow(LiveGameId.MISSING_LETTERS, MissingLettersFlow);
registerGameFlow(LiveGameId.QUIZZES, QuizzesFlow);
registerGameFlow('bible_quiz', QuizzesFlow);

// Race-by-closeness family (one shared flow component, per-game config).
registerGameFlow('scrambled_word', ScrambledWordFlow);
registerGameFlow('definition_race', DefinitionRaceFlow);
registerGameFlow('synonyms', SynonymsFlow);
registerGameFlow('antonyms', AntonymsFlow);

// Wave 2 — Wordshot (letter+category sprint), Typing Fast (passage), Spelling Fast (TTS).
registerGameFlow(LiveGameId.WORDSHOT, WordshotFlow);
registerGameFlow('typing_fast', TypingFastFlow);
registerGameFlow('spelling_fast', SpellingFastFlow);

// Wave 3 — turn-based (round-robin): the spotlight rotates between players.
registerGameFlow(LiveGameId.WORD_BOMB, WordBombFlow);
registerGameFlow('truth_or_dare', TruthOrDareFlow);
registerGameFlow('presentation', PresentationFlow);
registerGameFlow('millionaire', MillionaireFlow);

// Wave 4 — submit/vote party games.
registerGameFlow(LiveGameId.HOT_TAKE_COURT, HotTakeCourtFlow);
registerGameFlow('catch_the_lie', CatchTheLieFlow);

// Wave 5 — immersive (AI-judged defence + open-phase case file).
registerGameFlow(LiveGameId.PLEAD_YOUR_CASE, PleadYourCaseFlow);
registerGameFlow('investigation', InvestigationFlow);
