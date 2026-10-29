'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { inputCls } from './common';

/** Button that opens an in-page confirmation dialog (optional/required reason), then POSTs. */
export function AdminActionDialog({
  path,
  label,
  title,
  description,
  reason = 'none',
  variant = 'default',
  doneMessage,
}: {
  path: string;
  label: string;
  title: string;
  description?: string;
  reason?: 'none' | 'optional' | 'required';
  variant?: 'default' | 'outline' | 'destructive' | 'secondary';
  doneMessage?: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const reasonOk = reason !== 'required' || text.trim().length >= 3;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const body = reason !== 'none' && text.trim() ? { reason: text.trim() } : {};
      await clientApi.post(path, body);
      ref.current?.close();
      setText('');
      setDone(doneMessage ?? 'İşlem tamamlandı.');
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant={variant}
        onClick={() => {
          setError(null);
          setDone(null);
          ref.current?.showModal();
        }}
      >
        {label}
      </Button>
      {done ? (
        <span role="status" className="text-xs text-success">
          {done}
        </span>
      ) : null}
      <dialog
        ref={ref}
        aria-labelledby={`${path}-t`}
        className="m-auto w-[min(28rem,92vw)] rounded-2xl border bg-card p-5 text-card-foreground shadow-lg backdrop:bg-black/40"
      >
        <h3 id={`${path}-t`} className="text-lg font-semibold">
          {title}
        </h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        {reason !== 'none' ? (
          <div className="mt-3 space-y-1">
            <label className="text-sm font-medium" htmlFor={`${path}-r`}>
              {reason === 'required' ? 'Neden (zorunlu)' : 'Neden (isteğe bağlı)'}
            </label>
            <textarea
              id={`${path}-r`}
              className={inputCls + ' h-20 py-2'}
              value={text}
              maxLength={500}
              onChange={(e) => {
                setText(e.target.value);
              }}
            />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              ref.current?.close();
            }}
          >
            Vazgeç
          </Button>
          <Button variant={variant} disabled={busy || !reasonOk} onClick={() => void run()}>
            {busy ? 'İşleniyor…' : 'Onayla'}
          </Button>
        </div>
      </dialog>
    </span>
  );
}
