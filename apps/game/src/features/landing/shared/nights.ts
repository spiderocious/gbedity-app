import { Pizza, Sofa, Trophy, type LucideIcon } from '@icons';

// "Made for nights like these" — the who-is-this-for answer. Object-only vibe (lucide,
// no faces) per branding §5. as-const manifest; keys are named constants, no inline
// variant strings.

export const NightKey = {
  FAMILY: 'family',
  FRIENDS: 'friends',
  COUSINS: 'cousins',
} as const;
export type NightKey = (typeof NightKey)[keyof typeof NightKey];

export interface NightCard {
  readonly key: NightKey;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
}

export const NIGHTS: readonly NightCard[] = [
  {
    key: NightKey.FAMILY,
    icon: Sofa,
    title: 'Family game night',
    body: 'Mixed ages, mixed energy. Family-rated games only — set it once, forget it.',
  },
  {
    key: NightKey.FRIENDS,
    icon: Pizza,
    title: 'Friends-over party',
    body: 'Eight people, two pizzas, three hours. Spicier rounds for the grown-ups.',
  },
  {
    key: NightKey.COUSINS,
    icon: Trophy,
    title: 'Sunday with the cousins',
    body: 'Twelve cousins, one phone each. League mode, one winner at the end.',
  },
];
