import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, request } from './api';
import type { Me } from './types';

const API_ORIGIN = process.env.API_URL ?? 'http://127.0.0.1:3001';

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Server-component GET that forwards the session cookie and never throws. */
export async function serverGet<T>(path: string): Promise<Result<T>> {
  // Outside try: cookies() signals "dynamic rendering" by throwing, which must not be swallowed.
  const cookie = (await cookies()).toString();
  try {
    const data = await request<T>(API_ORIGIN, path, { headers: cookie ? { cookie } : {} });
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e : new ApiError(0, 'NETWORK', 'Sunucuya ulaşılamadı'),
    };
  }
}

export async function getMe(): Promise<Me | null> {
  const r = await serverGet<Me>('/me');
  return r.ok ? r.data : null;
}

/** Page guard: sends anonymous visitors to the login page. */
export async function requireMe(): Promise<Me> {
  const r = await serverGet<Me>('/me');
  if (r.ok) return r.data;
  if (r.error.status === 401) redirect('/giris');
  throw r.error;
}

export function toQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function loadCategories() {
  const r = await serverGet<import('./types').Category[]>('/categories');
  return r.ok ? r.data : [];
}
