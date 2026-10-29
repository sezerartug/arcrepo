'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/api';
import type { Me } from '@/lib/types';
import { Logo } from './illustrations';

const linkCls =
  'rounded-lg px-3 py-1.5 text-sm font-medium text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-brand outline-none';

export function SiteHeader() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    clientApi
      .get<Me>('/me')
      .then(setMe)
      .catch(() => {
        setMe(null);
      });
  }, []);

  async function logout() {
    try {
      await clientApi.post('/auth/logout', undefined, false);
    } finally {
      setMe(null);
      router.push('/');
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3">
        <Link
          href="/"
          className="mr-4 rounded-lg focus-visible:ring-2 focus-visible:ring-brand outline-none"
        >
          <Logo className="h-8 w-auto" />
        </Link>
        <button
          type="button"
          className="ml-auto rounded-lg p-2 hover:bg-primary-foreground/10 focus-visible:ring-2 focus-visible:ring-brand outline-none md:hidden"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label="Menüyü aç/kapat"
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d={open ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} />
          </svg>
        </button>
        <div
          id="site-menu"
          className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-2 md:flex md:w-auto md:flex-1 md:flex-row md:items-center`}
        >
          <nav
            aria-label="Ana menü"
            className="flex flex-col gap-1 md:flex-row md:flex-wrap md:items-center"
          >
            <Link className={linkCls} href="/ilanlar">
              İlanlar
            </Link>
            <Link className={linkCls} href="/mezatlar">
              Mezatlar
            </Link>
            {me ? (
              <>
                <Link className={linkCls} href="/siparisler">
                  Siparişler
                </Link>
                <Link className={linkCls} href="/favoriler">
                  Favoriler
                </Link>
                <Link className={linkCls} href="/satici">
                  Satıcı
                </Link>
                {me.user.isAdmin ? (
                  <Link className={linkCls} href="/admin">
                    Yönetim
                  </Link>
                ) : null}
              </>
            ) : null}
          </nav>
          <div className="flex flex-col gap-1 md:ml-auto md:flex-row md:items-center">
            {me ? (
              <>
                <Link className={linkCls} href="/hesap">
                  {me.company?.legalName ?? me.user.fullName}
                </Link>
                <button type="button" className={linkCls} onClick={() => void logout()}>
                  Çıkış
                </button>
              </>
            ) : (
              <>
                <Link className={linkCls} href="/giris">
                  Giriş
                </Link>
                <Link
                  className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-brand-foreground transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary-foreground outline-none"
                  href="/kayit"
                >
                  Kayıt ol
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
