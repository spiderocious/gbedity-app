import { logger } from '@lib/logger';
import { GameId } from '@engine/constants';
import { getPlugin } from '@engine/registry';

import { catalogueRepository } from './catalogue.repository';
import { uiMappingFor } from './catalogue.constants';

// Idempotent catalogue seed (spec §8 confirm #2). Mirrors the landing showcase's static GAMES so a
// fresh deploy has authored entries to curate — but seeds them as DRAFT, not active: per the product
// rule "built ≠ shown," an admin (or an explicit activation) decides what goes live. estMinutes and
// descriptions are transcribed from the current static manifest; iconName from game-icons.ts.
// Re-running skips games that already have an entry, so it never clobbers admin edits.

interface SeedRow {
  gameId: string;
  description: string;
  estMinutes: number;
  iconName: string;
}

const SEED: readonly SeedRow[] = [
  { gameId: GameId.QUIZZES, description: 'Multiple-choice trivia. Faster correct answers earn more points.', estMinutes: 8, iconName: 'Brain' },
  { gameId: GameId.BIBLE_QUIZ, description: 'Scripture trivia with translation and testament filters.', estMinutes: 8, iconName: 'BookOpen' },
  { gameId: GameId.SPELLING_FAST, description: 'A word is read aloud — never shown. Race to spell it right.', estMinutes: 6, iconName: 'Volume2' },
  { gameId: GameId.TYPING_FAST, description: 'A passage appears. Race to type it accurately. Speed times accuracy.', estMinutes: 6, iconName: 'Keyboard' },
  { gameId: GameId.WORDSHOT, description: 'A letter and a category. Type a valid answer that fits, fast.', estMinutes: 7, iconName: 'Target' },
  { gameId: GameId.WORD_BOMB, description: 'A ticking bomb passes round-robin. Hold it longer for more points.', estMinutes: 7, iconName: 'Bomb' },
  { gameId: GameId.SCRAMBLED_WORD, description: 'Unscramble the word. Guesses rank live by closeness.', estMinutes: 7, iconName: 'Shuffle' },
  { gameId: GameId.MISSING_LETTERS, description: 'Fill the gaps in the word. Faster correct earns more.', estMinutes: 6, iconName: 'SpellCheck2' },
  { gameId: GameId.DEFINITION_RACE, description: 'A definition appears. Race to name the word, ranked live.', estMinutes: 7, iconName: 'BookA' },
  { gameId: GameId.SYNONYMS, description: 'A word appears. Type a valid synonym. Rarer scores higher.', estMinutes: 6, iconName: 'ArrowLeftRight' },
  { gameId: GameId.ANTONYMS, description: 'A word appears. Type a valid antonym. Rarer scores higher.', estMinutes: 6, iconName: 'ArrowLeftRight' },
  { gameId: GameId.MILLIONAIRE, description: 'A graduated ladder, taken in turns. Lifelines included. Bank the most.', estMinutes: 15, iconName: 'Crown' },
  { gameId: GameId.TRUTH_OR_DARE, description: 'Pick truth or dare. The room votes on whether you delivered.', estMinutes: 10, iconName: 'Drama' },
  { gameId: GameId.CATCH_THE_LIE, description: 'Two truths and a lie, revealed anonymously. Spot the lie.', estMinutes: 10, iconName: 'Eye' },
  { gameId: GameId.HOT_TAKE_COURT, description: 'A spicy prompt. Defend it in one line. The room votes the winner.', estMinutes: 10, iconName: 'Gavel' },
  { gameId: GameId.INVESTIGATION, description: 'Work the case from your phone, then name who is responsible.', estMinutes: 30, iconName: 'Search' },
  { gameId: GameId.PLEAD_YOUR_CASE, description: 'Argue the defence. An AI scores soundness, persuasion, and precedent.', estMinutes: 12, iconName: 'Scale' },
  { gameId: GameId.PRESENTATION, description: 'Present a cold topic for 90 seconds. The room rates you.', estMinutes: 12, iconName: 'Mic' },
  { gameId: GameId.GUESS_THE_WORD, description: 'One player guesses a secret word using only voice questions. Score by time and questions left.', estMinutes: 10, iconName: 'HelpCircle' },
];

export const seedCatalogue = async (): Promise<{ created: number; skipped: number }> => {
  let created = 0;
  let skipped = 0;

  for (const row of SEED) {
    // Only seed games that are actually registered + mappable (defensive).
    if (!getPlugin(row.gameId) || !uiMappingFor(row.gameId)) {
      logger.warn({ gameId: row.gameId }, 'catalogue seed: skipped — not a registered/mappable game');
      skipped += 1;
      continue;
    }
    if (await catalogueRepository.getByGameId(row.gameId)) {
      skipped += 1; // already authored — never clobber
      continue;
    }
    const mapping = uiMappingFor(row.gameId);
    await catalogueRepository.create({
      gameId: row.gameId,
      description: row.description,
      estMinutes: row.estMinutes,
      iconName: row.iconName,
      sortOrder: mapping?.prdId ?? 0, // showcase order matches the PRD/manifest order
    });
    created += 1;
  }

  if (created > 0) logger.info({ created, skipped }, 'catalogue seeded (entries start as draft)');
  return { created, skipped };
};
