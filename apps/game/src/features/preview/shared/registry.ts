import { lazy, type LazyExoticComponent } from 'react';

// The single source of truth for the preview gallery.
//
// To add a new component to the gallery:
//   1. Create a part file under ../screen/parts (e.g. `11-text.tsx`) exporting a
//      named component, following the 10-buttons.tsx shape.
//   2. Add one entry to PARTS below — id, label, group, and the lazy loader.
// The sidebar nav and the canvas router both derive from this list, so there's
// nothing else to wire up.

export type PreviewGroup = 'Foundation' | 'Primitives' | 'Display' | 'Feedback';

type PartComponent = LazyExoticComponent<() => React.ReactElement>;

export interface PreviewPart {
  readonly id: string;
  readonly label: string;
  readonly group: PreviewGroup;
  readonly Component: PartComponent;
}

// Render order of groups in the sidebar.
export const PREVIEW_GROUPS: readonly PreviewGroup[] = [
  'Foundation',
  'Primitives',
  'Display',
  'Feedback',
];

export const PARTS: readonly PreviewPart[] = [
  {
    id: 'buttons',
    label: 'Buttons',
    group: 'Primitives',
    Component: lazy(() =>
      import('../screen/parts/10-buttons.tsx').then((m) => ({ default: m.ButtonsPart })),
    ),
  },
  {
    id: 'input',
    label: 'Input · Field',
    group: 'Primitives',
    Component: lazy(() =>
      import('../screen/parts/11-input.tsx').then((m) => ({ default: m.InputPart })),
    ),
  },
  {
    id: 'segmented',
    label: 'Segmented',
    group: 'Primitives',
    Component: lazy(() =>
      import('../screen/parts/12-segmented.tsx').then((m) => ({ default: m.SegmentedPart })),
    ),
  },
  {
    id: 'switch',
    label: 'Switch',
    group: 'Primitives',
    Component: lazy(() =>
      import('../screen/parts/13-switch.tsx').then((m) => ({ default: m.SwitchPart })),
    ),
  },
  {
    id: 'checkbox',
    label: 'Checkbox',
    group: 'Primitives',
    Component: lazy(() =>
      import('../screen/parts/14-checkbox.tsx').then((m) => ({ default: m.CheckboxPart })),
    ),
  },
  {
    id: 'pill',
    label: 'Pill · CategoryChip',
    group: 'Display',
    Component: lazy(() =>
      import('../screen/parts/20-pill.tsx').then((m) => ({ default: m.PillPart })),
    ),
  },
  {
    id: 'avatar',
    label: 'Avatar · AvatarStack',
    group: 'Display',
    Component: lazy(() =>
      import('../screen/parts/21-avatar.tsx').then((m) => ({ default: m.AvatarPart })),
    ),
  },
  {
    id: 'card',
    label: 'Card',
    group: 'Display',
    Component: lazy(() =>
      import('../screen/parts/22-card.tsx').then((m) => ({ default: m.CardPart })),
    ),
  },
  {
    id: 'score',
    label: 'Score',
    group: 'Display',
    Component: lazy(() =>
      import('../screen/parts/23-score.tsx').then((m) => ({ default: m.ScorePart })),
    ),
  },
  {
    id: 'game-id',
    label: 'GameId',
    group: 'Display',
    Component: lazy(() =>
      import('../screen/parts/24-game-id.tsx').then((m) => ({ default: m.GameIdPart })),
    ),
  },
  {
    id: 'game-tile',
    label: 'GameTile',
    group: 'Display',
    Component: lazy(() =>
      import('../screen/parts/25-game-tile.tsx').then((m) => ({ default: m.GameTilePart })),
    ),
  },
  {
    id: 'player-row',
    label: 'LobbyRow · RankedRow',
    group: 'Display',
    Component: lazy(() =>
      import('../screen/parts/26-player-row.tsx').then((m) => ({ default: m.PlayerRowPart })),
    ),
  },
];

export const DEFAULT_PART_ID = PARTS[0]?.id ?? '';

export function findPart(id: string): PreviewPart | undefined {
  return PARTS.find((part) => part.id === id);
}
