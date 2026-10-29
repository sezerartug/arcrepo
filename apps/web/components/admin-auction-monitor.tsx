'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clientApi, formatDate, formatTry } from '@/lib/api';
import type { AdminAuctionDetail } from '@/lib/admin-types';
import { bidRejectLabel } from '@/lib/labels';
import { AdminActionDialog } from './admin-action-dialog';
import { formatRemaining } from './auction-panel';
import { Card, Empty, StatusBadge } from './common';

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

const OUTCOMES = { sold: 'Satıldı', no_sale: 'Satış olmadı' } as const;

/** Admin auction monitor: real identities, rejected attempts, deposits, events. Polls every 3 s while live. */
export function AdminAuctionMonitor({ initial }: { initial: AdminAuctionDetail }) {
  const [d, setD] = useState(initial);
  const [offset, setOffset] = useState(() => Date.parse(initial.serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.parse(initial.serverNow));
  const [stale, setStale] = useState(false);
  const inFlight = useRef(false);
  const a = d.auction;
  const running = a.status === 'LIVE' || a.status === 'SCHEDULED';

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      // poll=1: the page load already wrote the admin.auction.view audit entry.
      const next = await clientApi.get<AdminAuctionDetail>(
        `/admin/auctions/${initial.auction.id}?poll=1`,
      );
      setD(next);
      setOffset(Date.parse(next.serverNow) - Date.now());
      setStale(false);
    } catch {
      setStale(true);
    } finally {
      inFlight.current = false;
    }
  }, [initial.auction.id]);

  useEffect(() => {
    if (!running) return;
    const poll = setInterval(() => void refresh(), 3000);
    return () => {
      clearInterval(poll);
    };
  }, [running, refresh]);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now() + offset);
    }, 1000);
    return () => {
      clearInterval(t);
    };
  }, [offset]);

  const remaining = Date.parse(a.endsAt) - now;
  const toStart = Date.parse(a.startsAt) - now;
  const reserveMet =
    a.reserveMinor === null || BigInt(a.currentPriceMinor ?? '0') >= BigInt(a.reserveMinor);

  return (
    <div className="space-y-8">
      <Section id="m-summary" title="Özet">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={a.status} />
              {running ? (
                <span className="font-mono text-sm font-semibold" suppressHydrationWarning>
                  {a.status === 'SCHEDULED'
                    ? `Başlamasına ${formatRemaining(toStart)}`
                    : remaining > 0
                      ? `Kalan ${formatRemaining(remaining)}`
                      : 'Süre doldu, kapanış bekleniyor'}
                </span>
              ) : null}
              {stale ? (
                <span role="status" className="text-xs text-destructive">
                  Güncelleme alınamadı
                </span>
              ) : null}
            </div>
            {running ? (
              <AdminActionDialog
                path={`/admin/auctions/${a.id}/cancel`}
                label="Mezatı iptal et"
                title="Mezat iptal edilsin mi?"
                description="Teminatlar iade edilir. Bu işlem geri alınamaz."
                reason="required"
                variant="destructive"
              />
            ) : null}
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Satıcı</dt>
              <dd>
                <Link className="underline" href={`/admin/sirketler/${a.sellerCompanyId}`}>
                  {a.sellerName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">İlan</dt>
              <dd>
                <Link className="underline" href={`/ilanlar/${a.listingId}`}>
                  {a.title}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Güncel fiyat</dt>
              <dd className="text-lg font-bold text-primary">
                {formatTry(a.currentPriceMinor ?? a.startPriceMinor)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Başlangıç / artış</dt>
              <dd>
                {formatTry(a.startPriceMinor)} / {formatTry(a.minIncrementMinor)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rezerv</dt>
              <dd>
                {a.reserveMinor === null
                  ? 'Yok'
                  : `${formatTry(a.reserveMinor)} (${reserveMet ? 'karşılandı' : 'karşılanmadı'})`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Teminat · Teklif sayısı</dt>
              <dd>
                {formatTry(a.depositMinor)} · {a.bidCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Başlangıç</dt>
              <dd>{fmt(a.startsAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Bitiş (uzatma: {a.extensionCount})</dt>
              <dd>{fmt(a.endsAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Kapanış</dt>
              <dd>{fmt(a.closedAt)}</dd>
            </div>
            {a.cancelReason ? (
              <div className="sm:col-span-3">
                <dt className="text-xs text-muted-foreground">İptal nedeni</dt>
                <dd>{a.cancelReason}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </Section>

      {d.result || d.order ? (
        <Section id="m-result" title="Sonuç ve sipariş">
          <Card className="space-y-1 text-sm">
            {d.result ? (
              <p>
                {OUTCOMES[d.result.outcome]}
                {d.result.winnerName ? (
                  <>
                    {' · Kazanan: '}
                    <Link
                      className="underline"
                      href={`/admin/sirketler/${d.result.winnerCompanyId ?? ''}`}
                    >
                      {d.result.winnerName}
                    </Link>
                  </>
                ) : null}
                {d.result.finalPriceMinor
                  ? ` · Nihai fiyat ${formatTry(d.result.finalPriceMinor)}`
                  : ''}
                {d.result.totalMinor ? ` · Toplam ${formatTry(d.result.totalMinor)}` : ''}
              </p>
            ) : null}
            {d.order ? (
              <p>
                Sipariş: <StatusBadge status={d.order.status} /> · {formatTry(d.order.totalMinor)} ·{' '}
                <Link className="underline" href={`/siparisler/${d.order.id}`}>
                  Siparişi aç
                </Link>
              </p>
            ) : null}
          </Card>
        </Section>
      ) : null}

      <Section id="m-bids" title={`Teklifler (${String(d.bids.length)})`}>
        {d.bids.length === 0 ? (
          <Empty>Henüz teklif yok.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Kabul edilen teklifler</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1">
                    #
                  </th>
                  <th scope="col">Şirket</th>
                  <th scope="col">Kullanıcı</th>
                  <th scope="col">Tutar</th>
                  <th scope="col">Kabul zamanı</th>
                </tr>
              </thead>
              <tbody>
                {d.bids.map((b) => (
                  <tr key={b.seq} className="border-t">
                    <td className="py-1">{b.seq}</td>
                    <td>
                      <Link className="underline" href={`/admin/sirketler/${b.companyId}`}>
                        {b.companyName}
                      </Link>
                    </td>
                    <td>{b.userName}</td>
                    <td className="font-medium">{formatTry(b.amountMinor)}</td>
                    <td className="text-muted-foreground">{fmt(b.acceptedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="m-attempts" title={`Reddedilen denemeler (${String(d.attempts.length)})`}>
        {d.attempts.length === 0 ? (
          <Empty>Reddedilen deneme yok.</Empty>
        ) : (
          <div className="space-y-3">
            <ul className="flex flex-wrap gap-2 text-sm" aria-label="Ret nedenleri özeti">
              {d.rejectionSummary.map((r) => (
                <li key={r.reasonCode} className="rounded-full border px-3 py-0.5">
                  {bidRejectLabel(r.reasonCode)}: <strong>{r.count}</strong>
                </li>
              ))}
            </ul>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Reddedilen teklif denemeleri</caption>
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1">
                      Zaman
                    </th>
                    <th scope="col">Şirket</th>
                    <th scope="col">Kullanıcı</th>
                    <th scope="col">Tutar</th>
                    <th scope="col">Neden</th>
                  </tr>
                </thead>
                <tbody>
                  {d.attempts.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="py-1 text-muted-foreground">{fmt(t.at)}</td>
                      <td>{t.companyName}</td>
                      <td>{t.userName}</td>
                      <td>{formatTry(t.amountMinor)}</td>
                      <td>{bidRejectLabel(t.reasonCode)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section id="m-deposits" title={`Teminatlar (${String(d.deposits.length)})`}>
        {d.deposits.length === 0 ? (
          <Empty>Teminat kaydı yok.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Teminatlar</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1">
                    Şirket
                  </th>
                  <th scope="col">Tutar</th>
                  <th scope="col">Referans</th>
                  <th scope="col">Durum</th>
                  <th scope="col">Onay</th>
                  <th scope="col">Sonuçlanma</th>
                </tr>
              </thead>
              <tbody>
                {d.deposits.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-1">
                      <Link className="underline" href={`/admin/sirketler/${p.companyId}`}>
                        {p.companyName}
                      </Link>
                    </td>
                    <td>{formatTry(p.amountMinor)}</td>
                    <td className="font-mono text-xs">{p.reference}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="text-muted-foreground">{fmt(p.confirmedAt)}</td>
                    <td className="text-muted-foreground">{fmt(p.settledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="m-events" title={`Olaylar (${String(d.events.length)})`}>
        {d.events.length === 0 ? (
          <Empty>Olay yok.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Mezat olayları</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1">
                    #
                  </th>
                  <th scope="col">Tür</th>
                  <th scope="col">Ayrıntı</th>
                  <th scope="col">Zaman</th>
                </tr>
              </thead>
              <tbody>
                {d.events.map((e, i) => (
                  <tr key={`${String(e.seq)}-${String(i)}`} className="border-t align-top">
                    <td className="py-1">{e.seq}</td>
                    <td className="font-mono text-xs">{e.type}</td>
                    <td className="max-w-md break-words font-mono text-xs text-muted-foreground">
                      {JSON.stringify(e.payload)}
                    </td>
                    <td className="text-muted-foreground">{fmt(e.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
