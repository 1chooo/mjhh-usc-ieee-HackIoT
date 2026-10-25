"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { EnergyImpact } from "../lib/energy-impact";
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

export function ScaleStory({
  impact,
  spanLabel,
}: {
  impact: EnergyImpact;
  spanLabel: string;
}) {
  const [rooms, setRooms] = useState(100);
  const [selectedScale, setSelectedScale] = useState<string | null>(
    "neighborhood",
  );
  const headingId = useId();
  const rangeId = useId();
  const electricity = impact.saved.electricityKwh * rooms;
  const cost = impact.saved.cost * rooms;
  const emissions = impact.saved.emissionsKg * rooms;
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
          These totals repeat the current room and conditions across the
          selected spaces and time. They are estimates, not measured building
          savings.
        </p>
        <Link className="text-link" href="/impact">
          Impact <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
