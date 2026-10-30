import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DemoBanner } from '@/components/demo-banner';
import { Logo } from '@/components/illustrations';
import { SiteHeader } from '@/components/site-header';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { cn } from '@/lib/utils';
import './globals.css';

// latin-ext carries Turkish letters (ğ, ş, ı, İ).
const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'ARC Global',
  description: 'B2B inşaat malzemesi pazaryeri',
};

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
        <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="mt-8 bg-chrome text-chrome-foreground">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <Logo className="h-8 w-auto" />
              <p className="text-sm text-chrome-foreground/80">
                Şirketler arası çelik ve yapı malzemesi ticareti; emanetli ödeme ve canlı mezat.
              </p>
            </div>
            <nav aria-label="Pazaryeri" className="space-y-2 text-sm">
              <h2 className="font-semibold">Pazaryeri</h2>
              <ul className="space-y-1 text-chrome-foreground/80">
                <li>
                  <Link className="hover:underline" href="/ilanlar">
                    İlanlar
                  </Link>
                </li>
                <li>
                  <Link className="hover:underline" href="/mezatlar">
                    Mezatlar
                  </Link>
                </li>
                <li>
                  <Link className="hover:underline" href="/satici">
                    Satıcı paneli
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Hesap" className="space-y-2 text-sm">
              <h2 className="font-semibold">Hesap</h2>
              <ul className="space-y-1 text-chrome-foreground/80">
                <li>
                  <Link className="hover:underline" href="/giris">
                    Giriş
                  </Link>
                </li>
                <li>
                  <Link className="hover:underline" href="/kayit">
                    Şirket kaydı
                  </Link>
                </li>
                <li>
                  <Link className="hover:underline" href="/siparisler">
                    Siparişler
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="space-y-2 text-sm">
              <h2 className="font-semibold">Güvence</h2>
              <p className="text-chrome-foreground/80">
                Ödeme teslimata kadar emanette kalır. Yalnızca doğrulanmış şirketler işlem yapar.
              </p>
            </div>
          </div>
          <div className="border-t border-chrome-foreground/15 py-4 text-center text-xs text-chrome-foreground/70">
            © 2026 ARC Global · B2B inşaat malzemesi pazaryeri
          </div>
        </footer>{' '}
      </body>
    </html>
  );
}
