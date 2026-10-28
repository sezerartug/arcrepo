import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
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
    <html lang="tr" className={cn('font-sans', geist.variable)}>
      <body className="flex min-h-svh flex-col antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
        >
          İçeriğe geç
        </a>
        <SiteHeader />
        <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground">
            ARC Global · B2B inşaat malzemesi pazaryeri
          </div>
        </footer>
      </body>
    </html>
  );
}
