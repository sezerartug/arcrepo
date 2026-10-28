import Link from 'next/link';
import { Empty, LoadError, ctaCls } from '@/components/common';
import { ListingCard } from '@/components/listing-card';
import { AuctionCard } from '@/components/auction-card';
import { loadCategories, serverGet } from '@/lib/server-api';
import { withUnits, type AuctionSummary, type ListingPage } from '@/lib/types';

export default async function HomePage() {
  const [listings, auctions, cats] = await Promise.all([
    serverGet<ListingPage>('/listings?sort=newest'),
    serverGet<AuctionSummary[]>('/auctions?status=live'),
    loadCategories(),
  ]);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-primary px-6 py-12 text-primary-foreground">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          İnşaat malzemesinde şirketler arası güvenli ticaret
        </h1>
        <p className="mt-3 max-w-2xl text-primary-foreground/80">
          Çelik ve yapı malzemelerini sabit fiyatla satın alın veya canlı mezatta teklif verin.
          Ödemeniz teslimata kadar emanette (escrow) güvende kalır.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/ilanlar" className={ctaCls}>
            İlanlara göz at
          </Link>
          <Link
            href="/kayit"
            className="inline-flex h-9 items-center rounded-lg border border-primary-foreground/40 px-4 text-sm font-medium hover:bg-primary-foreground/10 focus-visible:ring-3 focus-visible:ring-brand outline-none"
          >
            Şirketinizi kaydedin
          </Link>
        </div>
      </section>

      <section aria-labelledby="live-auctions">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="live-auctions" className="text-xl font-semibold text-primary">
            Canlı mezatlar
          </h2>
          <Link href="/mezatlar" className="text-sm underline">
            Tümü
          </Link>
        </div>
        {!auctions.ok ? (
          <LoadError error={auctions.error} />
        ) : auctions.data.length === 0 ? (
          <Empty>Şu anda canlı mezat yok.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.data.slice(0, 6).map((a) => (
              <AuctionCard key={a.id} auction={a} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="featured">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="featured" className="text-xl font-semibold text-primary">
            Öne çıkan ilanlar
          </h2>
          <Link href="/ilanlar" className="text-sm underline">
            Tümü
          </Link>
        </div>
        {!listings.ok ? (
          <LoadError error={listings.error} />
        ) : listings.data.items.length === 0 ? (
          <Empty>Henüz yayında ilan yok.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {withUnits(listings.data.items.slice(0, 8), cats).map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
