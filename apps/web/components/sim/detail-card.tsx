"use client";

import type { Scenario } from "../../lib/thermal";
import { voteAt } from "./layout";
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
  onClose,
}: {
  pick: SimPick;
  scenario: Scenario;
  onClose: () => void;
}) {
  return (
    <aside className="sim-detail card">
      {pick.type === "person" ? (
        <PersonDetail index={pick.index} scenario={scenario} />
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
  index,
  scenario,
}: {
  index: number;
  scenario: Scenario;
}) {
  const vote = voteAt(index, scenario.hotVotes, scenario.coldVotes);
  const label =
    vote === "hot" ? "Too hot" : vote === "cold" ? "Too cold" : "No vote";
  return (
    <>
      <p className={vote === "hot" ? "badge heat" : vote === "cold" ? "badge cool" : "badge"}>
        {label}
      </p>
      <p className="sim-reading">{Math.round(scenario.wattsPerPerson)} W</p>
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
