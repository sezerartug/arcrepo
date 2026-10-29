'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { validatePasswordChange, validateProfile } from '@/lib/account';
import { clientApi, formatDate } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import type { AccountSession } from '@/lib/types';
import { Badge, ErrorBox, Field, inputCls } from './common';

const val = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' ? v : '';
};

function Notice({ error, ok }: { error: string | null; ok: string | null }) {
  // aria-live region stays mounted so screen readers announce changes.
  return (
    <div aria-live="polite" className="min-h-0">
      {error ? <ErrorBox message={error} /> : null}
      {ok ? (
        <p
          role="status"
          className="rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-sm"
        >
          {ok}
        </p>
      ) : null}
    </div>
  );
}

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const values = {
      fullName: val(f, 'fullName'),
      phone: val(f, 'phone'),
    };
    setOk(null);
    const invalid = validateProfile(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientApi.patch('/me', {
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
      });
      setOk('Profil bilgileriniz kaydedildi.');
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ad soyad" htmlFor="p-name">
          <input
            id="p-name"
            name="fullName"
            defaultValue={fullName}
            required
            autoComplete="name"
            className={inputCls}
          />
        </Field>
        <Field
          label="Telefon (isteğe bağlı)"
          htmlFor="p-phone"
          hint="Doğrulanmaz, yalnızca saklanır."
        >
          <input
            id="p-phone"
            name="phone"
            type="tel"
            defaultValue={phone}
            autoComplete="tel"
            className={inputCls}
          />
        </Field>
      </div>
      <Notice error={error} ok={ok} />
      <Button type="submit" disabled={busy}>
        Kaydet
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const v = {
      current: val(f, 'currentPassword'),
      next: val(f, 'newPassword'),
      confirm: val(f, 'confirmPassword'),
    };
    setOk(null);
    const invalid = validatePasswordChange(v);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientApi.post('/me/password', { currentPassword: v.current, newPassword: v.next });
      form.reset();
      setOk('Parolanız değiştirildi. Diğer cihazlardaki oturumlarınız kapatıldı.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Mevcut parola" htmlFor="pw-current">
          <input
            id="pw-current"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className={inputCls}
          />
        </Field>
        <Field label="Yeni parola" htmlFor="pw-new" hint="En az 8 karakter.">
          <input
            id="pw-new"
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputCls}
          />
        </Field>
        <Field label="Yeni parola (tekrar)" htmlFor="pw-confirm">
          <input
            id="pw-confirm"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className={inputCls}
          />
        </Field>
      </div>
      <Notice error={error} ok={ok} />
      <Button type="submit" disabled={busy}>
        Parolayı değiştir
      </Button>
    </form>
  );
}

export function SessionsCard({ sessions }: { sessions: AccountSession[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null); // session id or 'all'
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const others = sessions.filter((s) => !s.current).length;

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await action();
      setOk(done);
      setConfirming(null);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function confirmRow(onYes: () => void) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-sm">
        <span>Emin misiniz?</span>
        <Button size="sm" variant="destructive" disabled={busy} onClick={onYes}>
          Evet, kapat
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setConfirming(null);
          }}
        >
          Vazgeç
        </Button>
      </span>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aktif oturum bulunamadı.</p>
      ) : (
        <ul className="divide-y text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                Açılış: {formatDate(s.createdAt)}
                <span className="text-muted-foreground">
                  {' '}
                  · bitiş {formatDate(s.expiresAt)}
                </span>{' '}
                {s.current ? <Badge tone="ok">Bu oturum</Badge> : null}
              </span>
              {s.current ? null : confirming === s.id ? (
                confirmRow(
                  () => void run(() => clientApi.del(`/me/sessions/${s.id}`), 'Oturum kapatıldı.'),
                )
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setConfirming(s.id);
                  }}
                >
                  Oturumu kapat
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {others > 0 ? (
        confirming === 'all' ? (
          confirmRow(
            () =>
              void run(
                () => clientApi.post('/me/sessions/revoke-others'),
                'Diğer tüm oturumlar kapatıldı.',
              ),
          )
        ) : (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setConfirming('all');
            }}
          >
            Diğer tüm oturumları kapat
          </Button>
        )
      ) : null}
      <Notice error={error} ok={ok} />
    </div>
  );
}
