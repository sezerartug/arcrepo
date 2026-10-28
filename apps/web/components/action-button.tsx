'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { inputCls } from './common';

/** One-click POST/DELETE (optionally with a mandatory reason), then refreshes server data. */
export function ActionButton({
  path,
  label,
  method = 'POST',
  body,
  askReason = false,
  variant = 'default',
  onDoneMessage,
}: {
  path: string;
  label: string;
  method?: 'POST' | 'DELETE';
  body?: Record<string, unknown>;
  askReason?: boolean;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary';
  onDoneMessage?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      if (method === 'DELETE') await clientApi.del(path);
      else await clientApi.post(path, askReason ? { ...body, reason } : (body ?? {}));
      setOpen(false);
      setDone(onDoneMessage ?? null);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      {askReason && open ? (
        <span className="flex flex-wrap items-center gap-2">
          <input
            aria-label={`${label} nedeni`}
            className={inputCls + ' w-48'}
            placeholder="Neden (zorunlu)"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
          />
          <Button
            size="sm"
            variant={variant}
            disabled={busy || reason.trim().length < 3}
            onClick={() => void run()}
          >
            Onayla
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen(false);
            }}
          >
            Vazgeç
          </Button>
        </span>
      ) : (
        <Button
          size="sm"
          variant={variant}
          disabled={busy}
          onClick={
            askReason
              ? () => {
                  setOpen(true);
                }
              : run
          }
        >
          {busy ? 'İşleniyor…' : label}
        </Button>
      )}
      {done ? (
        <span role="status" className="text-xs text-success">
          {done}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
