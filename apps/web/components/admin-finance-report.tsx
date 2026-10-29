import Link from 'next/link';
import { Badge, Card, Empty, LoadError } from '@/components/common';
import { Button } from '@/components/ui/button';
import { formatTry } from '@/lib/api';
import type { AdminFinanceSummary } from '@/lib/admin-types';
import { serverGet, toQuery } from '@/lib/server-api';
import { cn } from '@/lib/utils';

export type FinanceSP = { range?: string; from?: string; to?: string };

const RANGES = [
  ['today', 'Bugün'],
  ['7d', '7 gün'],
  ['30d', '30 gün'],
  ['all', 'Tümü'],
] as const;

const SCOPE_NOTE = { range: 'Seçili aralık', now: 'Anlık bakiye' } as const;

function Stat({
  label,
  value,
  scope,
  source,
  detail,
}: {
  label: string;
  value: string;
  scope: keyof typeof SCOPE_NOTE;
  source: string;
  detail?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground" title={source}>
        {SCOPE_NOTE[scope]} · Kaynak: {source}
      </p>
    </Card>
  );
}

export async function FinanceReport({ sp }: { sp: FinanceSP }) {
  // Default is all time; a custom from/to pair wins over a preset only when no preset is chosen.
  const range = sp.range && !sp.from && !sp.to ? sp.range : undefined;
  const query = toQuery({ range, from: sp.from, to: sp.to });
  const res = await serverGet<AdminFinanceSummary>(`/admin/finance/summary${query}`);
  const active = sp.from || sp.to ? 'custom' : (sp.range ?? 'all');

  return (
    <section aria-labelledby="a-finance">
      <h2 id="a-finance" className="mb-2 text-lg font-semibold text-primary">
        Mali rapor
      </h2>
      <nav aria-label="Tarih aralığı" className="mb-3 flex flex-wrap gap-2">
        {RANGES.map(([k, text]) => (
          <Link
            key={k}
            href={`/admin?tab=mali-rapor&range=${k}`}
            aria-current={k === active ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-0.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
              k === active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {text}
          </Link>
        ))}
      </nav>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="mali-rapor" />
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Başlangıç (UTC)</span>
          <input
            type="date"
            name="from"
            defaultValue={sp.from}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Bitiş (UTC, dahil)</span>
          <input
            type="date"
            name="to"
            defaultValue={sp.to}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </label>
        <Button type="submit" variant="outline">
          Uygula
        </Button>
      </form>

      {!res.ok ? <LoadError error={res.error} /> : <Report data={res.data} query={query} />}
    </section>
  );
}

function Report({ data: d, query }: { data: AdminFinanceSummary; query: string }) {
  const c = d.consistency;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {c.ok ? (
          <Badge tone="ok">Tutarlı</Badge>
        ) : (
          <Badge tone="bad">Fark var: {formatTry(c.diffMinor)}</Badge>
        )}
        <span className="text-xs text-muted-foreground">
          Ledger toplamı {formatTry(c.ledgerTotalMinor)} · Emanet {formatTry(c.escrowMinor)} · Açık
          siparişler {formatTry(c.openOrdersEscrowMinor)}
        </span>
        <span className="ml-auto flex gap-3 text-sm">
          <a
            className="text-primary underline"
            href={`/api/admin/finance/orders.csv${query}`}
            download="siparisler.csv"
          >
            Siparişler (CSV)
          </a>
          <a
            className="text-primary underline"
            href="/api/admin/finance/payouts.csv"
            download="hakedisler.csv"
          >
            Hakedişler (CSV)
          </a>
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Komisyon geliri"
          value={formatTry(d.commission.amountMinor)}
          scope={d.commission.scope}
          source={d.commission.kaynak}
          detail={`Ayrıca ihlal teminatı geliri: ${formatTry(d.forfeitedDeposits.amountMinor)}`}
        />
        <Stat
          label="Emanet bakiyesi"
          value={formatTry(d.escrow.amountMinor)}
          scope={d.escrow.scope}
          source={d.escrow.kaynak}
        />
        <Stat
          label="Bekleyen satıcı hakedişi"
          value={formatTry(d.pendingPayables.amountMinor)}
          scope={d.pendingPayables.scope}
          source={d.pendingPayables.kaynak}
        />
        <Stat
          label="Tutulan teminat"
          value={formatTry(d.depositHeld.amountMinor)}
          scope={d.depositHeld.scope}
          source={d.depositHeld.kaynak}
        />
        <Stat
          label="Ciro (tamamlanan siparişler)"
          value={formatTry(d.completedOrders.totalMinor)}
          scope={d.completedOrders.scope}
          source={d.completedOrders.kaynak}
          detail={`${d.completedOrders.count} sipariş`}
        />
        <Stat
          label="İade toplamı"
          value={formatTry(d.refunds.amountMinor)}
          scope={d.refunds.scope}
          source={d.refunds.kaynak}
          detail={`${d.refunds.count} iade · ${d.disputes.count} itiraz`}
        />
        <Stat
          label="Banka mutabakat hesabı"
          value={formatTry(d.bankClearing.amountMinor)}
          scope={d.bankClearing.scope}
          source={d.bankClearing.kaynak}
        />
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Şirket başına bekleyen hakediş</h3>
        {d.pendingPayables.companies.length === 0 ? (
          <Empty>Bekleyen hakediş yok.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2">Şirket</th>
                  <th className="px-3 py-2 text-right">Bekleyen hakediş</th>
                </tr>
              </thead>
              <tbody>
                {d.pendingPayables.companies.map((p) => (
                  <tr key={p.companyId} className="border-t">
                    <td className="px-3 py-2">
                      <Link className="underline" href={`/admin/sirketler/${p.companyId}`}>
                        {p.companyName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatTry(p.amountMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
