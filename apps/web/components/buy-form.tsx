'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi, formatQty, formatTry, lineTotalPreview, parseQtyToBase } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import type { Order } from '@/lib/types';
import { ErrorBox, Field, inputCls } from './common';

export function BuyForm({
  listingId,
  unitPriceMinor,
  unit,
  basePerUnit,
  stockBase,
  minOrderBase,
  canBuy,
  loggedIn,
}: {
  listingId: string;
  unitPriceMinor: string;
  unit: string;
  basePerUnit: number;
  stockBase: number;
  minOrderBase: number;
  canBuy: boolean;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = parseQtyToBase(qty, basePerUnit);
  const total = base ? lineTotalPreview(unitPriceMinor, base, basePerUnit) : null;

  if (!loggedIn) {
    return (
      <p className="text-sm">
        Satın almak için{' '}
        <Link className="underline" href="/giris">
          giriş yapın
        </Link>
        .
      </p>
    );
  }
  if (!canBuy)
    return (
      <p className="text-sm text-muted-foreground">
        Satın almak için şirketinizin onaylı olması gerekir.
      </p>
    );

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!base) {
      setError('Geçerli bir miktar girin.');
      return;
    }
    if (base < minOrderBase) {
      setError(`Minimum sipariş ${formatQty(minOrderBase, basePerUnit, unit)}.`);
      return;
    }
    if (base > stockBase) {
      setError(`Stok yetersiz (en fazla ${formatQty(stockBase, basePerUnit, unit)}).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const order = await clientApi.post<Order>(`/listings/${listingId}/buy`, {
        quantityBase: base,
      });
      router.push(`/siparisler/${order.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <Field
        label={`Miktar (${unit})`}
        htmlFor="qty"
        hint={`Minimum ${formatQty(minOrderBase, basePerUnit, unit)} · Stok ${formatQty(stockBase, basePerUnit, unit)}`}
      >
        <input
          id="qty"
          inputMode="decimal"
          className={inputCls}
          value={qty}
          onChange={(e) => {
            setQty(e.target.value);
          }}
        />
      </Field>
      {total ? (
        <p className="text-sm">
          Tahmini toplam (KDV hariç): <strong>{formatTry(total)}</strong>
        </p>
      ) : null}
      {error ? <ErrorBox message={error} /> : null}
      <Button type="submit" disabled={busy || !base}>
        {busy ? 'Sipariş oluşturuluyor…' : 'Satın al'}
      </Button>
    </form>
  );
}
