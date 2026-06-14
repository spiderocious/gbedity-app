import type { MockCase } from './preview/mock-case.ts';

// Maps a live (answer-less) case — from the solo REST API or the MP view patch — into the MockCase
// shape the preview screens/atoms were designed against. Their field names differ slightly from the
// backend's (alibiHolds↔alibiStatus, report.fields↔report.header); reconcile here, at the boundary.
// Loose input (`unknown[]`) so it works for both the typed solo InvCase and the permissive MP patch.

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown, f: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : f);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});

const ALIBI = ['confirmed', 'shaky', 'broken', 'unchecked'] as const;
const asAlibi = (v: string): MockCase['suspects'][number]['alibiHolds'] => ((ALIBI as readonly string[]).includes(v) ? (v as MockCase['suspects'][number]['alibiHolds']) : 'unchecked');
const REPORT_KINDS = ['autopsy', 'forensic', 'financial', 'digital'] as const;
const asKind = (v: string): MockCase['reports'][number]['kind'] => ((REPORT_KINDS as readonly string[]).includes(v) ? (v as MockCase['reports'][number]['kind']) : 'forensic');
const TOOL_ICONS = ['identity', 'phone_records', 'call_log', 'triangulation', 'crime_db'] as const;
const asIcon = (v: string): MockCase['tools'][number]['icon'] => ((TOOL_ICONS as readonly string[]).includes(v) ? (v as MockCase['tools'][number]['icon']) : 'identity');
const OUTCOMES = ['hit', 'partial', 'dead_end'] as const;
const asOutcome = (v: string): MockCase['tools'][number]['results'][number]['outcome'] => ((OUTCOMES as readonly string[]).includes(v) ? (v as MockCase['tools'][number]['results'][number]['outcome']) : 'dead_end');
const RELIABILITY = ['reliable', 'questionable', 'hostile'] as const;
const asReliability = (v: string): MockCase['witnesses'][number]['reliability'] => ((RELIABILITY as readonly string[]).includes(v) ? (v as MockCase['witnesses'][number]['reliability']) : 'reliable');

interface CaseInput {
  title?: unknown;
  category?: unknown;
  brief?: unknown;
  suspects?: unknown;
  reports?: unknown;
  witnesses?: unknown;
  transcripts?: unknown;
  timeline?: unknown;
  tools?: unknown;
}

interface Answer {
  solutionSuspectId: string;
  keyEvidenceId: string;
  explanation: string;
}

const kvRows = (v: unknown): { label: string; value: string }[] => arr(v).map(rec).map((r) => ({ label: str(r.label), value: str(r.value) }));

export function toMockCase(c: CaseInput, answer?: Answer): MockCase {
  return {
    key: 'live',
    title: str(c.title) || 'Investigation',
    category: str(c.category) || 'Investigation',
    difficulty: 2,
    brief: str(c.brief),
    suspects: arr(c.suspects).map(rec).map((s) => ({
      id: str(s.id),
      name: str(s.name),
      age: num(s.age, 0),
      role: str(s.role),
      motive: str(s.motive),
      alibi: str(s.alibi),
      alibiHolds: asAlibi(str(s.alibiStatus)),
      phone: str(s.phone),
      note: str(s.note),
    })),
    reports: arr(c.reports).map(rec).map((r) => ({
      id: str(r.id),
      kind: asKind(str(r.kind)),
      title: str(r.title),
      subtitle: str(r.subtitle),
      fields: kvRows(r.header),
      findings: arr(r.findings).map(rec).map((f) => ({ heading: str(f.heading), detail: str(f.detail), ...(str(f.flag) === 'key' || str(f.flag) === 'herring' ? { flag: str(f.flag) as 'key' | 'herring' } : {}) })),
    })),
    witnesses: arr(c.witnesses).map(rec).map((w) => ({ id: str(w.id), name: str(w.name), relation: str(w.relation), statement: str(w.statement), reliability: asReliability(str(w.reliability)) })),
    transcripts: arr(c.transcripts).map(rec).map((t) => ({ id: str(t.id), suspectId: str(t.suspectId), title: str(t.title), lines: arr(t.lines).map(rec).map((l) => ({ speaker: str(l.speaker), role: str(l.role) === 'a' ? ('a' as const) : ('q' as const), text: str(l.text) })) })),
    timeline: arr(c.timeline).map(rec).map((e) => ({ time: str(e.time), event: str(e.event), source: str(e.source), conflict: e.conflict === true })),
    tools: arr(c.tools).map(rec).map((t) => ({
      id: str(t.id),
      name: str(t.name),
      tagline: str(t.tagline),
      icon: asIcon(str(t.icon)),
      results: arr(t.results).map(rec).map((res) => ({ query: str(res.query), outcome: asOutcome(str(res.outcome)), rows: kvRows(res.rows), note: str(res.note) })),
    })),
    solutionSuspectId: answer?.solutionSuspectId ?? '',
    keyEvidenceId: answer?.keyEvidenceId ?? '',
    explanation: answer?.explanation ?? '',
  };
}
