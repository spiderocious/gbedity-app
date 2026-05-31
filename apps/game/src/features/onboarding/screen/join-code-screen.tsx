import { useState } from 'react';

import { Button, Card, DrawerService, Field, RoomCodeInput } from '@gbedity/ui';
import { ArrowRight, QrCode } from '@icons';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '../../../shared/constants/routes.ts';
import { apiClient } from '../../../shared/services/api-client.ts';
import { ApiError, ApiErrorCode } from '../../../shared/services/api-error.ts';
import { LobbySnapshot } from '../../../shared/types/api.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';

// §1.2 — player join code entry. Validates the code against the live GET /rooms/:code, then
// routes to nickname carrying the code. Auto-uppercase; dash is display-only and stripped
// before the API call (backend codes are 6 chars, no dash). Deep-link /join/:code pre-fills.
function display(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
  return clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}

export function JoinCodeScreen() {
  const navigate = useNavigate();
  const { code: codeParam } = useParams();
  const [value, setValue] = useState(codeParam !== undefined ? display(codeParam) : '');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const raw = value.replace(/-/g, '');
  const ready = raw.length === 6;

  async function handleJoin() {
    if (!ready) {
      setError('Six characters needed.');
      setShake(true);
      window.setTimeout(() => setShake(false), 220);
      return;
    }
    setChecking(true);
    try {
      const snap = LobbySnapshot.parse(await apiClient.get(`/rooms/${raw}`));
      navigate(`${ROUTES.JOIN_NICKNAME}?code=${snap.code}`);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.is(ApiErrorCode.ROOM_NOT_FOUND)
          ? 'Couldn’t find that room. Check the code and try again.'
          : e instanceof ApiError
            ? e.message
            : 'Couldn’t reach the room. Try again.';
      DrawerService.toast(msg, { tone: 'danger' });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />
      <main className="mx-auto flex max-w-md flex-col px-6 pt-8">
        <Card size="lg" className="flex flex-col">
          <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
            Join a room
          </p>
          <h1 className="mt-1 font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">
            Got a code?
          </h1>
          <p className="mt-1 font-sans text-[14px] leading-[1.5] text-ink-3">
            Type the six characters from the shared screen — or scan the QR.
          </p>

          <div className="mt-5">
            <Field label="Room code" htmlFor="join-code" error={error === '' ? undefined : error}>
              <RoomCodeInput
                id="join-code"
                value={value}
                placeholder="GBE-4ZK"
                className={`max-w-none ${shake ? 'animate-[shake_0.2s_ease-in-out]' : ''}`}
                onChange={(e) => {
                  setValue(display(e.target.value));
                  setError('');
                }}
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <Button
              variant="primary"
              size="lg"
              loading={checking}
              className={`w-full ${ready && !checking ? 'animate-[pulse-once_0.4s_ease-out]' : ''}`}
              trailingIcon={<ArrowRight size={18} aria-hidden="true" />}
              onClick={() => void handleJoin()}
            >
              Join room
            </Button>
            <Button
              variant="ghost"
              leadingIcon={<QrCode size={18} aria-hidden="true" />}
              onClick={() => navigate(ROUTES.JOIN_QR)}
            >
              Scan QR instead
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
