import type { HTMLAttributes } from 'react';

import { cn } from '../utils/cn.ts';

export type CardSize = 'sm' | 'lg';
export type CardTone = 'surface' | 'canvas';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  size?: CardSize;
  tone?: CardTone;
}

// Visual spec: design-system/projects/gbedity/preview/14-cards-tiles-rows.html
//
// Three sizes/tones cover most surfaces:
//   sm + surface — small card · 20px radius · 20px padding · white (default)
//   lg + surface — large card · 28px radius · 32px padding · white (hero scenes)
//   sm + canvas  — nested canvas zone inside a white card
export function Card({ size = 'sm', tone = 'surface', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        size === 'lg' ? 'rounded-card-lg p-8' : 'rounded-card p-5',
        tone === 'canvas' ? 'bg-canvas' : 'bg-surface',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
