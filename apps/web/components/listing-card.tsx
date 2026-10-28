import Link from 'next/link';
import { formatDate, formatQty, formatTry } from '@/lib/api';
import { imageSrc, type Listing } from '@/lib/types';
import { Badge } from './common';

export function ListingImage({ listing, className }: { listing: Listing; className?: string }) {
  const first = listing.images?.[0];
  return first ? (
    // eslint-disable-next-line @next/next/no-img-element -- uploads are served by the API, not optimizable
    <img src={imageSrc(first)} alt={listing.title} className={className} />
  ) : (
    <div
      role="img"
      aria-label="Görsel yok"
      className={`flex items-center justify-center bg-muted text-xs text-muted-foreground ${className ?? ''}`}
    >
      Görsel yok
    </div>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  const unit = listing.unit ?? 'birim';
  const isAuction = listing.saleType === 'auction';
  return (
    <article className="relative overflow-hidden rounded-xl border bg-card transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      <ListingImage listing={listing} className="aspect-[4/3] w-full object-cover" />
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
        <p className="text-lg font-semibold text-primary">
          {isAuction && listing.auction
            ? formatTry(listing.auction.startPriceMinor)
            : formatTry(listing.unitPriceMinor)}
          <span className="text-xs font-normal text-muted-foreground"> / {unit}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {listing.basePerUnit
            ? `Stok: ${formatQty(listing.quantityBase, listing.basePerUnit, unit)}`
            : null}
          {isAuction && listing.auction ? ` · Bitiş: ${formatDate(listing.auction.endsAt)}` : null}
        </p>
      </div>
    </article>
  );
}
