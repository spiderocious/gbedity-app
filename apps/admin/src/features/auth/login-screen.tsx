import { useState } from 'react';

import { Button, Card, DrawerService, Field, Input, Logo } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { useAdminLogin } from '../../shared/api/admin-api.ts';
import { ApiError } from '../../shared/services/api-client.ts';
import { ROUTES } from '../../shared/constants/routes.ts';
import { SeedPanel } from './parts/seed-panel.tsx';

// Admin login. invalid_credentials → inline error; other failures → toast.
export function LoginScreen() {
  const navigate = useNavigate();
  const login = useAdminLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit() {
    setError('');
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => navigate(ROUTES.METRICS),
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'invalid_credentials') {
            setError('Wrong email or password.');
          } else {
            DrawerService.toast(e instanceof ApiError ? e.message : 'Could not sign in.', { tone: 'danger' });
          }
        },
      },
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6">
      <Card size="lg" className="flex w-full max-w-sm flex-col">
        <div className="mb-2 flex items-center gap-2">
          <Logo size="md" />
          <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Admin</span>
        </div>
        <h1 className="font-serif text-[26px] font-semibold tracking-[-0.01em] text-ink">Sign in</h1>
        <div className="mt-5 flex flex-col gap-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gbedity.app" />
          </Field>
          <Field label="Password" htmlFor="password" error={error === '' ? undefined : error}>
            <Input id="password" type="password" value={password} error={error !== ''} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Button variant="primary" size="lg" className="w-full" loading={login.isPending} onClick={submit}>
            Sign in
          </Button>
        </div>
      </Card>
      <SeedPanel />
    </div>
  );
}
