import { useState } from 'react';

import { Button, DrawerService } from '@gbedity/ui';
import { Eye, Pencil, Plus, Trash2 } from '@icons';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../../shared/services/api-client.ts';
import {
  useBulkCreateContent,
  useContentList,
  useCreateContent,
  useDeleteContent,
  useUpdateContent,
  type ContentDoc,
  type ContentKind,
} from './api/content-api.ts';
import { descriptorFor, KIND_DESCRIPTORS } from './schema/content-kinds.ts';
import { recordFromJson, recordLabel, type FormRecord } from './schema/content-values.ts';
import type { KindDescriptor } from './schema/field-types.ts';
import { ContentEditor } from './parts/content-editor.tsx';
import { ContentView } from './parts/content-view.tsx';

// Content authoring — schema-driven CRUD across all 11 kinds. The active kind is driven by a
// `?type=` query param (deep-linkable, one tab per kind). A sticky toolbar + tab bar stay put
// while a self-scrolling table holds the rows.

const FIRST_DESCRIPTOR = KIND_DESCRIPTORS[0] as KindDescriptor;
const VALID_KINDS = new Set<string>(KIND_DESCRIPTORS.map((d) => d.kind));

// Words feed several casual games — surfaced so authors know what they're populating.
const KIND_NOTE: Partial<Record<string, string>> = {
  word: 'Used by Missing Letters, Scrambled Word & Spelling Fast.',
};

function docLabelFor(desc: KindDescriptor, doc: ContentDoc): string {
  return recordLabel(desc, doc as unknown as FormRecord);
}

// A compact secondary column per kind (after the title) so the table is scannable.
function metaFor(desc: KindDescriptor, doc: ContentDoc): string {
  const r = doc as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.category === 'string') parts.push(r.category);
  if (typeof r.ratingTier === 'string') parts.push(r.ratingTier);
  if (Array.isArray(r.questions)) parts.push(`${r.questions.length} questions`);
  if (typeof r.difficulty === 'number') parts.push(`difficulty ${r.difficulty}`);
  if (typeof r.kind === 'string') parts.push(r.kind);
  void desc;
  return parts.join(' · ');
}

export function ContentScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get('type');
  const kind: ContentKind = (typeParam !== null && VALID_KINDS.has(typeParam) ? typeParam : FIRST_DESCRIPTOR.kind) as ContentKind;

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const desc = descriptorFor(kind) ?? FIRST_DESCRIPTOR;
  const list = useContentList(kind, cursor);
  const create = useCreateContent(kind);
  const update = useUpdateContent(kind);
  const bulk = useBulkCreateContent(kind);
  const remove = useDeleteContent(kind);

  function switchKind(next: ContentKind) {
    setSearchParams({ type: next });
    setCursor(undefined);
    setCursorStack([]);
  }

  function openCreate() {
    DrawerService.openModal(
      <ContentEditor desc={desc} onCreate={(payload) => create.mutateAsync(payload)} onBulk={(payloads) => bulk.mutateAsync(payloads)} />,
      { position: 'center' },
    );
  }

  function openEdit(doc: ContentDoc) {
    const id = typeof doc.id === 'string' ? doc.id : undefined;
    if (id === undefined) return;
    DrawerService.openModal(
      <ContentEditor desc={desc} editId={id} initial={recordFromJson(desc, doc)} onUpdate={(payload) => update.mutateAsync({ id, patch: payload })} />,
      { position: 'center' },
    );
  }

  function openView(doc: ContentDoc) {
    DrawerService.openModal(
      <ContentView desc={desc} record={recordFromJson(desc, doc)} onEdit={() => { DrawerService.closeModal(); openEdit(doc); }} />,
      { position: 'center' },
    );
  }

  function confirmDelete(doc: ContentDoc) {
    const id = typeof doc.id === 'string' ? doc.id : undefined;
    if (id === undefined) return;
    DrawerService.confirm(`Delete “${docLabelFor(desc, doc)}”?`, {
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () =>
        remove.mutate(id, {
          onSuccess: () => DrawerService.toast('Deleted.', { tone: 'success' }),
          onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not delete.', { tone: 'danger' }),
        }),
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

  const items = list.data?.data ?? [];
  const note = KIND_NOTE[kind];

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-[75%] flex-col gap-4">
      {/* Sticky header: title + create */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">Content</h1>
        <Button variant="primary" leadingIcon={<Plus size={15} aria-hidden="true" />} onClick={openCreate}>
          New {desc.label.toLowerCase().replace(/s$/, '')}
        </Button>
      </div>

      {/* Sticky tab bar (kinds) */}
      <div className="flex flex-wrap gap-2">
        {KIND_DESCRIPTORS.map((d) => (
          <button
            key={d.kind}
            type="button"
            onClick={() => switchKind(d.kind)}
            className={`rounded-full px-3 py-[6px] font-sans text-[12px] font-bold ${
              d.kind === kind ? 'bg-action-soft text-action-deep' : 'bg-surface text-ink-3 hover:bg-canvas hover:text-ink'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {note !== undefined ? <p className="font-sans text-[12px] text-ink-3">{note}</p> : null}

      {/* Self-scrolling table region */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-card border-2 border-mist-soft bg-surface">
        {list.isLoading ? (
          <p className="p-4 font-sans text-[14px] text-ink-3">Loading…</p>
        ) : list.isError ? (
          <p className="p-4 font-sans text-[14px] text-danger-deep">Couldn’t load content.</p>
        ) : items.length === 0 ? (
          <p className="p-4 font-sans text-[14px] text-ink-3">No {desc.label.toLowerCase()} yet.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-canvas">
              <tr className="border-b-2 border-mist-soft">
                <th className="px-4 py-2 font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">Item</th>
                <th className="px-4 py-2 font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">Details</th>
                <th className="px-4 py-2 text-right font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((doc, i) => (
                <tr key={typeof doc.id === 'string' ? doc.id : String(i)} className="border-b border-ink-5 last:border-b-0 hover:bg-canvas">
                  <td className="max-w-0 px-4 py-2">
                    <button type="button" onClick={() => openView(doc)} className="block max-w-full truncate text-left font-sans text-[14px] font-bold text-ink hover:text-action-deep">
                      {docLabelFor(desc, doc)}
                    </button>
                  </td>
                  <td className="px-4 py-2 font-sans text-[12px] text-ink-3">{metaFor(desc, doc)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" aria-label="View" onClick={() => openView(doc)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-ink">
                        <Eye size={16} aria-hidden="true" />
                      </button>
                      <button type="button" aria-label="Edit" onClick={() => openEdit(doc)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-ink">
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button type="button" aria-label="Delete" onClick={() => confirmDelete(doc)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-danger">
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

      {/* Footer pager (stays below the scroll region) */}
      {items.length > 0 ? (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" disabled={cursorStack.length === 0} onClick={prevPage}>Previous</Button>
          <Button variant="ghost" size="sm" disabled={!(list.data?.hasMore ?? false)} onClick={nextPage}>Next</Button>
        </div>
      ) : null}
    </div>
  );
}
