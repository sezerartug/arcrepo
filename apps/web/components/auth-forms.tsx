'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { ErrorBox, Field, inputCls } from './common';

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');

function useSubmit(path: string, build: (f: FormData) => unknown, redirectTo: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = build(f);
    if (body === null) {
      setError('Vergi numarası 10 haneli olmalıdır.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientApi.post(path, body);
      // Full navigation so the header re-reads the new session.
      window.location.assign(redirectTo);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return { busy, error, onSubmit };
}

export function LoginForm() {
  const { busy, error, onSubmit } = useSubmit(
    '/auth/login',
    (f) => ({ email: f.get('email'), password: f.get('password') }),
    '/hesap',
  );
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
      <Field label="Parola" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </Field>
      {error ? <ErrorBox message={error} /> : null}
      <Button type="submit" disabled={busy}>
        {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const { busy, error, onSubmit } = useSubmit(
    '/auth/register',
    (f) => {
      const taxNo = str(f.get('taxNo'));
      if (!/^\d{10}$/.test(taxNo)) return null;
      return {
        email: f.get('email'),
        password: f.get('password'),
        fullName: f.get('fullName'),
        company: {
          legalName: f.get('legalName'),
          taxNo,
          taxOffice: f.get('taxOffice'),
          address: f.get('address'),
        },
      };
    },
    '/hesap',
  );
  return (
    <form onSubmit={(e) => void onSubmit(e)} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <fieldset className="space-y-4">
        <legend className="mb-2 font-semibold text-primary">Şirket bilgileri</legend>
        <Field label="Ticari unvan" htmlFor="legalName">
          <input id="legalName" name="legalName" required className={inputCls} />
        </Field>
        <Field label="Vergi numarası" htmlFor="taxNo" hint="10 haneli">
          <input
            id="taxNo"
            name="taxNo"
            required
            inputMode="numeric"
            maxLength={10}
            className={inputCls}
          />
        </Field>
        <Field label="Vergi dairesi" htmlFor="taxOffice">
          <input id="taxOffice" name="taxOffice" required className={inputCls} />
        </Field>
        <Field label="Adres" htmlFor="address">
          <textarea
            id="address"
            name="address"
            required
            rows={3}
            className={inputCls + ' h-auto py-2'}
          />
        </Field>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-2 font-semibold text-primary">Yetkili kullanıcı</legend>
        <Field label="Ad soyad" htmlFor="fullName">
          <input id="fullName" name="fullName" required autoComplete="name" className={inputCls} />
        </Field>
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
        <Field label="Parola" htmlFor="password" hint="En az 10 karakter">
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className={inputCls}
          />
        </Field>
      </fieldset>
      <div className="space-y-3 sm:col-span-2">
        {error ? <ErrorBox message={error} /> : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Kaydediliyor…' : 'Kayıt ol'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Şirketiniz yönetici onayından sonra alım-satım yapabilir.
        </p>
      </div>
    </form>
  );
}
