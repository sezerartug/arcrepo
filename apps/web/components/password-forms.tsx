'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { ErrorBox, Field, inputCls } from './common';

/** `run` may return a validation message instead of calling the API. */
function useForm(run: (f: FormData) => Promise<string | undefined>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const problem = await run(f);
      if (problem) setError(problem);
      else setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, done, onSubmit };
}

export function ForgotPasswordForm() {
  const { busy, error, done, onSubmit } = useForm(async (f) => {
    await clientApi.post('/auth/forgot-password', { email: f.get('email') });
  });
  if (done) {
    return (
      <p role="status" className="max-w-sm rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        Bu e-posta adresiyle bir hesap varsa parola sıfırlama bağlantısı gönderildi. (Demo sürümünde
        bağlantı e-posta yerine API konsoluna ve <code>.data/mail/</code> klasörüne yazılır.)
      </p>
    );
  }
  return (
    <form onSubmit={(e) => void onSubmit(e)} className="max-w-sm space-y-4">
      <Field label="E-posta" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputCls}
        />
      </Field>
      {error ? <ErrorBox message={error} /> : null}
      <Button type="submit" disabled={busy}>
        {busy ? 'Gönderiliyor…' : 'Sıfırlama bağlantısı gönder'}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { busy, error, done, onSubmit } = useForm(async (f) => {
    const password = f.get('password');
    if (password !== f.get('password2')) return 'Parolalar eşleşmiyor.';
    await clientApi.post('/auth/reset-password', { token, password });
  });
  if (done) {
    return (
      <p role="status" className="max-w-sm text-sm">
        Parolanız değiştirildi; tüm oturumlarınız kapatıldı.{' '}
        <Link className="underline" href="/giris">
          Giriş yapın
        </Link>
        .
      </p>
    );
  }
  return (
    <form onSubmit={(e) => void onSubmit(e)} className="max-w-sm space-y-4">
      <Field label="Yeni parola" htmlFor="password" hint="En az 8 karakter">
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputCls}
        />
      </Field>
      <Field label="Yeni parola (tekrar)" htmlFor="password2">
        <input
          id="password2"
          name="password2"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputCls}
        />
      </Field>
      {error ? <ErrorBox message={error} /> : null}
      <Button type="submit" disabled={busy}>
        {busy ? 'Kaydediliyor…' : 'Parolayı değiştir'}
      </Button>
    </form>
  );
}
