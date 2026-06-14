// Rich MOCK case for the Investigation preview. No backend — this is the aspirational data shape we
// design the UI against (and what we'll mirror in the real content model later). It's deliberately
// meaty and a little confusing: real motives, alibis that half-check-out, planted red herrings, and
// investigative-tool lookups that sometimes dead-end (the twist). Avatars are DiceBear seeds (no
// images); evidence is written as forensic-style REPORTS.

export interface MockSuspect {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly role: string; // relationship to the case
  readonly motive: string;
  readonly alibi: string;
  readonly alibiHolds: 'confirmed' | 'shaky' | 'broken' | 'unchecked';
  readonly phone: string;
  readonly note: string; // a demeanour / first-impression line
}

export interface ReportField {
  readonly label: string;
  readonly value: string;
}

export interface MockReport {
  readonly id: string;
  readonly kind: 'forensic' | 'autopsy' | 'financial' | 'digital';
  readonly title: string;
  readonly subtitle: string; // e.g. "Suspect residence — 14 Bourdillon Rd"
  readonly fields: readonly ReportField[]; // the quick header (time, cause of death, etc.)
  readonly findings: readonly { heading: string; detail: string; flag?: 'key' | 'herring' }[];
}

export interface MockWitness {
  readonly id: string;
  readonly name: string;
  readonly relation: string;
  readonly statement: string;
  readonly reliability: 'reliable' | 'questionable' | 'hostile';
}

export interface TranscriptLine {
  readonly speaker: string;
  readonly text: string;
  readonly role: 'q' | 'a';
}

export interface MockTranscript {
  readonly id: string;
  readonly suspectId: string;
  readonly title: string;
  readonly lines: readonly TranscriptLine[];
}

export interface TimelineEvent {
  readonly time: string;
  readonly event: string;
  readonly source: string; // where this fact comes from
  readonly conflict?: boolean; // contradicts an alibi/statement
}

// An investigative tool/app result. `hit` = useful, `dead_end` = the twist (no result / inconclusive).
export interface LookupResult {
  readonly query: string;
  readonly outcome: 'hit' | 'dead_end' | 'partial';
  readonly rows: readonly { label: string; value: string }[];
  readonly note?: string;
}

export interface MockTool {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly icon: 'identity' | 'phone_records' | 'call_log' | 'triangulation' | 'crime_db';
  readonly results: readonly LookupResult[];
}

export interface MockCase {
  readonly key: string;
  readonly title: string;
  readonly category: string;
  readonly difficulty: 1 | 2 | 3;
  readonly brief: string;
  readonly suspects: readonly MockSuspect[];
  readonly reports: readonly MockReport[];
  readonly witnesses: readonly MockWitness[];
  readonly transcripts: readonly MockTranscript[];
  readonly timeline: readonly TimelineEvent[];
  readonly tools: readonly MockTool[];
  readonly solutionSuspectId: string;
  readonly keyEvidenceId: string; // the piece that proves it
  readonly explanation: string; // the reveal narrative
}

