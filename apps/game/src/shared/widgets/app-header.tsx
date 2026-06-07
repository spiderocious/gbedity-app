import type { ReactNode } from 'react';

import { Logo, RoomCodeChip } from '@gbedity/ui';
import { ArrowLeft } from '@icons';
import { Link } from 'react-router-dom';

import { ROUTES } from '../constants/routes.ts';

interface AppHeaderProps {
  /** Show a back arrow linking here. */
  readonly backTo?: string;
  /** Right-aligned content (nav link, room code chip, gear, etc.). */
  readonly right?: ReactNode;
  /** Show the room code chip on the right. */
  readonly roomCode?: string;
}

// Shared top strip: logo (links home) + optional back arrow + right slot. Used across the
// onboarding, lobby, catalogue, and configure screens.
export function AppHeader({ backTo, right, roomCode }: AppHeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
      <div className="flex items-center gap-4">
        {backTo !== undefined ? (
          // 44×44 hit area (min touch target) while the visual circle stays a compact 36px.
          <Link
            to={backTo}
            aria-label="Back"
            className="-m-[4px] inline-flex h-11 w-11 items-center justify-center p-[4px]"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-ink transition-colors hover:bg-canvas-deep">
              <ArrowLeft size={18} aria-hidden="true" />
            </span>
          </Link>
        ) : null}
        <Link to={ROUTES.LANDING} aria-label="Gbedity home" className="inline-flex">
          <Logo size="md" />
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {roomCode !== undefined ? <RoomCodeChip code={roomCode} size="sm" /> : null}
        {right}
      </div>
    </header>
  );
}
