"use client";

import Link from "next/link";
import { evaluateSpace, spaces } from "../lib/campus";
import { energyDeltaLabel } from "../lib/thermal";
import { useCampus } from "../lib/use-campus";
import { VoteMeter } from "./result-block";

export function RoomBoard({ detailed = false }: { detailed?: boolean }) {
  const campus = useCampus();
  const rows = spaces.map((space) => {
    const reading = campus.readings[space.id];
    const result = reading ? evaluateSpace(space, reading) : undefined;
    return { space, reading, result };
  });
  const saved = rows.reduce((sum, row) => sum + (row.result?.savedKwh ?? 0), 0);

  return (
    <section className="stack">
      {detailed ? (
        <dl className="stat-grid">
          <div>
            <dt>Rooms</dt>
            <dd>{spaces.length}</dd>
          </div>
          <div>
            <dt>Against a fixed setpoint</dt>
            <dd
              className={
                saved >= 0.005 ? "save" : saved <= -0.005 ? "spend" : ""
              }
            >
              {energyDeltaLabel(saved)}
            </dd>
          </div>
          <div>
            <dt>Calls</dt>
            <dd>
              {rows.filter((row) => row.result?.action === "cool").length} cool
              · {rows.filter((row) => row.result?.action === "heat").length}{" "}
              heat ·{" "}
              {rows.filter((row) => row.result?.action === "hold").length} hold
            </dd>
          </div>
          <div>
            <dt>Votes in this browser</dt>
            <dd>{Object.keys(campus.myVotes).length}</dd>
          </div>
        </dl>
      ) : null}
      <div className="card-grid">
        {rows.map(({ space, reading, result }) => (
          <article className="card" key={space.id}>
            <header>
              <p className="eyebrow">
                {space.building} · {space.kind}
              </p>
              <h2>{space.name}</h2>
            </header>
            {result && reading ? (
              <>
                <p className={`badge ${result.action}`}>{result.action}</p>
                <p>{result.summary}</p>
                <dl className="inline-stats">
                  <div>
                    <dt>Indoor</dt>
                    <dd>{reading.indoorC.toFixed(1)}°C</dd>
                  </div>
                  <div>
                    <dt>Setpoint</dt>
                    <dd>{result.targetC.toFixed(1)}°C</dd>
                  </div>
                  <div>
                    <dt>People</dt>
                    <dd>{Math.round(reading.occupancy)}</dd>
                  </div>
                  <div>
                    <dt>Versus fixed</dt>
                    <dd
                      className={
                        result.savedKwh >= 0.005
                          ? "save"
                          : result.savedKwh <= -0.005
                            ? "spend"
                            : ""
                      }
                    >
                      {energyDeltaLabel(result.savedKwh)}
                    </dd>
                  </div>
                </dl>
                <VoteMeter hot={reading.hotVotes} cold={reading.coldVotes} />
              </>
            ) : null}
            <Link className="text-link" href={`/rooms/${space.id}`}>
              Vote in this room
            </Link>
          </article>
        ))}
      </div>
      {detailed ? (
        <button
          className="ghost"
          type="button"
          onClick={campus.reset}
          disabled={!campus.ready}
        >
          Reset votes and readings
        </button>
      ) : null}
    </section>
  );
}
