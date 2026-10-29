import Link from 'next/link';
import { formatTry } from '@/lib/api';
import type { SellerSummary } from '@/lib/home';

export function SellerSummaryCards({ summary }: { summary: SellerSummary }) {
  const n = (v: number | null) => (v === null ? '—' : String(v));
  const cards = [
    { label: 'Açık ilan', value: n(summary.openListings), href: '#ilanlarim' },
    { label: 'Canlı mezat', value: n(summary.liveAuctions), href: '/mezatlar' },
    { label: 'Bekleyen sipariş', value: n(summary.pendingOrders), href: '/siparisler' },
    {
      label: 'Bekleyen hakediş',
      value: summary.pendingPayoutMinor === null ? '—' : formatTry(summary.pendingPayoutMinor),
      href: '#payouts',
    },
  ];
  return (
    <section aria-label="Özet" className="mb-8">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label}>
            <Link
              href={c.href}
              className="block h-full rounded-2xl border bg-card p-4 shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-brand focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <span className="mt-1 block text-2xl font-bold tracking-tight text-primary">
                {c.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
