import { Score } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

export function ScorePart() {
  return (
    <div>
      <PageHead index="23 / DISPLAY" title="Score" subtitle="@gbedity/ui · score" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Every number in Gbedity is Fraunces SemiBold with tabular numerals. Four sizes cover
        the hero roles: <strong>hero</strong> for the bomb timer, <strong>lg</strong> for the
        final score and AI verdict, <strong>md</strong> for ranked-row scores, <strong>sm</strong>{' '}
        for inline use.
      </p>

      <RefBlock title="The three hero roles">
        <RefRow label="bomb timer · hero · danger">
          <Score value="04" size="hero" tone="danger" />
        </RefRow>
        <RefRow label="final score · lg · accent">
          <Score value="1,420" size="lg" tone="accent" />
        </RefRow>
        <RefRow label="AI verdict · lg · ink + /100">
          <Score value="84" size="lg" tone="ink" unit="/100" />
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Timer escalation — colour only, no scale change">
        <RefRow label="calm · ink">
          <Score value="08" size="lg" tone="ink" />
        </RefRow>
        <RefRow label="warn · last 25%">
          <Score value="06" size="lg" tone="warn" />
        </RefRow>
        <RefRow label="critical · last 10%">
          <Score value="02" size="lg" tone="danger" />
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Smaller sizes — for ranked rows and inline use">
        <RefRow label="md (ranked row)">
          <Score value="1,420" />
          <Score value="1,180" />
          <Score value="940" />
          <Score value="720" />
        </RefRow>
        <RefRow label="sm (inline)">
          <Score value="84" size="sm" unit="/100" />
          <Score value="250" size="sm" tone="accent" unit="pts" />
          <Score value="0:38" size="sm" />
        </RefRow>
      </RefBlock>
    </div>
  );
}
