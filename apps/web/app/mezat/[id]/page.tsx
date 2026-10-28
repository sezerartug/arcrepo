import Link from 'next/link';
import { AuctionPanel } from '@/components/auction-panel';
import { LoadError, PageTitle } from '@/components/common';
import { ListingImage } from '@/components/listing-card';
import { formatQty, formatTry } from '@/lib/api';
import { getMe, loadCategories, serverGet } from '@/lib/server-api';
import { withUnits, type AuctionSnapshot, type Listing } from '@/lib/types';

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [snap, me, cats] = await Promise.all([
    serverGet<AuctionSnapshot>(`/auctions/${id}`),
    getMe(),
    loadCategories(),
  ]);
  if (!snap.ok)
    return snap.error.status === 404 ? <p>Mezat bulunamadı.</p> : <LoadError error={snap.error} />;

  const lr = await serverGet<Listing>(`/listings/${snap.data.listingId}`);
  const listing = lr.ok ? (withUnits([lr.data], cats)[0] ?? lr.data) : null;
  const unit = listing?.unit ?? 'birim';
  const isOwn = !!me?.company && !!listing && listing.companyId === me.company.id;

  return (
    <>
      <PageTitle
        sub={listing?.sellerCompanyName ? `Satıcı: ${listing.sellerCompanyName}` : undefined}
      >
        {listing?.title ?? 'Mezat'}
      </PageTitle>
      <div className="grid gap-8 lg:grid-cols-[1fr_26rem]">
        <div className="space-y-4">
          {listing ? (
            <>
              <ListingImage
                listing={listing}
                className="aspect-[16/10] w-full rounded-xl object-cover"
              />
              <p className="text-sm">{listing.description}</p>
              <p className="text-sm text-muted-foreground">
                Miktar: {formatQty(listing.quantityBase, listing.basePerUnit ?? 1, unit)} ·
                Başlangıç fiyatı: {formatTry(listing.unitPriceMinor)} / {unit}
              </p>
              <Link href={`/ilanlar/${listing.id}`} className="text-sm underline">
                İlan ayrıntıları
              </Link>
            </>
          ) : null}
        </div>
        <AuctionPanel
          initial={snap.data}
          loggedIn={!!me}
          canBid={me?.company?.status === 'verified' && !isOwn}
        />
      </div>
    </>
  );
}
