/** LADWP R-1A Tier 1 for November. The same default the landing comparison uses. */
export const SCALE_RATE = 0.27292;

/** Average year, so a displayed year includes leap days. */
export const YEAR_HOURS = 24 * 365.25;

/** The bird's-eye clock stops here. */
export const SCALE_CAP_HOURS = 10 * YEAR_HOURS;

/** Landing comparison. `hours` is written to `scenario.hours`; `label` is the slider output. */
export const IMPACT_SPANS = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "1 day" },
  { hours: 24 * 7, label: "1 week" },
  { hours: 24 * 30, label: "1 month" },
  { hours: YEAR_HOURS, label: "1 year" },
] as const;

/** Real milliseconds from one hour to about one day. */
const DAY_MS = 4000;
const GROWTH_PER_MS = Math.log(24) / DAY_MS;

const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** rooms × saved kW × $/kWh × hours. */
export function scaleDollars(
  rooms: number,
  savedKw: number,
  rate: number,
  hours: number,
): number {
  return rooms * savedKw * rate * hours;
}

/**
 * Demo clock. One hour at the start, about a day after a few seconds, then a month,
 * a year, and a cap at ten years.
 */
export function acceleratedHours(elapsedMs: number): number {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return Math.min(SCALE_CAP_HOURS, Math.exp(GROWTH_PER_MS * elapsed));
}

/** `1.0 h`, then `6 d`, `3.4 mo`, `2.1 yr`. */
export function formatScaleTime(hours: number): string {
  const span = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  if (span < 48) return `${span.toFixed(1)} h`;
  const days = span / 24;
  if (days < 60) return `${Math.round(days)} d`;
  const months = span / (YEAR_HOURS / 12);
  if (months < 12) return `${months.toFixed(1)} mo`;
  return `${(span / YEAR_HOURS).toFixed(1)} yr`;
}

/** Two decimals until the total reaches millions, then `$1.2M`. */
export function formatScaleDollars(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${money.format(abs)}`;
}

export function formatScaleKw(kw: number): string {
  const value = Number.isFinite(kw) ? kw : 0;
  const sign = value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)} kW`;
}
