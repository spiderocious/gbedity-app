import {
  ArrowLeftRight,
  Bomb,
  BookA,
  BookOpen,
  Brain,
  Crown,
  Drama,
  Eye,
  Gamepad2,
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

// Resolve a catalogue entry's `iconName` (a lucide name the backend stores per game) to a
// lucide component. Replaces the static GAME_ICON: Record<GameKey, …> map — icons are now
// driven by admin data, not a hardcoded per-key table. Unknown names degrade to a generic
// glyph rather than rendering nothing (lucide-not-emoji rule preserved).

const ICONS: Record<string, LucideIcon> = {
  ArrowLeftRight,
  Bomb,
  BookA,
  BookOpen,
  Brain,
  Crown,
  Drama,
  Eye,
  Gamepad2,
  Gavel,
  Keyboard,
  Mic,
  Scale,
  Search,
  Shuffle,
  SpellCheck2,
  Target,
  Volume2,
};

export const iconFor = (iconName: string): LucideIcon => ICONS[iconName] ?? Gamepad2;
