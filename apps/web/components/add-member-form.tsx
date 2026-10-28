'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { ErrorBox, Field, inputCls } from './common';

export function AddMemberForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      setCreated(
        await clientApi.post<{ email: string; tempPassword: string }>('/company/members', {
          email: f.get('email'),
          fullName: f.get('fullName'),
        }),
      );
      form.reset();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => void submit(e)}
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Field label="Ad soyad" htmlFor="m-name">
          <input id="m-name" name="fullName" required className={inputCls} />
        </Field>
        <Field label="E-posta" htmlFor="m-email">
          <input id="m-email" name="email" type="email" required className={inputCls} />
        </Field>
        <Button type="submit" disabled={busy}>
          Üye ekle
        </Button>
      </form>
      {error ? <ErrorBox message={error} /> : null}
      {created ? (
        <div role="status" className="rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
          <p>
            <strong>{created.email}</strong> için geçici parola (yalnızca bir kez gösterilir):
          </p>
          <p className="mt-1 font-mono text-base font-semibold">{created.tempPassword}</p>
        </div>
      ) : null}
    </div>
  );
}
