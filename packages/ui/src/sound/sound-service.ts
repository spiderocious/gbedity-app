import {
  SOUND_MANIFEST,
  SoundKind,
  type SoundAsset,
  type SoundKey,
} from './sound-manifest.ts';

// Imperative sound singleton. Modelled on the WordMaster SoundManager: an HTMLAudioElement
// pool, clone-to-overlap SFX, fade-in/out music, and mute + volume persisted to localStorage.
//
// Two deliberate differences from the reference:
//   1. No `any`, no inline sound strings — every sound is a SoundKey from the manifest.
//   2. A pub-sub layer over mute/volume so React can subscribe (useSyncExternalStore) and the
//      whole UI stays in sync — the reference held mute in per-button useState, which drifts.
//
// React components NEVER import this directly — they go through useSound() (the shared hook),
// which is the seam this design requires. This module is the service behind that hook.

const STORAGE = {
  MUTED: 'gbedity-sound-muted',
  MUSIC_VOLUME: 'gbedity-music-volume',
  SFX_VOLUME: 'gbedity-sfx-volume',
} as const;

const DEFAULT_MUSIC_VOLUME = 0.7;
const DEFAULT_SFX_VOLUME = 0.8;
const FADE_STEPS = 50;

type Listener = () => void;

// SSR / non-browser guard — the service is import-safe anywhere; audio just no-ops without a DOM.
const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

// localStorage access can throw (private mode, blocked storage, or a not-yet-ready test env),
// so every read/write is guarded — a storage failure degrades to in-memory state, never a crash.
function storageGet(storeKey: string): string | null {
  if (!hasDom) return null;
  try {
    return window.localStorage.getItem(storeKey);
  } catch {
    return null;
  }
}

function storageSet(storeKey: string, value: string): void {
  if (!hasDom) return;
  try {
    window.localStorage.setItem(storeKey, value);
  } catch {
    // ignore — in-memory state still holds for the session
  }
}

