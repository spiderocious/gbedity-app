import { useState } from 'react';

import { Button, Card, DrawerService, Field, Input } from '@gbedity/ui';
import { ArrowRight } from '@icons';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useJoinRoom } from '../../../shared/api/use-join-room.ts';
import { ROUTES, pathWith } from '../../../shared/constants/routes.ts';
import { ApiError, ApiErrorCode } from '../../../shared/services/api-error.ts';
import { BANNED_NICKNAMES, NICKNAME_SUGGESTIONS } from '../../../shared/mock/players.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';

// §1.3 — nickname entry. Pre-fills a cheerful suggestion (editable/clearable); ≤16 chars;
// client profanity filter. On submit: POST /rooms/:code/players, store reconnect token, lobby.
const FALLBACK_NICKNAME = 'BoldOkra';

export function NicknameScreen() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const code = search.get('code') ?? '';
  const joinRoom = useJoinRoom();
  const [name, setName] = useState<string>(() => NICKNAME_SUGGESTIONS[0] ?? FALLBACK_NICKNAME);
  const [error, setError] = useState('');

  function handleChange(next: string) {
    // Allow blank — the user can clear and type their own. The suggestion is only the initial
    // value (JN-11). Submit guards against an empty nickname below.
    setName(next.slice(0, 16));
    setError('');
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Enter a nickname.');
      return;
    }
    if (BANNED_NICKNAMES.some((b) => trimmed.toLowerCase().includes(b))) {
      setError('Pick another nickname.');
      return;
    }
    if (code === '') {
      // No code in the URL (e.g. opened directly) — send them back to code entry.
      navigate(ROUTES.JOIN);
      return;
    }
    joinRoom.mutate(
      { code, nickname: trimmed },
      {
        onSuccess: () => navigate(pathWith(ROUTES.PLAYER_LOBBY, { code })),
        onError: (e) => {
          if (e instanceof ApiError && e.is(ApiErrorCode.NICKNAME_TAKEN)) {
            setError('That nickname’s taken. Try another.');
          } else {
            DrawerService.toast(
              e instanceof ApiError ? e.message : 'Could not join the room.',
              { tone: 'danger' },
            );
          }
        },
      },
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />
      <main className="mx-auto flex max-w-md flex-col px-6 pt-8">
        <Card size="lg" className="flex flex-col">
          <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
            Almost in
          </p>
          <h1 className="mt-1 font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">
            What should we call you?
          </h1>
          <div className="mt-5">
            <Field label="Nickname" htmlFor="nickname" error={error === '' ? undefined : error}>
              <Input
                id="nickname"
                value={name}
                placeholder="Your nickname"
                maxLength={16}
                error={error !== ''}
                onChange={(e) => handleChange(e.target.value)}
              />
            </Field>
          </div>
          <p className="mt-2 font-sans text-[12px] text-ink-3">
            Visible to other players. No accounts, no email.
          </p>
          <div className="mt-5">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={joinRoom.isPending}
              trailingIcon={<ArrowRight size={18} aria-hidden="true" />}
              onClick={handleSubmit}
            >
              Join the room
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
