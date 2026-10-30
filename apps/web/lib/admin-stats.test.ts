import { describe, expect, it } from 'vitest';
import { statRows } from './admin-stats';

describe('statRows', () => {
  it('flattens nested counters into labelled rows', () => {
    expect(statRows({ users: 9, companies: { verified: 4 } })).toEqual([
      ['Kullanıcı', '9'],
      ['Şirket · Doğrulandı', '4'],
    ]);
  });

  it('shows the escrow balance as money with a readable label, not the raw field name', () => {
    expect(statRows({ orders: { completed: 1, escrowBalanceMinor: '12345600' } })).toEqual([
      ['Sipariş · Tamamlandı', '1'],
      ['Emanet bakiyesi', '123.456,00 ₺'],
    ]);
  });
});
