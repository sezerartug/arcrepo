'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { parseQtyToBase, parseTryToMinor, request } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import type { Category } from '@/lib/types';
import { ErrorBox, Field, inputCls } from './common';

const MAX_IMAGE = 2 * 1024 * 1024;

function parseAttrs(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0 && line.slice(i + 1).trim()) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

export function ListingForm({ categories }: { categories: Category[] }) {
  const [saleType, setSaleType] = useState<'fixed' | 'auction'>('fixed');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const cat = categories.find((c) => c.id === categoryId);
  const unit = cat?.unit ?? 'birim';

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const str = (k: string) => (typeof f.get(k) === 'string' ? (f.get(k) as string).trim() : '');
    if (!cat) {
      setError('Kategori seçin.');
      return;
    }

    const unitPrice = parseTryToMinor(str('unitPrice'));
    const qty = parseQtyToBase(str('quantity'), cat.basePerUnit);
    const minOrder = str('minOrder') ? parseQtyToBase(str('minOrder'), cat.basePerUnit) : null;
    if (!unitPrice || !qty) {
      setError('Fiyat ve miktar geçerli olmalıdır.');
      return;
    }
    if (str('minOrder') && !minOrder) {
      setError('Minimum sipariş miktarı geçersiz.');
      return;
    }

    let auction: Record<string, string> | undefined;
    if (saleType === 'auction') {
      const inc = parseTryToMinor(str('increment'));
      const reserve = str('reserve') ? parseTryToMinor(str('reserve')) : undefined;
      if (!inc || (str('reserve') && !reserve)) {
        setError('Artış veya rezerv tutarı geçersiz.');
        return;
      }
      const starts = new Date(str('startsAt'));
      const ends = new Date(str('endsAt'));
      if (isNaN(+starts) || isNaN(+ends) || ends <= starts) {
        setError('Bitiş, başlangıçtan sonra olmalıdır.');
        return;
      }
      auction = {
        startPriceMinor: unitPrice,
        minIncrementMinor: inc,
        ...(reserve ? { reserveMinor: reserve } : {}),
        startsAt: starts.toISOString(),
        endsAt: ends.toISOString(),
      };
    }

    const files = f.getAll('images').filter((x): x is File => x instanceof File && x.size > 0);
    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Görseller JPEG, PNG veya WebP olmalıdır.');
        return;
      }
      if (file.size > MAX_IMAGE) {
        setError('Her görsel en fazla 2 MB olabilir.');
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const created = await request<{ id: string }>('/api', '/listings', {
        method: 'POST',
        idempotent: true,
        json: {
          categoryId: cat.id,
          title: str('title'),
          description: str('description'),
          attrs: parseAttrs(str('attrs')),
          saleType,
          unitPriceMinor: unitPrice,
          quantityBase: qty,
          ...(minOrder ? { minOrderBase: minOrder } : {}),
          location: str('location'),
          deliveryTerms: str('deliveryTerms'),
          ...(auction ? { auction } : {}),
        },
      });
      const failed: string[] = [];
      for (const file of files) {
        const body = new FormData();
        body.append('file', file);
        try {
          await request('/api', `/listings/${created.id}/images`, { method: 'POST', body });
        } catch (err) {
          failed.push(`${file.name}: ${errorMessage(err)}`);
        }
      }
      form.reset();
      setDone(
        failed.length
          ? `İlan oluşturuldu ancak bazı görseller yüklenemedi (${failed.join('; ')}).`
          : 'İlan oluşturuldu ve incelemeye gönderildi.',
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const priceLabel =
    saleType === 'auction'
      ? `Başlangıç fiyatı (₺ / ${unit})`
      : `Birim fiyat (₺ / ${unit}, KDV hariç)`;

  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-3xl space-y-5">
      <Field label="Başlık" htmlFor="title">
        <input id="title" name="title" required minLength={5} className={inputCls} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label="Satış türü" htmlFor="saleType">
          <select
            id="saleType"
            className={inputCls}
            value={saleType}
            onChange={(e) => {
              setSaleType(e.target.value as 'fixed' | 'auction');
            }}
          >
            <option value="fixed">Sabit fiyat</option>
            <option value="auction">Mezat</option>
          </select>
        </Field>
      </div>
      <Field label="Açıklama" htmlFor="description">
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          className={inputCls + ' h-auto py-2'}
        />
      </Field>
      <Field
        label="Özellikler"
        htmlFor="attrs"
        hint="Her satıra bir özellik: “Çap: 12 mm”, “Kalite: B500C”"
      >
        <textarea id="attrs" name="attrs" rows={3} className={inputCls + ' h-auto py-2'} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={priceLabel} htmlFor="unitPrice">
          <input
            id="unitPrice"
            name="unitPrice"
            required
            inputMode="decimal"
            className={inputCls}
          />
        </Field>
        <Field label={`Miktar (${unit})`} htmlFor="quantity">
          <input id="quantity" name="quantity" required inputMode="decimal" className={inputCls} />
        </Field>
        <Field label={`Minimum sipariş (${unit})`} htmlFor="minOrder">
          <input id="minOrder" name="minOrder" inputMode="decimal" className={inputCls} />
        </Field>
      </div>
      {saleType === 'auction' ? (
        <fieldset className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
          <legend className="px-1 font-semibold text-primary">Mezat ayarları</legend>
          <Field label={`Minimum artış (₺ / ${unit})`} htmlFor="increment">
            <input
              id="increment"
              name="increment"
              required
              inputMode="decimal"
              className={inputCls}
            />
          </Field>
          <Field
            label={`Rezerv fiyat (₺ / ${unit}, gizli)`}
            htmlFor="reserve"
            hint="İsteğe bağlı; ulaşılmazsa satış olmaz"
          >
            <input id="reserve" name="reserve" inputMode="decimal" className={inputCls} />
          </Field>
          <Field label="Başlangıç" htmlFor="startsAt">
            <input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              required
              className={inputCls}
            />
          </Field>
          <Field label="Bitiş" htmlFor="endsAt">
            <input id="endsAt" name="endsAt" type="datetime-local" required className={inputCls} />
          </Field>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Teminat başlangıç fiyatı × miktarın %5&apos;idir. Son 60 saniyedeki teklifler süreyi
            uzatır.{' '}
          </p>
        </fieldset>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Konum" htmlFor="location">
          <input id="location" name="location" required className={inputCls} />
        </Field>
        <Field label="Teslimat koşulları" htmlFor="deliveryTerms">
          <input
            id="deliveryTerms"
            name="deliveryTerms"
            required
            className={inputCls}
            placeholder="Örn. Depodan teslim"
          />
        </Field>
      </div>
      <Field label="Görseller" htmlFor="images" hint="JPEG, PNG veya WebP; her biri en fazla 2 MB">
        <input
          id="images"
          name="images"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className={inputCls + ' pt-1.5'}
        />
      </Field>
      {error ? <ErrorBox message={error} /> : null}
      {done ? (
        <p
          role="status"
          className="rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-sm text-success"
        >
          {done}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? 'Kaydediliyor…' : 'İlanı gönder'}
      </Button>
    </form>
  );
}
