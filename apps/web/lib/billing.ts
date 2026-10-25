/**
 * Electricity bills for the simulator: LADWP residential rate R-1A, billed every two months.
 *
 * Source: LADWP residential rates page, "Total consumption charges for 2026 (including
 * Adjustment Factors)", $/kWh by month. Tier sizes are Zone 1 (USC), doubled for a two-month
 * bill: Tier 1 the first 700 kWh, Tier 2 the next 1,400 kWh, Tier 3 everything above 2,100 kWh.
 * Each bill starts back at Tier 1, so splitting the year into two-month bills changes the cost.
 * Months after 2026 reuse the 2026 prices. Not included: the monthly Power Access Charge (the
 * same for both sides once usage is high) and the 10% city utility tax.
 */

export const TIER_LIMITS_KWH = [700, 2100] as const;

/** [Tier 1, Tier 2, Tier 3] in $/kWh, by calendar month (1-12). */
export function tierRates(month: number): readonly [number, number, number] {
  if (month <= 3) return [0.24771, 0.3063, 0.3063];
  if (month <= 5) return [0.24362, 0.30221, 0.30221];
  if (month === 6) return [0.24362, 0.30221, 0.38922];
  if (month <= 9) return [0.26408, 0.32267, 0.40968];
  return [0.27292, 0.33151, 0.33151];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Two-month bills: Nov-Dec, Jan-Feb, Mar-Apr, ... (the simulation starts in November). */
export function billOf(at: string): { key: string; label: string } {
  const year = Number(at.slice(0, 4));
  const month = Number(at.slice(5, 7));
  const start = month % 2 === 1 ? month : month - 1;
  return {
    key: `${year}-${String(start).padStart(2, "0")}`,
    label: `${MONTHS[start - 1]}–${MONTHS[start]} ${year}`,
  };
}

/** Cost of `kwh` more, when this bill already has `usedKwh`: each kWh at the tier it lands in. */
export function charge(usedKwh: number, kwh: number, month: number): number {
  const rates = tierRates(month);
  let cost = 0;
  let from = usedKwh;
  let left = kwh;
  for (let tier = 0; tier < 3 && left > 0; tier++) {
    const limit = tier < 2 ? TIER_LIMITS_KWH[tier as 0 | 1] : Infinity;
    const take = Math.min(left, Math.max(0, limit - from));
    cost += take * rates[tier as 0 | 1 | 2];
    from += take;
    left -= take;
  }
  return cost;
}

export type Bill = {
  key: string;
  label: string;
  hours: number;
  fixedKwh: number;
  modelKwh: number;
  fixedCost: number;
  modelCost: number;
};

/** Every simulated hour so far (the charts keep only the last week), split into two-month bills. */
export type EnergyTotals = { hours: number; fixedKwh: number; modelKwh: number; bills: Bill[] };
export const NO_TOTALS: EnergyTotals = { hours: 0, fixedKwh: 0, modelKwh: 0, bills: [] };

export function addHour(totals: EnergyTotals, at: string, fixedKwh: number, modelKwh: number): EnergyTotals {
  const { key, label } = billOf(at);
  const month = Number(at.slice(5, 7));
  const last = totals.bills[totals.bills.length - 1];
  const bill: Bill = last?.key === key ? last : { key, label, hours: 0, fixedKwh: 0, modelKwh: 0, fixedCost: 0, modelCost: 0 };
  const next: Bill = {
    ...bill,
    hours: bill.hours + 1,
    fixedKwh: bill.fixedKwh + fixedKwh,
    modelKwh: bill.modelKwh + modelKwh,
    fixedCost: bill.fixedCost + charge(bill.fixedKwh, fixedKwh, month),
    modelCost: bill.modelCost + charge(bill.modelKwh, modelKwh, month),
  };
  return {
    hours: totals.hours + 1,
    fixedKwh: totals.fixedKwh + fixedKwh,
    modelKwh: totals.modelKwh + modelKwh,
    bills: last?.key === key ? [...totals.bills.slice(0, -1), next] : [...totals.bills, next],
  };
}
