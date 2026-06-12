import { useState } from 'react';

import { Button, DrawerService, Input, Pill, Segmented } from '@gbedity/ui';
import { Check, Search } from '@icons';

import { ApiError } from '../../../shared/services/api-client.ts';
import {
  ReferenceSource,
  useReferenceWords,
  usePromoteDefinitions,
  usePromoteWords,
  type ReferenceRow,
} from '../api/word-bank-api.ts';

// Browse a reference collection (dictionary / allwords / words), multiselect rows, and promote them
// into the operational sets with a chosen rank + difficulty. Already-promoted rows are marked.

const SOURCE_OPTIONS = [
  { value: ReferenceSource.DICTIONARY, label: 'Dictionary' },
  { value: ReferenceSource.ALLWORDS, label: 'All words' },
  { value: ReferenceSource.WORDS, label: 'Words (names/cities)' },
];
const RANK_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));
const DIFF_OPTIONS = [1, 2, 3].map((n) => ({ value: n, label: String(n) }));

export function SourcesPanel() {
  const [source, setSource] = useState<ReferenceSource>(ReferenceSource.DICTIONARY);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rank, setRank] = useState(3);
  const [difficulty, setDifficulty] = useState(2);

  const list = useReferenceWords(source, { search, cursor });
  const promoteWords = usePromoteWords();
  const promoteDefs = usePromoteDefinitions();
  const rows = list.data?.data ?? [];

  function resetPaging() {
    setCursor(undefined);
    setCursorStack([]);
    setSelected(new Set());
  }
  function switchSource(next: ReferenceSource) {
    setSource(next);
    resetPaging();
  }
  function applySearch() {
    setSearch(searchInput.trim() === '' ? undefined : searchInput.trim().toLowerCase());
    resetPaging();
  }
  function toggle(word: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }
  function toggleAll() {
    setSelected((s) => (s.size === rows.length ? new Set() : new Set(rows.map((r) => r.word))));
  }

  function promote(target: 'words' | 'definitions') {
    const items = [...selected].map((word) => ({ word, rank, difficulty }));
    if (items.length === 0) return;
    const mutation = target === 'words' ? promoteWords : promoteDefs;
    mutation.mutate(
      { items, source, defaultRank: rank, defaultDifficulty: difficulty },
      {
        onSuccess: (res) => {
          setSelected(new Set());
          const missing = 'missingDefinition' in res && res.missingDefinition ? res.missingDefinition.length : 0;
          const note = missing > 0 ? ` (${missing} had no dictionary definition, skipped)` : '';
          DrawerService.toast(`Promoted ${res.upserted} to ${target === 'words' ? 'game words' : 'definitions'}${note}.`, { tone: missing > 0 ? 'warn' : 'success' });
        },
        onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not promote.', { tone: 'danger' }),
      },
    );
  }

  function nextPage() {
    const next = list.data?.nextCursor ?? null;
    if (next === null) return;
    setCursorStack((s) => [...s, cursor ?? '']);
    setCursor(next);
    setSelected(new Set());
  }
  function prevPage() {
    setCursorStack((s) => {
      const copy = [...s];
      const prev = copy.pop();
      setCursor(prev === undefined || prev === '' ? undefined : prev);
      return copy;
    });
    setSelected(new Set());
  }

  const canPromoteDefs = source === ReferenceSource.DICTIONARY;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Segmented value={source} onChange={(v) => switchSource(v as ReferenceSource)} ariaLabel="Source" options={SOURCE_OPTIONS} />
        <div className="min-w-[180px] flex-1">
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }} placeholder="Search by prefix…" />
        </div>
        <Button variant="secondary" leadingIcon={<Search size={15} aria-hidden="true" />} onClick={applySearch}>Search</Button>
      </div>

      {/* Promote bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-card border-2 border-mist-soft bg-canvas px-3 py-2">
        <span className="font-sans text-[13px] font-bold text-ink">{selected.size} selected</span>
        <div className="flex items-center gap-1">
          <span className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Rank</span>
          <Segmented value={rank} onChange={setRank} ariaLabel="Rank" options={RANK_OPTIONS} />
        </div>
        <div className="flex items-center gap-1">
          <span className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Difficulty</span>
          <Segmented value={difficulty} onChange={setDifficulty} ariaLabel="Difficulty" options={DIFF_OPTIONS} />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="primary" size="sm" disabled={selected.size === 0 || promoteWords.isPending} onClick={() => promote('words')}>
            → Game words
          </Button>
          <Button variant="secondary" size="sm" disabled={selected.size === 0 || !canPromoteDefs || promoteDefs.isPending} onClick={() => promote('definitions')}>
            → Definitions
          </Button>
        </div>
      </div>
      {!canPromoteDefs ? <p className="font-sans text-[11px] text-ink-3">Promote to definitions is only available from the Dictionary source (it carries definitions).</p> : null}

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-card border-2 border-mist-soft bg-surface">
        {list.isLoading ? (
          <p className="p-4 font-sans text-[14px] text-ink-3">Loading…</p>
        ) : list.isError ? (
          <p className="p-4 font-sans text-[14px] text-danger-deep">Couldn’t load words.</p>
        ) : rows.length === 0 ? (
          <p className="p-4 font-sans text-[14px] text-ink-3">No words found.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-canvas">
              <tr className="border-b-2 border-mist-soft">
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" aria-label="Select all" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} />
                </th>
                <th className="px-3 py-2 font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">Word</th>
                <th className="px-3 py-2 font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">Promoted</th>
                <th className="px-3 py-2 font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">{source === ReferenceSource.DICTIONARY ? 'Definition' : ''}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: ReferenceRow) => (
                <tr key={row.word} className="border-b border-ink-5 last:border-b-0 hover:bg-canvas">
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={`Select ${row.word}`} checked={selected.has(row.word)} onChange={() => toggle(row.word)} />
                  </td>
                  <td className="px-3 py-2 font-sans text-[14px] font-bold text-ink">{row.word}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {row.promotedAsWord ? <Pill tone="action"><Check size={11} aria-hidden="true" /> word</Pill> : null}
                      {row.promotedAsDefinition ? <Pill tone="info"><Check size={11} aria-hidden="true" /> def</Pill> : null}
                    </div>
                  </td>
                  <td className="max-w-0 px-3 py-2">
                    <span className="block truncate font-sans text-[12px] text-ink-3">{row.definition ?? ''}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" disabled={cursorStack.length === 0} onClick={prevPage}>Previous</Button>
          <Button variant="ghost" size="sm" disabled={!(list.data?.hasMore ?? false)} onClick={nextPage}>Next</Button>
        </div>
      ) : null}
    </div>
  );
}
