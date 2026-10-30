'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi, formatDate, formatTry, parseTryToMinor } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import type { AuctionSnapshot, DepositInstruction } from '@/lib/types';
import { Card, ErrorBox, Field, StatusBadge, inputCls } from './common';

const DEPOSIT_LABELS: Record<string, string> = {
  none: 'Teminat yatırılmadı',
  pending: 'Havale bekleniyor / onay aşamasında',
  held: 'Teminat onaylandı',
  refunded: 'İade edildi',
  applied: 'Ödemeye sayıldı',
  forfeited: 'Teminat gelir kaydedildi',
};

export function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  return d > 0 ? `${String(d)} gün ${hms}` : hms;
}

/** Live auction panel: polls the server snapshot every second; the countdown uses the server clock offset. */
export function AuctionPanel({
  initial,
  canBid,
  loggedIn,
}: {
  initial: AuctionSnapshot;
  canBid: boolean;
  loggedIn: boolean;
}) {
  const [snap, setSnap] = useState(initial);
  const [offset, setOffset] = useState(() => Date.parse(initial.serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.parse(initial.serverNow));
  const [stale, setStale] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deposit, setDeposit] = useState<DepositInstruction | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const apply = useCallback((s: AuctionSnapshot) => {
    setSnap(s);
    setOffset(Date.parse(s.serverNow) - Date.now());
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      apply(await clientApi.get<AuctionSnapshot>(`/auctions/${initial.id}`));
      setStale(false);
    } catch {
      setStale(true);
    } finally {
      inFlight.current = false;
    }
  }, [apply, initial.id]);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now() + offset);
      void refresh();
    }, 1000);
    return () => {
      clearInterval(t);
    };
  }, [offset, refresh]);

  const status = snap.status.toLowerCase(); // API sends LIVE / SCHEDULED / ...
  const live = status === 'live';
  const remaining = Date.parse(snap.endsAt) - now;
  const toStart = Date.parse(snap.startsAt) - now;
  const my = snap.myState;

  async function placeBid(e: React.SyntheticEvent) {
    e.preventDefault();
    const minor = parseTryToMinor(amount);
    if (!minor) {
      setError('Geçerli bir tutar girin (örn. 1.250,00).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Not optimistic: the UI changes only with the server's response.
      apply(
        await clientApi.post<AuctionSnapshot>(`/auctions/${snap.id}/bids`, { amountMinor: minor }),
      );
      setAmount('');
    } catch (err) {
      setError(errorMessage(err));
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function payDeposit() {
    setBusy(true);
    setDepositError(null);
    try {
      setDeposit(await clientApi.post<DepositInstruction>(`/auctions/${snap.id}/deposit`));
      void refresh();
    } catch (err) {
      setDepositError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const depositStatus = my?.depositStatus ?? 'none';

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Mezat</h2>
        <StatusBadge status={snap.status} />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Güncel fiyat</dt>
          <dd className="text-3xl font-extrabold tracking-tight text-primary">
            {formatTry(snap.currentPriceMinor ?? snap.startPriceMinor)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {status === 'scheduled' ? 'Başlamasına' : 'Kalan süre'}
          </dt>
          <dd className="font-mono text-3xl font-extrabold text-brand-text" aria-live="off">
            {status === 'scheduled'
              ? formatRemaining(toStart)
              : live
                ? formatRemaining(remaining)
                : 'Sona erdi'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Teklif sayısı</dt>
          <dd>{snap.bidCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Bitiş</dt>
          <dd>{formatDate(snap.endsAt)}</dd>
        </div>
      </dl>
      {stale ? <ErrorBox message="Bağlantı kesildi, yeniden deneniyor…" /> : null}

      {snap.winner ? (
        <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">
          Kazanan: {snap.winner.bidder ?? '—'}
          {snap.winner.finalPriceMinor
            ? ` · ${formatTry(snap.winner.finalPriceMinor)} / birim`
            : ''}
        </p>
      ) : null}
      {my?.isWinner ? (
        <Link className="text-sm underline" href="/siparisler">
          Siparişinizi görüntüleyin ve ödeme talimatını alın
        </Link>
      ) : null}

      {!loggedIn ? (
        <p className="text-sm">
          Teklif vermek için{' '}
          <Link className="underline" href="/giris">
            giriş yapın
          </Link>
          .
        </p>
      ) : !canBid ? (
        <p className="text-sm text-muted-foreground">
          {my?.isSeller
            ? 'Kendi mezatınıza teklif veremezsiniz.'
            : 'Teklif vermek için şirketinizin onaylı olması gerekir.'}
        </p>
      ) : (
        <>
          <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
            <p>
              <strong>Teminat:</strong> {formatTry(snap.depositMinor)} —{' '}
              {DEPOSIT_LABELS[depositStatus] ?? depositStatus}
            </p>
            {depositStatus === 'none' && !deposit ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void payDeposit()}>
                Teminat yatır
              </Button>
            ) : null}
            {deposit ? (
              <div role="status" className="space-y-1">
                <p>
                  Aşağıdaki hesaba havale yapın; yönetici onayından sonra teklif verebilirsiniz.
                </p>
                <p>
                  IBAN: <span className="font-mono">{deposit.iban}</span>
                </p>
                <p>
                  Açıklama (referans):{' '}
                  <span className="font-mono font-semibold">{deposit.reference}</span>
                </p>
                <p>Tutar: {formatTry(deposit.amountMinor)}</p>
              </div>
            ) : null}
            {depositError ? <ErrorBox message={depositError} /> : null}
          </div>

          {live ? (
            <form onSubmit={(e) => void placeBid(e)} className="space-y-2">
              <Field
                label="Teklifiniz (₺ / birim)"
                htmlFor="bid-amount"
                hint={`En az ${formatTry(snap.minNextBidMinor)}`}
              >
                <input
                  id="bid-amount"
                  inputMode="decimal"
                  className={inputCls}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                  }}
                  placeholder={formatTry(snap.minNextBidMinor).replace(' ₺', '')}
                  disabled={busy || !my?.eligible || my.isHighBidder}
                />
              </Field>
              {my?.isHighBidder ? (
                <p role="status" className="text-sm text-success">
                  En yüksek teklif sizde.
                </p>
              ) : null}
              {my && !my.eligible ? (
                <p className="text-sm text-muted-foreground">
                  Teklif için teminatın onaylanmış olması gerekir.
                </p>
              ) : null}
              {error ? <ErrorBox message={error} /> : null}
              <Button
                type="submit"
                disabled={busy || !my?.eligible || my.isHighBidder || amount.trim() === ''}
              >
                {busy ? 'Gönderiliyor…' : 'Teklif ver'}
              </Button>
            </form>
          ) : null}
        </>
      )}

      <div>
        <h3 className="mb-1 text-sm font-semibold">Teklif geçmişi</h3>
        {snap.bids.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz teklif yok.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Son teklifler</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th scope="col" className="py-1">
                  Teklif veren
                </th>
                <th scope="col">Tutar</th>
                <th scope="col" className="text-right">
                  Zaman
                </th>
              </tr>
            </thead>
            <tbody>
              {snap.bids.map((b) => (
                <tr key={b.seq} className="border-t">
                  <td className="py-1">{b.bidder}</td>
                  <td>{formatTry(b.amountMinor)}</td>
                  <td className="text-right text-muted-foreground">
                    {new Date(b.at).toLocaleTimeString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
