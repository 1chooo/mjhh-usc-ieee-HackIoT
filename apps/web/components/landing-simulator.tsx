"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { simulatorPresets } from "../lib/campus";
import {
  compareEnergyImpact,
  defaultImpactAssumptions,
  type ImpactAssumptions,
} from "../lib/energy-impact";
import { evaluate, type Scenario } from "../lib/thermal";
import styles from "./landing-simulator.module.css";
import { ScaleStory } from "./scale-story";

const presets = [
  simulatorPresets.find((preset) => preset.id === "overcooled-lecture")!,
  simulatorPresets.find((preset) => preset.id === "empty-classroom")!,
  simulatorPresets.find((preset) => preset.id === "warm-reading-room")!,
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function LandingSimulator() {
  const [presetId, setPresetId] = useState<string | null>(presets[0]!.id);
  const [scenario, setScenario] = useState<Scenario>(presets[0]!.scenario);
  const [assumptions, setAssumptions] = useState<ImpactAssumptions>(
    defaultImpactAssumptions,
  );
  const result = evaluate(scenario);
  const impact = compareEnergyImpact(result, assumptions);
  const peak = Math.max(
    impact.baseline.electricityKwh,
    impact.adaptive.electricityKwh,
    0.001,
  );
  const increased = impact.saved.electricityKwh < -0.0005;
  const equal = Math.abs(impact.saved.electricityKwh) < 0.0005;
  const deltaClass = increased ? styles.increase : equal ? "" : styles.saving;

  function patch(next: Partial<Scenario>) {
    setPresetId(null);
    setScenario((current) => {
      const updated = { ...current, ...next };
      updated.occupancy = Math.min(updated.capacity, updated.occupancy);
      updated.hotVotes = Math.min(updated.occupancy, updated.hotVotes);
      updated.coldVotes = Math.min(
        updated.occupancy - updated.hotVotes,
        updated.coldVotes,
      );
      return updated;
    });
  }

  function updateAssumption(key: keyof ImpactAssumptions, value: number) {
    setAssumptions((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <section
        className={`section ${styles.simulator}`}
        id="demo"
        aria-labelledby="demo-title"
      >
        <div className={styles.heading}>
          <h2 id="demo-title">Same room. A smarter response.</h2>
          <Link className="text-link" href="/simulator">
            Open the full simulator <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className={styles.presets} role="group" aria-label="Room scenario">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={presetId === preset.id}
              onClick={() => {
                setPresetId(preset.id);
                setScenario({ ...preset.scenario });
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className={styles.workspace}>
          <div className={styles.roomPanel}>
            <div className={styles.roomReadings}>
              <span>{scenario.indoorC.toFixed(1)}°C indoors</span>
              <span>{scenario.humidityPct}% humidity</span>
            </div>
            <RoomDiagram
              occupancy={scenario.occupancy}
              capacity={scenario.capacity}
            />
            <div className={styles.roomStatus}>
              <strong>{scenario.occupancy} people</strong>
              <label className={styles.schedule}>
                <input
                  type="checkbox"
                  checked={scenario.scheduledOpen}
                  onChange={(event) =>
                    patch({ scheduledOpen: event.target.checked })
                  }
                />
                Room open
              </label>
            </div>
            <div className={styles.controls}>
              <RangeControl
                label="People"
                value={scenario.occupancy}
                min={0}
                max={scenario.capacity}
                onChange={(occupancy) => patch({ occupancy })}
              />
              <RangeControl
                label="Outdoors"
                value={scenario.outdoorC}
                min={0}
                max={40}
                step={0.5}
                unit="°C"
                onChange={(outdoorC) => patch({ outdoorC })}
              />
              <RangeControl
                label="Too hot"
                value={scenario.hotVotes}
                min={0}
                max={scenario.occupancy}
                disabled={!result.peoplePresent}
                onChange={(hotVotes) => patch({ hotVotes })}
              />
              <RangeControl
                label="Too cold"
                value={scenario.coldVotes}
                min={0}
                max={scenario.occupancy}
                disabled={!result.peoplePresent}
                onChange={(coldVotes) => {
                  setPresetId(null);
                  setScenario((current) => ({
                    ...current,
                    coldVotes,
                    hotVotes: Math.min(
                      current.hotVotes,
                      current.occupancy - coldVotes,
                    ),
                  }));
                }}
              />
            </div>
          </div>

          <div className={styles.comparison}>
            <div className={styles.policies}>
              <div className={styles.policy}>
                <h3>Traditional</h3>
                <strong className={styles.temperature}>
                  {result.baselineSetpointC.toFixed(1)}
                  <span>°C</span>
                </strong>
                <p>Fixed temperature</p>
              </div>
              <div className={`${styles.policy} ${styles.adaptive}`}>
                <h3>Our model</h3>
                <strong className={styles.temperature}>
                  {result.targetC.toFixed(1)}
                  <span>°C</span>
                </strong>
                <p>
                  {!scenario.scheduledOpen
                    ? "Closed-room setback"
                    : !result.peoplePresent
                      ? "Empty-room setback"
                      : result.voteShiftC === 0
                        ? "Comfort target"
                        : "Comfort votes applied"}
                </p>
              </div>
            </div>

            <div className={styles.energy}>
              <div className={styles.energyHeading}>
                <h3>Estimated electricity · 1 hour</h3>
                <span className={deltaClass}>
                  {equal
                    ? "Same use"
                    : impact.baseline.electricityKwh === 0
                      ? "Higher use"
                      : `${Math.abs(impact.savedPct).toFixed(1)}% ${increased ? "more" : "less"}`}
                </span>
              </div>
              <EnergyBar
                label="Traditional"
                value={impact.baseline.electricityKwh}
                peak={peak}
              />
              <EnergyBar
                label="Our model"
                value={impact.adaptive.electricityKwh}
                peak={peak}
                adaptive
              />
            </div>

            <dl
              className={`${styles.outcomes} ${deltaClass}`}
              aria-live="polite"
              aria-atomic="true"
            >
              <div>
                <dt>{increased ? "Extra electricity" : "Electricity saved"}</dt>
                <dd>
                  {Math.abs(impact.saved.electricityKwh).toFixed(3)}{" "}
                  <span>kWh</span>
                </dd>
              </div>
              <div>
                <dt>
                  {impact.saved.cost < -0.0005 ? "Extra cost" : "Cost saved"}
                </dt>
                <dd>{currency.format(Math.abs(impact.saved.cost))}</dd>
              </div>
              <div>
                <dt>
                  {impact.saved.emissionsKg < -0.0005
                    ? "CO₂e increase"
                    : "CO₂e reduction"}
                </dt>
                <dd>
                  {Math.abs(impact.saved.emissionsKg).toFixed(3)}{" "}
                  <span>kg</span>
                </dd>
              </div>
            </dl>
            <p className={styles.response}>
              {!scenario.scheduledOpen
                ? "The room is closed, so the model relaxes the target and ignores comfort votes."
                : !result.peoplePresent
                  ? "With nobody to condition the room for, the model relaxes the target."
                  : increased
                    ? "Comfort needs more energy in this scenario. The comparison includes that tradeoff."
                    : scenario.coldVotes > scenario.hotVotes &&
                        result.season === "cooling"
                      ? "People feel cold. Raising the cooling target reduces modeled energy use."
                      : scenario.hotVotes > scenario.coldVotes
                        ? "People feel hot. Their votes move the target within the room’s comfort band."
                        : "The model holds the comfort target until occupancy or feedback calls for a change."}
            </p>
          </div>
        </div>

        <details className={styles.assumptions}>
          <summary>Assumptions &amp; calculation</summary>
          <div className={styles.assumptionInputs}>
            <NumberControl
              label="Electricity · $/kWh"
              value={assumptions.electricityRate}
              min={0}
              max={5}
              step={0.01}
              onChange={(value) => updateAssumption("electricityRate", value)}
            />
            <NumberControl
              label="Equipment efficiency · COP"
              value={assumptions.cop}
              min={0.1}
              max={15}
              step={0.1}
              onChange={(value) => updateAssumption("cop", value)}
            />
            <NumberControl
              label="Grid · kg CO₂e/kWh"
              value={assumptions.carbonIntensity}
              min={0}
              max={5}
              step={0.01}
              onChange={(value) => updateAssumption("carbonIntensity", value)}
            />
          </div>
          <p>
            An illustrative fixed thermostat is compared with our model under
            the same room conditions for one hour. Electricity = thermal load ÷
            COP. Cost = electricity × rate. CO₂e = electricity × grid factor.
            Defaults are illustrative, not measured tariffs or savings.
          </p>
          <p>
            This steady-state estimate excludes fan power, humidity removal,
            equipment cycling, and recovery after a setback. A live hold command
            does not imply zero modeled load. Actual savings need measured
            building data.
          </p>
        </details>
      </section>
      <ScaleStory impact={impact} />
    </>
  );
}

function EnergyBar({
  label,
  value,
  peak,
  adaptive = false,
}: {
  label: string;
  value: number;
  peak: number;
  adaptive?: boolean;
}) {
  return (
    <div className={styles.barRow}>
      <div>
        <span>{label}</span>
        <strong>{value.toFixed(3)} kWh</strong>
      </div>
      <div className={styles.track} aria-hidden="true">
        <div
          className={adaptive ? styles.adaptiveBar : styles.baselineBar}
          style={{ width: `${(value / peak) * 100}%` }}
        />
      </div>
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className={styles.range}>
      <label htmlFor={id}>
        <span>{label}</span>
        <output htmlFor={id}>
          {value}
          {unit}
        </output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={`${value}${unit}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function NumberControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          if (Number.isFinite(next) && next >= min && next <= max)
            onChange(next);
        }}
      />
    </label>
  );
}

function RoomDiagram({
  occupancy,
  capacity,
}: {
  occupancy: number;
  capacity: number;
}) {
  const occupiedSeats = Math.ceil((occupancy / Math.max(1, capacity)) * 16);
  return (
    <svg className={styles.diagram} viewBox="0 0 400 225" aria-hidden="true">
      <path className={styles.roomWall} d="M43 33H357V190H310M274 190H43Z" />
      <path className={styles.door} d="M274 190V154A36 36 0 0 1 310 190" />
      <path className={styles.window} d="M42 71V139M358 71V139" />
      <rect
        className={styles.board}
        x="148"
        y="29"
        width="104"
        height="8"
        rx="2"
      />
      {Array.from({ length: 16 }, (_, index) => {
        const x = 91 + (index % 4) * 71;
        const y = 69 + Math.floor(index / 4) * 29;
        return (
          <g key={index}>
            <rect
              className={styles.desk}
              x={x - 15}
              y={y - 7}
              width="31"
              height="14"
              rx="3"
            />
            <circle
              className={
                index < occupiedSeats ? styles.person : styles.emptySeat
              }
              cx={x}
              cy={y + 11}
              r="5"
            />
          </g>
        );
      })}
    </svg>
  );
}
