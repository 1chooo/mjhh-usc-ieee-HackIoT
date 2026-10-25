import assert from "node:assert/strict";
import test from "node:test";
import { OPENING_TIER1_RATE } from "../lib/billing.ts";
import { defaultImpactAssumptions } from "../lib/energy-impact.ts";
import {
  IMPACT_SPANS,
  SCALE_CAP_HOURS,
  SCALE_RATE,
  YEAR_HOURS,
  acceleratedHours,
  scaleDollars,
} from "../lib/scale-savings.ts";

test("multiplies rooms, saved power, rate, and time", () => {
  assert.equal(scaleDollars(10, 2, 0.25, 24), 120);
});

test("one room for one hour is that hour's saved power times the rate", () => {
  const savedKw = 1.2;
  assert.equal(SCALE_RATE, defaultImpactAssumptions.electricityRate);
  assert.equal(SCALE_RATE, OPENING_TIER1_RATE);
  assert.equal(scaleDollars(1, savedKw, SCALE_RATE, 1), savedKw * SCALE_RATE);
});

test("keeps a negative saving negative", () => {
  assert.equal(scaleDollars(4, -0.5, 0.25, 10), -5);
});

test("landing spans run from an hour to a year", () => {
  assert.deepEqual(
    IMPACT_SPANS.map((span) => span.hours),
    [1, 24, 24 * 7, 24 * 30, YEAR_HOURS],
  );
  assert.deepEqual(
    IMPACT_SPANS.map((span) => span.label),
    ["1 hour", "1 day", "1 week", "1 month", "1 year"],
  );
});

test("starts at one hour, reaches a day in a few seconds, and caps at ten years", () => {
  assert.equal(acceleratedHours(0), 1);
  assert.equal(acceleratedHours(-10), 1);
  assert.equal(acceleratedHours(Number.NaN), 1);
  assert.ok(Math.abs(acceleratedHours(4000) - 24) < 1e-6);
  assert.equal(acceleratedHours(60_000), SCALE_CAP_HOURS);
  assert.equal(SCALE_CAP_HOURS, 10 * YEAR_HOURS);
});
