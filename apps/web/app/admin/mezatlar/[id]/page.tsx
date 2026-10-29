import Link from 'next/link';
import { AdminAuctionMonitor } from '@/components/admin-auction-monitor';
import { AdminTabs } from '@/components/admin-tabs';
import { Empty, LoadError, PageTitle } from '@/components/common';
import type { AdminAuctionDetail } from '@/lib/admin-types';
import { requireMe, serverGet } from '@/lib/server-api';

export const metadata = { title: 'Mezat izleme · Yönetim · ARC Global' };

export default async function AdminAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  if (!me.user.isAdmin) return <Empty>Bu sayfaya erişim yetkiniz yok.</Empty>;
  const { id } = await params;
  const res = await serverGet<AdminAuctionDetail>(`/admin/auctions/${id}`);
  return (
    <div className="space-y-6">
      <div>
        <PageTitle sub="Mezat izleme">{res.ok ? res.data.auction.title : 'Mezat'}</PageTitle>
        <AdminTabs current="mezatlar" />
        <Link href="/admin?tab=mezatlar" className="text-sm underline">
          ← Mezat listesi
        </Link>
      </div>
      {res.ok ? <AdminAuctionMonitor initial={res.data} /> : <LoadError error={res.error} />}
    </div>
  );
}
