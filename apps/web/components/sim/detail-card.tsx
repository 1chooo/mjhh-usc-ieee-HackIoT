"use client";

import type { Scenario } from "../../lib/thermal";
import type { PersonVote } from "./layout";
import type { SensorKind, SimPick } from "./sim-types";

const sensorName: Record<SensorKind, string> = {
  temperature: "Temperature",
  humidity: "Humidity",
  occupancy: "Occupancy",
  outdoor: "Outdoor",
};

export function DetailCard({
  pick,
  scenario,
  vote,
  onVote,
  onClose,
}: {
  pick: SimPick;
  scenario: Scenario;
  vote: PersonVote | null;
  onVote: (vote: "hot" | "cold") => void;
  onClose: () => void;
}) {
  return (
    <aside className="sim-detail card">
      {pick.type === "person" ? (
        <PersonDetail
          vote={vote ?? "none"}
          watts={scenario.wattsPerPerson}
          onVote={onVote}
        />
      ) : (
        <SensorDetail sensor={pick.sensor} scenario={scenario} />
      )}
      <button type="button" className="ghost" onClick={onClose}>
        Close
      </button>
    </aside>
  );
}

function PersonDetail({
  vote,
  watts,
  onVote,
}: {
  vote: PersonVote;
  watts: number;
  onVote: (vote: "hot" | "cold") => void;
}) {
  const label =
    vote === "hot" ? "Too hot" : vote === "cold" ? "Too cold" : "No vote";
  return (
    <>
      <p className={vote === "hot" ? "badge heat" : vote === "cold" ? "badge cool" : "badge"}>
        {label}
      </p>
      <div className="vote-row">
        <button
          type="button"
          className="vote hot"
          aria-pressed={vote === "hot"}
          onClick={() => onVote("hot")}
        >
          Too hot
        </button>
        <button
          type="button"
          className="vote cold"
          aria-pressed={vote === "cold"}
          onClick={() => onVote("cold")}
        >
          Too cold
        </button>
      </div>
      <p className="sim-reading">{Math.round(watts)} W</p>
    </>
  );
}

function SensorDetail({
  sensor,
  scenario,
}: {
  sensor: SensorKind;
  scenario: Scenario;
}) {
  const value =
    sensor === "temperature"
      ? `${scenario.indoorC.toFixed(1)} °C`
      : sensor === "humidity"
        ? `${Math.round(scenario.humidityPct)}%`
        : sensor === "occupancy"
          ? String(Math.round(scenario.occupancy))
          : `${scenario.outdoorC.toFixed(1)} °C`;
  return (
    <>
      <p className="eyebrow">{sensorName[sensor]}</p>
      <p className="sim-reading">{value}</p>
    </>
  );
}
