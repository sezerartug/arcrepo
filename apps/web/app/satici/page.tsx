import Link from 'next/link';
import { ActionButton } from '@/components/action-button';
import { Empty, LoadError, PageTitle, StatusBadge, ctaCls } from '@/components/common';
import { formatTry } from '@/lib/api';
import { loadCategories, requireMe, serverGet } from '@/lib/server-api';
import { withUnits, type Listing } from '@/lib/types';

export const metadata = { title: 'Satıcı paneli · ARC Global' };

export default async function SellerPage() {
  const me = await requireMe();
  if (me.company?.status !== 'verified') {
    return (
      <>
        <PageTitle>Satıcı paneli</PageTitle>
        <Empty>İlan verebilmek için şirketinizin yönetici tarafından onaylanması gerekir.</Empty>
      </>
    );
  }
  const [res, cats] = await Promise.all([
    serverGet<Listing[] | { items: Listing[] }>('/seller/listings'),
    loadCategories(),
  ]);
  const items = res.ok ? withUnits(Array.isArray(res.data) ? res.data : res.data.items, cats) : [];

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageTitle sub="İlanlarınız ve durumları">İlanlarım</PageTitle>
        <Link href="/satici/yeni" className={ctaCls}>
          Yeni ilan
        </Link>
      </div>
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : items.length === 0 ? (
        <Empty>Henüz ilanınız yok.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">İlanlarım</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th scope="col" className="py-2">
                  Başlık
                </th>
                <th scope="col">Tür</th>
                <th scope="col">Fiyat</th>
                <th scope="col">Durum</th>
                <th scope="col">
                  <span className="sr-only">İşlem</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-2">
                    <Link className="underline" href={`/ilanlar/${l.id}`}>
                      {l.title}
                    </Link>
                  </td>
                  <td>{l.saleType === 'auction' ? 'Mezat' : 'Sabit fiyat'}</td>
                  <td>
                    {formatTry(l.unitPriceMinor)} / {l.unit ?? 'birim'}
                  </td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="py-1 text-right">
                    {['pending_review', 'published'].includes(l.status) ? (
                      <ActionButton
                        path={`/listings/${l.id}/remove`}
                        label="Kaldır"
                        variant="outline"
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
