import Link from 'next/link';
import { ActionButton } from '@/components/action-button';
import { AuctionPanel } from '@/components/auction-panel';
import { BuyForm } from '@/components/buy-form';
import { Card, LoadError, StatusBadge } from '@/components/common';
import { ListingImage } from '@/components/listing-card';
import { formatQty, formatTry } from '@/lib/api';
import { getMe, loadCategories, serverGet } from '@/lib/server-api';
import {
  imageSrc,
  withUnits,
  type AuctionList,
  type AuctionSnapshot,
  type Listing,
} from '@/lib/types';

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [res, cats, me] = await Promise.all([
    serverGet<Listing>(`/listings/${id}`),
    loadCategories(),
    getMe(),
  ]);
  if (!res.ok) {
    return res.error.status === 404 ? <p>İlan bulunamadı.</p> : <LoadError error={res.error} />;
  }
  const listing = withUnits([res.data], cats)[0] ?? res.data;
  const unit = listing.unit ?? 'birim';
  const bpu = listing.basePerUnit ?? 1;
  const verified = me?.company?.status === 'verified';
  const isOwn = !!me?.company && listing.companyId === me.company.id;
  // The listing's uction block carries no id; resolve it through the auctions list.
  const auctionId =
    listing.saleType === 'auction'
      ? await serverGet<AuctionList>('/auctions').then((r) =>
          r.ok ? r.data.items.find((a) => a.listingId === listing.id)?.id : undefined,
        )
      : undefined;
  const snap = auctionId ? await serverGet<AuctionSnapshot>(`/auctions/${auctionId}`) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <StatusBadge status={listing.status} />
            {listing.categoryName ? (
              <span className="text-sm text-muted-foreground">{listing.categoryName}</span>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold text-primary">{listing.title}</h1>
          {listing.sellerName ? (
            <p className="text-sm text-muted-foreground">Satıcı: {listing.sellerName}</p>
          ) : null}
        </div>

        <ListingImage listing={listing} className="aspect-[16/10] w-full rounded-xl object-cover" />
        {(isOwn || me?.user.isAdmin) &&
        listing.status !== 'removed' &&
        listing.status !== 'sold' ? (
          <Link
            href={`/satici/${listing.id}/duzenle`}
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
          >
            Düzenle / görseller
          </Link>
        ) : null}
        {(listing.images?.length ?? 0) > 1 ? (
          <ul className="flex gap-2 overflow-x-auto" aria-label="Diğer görseller">
            {(listing.images ?? []).slice(1).map((img) => (
              <li key={imageSrc(img)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- API-served upload */}
                <img src={imageSrc(img)} alt="" className="h-20 w-28 rounded-lg object-cover" />
              </li>
            ))}
          </ul>
        ) : null}

        {listing.description ? (
          <section aria-labelledby="desc">
            <h2 id="desc" className="mb-1 font-semibold">
              Açıklama
            </h2>
            <p className="whitespace-pre-line text-sm">{listing.description}</p>
          </section>
        ) : null}

        <section aria-labelledby="specs">
          <h2 id="specs" className="mb-1 font-semibold">
            Özellikler
          </h2>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Stok</dt>
            <dd>{formatQty(listing.quantityBase, bpu, unit)}</dd>
            {listing.minOrderBase ? (
              <>
                <dt className="text-muted-foreground">Minimum sipariş</dt>
                <dd>{formatQty(listing.minOrderBase, bpu, unit)}</dd>
              </>
            ) : null}
            {listing.location ? (
              <>
                <dt className="text-muted-foreground">Konum</dt>
                <dd>{listing.location}</dd>
              </>
            ) : null}
            {listing.deliveryTerms ? (
              <>
                <dt className="text-muted-foreground">Teslimat</dt>
                <dd>{listing.deliveryTerms}</dd>
              </>
            ) : null}
            {Object.entries(listing.attrs ?? {}).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <aside className="space-y-4" aria-label="Satın alma">
        {listing.saleType === 'fixed' ? (
          <Card className="space-y-3">
            <p className="text-3xl font-bold text-primary">
              {formatTry(listing.unitPriceMinor)}
              <span className="text-sm font-normal text-muted-foreground"> / {unit} + KDV</span>
            </p>
            {isOwn ? (
              <p className="text-sm text-muted-foreground">Bu ilan şirketinize ait.</p>
            ) : (
              <BuyForm
                listingId={listing.id}
                unitPriceMinor={listing.unitPriceMinor}
                unit={unit}
                basePerUnit={bpu}
                stockBase={Number(listing.quantityBase)}
                minOrderBase={Number(listing.minOrderBase ?? 1)}
                canBuy={verified}
                loggedIn={!!me}
              />
            )}
          </Card>
        ) : snap?.ok ? (
          <>
            {listing.auction?.reserveMinor ? (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                Rezerv fiyat (yalnızca satıcı ve yönetici görür):{' '}
                <strong>{formatTry(listing.auction.reserveMinor)}</strong> / {unit}
              </p>
            ) : null}
            <AuctionPanel initial={snap.data} canBid={verified && !isOwn} loggedIn={!!me} />
            <Link href={`/mezat/${snap.data.id}`} className="block text-sm underline">
              Mezat sayfasına git
            </Link>
          </>
        ) : snap ? (
          <LoadError error={snap.error} />
        ) : null}
        {me ? (
          <ActionButton
            path={`/listings/${listing.id}/favorite`}
            label={listing.isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
            method={listing.isFavorite ? 'DELETE' : 'POST'}
            variant="outline"
          />
        ) : null}
      </aside>
    </div>
  );
}
