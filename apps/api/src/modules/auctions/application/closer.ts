import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { dbNow } from '../../../db/clock.js';
import type { Database } from '../../../db/schema.js';
import { notifyCompany } from '../../notifications/index.js';
import { DB, recordAudit } from '../../platform/index.js';
import { lineTotalMinor } from '../../pricing/index.js';
import { pickWinner, reserveMet } from '../domain/rules.js';
import { releaseDeposits } from './deposits.js';
import { AUCTION_ORDER_PORT, type AuctionOrderPort } from './order-port.js';
import { recordEvent, transitionStatus } from './support.js';

@Injectable()
export class AuctionCloser {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(AUCTION_ORDER_PORT) private readonly orders: AuctionOrderPort,
  ) {}

  // SCHEDULED -> LIVE once starts_at has passed. Idempotent.
  async startAuction(id: string, skipLocked = false): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      let q = trx.selectFrom('auctions').selectAll().where('id', '=', id).forUpdate();
      if (skipLocked) q = q.skipLocked();
      const a = await q.executeTakeFirst();
      if (a?.status !== 'SCHEDULED') return false;
      if (a.starts_at > (await dbNow(trx))) return false;
      await transitionStatus(trx, a, 'LIVE');
      await recordEvent(trx, id, a.last_seq, 'auction.started', {});
      return true;
    });
  }

  // AUCTION-RULES §5. Idempotent and safe to call from the sweeper, the lazy path and tests in
  // parallel: the row lock serialises, the status check turns every later call into a no-op (I4).
  async closeAuction(id: string, skipLocked = false): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      let q = trx.selectFrom('auctions').selectAll().where('id', '=', id).forUpdate();
      if (skipLocked) q = q.skipLocked();
      const a = await q.executeTakeFirst();
      if (a?.status !== 'LIVE') return false;
      const t = await dbNow(trx); // after the lock
      if (a.ends_at > t) return false; // extended in the meantime

      const rows = await trx
        .selectFrom('bids')
        .select(['id', 'seq', 'bidder_company_id', 'amount_minor'])
        .where('auction_id', '=', id)
        .orderBy('seq', 'desc')
        .limit(1)
        .execute();
      const winner = pickWinner(
        rows.map((r) => ({
          id: r.id,
          seq: r.seq,
          amountMinor: r.amount_minor,
          companyId: r.bidder_company_id,
        })),
      );
      const sold = winner !== null && reserveMet(a.reserve_minor, winner.amountMinor);

      const total = winner
        ? lineTotalMinor(winner.amountMinor, a.quantity_base, BigInt(a.base_per_unit))
        : null;
      const inserted = await trx
        .insertInto('auction_results')
        .values({
          auction_id: id,
          outcome: sold ? 'sold' : 'no_sale',
          winner_company_id: sold ? winner.companyId : null,
          winning_bid_id: sold ? winner.id : null,
          final_price_minor: winner?.amountMinor ?? null,
          total_minor: total,
        })
        .onConflict((oc) => oc.column('auction_id').doNothing())
        .returning('id')
        .executeTakeFirst();
      if (!inserted) return false;

      await transitionStatus(trx, a, sold ? 'PAYMENT_PENDING' : 'ENDED_NO_SALE', {
        closed_at: sql<Date>`clock_timestamp()`,
      });
      const refunded = await releaseDeposits(trx, id, sold ? winner.companyId : null, {
        actorType: 'system',
      });
      if (sold && total !== null) {
        await this.orders.createOrderFromAuction(trx, {
          auctionId: id,
          listingId: a.listing_id,
          sellerCompanyId: a.seller_company_id,
          buyerCompanyId: winner.companyId,
          winningBidId: winner.id,
          unitPriceMinor: winner.amountMinor,
          quantityBase: a.quantity_base,
          basePerUnit: a.base_per_unit,
          totalMinor: total,
          depositMinor: a.deposit_minor,
        });
      }
      await this.notifyClosed(
        trx,
        id,
        a.listing_id,
        a.seller_company_id,
        sold ? winner.companyId : null,
      );
      const data = {
        outcome: sold ? 'sold' : 'no_sale',
        finalPriceMinor: winner?.amountMinor.toString() ?? null,
        reserveMet: winner ? reserveMet(a.reserve_minor, winner.amountMinor) : false,
        refundedDeposits: refunded,
      };
      await recordEvent(trx, id, a.last_seq, 'auction.closed', data);
      await recordAudit(trx, {
        actorType: 'system',
        companyId: a.seller_company_id,
        action: 'auction.closed',
        entityType: 'auction',
        entityId: id,
        data,
      });
      return true;
    });
  }

  // Winner, losing depositors and seller each hear about the result (same transaction as the close).
  private async notifyClosed(
    trx: Kysely<Database>,
    auctionId: string,
    listingId: string,
    sellerCompanyId: string,
    winnerCompanyId: string | null,
  ): Promise<void> {
    const listing = await trx
      .selectFrom('listings')
      .select('title')
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow();
    const deposits = await trx
      .selectFrom('deposits')
      .select('company_id')
      .distinct()
      .where('auction_id', '=', auctionId)
      .execute();
    const link = `/mezat/${auctionId}`;
    if (winnerCompanyId) {
      const order = await trx
        .selectFrom('orders')
        .select('id')
        .where('source_auction_id', '=', auctionId)
        .executeTakeFirst();
      await notifyCompany(trx, {
        companyId: winnerCompanyId,
        type: 'auction.won',
        title: 'Mezatı kazandınız',
        body: `"${listing.title}" mezatını kazandınız, siparişiniz oluştu. Ödemeyi süresi içinde yapın.`,
        link: order ? `/siparisler/${order.id}` : '/siparisler',
      });
    }
    for (const { company_id: companyId } of deposits) {
      if (companyId === winnerCompanyId) continue;
      await notifyCompany(trx, {
        companyId,
        type: 'auction.lost',
        title: 'Mezat sonuçlandı',
        body: `"${listing.title}" mezatı sonuçlandı, teminatınız iade edildi.`,
        link,
      });
    }
    await notifyCompany(trx, {
      companyId: sellerCompanyId,
      type: 'auction.closed_seller',
      title: winnerCompanyId ? 'Mezatınız satıldı' : 'Mezatınız satışsız bitti',
      body: winnerCompanyId
        ? `"${listing.title}" mezatı satışla sonuçlandı.`
        : `"${listing.title}" mezatı satış olmadan sona erdi.`,
      link,
    });
  }

  // One sweeper pass: start what is due, close what has ended. Locked rows are skipped (a bid is in
  // flight); the next pass picks them up.
  async sweep(): Promise<void> {
    const starting = await this.db
      .selectFrom('auctions')
      .select('id')
      .where('status', '=', 'SCHEDULED')
      .where(sql<boolean>`starts_at <= clock_timestamp()`)
      .orderBy('starts_at')
      .limit(100)
      .execute();
    for (const { id } of starting) await this.startAuction(id, true);

    const ending = await this.db
      .selectFrom('auctions')
      .select('id')
      .where('status', '=', 'LIVE')
      .where(sql<boolean>`ends_at <= clock_timestamp()`)
      .orderBy('ends_at')
      .limit(100)
      .execute();
    for (const { id } of ending) await this.closeAuction(id, true);
  }
}
