// The single place where a line total is computed (MVP-PLAN): money is bigint minor units, never float.
// total = round_half_up(unitPriceMinor * quantityBase / basePerUnit), VAT excluded.
export function lineTotalMinor(
  unitPriceMinor: bigint,
  quantityBase: bigint,
  basePerUnit: bigint,
): bigint {
  if (unitPriceMinor < 0n || quantityBase < 0n) {
    throw new RangeError('unit price and quantity must not be negative');
  }
  if (basePerUnit <= 0n) throw new RangeError('basePerUnit must be positive');
  return (2n * unitPriceMinor * quantityBase + basePerUnit) / (2n * basePerUnit);
}
