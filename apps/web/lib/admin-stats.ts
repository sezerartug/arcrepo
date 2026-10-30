import { statusLabel } from '@/components/common';
import { formatTry } from './api';

const TOP_LABELS: Record<string, string> = {
  users: 'Kullanıcı',
  companies: 'Şirket',
  listings: 'İlan',
  orders: 'Sipariş',
};

/** Flattens nested counters ({ companies: { verified: 1 } }) into "Şirket · Doğrulandı" rows. */
export function statRows(d: Record<string, unknown>): [string, string][] {
  return Object.entries(d).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? Object.entries(v as Record<string, unknown>).map(([k2, v2]): [string, string] =>
          // `orders` mixes status counts with the escrow balance (kuruş), which is money, not a count.
          k2 === 'escrowBalanceMinor'
            ? ['Emanet bakiyesi', formatTry(String(v2))]
            : [`${TOP_LABELS[k] ?? k} · ${statusLabel(k2)}`, String(v2)],
        )
      : [[TOP_LABELS[k] ?? k, String(v)] as [string, string]],
  );
}
