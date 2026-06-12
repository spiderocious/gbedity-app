import { useState } from 'react';

import { Button, DrawerService } from '@gbedity/ui';
import { Check, ChevronDown, ChevronUp, Code, Copy, Sparkles, Trash2 } from '@icons';

import { ApiError } from '../../../shared/services/api-client.ts';
import type { KindDescriptor } from '../schema/field-types.ts';
import { buildPrompt, sampleArrayText, sampleJsonText } from '../schema/schema-template.ts';
import {
  emptyRecord,
  recordFromJson,
  recordLabel,
  recordToPayload,
  validateRecord,
  type FieldErrors,
  type FormRecord,
} from '../schema/content-values.ts';
import { ContentRecordForm } from './content-record-form.tsx';
import type { BulkResult } from '../api/content-api.ts';

// The content authoring sheet. Two modes:
//  • Single — create or edit ONE record via the typed form.
//  • Multi  — review N records (from a pasted JSON array, or added by hand) and bulk-save.
// Either mode also supports "Paste JSON": an object prefills the current form; an array switches
// to multi-mode and prefills N forms for review. The user always reviews in typed inputs, then saves.

type Mode = 'single' | 'multi';

interface DraftRecord {
  readonly id: string; // stable local key
  readonly record: FormRecord;
  readonly errors: FieldErrors;
}

interface ContentEditorProps {
  readonly desc: KindDescriptor;
  // edit: prefill from an existing doc + PATCH on save. create: blank single form.
  readonly initial?: FormRecord;
  readonly editId?: string;
  readonly onCreate?: (payload: Record<string, unknown>) => Promise<unknown>;
  readonly onUpdate?: (payload: Record<string, unknown>) => Promise<unknown>;
  readonly onBulk?: (payloads: readonly Record<string, unknown>[]) => Promise<BulkResult>;
}

let draftSeq = 0;
const nextId = () => `draft-${(draftSeq += 1)}`;

function makeDraft(record: FormRecord): DraftRecord {
  return { id: nextId(), record, errors: {} };
}

