import Link from 'next/link';
import { ActionButton } from '@/components/action-button';
import { AdminAuditTable } from '@/components/admin-audit-table';
import { AdminDisputeActions } from '@/components/admin-dispute-actions';
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
import type {
  AdminAuctionList,
  AdminAuditRow,
  AdminCompanyRow,
  AdminDisputeRow,
  AdminOrderRow,
  AdminUserRow,
  Paged,
} from '@/lib/admin-types';
import { paymentKindLabel, saleTypeLabel } from '@/lib/labels';
import { requireMe, serverGet, toQuery } from '@/lib/server-api';
import type { Listing } from '@/lib/types';
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
  ['', 'Tümü'],
  ['LIVE', 'Canlı'],
  ['SCHEDULED', 'Planlandı'],
  ['PAYMENT_PENDING', 'Ödeme bekliyor'],
  ['SETTLED', 'Sonuçlandı'],
  ['ENDED_NO_SALE', 'Satış olmadı'],
  ['PAYMENT_FAILED', 'Ödeme başarısız'],
  ['CANCELLED', 'İptal'],
] as const;

const ORDER_FILTERS = [
  ['', 'Tümü'],
  ['awaiting_payment', 'Ödeme bekliyor'],
  ['paid_escrow', 'Emanette'],
  ['shipped', 'Kargoda'],
  ['disputed', 'İtirazlı'],
  ['completed', 'Tamamlandı'],
  ['refunded', 'İade edildi'],
  ['cancelled', 'İptal'],
  ['payment_failed', 'Ödeme başarısız'],
] as const;
const DISPUTE_FILTERS = [
  ['open', 'Açık'],
  ['resolved', 'Sonuçlanan'],
  ['all', 'Tümü'],
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
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const current = AUCTION_FILTERS.find(([s]) => s === sp.status)?.[0] ?? '';
  const res = await serverGet<AdminAuctionList>(
    `/admin/auctions${toQuery({ status: current, q: sp.q, page: String(page) })}`,
  );
  return (
    <section aria-labelledby="a-auctions">
      <H2 id="a-auctions">Mezatlar</H2>
      <SubNav
        label="Mezat durumu"
        items={AUCTION_FILTERS}
        current={current}
        href={(k) => `/admin${toQuery({ tab: 'mezatlar', status: k, q: sp.q })}`}
      />
      <form method="get" className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <input type="hidden" name="tab" value="mezatlar" />
        {current ? <input type="hidden" name="status" value={current} /> : null}
        <Field label="Ara" htmlFor="q">
          <input
            id="q"
            name="q"
            defaultValue={sp.q}
            className={inputCls}
            placeholder="İlan başlığı veya satıcı"
          />
        </Field>
        <Button type="submit" variant="outline">
          Ara
        </Button>
      </form>
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : res.data.items.length === 0 ? (
        <Empty>Bu ölçütlerde mezat yok.</Empty>
      ) : (
        <>
          <div className="space-y-2">
            {res.data.items.map((a) => (
              <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    <Link className="underline" href={`/admin/mezatlar/${a.id}`}>
                      {a.title}
                    </Link>{' '}
                    <StatusBadge status={a.status} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <Link className="underline" href={`/admin/sirketler/${a.sellerCompanyId}`}>
                      {a.sellerName}
                    </Link>{' '}
                    · Güncel: {formatTry(a.currentPriceMinor ?? a.startPriceMinor)} · {a.bidCount}{' '}
                    teklif · Bitiş {fmt(a.endsAt)} · Teminat toplamı{' '}
                    {formatTry(a.heldDepositTotalMinor)}
                  </p>
                </div>
                <Link
                  href={`/admin/mezatlar/${a.id}`}
                  className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
                >
                  İzle
                </Link>
              </Card>
            ))}
          </div>
          <Pagination
            page={page}
            total={res.data.total}
            href={(p) =>
              `/admin${toQuery({ tab: 'mezatlar', status: current, q: sp.q, page: String(p) })}`
            }
          />
        </>
      )}
    </section>
  );
}
async function OrdersTab({ sp }: { sp: SP }) {
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const current = ORDER_FILTERS.find(([s]) => s === sp.status)?.[0] ?? '';
  const res = await serverGet<Paged<AdminOrderRow>>(
    `/admin/orders${toQuery({ status: current, q: sp.q, page: String(page) })}`,
  );
  return (
    <section aria-labelledby="a-orders">
      <H2 id="a-orders">Siparişler</H2>
      <SubNav
        label="Sipariş durumu"
        items={ORDER_FILTERS}
        current={current}
        href={(k) => `/admin${toQuery({ tab: 'siparisler', status: k, q: sp.q })}`}
      />
      <form method="get" className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <input type="hidden" name="tab" value="siparisler" />
        {current ? <input type="hidden" name="status" value={current} /> : null}
        <Field label="Ara" htmlFor="q">
          <input
            id="q"
            name="q"
            defaultValue={sp.q}
            className={inputCls}
            placeholder="İlan, alıcı, satıcı veya referans"
          />
        </Field>
        <Button type="submit" variant="outline">
          Ara
        </Button>
      </form>
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : res.data.items.length === 0 ? (
        <Empty>Bu ölçütlerde sipariş yok.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Siparişler</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1">
                    İlan
                  </th>
                  <th scope="col">Alıcı</th>
                  <th scope="col">Satıcı</th>
                  <th scope="col">Tutar</th>
                  <th scope="col">Durum</th>
                  <th scope="col">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {res.data.items.map((o) => (
                  <tr key={o.id} className="border-t align-top">
                    <td className="py-1">
                      <Link className="underline" href={`/siparisler/${o.id}`}>
                        {o.listingTitle}
                      </Link>
                      {o.fromAuction ? <span className="text-xs"> (mezat)</span> : null}
                    </td>
                    <td>{o.buyerName}</td>
                    <td>{o.sellerName}</td>
                    <td>
                      {formatTry(o.totalMinor)}
                      {o.refundMinor !== '0' ? (
                        <div className="text-xs text-muted-foreground">
                          İade: {formatTry(o.refundMinor)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{fmt(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={res.data.total}
            href={(p) =>
              `/admin${toQuery({ tab: 'siparisler', status: current, q: sp.q, page: String(p) })}`
            }
          />
        </>
      )}
    </section>
  );
}

async function DisputesTab({ sp }: { sp: SP }) {
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const current = DISPUTE_FILTERS.find(([s]) => s === sp.status)?.[0] ?? 'open';
  const res = await serverGet<Paged<AdminDisputeRow>>(
    `/admin/disputes${toQuery({ status: current === 'all' ? '' : current, page: String(page) })}`,
  );
  return (
    <section aria-labelledby="a-disputes">
      <H2 id="a-disputes">İtirazlar</H2>
      <p className="mb-2 text-xs text-muted-foreground">
        Alıcı itirazı sırasında otomatik teslim onayı ve satıcı hakedişi durur. Karar: kısmi/tam
        iade veya itirazı reddet.
      </p>
      <SubNav
        label="İtiraz durumu"
        items={DISPUTE_FILTERS}
        current={current}
        href={(k) => `/admin${toQuery({ tab: 'itirazlar', status: k })}`}
      />
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : res.data.items.length === 0 ? (
        <Empty>Bu durumda itiraz yok.</Empty>
      ) : (
        <>
          <div className="space-y-2">
            {res.data.items.map((d) => (
              <Card key={d.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      <Link className="underline" href={`/siparisler/${d.orderId}`}>
                        {d.listingTitle}
                      </Link>{' '}
                      <StatusBadge status={d.orderStatus} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Alıcı: {d.buyerName} · Satıcı: {d.sellerName} · Toplam{' '}
                      {formatTry(d.totalMinor)}
                      {d.fromAuction ? ' · Mezat siparişi' : ''} · Açılış {fmt(d.openedAt)}
                    </p>
                  </div>
                  {d.status === 'open' ? (
                    <AdminDisputeActions disputeId={d.id} totalMinor={d.totalMinor} />
                  ) : null}
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">İtiraz nedeni: </span>
                  {d.reason}
                </p>
                {d.status === 'resolved' ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Karar: </span>
                    {d.resolution === 'refund'
                      ? `İade (${formatTry(d.refundMinor)})`
                      : 'İtiraz reddedildi'}{' '}
                    · {d.resolutionNote} · {fmt(d.resolvedAt ?? undefined)}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
          <Pagination
            page={page}
            total={res.data.total}
            href={(p) => `/admin${toQuery({ tab: 'itirazlar', status: current, page: String(p) })}`}
          />
        </>
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
      ) : tab === 'siparisler' ? (
        <OrdersTab sp={sp} />
      ) : tab === 'itirazlar' ? (
        <DisputesTab sp={sp} />
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
