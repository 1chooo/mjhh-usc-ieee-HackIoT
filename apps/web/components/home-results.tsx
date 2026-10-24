import Link from "next/link";
import { defaultReadings } from "../lib/campus";
import { deltaTone, summarizeCampus } from "../lib/campus-summary";
import { energyDeltaLabel } from "../lib/thermal";
import { StatGrid } from "./console/stat-grid";

export function HomeResults() {
  const summary = summarizeCampus(defaultReadings);
  const tone = deltaTone(summary.savedKwh);

  return (
    <section className="section stack">
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
      <div className="cta-row">
        <Link className="button" href="/impact">
          Impact
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </Link>
        <Link className="button secondary" href="/rooms">
          Rooms
        </Link>
      </div>
    </section>
  );
}
