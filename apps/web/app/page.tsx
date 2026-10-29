import Link from 'next/link';
import { Empty, LoadError } from '@/components/common';
import { ListingCard } from '@/components/listing-card';
import { AuctionCard } from '@/components/auction-card';
import { TopCategoryIcon } from '@/components/illustrations/category-icons';
import { HeroSlider } from '@/components/hero-slider';
import { HomeSearch } from '@/components/home-search';
import { HomeTabs } from '@/components/home-tabs';
import { TrustCenter } from '@/components/trust-center';
import { resolveTab } from '@/lib/home';
import { loadCategories, serverGet } from '@/lib/server-api';
import { withUnits, type AuctionList, type ListingPage } from '@/lib/types';

const STEPS = [
  { title: 'Kaydolun', text: 'Şirketinizi kaydedin, doğrulama sonrası işlem yapın.' },
  {
    title: 'Satın alın veya teklif verin',
    text: 'Sabit fiyatlı ilanları alın ya da mezata katılın.',
  },
  { title: 'Güvenle teslim alın', text: 'Ödeme emanette kalır, teslimat onayıyla satıcıya geçer.' },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string }>;
}) {
  const tab = resolveTab((await searchParams).sekme);
  const [listings, auctions, cats] = await Promise.all([
    serverGet<ListingPage>(`/listings?sort=newest${tab.query}`),
    serverGet<AuctionList>('/auctions?status=live'),
    loadCategories(),
  ]);

  return (
    <div className="space-y-10">
      <HeroSlider categories={cats} />
      <HomeSearch categories={cats} />
      <TrustCenter />
      <section aria-labelledby="categories">
        <h2 id="categories" className="mb-4 text-xl font-semibold text-primary">
          Kategoriler
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cats.map((c) => (
            <li key={c.id}>
              <Link
                href={`/ilanlar?categoryId=${encodeURIComponent(c.id)}`}
                className="group flex h-full flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
              >
                <TopCategoryIcon
                  slug={c.slug}
                  className="size-10 text-primary group-hover:text-brand"
                />
                <span className="text-sm font-medium">{c.name}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/ilanlar?condition=ikinci_el"
              className="group flex h-full flex-col items-center gap-2 rounded-2xl border border-brand/60 bg-brand/10 p-4 text-center shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg
                viewBox="0 0 32 32"
                className="size-10 text-primary group-hover:text-brand"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M6 16a10 10 0 0 1 17-7l3 3M26 16a10 10 0 0 1-17 7l-3-3M26 5v7h-7M6 27v-7h7" />
              </svg>
              <span className="text-sm font-medium">İkinci El</span>
            </Link>
          </li>
        </ul>
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
        ) : auctions.data.items.length === 0 ? (
          <Empty>Şu anda canlı mezat yok.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.data.items.slice(0, 6).map((a) => (
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
        <HomeTabs active={tab.key} />
        {!listings.ok ? (
          <LoadError error={listings.error} />
        ) : listings.data.items.length === 0 ? (
          <Empty>Bu sekmede şu anda yayında ilan yok.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {withUnits(listings.data.items.slice(0, 8), cats).map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="how">
        <h2 id="how" className="mb-4 text-xl font-semibold text-primary">
          Nasıl çalışır?
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border bg-card p-5 shadow-sm">
              <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>{' '}
    </div>
  );
}
