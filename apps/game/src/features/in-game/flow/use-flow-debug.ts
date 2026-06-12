import { useRef } from 'react';

import { log } from '../../../shared/observability/logger.ts';
import { LogEvent } from '../../../shared/observability/events.ts';
import type { ViewPatch } from '../../../shared/types/view.ts';

// One-call, aggressive instrumentation for a game flow. Put `useFlowDebug('XFlow', patch, {…})` at
// the top of every flow component and you get, automatically:
//   • flow_patch_in   — every time the patch's identity-fields change: phase, the round index, and a
//                       compact summary (which keys are present, board size, deadline countdown).
//   • flow_patch_full — the FULL patch object on each change (heavy; mute `flow_patch_full` if noisy).
//   • flow_render     — every render: the resolved stage/phase + a `branch` label + any derived values
//                       you pass (yourScore, yourTurn, submitted, the chosen UI branch, …).
// The goal: from an exported log alone, you can replay exactly what each audience saw and why.

const KEY_FIELDS = [
  'phase', 'idx', 'qIndex', 'roundIndex', 'round', 'revealIdx', 'deadline', 'phaseSeconds', 'revealSeconds',
  'prompt', 'options', 'answerIdx', 'masked', 'answer', 'scrambled', 'definition', 'letter', 'category',
  'passage', 'speak', 'holderId', 'yourTurn', 'presenterId', 'choice', 'rung', 'scenario', 'title',
  'submitted', 'voted', 'solved', 'answered', 'yourScore', 'yourClosest', 'yourSubmission', 'board',
  'ranked', 'defences', 'tally', 'statements', 'results', 'suspects', 'winnerId',
] as const;

// Which top-level keys are actually present + non-empty on this patch (so you can see at a glance what
// the backend sent for this audience/phase).
function presentKeys(patch: ViewPatch): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out.push(k);
  }
  return out.sort();
}

function summary(patch: ViewPatch): Record<string, unknown> {
  const s: Record<string, unknown> = {};
  for (const f of KEY_FIELDS) {
    const v = (patch as Record<string, unknown>)[f];
    if (v === undefined) continue;
    if (Array.isArray(v)) s[f] = `[${v.length}]`;
    else if (typeof v === 'object' && v !== null) s[f] = '{…}';
    else s[f] = v;
  }
  if (typeof patch.deadline === 'number') s.deadlineInMs = patch.deadline - Date.now();
  s._present = presentKeys(patch);
  return s;
}

export function useFlowDebug(
  component: string,
  patch: ViewPatch | null,
  derived?: Record<string, unknown>,
): void {
  // Log the patch (compact + full) only when its identity-fields change — not on every render
  // (renders are logged separately, cheaply, with the derived snapshot).
  const sig = patch ? `${patch.phase}|${(patch as Record<string, unknown>).idx ?? ''}|${(patch as Record<string, unknown>).qIndex ?? ''}|${(patch as Record<string, unknown>).roundIndex ?? ''}|${(patch as Record<string, unknown>).round ?? ''}|${(patch as Record<string, unknown>).revealIdx ?? ''}|${patch.deadline ?? ''}` : 'null';
  const lastSig = useRef<string | null>(null);
  if (patch && sig !== lastSig.current) {
    lastSig.current = sig;
    log.event(LogEvent.FLOW_PATCH_IN, summary(patch), { component });
    log.event(LogEvent.FLOW_PATCH_FULL, { patch }, { component });
  } else if (!patch && lastSig.current !== 'null') {
    lastSig.current = 'null';
    log.event(LogEvent.FLOW_NO_PATCH, {}, { component });
  }

  // Every render: the derived snapshot (cheap, high-signal — shows the flow's decision each frame).
  if (derived !== undefined) {
    log.event(LogEvent.FLOW_RENDER, derived, { component });
  }
}
