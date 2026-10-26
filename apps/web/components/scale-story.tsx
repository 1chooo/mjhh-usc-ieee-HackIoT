"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Cite } from "./cite";
import { RoomModel } from "../lib/ac-model";
import { source } from "../lib/references";
import { dailySavings } from "../lib/sim-run";
import { firstClassAt, scenarioFor, simRooms } from "../lib/sim-rooms";
import styles from "./scale-story.module.css";

const scales = [
  { id: "room", label: "One room", rooms: 1 },
  { id: "home", label: "A home", rooms: 4 },
  { id: "neighborhood", label: "A neighborhood", rooms: 100 },
  { id: "campus", label: "A campus", rooms: 1000 },
];

const amount = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const count = new Intl.NumberFormat("en-US");

/** The room the per-day saving comes from: the simulator's first room, as it opens. */
const sampleRoom = simRooms[0]!;

/**
 * Same formula as the simulator's scale-up: what one room saves per day × rooms × time.
 * The per-day saving is the simulator's own (lib/sim-run.ts dailySavings).
 */
export function ScaleStory({
  spanHours,
  spanLabel,
}: {
  spanHours: number;
  spanLabel: string;
}) {
  const [rooms, setRooms] = useState(100);
  const [selectedScale, setSelectedScale] = useState<string | null>(
    "neighborhood",
  );
  const headingId = useId();
  const rangeId = useId();
  // eight weeks of hours (about a second), worked out once
  const perDay = useMemo(
    () =>
      dailySavings(
        sampleRoom,
        new RoomModel(),
        firstClassAt(sampleRoom),
        scenarioFor(sampleRoom, null, 24),
      ),
    [],
  );
  const days = spanHours / 24;
  const electricity = perDay.kwh * rooms * days;
  const cost = perDay.usd * rooms * days;
  const emissions = perDay.kgCo2 * rooms * days;
  const increasing = electricity < -0.0005;
  const roomLabel = rooms === 1 ? "similar room" : "similar rooms";

  return (
    <section
      className={`band ${styles.story}`}
      id="scale"
      aria-labelledby={headingId}
    >
      <div className={styles.intro}>
        <h2 id={headingId}>
          One room is a start.
          <br />
          Imagine a thousand.
        </h2>
        <p>
          Start with one room, then a home, a neighborhood, a campus. When a
          useful energy-saving decision repeats across more spaces, small
          reductions can add up to lower bills and a smaller shared carbon
          footprint.
        </p>
      </div>

      <div
        className={styles.scales}
        role="group"
        aria-label="Explore the scale"
      >
        {scales.map((scale) => (
          <button
            type="button"
            key={scale.id}
            aria-pressed={selectedScale === scale.id}
            onClick={() => {
              setRooms(scale.rooms);
              setSelectedScale(scale.id);
            }}
          >
            <span>{scale.label}</span>
            <strong>{count.format(scale.rooms)}</strong>
            <span>{scale.rooms === 1 ? "similar room" : "similar rooms"}</span>
          </button>
        ))}
      </div>

      <div className={styles.projection}>
        <div className={styles.roomCount}>
          <label htmlFor={rangeId}>
            <span>Similar rooms</span>
            <output htmlFor={rangeId}>{count.format(rooms)}</output>
          </label>
          <input
            type="range"
            id={rangeId}
            min={1}
            max={1000}
            step={1}
            value={rooms}
            aria-valuetext={`${count.format(rooms)} ${roomLabel}`}
            onChange={(event) => {
              setRooms(Number(event.target.value));
              setSelectedScale(null);
            }}
          />
        </div>

        <div className={styles.results} aria-live="polite" aria-atomic="true">
          <h3>
            {count.format(rooms)} {roomLabel} · {spanLabel}
          </h3>
          <p>
            {money.format(perDay.usd)} per room per day × {count.format(rooms)}{" "}
            {rooms === 1 ? "room" : "rooms"} ×{" "}
            {days >= 1
              ? `${count.format(Math.round(days))} ${Math.round(days) === 1 ? "day" : "days"}`
              : spanLabel}
          </p>
          <dl className={increasing ? styles.increase : styles.savings}>
            <div>
              <dt>{increasing ? "Extra electricity" : "Electricity saved"}</dt>
              <dd>
                {amount.format(Math.abs(electricity))} <span>kWh</span>
              </dd>
            </div>
            <div>
              <dt>{cost < 0 ? "Extra cost" : "Cost saved"}</dt>
              <dd>{money.format(Math.abs(cost))}</dd>
            </div>
            <div>
              <dt>{emissions < 0 ? "CO₂e increase" : "CO₂e reduction"}</dt>
              <dd>
                {amount.format(Math.abs(emissions))} <span>kg</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className={styles.foot}>
        <p>
          Per room: {sampleRoom.name} ({sampleRoom.building}) from the
          simulator, its next 8 weeks averaged per day, against an AC fixed at
          71.6°F. About 10% less cooling electricity per 1°C warmer room{" "}
          <Cite n={source.hoyt} />. A USC conference paper quotes that study’s
          29% cooling saving <Cite n={source.ghahramani} />, and the CBE
          calculator restates it <Cite n={source.cbe} />. Measured commercial
          buildings are reported in <Cite n={source.deChalendar} />. Each seated
          person adds 117 W of heat <Cite n={source.ashrae} />. Dollars use
          LADWP R-1A two-month bills <Cite n={source.ladwpRates} />,{" "}
          <Cite n={source.ladwpTiers} />, Zone 2 for campus ZIP 90007{" "}
          <Cite n={source.ladwpZones} />.
          These figures estimate cooling electricity from the published studies.
        </p>
        <Link className="text-link" href="/impact">
          Impact <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
