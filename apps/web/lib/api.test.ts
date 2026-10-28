import { describe, expect, it, vi, afterEach } from 'vitest';
import { ApiError, formatQty, formatTry, parseQtyToBase, parseTryToMinor, request } from './api';
import { errorMessage } from './errors';

afterEach(() => vi.unstubAllGlobals());

describe('formatTry', () => {
  it('formats kuruş as Turkish lira', () => {
    expect(formatTry('123456')).toBe('1.234,56 ₺');
    expect(formatTry('5')).toBe('0,05 ₺');
    expect(formatTry('100000000000000000')).toBe('1.000.000.000.000.000,00 ₺');
    expect(formatTry('-250')).toBe('-2,50 ₺');
  });
});

describe('quantity and money parsing', () => {
  it('formats quantity in sales unit', () => {
    expect(formatQty(25000, 1000, 'ton')).toBe('25 ton');
  });
  it('parses TL input to kuruş and tonnes to kg', () => {
    expect(parseTryToMinor('1.250,50')).toBe('125050');
    expect(parseTryToMinor('abc')).toBeNull();
    expect(parseQtyToBase('2,5', 1000)).toBe(2500);
    expect(parseQtyToBase('0', 1000)).toBeNull();
  });
});

describe('request', () => {
  it('maps the error envelope to ApiError and sends Idempotency-Key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'BID_TOO_LOW', message: 'x', minNextBidMinor: '150000' } }),
        {
          status: 422,
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const err = await request('/api', '/auctions/1/bids', {
      method: 'POST',
      json: { a: 1 },
      idempotent: true,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('BID_TOO_LOW');
    expect(errorMessage(err)).toContain('1.500,00 ₺');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(init.credentials).toBe('include');
  });

  it('reports network failures as NETWORK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')));
    await expect(request('/api', '/me')).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