export const MOCK_CASE: MockCase = {
  key: 'case-the-last-pour',
  title: 'The Last Pour',
  category: 'Suspected Homicide',
  difficulty: 3,
  brief:
    'Chief Adewale Bankole, 58, founder of Bankole & Sons Distillery, was found dead in his locked study at the family compound in Ikoyi the morning after his retirement dinner. A glass of his signature aged brandy sat half-finished on the desk. The coroner suspects poisoning. Four people had access to the study that night. Work the case and name who is responsible.',
  suspects: [
    {
      id: 's1',
      name: 'Tunde Bankole',
      age: 34,
      role: 'Son · heir to the distillery',
      motive: 'The new will, signed that week, cut his stake from 60% to 20%. He found out at dinner.',
      alibi: 'Says he left at 11:40pm and drove straight home. Gate log shows his car leaving at 11:43pm.',
      alibiHolds: 'shaky',
      phone: '+234 802 551 0098',
      note: 'Calm, almost rehearsed. Asked twice when the will would be read.',
    },
    {
      id: 's2',
      name: 'Mrs. Folake Bankole',
      age: 51,
      role: 'Wife',
      motive: 'Insurance policy of ₦400m names her sole beneficiary. The marriage was, by all accounts, cold.',
      alibi: 'Retired to the master bedroom at 11:15pm. The housekeeper confirms bringing her tea at 11:30pm.',
      alibiHolds: 'confirmed',
      phone: '+234 805 200 7741',
      note: 'Composed. Grief reads as relief to two of the witnesses.',
    },
    {
      id: 's3',
      name: 'Emeka Obi',
      age: 47,
      role: 'Business partner · co-founder',
      motive: 'Owed the Chief ₦120m on a loan called in last month. A buy-out clause erases the debt on the Chief’s death.',
      alibi: 'Claims he was on a call with a Dubai supplier until past midnight. Has not produced the number.',
      alibiHolds: 'unchecked',
      phone: '+234 803 419 6620',
      note: 'Sweated through the interview. Volunteered an alibi before being asked for one.',
    },
    {
      id: 's4',
      name: 'Grace Aniekwe',
      age: 29,
      role: 'Live-in housekeeper',
      motive: 'Quietly dismissed two weeks ago after a missing-cash accusation she denies. Still living on the compound.',
      alibi: 'Served drinks all evening; last seen carrying the brandy decanter to the study at 11:20pm.',
      alibiHolds: 'broken',
      phone: '+234 701 884 3052',
      note: 'Nervous, but cooperative. The only person who touched the decanter.',
    },
  ],
  reports: [
    {
      id: 'r1',
      kind: 'autopsy',
      title: 'Autopsy Report — A. Bankole',
      subtitle: 'Lagos State Forensic Pathology Unit · Ref AP-2231',
      fields: [
        { label: 'Cause of death', value: 'Cardiac arrest secondary to poisoning' },
        { label: 'Time of death', value: '00:10 – 00:50 (est.)' },
        { label: 'Toxin', value: 'Oleander glycoside (plant-derived)' },
      ],
      findings: [
        {
          heading: 'Toxicology',
          detail:
            'Lethal concentration of oleandrin in blood and gastric contents. Oleander is not pharmaceutical — it is brewed from crushed leaves of the ornamental shrub. Onset 30–60 minutes after ingestion. Consistent with the brandy as the vehicle.',
          flag: 'key',
        },
        {
          heading: 'Stomach contents',
          detail: 'Brandy, trace canapé. No tablets, capsules, or pharmaceutical residue.',
        },
        {
          heading: 'Note',
          detail:
            'A faint bruise on the right forearm, 2–3 days old, unrelated to time of death. Likely incidental.',
          flag: 'herring',
        },
      ],
    },
    {
      id: 'r2',
      kind: 'forensic',
      title: 'Scene Report — The Study',
      subtitle: 'Crime Scene Unit · 14 Glover Road, Ikoyi',
      fields: [
        { label: 'Scene secured', value: '07:55' },
        { label: 'Door', value: 'Locked from inside · key on desk' },
        { label: 'Items logged', value: '6' },
      ],
      findings: [
        {
          heading: 'Item 1 — Brandy glass',
          detail:
            'Oleandrin detected in residue. ONE set of prints: the victim’s. The glass was poured and handed to him, or he poured it himself from the decanter.',
          flag: 'key',
        },
        {
          heading: 'Item 2 — Brandy decanter',
          detail:
            'NO oleandrin in the decanter. The poison was in the glass only — not the bottle. Prints: victim, and a partial smudged set, gloved.',
          flag: 'key',
        },
        {
          heading: 'Item 3 — Pruned oleander shrub',
          detail:
            'Garden behind the kitchen. Fresh cuttings, leaves stripped. Secateurs found wiped clean and returned to the garden shed.',
          flag: 'key',
        },
        {
          heading: 'Item 4 — Torn betting slip',
          detail: 'In the waste bin. Lagos racing, dated three weeks ago. Belongs to the gardener, off-duty that night.',
          flag: 'herring',
        },
        { heading: 'Item 5 — Window', detail: 'Latched from inside. No tampering. Drop to the courtyard is 4 metres.' },
        { heading: 'Item 6 — Wall safe', detail: 'Closed, undisturbed. ₦2.1m and the new will inside, intact.' },
      ],
    },
    {
      id: 'r3',
      kind: 'financial',
      title: 'Financial Review',
      subtitle: 'Forensic Accounting · 90-day window',
      fields: [
        { label: 'Flag count', value: '2' },
        { label: 'Window', value: 'Last 90 days' },
      ],
      findings: [
        {
          heading: 'Emeka Obi',
          detail:
            'Loan of ₦120m called in 31 days ago. Buy-out clause in the partnership deed voids the debt on a partner’s death. Strong financial motive — but a motive is not a method.',
        },
        {
          heading: 'Mrs. Folake Bankole',
          detail: '₦400m life policy, named beneficiary, premiums current. No unusual recent activity on her accounts.',
        },
      ],
    },
  ],
  witnesses: [
    {
      id: 'w1',
      name: 'Dr. Ifeoma Nwosu',
      relation: 'Family physician · dinner guest',
      statement:
        '"Adewale toasted with the brandy at the table around 11pm and seemed perfectly well. He took a second glass into the study. He never drank with anyone watching after that."',
      reliability: 'reliable',
    },
    {
      id: 'w2',
      name: 'Sergeant Bello',
      relation: 'Gate security',
      statement:
        '"Tunde’s car left at 11:43. But the pedestrian side-gate by the generator house isn’t on the log — anyone on the compound could come and go on foot and I’d never see it."',
      reliability: 'reliable',
    },
    {
      id: 'w3',
      name: 'Aunty Comfort',
      relation: 'Neighbour',
      statement: '"I heard shouting near midnight. A man’s voice. Could have been the TV. I went back to sleep."',
      reliability: 'questionable',
    },
  ],
  transcripts: [
    {
      id: 't1',
      suspectId: 's4',
      title: 'Interview — Grace Aniekwe',
      lines: [
        { role: 'q', speaker: 'Det.', text: 'You carried the decanter to the study at 11:20. Did you pour the Chief’s glass?' },
        { role: 'a', speaker: 'Grace', text: 'I set the decanter down and left. He liked to pour his own. I swear I never touched his glass.' },
        { role: 'q', speaker: 'Det.', text: 'You were dismissed two weeks ago. Over money.' },
        { role: 'a', speaker: 'Grace', text: 'I did not take that money. Madam knows it. But yes — I was angry. Angry is not the same as this.' },
        { role: 'q', speaker: 'Det.', text: 'Do you know what oleander is?' },
        { role: 'a', speaker: 'Grace', text: 'The flower by the kitchen? It is poison, everyone in the house knows not to burn it. Why are you asking me this?' },
      ],
    },
    {
      id: 't2',
      suspectId: 's3',
      title: 'Interview — Emeka Obi',
      lines: [
        { role: 'q', speaker: 'Det.', text: 'You say you were on a call with Dubai until after midnight. Whose number?' },
        { role: 'a', speaker: 'Emeka', text: 'A supplier. I... I will have to find the contact. It was on WhatsApp, the call may not show.' },
        { role: 'q', speaker: 'Det.', text: 'The loan he called in. ₦120m. That clears on his death.' },
        { role: 'a', speaker: 'Emeka', text: 'You think I would kill my partner of thirty years over money? I built that company with him.' },
        { role: 'q', speaker: 'Det.', text: 'Were you in the study at any point that night?' },
        { role: 'a', speaker: 'Emeka', text: 'To say goodnight. Briefly. He was alive. He was pouring himself a drink. That is the truth.' },
      ],
    },
  ],
  timeline: [
    { time: '10:55', event: 'Chief toasts with brandy at the table — visibly well.', source: 'Dr. Nwosu' },
    { time: '11:15', event: 'Mrs. Bankole retires to the master bedroom.', source: 'Statement' },
    { time: '11:20', event: 'Grace carries the brandy decanter to the study, then leaves.', source: 'Statement' },
    { time: '11:30', event: 'Housekeeper brings Mrs. Bankole tea — confirms she is in her room.', source: 'Housekeeper' },
    { time: '11:43', event: 'Tunde’s car leaves through the main gate.', source: 'Gate log' },
    { time: '~11:50', event: 'Emeka says goodnight in the study; Chief is alive, pouring a drink.', source: 'Emeka (unverified)', conflict: true },
    { time: '~00:00', event: 'Neighbour hears a man shouting near midnight.', source: 'Aunty Comfort (questionable)' },
    { time: '00:10–00:50', event: 'Estimated time of death.', source: 'Autopsy' },
  ],
  tools: [
    {
      id: 'tool-id',
      name: 'Identity Lookup',
      tagline: 'Pull a person’s record from the national registry.',
      icon: 'identity',
      results: [
        {
          query: 'Emeka Obi',
          outcome: 'hit',
          rows: [
            { label: 'Full name', value: 'Emeka Chukwuemeka Obi' },
            { label: 'Known address', value: '8 Raymond Njoku, Ikoyi' },
            { label: 'Horticulture permit', value: 'Active — ornamental nursery, Epe' },
          ],
          note: 'A nursery permit. He grows ornamentals — oleander among them.',
        },
        {
          query: 'Grace Aniekwe',
          outcome: 'dead_end',
          rows: [{ label: 'Result', value: 'No record found' }],
          note: 'No criminal record, no flags. The cash accusation was never filed.',
        },
      ],
    },
    {
      id: 'tool-phone',
      name: 'Phone Records',
      tagline: 'Subscriber and SIM registration for a number.',
      icon: 'phone_records',
      results: [
        {
          query: '+234 803 419 6620 (Emeka)',
          outcome: 'partial',
          rows: [
            { label: 'Registered to', value: 'Emeka C. Obi' },
            { label: 'Last activity', value: '11:02pm — outgoing SMS' },
            { label: 'Dubai call', value: 'No international call after 9pm' },
          ],
          note: 'No Dubai call exists. His alibi has no record behind it.',
        },
      ],
    },
    {
      id: 'tool-calllog',
      name: 'Call Log',
      tagline: 'Inbound/outbound calls for a number on the night.',
      icon: 'call_log',
      results: [
        {
          query: 'Tunde Bankole — 11pm to 1am',
          outcome: 'hit',
          rows: [
            { label: '11:47pm', value: 'Outgoing → "Femi (lawyer)" · 6 min' },
            { label: '12:31am', value: 'Outgoing → "Femi (lawyer)" · 11 min' },
          ],
          note: 'Two calls to his lawyer about the will — AFTER he supposedly left. He was awake and anxious, not at the scene.',
        },
      ],
    },
    {
      id: 'tool-triangulation',
      name: 'Cell Triangulation',
      tagline: 'Approximate a handset’s location from tower pings.',
      icon: 'triangulation',
      results: [
        {
          query: 'Emeka Obi — 11pm to 1am',
          outcome: 'hit',
          rows: [
            { label: '11:00–11:40', value: 'Ikoyi · Glover Rd cell (the compound)' },
            { label: '11:55', value: 'Ikoyi · Glover Rd cell — still on-site' },
            { label: '00:35', value: 'Ikoyi · Glover Rd cell — left after est. time of death' },
          ],
          note: 'He never left. He was on the compound through the time of death — long after his "goodnight."',
        },
        {
          query: 'Tunde Bankole — 11pm to 1am',
          outcome: 'hit',
          rows: [
            { label: '11:50 onward', value: 'Lekki Phase 1 cell (his home)' },
          ],
          note: 'Tunde’s handset is in Lekki from 11:50. He really did go home.',
        },
      ],
    },
    {
      id: 'tool-crimedb',
      name: 'Crime Database',
      tagline: 'Prior records, known associates, open flags.',
      icon: 'crime_db',
      results: [
        {
          query: 'Whole household',
          outcome: 'dead_end',
          rows: [{ label: 'Result', value: 'No priors on any named party' }],
          note: 'Nobody here is a known offender. This crime was personal, not professional.',
        },
      ],
    },
  ],
  solutionSuspectId: 's3',
  keyEvidenceId: 'r2',
  explanation:
    'It was Emeka Obi. The poison was oleander — brewed, not bought — and the Identity Lookup puts an ornamental nursery permit in his name. Phone Records show the Dubai alibi never happened, and Cell Triangulation places his handset on the compound straight through the time of death, long after the "goodnight" he claimed was brief. He poured the dosed glass himself during that visit, wiped the decanter (gloved partial print), and let the Chief drink alone. Grace carried the decanter but never touched the glass; the poison was in the glass only. Tunde’s call log and triangulation prove he truly went home. The debt the Chief called in — ₦120m — died with him.',
};
