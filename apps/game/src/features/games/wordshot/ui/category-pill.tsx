import { Tag } from '@icons';
import { cn } from '@gbedity/ui';

// The category label for the round prompt — a small pill showing the required category.
// Rendered on the question slide where the letter badge lives.

interface CategoryPillProps {
  readonly category: string;
  readonly tone?: 'on-dark' | 'on-light';
  readonly className?: string;
}

export function CategoryPill({ category, tone = 'on-dark', className }: CategoryPillProps) {
  const colors =
    tone === 'on-dark'
      ? 'bg-surface/20 text-surface'
      : 'bg-action-soft text-action-deep';

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-2', colors, className)}>
      <Tag size={14} aria-hidden="true" />
      <span className="font-sans text-[14px] font-bold capitalize">{category}</span>
    </div>
  );
}
