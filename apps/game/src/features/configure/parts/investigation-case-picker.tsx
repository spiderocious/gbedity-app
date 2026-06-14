import { useEffect, useState } from 'react';

import { Button, DrawerService, Pill, cn } from '@gbedity/ui';
import { Check, Dices, Search } from '@icons';

import { useInvestigationCases, type InvestigationCaseSummary } from '../../../shared/api/use-investigation-cases.ts';
import { configValues } from '../../../shared/games/config-values.ts';

// The Investigation case picker — a real modal listing the actual DB cases (grouped by difficulty,
// no spoilers) so the host can choose one, or leave it random. Writes the chosen `caseKey` to the
// config store ('' ⇒ random). Replaces the old fake 6-name dropdown.

const DIFFICULTY_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const DIFFICULTY_TONE: Record<number, 'action' | 'warn' | 'danger'> = { 1: 'action', 2: 'warn', 3: 'danger' };

const RANDOM = ''; // the sentinel caseKey for "surprise me"

export function InvestigationCasePicker() {
  const [selectedKey, setSelectedKey] = useState<string>(RANDOM);
  const [selectedTitle, setSelectedTitle] = useState<string>('Random case');

  // Seed the config store with the default (random) on mount.
  useEffect(() => {
    configValues.seed('caseKey', RANDOM);
  }, []);

  function choose(key: string, title: string): void {
    setSelectedKey(key);
    setSelectedTitle(title);
    configValues.set('caseKey', key);
    DrawerService.closeModal();
  }

  function openPicker(): void {
    DrawerService.openModal(<CasePickerBody selectedKey={selectedKey} onChoose={choose} />, { position: 'center' });
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" size="sm" leadingIcon={<Search size={15} aria-hidden="true" />} onClick={openPicker}>
        Choose case
      </Button>
      <span className="font-sans text-[13px] font-bold text-ink">{selectedTitle}</span>
    </div>
  );
}

function CasePickerBody({ selectedKey, onChoose }: { readonly selectedKey: string; readonly onChoose: (key: string, title: string) => void }) {
  const { data, isLoading, isError } = useInvestigationCases();

  return (
    <div className="flex max-h-[70vh] w-full max-w-md flex-col">
      <div className="mb-3">
        <h2 className="font-serif text-[22px] font-semibold text-ink">Choose a case</h2>
        <p className="font-sans text-[13px] text-ink-3">Pick a specific mystery, or leave it to chance.</p>
      </div>

      {/* Random option, always first */}
      <button
        type="button"
        onClick={() => onChoose(RANDOM, 'Random case')}
        className={cn(
          'mb-2 flex items-center gap-3 rounded-[14px] border-2 bg-surface px-4 py-3 text-left transition-colors',
          selectedKey === RANDOM ? 'border-action bg-action-soft' : 'border-ink-5 hover:border-action',
        )}
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-action">
          <Dices size={18} aria-hidden="true" />
        </span>
        <span className="flex-1">
          <span className="block font-sans text-[14px] font-bold text-ink">Surprise me</span>
          <span className="block font-sans text-[12px] text-ink-3">A random case each game.</span>
        </span>
        {selectedKey === RANDOM ? <Check size={18} aria-hidden="true" className="text-action" /> : null}
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <p role="status" className="px-1 py-6 text-center font-sans text-[14px] text-ink-3">Loading cases…</p>
        ) : isError || data === undefined ? (
          <p className="px-1 py-6 text-center font-sans text-[14px] text-ink-3">Couldn’t load cases. A random one will be used.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.map((c) => (
              <CaseRow key={c.key} c={c} selected={selectedKey === c.key} onChoose={onChoose} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CaseRow({ c, selected, onChoose }: { readonly c: InvestigationCaseSummary; readonly selected: boolean; readonly onChoose: (key: string, title: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onChoose(c.key, c.title)}
        className={cn(
          'flex w-full items-center gap-3 rounded-[14px] border-2 bg-surface px-4 py-3 text-left transition-colors',
          selected ? 'border-action bg-action-soft' : 'border-ink-5 hover:border-action',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-sans text-[14px] font-bold text-ink">{c.title}</span>
          <span className="block truncate font-sans text-[12px] text-ink-3">
            {c.category} · {c.suspectCount} suspects
          </span>
        </span>
        <Pill tone={DIFFICULTY_TONE[c.difficulty] ?? 'action'}>{DIFFICULTY_LABEL[c.difficulty] ?? 'Case'}</Pill>
        {selected ? <Check size={18} aria-hidden="true" className="flex-shrink-0 text-action" /> : null}
      </button>
    </li>
  );
}
