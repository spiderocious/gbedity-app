import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SoundButton } from '../sound-button.tsx';
import { soundService } from '../sound-service.ts';

afterEach(() => {
  // Unmount rendered trees (no global auto-cleanup configured) and reset the shared
  // singleton so tests don't leak mounted buttons or mute state into each other.
  cleanup();
  soundService.setMuted(false);
});

describe('soundService', () => {
  it('toggleMute flips and reports the new state', () => {
    expect(soundService.isMuted()).toBe(false);
    expect(soundService.toggleMute()).toBe(true);
    expect(soundService.isMuted()).toBe(true);
    expect(soundService.toggleMute()).toBe(false);
  });

  it('setMuted is idempotent and drives isMuted', () => {
    soundService.setMuted(true);
    expect(soundService.isMuted()).toBe(true);
    soundService.setMuted(false);
    expect(soundService.isMuted()).toBe(false);
  });

  it('notifies subscribers on mute change and a stable snapshot otherwise', () => {
    let calls = 0;
    const unsubscribe = soundService.subscribe(() => {
      calls += 1;
    });
    const before = soundService.getSnapshot();
    soundService.setMuted(true);
    expect(calls).toBe(1);
    expect(soundService.getSnapshot()).not.toBe(before);
    // No-op set (already true) must not emit.
    soundService.setMuted(true);
    expect(calls).toBe(1);
    unsubscribe();
  });
});

describe('SoundButton', () => {
  it('renders an accessible toggle reflecting mute state', () => {
    render(<SoundButton />);
    const btn = screen.getByRole('button', { name: /mute sound/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles mute on click and updates aria + label', () => {
    render(<SoundButton />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(soundService.isMuted()).toBe(true);
    expect(screen.getByRole('button', { name: /unmute sound/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('honours the position prop', () => {
    render(<SoundButton position="top-left" />);
    expect(screen.getByRole('button').className).toContain('top-5');
    expect(screen.getByRole('button').className).toContain('left-5');
  });
});
