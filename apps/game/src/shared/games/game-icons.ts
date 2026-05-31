import {
  ArrowLeftRight,
  Bomb,
  BookA,
  BookOpen,
  Brain,
  Crown,
  Drama,
  Eye,
  Gavel,
  Keyboard,
  Mic,
  Scale,
  Search,
  Shuffle,
  SpellCheck2,
  Target,
  Volume2,
  type LucideIcon,
} from '@icons';

import { GameKey } from './games-manifest.ts';

// Signature lucide icon per game — the tile-top anchor on the landing showcase, replacing
// the internal catalogue number as the visual lead (the number stays as a faint corner
// ref). Lucide, not emoji, per the brand's no-kawaii / lucide-only rule. Keyed by GameKey
// so the map is exhaustive at compile time (no inline strings; Record over the union).
export const GAME_ICON: Record<GameKey, LucideIcon> = {
  [GameKey.QUIZZES]: Brain,
  [GameKey.BIBLE_QUIZ]: BookOpen,
  [GameKey.SPELLING_FAST]: Volume2,
  [GameKey.TYPING_FAST]: Keyboard,
  [GameKey.WORDSHOT]: Target,
  [GameKey.WORD_BOMB]: Bomb,
  [GameKey.SCRAMBLED_WORD]: Shuffle,
  [GameKey.MISSING_LETTERS]: SpellCheck2,
  [GameKey.DEFINITION_RACE]: BookA,
  [GameKey.SYNONYMS]: ArrowLeftRight,
  [GameKey.ANTONYMS]: ArrowLeftRight,
  [GameKey.MILLIONAIRE]: Crown,
  [GameKey.TRUTH_OR_DARE]: Drama,
  [GameKey.CATCH_THE_LIE]: Eye,
  [GameKey.HOT_TAKE_COURT]: Gavel,
  [GameKey.INVESTIGATION]: Search,
  [GameKey.PLEAD_YOUR_CASE]: Scale,
  [GameKey.PRESENTATION]: Mic,
};
