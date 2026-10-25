import type { ThermalResult } from "./thermal";

export type ImpactAssumptions = {
  /** Thermal energy moved per unit of electricity used. */
  cop: number;
  /** Dollars per electrical kWh, excluding fixed and demand charges. */
  electricityRate: number;
  /** Kilograms of CO₂e per electrical kWh. */
  carbonIntensity: number;
};

/** Illustrative inputs, not a measured equipment rating, tariff, or grid factor. */
export const defaultImpactAssumptions: ImpactAssumptions = {
  cop: 3,
  electricityRate: 0.25,
  carbonIntensity: 0.4,
};

export type ImpactEstimate = {
  electricityKwh: number;
  cost: number;
  emissionsKg: number;
};

export type EnergyImpact = {
  baseline: ImpactEstimate;
  adaptive: ImpactEstimate;
  /** Signed baseline minus adaptive; negative values mean increased use. */
  saved: ImpactEstimate;
  savedPct: number;
  assumptions: ImpactAssumptions;
};

function nonnegative(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.max(0, value)
    : fallback;
}

/**
 * Convert the room model's steady-state thermal load into illustrative electricity,
 * variable cost, and electricity-related emissions, using identical assumptions
 * for both policies. This does not model fan power, humidity removal, equipment
 * cycling, or the energy needed to restore comfort after a setback.
 */
export function compareEnergyImpact(
  result: Pick<ThermalResult, "baselineKwh" | "adaptiveKwh">,
  input: Partial<ImpactAssumptions> = {},
): EnergyImpact {
  const assumptions: ImpactAssumptions = {
    cop:
      input.cop !== undefined && Number.isFinite(input.cop) && input.cop > 0
        ? input.cop
        : defaultImpactAssumptions.cop,
    electricityRate: nonnegative(
      input.electricityRate,
      defaultImpactAssumptions.electricityRate,
    ),
    carbonIntensity: nonnegative(
      input.carbonIntensity,
      defaultImpactAssumptions.carbonIntensity,
    ),
  };

  function estimate(thermalKwh: number): ImpactEstimate {
    const electricityKwh = nonnegative(thermalKwh, 0) / assumptions.cop;
    return {
      electricityKwh,
      cost: electricityKwh * assumptions.electricityRate,
      emissionsKg: electricityKwh * assumptions.carbonIntensity,
    };
  }

  const baseline = estimate(result.baselineKwh);
  const adaptive = estimate(result.adaptiveKwh);
  const saved: ImpactEstimate = {
    electricityKwh: baseline.electricityKwh - adaptive.electricityKwh,
    cost: baseline.cost - adaptive.cost,
    emissionsKg: baseline.emissionsKg - adaptive.emissionsKg,
  };

  return {
    baseline,
    adaptive,
    saved,
    savedPct:
      baseline.electricityKwh === 0
        ? 0
        : (saved.electricityKwh / baseline.electricityKwh) * 100,
    assumptions,
  };
}
