import Link from 'next/link';
import { AuctionCard } from '@/components/auction-card';
import { Empty, LoadError, PageTitle } from '@/components/common';
import { serverGet } from '@/lib/server-api';
import type { AuctionSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Mezatlar · ARC Global' };

const TABS = [
  ['live', 'Canlı'],
  ['scheduled', 'Yaklaşan'],
  ['closed', 'Kapanan'],
] as const;

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const current = TABS.find(([s]) => s === status)?.[0] ?? 'live';
  const res = await serverGet<AuctionSummary[]>(`/auctions?status=${current}`);

  return (
    <>
      <PageTitle sub="Teminat yatırarak canlı mezatlara katılın">Mezatlar</PageTitle>
      <nav aria-label="Mezat durumu" className="mb-4 flex gap-2">
        {TABS.map(([s, label]) => (
          <Link
            key={s}
            href={`/mezatlar?status=${s}`}
            aria-current={s === current ? 'page' : undefined}
            className={cn(
              'rounded-full border px-4 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring outline-none',
              s === current ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : res.data.length === 0 ? (
        <Empty>Bu durumda mezat yok.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.data.map((a) => (
            <AuctionCard key={a.id} auction={a} />
          ))}
        </div>
      )}
    </>
  );
}
