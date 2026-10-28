import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../../db/schema.js';
import { badRequest, AppError } from './errors.js';
import { jsonSafe } from './json.js';

export interface StoredResponse {
  readonly status: number;
  readonly body: unknown;
}

const KEY = /^[A-Za-z0-9_-]{8,128}$/;

export function requireIdempotencyKey(header: string | string[] | undefined): string {
  const v = Array.isArray(header) ? header[0] : header;
  if (v === undefined)
    throw badRequest('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required');
  if (!KEY.test(v))
    throw badRequest(
      'IDEMPOTENCY_KEY_INVALID',
      'Idempotency-Key must be 8-128 URL-safe characters',
    );
  return v;
}

// Same key + same request -> the stored response, the action does not run twice.
// Same key + different request -> 422 IDEMPOTENCY_MISMATCH. The key row commits with the action, so a
// failed action leaves no key behind and can be retried; concurrent duplicates serialize on the primary key.
export async function withIdempotency(
  db: Kysely<Database>,
  req: { userId: string; key: string; scope: string; body: unknown },
  action: (trx: Kysely<Database>) => Promise<StoredResponse>,
): Promise<StoredResponse> {
  const requestHash = createHash('sha256')
    .update(`${req.scope}\n${JSON.stringify(req.body ?? null)}`)
    .digest('hex');

  return db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto('idempotency_keys')
      .values({ user_id: req.userId, key: req.key, request_hash: requestHash })
      .onConflict((oc) => oc.columns(['user_id', 'key']).doNothing())
      .returning('key')
      .executeTakeFirst();

    if (!inserted) {
      const existing = await trx
        .selectFrom('idempotency_keys')
        .select(['request_hash', 'response_status', 'response_body'])
        .where('user_id', '=', req.userId)
        .where('key', '=', req.key)
        .executeTakeFirstOrThrow();
      if (existing.request_hash !== requestHash || existing.response_status === null) {
        throw new AppError(
          422,
          'IDEMPOTENCY_MISMATCH',
          'Idempotency-Key was already used with a different request',
        );
      }
      return { status: existing.response_status, body: existing.response_body };
    }

    const result = await action(trx);
    const body = jsonSafe(result.body);
    await trx
      .updateTable('idempotency_keys')
      .set({ response_status: result.status, response_body: JSON.stringify(body) })
      .where('user_id', '=', req.userId)
      .where('key', '=', req.key)
      .execute();
    return { status: result.status, body };
  });
}
