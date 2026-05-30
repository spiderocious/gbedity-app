// @gbedity/ui — bright-room game-night component library.
//
// Visual spec lives in the Studio at:
//   /Users/feranmi/codebases/2026/dockito/design-system/projects/gbedity/
//
// Components are styled with Tailwind utility classes that resolve against
// the shared theme in /tailwind.preset.ts. Consuming apps must include
// `packages/ui/src/**` in their tailwind content globs so library classes
// get compiled.

// Utils
export { cn } from './utils/cn.ts';

// Primitives
export { Button } from './button/index.ts';
export type { ButtonProps, ButtonVariant, ButtonSize } from './button/index.ts';

export { Input, Field, RoomCodeInput } from './input/index.ts';
export type { InputProps, FieldProps, RoomCodeInputProps } from './input/index.ts';

export { Segmented } from './segmented/index.ts';
export type { SegmentedProps, SegmentedOption } from './segmented/index.ts';

export { Switch } from './switch/index.ts';
export type { SwitchProps } from './switch/index.ts';

export { Checkbox } from './checkbox/index.ts';
export type { CheckboxProps } from './checkbox/index.ts';

// Data display
export { Pill, CategoryChip } from './pill/index.ts';
export type { PillProps, PillTone, CategoryChipProps, CategoryKey } from './pill/index.ts';

export { Avatar, AvatarStack } from './avatar/index.ts';
export type { AvatarProps, AvatarStackProps, AvatarSize, SeatIndex } from './avatar/index.ts';

export { Card } from './card/index.ts';
export type { CardProps, CardSize, CardTone } from './card/index.ts';

export { Score } from './score/index.ts';
export type { ScoreProps, ScoreSize, ScoreTone } from './score/index.ts';

export { GameId } from './game-id/index.ts';
export type { GameIdProps, GameIdSize } from './game-id/index.ts';

export { GameTile } from './game-tile/index.ts';
export type { GameTileProps } from './game-tile/index.ts';

export { LobbyRow, RankedRow } from './player-row/index.ts';
export type { LobbyRowProps, RankedRowProps } from './player-row/index.ts';

export { Slider } from './slider/index.ts';
export type { SliderProps } from './slider/index.ts';

export { PreviewRail, PreviewStat } from './preview-rail/index.ts';
export type { PreviewRailProps, PreviewStatProps } from './preview-rail/index.ts';

// Feedback
export { Toast, Banner, InlineAlert } from './feedback/index.ts';
export type {
  ToastProps,
  BannerProps,
  InlineAlertProps,
  FeedbackTone,
} from './feedback/index.ts';
