import Link from 'next/link';
import { ActionButton } from '@/components/action-button';
import { AdminAuditTable } from '@/components/admin-audit-table';
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
  statusLabel,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { formatDate, formatTry } from '@/lib/api';
import type { AdminAuditRow, AdminCompanyRow, AdminUserRow, Paged } from '@/lib/admin-types';
import { paymentKindLabel, saleTypeLabel } from '@/lib/labels';
import { requireMe, serverGet, toQuery } from '@/lib/server-api';
import type { AuctionList, Listing } from '@/lib/types';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Yönetim · ARC Global' };

type SP = {
  tab?: string;
  q?: string;
  page?: string;
  status?: string;
  entityType?: string;
  entityId?: string;
};
type AdminPayment = {
  reference: string;
  amountMinor: string;
  kind?: string;
  type?: string;
  companyName?: string;
  createdAt?: string;
};
type AuditApiRow = {
  id?: string;
  action: string;
  occurred_at?: string;
  entity_type?: string;
  entity_id?: string;
  actor_type?: string;
};

const TOP_LABELS: Record<string, string> = {
  users: 'Kullanıcı',
  companies: 'Şirket',
  listings: 'İlan',
  orders: 'Sipariş',
};

/** Flattens nested counters ({ companies: { verified: 1 } }) into "Şirket · Doğrulandı" rows. */
function statRows(d: Record<string, unknown>): [string, string][] {
  return Object.entries(d).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? Object.entries(v as Record<string, unknown>).map(([k2, v2]): [string, string] => [
          `${TOP_LABELS[k] ?? k} · ${statusLabel(k2)}`,
          String(v2),
        ])
      : [[TOP_LABELS[k] ?? k, String(v)] as [string, string]],
  );
}

const fmt = (s?: string) => (s ? formatDate(s) : '—');
const list = <T,>(d: T[] | { items: T[] }): T[] => (Array.isArray(d) ? d : d.items);

const LISTING_FILTERS = [
  ['pending_review', 'İncelemede'],
  ['published', 'Yayında'],
  ['rejected', 'Reddedildi'],
  ['sold', 'Satıldı'],
  ['removed', 'Kaldırıldı'],
] as const;
const AUCTION_FILTERS = [
  ['live', 'Canlı'],
  ['scheduled', 'Planlandı'],
  ['closed', 'Kapandı'],
] as const;

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-2 text-lg font-semibold text-primary">
      {children}
    </h2>
  );
}

function SubNav({
  items,
  current,
  href,
  label,
}: {
  items: readonly (readonly [string, string])[];
  current: string;
  href: (k: string) => string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-4 flex flex-wrap gap-2">
      {items.map(([k, text]) => (
        <Link
          key={k}
          href={href(k)}
          aria-current={k === current ? 'page' : undefined}
          className={cn(
            'rounded-full border px-3 py-0.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
            k === current ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
          )}
        >
          {text}
        </Link>
      ))}
    </nav>
  );
}

