import { describe, expect, it } from 'vitest';
import { csvCell, formatCsvTry, toCsv } from './admin-finance.service.js';

describe('finance csv helpers', () => {
  it('formats minor units with a decimal comma and no thousands separator', () => {
    expect(formatCsvTry(1234567n)).toBe('12345,67');
    expect(formatCsvTry(5n)).toBe('0,05');
    expect(formatCsvTry(0n)).toBe('0,00');
    expect(formatCsvTry(-250n)).toBe('-2,50');
  });

  it('neutralises formula prefixes and quotes separators', () => {
    for (const p of ['=', '+', '-', '@']) expect(csvCell(`${p}x`)).toBe(`'${p}x`);
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('Çelik A.Ş.')).toBe('Çelik A.Ş.');
  });

  it('starts with a BOM and uses semicolons and CRLF', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('﻿a;b\r\n1;2\r\n');
  });
});