export function ContentEditor({ desc, initial, editId, onCreate, onUpdate, onBulk }: ContentEditorProps) {
  const isEdit = editId !== undefined;
  const [mode, setMode] = useState<Mode>('single');
  const [drafts, setDrafts] = useState<DraftRecord[]>([makeDraft(initial ?? emptyRecord(desc))]);
  const [openIdx, setOpenIdx] = useState(0);
  const [pending, setPending] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteRaw, setPasteRaw] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [copied, setCopied] = useState<'prompt' | 'json' | null>(null);

  function copy(what: 'prompt' | 'json') {
    const text = what === 'prompt' ? buildPrompt(desc) : sampleArrayText(desc);
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1500);
    });
  }

  function updateDraft(idx: number, record: FormRecord) {
    setDrafts((ds) => ds.map((d, i) => (i === idx ? { ...d, record, errors: {} } : d)));
  }

  function removeDraft(idx: number) {
    setDrafts((ds) => (ds.length <= 1 ? ds : ds.filter((_, i) => i !== idx)));
  }

  function addBlank() {
    setDrafts((ds) => [...ds, makeDraft(emptyRecord(desc))]);
    setMode('multi');
    setOpenIdx(drafts.length);
  }

  // Parse + prefill. Object → fill current/first form. Array → multi-mode with one form per item.
  function applyPaste() {
    setPasteError('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(pasteRaw);
    } catch {
      setPasteError('That isn’t valid JSON.');
      return;
    }
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        setPasteError('The array is empty.');
        return;
      }
      setDrafts(parsed.map((item) => makeDraft(recordFromJson(desc, item))));
      setMode('multi');
      setOpenIdx(0);
    } else {
      setDrafts([makeDraft(recordFromJson(desc, parsed))]);
      setMode('single');
      setOpenIdx(0);
    }
    setShowPaste(false);
    setPasteRaw('');
  }

  // Validate all drafts; returns the payloads if every draft is valid, else marks errors + null.
  function validateAll(): Record<string, unknown>[] | null {
    let ok = true;
    const payloads: Record<string, unknown>[] = [];
    setDrafts((ds) =>
      ds.map((d, i) => {
        const errors = validateRecord(desc, d.record);
        if (Object.keys(errors).length > 0) {
          ok = false;
          if (openIdx !== i && ds.length > 1) setOpenIdx(i);
        } else {
          payloads.push(recordToPayload(desc, d.record));
        }
        return { ...d, errors };
      }),
    );
    return ok ? payloads : null;
  }

  function save() {
    const payloads = validateAll();
    if (payloads === null) {
      DrawerService.toast('Fix the highlighted fields.', { tone: 'danger' });
      return;
    }
    setPending(true);

    const done = () => setPending(false);

    if (isEdit && onUpdate) {
      void onUpdate(payloads[0] as Record<string, unknown>)
        .then(() => {
          DrawerService.closeModal();
          DrawerService.toast('Saved.', { tone: 'success' });
        })
        .catch((e: unknown) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not save.', { tone: 'danger' }))
        .finally(done);
      return;
    }

    if (mode === 'multi' && onBulk) {
      void onBulk(payloads)
        .then((res) => {
          DrawerService.closeModal();
          if (res.failed > 0) DrawerService.toast(`Saved ${res.inserted}, ${res.failed} failed.`, { tone: 'warn' });
          else DrawerService.toast(`Saved ${res.inserted}.`, { tone: 'success' });
        })
        .catch((e: unknown) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not save.', { tone: 'danger' }))
        .finally(done);
      return;
    }

    if (onCreate) {
      void onCreate(payloads[0] as Record<string, unknown>)
        .then(() => {
          DrawerService.closeModal();
          DrawerService.toast('Saved.', { tone: 'success' });
        })
        .catch((e: unknown) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not save.', { tone: 'danger' }))
        .finally(done);
    }
  }

  const title = isEdit ? `Edit ${desc.label.toLowerCase().replace(/s$/, '')}` : `New ${desc.label.toLowerCase().replace(/s$/, '')}`;
  const saveLabel = isEdit ? 'Save' : mode === 'multi' ? `Save ${drafts.length}` : 'Create';

  return (
    <div className="flex max-h-[82vh] w-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-[22px] font-semibold text-ink">{title}</h2>
        {!isEdit ? (
          <Button variant="ghost" size="sm" leadingIcon={<Code size={14} aria-hidden="true" />} onClick={() => setShowPaste((s) => !s)}>
            Paste JSON
          </Button>
        ) : null}
      </div>

      {showPaste ? (
        <div className="flex flex-col gap-3 rounded-card border-2 border-mist-soft bg-canvas p-3">
          <div>
            <p className="font-sans text-[13px] font-bold text-ink">{desc.label}</p>
            <p className="font-sans text-[12px] leading-[1.5] text-ink-3">{desc.description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={copied === 'prompt' ? <Check size={14} aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
              onClick={() => copy('prompt')}
            >
              {copied === 'prompt' ? 'Copied prompt' : 'Copy prompt'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={copied === 'json' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              onClick={() => copy('json')}
            >
              {copied === 'json' ? 'Copied JSON' : 'Copy JSON'}
            </Button>
          </div>
          <p className="font-sans text-[11px] text-ink-3">
            <strong>Copy prompt</strong> → paste into Claude/ChatGPT to generate items. <strong>Copy JSON</strong> → a sample array to edit by hand.
          </p>

          <details className="rounded-input border-2 border-mist-soft bg-surface">
            <summary className="cursor-pointer px-3 py-2 font-sans text-[12px] font-bold text-ink-3">Sample item</summary>
            <pre className="max-h-56 overflow-auto border-t-2 border-mist-soft px-3 py-2 font-mono text-[11px] leading-[1.5] text-ink-2">{sampleJsonText(desc)}</pre>
          </details>

          <textarea
            rows={6}
            value={pasteRaw}
            onChange={(e) => setPasteRaw(e.target.value)}
            placeholder="Paste content JSON (one object, or an array to fill several forms)…"
            className="rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-mono text-[12px] text-ink focus:border-action focus:outline-none"
          />
          {pasteError !== '' ? <p className="font-sans text-[12px] text-danger-deep">{pasteError}</p> : null}
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={applyPaste}>Fill forms</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowPaste(false); setPasteRaw(''); setPasteError(''); }}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {mode === 'multi' && !isEdit ? (
        <div className="flex flex-col gap-2">
          {drafts.map((d, i) => {
            const open = openIdx === i;
            const errCount = Object.keys(d.errors).length;
            return (
              <div key={d.id} className="rounded-card border-2 border-mist-soft">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button type="button" onClick={() => setOpenIdx(open ? -1 : i)} className="flex flex-1 items-center gap-2 text-left">
                    {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                    <span className="font-sans text-[13px] font-bold text-ink">{i + 1}. {recordLabel(desc, d.record)}</span>
                    {errCount > 0 ? <span className="font-sans text-[11px] font-bold text-danger-deep">{errCount} issue{errCount === 1 ? '' : 's'}</span> : null}
                  </button>
                  <button type="button" aria-label="Remove" onClick={() => removeDraft(i)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:bg-canvas hover:text-danger">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
                {open ? (
                  <div className="border-t-2 border-mist-soft p-3">
                    <ContentRecordForm desc={desc} record={d.record} errors={d.errors} onChange={(r) => updateDraft(i, r)} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <ContentRecordForm desc={desc} record={drafts[0]?.record ?? emptyRecord(desc)} errors={drafts[0]?.errors ?? {}} onChange={(r) => updateDraft(0, r)} />
      )}

      <div className="sticky bottom-0 flex items-center gap-2 border-t-2 border-mist-soft bg-surface pt-3">
        <Button variant="primary" className="flex-1" loading={pending} onClick={save}>{saveLabel}</Button>
        {!isEdit ? (
          <Button variant="secondary" onClick={addBlank}>Add another</Button>
        ) : null}
        <Button variant="ghost" onClick={() => DrawerService.closeModal()}>Cancel</Button>
      </div>
    </div>
  );
}
