import Link from 'next/link';
import { formatQty, formatTry } from '@/lib/api';
import { CONDITION_LABELS, imageSrc, type Listing } from '@/lib/types';
import { Badge } from './common';
import { CardCountdown } from './card-countdown';
import { PlaceholderArt } from './illustrations';

export function ListingImage({ listing, className }: { listing: Listing; className?: string }) {
  const first = listing.images?.[0];
  return first ? (
    // eslint-disable-next-line @next/next/no-img-element -- uploads are served by the API, not optimizable
    <img src={imageSrc(first)} alt={listing.title} className={className} />
  ) : (
    <div role="img" aria-label="Görsel yok" className={className}>
      <PlaceholderArt category={listing.categoryName} className="size-full" />
    </div>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  const unit = listing.unit ?? 'birim';
  const isAuction = listing.saleType === 'auction';
  return (
    <article className="relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative">
        <ListingImage listing={listing} className="aspect-[4/3] w-full object-cover" />
        {isAuction ? (
          <span className="absolute top-2 left-2 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-foreground shadow">
            MEZAT
          </span>
        ) : null}
        {listing.condition === 'ikinci_el' || listing.condition === 'hurda' ? (
          <span className="absolute top-2 right-2 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow">
            {CONDITION_LABELS[listing.condition]}
          </span>
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={isAuction ? 'warn' : 'neutral'}>{isAuction ? 'Mezat' : 'Sabit fiyat'}</Badge>
          {listing.location ? (
            <span className="text-xs text-muted-foreground">{listing.location}</span>
          ) : null}
        </div>
        <h3 className="line-clamp-2 font-medium">
          <Link
            href={`/ilanlar/${listing.id}`}
            className="after:absolute after:inset-0 focus:outline-none"
          >
            {listing.title}
          </Link>
        </h3>
        <p className="text-xl font-bold tracking-tight text-primary">
          {isAuction && listing.auction
            ? formatTry(listing.auction.startPriceMinor)
            : formatTry(listing.unitPriceMinor)}
          <span className="text-xs font-normal text-muted-foreground"> / {unit}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {listing.basePerUnit
            ? `Stok: ${formatQty(listing.quantityBase, listing.basePerUnit, unit)}`
            : null}
        </p>
        {isAuction && listing.auction ? (
          <div className="pt-1">
            <CardCountdown endsAt={listing.auction.endsAt} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
