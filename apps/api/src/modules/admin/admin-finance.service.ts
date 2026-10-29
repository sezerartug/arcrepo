import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import type { Database } from '../../db/schema.js';
import { ledgerTotal } from '../ledger/index.js';
import type { AuthContext } from '../identity/index.js';
import { DB, invalid, jsonSafe, recordAudit } from '../platform/index.js';

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Orders whose total is still held in the escrow account.
const ESCROWED = ['paid_escrow', 'shipped', 'delivered', 'disputed'] as const;
const PRESETS = ['today', '7d', '30d', 'all'] as const;
const STATUS_TR: Record<string, string> = { completed: 'Tamamlandı', refunded: 'İade edildi' };

export interface FinanceRange {
  readonly from: Date | null;
  readonly to: Date | null; // exclusive
  readonly fromDate: string | null; // YYYY-MM-DD (UTC)
  readonly toDate: string | null; // YYYY-MM-DD (UTC), inclusive
}

// UTF-8 byte order mark so Excel opens the file as UTF-8 (Turkish characters).
const BOM = String.fromCharCode(0xfeff);

const big = (v: unknown): bigint =>
  BigInt(typeof v === 'bigint' || typeof v === 'string' || typeof v === 'number' ? v : 0);

/** TRY minor units -> "12345,67" (no thousands separator, decimal comma, Excel-tr friendly). */
export function formatCsvTry(minor: bigint): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  return `${neg ? '-' : ''}${(abs / 100n).toString()},${(abs % 100n).toString().padStart(2, '0')}`;
}

