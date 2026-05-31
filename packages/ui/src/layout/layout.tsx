import {
  forwardRef,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';

import { cn } from '../utils/cn.ts';

// Visual spec: design-system/projects/gbedity/preview/_foundation.css
//
// Row · Column — the flex layout primitives.
//
// Everything is on an 8px grid (brand rule: "if it doesn't breathe, the spacing
// is wrong"). The `gap` prop is a CLOSED token set mapped to static Tailwind
// classes, so off-grid spacing is impossible by construction and the JIT always
// sees a literal class. Row and Column are thin presets over a shared Stack core.

/** Brand spacing scale → Tailwind gap classes. 0/4/8/12/16/20/24/32/48/64px. */
export type SpaceToken = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '12' | '16';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** Gap between children, keyed to the 8px grid. Default '0'. */
  gap?: SpaceToken;
  /** align-items. */
  align?: StackAlign;
  /** justify-content. */
  justify?: StackJustify;
  /** flex-wrap. */
  wrap?: boolean;
  /** inline-flex instead of flex. */
  inline?: boolean;
  /** Render as a different element (e.g. 'section', 'ul', 'nav'). Default 'div'. */
  as?: ElementType;
  children?: ReactNode;
}

const GAP_CLASSES: Record<SpaceToken, string> = {
  '0': 'gap-0',
  '1': 'gap-1',
  '2': 'gap-2',
  '3': 'gap-3',
  '4': 'gap-4',
  '5': 'gap-5',
  '6': 'gap-6',
  '8': 'gap-8',
  '12': 'gap-12',
  '16': 'gap-16',
};

const ALIGN_CLASSES: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const JUSTIFY_CLASSES: Record<StackJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

interface StackInternalProps extends StackProps {
  /** Flex direction — set by Row/Column, not by callers. */
  direction: 'row' | 'col';
}

// Shared flex core. Row and Column preset `direction`; this is not exported.
const Stack = forwardRef<HTMLElement, StackInternalProps>(function Stack(
  {
    direction,
    gap = '0',
    align,
    justify,
    wrap = false,
    inline = false,
    as,
    className,
    children,
    ...rest
  },
  ref,
) {
  const Component = as ?? 'div';
  return (
    <Component
      ref={ref}
      className={cn(
        inline ? 'inline-flex' : 'flex',
        direction === 'row' ? 'flex-row' : 'flex-col',
        wrap ? 'flex-wrap' : '',
        GAP_CLASSES[gap],
        align !== undefined ? ALIGN_CLASSES[align] : '',
        justify !== undefined ? JUSTIFY_CLASSES[justify] : '',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
});

export type RowProps = Readonly<StackProps>;
export type ColumnProps = Readonly<StackProps>;

/**
 * Row — horizontal flex layout on the brand spacing grid.
 *
 * Visual spec: design-system/projects/gbedity/preview/_foundation.css
 *
 * `<Row gap="3" align="center">` replaces `<div className="flex items-center gap-3">`.
 */
export const Row = forwardRef<HTMLElement, RowProps>(function Row(props, ref) {
  return <Stack direction="row" ref={ref as Ref<HTMLElement>} {...props} />;
});

/**
 * Column — vertical flex layout on the brand spacing grid.
 *
 * Visual spec: design-system/projects/gbedity/preview/_foundation.css
 *
 * `<Column gap="4">` replaces `<div className="flex flex-col gap-4">`.
 */
export const Column = forwardRef<HTMLElement, ColumnProps>(function Column(props, ref) {
  return <Stack direction="col" ref={ref as Ref<HTMLElement>} {...props} />;
});
