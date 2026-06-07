// The sound registry. Every sound is a named constant in an as-const POJO accessed by key —
// never an inline string (project-wide no-inline-variant-strings rule). The union type is
// derived from the object.
//
// Sources are the same gaming SFX set the WordMaster reference uses, kept remote for this pass.
// Self-hosting later is a one-file change: drop files in apps/game/public/sounds/ and repoint
// the URLs here — no consumer touches a URL directly.

// SFX — short, fire-and-forget effects. Overlap-safe (the service clones the node per play).
export const SoundKey = {
  BUTTON_HOVER: 'button_hover',
  BUTTON_CLICK: 'button_click',
  GAME_START: 'game_start',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;
export type SoundKey = (typeof SoundKey)[keyof typeof SoundKey];

// Whether a given sound is looping background music or a one-shot effect. Drives default
// volume + looping in the service. (No music in the set yet, but the seam is here.)
export const SoundKind = {
  SFX: 'sfx',
  MUSIC: 'music',
} as const;
export type SoundKind = (typeof SoundKind)[keyof typeof SoundKind];

export interface SoundAsset {
  readonly key: SoundKey;
  readonly url: string;
  readonly kind: SoundKind;
  /** Per-sound gain multiplier on top of the channel volume (0–1). Default 1. */
  readonly gain?: number;
}

// The catalogue. Order is the preload order. URLs match the reference's gaming SFX set.
export const SOUND_MANIFEST: readonly SoundAsset[] = [
  { key: SoundKey.BUTTON_HOVER, url: 'https://www.joshwcomeau.com/sounds/pop.mp3', kind: SoundKind.SFX, gain: 0.3 },
  { key: SoundKey.BUTTON_CLICK, url: 'https://www.joshwcomeau.com/sounds/menu-open-softer.mp3', kind: SoundKind.SFX, gain: 0.5 },
  { key: SoundKey.GAME_START, url: 'https://www.joshwcomeau.com/sounds/fanfare.mp3', kind: SoundKind.SFX, gain: 0.8 },
  { key: SoundKey.SUCCESS, url: 'https://www.joshwcomeau.com/sounds/switch-on.mp3', kind: SoundKind.SFX, gain: 0.7 },
  { key: SoundKey.ERROR, url: 'https://www.joshwcomeau.com/sounds/disable-sound.mp3', kind: SoundKind.SFX, gain: 0.6 },
] as const;
