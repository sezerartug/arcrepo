import Link from 'next/link';
import { formatTry } from '@/lib/api';
import type { AuctionSummary } from '@/lib/types';
import { CardCountdown } from './card-countdown';
import { StatusBadge } from './common';
import { PlaceholderArt } from './illustrations';

export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  const live = auction.status.toLowerCase() === 'live';
  return (
    <article className="group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-lg">
      <PlaceholderArt category="mezat" className="h-20 w-full" />
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={auction.status} />
          {live ? <CardCountdown endsAt={auction.endsAt} /> : null}
        </div>
        <h3 className="line-clamp-2 font-medium">
          <Link
            href={`/mezat/${auction.id}`}
            className="after:absolute after:inset-0 focus:outline-none"
          >
            {auction.title ?? `Mezat ${auction.id.slice(0, 8)}`}
          </Link>
        </h3>
        <p className="text-2xl font-bold tracking-tight text-primary">
          {formatTry(auction.currentPriceMinor ?? auction.startPriceMinor)}
        </p>
        <p className="text-xs text-muted-foreground">{auction.bidCount ?? 0} teklif</p>
      </div>
    </article>
  );
}
