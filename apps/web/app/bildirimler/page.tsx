import Link from 'next/link';
import { Empty, LoadError, PageTitle, Pagination } from '@/components/common';
import { NotificationList } from '@/components/notification-list';
import { requireMe, serverGet, toQuery } from '@/lib/server-api';
import type { AppNotification } from '@/lib/types';

export const metadata = { title: 'Bildirimler · ARC Global' };

type SP = Promise<{ unread?: string; page?: string }>;

export default async function NotificationsPage({ searchParams }: { searchParams: SP }) {
  await requireMe();
  const sp = await searchParams;
  const unreadOnly = sp.unread === '1';
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const res = await serverGet<{ items: AppNotification[]; total: number; page: number }>(
    `/notifications${toQuery({ unread: unreadOnly ? '1' : undefined, page: String(page) })}`,
  );
  const tab = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm ${active ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`;

  return (
    <>
      <PageTitle>Bildirimler</PageTitle>
      <nav aria-label="Bildirim filtresi" className="mb-4 flex gap-2">
        <Link className={tab(!unreadOnly)} href="/bildirimler">
          Tümü
        </Link>
        <Link className={tab(unreadOnly)} href="/bildirimler?unread=1">
          Okunmamış
        </Link>
      </nav>
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : res.data.items.length === 0 ? (
        <Empty>{unreadOnly ? 'Okunmamış bildiriminiz yok.' : 'Henüz bildiriminiz yok.'}</Empty>
      ) : (
        <>
          <NotificationList
            items={res.data.items}
            hasUnread={res.data.items.some((n) => !n.read)}
          />
          <Pagination
            page={page}
            total={res.data.total}
            href={(p) =>
              `/bildirimler${toQuery({ unread: unreadOnly ? '1' : undefined, page: String(p) })}`
            }
          />
        </>
      )}
    </>
  );
}
