import { Column, Row, type SpaceToken, type StackJustify } from '@gbedity/ui';
import { Repeat, Show } from 'meemaw';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

const GAPS: readonly SpaceToken[] = ['1', '2', '3', '4', '6', '8'];
const JUSTIFY: readonly StackJustify[] = ['start', 'center', 'end', 'between'];

// A small coloured block to make flex behaviour visible.
function Box({ label }: { readonly label?: string }) {
  return (
    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-btn-sm bg-action-soft px-2 font-sans text-[12px] font-bold text-ink">
      <Show when={label !== undefined}>{label}</Show>
    </span>
  );
}

export function LayoutPart() {
  return (
    <div>
      <PageHead index="16 / PRIMITIVES" title="Row · Column" subtitle="@gbedity/ui · layout" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Flex layout on the 8px grid. The <code className="font-mono text-[12px]">gap</code> prop is a
        closed token set (0 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64), so off-grid spacing can&apos;t
        happen. <code className="font-mono text-[12px]">Row</code> lays out horizontally,{' '}
        <code className="font-mono text-[12px]">Column</code> vertically; both take{' '}
        <code className="font-mono text-[12px]">align</code>, <code className="font-mono text-[12px]">justify</code>,{' '}
        <code className="font-mono text-[12px]">wrap</code>, and <code className="font-mono text-[12px]">as</code>.
      </p>

      <RefBlock title="Gap scale · Row">
        <Repeat each={GAPS as SpaceToken[]}>
          {(gap) => (
            <RefRow key={gap} label={`gap="${gap}"`}>
              <Row gap={gap}>
                <Box />
                <Box />
                <Box />
                <Box />
              </Row>
            </RefRow>
          )}
        </Repeat>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Align · Row (cross-axis)">
        <RefRow label="start">
          <Row gap="2" align="start" className="h-16">
            <span className="inline-block h-6 w-8 rounded-btn-sm bg-stage-tint" />
            <span className="inline-block h-12 w-8 rounded-btn-sm bg-stage-tint" />
            <span className="inline-block h-8 w-8 rounded-btn-sm bg-stage-tint" />
          </Row>
        </RefRow>
        <RefRow label="center">
          <Row gap="2" align="center" className="h-16">
            <span className="inline-block h-6 w-8 rounded-btn-sm bg-stage-tint" />
            <span className="inline-block h-12 w-8 rounded-btn-sm bg-stage-tint" />
            <span className="inline-block h-8 w-8 rounded-btn-sm bg-stage-tint" />
          </Row>
        </RefRow>
        <RefRow label="end">
          <Row gap="2" align="end" className="h-16">
            <span className="inline-block h-6 w-8 rounded-btn-sm bg-stage-tint" />
            <span className="inline-block h-12 w-8 rounded-btn-sm bg-stage-tint" />
            <span className="inline-block h-8 w-8 rounded-btn-sm bg-stage-tint" />
          </Row>
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Justify · Row (main-axis, full width)">
        <Repeat each={JUSTIFY as StackJustify[]}>
          {(justify) => (
            <RefRow key={justify} label={`justify="${justify}"`}>
              <Row gap="2" justify={justify} className="w-full">
                <Box label="1" />
                <Box label="2" />
                <Box label="3" />
              </Row>
            </RefRow>
          )}
        </Repeat>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Wrap · Row">
        <RefRow label="wrap">
          <Row gap="2" wrap className="max-w-[260px]">
            <Repeat times={9}>
              {(_, index) => <Box key={index} label={String(index + 1)} />}
            </Repeat>
          </Row>
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Column + composition">
        <RefRow label="Column gap='3'">
          <Column gap="3">
            <Box label="top" />
            <Box label="middle" />
            <Box label="bottom" />
          </Column>
        </RefRow>
        <RefRow label="Row of Columns">
          <Row gap="6">
            <Column gap="2">
              <Box label="a1" />
              <Box label="a2" />
            </Column>
            <Column gap="2">
              <Box label="b1" />
              <Box label="b2" />
            </Column>
          </Row>
        </RefRow>
      </RefBlock>
    </div>
  );
}
