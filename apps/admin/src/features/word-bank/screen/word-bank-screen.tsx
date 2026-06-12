import { useState } from 'react';

import { SourcesPanel } from '../parts/sources-panel.tsx';
import { OperationalPanel } from '../parts/operational-panel.tsx';

// Word bank — curate the operational word/definition sets the live word games draw from. Two areas:
// Sources (browse the reference collections + promote) and Operational (manage game_words /
// game_definitions: rank, difficulty, remove). Rank drives how often a word is picked at play time.

const TAB = { SOURCES: 'sources', WORDS: 'words', DEFINITIONS: 'definitions' } as const;
type Tab = (typeof TAB)[keyof typeof TAB];

const TABS: readonly { value: Tab; label: string }[] = [
  { value: TAB.SOURCES, label: 'Sources' },
  { value: TAB.WORDS, label: 'Game words' },
  { value: TAB.DEFINITIONS, label: 'Game definitions' },
];

export function WordBankScreen() {
  const [tab, setTab] = useState<Tab>(TAB.SOURCES);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4">
      <div>
        <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">Word bank</h1>
        <p className="font-sans text-[14px] text-ink-3">Curate the words & definitions the live games use. Higher-ranked words appear more often.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-full px-3 py-[6px] font-sans text-[12px] font-bold ${
              t.value === tab ? 'bg-action-soft text-action-deep' : 'bg-surface text-ink-3 hover:bg-canvas hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === TAB.SOURCES ? <SourcesPanel /> : tab === TAB.WORDS ? <OperationalPanel kind="words" /> : <OperationalPanel kind="definitions" />}
    </div>
  );
}
