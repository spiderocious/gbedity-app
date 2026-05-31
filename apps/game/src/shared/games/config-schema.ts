// Data-driven config schema. Each game declares its configure groups as plain data; the
// universal configure shell (§4) renders them with the reusable controls. No per-game
// configure component — the shell + this schema cover all 18 games.
//
// Control kinds are named constants (no inline variant strings).

export const ControlKind = {
  STEPPER: 'stepper',
  PILLS: 'pills',
  MULTI: 'multi',
  DROPDOWN: 'dropdown',
  SLIDER: 'slider',
  SWITCH: 'switch',
  CUSTOM_CONTENT: 'custom-content',
} as const;
export type ControlKind = (typeof ControlKind)[keyof typeof ControlKind];

interface ControlBase {
  readonly id: string;
  readonly label: string;
  readonly help?: string;
}

export interface StepperControl extends ControlBase {
  readonly kind: typeof ControlKind.STEPPER;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly defaultValue: number;
  readonly unit?: string;
}

export interface PillsControl extends ControlBase {
  readonly kind: typeof ControlKind.PILLS;
  readonly options: readonly string[];
  readonly defaultValue: string;
}

export interface MultiControl extends ControlBase {
  readonly kind: typeof ControlKind.MULTI;
  readonly options: readonly string[];
  readonly defaultSelected: readonly string[];
}

export interface DropdownControl extends ControlBase {
  readonly kind: typeof ControlKind.DROPDOWN;
  readonly options: readonly string[];
  readonly defaultValue: string;
}

export interface SliderControl extends ControlBase {
  readonly kind: typeof ControlKind.SLIDER;
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly defaultValue: number;
}

export interface SwitchControl extends ControlBase {
  readonly kind: typeof ControlKind.SWITCH;
  readonly defaultValue: boolean;
}

export interface CustomContentControl extends ControlBase {
  readonly kind: typeof ControlKind.CUSTOM_CONTENT;
  /** What the custom items are called, e.g. "questions", "prompts". */
  readonly noun: string;
}

export type ConfigControl =
  | StepperControl
  | PillsControl
  | MultiControl
  | DropdownControl
  | SliderControl
  | SwitchControl
  | CustomContentControl;

export interface ConfigGroup {
  readonly label: string;
  readonly controls: readonly ConfigControl[];
}
