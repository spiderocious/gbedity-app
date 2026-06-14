import { useRef, useState, type ReactNode } from 'react';

import { Button, GameAvatar, cn } from '@gbedity/ui';
import { Clock, Database, FileText, Gavel, ScrollText, Users } from '@icons';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { EASE_SPRING, prefersReducedMotion } from '../ui/motion.ts';
import { Accordion, AccordionItem } from '../ui/accordion.tsx';
import { REPORT_KIND_META, ReportBody } from '../ui/report-card.tsx';
import { ALIBI_META, SuspectBody } from '../ui/suspect-card.tsx';
import { TranscriptBody } from '../ui/transcript-reader.tsx';
import { TimelineRail } from '../ui/timeline-rail.tsx';
import { RELIABILITY_META, WitnessBody } from '../ui/witness-card.tsx';
import { TOOL_ICON, ToolBody } from '../ui/tool-app.tsx';
import type { MockCase } from '../preview/mock-case.ts';

// INVESTIGATE — the working detective desk. A sticky header (case + countdown + "Make accusation"),
// a tab bar across the case-file sections, then each section as an ACCORDION: every record collapses
// to a one-line summary and expands on tap, so the workspace stays browsable rather than a wall of
// text. Pure UI — all state is props except the active tab + accordion open state.

const Tab = {
  SUSPECTS: 'Suspects',
  EVIDENCE: 'Evidence',
  WITNESSES: 'Witnesses',
  TRANSCRIPTS: 'Transcripts',
  TIMELINE: 'Timeline',
  TOOLS: 'Tools',
} as const;
type Tab = (typeof Tab)[keyof typeof Tab];

const TABS: readonly { id: Tab; icon: typeof Users }[] = [
  { id: Tab.SUSPECTS, icon: Users },
  { id: Tab.EVIDENCE, icon: FileText },
  { id: Tab.WITNESSES, icon: Gavel },
  { id: Tab.TRANSCRIPTS, icon: ScrollText },
  { id: Tab.TIMELINE, icon: Clock },
  { id: Tab.TOOLS, icon: Database },
];

const chip = (label: string, cls: string): ReactNode => (
  <span className={cn('rounded-full px-2.5 py-1 font-sans text-[10px] font-extrabold uppercase tracking-[0.08em]', cls)}>{label}</span>
);

interface InvestigateScreenProps {
  readonly theCase: MockCase;
  readonly secondsLeft: number;
  readonly investigateSeconds: number;
  readonly onAccuse: () => void;
  readonly readOnly?: boolean;
}

