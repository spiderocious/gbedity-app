import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

// Maps a stored investigation_case doc → the plugin's rich content. IMPORTANT: this projection is the
// single seam where DB fields reach the game — every gameplay field MUST be listed here, or it is
// silently dropped even though it's in the DB. Authoring-only fields (key/ratingTier/tags/difficulty)
// are intentionally NOT projected — they gate selection, never reach a client. The plugin's
// contentSchema (.default() on the optional arrays) fills any gaps from an older/sparser doc.

// A minimal valid case used only when the DB has nothing to draw (keeps a solo/MP game from breaking).
const FALLBACK = {
  title: 'The Missing Trophy',
  category: 'Theft',
  brief: 'The community trophy vanished from the locked hall overnight. Three people had keys.',
  suspects: [
    { id: 's1', name: 'The Caretaker', age: 54, role: 'Holds the master key', motive: 'Passed over for a raise.', alibi: 'Says he was home all night — no one confirms it.', alibiStatus: 'shaky', phone: '', note: 'Calm, but vague about the late hours.' },
    { id: 's2', name: 'The Captain', age: 33, role: 'Wanted the trophy moved', motive: 'A grudge over the last vote.', alibi: 'On a phone call that ended at 10:30pm.', alibiStatus: 'broken', phone: '', note: 'Eager to point elsewhere.' },
    { id: 's3', name: 'The Treasurer', age: 47, role: 'Last to leave', motive: 'None obvious.', alibi: 'Logged out at 9pm per the register.', alibiStatus: 'confirmed', phone: '', note: 'Cooperative.' },
  ],
  reports: [
    {
      id: 'r1',
      kind: 'forensic',
      title: 'Scene Report — The Hall',
      subtitle: 'Door + access log',
      header: [{ label: 'Secured', value: '08:10' }],
      findings: [{ heading: 'Keycard entry', detail: 'An entry at 11:42pm under the caretaker’s card.', flag: 'key' }],
    },
  ],
  witnesses: [],
  transcripts: [],
  timeline: [
    { time: '9:00pm', event: 'Treasurer logs out.', source: 'Register', conflict: false },
    { time: '10:30pm', event: 'Captain’s call ends.', source: 'Phone records', conflict: true },
    { time: '11:42pm', event: 'Keycard entry under the caretaker’s card.', source: 'Door log', conflict: false },
  ],
  tools: [],
  solutionSuspectId: 's1',
  keyEvidenceId: 'r1',
  explanation: 'The caretaker’s own keycard logged the 11:42pm entry — well after he claimed to be home, and his alibi was never confirmed.',
};

export const installInvestigationContent = (): void => {
  registerContentResolver(GameId.INVESTIGATION, async (input: ResolveInput): Promise<unknown> => {
    // The host may have chosen a specific case (caseKey); otherwise draw a random one. A chosen case
    // that doesn't exist or is rating-filtered out falls through to a random draw.
    const caseKey = typeof (input.config as { caseKey?: unknown })?.caseKey === 'string' ? (input.config as { caseKey: string }).caseKey : '';
    let c: Record<string, unknown> | null = null;
    if (caseKey !== '') c = await contentService.investigationCaseByKey(caseKey, { filter: input.ratingFilter });
    if (!c) {
      const cases = await contentService.resolveInvestigationCases({ filter: input.ratingFilter, sample: 1 });
      c = cases[0] ?? null;
    }
    if (!c) return FALLBACK;
    return {
      title: c.title,
      category: c.category ?? 'Investigation',
      brief: c.brief,
      suspects: c.suspects ?? [],
      reports: c.reports ?? [],
      witnesses: c.witnesses ?? [],
      transcripts: c.transcripts ?? [],
      timeline: c.timeline ?? [],
      tools: c.tools ?? [],
      solutionSuspectId: c.solutionSuspectId,
      keyEvidenceId: c.keyEvidenceId ?? '',
      explanation: c.explanation ?? '',
    };
  });
};
