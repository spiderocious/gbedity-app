import { useState } from 'react';

import { Checkbox } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

const ALL_GAMES = [
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'word-bomb', label: 'Word Bomb' },
  { id: 'sketch', label: 'Sketch & Guess' },
  { id: 'plead', label: 'Plead Your Case' },
] as const;

export function CheckboxPart() {
  const [checked, setChecked] = useState<Set<string>>(new Set(['quizzes', 'word-bomb']));

  function toggle(id: string) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  }

  return (
    <div>
      <PageHead index="14 / PRIMITIVES" title="Checkbox" subtitle="@gbedity/ui · checkbox" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Square 22×22 with a 7px radius and a 2px ink border. Action-green fill + white tick when
        on. Used in multi-select game lists, content category pickers, and "include in league"
        toggles.
      </p>

      <RefBlock title="In context — pick games for the league">
        <div className="-mx-[6px] flex flex-col gap-3 px-[6px] py-2">
          {ALL_GAMES.map((g) => (
            <Checkbox
              key={g.id}
              checked={checked.has(g.id)}
              onChange={() => toggle(g.id)}
              label={g.label}
            />
          ))}
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="States">
        <RefRow label="off">
          <Checkbox checked={false} onChange={() => undefined} label="Family content only" />
        </RefRow>
        <RefRow label="on">
          <Checkbox checked={true} onChange={() => undefined} label="Family content only" />
        </RefRow>
        <RefRow label="disabled · off">
          <Checkbox checked={false} onChange={() => undefined} disabled label="Spicy (host account required)" />
        </RefRow>
        <RefRow label="disabled · on">
          <Checkbox checked={true} onChange={() => undefined} disabled label="Spicy (host account required)" />
        </RefRow>
        <RefRow label="standalone (no label)">
          <Checkbox checked={true} onChange={() => undefined} />
        </RefRow>
      </RefBlock>
    </div>
  );
}
