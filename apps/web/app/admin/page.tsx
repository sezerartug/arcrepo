import { ActionButton } from '@/components/action-button';
import { Card, Empty, Field, LoadError, PageTitle, inputCls } from '@/components/common';
import { Button } from '@/components/ui/button';
import { formatDate, formatTry } from '@/lib/api';
import { requireMe, serverGet, toQuery } from '@/lib/server-api';
import type { Listing } from '@/lib/types';

export const metadata = { title: 'Yönetim · ARC Global' };

type AdminCompany = {
  id: string;
  legalName: string;
  taxNo?: string;
  taxOffice?: string;
  status: string;
};
type AdminPayment = {
  reference: string;
  amountMinor: string;
  kind?: string;
  type?: string;
  companyName?: string;
  status?: string;
  createdAt?: string;
};
type AuditRow = {
  id?: string;
  action: string;
  occurred_at?: string;
  entity_type?: string;
  entity_id?: string;
  actor_type?: string;
};

/** Flattens nested counters ({ orders: { completed: 1 } }) into orders · completed rows. */
function statRows(d: Record<string, unknown>): [string, string][] {
  return Object.entries(d).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? Object.entries(v as Record<string, unknown>).map(([k2, v2]): [string, string] => [
          `${k} · ${k2}`,
          String(v2),
        ])
      : [[k, String(v)] as [string, string]],
  );
}

