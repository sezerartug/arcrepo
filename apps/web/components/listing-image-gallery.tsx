'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { request } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { imageSrc } from '@/lib/types';
import { ErrorBox, Field, inputCls } from './common';

const MAX_IMAGE = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGES = 8;

type Img = { id: string; url: string };

/** Add and delete listing images (owner or admin). The first image is the cover. */
export function ListingImageGallery({ listingId, initial }: { listingId: string; initial: Img[] }) {
  const router = useRouter();
  const [images, setImages] = useState<Img[]>(initial);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES) {
      setError(`En fazla ${String(MAX_IMAGES)} görsel eklenebilir.`);
      return;
    }
    for (const file of files) {
      if (!TYPES.includes(file.type)) {
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
    const failed: string[] = [];
    for (const file of files) {
      const body = new FormData();
      body.append('file', file);
      try {
        const img = await request<Img>('/api', `/listings/${listingId}/images`, {
          method: 'POST',
          body,
        });
        setImages((cur) => [...cur, img]);
      } catch (err) {
        failed.push(`${file.name}: ${errorMessage(err)}`);
      }
    }
    if (failed.length) setError(`Yüklenemeyen görseller: ${failed.join('; ')}`);
    setBusy(false);
    router.refresh();
  }

  async function remove(imageId: string) {
    setBusy(true);
    setError(null);
    try {
      await request('/api', `/listings/${listingId}/images/${imageId}`, { method: 'DELETE' });
      setImages((cur) => cur.filter((i) => i.id !== imageId));
      setConfirmId(null);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="gallery" className="max-w-3xl space-y-3">
      <h2 id="gallery" className="text-lg font-semibold text-primary">
        Görseller
      </h2>
      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Henüz görsel yok; ilanda kategori çizimi gösterilir.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="space-y-2 rounded-xl border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- API-served upload */}
              <img
                src={imageSrc(img)}
                alt={`İlan görseli ${String(i + 1)}`}
                className="aspect-[4/3] w-full rounded-lg object-cover"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{i === 0 ? 'Kapak' : ' '}</span>
                {confirmId === img.id ? (
                  <span className="flex items-center gap-1" role="group" aria-label="Silme onayı">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void remove(img.id)}
                    >
                      Evet, sil
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setConfirmId(null);
                      }}
                    >
                      Vazgeç
                    </Button>
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setConfirmId(img.id);
                    }}
                  >
                    Sil
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Field
        label="Görsel ekle"
        htmlFor="gallery-add"
        hint={`JPEG, PNG veya WebP; her biri en fazla 2 MB (en fazla ${String(MAX_IMAGES)} görsel)`}
      >
        <input
          id="gallery-add"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => void add(e)}
          className={inputCls + ' pt-1.5'}
        />
      </Field>
      {error ? <ErrorBox message={error} /> : null}
    </section>
  );
}
