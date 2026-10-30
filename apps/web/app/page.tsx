import Image from 'next/image';
import Link from 'next/link';
import { Empty, LoadError, ctaCls } from '@/components/common';
import { ListingCard } from '@/components/listing-card';
import { AuctionCard } from '@/components/auction-card';
import { SectorCards } from '@/components/sector-cards';
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
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="categories" className="text-xl font-semibold text-primary">
            Sektörler
          </h2>
          <Link href="/ilanlar?condition=ikinci_el" className="text-sm underline">
            İkinci el ilanlar
          </Link>
        </div>
        <SectorCards categories={cats} />
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
      </section>
      <section
        aria-labelledby="about"
        className="full-bleed relative -mb-16 overflow-hidden text-chrome-foreground"
      >
        <div className="hero-gradient absolute inset-0" aria-hidden="true" />
        <Image src="/photos/about-santiye.jpg" alt="" fill sizes="100vw" className="object-cover" />
        <div
          className="absolute inset-0 bg-linear-to-r from-chrome/95 via-chrome/80 to-chrome/40"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-16">
          <h2 id="about" className="max-w-2xl text-2xl font-bold sm:text-4xl">
            Çelik ve inşaat ticaretinde güvenilir ortağınız
          </h2>
          <p className="mt-3 max-w-2xl text-chrome-foreground/85">
            ARC Global; doğrulanmış şirketleri, emanetli ödemeyi ve şeffaf mezatı tek platformda
            birleştirir. Biz kimiz, nasıl çalışıyoruz ve çelik alırken nelere dikkat etmelisiniz,
            öğrenin.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/hakkimizda" className={`${ctaCls} !h-11 !px-6 !text-base`}>
              Biz kimiz
            </Link>
            <Link
              href="/sektor-rehberi"
              className="inline-flex h-11 items-center rounded-lg border border-chrome-foreground/40 px-6 text-base font-medium outline-none hover:bg-chrome-foreground/10 focus-visible:ring-3 focus-visible:ring-brand"
            >
              Sektör rehberi
            </Link>
            <Link
              href="/iletisim"
              className="inline-flex h-11 items-center rounded-lg border border-chrome-foreground/40 px-6 text-base font-medium outline-none hover:bg-chrome-foreground/10 focus-visible:ring-3 focus-visible:ring-brand"
            >
              İletişim
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
