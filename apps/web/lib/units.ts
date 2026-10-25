/**
 * The site shows temperatures in Fahrenheit. Everything underneath (the model, the energy
 * estimate, the database) stays in Celsius; convert only where a number is shown or typed.
 */

export const toF = (c: number) => (c * 9) / 5 + 32;
export const fromF = (f: number) => ((f - 32) * 5) / 9;

/** A temperature: 24 → "75.2°F". */
export function fmtF(c: number, digits = 1): string {
  return `${toF(c).toFixed(digits)}°F`;
}

/** A difference in temperature, unsigned: 1 (°C) → "1.8°F". */
export function fmtDeltaF(dc: number, digits = 1): string {
  return `${Math.abs(dc * 1.8).toFixed(digits)}°F`;
}

/** A signed difference: 0.5 (°C) → "+0.9°F", −1 → "−1.8°F", about zero → "±0.0°F". */
export function signedF(dc: number, digits = 1): string {
  const f = dc * 1.8;
  if (Math.abs(f) < 0.05) return `±${(0).toFixed(digits)}°F`;
  return `${f > 0 ? "+" : "−"}${Math.abs(f).toFixed(digits)}°F`;
}
