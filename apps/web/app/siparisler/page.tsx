import Link from 'next/link';
import { Empty, LoadError, PageTitle, StatusBadge } from '@/components/common';
import { formatDate, formatTry } from '@/lib/api';
import { requireMe, serverGet } from '@/lib/server-api';
import type { Order } from '@/lib/types';

export const metadata = { title: 'Siparişler · ARC Global' };

export default async function OrdersPage() {
  const me = await requireMe();
  const res = await serverGet<Order[] | { items: Order[] }>('/orders');
  const orders = res.ok ? (Array.isArray(res.data) ? res.data : res.data.items) : [];

  return (
    <>
      <PageTitle>Siparişler</PageTitle>
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : orders.length === 0 ? (
        <Empty>Henüz siparişiniz yok.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Siparişleriniz</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th scope="col" className="py-2">
                  Sipariş
                </th>
                <th scope="col">Rol</th>
                <th scope="col">Tutar</th>
                <th scope="col">Durum</th>
                <th scope="col">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="py-2">
                    <Link className="underline" href={`/siparisler/${o.id}`}>
                      {o.listingTitle ?? `#${o.id.slice(0, 8)}`}
                    </Link>
                  </td>
                  <td>{o.buyerCompanyId === me.company?.id ? 'Alıcı' : 'Satıcı'}</td>
                  <td>{formatTry(o.totalMinor)}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="text-muted-foreground">
                    {o.createdAt ? formatDate(o.createdAt) : '—'}
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
