import { useState } from 'react';

import { Button, DrawerService, Segmented, Slider, Switch } from '@gbedity/ui';
import { Minus, Plus } from '@icons';

import { ControlKind, type ConfigControl } from '../../../shared/games/config-schema.ts';

// §4.2 — the universal config controls. One component renders any ConfigControl from the
// data-driven schema, so every game's configure screen is generated, not hand-built.
// Local state only (UI-only build); changes are visual.

interface ConfigControlRowProps {
  readonly control: ConfigControl;
}

export function ConfigControlRow({ control }: ConfigControlRowProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-dashed border-ink-5 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="font-sans text-[14px] font-bold text-ink">{control.label}</span>
          {control.help !== undefined ? (
            <p className="font-sans text-[12px] leading-[1.4] text-ink-3">{control.help}</p>
          ) : null}
        </div>
        <div className="flex-shrink-0">
          <ControlInput control={control} />
        </div>
      </div>
    </div>
  );
}

function ControlInput({ control }: ConfigControlRowProps) {
  switch (control.kind) {
    case ControlKind.STEPPER:
      return <Stepper min={control.min} max={control.max} step={control.step ?? 1} initial={control.defaultValue} unit={control.unit} />;
    case ControlKind.PILLS:
      return <PillsInput options={control.options} initial={control.defaultValue} />;
    case ControlKind.MULTI:
      return <MultiInput options={control.options} initial={control.defaultSelected} />;
    case ControlKind.DROPDOWN:
      return <DropdownInput options={control.options} initial={control.defaultValue} />;
    case ControlKind.SLIDER:
      return <SliderInput leftLabel={control.leftLabel} rightLabel={control.rightLabel} initial={control.defaultValue} />;
    case ControlKind.SWITCH:
      return <SwitchInput initial={control.defaultValue} />;
    case ControlKind.CUSTOM_CONTENT:
      return <CustomOpener noun={control.noun} />;
    default:
      return null;
  }
}

function Stepper({ min, max, step, initial, unit }: { min: number; max: number; step: number; initial: number; unit?: string }) {
  const [v, setV] = useState(initial);
  return (
    <div className="inline-flex items-center gap-3 rounded-full bg-canvas px-2 py-1">
      <button type="button" aria-label="Decrease" onClick={() => setV((x) => Math.max(min, x - step))} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface text-ink hover:bg-surface-soft disabled:opacity-40" disabled={v <= min}>
        <Minus size={14} aria-hidden="true" />
      </button>
      <span className="min-w-[44px] text-center font-sans text-[15px] font-bold tabular-nums text-ink">
        {v}{unit ?? ''}
      </span>
      <button type="button" aria-label="Increase" onClick={() => setV((x) => Math.min(max, x + step))} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface text-ink hover:bg-surface-soft disabled:opacity-40" disabled={v >= max}>
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function PillsInput({ options, initial }: { options: readonly string[]; initial: string }) {
  const [v, setV] = useState(initial);
  return (
    <Segmented
      size="sm"
      value={v}
      onChange={setV}
      ariaLabel="Choose option"
      options={options.map((o) => ({ value: o, label: o }))}
    />
  );
}

function MultiInput({ options, initial }: { options: readonly string[]; initial: readonly string[] }) {
  const [selected, setSelected] = useState<readonly string[]>(initial);
  function toggle(o: string) {
    setSelected((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]));
  }
  return (
    <div className="flex max-w-[260px] flex-wrap justify-end gap-[6px]">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o)}
            className={`rounded-full px-3 py-[5px] font-sans text-[12px] font-bold transition-colors duration-150 ${on ? 'bg-action text-white' : 'bg-canvas text-ink-3 hover:text-ink'}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function DropdownInput({ options, initial }: { options: readonly string[]; initial: string }) {
  const [v, setV] = useState(initial);
  function open() {
    DrawerService.openModal(
      <div className="flex flex-col gap-1">
        <h2 className="mb-2 font-serif text-[20px] font-semibold text-ink">Choose</h2>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => { setV(o); DrawerService.closeModal(); }}
            className={`rounded-card px-4 py-3 text-left font-sans text-[15px] font-semibold ${o === v ? 'bg-action-soft text-action-deep' : 'text-ink hover:bg-canvas'}`}
          >
            {o}
          </button>
        ))}
      </div>,
      { position: 'bottom' },
    );
  }
  return (
    <button type="button" onClick={open} className="inline-flex items-center gap-2 rounded-full bg-canvas px-4 py-[7px] font-sans text-[14px] font-bold text-ink hover:bg-canvas-deep">
      {v} <span aria-hidden="true" className="text-ink-3">▾</span>
    </button>
  );
}

function SliderInput({ leftLabel, rightLabel, initial }: { leftLabel: string; rightLabel: string; initial: number }) {
  const [v, setV] = useState(initial);
  return (
    <div className="w-[200px]">
      <div className="mb-1 flex justify-between font-sans text-[11px] font-bold text-ink-3">
        <span>{leftLabel}</span>
        <span className="tabular-nums text-ink">{v}</span>
        <span>{rightLabel}</span>
      </div>
      <Slider value={v} onChange={setV} ariaLabel={`${leftLabel} to ${rightLabel}`} />
    </div>
  );
}

function SwitchInput({ initial }: { initial: boolean }) {
  const [v, setV] = useState(initial);
  return <Switch checked={v} onChange={setV} ariaLabel="Toggle" />;
}

function CustomOpener({ noun }: { noun: string }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() =>
        DrawerService.openModal(<CustomContentSheet noun={noun} />, { position: 'bottom' })
      }
    >
      Custom {noun}
    </Button>
  );
}

// §4.3 — custom content sheet. Paste / Type / Choose existing.
function CustomContentSheet({ noun }: { noun: string }) {
  const TABS = ['Paste', 'Type', 'Choose existing'] as const;
  const [tab, setTab] = useState<(typeof TABS)[number]>('Paste');
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-[22px] font-semibold text-ink">Custom {noun}</h2>
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3 py-[6px] font-sans text-[12px] font-bold ${tab === t ? 'bg-action text-white' : 'bg-canvas text-ink-3'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Paste' ? (
        <textarea rows={6} placeholder={`Question | option1 | option2 | option3 | option4 | answerIndex`} className="rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-mono text-[13px] text-ink placeholder:text-ink-4 focus:border-action focus:outline-none" />
      ) : tab === 'Type' ? (
        <div className="flex flex-col gap-2">
          <input placeholder={`New ${noun.replace(/s$/, '')}`} className="rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-sans text-[15px] text-ink focus:border-action focus:outline-none" />
          <Button variant="ghost" size="sm">Add another</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {['Family Night Deck', 'Office Trivia', 'Naija Classics'].map((d) => (
            <div key={d} className="flex items-center justify-between rounded-card bg-canvas px-4 py-3">
              <span className="font-sans text-[14px] font-semibold text-ink">{d}</span>
              <span className="font-sans text-[12px] text-ink-3">12 items</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => DrawerService.closeModal()}>Use this content</Button>
        <Button variant="ghost" onClick={() => DrawerService.closeModal()}>Cancel</Button>
      </div>
    </div>
  );
}
