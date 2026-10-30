import Image from 'next/image';
import Link from 'next/link';
import { ctaCls } from '@/components/common';
import { loadCategories } from '@/lib/server-api';
import { SectorCards } from '@/components/sector-cards';
import { COMPANY } from '@/lib/company';

export const metadata = { title: 'Biz Kimiz · ARC Global' };

const VALUES = [
  [
    'Doğrulanmış şirketler',
    'Platformda yalnızca vergi numarası kontrol edilmiş ve yönetici onayından geçmiş şirketler işlem yapar.',
  ],
  [
    'Emanetli ödeme',
    'Ödeme, teslim onayına kadar emanette tutulur; satıcıya hakediş teslimden sonra aktarılır.',
  ],
  [
    'Şeffaf mezat',
    'Teklifler anonim, süre sunucu saatiyle yönetilir, tüm kritik işlemler denetim kaydına yazılır.',
  ],
  [
    'Kurumsal süreç',
    'İlan, sipariş, itiraz ve iade adımları kayıt altındadır; her işlemin sahibi ve zamanı bellidir.',
  ],
] as const;

export default async function AboutPage() {
  const cats = await loadCategories();
  return (
    <div className="wide space-y-12">
      <section className="full-bleed relative -mt-8 overflow-hidden text-chrome-foreground">
        <div className="hero-gradient absolute inset-0" aria-hidden="true" />
        <Image
          src="/photos/about-celik.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-linear-to-r from-chrome/95 via-chrome/80 to-chrome/40"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 lg:py-24">
          <p className="text-sm font-semibold tracking-wide text-brand uppercase">Biz kimiz</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Çelik ve inşaat ticaretinde şirketler arası güvenli pazaryeri
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-chrome-foreground/85">
            {COMPANY.name}, çelik, yapı malzemesi ve sanayi ekipmanı ticaretini şeffaf, kayıtlı ve
            güvenli hale getirmek için ARC Global platformunu işletir.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/kayit" className={`${ctaCls} !h-11 !px-6 !text-base`}>
              Şirketinizi kaydedin
            </Link>
            <Link
              href="/iletisim"
              className="inline-flex h-11 items-center rounded-lg border border-chrome-foreground/40 px-6 text-base font-medium outline-none hover:bg-chrome-foreground/10 focus-visible:ring-3 focus-visible:ring-brand"
            >
              Bize ulaşın
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="mission" className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
        <div className="relative min-h-56 overflow-hidden rounded-2xl lg:row-span-2">
          <Image
            src="/photos/about-lojistik.jpg"
            alt="Konteyner limanı"
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 id="mission" className="text-xl font-semibold text-primary">
            Neden ARC Global?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Çelik ve inşaat malzemesi ticareti çoğunlukla telefon, mesaj ve güvene dayalı
            havalelerle yürür. Fiyatın doğru oluştuğunu, ödemenin karşı tarafa güvenle ulaştığını ve
            malın teslim edildiğini kanıtlamak zordur. ARC Global bu süreci tek bir platformda
            toplar: ilan verin, sabit fiyatla satın alın ya da canlı mezatta en iyi fiyatı bulun;
            ödemeniz teslim onayına kadar emanette kalsın.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-primary">Kimler için?</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Yalnızca şirketler için. Çelik üreticileri ve toptancıları, müteahhitler, imalatçılar,
            makine ve ekipman satıcıları ile hurda ve geri dönüşüm firmaları; hem alıcı hem satıcı
            olarak aynı hesapla çalışabilir.
          </p>
        </div>
      </section>

      <section aria-labelledby="values">
        <h2 id="values" className="mb-4 text-xl font-semibold text-primary">
          Güven ilkelerimiz
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(([t, d]) => (
            <li key={t} className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="font-semibold text-primary">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sectors">
        <h2 id="sectors" className="mb-4 text-xl font-semibold text-primary">
          Faaliyet alanlarımız
        </h2>
        <SectorCards categories={cats} />
      </section>

      <section
        aria-labelledby="corp"
        className="mx-auto max-w-5xl rounded-2xl border bg-card p-6 shadow-sm"
      >
        <h2 id="corp" className="text-lg font-semibold text-primary">
          Kurumsal bilgiler
        </h2>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Ticaret unvanı</dt>
            <dd>{COMPANY.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">MERSİS no</dt>
            <dd>{COMPANY.mersis}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Vergi dairesi / no</dt>
            <dd>
              {COMPANY.taxOffice} / {COMPANY.taxNo}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">KEP adresi</dt>
            <dd>{COMPANY.kep}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Adres</dt>
            <dd>{COMPANY.address}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
