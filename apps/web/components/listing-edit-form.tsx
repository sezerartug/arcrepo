'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { parseQtyToBase, parseTryToMinor, request } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import type { Category, Listing } from '@/lib/types';
import { ErrorBox, Field, inputCls } from './common';

function attrsToText(attrs: Listing['attrs']): string {
  return Object.entries(attrs ?? {})
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join('\n');
}

function parseAttrs(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0 && line.slice(i + 1).trim()) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

/** kuruş -> "1234,56" (no thousands separator, so parseTryToMinor reads it back). */
function minorToInput(minor: string): string {
  const v = BigInt(minor);
  return `${(v / 100n).toString()},${(v % 100n).toString().padStart(2, '0')}`;
}

/** base units -> sales units as text ("12,5"). */
function qtyToInput(base: number | string, basePerUnit: number): string {
  return String(Number(base) / basePerUnit).replace('.', ',');
}

/**
 * Edits the fields PATCH /listings/:id accepts. Sale type and auction parameters are fixed at
 * creation, so for auction listings the price is not editable here. Saving sends the listing back
 * to review (backend rule).
 */
export function ListingEditForm({
  listing,
  categories,
}: {
  listing: Listing;
  categories: Category[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(listing.categoryId ?? categories[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cat = categories.find((c) => c.id === categoryId);
  const unit = cat?.unit ?? 'birim';
  const isAuction = listing.saleType === 'auction';

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => (typeof f.get(k) === 'string' ? (f.get(k) as string).trim() : '');
    if (!cat) {
      setError('Kategori seçin.');
      return;
    }
    const qty = parseQtyToBase(str('quantity'), cat.basePerUnit);
    const minOrder = str('minOrder') ? parseQtyToBase(str('minOrder'), cat.basePerUnit) : null;
    const unitPrice = isAuction ? null : parseTryToMinor(str('unitPrice'));
    if (!qty || (!isAuction && !unitPrice)) {
      setError('Fiyat ve miktar geçerli olmalıdır.');
      return;
    }
    if (str('minOrder') && !minOrder) {
      setError('Minimum sipariş miktarı geçersiz.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await request('/api', `/listings/${listing.id}`, {
        method: 'PATCH',
        json: {
          categoryId: cat.id,
          title: str('title'),
          description: str('description'),
          attrs: parseAttrs(str('attrs')),
          ...(unitPrice ? { unitPriceMinor: unitPrice } : {}),
          quantityBase: qty,
          ...(minOrder ? { minOrderBase: minOrder } : {}),
          location: str('location'),
          deliveryTerms: str('deliveryTerms'),
        },
      });
      router.push('/satici');
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-3xl space-y-5">
      <Field label="Başlık" htmlFor="title">
        <input
          id="title"
          name="title"
          required
          minLength={5}
          defaultValue={listing.title}
          className={inputCls}
        />
      </Field>
      <Field label="Kategori" htmlFor="category">
        <select
          id="category"
          className={inputCls}
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
          }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.unit})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Açıklama" htmlFor="description">
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          defaultValue={listing.description ?? ''}
          className={inputCls + ' h-auto py-2'}
        />
      </Field>
      <Field label="Özellikler" htmlFor="attrs" hint="Her satıra bir özellik: “Çap: 12 mm”">
        <textarea
          id="attrs"
          name="attrs"
          rows={3}
          defaultValue={attrsToText(listing.attrs)}
          className={inputCls + ' h-auto py-2'}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        {isAuction ? (
          <p className="text-xs text-muted-foreground sm:self-end">
            Mezat fiyatı ve süreleri ilan oluşturulurken belirlenir; değiştirilemez.
          </p>
        ) : (
          <Field label={`Birim fiyat (₺ / ${unit}, KDV hariç)`} htmlFor="unitPrice">
            <input
              id="unitPrice"
              name="unitPrice"
              required
              inputMode="decimal"
              defaultValue={minorToInput(listing.unitPriceMinor)}
              className={inputCls}
            />
          </Field>
        )}
        <Field label={`Miktar (${unit})`} htmlFor="quantity">
          <input
            id="quantity"
            name="quantity"
            required
            inputMode="decimal"
            defaultValue={qtyToInput(listing.quantityBase, listing.basePerUnit ?? 1)}
            className={inputCls}
          />
        </Field>
        <Field label={`Minimum sipariş (${unit})`} htmlFor="minOrder">
          <input
            id="minOrder"
            name="minOrder"
            inputMode="decimal"
            defaultValue={
              listing.minOrderBase ? qtyToInput(listing.minOrderBase, listing.basePerUnit ?? 1) : ''
            }
            className={inputCls}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Konum" htmlFor="location">
          <input
            id="location"
            name="location"
            required
            defaultValue={listing.location ?? ''}
            className={inputCls}
          />
        </Field>
        <Field label="Teslimat koşulları" htmlFor="deliveryTerms">
          <input
            id="deliveryTerms"
            name="deliveryTerms"
            required
            defaultValue={listing.deliveryTerms ?? ''}
            className={inputCls}
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Kaydettiğinizde ilan yeniden yönetici incelemesine gider.
      </p>
      {error ? <ErrorBox message={error} /> : null}
      <Button type="submit" disabled={busy}>
        {busy ? 'Kaydediliyor…' : 'Kaydet ve incelemeye gönder'}
      </Button>
    </form>
  );
}
