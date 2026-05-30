import { useState, type ChangeEvent } from 'react';

import {
  PARTS,
  PREVIEW_GROUPS,
  type PreviewGroup,
  type PreviewPart,
} from '../../shared/registry.ts';

interface PreviewSidebarProps {
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
}

export function PreviewSidebar({ activeId, onSelect }: PreviewSidebarProps) {
  const [search, setSearch] = useState('');

  const filtered = PARTS.filter((part) =>
    part.label.toLowerCase().includes(search.toLowerCase()),
  );

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-ink-5 bg-canvas">
      <div className="flex-shrink-0 px-7 pt-8">
        <h1 className="font-serif text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
          Gbedity
        </h1>
        <p className="mt-2 font-sans text-[12px] font-bold text-ink-3">
          A second-screen party game platform · vol. 1
        </p>
        <div className="mt-5 pb-1 pt-4">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={handleSearchChange}
            className="w-full rounded-full border-0 bg-surface px-4 py-2 font-sans text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-ink-4 focus:shadow-[inset_0_0_0_2px_currentColor] focus:outline-none"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-7 pb-8">
        {PREVIEW_GROUPS.map((group) => {
          const items = filtered.filter((part) => part.group === group);
          if (items.length === 0) return null;
          return (
            <GroupSection
              key={group}
              group={group}
              items={items}
              activeId={activeId}
              onSelect={onSelect}
            />
          );
        })}
        {filtered.length === 0 && (
          <p className="mt-6 font-sans text-[11px] font-bold text-ink-3">No matches.</p>
        )}
      </nav>
    </aside>
  );
}

interface GroupSectionProps {
  readonly group: PreviewGroup;
  readonly items: readonly PreviewPart[];
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
}

function GroupSection({ group, items, activeId, onSelect }: GroupSectionProps) {
  return (
    <div className="mt-[22px] first:mt-2">
      <div className="flex items-baseline gap-2 border-b border-ink-5 pb-2">
        <span className="font-sans text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-3">
          {group}
        </span>
      </div>
      <ul className="m-0 mt-1 list-none p-0">
        {items.map((item) => (
          <NavItemRow
            key={item.id}
            item={item}
            active={activeId === item.id}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}

interface NavItemRowProps {
  readonly item: PreviewPart;
  readonly active: boolean;
  readonly onSelect: (id: string) => void;
}

function NavItemRow({ item, active, onSelect }: NavItemRowProps) {
  function handleClick() {
    onSelect(item.id);
  }

  return (
    <li>
      <button
        onClick={handleClick}
        className={`flex w-full cursor-pointer items-baseline gap-[10px] border-0 bg-transparent py-[6px] text-left font-sans text-[13px] leading-[1.45] ${
          active ? 'font-bold text-ink' : 'font-semibold text-ink-2 hover:text-ink'
        }`}
      >
        <span
          className={`mt-1.5 h-[6px] w-[6px] flex-shrink-0 rounded-full border-[1.5px] ${
            active ? 'border-action bg-action' : 'border-ink-4 bg-transparent'
          }`}
        />
        {item.label}
      </button>
    </li>
  );
}
