'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { clientApi, formatDate } from '@/lib/api';
import type { AppNotification } from '@/lib/types';
import { openNotification } from './notification-bell';

/** Full notification list: a click marks the item read and opens the related page. */
export function NotificationList({
  items,
  hasUnread,
}: {
  items: AppNotification[];
  hasUnread: boolean;
}) {
  const router = useRouter();

  async function readAll() {
    try {
      await clientApi.post('/notifications/read-all', undefined, false);
    } finally {
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {hasUnread ? (
        <Button size="sm" variant="outline" onClick={() => void readAll()}>
          Tümünü okundu işaretle
        </Button>
      ) : null}
      <ul className="divide-y rounded-2xl border bg-card">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className="w-full px-4 py-3 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
              onClick={() => {
                void openNotification(n, (href) => {
                  router.push(href);
                  router.refresh();
                });
              }}
            >
              <span className={`block text-sm ${n.read ? '' : 'font-semibold'}`}>
                {n.read ? null : (
                  <span className="mr-1.5 inline-block size-2 rounded-full bg-brand" />
                )}
                {n.title}
              </span>
              <span className="block text-sm text-muted-foreground">{n.body}</span>
              <span className="block text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
