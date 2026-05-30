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
