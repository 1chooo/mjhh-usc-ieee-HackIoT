"use client";

import { defaultReadings } from "../lib/campus";
import { deltaTone, summarizeCampus } from "../lib/campus-summary";
import { energyDeltaLabel } from "../lib/thermal";
import { BuildingBoard } from "./console/building-board";
import { EnergyCharts } from "./console/energy-charts";
import { LoadGauges } from "./console/load-gauges";
import { StatGrid } from "./console/stat-grid";

export function ImpactView() {
  const summary = summarizeCampus(defaultReadings);
  const tone = deltaTone(summary.savedKwh);

  return (
    <div className="stack">
      <h1>Impact</h1>
      <StatGrid
        items={[
          {
            label: "This hour",
            value: energyDeltaLabel(summary.savedKwh),
            tone: tone === "even" ? undefined : tone,
          },
          { label: "Rooms", value: String(summary.roomCount) },
          { label: "People", value: String(Math.round(summary.openPeople)) },
          {
            label: "Calls",
            value: `${summary.cool} cool · ${summary.heat} heat · ${summary.hold} hold`,
          },
        ]}
      />
      <LoadGauges summary={summary} />
      <EnergyCharts rooms={summary.rooms} />
      <BuildingBoard rooms={summary.rooms} />
    </div>
  );
}
