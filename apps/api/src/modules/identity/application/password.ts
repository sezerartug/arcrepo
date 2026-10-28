import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

// argon2id with OWASP-minimum cost (19 MiB, 2 passes, 1 lane). Stored as: argon2id$m,t,p$salt$hash.
interface Params {
  memory: number;
  passes: number;
  parallelism: number;
  tagLength: number;
}
const PARAMS: Params = { memory: 19_456, passes: 2, parallelism: 1, tagLength: 32 };

function derive(password: string, nonce: Buffer, p: Params): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2('argon2id', { message: password, nonce, ...p }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  const { memory, passes, parallelism } = PARAMS;
  const cost = [memory, passes, parallelism].join(',');
  return `argon2id$${cost}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, params, salt, hash] = stored.split('$');
  if (alg !== 'argon2id' || !params || !salt || !hash) return false;
  const [memory, passes, parallelism] = params.split(',').map(Number);
  if (!memory || !passes || !parallelism) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await derive(password, Buffer.from(salt, 'base64url'), {
    memory,
    passes,
    parallelism,
    tagLength: expected.length,
  });
  return timingSafeEqual(key, expected);
}
