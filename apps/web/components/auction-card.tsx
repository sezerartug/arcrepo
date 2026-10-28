import Link from 'next/link';
import { formatDate, formatTry } from '@/lib/api';
import type { AuctionSummary } from '@/lib/types';
import { StatusBadge } from './common';

export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  return (
    <article className="relative space-y-1 rounded-xl border bg-card p-4 focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      <StatusBadge status={auction.status} />
      <h3 className="font-medium">
        <Link
          href={`/mezat/${auction.id}`}
          className="after:absolute after:inset-0 focus:outline-none"
        >
          {auction.title ?? `Mezat ${auction.id.slice(0, 8)}`}
        </Link>
      </h3>
      <p className="text-lg font-semibold text-primary">{formatTry(auction.currentPriceMinor)}</p>
      <p className="text-xs text-muted-foreground">
        {auction.bidCount ?? 0} teklif · Bitiş: {formatDate(auction.endsAt)}
      </p>
    </article>
  );
}
