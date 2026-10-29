import Link from 'next/link';
import { ActionButton } from '@/components/action-button';
import { Empty, LoadError, PageTitle, StatusBadge, ctaCls } from '@/components/common';
import { formatDate, formatTry } from '@/lib/api';
import { loadCategories, requireMe, serverGet } from '@/lib/server-api';
import { SellerSummaryCards } from '@/components/seller-summary';
import { computeSellerSummary } from '@/lib/home';
import { withUnits, type AuctionList, type Listing, type Order } from '@/lib/types';

type Payouts = {
  balanceMinor: string;
  orders: {
    orderId: string;
    listingTitle: string;
    totalMinor: string;
    commissionMinor: string;
    netMinor: string;
    completedAt: string;
  }[];
};

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
  const [res, cats, payouts, ordersRes, liveRes] = await Promise.all([
    serverGet<Listing[] | { items: Listing[] }>('/seller/listings'),
    loadCategories(),
    serverGet<Payouts>('/seller/payouts'),
    serverGet<Order[] | { items: Order[] }>('/orders'),
    serverGet<AuctionList>('/auctions?status=live'),
  ]);
  const summary = computeSellerSummary({
    listings: res.ok ? (Array.isArray(res.data) ? res.data : res.data.items) : null,
    liveAuctions: liveRes.ok ? liveRes.data.items : null,
    orders: ordersRes.ok
      ? Array.isArray(ordersRes.data)
        ? ordersRes.data
        : ordersRes.data.items
      : null,
    payoutBalanceMinor: payouts.ok ? payouts.data.balanceMinor : null,
    companyId: me.company.id,
  });
  const items = res.ok ? withUnits(Array.isArray(res.data) ? res.data : res.data.items, cats) : [];

  return (
    <>
      <SellerSummaryCards summary={summary} />
      <div id="ilanlarim" className="flex items-start justify-between gap-4">
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
                    <div className="flex justify-end gap-2">
                      {l.status === 'pending_review' ||
                      l.status === 'rejected' ||
                      (l.status === 'published' && l.saleType === 'fixed') ? (
                        <Link
                          href={`/satici/${l.id}/duzenle`}
                          className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
                        >
                          Düzenle
                        </Link>
                      ) : null}
                      {['pending_review', 'published'].includes(l.status) ? (
                        <ActionButton
                          path={`/listings/${l.id}/remove`}
                          label="Kaldır"
                          variant="outline"
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section aria-labelledby="payouts" className="mt-10">
        <h2 id="payouts" className="mb-2 text-lg font-semibold text-primary">
          Hakedişlerim
        </h2>
        {!payouts.ok ? (
          <LoadError error={payouts.error} />
        ) : (
          <>
            <p className="mb-2 text-sm">
              Bekleyen hakediş bakiyesi: <strong>{formatTry(payouts.data.balanceMinor)}</strong>
            </p>
            {payouts.data.orders.length === 0 ? (
              <Empty>Henüz tamamlanan sipariş yok.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Tamamlanan siparişler</caption>
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-2">
                        Sipariş
                      </th>
                      <th scope="col">Tutar</th>
                      <th scope="col">Komisyon</th>
                      <th scope="col">Net</th>
                      <th scope="col">Tamamlanma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.data.orders.map((p) => (
                      <tr key={p.orderId} className="border-t">
                        <td className="py-2">{p.listingTitle}</td>
                        <td>{formatTry(p.totalMinor)}</td>
                        <td>{formatTry(p.commissionMinor)}</td>
                        <td className="font-semibold">{formatTry(p.netMinor)}</td>
                        <td className="text-muted-foreground">{formatDate(p.completedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
