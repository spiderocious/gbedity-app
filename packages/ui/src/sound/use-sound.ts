import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { SoundKey } from './sound-manifest.ts';
import { soundService } from './sound-service.ts';

export interface UseSound {
  /** Play a one-shot effect by key, e.g. play(SoundKey.BUTTON_CLICK). No-op when muted. */
  play: (key: SoundKey) => void;
  /** Start looping background music by key (fades in by default). */
  playMusic: (key: SoundKey, fadeIn?: boolean) => void;
  /** Stop the current music (fades out by default). */
  stopMusic: (fadeOut?: boolean) => void;
  /** Flip mute on/off; returns the new muted state. Persisted across sessions. */
  toggleMute: () => boolean;
  /** Set mute explicitly. */
  setMuted: (value: boolean) => void;
  /** Reactive — re-renders the consumer when mute changes anywhere. */
  isMuted: boolean;
  /** Channel volumes (0–1), persisted. */
  setSfxVolume: (value: number) => void;
  setMusicVolume: (value: number) => void;
  sfxVolume: number;
  musicVolume: number;
}

/**
 * useSound — the single React entry point to the sound system.
 *
 * Components call this hook; they never import soundService directly. The hook delegates
 * imperative calls to the service and subscribes to its mute/volume state so the UI (e.g. the
 * floating SoundButton) re-renders in sync.
 *
 *   const { play, toggleMute, isMuted } = useSound();
 *   <Button onClick={() => { play(SoundKey.BUTTON_CLICK); doThing(); }} />
 */
export function useSound(): UseSound {
  const snapshot = useSyncExternalStore(
    soundService.subscribe,
    soundService.getSnapshot,
    soundService.getSnapshot,
  );

  const play = useCallback((key: SoundKey) => soundService.play(key), []);
  const playMusic = useCallback(
    (key: SoundKey, fadeIn?: boolean) => soundService.playMusic(key, fadeIn),
    [],
  );
  const stopMusic = useCallback((fadeOut?: boolean) => soundService.stopMusic(fadeOut), []);
  const toggleMute = useCallback(() => soundService.toggleMute(), []);
  const setMuted = useCallback((value: boolean) => soundService.setMuted(value), []);
  const setSfxVolume = useCallback((value: number) => soundService.setSfxVolume(value), []);
  const setMusicVolume = useCallback((value: number) => soundService.setMusicVolume(value), []);

  return useMemo(
    () => ({
      play,
      playMusic,
      stopMusic,
      toggleMute,
      setMuted,
      isMuted: snapshot.muted,
      setSfxVolume,
      setMusicVolume,
      sfxVolume: snapshot.sfxVolume,
      musicVolume: snapshot.musicVolume,
    }),
    [
      play,
      playMusic,
      stopMusic,
      toggleMute,
      setMuted,
      setSfxVolume,
      setMusicVolume,
      snapshot.muted,
      snapshot.sfxVolume,
      snapshot.musicVolume,
    ],
  );
}
