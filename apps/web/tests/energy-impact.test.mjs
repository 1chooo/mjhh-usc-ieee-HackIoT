import assert from "node:assert/strict";
import test from "node:test";
import {
  compareEnergyImpact,
  defaultImpactAssumptions,
} from "../lib/energy-impact.ts";

test("converts thermal load to electricity before calculating cost and emissions", () => {
  const impact = compareEnergyImpact({ baselineKwh: 12, adaptiveKwh: 6 });

  assert.deepEqual(impact.baseline, {
    electricityKwh: 4,
    cost: 1,
    emissionsKg: 1.6,
  });
  assert.deepEqual(impact.adaptive, {
    electricityKwh: 2,
    cost: 0.5,
    emissionsKg: 0.8,
  });
  assert.deepEqual(impact.saved, {
    electricityKwh: 2,
    cost: 0.5,
    emissionsKg: 0.8,
  });
  assert.equal(impact.savedPct, 50);
});

test("preserves increased energy, cost, and emissions instead of hiding them", () => {
  const impact = compareEnergyImpact({ baselineKwh: 6, adaptiveKwh: 12 });

  assert.equal(impact.saved.electricityKwh, -2);
  assert.equal(impact.saved.cost, -0.5);
  assert.equal(impact.saved.emissionsKg, -0.8);
  assert.equal(impact.savedPct, -100);
});

test("returns finite zero percentages when the baseline has no load", () => {
  const equal = compareEnergyImpact({ baselineKwh: 0, adaptiveKwh: 0 });
  const increased = compareEnergyImpact({ baselineKwh: 0, adaptiveKwh: 3 });

  assert.deepEqual(equal.saved, {
    electricityKwh: 0,
    cost: 0,
    emissionsKg: 0,
  });
  assert.equal(equal.savedPct, 0);
  assert.equal(increased.savedPct, 0);
  assert.equal(increased.saved.electricityKwh, -1);
});

test("uses shared editable assumptions for both policies", () => {
  const impact = compareEnergyImpact(
    { baselineKwh: 12, adaptiveKwh: 6 },
    { cop: 2, electricityRate: 0.5, carbonIntensity: 0.2 },
  );

  assert.equal(impact.baseline.electricityKwh, 6);
  assert.equal(impact.adaptive.electricityKwh, 3);
  assert.equal(impact.saved.cost, 1.5);
  assert.ok(Math.abs(impact.saved.emissionsKg - 0.6) < 1e-12);
  assert.equal(impact.savedPct, 50);
  assert.deepEqual(defaultImpactAssumptions, {
    cop: 3,
    electricityRate: 0.25,
    carbonIntensity: 0.4,
  });
});

test("allows zero tariffs and carbon factors without discarding energy savings", () => {
  const impact = compareEnergyImpact(
    { baselineKwh: 12, adaptiveKwh: 6 },
    { electricityRate: 0, carbonIntensity: 0 },
  );

  assert.equal(impact.saved.electricityKwh, 2);
  assert.equal(impact.saved.cost, 0);
  assert.equal(impact.saved.emissionsKg, 0);
});

test("normalizes invalid physical inputs and prevents invalid COP division", () => {
  for (const cop of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const impact = compareEnergyImpact(
      { baselineKwh: Number.NaN, adaptiveKwh: -10 },
      { cop, electricityRate: -1, carbonIntensity: Number.NaN },
    );

    assert.equal(impact.assumptions.cop, 3);
    assert.equal(impact.assumptions.electricityRate, 0);
    assert.equal(impact.assumptions.carbonIntensity, 0.4);
    assert.deepEqual(impact.baseline, {
      electricityKwh: 0,
      cost: 0,
      emissionsKg: 0,
    });
    assert.equal(impact.savedPct, 0);
  }
});
