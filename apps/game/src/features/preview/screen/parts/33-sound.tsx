import { Button, Pill, SoundKey, soundService, useSound } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

// Ensure the SFX are loaded for the gallery (idempotent; app boot also calls this).
soundService.preload();

const SFX: readonly { key: SoundKey; label: string }[] = [
  { key: SoundKey.BUTTON_HOVER, label: 'button_hover' },
  { key: SoundKey.BUTTON_CLICK, label: 'button_click' },
  { key: SoundKey.GAME_START, label: 'game_start' },
  { key: SoundKey.SUCCESS, label: 'success' },
  { key: SoundKey.ERROR, label: 'error' },
];

export function SoundPart() {
  const { play, isMuted, toggleMute } = useSound();

  return (
    <div>
      <PageHead
        index="33 / FEEDBACK"
        title="Sound"
        subtitle="@gbedity/ui · sound · useSound() hook + floating SoundButton"
      />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Components call <code>useSound()</code> — never the service directly. The hook delegates
        to a singleton (HTMLAudio pool, clone-to-overlap SFX, mute persisted to localStorage)
        and subscribes to its state, so the floating <code>&lt;SoundButton /&gt;</code> (mounted
        once at the app root, bottom-right) stays in sync. Mute is global: flip it here and the
        floating button updates too.
      </p>

      <RefBlock title="SFX — play(SoundKey)">
        <RefRow label="every effect in the set">
          {SFX.map((s) => (
            <Button key={s.key} variant="secondary" size="sm" onClick={() => play(s.key)}>
              {s.label}
            </Button>
          ))}
        </RefRow>
        <RefRow label="overlap-safe">
          <Button
            onClick={() => {
              play(SoundKey.BUTTON_CLICK);
              play(SoundKey.BUTTON_CLICK);
              play(SoundKey.BUTTON_CLICK);
            }}
          >
            Fire three at once
          </Button>
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Mute — global, persisted, reactive">
        <RefRow label="current state">
          <Pill tone={isMuted ? 'danger' : 'action'}>{isMuted ? 'Muted' : 'On'}</Pill>
        </RefRow>
        <RefRow label="toggle from anywhere">
          <Button variant="secondary" onClick={() => toggleMute()}>
            {isMuted ? 'Unmute' : 'Mute'}
          </Button>
        </RefRow>
        <p className="mt-2 max-w-[60ch] text-[12px] text-ink-3">
          The floating button in the bottom-right corner reflects this state and survives a
          reload — both read the same persisted source.
        </p>
      </RefBlock>
    </div>
  );
}
