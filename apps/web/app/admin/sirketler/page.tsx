import Link from 'next/link';
import { AdminTabs } from '@/components/admin-tabs';
import {
  Card,
  Empty,
  Field,
  LoadError,
  PageTitle,
  Pagination,
  StatusBadge,
  inputCls,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/api';
import type { AdminCompanyRow, Paged } from '@/lib/admin-types';
import { requireMe, serverGet, toQuery } from '@/lib/server-api';

export const metadata = { title: 'Şirketler · Yönetim · ARC Global' };

const STATUS_FILTERS = [
  ['', 'Tümü'],
  ['pending', 'Onay bekliyor'],
  ['verified', 'Doğrulandı'],
  ['rejected', 'Reddedildi'],
  ['suspended', 'Askıda'],
] as const;

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const me = await requireMe();
  if (!me.user.isAdmin) return <Empty>Bu sayfaya erişim yetkiniz yok.</Empty>;
  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const res = await serverGet<Paged<AdminCompanyRow>>(
    `/admin/companies${toQuery({ q: sp.q, status: sp.status, page: String(page) })}`,
  );

  return (
    <div className="space-y-2">
      <PageTitle sub="Platform yönetimi">Şirketler</PageTitle>
      <AdminTabs current="sirketler" />
      <form method="get" className="mb-3 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <Field label="Ünvan veya vergi no" htmlFor="q">
          <input id="q" name="q" defaultValue={sp.q} className={inputCls} />
        </Field>
        <Field label="Durum" htmlFor="status">
          <select id="status" name="status" defaultValue={sp.status ?? ''} className={inputCls}>
            {STATUS_FILTERS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" variant="outline">
          Ara
        </Button>
      </form>
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : res.data.items.length === 0 ? (
        <Empty>Şirket bulunamadı.</Empty>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{res.data.total} şirket</p>
          <div className="space-y-2">
            {res.data.items.map((c) => (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link className="font-medium underline" href={`/admin/sirketler/${c.id}`}>
                    {c.legalName}
                  </Link>{' '}
                  <StatusBadge status={c.status} />
                  <p className="text-xs text-muted-foreground">
                    VKN {c.taxNo} · {c.taxOffice} · Kayıt {formatDate(c.createdAt)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {c.memberCount} üye · {c.listingCount} ilan
                </p>
              </Card>
            ))}
          </div>
          <Pagination
            page={page}
            total={res.data.total}
            href={(p) =>
              `/admin/sirketler${toQuery({ q: sp.q, status: sp.status, page: String(p) })}`
            }
          />
        </>
      )}
    </div>
  );
}
