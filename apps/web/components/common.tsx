import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

export const inputCls =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50';

export const ctaCls =
  'inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none';

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border bg-card p-5 text-card-foreground shadow-sm', className)}>
      {children}
    </div>
  );
}

export function ErrorBox({ error, message }: { error?: unknown; message?: string }) {
  const text = message ?? errorMessage(error);
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {text}
    </p>
  );
}

export function LoadError({ error }: { error: ApiError }) {
  return (
    <div className="space-y-2">
      <ErrorBox error={error} message={`Veriler yüklenemedi: ${errorMessage(error)}`} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

const TONES: Record<string, string> = {
  ok: 'bg-success/10 text-success',
  warn: 'bg-brand/20 text-brand-text',
  bad: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone])}>
      {children}
    </span>
  );
}

const STATUS_LABELS: Record<string, [string, keyof typeof TONES]> = {
  pending: ['Onay bekliyor', 'warn'],
  verified: ['Doğrulandı', 'ok'],
  rejected: ['Reddedildi', 'bad'],
  suspended: ['Askıda', 'bad'],
  pending_review: ['İncelemede', 'warn'],
  published: ['Yayında', 'ok'],
  sold: ['Satıldı', 'neutral'],
  removed: ['Kaldırıldı', 'neutral'],
  scheduled: ['Planlandı', 'neutral'],
  live: ['Canlı', 'ok'],
  closed: ['Kapandı', 'neutral'],
  draft: ['Taslak', 'neutral'],
  payment_pending: ['Ödeme bekliyor', 'warn'],
  settled: ['Sonuçlandı', 'ok'],
  ended_no_sale: ['Satış olmadı', 'neutral'],
  cancelled: ['İptal', 'bad'],
  awaiting_payment: ['Ödeme bekliyor', 'warn'],
  paid_escrow: ['Emanette', 'ok'],
  shipped: ['Kargoda', 'ok'],
  delivered: ['Teslim edildi', 'ok'],
  completed: ['Tamamlandı', 'ok'],
  payment_failed: ['Ödeme başarısız', 'bad'],
  disputed: ['İtirazlı', 'bad'],
  held: ['Emanette', 'ok'],
  refunded: ['İade edildi', 'neutral'],
  applied: ['Siparişe sayıldı', 'ok'],
  forfeited: ['Gelir kaydedildi', 'bad'],
};

// Auction statuses arrive upper-case (LIVE, SCHEDULED, ...); the table is keyed in lower case.
export function statusLabel(status: string): string {
  return STATUS_LABELS[status.toLowerCase()]?.[0] ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const [label, tone] = STATUS_LABELS[status.toLowerCase()] ?? [status, 'neutral'];
  return <Badge tone={tone}>{label}</Badge>;
}

export function Pagination({
  page,
  total,
  perPage = 20,
  href,
}: {
  page: number;
  total: number;
  perPage?: number;
  href: (p: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Sayfalama" className="flex items-center justify-center gap-3 pt-4 text-sm">
      {page > 1 ? (
        <Link className="underline" href={href(page - 1)}>
          Önceki
        </Link>
      ) : null}
      <span aria-current="page">
        Sayfa {page} / {pages}
      </span>
      {page < pages ? (
        <Link className="underline" href={href(page + 1)}>
          Sonraki
        </Link>
      ) : null}
    </nav>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-primary">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
