"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  getSpace,
  simulatorPresets,
  spaces,
  scenarioFrom,
} from "../lib/campus";
import { evaluate, type Scenario, type SpaceKind } from "../lib/thermal";
import { useCampus } from "../lib/use-campus";
import { ResultBlock } from "./result-block";
import { RoomScene } from "./room-scene";

export function SimulatorView() {
  const params = useSearchParams();
  const campus = useCampus();
  const [scenario, setScenario] = useState<Scenario>(
    simulatorPresets[0]!.scenario,
  );
  const [layoutToken, setLayoutToken] = useState(0);
  const applied = useRef(false);

  useEffect(() => {
    if (!campus.ready || applied.current) {
      return;
    }
    applied.current = true;
    const spaceId = params.get("space");
    if (!spaceId) {
      return;
    }
    const space = getSpace(spaceId);
    const reading = campus.readings[spaceId];
    if (space && reading) {
      setScenario(scenarioFrom(space, reading));
    }
  }, [campus.ready, campus.readings, params]);

  const result = evaluate(scenario);

  function patch(partial: Partial<Scenario>) {
    setScenario((current) => settle({ ...current, ...partial }));
  }

  function loadScenario(next: Scenario) {
    setScenario(settle(next));
    setLayoutToken((token) => token + 1);
  }

  return (
    <div className="stack">
      <RoomScene
        scenario={scenario}
        result={result}
        layoutToken={layoutToken}
        onChange={patch}
      />
      <div className="split">
        <section className="stack">
          <div className="preset-row">
            {simulatorPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="ghost"
                onClick={() => loadScenario(preset.scenario)}
              >
                {preset.label}
              </button>
            ))}
            {spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                className="ghost"
                onClick={() => {
                  const reading = campus.readings[space.id];
                  if (reading) {
                    loadScenario(scenarioFrom(space, reading));
                  }
                }}
              >
                Live {space.name}
              </button>
            ))}
          </div>
          <fieldset>
            <legend>Room</legend>
            <div className="choice-row">
              {(["library", "classroom"] as SpaceKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="ghost"
                  aria-pressed={scenario.kind === kind}
                  onClick={() => patch({ kind })}
                >
                  {kind}
                </button>
              ))}
            </div>
            <Slider
              label="Floor area"
              min={80}
              max={800}
              step={10}
              unit="m²"
              value={scenario.floorAreaM2}
              onChange={(floorAreaM2) => patch({ floorAreaM2 })}
            />
            <Slider
              label="Capacity"
              min={10}
              max={200}
              step={1}
              unit="people"
              value={scenario.capacity}
              onChange={(capacity) => patch({ capacity })}
            />
          </fieldset>
          <fieldset>
            <legend>Readings</legend>
            <Slider
              label="Outdoor temperature"
              min={0}
              max={40}
              step={0.5}
              unit="°C"
              value={scenario.outdoorC}
              onChange={(outdoorC) => patch({ outdoorC })}
            />
            <Slider
              label="Indoor temperature"
              min={16}
              max={32}
              step={0.1}
              unit="°C"
              value={scenario.indoorC}
              onChange={(indoorC) => patch({ indoorC })}
            />
            <Slider
              label="Relative humidity"
              min={20}
              max={90}
              step={1}
              unit="%"
              value={scenario.humidityPct}
              onChange={(humidityPct) => patch({ humidityPct })}
            />
          </fieldset>
          <fieldset>
            <legend>People</legend>
            <div className="choice-row">
              <button
                type="button"
                className="ghost"
                aria-pressed={scenario.scheduledOpen}
                onClick={() =>
                  patch({ scheduledOpen: !scenario.scheduledOpen })
                }
              >
                {scenario.scheduledOpen ? "Room is open" : "Room is closed"}
              </button>
            </div>
            <Slider
              label="Occupancy"
              min={0}
              max={scenario.capacity}
              step={1}
              unit="people"
              value={scenario.occupancy}
              onChange={(occupancy) => patch({ occupancy })}
            />
            <Slider
              label="Hot votes"
              min={0}
              max={scenario.occupancy}
              step={1}
              unit="votes"
              value={scenario.hotVotes}
              onChange={(hotVotes) => patch({ hotVotes })}
            />
            <Slider
              label="Cold votes"
              min={0}
              max={scenario.occupancy}
              step={1}
              unit="votes"
              value={scenario.coldVotes}
              onChange={(coldVotes) => patch({ coldVotes })}
            />
            <Slider
              label="Full-vote influence"
              min={0}
              max={2.5}
              step={0.1}
              unit="°C"
              value={scenario.voteInfluenceC}
              onChange={(voteInfluenceC) => patch({ voteInfluenceC })}
            />
            <Slider
              label="Heat from one person"
              min={60}
              max={150}
              step={5}
              unit="W"
              value={scenario.wattsPerPerson}
              onChange={(wattsPerPerson) => patch({ wattsPerPerson })}
            />
          </fieldset>
          <fieldset>
            <legend>Plant and the hour</legend>
            <Slider
              label="Deadband"
              min={0.2}
              max={1.5}
              step={0.1}
              unit="°C"
              value={scenario.deadbandC}
              onChange={(deadbandC) => patch({ deadbandC })}
            />
            <Slider
              label="Envelope loss"
              min={0.6}
              max={4}
              step={0.1}
              unit="W/m²·K"
              value={scenario.lossWPerM2K}
              onChange={(lossWPerM2K) => patch({ lossWPerM2K })}
            />
            <Slider
              label="Hours compared"
              min={1}
              max={8}
              step={1}
              unit="h"
              value={scenario.hours}
              onChange={(hours) => patch({ hours })}
            />
          </fieldset>
        </section>
        <aside className="stack result-card">
          <ResultBlock result={result} />
          <ul className="factors">
            {result.factors.map((factor) => (
              <li key={factor.name}>
                <strong>{factor.name}</strong>
                <span>{factor.detail}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function settle(input: Scenario): Scenario {
  const capacity = Math.max(0, input.capacity);
  const occupancy = Math.min(capacity, Math.max(0, input.occupancy));
  let hotVotes = Math.max(0, input.hotVotes);
  let coldVotes = Math.max(0, input.coldVotes);
  const votes = hotVotes + coldVotes;
  if (votes > occupancy) {
    hotVotes = votes === 0 ? 0 : Math.round((hotVotes / votes) * occupancy);
    coldVotes = Math.max(0, occupancy - hotVotes);
  }
  return { ...input, capacity, occupancy, hotVotes, coldVotes };
}

function Slider({
  label,
  min,
  max,
  step,
  unit,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const shown = step >= 1 ? String(Math.round(value)) : value.toFixed(1);
  return (
    <label className="slider">
      <span>
        {label}
        <strong>
          {shown} {unit}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={`${shown} ${unit}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function SimulatorFallback(): ReactNode {
  return <p className="note">Loading the lab…</p>;
}
