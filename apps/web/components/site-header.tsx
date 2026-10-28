'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/api';
import type { Me } from '@/lib/types';

const linkCls =
  'rounded px-2 py-1 text-sm hover:bg-primary-foreground/10 focus-visible:ring-2 focus-visible:ring-brand outline-none';

export function SiteHeader() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

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
    <header className="bg-primary text-primary-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2">
        <Link href="/" className="mr-4 text-lg font-bold tracking-tight">
          ARC Global
        </Link>
        <nav aria-label="Ana menü" className="flex flex-wrap items-center gap-1">
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
              {me.user.isPlatformAdmin ? (
                <Link className={linkCls} href="/admin">
                  Yönetim
                </Link>
              ) : null}
            </>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-1">
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
                className="rounded bg-brand px-3 py-1 text-sm font-semibold text-brand-foreground focus-visible:ring-2 focus-visible:ring-primary-foreground outline-none"
                href="/kayit"
              >
                Kayıt ol
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