function readStoredNumber(storeKey: string, fallback: number): number {
  const raw = storageGet(storeKey);
  if (raw === null) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? clamp01(parsed) : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

class SoundService {
  private readonly assets = new Map<SoundKey, HTMLAudioElement>();
  private readonly assetByKey = new Map<SoundKey, SoundAsset>();
  private currentMusic: HTMLAudioElement | null = null;
  private currentMusicKey: SoundKey | null = null;
  private muted: boolean;
  private musicVolume: number;
  private sfxVolume: number;
  private preloaded = false;

  // Pub-sub: a stable snapshot object so useSyncExternalStore only re-renders on real change.
  private readonly listeners = new Set<Listener>();
  private snapshot: { muted: boolean; musicVolume: number; sfxVolume: number };

  constructor() {
    this.muted = storageGet(STORAGE.MUTED) === 'true';
    this.musicVolume = readStoredNumber(STORAGE.MUSIC_VOLUME, DEFAULT_MUSIC_VOLUME);
    this.sfxVolume = readStoredNumber(STORAGE.SFX_VOLUME, DEFAULT_SFX_VOLUME);
    this.snapshot = this.buildSnapshot();
  }

  // ── Pub-sub (for useSyncExternalStore) ──────────────────────────────────────────────────

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): { muted: boolean; musicVolume: number; sfxVolume: number } =>
    this.snapshot;

  private buildSnapshot(): { muted: boolean; musicVolume: number; sfxVolume: number } {
    return { muted: this.muted, musicVolume: this.musicVolume, sfxVolume: this.sfxVolume };
  }

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }

  // ── Preload ─────────────────────────────────────────────────────────────────────────────

  // Idempotent — safe to call on every app boot. Failures degrade to a warning; a missing sound
  // just no-ops at play time (browsers also block audio before the first user gesture).
  preload(): void {
    if (!hasDom || this.preloaded) return;
    this.preloaded = true;
    for (const asset of SOUND_MANIFEST) {
      this.assetByKey.set(asset.key, asset);
      const audio = new Audio(asset.url);
      audio.preload = 'auto';
      audio.loop = asset.kind === SoundKind.MUSIC;
      audio.volume = this.channelVolumeFor(asset);
      this.assets.set(asset.key, audio);
    }
  }

  private channelVolumeFor(asset: SoundAsset): number {
    if (this.muted) return 0;
    const channel = asset.kind === SoundKind.MUSIC ? this.musicVolume : this.sfxVolume;
    return clamp01(channel * (asset.gain ?? 1));
  }

  // ── SFX ─────────────────────────────────────────────────────────────────────────────────

  // Clone the node so rapid repeats overlap instead of cutting each other off.
  play(key: SoundKey): void {
    if (this.muted || !hasDom) return;
    const base = this.assets.get(key);
    const asset = this.assetByKey.get(key);
    if (!base || !asset) return;
    const clip = base.cloneNode() as HTMLAudioElement;
    clip.volume = clamp01(this.sfxVolume * (asset.gain ?? 1));
    void clip.play().catch(() => {
      // Autoplay blocked or load failed — silent no-op (matches the reference's tolerance).
    });
  }

  // ── Music ───────────────────────────────────────────────────────────────────────────────

  playMusic(key: SoundKey, fadeIn = true): void {
    if (this.muted || !hasDom) return;
    const audio = this.assets.get(key);
    if (!audio) return;
    if (this.currentMusic && this.currentMusic !== audio) this.stopMusic(false);
    this.currentMusic = audio;
    this.currentMusicKey = key;
    audio.volume = fadeIn ? 0 : this.musicVolume;
    void audio.play().catch(() => undefined);
    if (fadeIn) this.fade(audio, this.musicVolume, 2000);
  }

  stopMusic(fadeOut = true): void {
    const audio = this.currentMusic;
    if (!audio) return;
    const reset = (): void => {
      audio.pause();
      audio.currentTime = 0;
      this.currentMusic = null;
      this.currentMusicKey = null;
    };
    if (fadeOut) {
      void this.fade(audio, 0, 1000).then(reset);
    } else {
      reset();
    }
  }

  // Linear volume ramp; returns a promise that resolves when the target is reached.
  private fade(audio: HTMLAudioElement, target: number, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const start = audio.volume;
      const delta = target - start;
      const stepMs = durationMs / FADE_STEPS;
      let step = 0;
      const id = setInterval(() => {
        step += 1;
        audio.volume = clamp01(start + (delta * step) / FADE_STEPS);
        if (step >= FADE_STEPS) {
          clearInterval(id);
          audio.volume = clamp01(target);
          resolve();
        }
      }, stepMs);
    });
  }

  // ── Mute ────────────────────────────────────────────────────────────────────────────────

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(value: boolean): void {
    if (this.muted === value) return;
    this.muted = value;
    storageSet(STORAGE.MUTED, String(value));
    if (this.currentMusic) this.currentMusic.volume = value ? 0 : this.musicVolume;
    this.emit();
  }

  isMuted(): boolean {
    return this.muted;
  }

  // ── Volume ──────────────────────────────────────────────────────────────────────────────

  setMusicVolume(value: number): void {
    this.musicVolume = clamp01(value);
    storageSet(STORAGE.MUSIC_VOLUME, String(this.musicVolume));
    if (this.currentMusic && !this.muted) this.currentMusic.volume = this.musicVolume;
    this.emit();
  }

  setSfxVolume(value: number): void {
    this.sfxVolume = clamp01(value);
    storageSet(STORAGE.SFX_VOLUME, String(this.sfxVolume));
    this.emit();
  }

  getCurrentMusic(): SoundKey | null {
    return this.currentMusicKey;
  }
}

// The one instance. The hook (use-sound.ts) is the public surface; tests may import this.
export const soundService = new SoundService();
