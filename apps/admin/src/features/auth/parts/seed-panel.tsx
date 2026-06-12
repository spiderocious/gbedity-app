import { useState } from 'react';

import { Button, Field, InlineAlert, Input } from '@gbedity/ui';

import { useAdminSeed } from '../../../shared/api/admin-api.ts';
import { ApiError } from '../../../shared/services/api-client.ts';

// First-time setup: bootstrap the first admin. The backend is env-gated (CAN_SEED_ADMIN) and
// returns the generated password ONCE — so we surface it prominently and tell the user to copy it.
export function SeedPanel() {
  const seed = useAdminSeed();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState('');

  function submit() {
    setError('');
    const trimmed = email.trim();
    if (trimmed === '') {
      setError('Enter an email.');
      return;
    }
    seed.mutate(trimmed, {
      onSuccess: (data) => setResult(data),
      onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not seed admin.'),
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="font-sans text-[13px] font-bold text-ink-3 hover:text-ink">
        First-time setup
      </button>
    );
  }

  if (result !== null) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3">
        <InlineAlert tone="success">Admin created. Copy the password now — it won’t be shown again.</InlineAlert>
        <Field label="Email">
          <Input value={result.email} readOnly onFocus={(e) => e.target.select()} />
        </Field>
        <Field label="Password (one-time)">
          <Input value={result.password} readOnly onFocus={(e) => e.target.select()} className="font-mono" />
        </Field>
        <Button variant="secondary" onClick={() => { setOpen(false); setResult(null); setEmail(''); }}>Done</Button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <p className="font-sans text-[13px] text-ink-3">Bootstrap the first admin account. Available only when seeding is enabled on the server.</p>
      <Field label="Admin email" htmlFor="seed-email" error={error === '' ? undefined : error}>
        <Input id="seed-email" type="email" value={email} error={error !== ''} onChange={(e) => setEmail(e.target.value)} placeholder="admin@gbedity.app" />
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" loading={seed.isPending} onClick={submit}>Create admin</Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setError(''); }}>Cancel</Button>
      </div>
    </div>
  );
}
