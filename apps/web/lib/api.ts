// Isomorphic API helpers (no next/headers here: safe to import from client components).

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Turns a non-2xx response into an ApiError using the `{ error: { code, message } }` envelope. */
export async function parseApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    const e = body.error;
    if (e && typeof e.code === 'string') {
      return new ApiError(res.status, e.code, e.message ?? e.code, e);
    }
  } catch {
    // fall through: non-JSON body
  }
  return new ApiError(res.status, `HTTP_${String(res.status)}`, 'Beklenmeyen sunucu yanıtı');
}

/** Low-level fetch: JSON in/out, throws ApiError. `base` is '/api' in browsers, the API origin on the server. */
export async function request<T>(
  base: string,
  path: string,
  init: RequestInit & { json?: unknown; idempotent?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set('Content-Type', 'application/json');
  if (init.idempotent) headers.set('Idempotency-Key', crypto.randomUUID());
  let res: Response;
  try {
    res = await fetch(base + path, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Sunucuya ulaşılamadı');
  }
  if (!res.ok) throw await parseApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Browser calls go through the Next rewrite. */
export const clientApi = {
  get: <T>(path: string) => request<T>('/api', path),
  post: <T>(path: string, json?: unknown, idempotent = true) =>
    request<T>('/api', path, { method: 'POST', json, idempotent }),
  patch: <T>(path: string, json: unknown) => request<T>('/api', path, { method: 'PATCH', json }),
  del: <T>(path: string) => request<T>('/api', path, { method: 'DELETE' }),
};

// ---- money / quantity -------------------------------------------------------

/** Kuruş (minor units, string) -> "1.234,56 ₺". */
export function formatTry(minor: string | number | bigint | null | undefined): string {
  if (minor === null || minor === undefined || minor === '') return '—';
  const v = BigInt(minor);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${neg ? '-' : ''}${whole},${frac} ₺`;
}

/** Quantity in smallest unit (kg) -> "25 ton". */
export function formatQty(
  quantityBase: string | number,
  basePerUnit: number,
  unit: string,
): string {
  const n = Number(quantityBase) / basePerUnit;
  return `${n.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`;
}

/** Parses "1.250,50" or "1250.5" into a scaled bigint; returns null when invalid. */
function parseScaled(input: string, decimals: number): bigint | null {
  let s = input.trim().replace(/\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const frac = (m[2] ?? '').slice(0, decimals).padEnd(decimals, '0');
  return BigInt((m[1] ?? '') + frac);
}

/** TL text -> kuruş string, or null. */
export function parseTryToMinor(input: string): string | null {
  const v = parseScaled(input, 2);
  return v === null ? null : v.toString();
}

/** Quantity in sales units (e.g. ton) -> base units (kg) as integer, or null. */
export function parseQtyToBase(input: string, basePerUnit: number): number | null {
  const v = parseScaled(input, 3);
  if (v === null) return null;
  const base = (v * BigInt(basePerUnit)) / 1000n;
  return base > 0n ? Number(base) : null;
}

/** Display-only estimate; the server's lineTotalMinor is authoritative. */
export function lineTotalPreview(
  unitPriceMinor: string,
  quantityBase: number,
  basePerUnit: number,
): string {
  const num = BigInt(unitPriceMinor) * BigInt(quantityBase);
  const den = BigInt(basePerUnit);
  return ((num * 2n + den) / (den * 2n)).toString();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}
