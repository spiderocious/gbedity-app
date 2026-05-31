import { useState } from 'react';

import { Button, Card, DrawerService, Segmented } from '@gbedity/ui';
import { Trash2 } from '@icons';

import {
  ContentKind,
  useContentList,
  useCreateContent,
  useDeleteContent,
  type ContentDoc,
} from '../../shared/api/admin-api.ts';
import { ApiError } from '../../shared/services/api-client.ts';

// Content authoring — full CRUD per kind (api-docs §Content). A kind switcher, a list with
// delete, and a paste-JSON create sheet (the docs define each doc shape).
const KIND_LABEL: Record<ContentKind, string> = {
  quiz_deck: 'Quiz decks',
  word: 'Words',
  hot_take_prompt: 'Hot-take prompts',
  plead_scenario: 'Plead scenarios',
};

const KIND_HINT: Record<ContentKind, string> = {
  quiz_deck: '{ "key": "...", "title": "...", "category": "...", "ratingTier": "...", "questions": [{ "prompt": "...", "options": ["a","b","c","d"], "answerIdx": 0, "difficulty": 1 }] }',
  word: '{ "word": "...", "category": "...", "startsWith": "a", "difficulty": 1, "aliases": [], "ratingTier": "...", "tags": [] }',
  hot_take_prompt: '{ "prompt": "...", "ratingTier": "...", "tags": [] }',
  plead_scenario: '{ "key": "...", "charge": "...", "defendant": "...", "facts": "...", "laws": "...", "precedents": "...", "ratingTier": "...", "tags": [], "difficulty": 1 }',
};

const KINDS = Object.values(ContentKind);

function docLabel(doc: ContentDoc): string {
  const v = doc.title ?? doc.word ?? doc.prompt ?? doc.charge ?? doc.key ?? doc.id;
  return typeof v === 'string' ? v : 'item';
}

export function ContentScreen() {
  const [kind, setKind] = useState<ContentKind>(ContentKind.QUIZ_DECK);
  const list = useContentList(kind);
  const create = useCreateContent(kind);
  const remove = useDeleteContent(kind);

  function openCreate() {
    let raw = '';
    DrawerService.openModal(
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-[22px] font-semibold text-ink">New {KIND_LABEL[kind].toLowerCase()}</h2>
        <p className="font-mono text-[11px] leading-[1.5] text-ink-3">{KIND_HINT[kind]}</p>
        <textarea
          rows={8}
          defaultValue=""
          onChange={(e) => { raw = e.target.value; }}
          placeholder="Paste the content JSON…"
          className="rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-mono text-[13px] text-ink focus:border-action focus:outline-none"
        />
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              let doc: ContentDoc;
              try {
                doc = JSON.parse(raw) as ContentDoc;
              } catch {
                DrawerService.toast('That isn’t valid JSON.', { tone: 'danger' });
                return;
              }
              create.mutate(doc, {
                onSuccess: () => { DrawerService.closeModal(); DrawerService.toast('Saved.', { tone: 'success' }); },
                onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not save.', { tone: 'danger' }),
              });
            }}
          >
            Create
          </Button>
          <Button variant="ghost" onClick={() => DrawerService.closeModal()}>Cancel</Button>
        </div>
      </div>,
      { position: 'bottom' },
    );
  }

  function confirmDelete(doc: ContentDoc) {
    const id = typeof doc.id === 'string' ? doc.id : undefined;
    if (id === undefined) return;
    DrawerService.confirm(`Delete “${docLabel(doc)}”?`, {
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => remove.mutate(id, { onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not delete.', { tone: 'danger' }) }),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">Content</h1>
        <Button variant="primary" onClick={openCreate}>New {KIND_LABEL[kind].toLowerCase().replace(/s$/, '')}</Button>
      </div>

      <Segmented
        value={kind}
        onChange={(k) => setKind(k as ContentKind)}
        ariaLabel="Content kind"
        options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
      />

      {list.isLoading ? (
        <p className="font-sans text-[14px] text-ink-3">Loading…</p>
      ) : list.isError ? (
        <p className="font-sans text-[14px] text-danger-deep">Couldn’t load content.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {(list.data ?? []).map((doc, i) => (
            <Card key={(typeof doc.id === 'string' ? doc.id : String(i))} size="sm" className="flex items-center justify-between">
              <span className="font-sans text-[14px] font-bold text-ink">{docLabel(doc)}</span>
              <button type="button" aria-label="Delete" onClick={() => confirmDelete(doc)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-canvas hover:text-danger">
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </Card>
          ))}
          {(list.data?.length ?? 0) === 0 ? (
            <p className="font-sans text-[14px] text-ink-3">No {KIND_LABEL[kind].toLowerCase()} yet.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
