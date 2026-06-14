import { z } from 'zod';

import { apiClient } from '../../../../../shared/services/api-client.ts';

// REST client for client-driven solo Investigation (/api/v1/solo/investigation). The CLIENT paces the
// case: start → (explore the file) → accuse. Responses Zod-parsed at the boundary. The case served by
// /start has the solution withheld; /accuse returns the verdict + the revealed answer.

const BASE = '/solo/investigation';

// The case shape we render. Permissive — content authored in the DB; we validate structure loosely so
// a sparse case still renders. Mirrors the preview MockCase (minus the answer fields).
const Suspect = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().default(0),
  role: z.string().default(''),
  motive: z.string().default(''),
  alibi: z.string().default(''),
  alibiStatus: z.string().default('unchecked'),
  phone: z.string().default(''),
  note: z.string().default(''),
});
const ReportField = z.object({ label: z.string(), value: z.string() });
const Finding = z.object({ heading: z.string(), detail: z.string(), flag: z.string().default('none') });
const Report = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  subtitle: z.string().default(''),
  header: z.array(ReportField).default([]),
  findings: z.array(Finding).default([]),
});
const Witness = z.object({ id: z.string(), name: z.string(), relation: z.string().default(''), statement: z.string().default(''), reliability: z.string().default('reliable') });
const TranscriptLine = z.object({ speaker: z.string(), role: z.string(), text: z.string() });
const Transcript = z.object({ id: z.string(), suspectId: z.string().default(''), title: z.string(), lines: z.array(TranscriptLine).default([]) });
const TimelineEvent = z.object({ time: z.string(), event: z.string(), source: z.string().default(''), conflict: z.boolean().default(false) });
const LookupRow = z.object({ label: z.string(), value: z.string() });
const LookupResult = z.object({ query: z.string(), outcome: z.string(), rows: z.array(LookupRow).default([]), note: z.string().default('') });
const Tool = z.object({ id: z.string(), name: z.string(), tagline: z.string().default(''), icon: z.string(), results: z.array(LookupResult).default([]) });

export const InvCase = z.object({
  title: z.string(),
  category: z.string().default('Investigation'),
  brief: z.string().default(''),
  suspects: z.array(Suspect).default([]),
  reports: z.array(Report).default([]),
  witnesses: z.array(Witness).default([]),
  transcripts: z.array(Transcript).default([]),
  timeline: z.array(TimelineEvent).default([]),
  tools: z.array(Tool).default([]),
});
export type InvCase = z.infer<typeof InvCase>;

export const InvStartResult = z.object({ soloId: z.string(), investigateSeconds: z.number(), theCase: InvCase });
export type InvStartResult = z.infer<typeof InvStartResult>;

export const InvAccuseResult = z.object({
  correct: z.boolean(),
  correctEvidence: z.boolean(),
  points: z.number(),
  solutionSuspectId: z.string(),
  keyEvidenceId: z.string(),
  explanation: z.string(),
});
export type InvAccuseResult = z.infer<typeof InvAccuseResult>;

export const invSoloApi = {
  async start(config?: Record<string, unknown>): Promise<InvStartResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/start`, config ? { config } : {});
    return InvStartResult.parse(raw);
  },
  async accuse(args: { soloId: string; suspectId: string; evidenceId: string; confidence: string; elapsedMs: number }): Promise<InvAccuseResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/accuse`, args);
    return InvAccuseResult.parse(raw);
  },
};
