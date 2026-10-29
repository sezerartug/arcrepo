import Link from 'next/link';
import { AdminActionDialog } from '@/components/admin-action-dialog';
import { AdminAuditTable } from '@/components/admin-audit-table';
import { AdminTabs } from '@/components/admin-tabs';
import { Card, Empty, LoadError, PageTitle, StatusBadge } from '@/components/common';
import { formatDate, formatTry } from '@/lib/api';
import type { AdminCompanyDetail } from '@/lib/admin-types';
import { roleLabel, saleTypeLabel } from '@/lib/labels';
import { requireMe, serverGet } from '@/lib/server-api';

export const metadata = { title: 'Şirket detayı · Yönetim · ARC Global' };

const fmt = (s?: string | null) => (s ? formatDate(s) : '—');

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 text-lg font-semibold text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function AdminCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  if (!me.user.isAdmin) return <Empty>Bu sayfaya erişim yetkiniz yok.</Empty>;
  const { id } = await params;
  const res = await serverGet<AdminCompanyDetail>(`/admin/companies/${id}`);
  if (!res.ok) {
    return (
      <div className="space-y-2">
        <AdminTabs current="sirketler" />
        <LoadError error={res.error} />
      </div>
    );
  }
  const { company: c, members, listings, auctions, orders, audit } = res.data;
  const base = `/admin/companies/${c.id}`;

  return (
    <div className="space-y-8">
      <div>
        <PageTitle sub="Şirket detayı">{c.legalName}</PageTitle>
        <AdminTabs current="sirketler" />
        <Link href="/admin/sirketler" className="text-sm underline">
          ← Şirket listesi
        </Link>
      </div>

      <Section id="c-card" title="Şirket bilgileri">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge status={c.status} />
            <div className="flex flex-wrap gap-2">
              {c.status !== 'verified' ? (
                <AdminActionDialog
                  path={`${base}/verify`}
                  label="Onayla"
                  title="Şirket onaylansın mı?"
                  description="Şirket doğrulanır; ilan verebilir ve teklif verebilir."
                  reason="optional"
                />
              ) : null}
              {c.status === 'pending' ? (
                <AdminActionDialog
                  path={`${base}/reject`}
                  label="Reddet"
                  title="Şirket reddedilsin mi?"
                  reason="required"
                  variant="destructive"
                />
              ) : null}
              {c.status === 'verified' ? (
                <AdminActionDialog
                  path={`${base}/suspend`}
                  label="Askıya al"
                  title="Şirket askıya alınsın mı?"
                  description="Askıdaki şirket işlem yapamaz."
                  reason="required"
                  variant="destructive"
                />
              ) : null}
            </div>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Vergi no / dairesi</dt>
              <dd>
                {c.taxNo} · {c.taxOffice}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Kayıt tarihi</dt>
              <dd>{fmt(c.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Adres</dt>
              <dd>{c.address}</dd>
            </div>
            {c.statusReason ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Durum nedeni</dt>
                <dd>{c.statusReason}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </Section>

      <Section id="c-members" title={`Üyeler (${String(members.length)})`}>
        {members.length === 0 ? (
          <Empty>Üye yok.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Şirket üyeleri</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1">
                    Ad
                  </th>
                  <th scope="col">E-posta</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Son giriş</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="py-1">{m.fullName}</td>
                    <td>{m.email}</td>
                    <td>{roleLabel(m.role)}</td>
                    <td className="text-muted-foreground">{fmt(m.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="c-listings" title={`İlanlar (${String(listings.length)})`}>
        {c.status === 'verified' ? (
          <Link
            href={`/admin/ilan-ekle?companyId=${c.id}`}
            className="mb-2 inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
          >
            Bu şirket adına ilan ekle
          </Link>
        ) : null}
        {listings.length === 0 ? (
          <Empty>İlan yok.</Empty>
        ) : (
          <div className="space-y-2">
            {listings.map((l) => (
              <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {l.title} <StatusBadge status={l.status} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTry(l.unitPriceMinor)} · {saleTypeLabel(l.saleType)} · {fmt(l.createdAt)}
                  </p>
                </div>
                {l.status !== 'removed' && l.status !== 'sold' ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/satici/${l.id}/duzenle`}
                      className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
                    >
                      Düzenle
                    </Link>
                    <AdminActionDialog
                      path={`/admin/listings/${l.id}/remove`}
                      label="İlanı kaldır"
                      title="İlan yayından kaldırılsın mı?"
                      description="Bu işlem geri alınamaz."
                      reason="required"
                      variant="destructive"
                    />
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section id="c-auctions" title={`Mezatlar (${String(auctions.length)})`}>
        {auctions.length === 0 ? (
          <Empty>Mezat yok.</Empty>
        ) : (
          <div className="space-y-2">
            {auctions.map((a) => (
              <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    <Link className="underline" href={`/admin/mezatlar/${a.id}`}>
                      {a.listingTitle}
                    </Link>{' '}
                    <StatusBadge status={a.status} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Güncel fiyat: {formatTry(a.currentPriceMinor ?? a.startPriceMinor)} ·{' '}
                    {a.bidCount} teklif · Bitiş {fmt(a.endsAt)} · Teminat{' '}
                    {formatTry(a.depositMinor)} ({a.heldDeposits} emanette)
                  </p>
                </div>
                {a.status === 'LIVE' || a.status === 'SCHEDULED' ? (
                  <AdminActionDialog
                    path={`/admin/auctions/${a.id}/cancel`}
                    label="Mezadı iptal et"
                    title="Mezat iptal edilsin mi?"
                    description="Teminatlar iade edilir. Bu işlem geri alınamaz."
                    reason="required"
                    variant="destructive"
                  />
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section id="c-orders" title={`Siparişler (${String(orders.length)})`}>
        {orders.length === 0 ? (
          <Empty>Sipariş yok.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Siparişler</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1">
                    Rol
                  </th>
                  <th scope="col">Karşı taraf</th>
                  <th scope="col">Durum</th>
                  <th scope="col">Tutar</th>
                  <th scope="col">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="py-1">{roleLabel(o.role)}</td>
                    <td>{o.counterparty}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{formatTry(o.totalMinor)}</td>
                    <td className="text-muted-foreground">{fmt(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="c-audit" title="Son denetim kayıtları">
        {audit.length === 0 ? <Empty>Kayıt yok.</Empty> : <AdminAuditTable rows={audit} />}
      </Section>
    </div>
  );
}
