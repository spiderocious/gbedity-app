export { useSound } from './use-sound.ts';
export type { UseSound } from './use-sound.ts';

export { SoundButton } from './sound-button.tsx';
export type { SoundButtonProps, SoundButtonPosition } from './sound-button.tsx';

export { SoundKey, SoundKind, SOUND_MANIFEST } from './sound-manifest.ts';
export type { SoundAsset } from './sound-manifest.ts';

// The service is exported for app-boot preload + tests; components use useSound(), not this.
export { soundService } from './sound-service.ts';
