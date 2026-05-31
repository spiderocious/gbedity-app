import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

const FALLBACK = {
  title: 'The Missing Trophy',
  brief: 'The community trophy vanished from the locked hall overnight. Three people had keys.',
  suspects: [
    { id: 's1', name: 'The Caretaker', profile: 'Has the master key; says he was home all night.' },
    { id: 's2', name: 'The Captain', profile: 'Wanted the trophy moved; alibi is a phone call.' },
    { id: 's3', name: 'The Treasurer', profile: 'Last to leave; logged out at 9pm per the register.' },
  ],
  evidence: [
    { id: 'e1', label: 'Door log', detail: 'A keycard entry at 11:42pm under the caretaker’s card.' },
    { id: 'e2', label: 'Phone records', detail: 'The captain’s call ended at 10:30pm, not midnight.' },
  ],
  timeline: ['9:00pm treasurer logs out', '10:30pm captain call ends', '11:42pm keycard entry'],
  solutionSuspectId: 's1',
};

export const installInvestigationContent = (): void => {
  registerContentResolver(GameId.INVESTIGATION, async (input: ResolveInput): Promise<unknown> => {
    const cases = await contentService.resolveInvestigationCases({ filter: input.ratingFilter, sample: 1 });
    const c = cases[0];
    if (!c) return FALLBACK;
    return {
      title: c.title,
      brief: c.brief,
      suspects: c.suspects,
      evidence: c.evidence,
      timeline: c.timeline ?? [],
      solutionSuspectId: c.solutionSuspectId,
    };
  });
};
