import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import type { Database } from '../../../db/schema.js';
import { DB, notFound, validate } from '../../platform/index.js';

const PAGE_SIZE = 20;

// Every query is scoped to the caller's own user id (object-level authorization).
@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async list(userId: string, params: { unread?: unknown; page?: unknown }) {
    const page = validate.pageParam(params.page);
    const unreadOnly = params.unread === '1';
    const base = this.db
      .selectFrom('notifications')
      .where('user_id', '=', userId)
      .$if(unreadOnly, (qb) => qb.where('read_at', 'is', null));
    const total = await base
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const rows = await base
      .select(['id', 'type', 'title', 'body', 'link', 'created_at', 'read_at'])
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute();
    return {
      page,
      total: Number(total.n),
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        link: r.link,
        createdAt: r.created_at,
        read: r.read_at !== null,
      })),
    };
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const r = await this.db
      .selectFrom('notifications')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .executeTakeFirstOrThrow();
    return { count: Number(r.n) };
  }

  // Someone else's id looks exactly like a missing one.
  async markRead(userId: string, id: string): Promise<{ id: string; read: true }> {
    const r = await this.db
      .updateTable('notifications')
      .set({ read_at: sql<Date>`coalesce(read_at, clock_timestamp())` })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (r.numUpdatedRows !== 1n) throw notFound('Notification not found');
    return { id, read: true };
  }

  async readAll(userId: string): Promise<{ updated: number }> {
    const r = await this.db
      .updateTable('notifications')
      .set({ read_at: sql<Date>`clock_timestamp()` })
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .executeTakeFirst();
    return { updated: Number(r.numUpdatedRows) };
  }
}
