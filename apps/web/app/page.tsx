import Link from 'next/link';
import { Empty, LoadError, ctaCls } from '@/components/common';
import { ListingCard } from '@/components/listing-card';
import { AuctionCard } from '@/components/auction-card';
import { CATEGORY_KINDS, CategoryIcon, HeroArt } from '@/components/illustrations';
import { loadCategories, serverGet } from '@/lib/server-api';
import {
  flattenCategories,
  withUnits,
  type AuctionList,
  type Category,
  type ListingPage,
} from '@/lib/types';

const TRUST = [
  {
    title: 'Escrow güvencesi',
    text: 'Ödeme teslimata kadar emanette.',
    icon: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4',
  },
  {
    title: 'Doğrulanmış şirketler',
    text: 'Alıcı ve satıcılar KYC onaylı.',
    icon: 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6',
  },
  {
    title: 'Canlı mezat',
    text: 'Gerçek zamanlı, adil teklif.',
    icon: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  },
];

const STEPS = [
  { title: 'Kaydolun', text: 'Şirketinizi kaydedin, doğrulama sonrası işlem yapın.' },
  {
    title: 'Satın alın veya teklif verin',
    text: 'Sabit fiyatlı ilanları alın ya da mezata katılın.',
  },
  { title: 'Güvenle teslim alın', text: 'Ödeme emanette kalır, teslimat onayıyla satıcıya geçer.' },
];

// Filters by category id when the tile's label matches a category; otherwise falls back to text search.
function categoryHref(tree: Category[], label: string): string {
  const match = flattenCategories(tree).find(
    (c) => c.name.toLocaleLowerCase('tr') === label.toLocaleLowerCase('tr'),
  );
  return match
    ? `/ilanlar?categoryId=${encodeURIComponent(match.id)}`
    : `/ilanlar?q=${encodeURIComponent(label)}`;
}

export default async function HomePage() {
  const [listings, auctions, cats] = await Promise.all([
    serverGet<ListingPage>('/listings?sort=newest'),
    serverGet<AuctionList>('/auctions?status=live'),
    loadCategories(),
  ]);

  return (
    <div className="space-y-10">
      <section className="hero-gradient relative overflow-hidden rounded-3xl text-primary-foreground shadow-lg">
        <div className="grid items-center gap-6 px-6 py-12 sm:px-10 lg:grid-cols-[1.2fr_1fr] lg:py-16">
          <div>
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
              İnşaat malzemesinde şirketler arası güvenli ticaret
            </h1>
            <p className="mt-4 max-w-xl text-lg text-primary-foreground/85">
              Çelik ve yapı malzemelerini sabit fiyatla satın alın veya canlı mezatta teklif verin.
              Ödemeniz teslimata kadar emanette (escrow) güvende kalır.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/ilanlar" className={`${ctaCls} !h-11 !px-6 !text-base shadow-md`}>
                İlanlara göz at
              </Link>
              <Link
                href="/kayit"
                className="inline-flex h-11 items-center rounded-lg border border-primary-foreground/40 px-6 text-base font-medium outline-none hover:bg-primary-foreground/10 focus-visible:ring-3 focus-visible:ring-brand"
              >
                Şirketinizi kaydedin
              </Link>
            </div>
          </div>
          <HeroArt className="mx-auto hidden h-auto w-full max-w-md lg:block" />
        </div>
      </section>
      <section aria-label="Güven" className="grid gap-3 sm:grid-cols-3">
        {TRUST.map((t) => (
          <div
            key={t.title}
            className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/20 text-primary">
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d={t.icon} />
              </svg>
            </span>
            <div>
              <p className="font-semibold text-primary">{t.title}</p>
              <p className="text-sm text-muted-foreground">{t.text}</p>
            </div>
          </div>
        ))}
      </section>
      <section aria-labelledby="categories">
        <h2 id="categories" className="mb-4 text-xl font-semibold text-primary">
          Kategoriler
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORY_KINDS.map((k) => (
            <li key={k.kind}>
              <Link
                href={categoryHref(cats, k.label)}
                className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CategoryIcon
                  kind={k.kind}
                  className="size-10 text-primary group-hover:text-brand"
                />
                <span className="text-sm font-medium">{k.label}</span>
              </Link>
            </li>
          ))}
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
