import type { Kysely } from 'kysely';
import type { Database } from '../../../db/schema.js';

export interface NotificationInput {
  readonly companyId: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly link?: string;
}

// One INSERT ... SELECT: a row per member of the company. Pass the business transaction so the
// notification commits or rolls back with the event it announces. Text must carry no personal data.
export async function notifyCompany(trx: Kysely<Database>, n: NotificationInput): Promise<void> {
  await trx
    .insertInto('notifications')
    .columns(['user_id', 'company_id', 'type', 'title', 'body', 'link'])
    .expression((eb) =>
      eb
        .selectFrom('company_members as m')
        .select([
          'm.user_id',
          'm.company_id',
          eb.val(n.type).as('type'),
          eb.val(n.title).as('title'),
          eb.val(n.body).as('body'),
          eb.val(n.link ?? null).as('link'),
        ])
        .where('m.company_id', '=', n.companyId),
    )
    .execute();
}
