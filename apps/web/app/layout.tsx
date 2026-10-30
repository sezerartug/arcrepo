import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DemoBanner } from '@/components/demo-banner';
import { Logo } from '@/components/illustrations';
import { SiteHeader } from '@/components/site-header';
import { COMPANY } from '@/lib/company';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { cn } from '@/lib/utils';
import './globals.css';

// latin-ext carries Turkish letters (ğ, ş, ı, İ).
const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'ARC Global',
  description: 'B2B inşaat malzemesi pazaryeri',
};

const FOOTER_LINKS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Pazaryeri',
    links: [
      ['/ilanlar', 'İlanlar'],
      ['/mezatlar', 'Mezatlar'],
      ['/satici', 'Satıcı paneli'],
      ['/siparisler', 'Siparişler'],
    ],
  },
  {
    title: 'Kurumsal',
    links: [
      ['/hakkimizda', 'Biz kimiz'],
      ['/sektor-rehberi', 'Sektör rehberi'],
      ['/sss', 'Sık sorulan sorular'],
      ['/iletisim', 'İletişim'],
    ],
  },
  {
    title: 'Yasal',
    links: [
      ['/kvkk', 'KVKK aydınlatma metni'],
      ['/gizlilik', 'Gizlilik ve çerez politikası'],
      ['/kullanim-sartlari', 'Kullanım şartları'],
      ['/mezat-kurallari', 'Mezat kuralları'],
    ],
  },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className={cn('font-sans', geist.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-svh flex-col antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
        >
          İçeriğe geç
        </a>
        <DemoBanner />
        <SiteHeader />
        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="mt-8 bg-chrome text-chrome-foreground">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="space-y-3">
              <Logo className="h-8 w-auto" />
              <p className="text-sm text-chrome-foreground/80">
                Şirketler arası çelik ve yapı malzemesi ticareti; emanetli ödeme ve canlı mezat.
              </p>
              <address className="space-y-1 text-sm not-italic text-chrome-foreground/80">
                <p>{COMPANY.address}</p>
                <p>
                  <a className="hover:underline" href={`tel:${COMPANY.phone.replace(/\s/g, '')}`}>
                    {COMPANY.phone}
                  </a>
                  {' · '}
                  <a className="hover:underline" href={`mailto:${COMPANY.email}`}>
                    {COMPANY.email}
                  </a>
                </p>
              </address>
            </div>
            {FOOTER_LINKS.map((g) => (
              <nav key={g.title} aria-label={g.title} className="space-y-2 text-sm">
                <h2 className="font-semibold">{g.title}</h2>
                <ul className="space-y-1 text-chrome-foreground/80">
                  {g.links.map(([href, label]) => (
                    <li key={href}>
                      <Link className="hover:underline" href={href}>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="border-t border-chrome-foreground/15 px-4 py-4 text-center text-xs text-chrome-foreground/70">
            © 2026 {COMPANY.name} · MERSİS {COMPANY.mersis} · Yalnızca şirketlere hizmet verir.
          </div>
        </footer>
      </body>
    </html>
  );
}