async function GeneralTab() {
  const [stats, companies, listings] = await Promise.all([
    serverGet<Record<string, unknown>>('/admin/stats'),
    serverGet<Paged<AdminCompanyRow>>('/admin/companies?status=pending'),
    serverGet<Listing[] | { items: Listing[] }>('/admin/listings?status=pending_review'),
  ]);
  return (
    <div className="space-y-8">
      <section aria-labelledby="a-stats">
        <H2 id="a-stats">İstatistikler</H2>
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
        <H2 id="a-companies">Onay bekleyen şirketler</H2>
        {!companies.ok ? (
          <LoadError error={companies.error} />
        ) : companies.data.items.length === 0 ? (
          <Empty>Bekleyen şirket yok.</Empty>
        ) : (
          <div className="space-y-2">
            {companies.data.items.map((c) => (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link className="font-medium underline" href={`/admin/sirketler/${c.id}`}>
                    {c.legalName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    VKN {c.taxNo} · {c.taxOffice}
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
        <H2 id="a-listings">İncelemedeki ilanlar</H2>
        {!listings.ok ? (
          <LoadError error={listings.error} />
        ) : list(listings.data).length === 0 ? (
          <Empty>İncelenecek ilan yok.</Empty>
        ) : (
          <div className="space-y-2">
            {list(listings.data).map((l) => (
              <ListingRow key={l.id} l={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ListingRow({ l }: { l: Listing }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-medium">
          {l.title} <StatusBadge status={l.status} />
        </p>
        <p className="text-xs text-muted-foreground">
          {l.companyId ? (
            <Link className="underline" href={`/admin/sirketler/${l.companyId}`}>
              {l.sellerName ?? 'Satıcı'}
            </Link>
          ) : (
            (l.sellerName ?? '')
          )}{' '}
          · {formatTry(l.unitPriceMinor)} · {saleTypeLabel(l.saleType)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {l.status === 'pending_review' ? (
          <>
            <ActionButton path={`/admin/listings/${l.id}/approve`} label="Yayınla" />
            <ActionButton
              path={`/admin/listings/${l.id}/reject`}
              label="Reddet"
              askReason
              variant="destructive"
            />
          </>
        ) : null}
        {l.status !== 'removed' && l.status !== 'sold' ? (
          <ActionButton
            path={`/admin/listings/${l.id}/remove`}
            label="Yayından kaldır"
            askReason
            variant="outline"
          />
        ) : null}
      </div>
    </Card>
  );
}

function SearchForm({ tab, q, placeholder }: { tab: string; q?: string; placeholder: string }) {
  return (
    <form method="get" className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <input type="hidden" name="tab" value={tab} />
      <Field label="Ara" htmlFor="q">
        <input id="q" name="q" defaultValue={q} className={inputCls} placeholder={placeholder} />
      </Field>
      <Button type="submit" variant="outline">
        Ara
      </Button>
    </form>
  );
}

async function UsersTab({ sp }: { sp: SP }) {
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const res = await serverGet<Paged<AdminUserRow>>(
    `/admin/users${toQuery({ q: sp.q, page: String(page) })}`,
  );
  return (
    <section aria-labelledby="a-users">
      <H2 id="a-users">Kullanıcılar</H2>
      <SearchForm tab="kullanicilar" {...(sp.q ? { q: sp.q } : {})} placeholder="Ad veya e-posta" />
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : res.data.items.length === 0 ? (
        <Empty>Kullanıcı bulunamadı.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Kullanıcılar</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1">
                    Ad
                  </th>
                  <th scope="col">E-posta</th>
                  <th scope="col">Şirket</th>
                  <th scope="col">Durum</th>
                </tr>
              </thead>
              <tbody>
                {res.data.items.map((u) => (
                  <tr key={u.id} className="border-t align-top">
                    <td className="py-1">
                      {u.fullName} {u.isAdmin ? <span className="text-xs">(Yönetici)</span> : null}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      {u.companies.length === 0
                        ? '—'
                        : u.companies.map((c) => (
                            <div key={c.id}>
                              <Link className="underline" href={`/admin/sirketler/${c.id}`}>
                                {c.legalName}
                              </Link>
                            </div>
                          ))}
                    </td>
                    <td>
                      {u.companies.map((c) => (
                        <div key={c.id}>
                          <StatusBadge status={c.status} />
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={res.data.total}
            href={(p) => `/admin${toQuery({ tab: 'kullanicilar', q: sp.q, page: String(p) })}`}
          />
        </>
      )}
    </section>
  );
}

async function ListingsTab({ sp }: { sp: SP }) {
  const current = LISTING_FILTERS.find(([s]) => s === sp.status)?.[0] ?? 'pending_review';
  const res = await serverGet<Listing[] | { items: Listing[] }>(
    `/admin/listings?status=${current}`,
  );
  return (
    <section aria-labelledby="a-listings">
      <H2 id="a-listings">İlanlar</H2>
      <SubNav
        label="İlan durumu"
        items={LISTING_FILTERS}
        current={current}
        href={(k) => `/admin?tab=ilanlar&status=${k}`}
      />
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : list(res.data).length === 0 ? (
        <Empty>Bu durumda ilan yok.</Empty>
      ) : (
        <div className="space-y-2">
          {list(res.data).map((l) => (
            <ListingRow key={l.id} l={l} />
          ))}
        </div>
      )}
    </section>
  );
}

async function AuctionsTab({ sp }: { sp: SP }) {
  const current = AUCTION_FILTERS.find(([s]) => s === sp.status)?.[0] ?? 'live';
  const res = await serverGet<AuctionList>(`/auctions?status=${current}`);
  return (
    <section aria-labelledby="a-auctions">
      <H2 id="a-auctions">Mezatlar</H2>
      <SubNav
        label="Mezat durumu"
        items={AUCTION_FILTERS}
        current={current}
        href={(k) => `/admin?tab=mezatlar&status=${k}`}
      />
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : res.data.items.length === 0 ? (
        <Empty>Bu durumda mezat yok.</Empty>
      ) : (
        <div className="space-y-2">
          {res.data.items.map((a) => (
            <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  <Link className="underline" href={`/mezat/${a.id}`}>
                    {a.title ?? 'Mezat'}
                  </Link>{' '}
                  <StatusBadge status={a.status} />
                </p>
                <p className="text-xs text-muted-foreground">
                  Güncel: {formatTry(a.currentPriceMinor ?? a.startPriceMinor)} · {a.bidCount ?? 0}{' '}
                  teklif · Bitiş {fmt(a.endsAt)}
                </p>
              </div>
              {a.status === 'LIVE' || a.status === 'SCHEDULED' ? (
                <ActionButton
                  path={`/admin/auctions/${a.id}/cancel`}
                  label="Mezadı iptal et"
                  askReason
                  variant="destructive"
                />
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

async function PaymentsTab() {
  const [payments, companies] = await Promise.all([
    serverGet<AdminPayment[] | { items: AdminPayment[] }>('/admin/payments?status=pending'),
    serverGet<Paged<AdminCompanyRow>>('/admin/companies?status=verified&perPage=100'),
  ]);
  return (
    <div className="space-y-8">
      <section aria-labelledby="a-payments">
        <H2 id="a-payments">Bekleyen havaleler</H2>
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
                    {paymentKindLabel(p.kind ?? p.type ?? '')}
                    {p.companyName ? ` · ${p.companyName}` : ''} · {formatTry(p.amountMinor)}
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
        <H2 id="a-payouts">Satıcı hakedişleri</H2>
        <p className="mb-2 text-xs text-muted-foreground">
          Teslimi onaylanan siparişlerin satıcı bakiyesini satıcının banka hesabına aktarır (demo).
        </p>
        {!companies.ok ? (
          <LoadError error={companies.error} />
        ) : (
          <div className="space-y-2">
            {companies.data.items.map((c) => (
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
    </div>
  );
}

async function AuditTab({ sp }: { sp: SP }) {
  const audit = await serverGet<AuditApiRow[] | { items: AuditApiRow[] }>(
    `/admin/audit${toQuery({ entityType: sp.entityType, entityId: sp.entityId })}`,
  );
  return (
    <section aria-labelledby="a-audit">
      <H2 id="a-audit">Denetim kaydı</H2>
      <form method="get" className="mb-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="tab" value="denetim" />
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
        <AdminAuditTable
          rows={list(audit.data).map((a, i): AdminAuditRow => ({
            id: a.id ?? String(i),
            occurredAt: a.occurred_at ?? '',
            actorType: a.actor_type ?? '',
            action: a.action,
            entityType: a.entity_type ?? '',
            entityId: a.entity_id ?? null,
            reason: null,
          }))}
        />
      )}
    </section>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireMe();
  if (!me.user.isAdmin) return <Empty>Bu sayfaya erişim yetkiniz yok.</Empty>;
  const sp = await searchParams;
  const tab = sp.tab ?? 'genel';

  return (
    <div className="space-y-2">
      <PageTitle sub="Platform yönetimi">Yönetim paneli</PageTitle>
      <AdminTabs current={tab} />
      {tab === 'kullanicilar' ? (
        <UsersTab sp={sp} />
      ) : tab === 'ilanlar' ? (
        <ListingsTab sp={sp} />
      ) : tab === 'mezatlar' ? (
        <AuctionsTab sp={sp} />
      ) : tab === 'havaleler' ? (
        <PaymentsTab />
      ) : tab === 'denetim' ? (
        <AuditTab sp={sp} />
      ) : (
        <GeneralTab />
      )}
    </div>
  );
}
