import { useState } from 'react';

import { Button, DrawerService, Input, Segmented } from '@gbedity/ui';
import { Search, Trash2 } from '@icons';

import { ApiError } from '../../../shared/services/api-client.ts';
import {
  useDeleteGameDefinition,
  useDeleteGameWord,
  useGameDefinitions,
  useGameWords,
  useUpdateGameDefinition,
  useUpdateGameWord,
  type GameDefinition,
  type GameWord,
} from '../api/word-bank-api.ts';

// Manage an operational collection: search, edit rank/difficulty inline (rank drives how often a
// word is picked at play time), and remove. `kind` switches between game_words and game_definitions.

const RANK_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));
const DIFF_OPTIONS = [1, 2, 3].map((n) => ({ value: n, label: String(n) }));

export function OperationalPanel({ kind }: { readonly kind: 'words' | 'definitions' }) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const wordsQuery = useGameWords({ search, cursor });
  const defsQuery = useGameDefinitions({ search, cursor });
  const updateWord = useUpdateGameWord();
  const updateDef = useUpdateGameDefinition();
  const deleteWord = useDeleteGameWord();
  const deleteDef = useDeleteGameDefinition();

  const list = kind === 'words' ? wordsQuery : defsQuery;
  const rows = (list.data?.data ?? []) as readonly (GameWord | GameDefinition)[];

  function applySearch() {
    setSearch(searchInput.trim() === '' ? undefined : searchInput.trim().toLowerCase());
    setCursor(undefined);
    setCursorStack([]);
  }

  function setRank(row: GameWord | GameDefinition, rank: number) {
    const m = kind === 'words' ? updateWord : updateDef;
    m.mutate({ id: row.id, patch: { rank } }, { onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not update.', { tone: 'danger' }) });
  }
  function setDifficulty(row: GameWord | GameDefinition, difficulty: number) {
    const m = kind === 'words' ? updateWord : updateDef;
    m.mutate({ id: row.id, patch: { difficulty } }, { onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not update.', { tone: 'danger' }) });
  }
  function remove(row: GameWord | GameDefinition) {
    DrawerService.confirm(`Remove “${row.word}” from the game ${kind === 'words' ? 'words' : 'definitions'}?`, {
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => {
        const m = kind === 'words' ? deleteWord : deleteDef;
        m.mutate(row.id, {
          onSuccess: () => DrawerService.toast('Removed.', { tone: 'success' }),
          onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not remove.', { tone: 'danger' }),
        });
      },
    });
  }

  function nextPage() {
    const next = list.data?.nextCursor ?? null;
    if (next === null) return;
    setCursorStack((s) => [...s, cursor ?? '']);
    setCursor(next);
  }
  function prevPage() {
    setCursorStack((s) => {
      const copy = [...s];
      const prev = copy.pop();
      setCursor(prev === undefined || prev === '' ? undefined : prev);
      return copy;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }} placeholder="Search by prefix…" />
        </div>
        <Button variant="secondary" leadingIcon={<Search size={15} aria-hidden="true" />} onClick={applySearch}>Search</Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-card border-2 border-mist-soft bg-surface">
        {list.isLoading ? (
          <p className="p-4 font-sans text-[14px] text-ink-3">Loading…</p>
        ) : list.isError ? (
          <p className="p-4 font-sans text-[14px] text-danger-deep">Couldn’t load.</p>
        ) : rows.length === 0 ? (
          <p className="p-4 font-sans text-[14px] text-ink-3">Nothing here yet. Promote words from Sources.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-canvas">
              <tr className="border-b-2 border-mist-soft">
                <th className="px-3 py-2 font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">Word</th>
                {kind === 'definitions' ? <th className="px-3 py-2 font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">Definition</th> : null}
                <th className="px-3 py-2 font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">Rank</th>
                <th className="px-3 py-2 font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">Difficulty</th>
                <th className="px-3 py-2 text-right font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">Remove</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-ink-5 last:border-b-0 hover:bg-canvas">
                  <td className="px-3 py-2 font-sans text-[14px] font-bold text-ink">{row.word}</td>
                  {kind === 'definitions' ? (
                    <td className="max-w-0 px-3 py-2"><span className="block truncate font-sans text-[12px] text-ink-3">{(row as GameDefinition).definition}</span></td>
                  ) : null}
                  <td className="px-3 py-2"><Segmented value={row.rank} onChange={(v) => setRank(row, v)} ariaLabel="Rank" options={RANK_OPTIONS} /></td>
                  <td className="px-3 py-2"><Segmented value={row.difficulty} onChange={(v) => setDifficulty(row, v)} ariaLabel="Difficulty" options={DIFF_OPTIONS} /></td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <button type="button" aria-label="Remove" onClick={() => remove(row)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-danger">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
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