/** One text cell: neutralises spreadsheet formulas and quotes separators. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(';'));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

/** Read-only finance report over the ledger and orders. All times are the database clock, UTC. */
@Injectable()
export class AdminFinanceService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  /** Query: ?range=today|7d|30d|all or ?from=YYYY-MM-DD&to=YYYY-MM-DD (UTC, both inclusive). */
  async parseRange(q: Record<string, unknown>): Promise<FinanceRange> {
    const str = (k: string): string | undefined =>
      typeof q[k] === 'string' && q[k] !== '' ? q[k] : undefined;
    const range = str('range');
    if (range !== undefined && !(PRESETS as readonly string[]).includes(range)) {
      throw invalid('range must be today, 7d, 30d or all');
    }
    let fromDate = str('from') ?? null;
    let toDate = str('to') ?? null;
    if (range && range !== 'all') {
      const today = (
        await sql<{
          d: string;
        }>`select to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD') as d`.execute(this.db)
      ).rows[0]?.d;
      if (!today) throw invalid('could not read the database clock');
      const days = range === 'today' ? 0 : range === '7d' ? 6 : 29;
      toDate = today;
      fromDate = new Date(Date.parse(`${today}T00:00:00Z`) - days * DAY_MS)
        .toISOString()
        .slice(0, 10);
    } else if (range === 'all') {
      fromDate = null;
      toDate = null;
    }
    const parse = (v: string | null, name: string): Date | null => {
      if (v === null) return null;
      const d = new Date(`${v}T00:00:00Z`);
      if (!DATE_RE.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
        throw invalid(`${name} must be a date as YYYY-MM-DD`);
      }
      return d;
    };
    const from = parse(fromDate, 'from');
    const toDay = parse(toDate, 'to');
    if (from && toDay && toDay < from) throw invalid('to must not be before from');
    return {
      from,
      to: toDay ? new Date(toDay.getTime() + DAY_MS) : null,
      fromDate,
      toDate,
    };
  }

  // `col` is always a literal column expression from this file, never user input.
  private within(col: string, r: FinanceRange) {
    const c = sql.raw(col);
    return sql`${c} >= coalesce(${r.from}::timestamptz, '-infinity'::timestamptz)
      and ${c} < coalesce(${r.to}::timestamptz, 'infinity'::timestamptz)`;
  }

  async summary(r: FinanceRange) {
    const db = this.db;
    const [balances, revenue, payables, completed, refunds, disputes, escrowOrders, total] =
      await Promise.all([
        sql<{ type: string; balance: unknown }>`
          select a.type, coalesce(sum(e.amount_minor), 0)::bigint as balance
          from ledger_accounts a left join ledger_entries e on e.account_id = a.id
          group by a.type`.execute(db),
        sql<{ reason: string; amount: unknown }>`
          select j.reason, coalesce(sum(e.amount_minor), 0)::bigint as amount
          from ledger_entries e
          join ledger_journals j on j.id = e.journal_id
          join ledger_accounts a on a.id = e.account_id
          where a.type = 'platform_revenue' and ${this.within('j.created_at', r)}
          group by j.reason`.execute(db),
        sql<{ company_id: string; legal_name: string; balance: unknown }>`
          select c.id as company_id, c.legal_name, sum(e.amount_minor)::bigint as balance
          from ledger_accounts a
          join ledger_entries e on e.account_id = a.id
          join companies c on c.id = a.company_id
          where a.type = 'seller_payable'
          group by c.id, c.legal_name
          having sum(e.amount_minor) <> 0
          order by sum(e.amount_minor) desc, c.legal_name`.execute(db),
        sql<{ n: unknown; total: unknown }>`
          select count(*)::bigint as n, coalesce(sum(total_minor), 0)::bigint as total
          from orders where status = 'completed' and ${this.within('completed_at', r)}`.execute(db),
        sql<{ n: unknown; total: unknown }>`
          select count(*)::bigint as n, coalesce(sum(refund_minor), 0)::bigint as total
          from order_disputes
          where resolution = 'refund' and refund_minor > 0 and ${this.within('resolved_at', r)}`.execute(
          db,
        ),
        sql<{ n: unknown }>`
          select count(*)::bigint as n from order_disputes where ${this.within('opened_at', r)}`.execute(
          db,
        ),
        sql<{ total: unknown }>`
          select coalesce(sum(total_minor), 0)::bigint as total from orders
          where status in (${sql.join([...ESCROWED])})`.execute(db),
        ledgerTotal(db),
      ]);

    const balanceOf = (type: string): bigint =>
      big(balances.rows.find((b) => b.type === type)?.balance);
    const revenueBy = (...reasons: string[]): bigint =>
      revenue.rows
        .filter((x) => reasons.includes(x.reason))
        .reduce((s, x) => s + big(x.amount), 0n);
    const payableTotal = payables.rows.reduce((s, p) => s + big(p.balance), 0n);
    const escrow = balanceOf('escrow');
    const escrowExpected = big(escrowOrders.rows[0]?.total);
    const diff = escrow - escrowExpected;
    const done = completed.rows[0];
    const ref = refunds.rows[0];

    return jsonSafe({
      currency: 'TRY',
      range: { from: r.fromDate, to: r.toDate },
      commission: {
        amountMinor: revenueBy('order.release', 'order.dispute_resolution'),
        scope: 'range',
        kaynak: 'ledger: platform_revenue (order.release, order.dispute_resolution)',
      },
      forfeitedDeposits: {
        amountMinor: revenueBy('order.deposit_forfeit'),
        scope: 'range',
        kaynak: 'ledger: platform_revenue (order.deposit_forfeit)',
      },
      escrow: {
        amountMinor: escrow,
        scope: 'now',
        kaynak: 'ledger: escrow',
      },
      pendingPayables: {
        amountMinor: payableTotal,
        scope: 'now',
        kaynak: 'ledger: seller_payable (şirket başına)',
        companies: payables.rows.map((p) => ({
          companyId: p.company_id,
          companyName: p.legal_name,
          amountMinor: big(p.balance),
        })),
      },
      depositHeld: {
        amountMinor: balanceOf('deposit_held'),
        scope: 'now',
        kaynak: 'ledger: deposit_held',
      },
      bankClearing: {
        amountMinor: balanceOf('bank_clearing'),
        scope: 'now',
        kaynak: 'ledger: bank_clearing',
      },
      completedOrders: {
        count: big(done?.n),
        totalMinor: big(done?.total),
        scope: 'range',
        kaynak: 'orders: status=completed, completed_at, total_minor',
      },
      refunds: {
        count: big(ref?.n),
        amountMinor: big(ref?.total),
        scope: 'range',
        kaynak: 'order_disputes: resolution=refund, resolved_at, refund_minor',
      },
      disputes: {
        count: big(disputes.rows[0]?.n),
        scope: 'range',
        kaynak: 'order_disputes: opened_at',
      },
      consistency: {
        ok: total === 0n && diff === 0n,
        ledgerTotalMinor: total,
        escrowMinor: escrow,
        openOrdersEscrowMinor: escrowExpected,
        diffMinor: diff,
        kaynak:
          'ledger toplamı = 0; escrow = açık siparişlerin toplamı (paid_escrow, shipped, delivered, disputed)',
      },
    }) as Record<string, unknown>;
  }

  async ordersCsv(admin: AuthContext, r: FinanceRange): Promise<string> {
    const rows = await sql<{
      id: string;
      at: Date;
      status: string;
      total: unknown;
      commission: unknown;
      refund: unknown;
      buyer: string;
      seller: string;
    }>`
      select o.id, coalesce(o.completed_at, d.resolved_at) as at, o.status,
        o.total_minor as total, o.commission_minor as commission, o.refund_minor as refund,
        b.legal_name as buyer, s.legal_name as seller
      from orders o
      join companies b on b.id = o.buyer_company_id
      join companies s on s.id = o.seller_company_id
      left join order_disputes d on d.order_id = o.id and d.status = 'resolved'
      where o.status in ('completed', 'refunded')
        and ${this.within('coalesce(o.completed_at, d.resolved_at)', r)}
      order by at desc, o.id`.execute(this.db);
    const body = toCsv(
      [
        'Sipariş no',
        'Tarih (UTC)',
        'Alıcı şirket',
        'Satıcı şirket',
        'Toplam (TL)',
        'Komisyon (TL)',
        'İade (TL)',
        'Net satıcı payı (TL)',
        'Durum',
      ],
      rows.rows.map((x) => {
        const total = big(x.total);
        const refund = big(x.refund);
        const commission = big(x.commission);
        return [
          x.id,
          x.at.toISOString().slice(0, 19).replace('T', ' '),
          x.buyer,
          x.seller,
          formatCsvTry(total),
          formatCsvTry(commission),
          formatCsvTry(refund),
          formatCsvTry(total - refund - commission),
          STATUS_TR[x.status] ?? x.status,
        ];
      }),
    );
    await this.audit(admin, 'orders', r, rows.rows.length);
    return body;
  }

  async payoutsCsv(admin: AuthContext): Promise<string> {
    const rows = await sql<{ id: string; legal_name: string; tax_no: string; balance: unknown }>`
      select c.id, c.legal_name, c.tax_no, sum(e.amount_minor)::bigint as balance
      from ledger_accounts a
      join ledger_entries e on e.account_id = a.id
      join companies c on c.id = a.company_id
      where a.type = 'seller_payable'
      group by c.id, c.legal_name, c.tax_no
      having sum(e.amount_minor) <> 0
      order by sum(e.amount_minor) desc, c.legal_name`.execute(this.db);
    const body = toCsv(
      ['Şirket no', 'Şirket', 'Vergi no', 'Bekleyen hakediş (TL)'],
      rows.rows.map((x) => [x.id, x.legal_name, x.tax_no, formatCsvTry(big(x.balance))]),
    );
    await this.audit(admin, 'payouts', undefined, rows.rows.length);
    return body;
  }

  private audit(admin: AuthContext, kind: string, r: FinanceRange | undefined, rows: number) {
    return recordAudit(this.db, {
      actorType: 'admin',
      actorId: admin.userId,
      action: 'admin.finance.export',
      entityType: 'finance',
      data: { kind, from: r?.fromDate ?? null, to: r?.toDate ?? null, rows },
    });
  }
}
