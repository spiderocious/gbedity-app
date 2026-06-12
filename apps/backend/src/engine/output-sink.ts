import type { Audience, ViewPatch } from './types';

// How the runtime emits projected views to clients. Abstracted so the runtime never imports
// Socket.IO directly — the gateway provides a real sink; tests provide a recording sink. This is
// the same "don't reach outside your layer" discipline the plugins follow.

export interface OutputSink {
  // Send a projected view to a specific audience within a room.
  send(roomCode: string, audience: Audience, patch: ViewPatch): void;
  // Signal that the active game ended (natural finish OR host end_game) — clients leave the in-game
  // screen and the room returns to lobby. A lifecycle signal, not a view; optional so recording
  // sinks in tests don't have to implement it.
  gameOver?(roomCode: string): void;
}

// A sink that drops everything — used when a runtime spins up before any transport is attached.
export const noopSink: OutputSink = {
  send(): void {
    /* no-op */
  },
  gameOver(): void {
    /* no-op */
  },
};
