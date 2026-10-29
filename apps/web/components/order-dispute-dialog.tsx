'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { inputCls } from './common';

/** Buyer-only: opens an in-page dialog to object to a shipped order (no window.confirm). */
export function OrderDisputeDialog({ orderId }: { orderId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = reason.trim().length >= 10;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await clientApi.post(`/orders/${orderId}/dispute`, { reason: reason.trim() });
      ref.current?.close();
      setReason('');
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
        variant="outline"
        onClick={() => {
          setError(null);
          ref.current?.showModal();
        }}
      >
        İtiraz aç
      </Button>
      <dialog
        ref={ref}
        aria-labelledby="dispute-open-title"
        className="m-auto w-[min(30rem,92vw)] rounded-2xl border bg-card p-5 text-card-foreground shadow-lg backdrop:bg-black/40"
      >
        <h3 id="dispute-open-title" className="text-lg font-semibold">
          Siparişe itiraz et
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          İtiraz açıldığında otomatik teslim onayı ve satıcı hakedişi durur; kararı yönetici verir.
          Bir sipariş için yalnızca bir kez itiraz edebilirsiniz.
        </p>
        <div className="mt-3 space-y-1">
          <label className="text-sm font-medium" htmlFor="dispute-reason">
            İtiraz nedeni (en az 10 karakter)
          </label>
          <textarea
            id="dispute-reason"
            className={inputCls + ' h-28 py-2'}
            value={reason}
            maxLength={2000}
            onChange={(e) => {
              setReason(e.target.value);
            }}
          />
        </div>
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
          <Button variant="destructive" disabled={busy || !ok} onClick={() => void submit()}>
            {busy ? 'Gönderiliyor…' : 'İtirazı gönder'}
          </Button>
        </div>
      </dialog>
    </span>
  );
}
