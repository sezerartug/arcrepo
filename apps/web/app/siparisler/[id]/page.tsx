import { ActionButton } from '@/components/action-button';
import { Card, LoadError, PageTitle, StatusBadge, statusLabel } from '@/components/common';
import { formatDate, formatTry } from '@/lib/api';
import { requireMe, serverGet } from '@/lib/server-api';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';

const STEPS = ['awaiting_payment', 'paid_escrow', 'shipped', 'delivered', 'completed'];

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMe();
  const res = await serverGet<Order>(`/orders/${id}`);
  if (!res.ok)
    return res.error.status === 404 ? <p>Sipariş bulunamadı.</p> : <LoadError error={res.error} />;
  const o = res.data;
  const isBuyer = o.buyerCompanyId === me.company?.id;
  const isSeller = o.sellerCompanyId === me.company?.id;
  const reached = STEPS.indexOf(o.status);
  const terminal = ['cancelled', 'payment_failed'].includes(o.status);

  return (
    <div className="space-y-6">
      <PageTitle sub={`Sipariş #${o.id.slice(0, 8)}`}>{o.listingTitle ?? 'Sipariş'}</PageTitle>

      <Card>
        <h2 className="mb-3 font-semibold text-primary">Durum</h2>
        {terminal ? (
          <StatusBadge status={o.status} />
        ) : (
          <ol className="flex flex-col gap-2 sm:flex-row sm:gap-4" aria-label="Sipariş durumu">
            {STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={s === o.status ? 'step' : undefined}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm',
                  i < reached && 'border-success/40 bg-success/5 text-success',
                  i === reached && 'border-primary bg-primary text-primary-foreground',
                  i > reached && 'text-muted-foreground',
                )}
              >
                {statusLabel(s)}
              </li>
            ))}
          </ol>
        )}
        {o.history?.length ? (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {o.history.map((h) => (
              <li key={h.at + h.type}>
                {formatDate(h.at)} — {h.to ? statusLabel(h.to) : h.type}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-primary">Tutar</h2>
        <dl className="grid max-w-md grid-cols-2 gap-1 text-sm">
          <dt className="text-muted-foreground">Birim fiyat</dt>
          <dd>{formatTry(o.unitPriceMinor)}</dd>
          <dt className="text-muted-foreground">Miktar (en küçük birim)</dt>
          <dd>{Number(o.quantityBase).toLocaleString('tr-TR')}</dd>
          <dt className="text-muted-foreground">Toplam (KDV hariç)</dt>
          <dd className="font-semibold">{formatTry(o.totalMinor)}</dd>
          {o.depositAppliedMinor && o.depositAppliedMinor !== '0' ? (
            <>
              <dt className="text-muted-foreground">Düşülen teminat</dt>
              <dd>{formatTry(o.depositAppliedMinor)}</dd>
            </>
          ) : null}
        </dl>
      </Card>

      {isBuyer && o.status === 'awaiting_payment' ? (
        <Card className="space-y-2">
          <h2 className="font-semibold text-primary">Havale talimatı</h2>
          <p className="text-sm">
            Aşağıdaki hesaba havale yapın. Ödeme yönetici tarafından onaylanınca emanete alınır.
          </p>
          <p className="text-sm">
            IBAN: <span className="font-mono">{o.iban ?? 'TR00 DEMO 0000 0000 0000 0000 00'}</span>
          </p>
          <p className="text-sm">
            Açıklama (referans):{' '}
            <span className="font-mono font-semibold">{o.paymentReference ?? '—'}</span>
          </p>
          <p className="text-sm">Ödenecek tutar: {formatTry(o.amountDueMinor ?? o.totalMinor)}</p>
          {o.paymentDueAt ? (
            <p className="text-sm text-muted-foreground">Son ödeme: {formatDate(o.paymentDueAt)}</p>
          ) : null}
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {isSeller && o.status === 'paid_escrow' ? (
          <ActionButton
            path={`/orders/${o.id}/ship`}
            label="Kargoya verildi"
            onDoneMessage="Sipariş kargoya verildi."
          />
        ) : null}
        {isBuyer && o.status === 'shipped' ? (
          <ActionButton
            path={`/orders/${o.id}/confirm-delivery`}
            label="Teslim aldım, onayla"
            onDoneMessage="Teslim onaylandı; hakediş satıcıya aktarılacak."
          />
        ) : null}
      </div>
    </div>
  );
}
