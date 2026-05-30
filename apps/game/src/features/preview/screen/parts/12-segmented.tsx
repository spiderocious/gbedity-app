import { useState } from 'react';

import { Segmented, type SegmentedOption } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

type BombTime = 'fixed' | 'decay';
type Rounds = 1 | 3 | 5;
type Difficulty = 'easy' | 'mixed' | 'hard';
type Severity = 'minor' | 'mixed' | 'major';

const BOMB_OPTIONS: readonly SegmentedOption<BombTime>[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'decay', label: 'Decay' },
];

const ROUND_OPTIONS: readonly SegmentedOption<Rounds>[] = [
  { value: 1, label: '1' },
  { value: 3, label: '3' },
  { value: 5, label: '5' },
];

const DIFFICULTY_OPTIONS: readonly SegmentedOption<Difficulty>[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'hard', label: 'Hard' },
];

const SEVERITY_OPTIONS: readonly SegmentedOption<Severity>[] = [
  { value: 'minor', label: 'Minor' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'major', label: 'Major' },
];

export function SegmentedPart() {
  const [bomb, setBomb] = useState<BombTime>('decay');
  const [rounds, setRounds] = useState<Rounds>(3);
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed');
  const [severity, setSeverity] = useState<Severity>('mixed');

  return (
    <div>
      <PageHead
        index="12 / PRIMITIVES"
        title="Segmented"
        subtitle="@gbedity/ui · segmented"
      />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        2–3 mutually exclusive options. Canvas-mint track, white-surface thumb on the active
        option. Used throughout config screens — bomb time, rounds, difficulty, argument time,
        charge severity. Generic over the value type — pass strings, numbers, anything.
      </p>

      <RefBlock title="In context — a config row group">
        <div className="-mx-[6px] flex flex-col gap-1 px-[6px] py-2">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-dashed border-ink-5 py-3">
            <div>
              <div className="font-sans text-[14px] font-bold text-ink">Bomb time</div>
              <div className="text-[11px] text-ink-3">Decays as rounds progress</div>
            </div>
            <Segmented value={bomb} onChange={setBomb} options={BOMB_OPTIONS} ariaLabel="Bomb time" />
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-dashed border-ink-5 py-3">
            <div>
              <div className="font-sans text-[14px] font-bold text-ink">Rounds</div>
            </div>
            <Segmented value={rounds} onChange={setRounds} options={ROUND_OPTIONS} ariaLabel="Rounds" />
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-3">
            <div>
              <div className="font-sans text-[14px] font-bold text-ink">Difficulty</div>
            </div>
            <Segmented
              value={difficulty}
              onChange={setDifficulty}
              options={DIFFICULTY_OPTIONS}
              ariaLabel="Difficulty"
            />
          </div>
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Sizes & states">
        <RefRow label="sm (default)">
          <Segmented value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} ariaLabel="Severity" />
        </RefRow>
        <RefRow label="md">
          <Segmented
            value={severity}
            onChange={setSeverity}
            options={SEVERITY_OPTIONS}
            size="md"
            ariaLabel="Severity"
          />
        </RefRow>
        <RefRow label="disabled">
          <Segmented
            value={severity}
            onChange={setSeverity}
            options={SEVERITY_OPTIONS}
            disabled
            ariaLabel="Severity"
          />
        </RefRow>
      </RefBlock>
    </div>
  );
}