const fmt = (s?: string) => (s ? formatDate(s) : '—');
const list = <T,>(d: T[] | { items: T[] }): T[] => (Array.isArray(d) ? d : d.items);

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; entityId?: string }>;
}) {
  const me = await requireMe();
  if (!me.user.isAdmin) return <Empty>Bu sayfaya erişim yetkiniz yok.</Empty>;
  const sp = await searchParams;

  const [stats, companies, allCompanies, listings, payments, audit] = await Promise.all([
    serverGet<Record<string, unknown>>('/admin/stats'),
    serverGet<AdminCompany[] | { items: AdminCompany[] }>('/admin/companies?status=pending'),
    serverGet<AdminCompany[] | { items: AdminCompany[] }>('/admin/companies?status=verified'),
    serverGet<Listing[] | { items: Listing[] }>('/admin/listings?status=pending_review'),
    serverGet<AdminPayment[] | { items: AdminPayment[] }>('/admin/payments?status=pending'),
    serverGet<AuditRow[] | { items: AuditRow[] }>(
      `/admin/audit${toQuery({ entityType: sp.entityType, entityId: sp.entityId })}`,
    ),
  ]);

  return (
    <div className="space-y-8">
      <PageTitle sub="Platform yönetimi">Yönetim paneli</PageTitle>

      <section aria-labelledby="a-stats">
        <h2 id="a-stats" className="mb-2 text-lg font-semibold text-primary">
          İstatistikler
        </h2>
        {!stats.ok ? (
          <LoadError error={stats.error} />
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statRows(stats.data).map(([k, v]) => (
              <Card key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="text-xl font-semibold">{v}</dd>
              </Card>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="a-companies">
        <h2 id="a-companies" className="mb-2 text-lg font-semibold text-primary">
          Bekleyen şirketler
        </h2>
        {!companies.ok ? (
          <LoadError error={companies.error} />
        ) : list(companies.data).length === 0 ? (
          <Empty>Bekleyen şirket yok.</Empty>
        ) : (
          <div className="space-y-2">
            {list(companies.data).map((c) => (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{c.legalName}</p>
                  <p className="text-xs text-muted-foreground">
                    VKN {c.taxNo ?? '—'} · {c.taxOffice ?? ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton path={`/admin/companies/${c.id}/verify`} label="Onayla" />
                  <ActionButton
                    path={`/admin/companies/${c.id}/reject`}
                    label="Reddet"
                    askReason
                    variant="destructive"
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="a-listings">
        <h2 id="a-listings" className="mb-2 text-lg font-semibold text-primary">
          İncelemedeki ilanlar
        </h2>
        {!listings.ok ? (
          <LoadError error={listings.error} />
        ) : list(listings.data).length === 0 ? (
          <Empty>İncelenecek ilan yok.</Empty>
        ) : (
          <div className="space-y-2">
            {list(listings.data).map((l) => (
              <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.sellerName ?? ''} · {formatTry(l.unitPriceMinor)} ·{' '}
                    {l.saleType === 'auction' ? 'Mezat' : 'Sabit fiyat'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton path={`/admin/listings/${l.id}/approve`} label="Yayınla" />
                  <ActionButton
                    path={`/admin/listings/${l.id}/reject`}
                    label="Reddet"
                    askReason
                    variant="destructive"
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="a-payments">
        <h2 id="a-payments" className="mb-2 text-lg font-semibold text-primary">
          Bekleyen havaleler
        </h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Sahte banka mutabakatı: referansı onayladığınızda teminat/ödeme gerçekleşmiş sayılır.
        </p>
        {!payments.ok ? (
          <LoadError error={payments.error} />
        ) : list(payments.data).length === 0 ? (
          <Empty>Bekleyen havale yok.</Empty>
        ) : (
          <div className="space-y-2">
            {list(payments.data).map((p) => (
              <Card key={p.reference} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono font-medium">{p.reference}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.kind ?? p.type ?? ''} {p.companyName ? `· ${p.companyName}` : ''} ·{' '}
                    {formatTry(p.amountMinor)}
                    {p.createdAt ? ` · ${formatDate(p.createdAt)}` : ''}
                  </p>
                </div>
                <ActionButton
                  path="/admin/payments/confirm"
                  body={{ reference: p.reference }}
                  label="Havaleyi onayla"
                  onDoneMessage="Onaylandı."
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="a-payouts">
        <h2 id="a-payouts" className="mb-2 text-lg font-semibold text-primary">
          Satıcı hakedişleri
        </h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Teslimi onaylanan siparişlerin satıcı bakiyesini satıcının banka hesabına aktarır (demo).
        </p>
        {!allCompanies.ok ? (
          <LoadError error={allCompanies.error} />
        ) : (
          <div className="space-y-2">
            {list(allCompanies.data).map((c) => (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">{c.legalName}</p>
                <ActionButton
                  path={`/admin/payouts/${c.id}/transfer`}
                  label="Hakedişi aktar"
                  variant="outline"
                  onDoneMessage="Aktarım işlendi."
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="a-audit">
        <h2 id="a-audit" className="mb-2 text-lg font-semibold text-primary">
          Denetim kaydı
        </h2>
        <form method="get" className="mb-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Varlık türü" htmlFor="entityType">
            <input
              id="entityType"
              name="entityType"
              defaultValue={sp.entityType}
              className={inputCls}
              placeholder="company, listing, auction…"
            />
          </Field>
          <Field label="Varlık kimliği" htmlFor="entityId">
            <input id="entityId" name="entityId" defaultValue={sp.entityId} className={inputCls} />
          </Field>
          <Button type="submit" variant="outline">
            Ara
          </Button>
        </form>
        {!audit.ok ? (
          <LoadError error={audit.error} />
        ) : list(audit.data).length === 0 ? (
          <Empty>Kayıt yok.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Denetim kayıtları</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1">
                    Zaman
                  </th>
                  <th scope="col">Eylem</th>
                  <th scope="col">Varlık</th>
                </tr>
              </thead>
              <tbody>
                {list(audit.data).map((a, i) => (
                  <tr key={a.id ?? i} className="border-t">
                    <td className="py-1 text-muted-foreground">{fmt(a.occurred_at)}</td>
                    <td>{a.action}</td>
                    <td className="font-mono text-xs">
                      {a.entity_type}:{a.entity_id?.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