function formatClock(s: number): string {
  const m = Math.floor(Math.max(0, s) / 60);
  const sec = Math.floor(Math.max(0, s) % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function InvestigateScreen({ theCase, secondsLeft, investigateSeconds, onAccuse, readOnly }: InvestigateScreenProps) {
  const [tab, setTab] = useState<Tab>(Tab.SUSPECTS);
  const panel = useRef<HTMLDivElement>(null);
  const progress = investigateSeconds > 0 ? secondsLeft / investigateSeconds : 0;
  const low = progress <= 0.15;

  // The workspace is a SLIDE like every other screen: an inset green poster panel that bounces in.
  // It owns its own internal scroll so the sticky header/tab bar stay pinned to the slide.
  useGSAP(
    () => {
      const el = panel.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(el, { opacity: 0, scale: 0.92, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: EASE_SPRING });
    },
    { dependencies: [] },
  );

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas p-4 sm:p-8">
      <div
        ref={panel}
        className="relative h-fit w-full max-w-3xl flex-col overflow-hidden rounded-[32px] bg-action shadow-[0_24px_64px_rgba(31,107,74,0.18)]"
      >
        {/* Sticky header — tinted to sit on the green slide */}
        <header className="z-20 flex-shrink-0 border-b border-surface/15 bg-action px-5 pb-2 pt-4">
          <div className="flex items-start md:items-center justify-between gap-3 flex-col md:flex-row">
            <div className="min-w-0">
              <p className="font-sans text-[10px] font-extrabold uppercase tracking-[0.14em] text-surface/80">{theCase.category}</p>
              <h1 className="truncate font-serif text-[20px] font-semibold text-surface">{theCase.title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[15px] font-extrabold tabular-nums',
                  low ? 'bg-danger text-surface' : 'bg-surface text-ink',
                )}
              >
                <Clock size={14} aria-hidden="true" />
                {formatClock(secondsLeft)}
              </span>
              {!readOnly ? (
                <Button variant="secondary" size="sm" onClick={onAccuse}>
                  Make accusation
                </Button>
              ) : null}
            </div>
          </div>

          {/* Tab bar */}
          <div className="mt-2 flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 font-sans text-[13px] font-bold transition-colors',
                    active ? 'bg-surface text-ink' : 'text-surface hover:bg-surface/25',
                  )}
                >
                  <Icon size={14} aria-hidden="true" />
                  {t.id}
                </button>
              );
            })}
          </div>
        </header>

        {/* Content — accordions per section, scrolling inside the slide */}
        <main className="flex-1 overflow-y-auto px-5 py-5">
        {tab === Tab.SUSPECTS ? (
          <Accordion>
            {theCase.suspects.map((s, i) => {
              const alibi = ALIBI_META[s.alibiHolds];
              return (
                <AccordionItem
                  key={s.id}
                  defaultOpen={i === 0}
                  icon={<GameAvatar id={s.id + s.name} size="md" />}
                  title={s.name}
                  subtitle={`${s.age} · ${s.role}`}
                  trailing={chip(alibi.label, alibi.cls)}
                >
                  <SuspectBody suspect={s} />
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : tab === Tab.EVIDENCE ? (
          <Accordion>
            {theCase.reports.map((r, i) => {
              const meta = REPORT_KIND_META[r.kind];
              const Icon = meta.icon;
              return (
                <AccordionItem
                  key={r.id}
                  defaultOpen={i === 0}
                  icon={
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-ink text-surface">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                  }
                  title={r.title}
                  subtitle={r.subtitle}
                  trailing={chip(meta.label, 'bg-ink text-surface')}
                >
                  <ReportBody report={r} />
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : tab === Tab.WITNESSES ? (
          <Accordion>
            {theCase.witnesses.map((w) => {
              const r = RELIABILITY_META[w.reliability];
              return (
                <AccordionItem key={w.id} title={w.name} subtitle={w.relation} trailing={chip(r.label, r.cls)}>
                  <WitnessBody witness={w} />
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : tab === Tab.TRANSCRIPTS ? (
          <Accordion>
            {theCase.transcripts.map((t) => {
              const who = theCase.suspects.find((s) => s.id === t.suspectId);
              return (
                <AccordionItem
                  key={t.id}
                  icon={<ScrollText size={18} aria-hidden="true" className="text-ink-3" />}
                  title={t.title}
                  subtitle={who ? `${t.lines.length} exchanges · ${who.role}` : `${t.lines.length} exchanges`}
                >
                  <TranscriptBody transcript={t} />
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : tab === Tab.TIMELINE ? (
          <div className="rounded-[20px] border border-ink-5 bg-surface px-5 py-6">
            <TimelineRail events={theCase.timeline} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="font-sans text-[13px] leading-[1.5] text-surface/90">
              Run the tools on a name or number. Not every search lands — a dead end is a clue too.
            </p>
            <Accordion>
              {theCase.tools.map((tool) => {
                const Icon = TOOL_ICON[tool.icon];
                return (
                  <AccordionItem
                    key={tool.id}
                    icon={
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-stage text-surface">
                        <Icon size={16} aria-hidden="true" />
                      </span>
                    }
                    title={tool.name}
                    subtitle={`${tool.results.length} ${tool.results.length === 1 ? 'query' : 'queries'}`}
                  >
                    <ToolBody tool={tool} />
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
        </main>
      </div>
    </div>
  );
}
