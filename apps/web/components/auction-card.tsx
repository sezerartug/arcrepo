import Link from 'next/link';
import { formatTry } from '@/lib/api';
import { imageSrc, type AuctionSummary } from '@/lib/types';
import { CardCountdown } from './card-countdown';
import { Badge, StatusBadge } from './common';
import { LiveDot } from './live-dot';
import { PlaceholderArt } from './illustrations';

export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  const live = auction.status.toLowerCase() === 'live';
  return (
    <article className="group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-lg">
      {auction.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploads are served by the API, not optimizable
        <img
          src={imageSrc(auction.imageUrl)}
          alt={auction.title ?? 'Mezat görseli'}
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <PlaceholderArt category="mezat" className="aspect-[16/9] w-full" />
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          {live ? <LiveDot /> : <StatusBadge status={auction.status} />}
          {live ? (
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Kalan süre</span>
              <CardCountdown endsAt={auction.endsAt} />
            </span>
          ) : null}
        </div>
        <Badge tone="ok">%5 teminatlı</Badge>
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
