'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi, formatTry, parseTryToMinor } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { inputCls } from './common';

/** Admin decision on an open dispute: refund (amount in TL, converted to kuruş) or reject. */
export function AdminDisputeActions({
  disputeId,
  totalMinor,
}: {
  disputeId: string;
  totalMinor: string;
}) {
  const router = useRouter();
  const refundRef = useRef<HTMLDialogElement>(null);
  const rejectRef = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minor = parseTryToMinor(amount);
  const amountError =
    amount.trim() === ''
      ? null
      : minor === null || BigInt(minor) <= 0n
        ? 'Geçerli bir tutar girin (örn. 1.250,50).'
        : BigInt(minor) > BigInt(totalMinor)
          ? `Tutar sipariş toplamını (${formatTry(totalMinor)}) aşamaz.`
          : null;
  const noteOk = note.trim().length >= 3;

  async function send(body: Record<string, unknown>, dialog: HTMLDialogElement | null) {
    setBusy(true);
    setError(null);
    try {
      await clientApi.post(`/admin/disputes/${disputeId}/resolve`, body);
      dialog?.close();
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function open(which: 'refund' | 'reject') {
    setError(null);
    (which === 'refund' ? refundRef : rejectRef).current?.showModal();
  }
  const dialogCls =
    'm-auto w-[min(30rem,92vw)] rounded-2xl border bg-card p-5 text-card-foreground shadow-lg backdrop:bg-black/40';

  return (
    <span className="inline-flex flex-wrap gap-2">
      <Button
        size="sm"
        onClick={() => {
          open('refund');
        }}
      >
        İade et
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          open('reject');
        }}
      >
        İtirazı reddet
      </Button>

      <dialog ref={refundRef} aria-labelledby={`${disputeId}-rt`} className={dialogCls}>
        <h3 id={`${disputeId}-rt`} className="text-lg font-semibold">
          İade et
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sipariş toplamı {formatTry(totalMinor)}. Tam tutar girilirse sipariş “İade edildi” olur;
          kısmi iadede kalan tutar üzerinden komisyon kesilip satıcıya aktarılır.
        </p>
        <div className="mt-3 space-y-1">
          <label className="text-sm font-medium" htmlFor={`${disputeId}-amt`}>
            İade tutarı (₺)
          </label>
          <div className="flex gap-2">
            <input
              id={`${disputeId}-amt`}
              inputMode="decimal"
              className={inputCls}
              value={amount}
              placeholder="0,00"
              onChange={(e) => {
                setAmount(e.target.value);
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                setAmount(
                  (BigInt(totalMinor) / 100n).toString() +
                    ',' +
                    (BigInt(totalMinor) % 100n).toString().padStart(2, '0'),
                );
              }}
            >
              Tam iade
            </Button>
          </div>
          {amountError ? (
            <p role="alert" className="text-xs text-destructive">
              {amountError}
            </p>
          ) : null}
        </div>
        <div className="mt-3 space-y-1">
          <label className="text-sm font-medium" htmlFor={`${disputeId}-rn`}>
            Karar notu (zorunlu)
          </label>
          <textarea
            id={`${disputeId}-rn`}
            className={inputCls + ' h-20 py-2'}
            value={note}
            maxLength={1000}
            onChange={(e) => {
              setNote(e.target.value);
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
              refundRef.current?.close();
            }}
          >
            Vazgeç
          </Button>
          <Button
            disabled={busy || minor === null || amountError !== null || !noteOk}
            onClick={() =>
              void send(
                { outcome: 'refund', refundMinor: minor, note: note.trim() },
                refundRef.current,
              )
            }
          >
            {busy ? 'İşleniyor…' : 'İadeyi onayla'}
          </Button>
        </div>
      </dialog>

      <dialog ref={rejectRef} aria-labelledby={`${disputeId}-jt`} className={dialogCls}>
        <h3 id={`${disputeId}-jt`} className="text-lg font-semibold">
          İtirazı reddet
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          İade yapılmaz; satıcının hakedişi normal akışla açılır.
        </p>
        <div className="mt-3 space-y-1">
          <label className="text-sm font-medium" htmlFor={`${disputeId}-jn`}>
            Karar notu (zorunlu)
          </label>
          <textarea
            id={`${disputeId}-jn`}
            className={inputCls + ' h-20 py-2'}
            value={note}
            maxLength={1000}
            onChange={(e) => {
              setNote(e.target.value);
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
              rejectRef.current?.close();
            }}
          >
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !noteOk}
            onClick={() => void send({ outcome: 'reject', note: note.trim() }, rejectRef.current)}
          >
            {busy ? 'İşleniyor…' : 'Reddet'}
          </Button>
        </div>
      </dialog>
    </span>
  );
}
