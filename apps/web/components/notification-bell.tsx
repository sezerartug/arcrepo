'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clientApi } from '@/lib/api';
import type { AppNotification } from '@/lib/types';

const POLL_MS = 20_000;

/** Open a notification: mark it read, then go to the page it points to. */
export async function openNotification(n: AppNotification, go: (href: string) => void) {
  if (!n.read) {
    try {
      await clientApi.post(`/notifications/${n.id}/read`, undefined, false);
    } catch {
      // Navigation matters more than the read flag.
    }
  }
  go(n.link ?? '/bildirimler');
}

/** Bell with unread badge (polls every 20 s) and a dropdown of the latest notifications. */
export function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    clientApi
      .get<{ count: number }>('/notifications/unread-count')
      .then((r) => {
        setCount(r.count);
      })
      .catch(() => {
        // Polling is best effort.
      });
  }, []);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, POLL_MS);
    return () => {
      clearInterval(t);
    };
  }, [refreshCount]);

  const loadItems = useCallback(() => {
    clientApi
      .get<{ items: AppNotification[] }>('/notifications')
      .then((r) => {
        setItems(r.items.slice(0, 8));
      })
      .catch(() => {
        setItems([]);
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    loadItems();
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, loadItems]);

  async function readAll() {
    try {
      await clientApi.post('/notifications/read-all', undefined, false);
    } finally {
      refreshCount();
      loadItems();
      router.refresh();
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="relative rounded-lg p-2 text-chrome-foreground/90 hover:bg-chrome-foreground/10 hover:text-chrome-foreground focus-visible:ring-2 focus-visible:ring-brand outline-none"
        aria-label={count > 0 ? `Bildirimler, ${String(count)} okunmamış` : 'Bildirimler'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
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
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 ? (
          <span
            data-testid="notification-badge"
            className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-brand-foreground"
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="region"
          aria-label="Bildirimler"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,92vw)] rounded-xl border bg-card p-2 text-card-foreground shadow-lg"
        >
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-semibold">Bildirimler</span>
            <button
              type="button"
              className="text-xs underline disabled:no-underline disabled:opacity-50"
              disabled={count === 0}
              onClick={() => void readAll()}
            >
              Tümünü okundu işaretle
            </button>
          </div>
          {items === null ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Yükleniyor…</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Bildiriminiz yok.</p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
                    onClick={() => {
                      setOpen(false);
                      void openNotification(n, (href) => {
                        router.push(href);
                        refreshCount();
                      });
                    }}
                  >
                    <span className={`block text-sm ${n.read ? '' : 'font-semibold'}`}>
                      {n.read ? null : (
                        <span className="mr-1.5 inline-block size-2 rounded-full bg-brand" />
                      )}
                      {n.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">{n.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t px-2 pt-2 text-right">
            <Link
              href="/bildirimler"
              className="text-sm underline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Tümünü gör
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
