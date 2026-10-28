import { Empty, Field, LoadError, PageTitle, Pagination, inputCls } from '@/components/common';
import { ListingCard } from '@/components/listing-card';
import { Button } from '@/components/ui/button';
import { loadCategories, serverGet, toQuery } from '@/lib/server-api';
import { flattenCategories, withUnits, type ListingPage } from '@/lib/types';

type SP = Record<string, string | undefined>;

export const metadata = { title: 'İlanlar · ARC Global' };

export default async function ListingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const query = {
    q: sp.q,
    categoryId: sp.categoryId,
    saleType: sp.saleType,
    minPrice: toMinor(sp.minPrice),
    maxPrice: toMinor(sp.maxPrice),
    location: sp.location,
    sort: sp.sort,
    page: String(page),
  };
  const [res, tree] = await Promise.all([
    serverGet<ListingPage>(`/listings${toQuery(query)}`),
    loadCategories(),
  ]);
  const cats = flattenCategories(tree);
  const href = (p: number) => `/ilanlar${toQuery({ ...sp, page: String(p) })}`;

  return (
    <>
      <PageTitle sub="Yayındaki tüm ilanlar">İlanlar</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <form method="get" className="space-y-3" aria-label="İlan filtreleri">
          <Field label="Ara" htmlFor="q">
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={sp.q}
              className={inputCls}
              placeholder="Örn. inşaat demiri"
            />
          </Field>
          <Field label="Kategori" htmlFor="categoryId">
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={sp.categoryId ?? ''}
              className={inputCls}
            >
              <option value="">Tümü</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Satış türü" htmlFor="saleType">
            <select
              id="saleType"
              name="saleType"
              defaultValue={sp.saleType ?? ''}
              className={inputCls}
            >
              <option value="">Tümü</option>
              <option value="fixed">Sabit fiyat</option>
              <option value="auction">Mezat</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Min. fiyat (₺)" htmlFor="minPrice">
              <input
                id="minPrice"
                name="minPrice"
                inputMode="decimal"
                defaultValue={sp.minPrice}
                className={inputCls}
              />
            </Field>
            <Field label="Maks. fiyat (₺)" htmlFor="maxPrice">
              <input
                id="maxPrice"
                name="maxPrice"
                inputMode="decimal"
                defaultValue={sp.maxPrice}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Konum" htmlFor="location">
            <input id="location" name="location" defaultValue={sp.location} className={inputCls} />
          </Field>
          <Field label="Sıralama" htmlFor="sort">
            <select id="sort" name="sort" defaultValue={sp.sort ?? 'newest'} className={inputCls}>
              <option value="newest">En yeni</option>
              <option value="price_asc">Fiyat: artan</option>
              <option value="price_desc">Fiyat: azalan</option>
              <option value="ending">Bitişe yakın</option>
            </select>
          </Field>
          <Button type="submit" className="w-full">
            Filtrele
          </Button>
        </form>

        <section aria-live="polite">
          {!res.ok ? (
            <LoadError error={res.error} />
          ) : res.data.items.length === 0 ? (
            <Empty>Kriterlere uyan ilan bulunamadı.</Empty>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">{res.data.total} ilan</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {withUnits(res.data.items, tree).map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
              <Pagination page={page} total={res.data.total} href={href} />
            </>
          )}
        </section>
      </div>
    </>
  );
}

// Filter inputs are TL; the API expects kuruş. Invalid input is dropped.
function toMinor(v?: string): string | undefined {
  if (!v) return undefined;
  const s = v.trim().replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  const [w, f = ''] = s.split('.');
  return BigInt((w ?? '0') + f.padEnd(2, '0')).toString();
}
