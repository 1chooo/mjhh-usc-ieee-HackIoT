"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Scenario, ThermalResult } from "../lib/thermal";

type ThingKind =
  | "person"
  | "table"
  | "desk"
  | "shelf"
  | "temperature"
  | "humidity"
  | "occupancy"
  | "outdoor";

type Tool = "move" | ThingKind;

type Vote = "none" | "hot" | "cold";

type Thing = {
  id: string;
  kind: ThingKind;
  x: number;
  y: number;
  vote: Vote;
  reading: number;
};

const tools: { id: Tool; label: string }[] = [
  { id: "move", label: "Move" },
  { id: "person", label: "Person" },
  { id: "table", label: "Table" },
  { id: "desk", label: "Desk" },
  { id: "shelf", label: "Shelf" },
  { id: "temperature", label: "Temp sensor" },
  { id: "humidity", label: "Humidity sensor" },
  { id: "occupancy", label: "Occupancy sensor" },
  { id: "outdoor", label: "Outdoor sensor" },
];

let thingSeq = 0;

function nextId(kind: string): string {
  thingSeq += 1;
  return `${kind}-${thingSeq}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isSensor(kind: ThingKind): boolean {
  return (
    kind === "temperature" ||
    kind === "humidity" ||
    kind === "occupancy" ||
    kind === "outdoor"
  );
}

function isFurniture(kind: ThingKind): boolean {
  return kind === "table" || kind === "desk" || kind === "shelf";
}

function make(
  kind: ThingKind,
  x: number,
  y: number,
  scenario: Scenario,
): Thing {
  const reading =
    kind === "temperature"
      ? scenario.indoorC
      : kind === "humidity"
        ? scenario.humidityPct
        : kind === "outdoor"
          ? scenario.outdoorC
          : 0;
  return { id: nextId(kind), kind, x, y, vote: "none", reading };
}

function personSpot(index: number): { x: number; y: number } {
  const column = index % 10;
  const row = Math.floor(index / 10);
  return { x: 24 + column * 5.4, y: 30 + row * 7 };
}

function furnitureFor(kind: Scenario["kind"]): Thing[] {
  if (kind === "library") {
    return [
      make("shelf", 12, 58, blankScenario),
      make("table", 42, 46, blankScenario),
      make("table", 64, 46, blankScenario),
      make("table", 42, 74, blankScenario),
      make("table", 64, 74, blankScenario),
    ];
  }
  return Array.from({ length: 12 }, (_, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    return make("desk", 30 + column * 12, 38 + row * 14, blankScenario);
  });
}

const blankScenario = {
  indoorC: 22,
  humidityPct: 45,
  outdoorC: 20,
} as Scenario;

function buildLayout(scenario: Scenario): Thing[] {
  const people = Array.from(
    { length: Math.round(scenario.occupancy) },
    (_, index) => {
      const spot = personSpot(index);
      const thing = make("person", spot.x, spot.y, scenario);
      if (index < scenario.hotVotes) {
        thing.vote = "hot";
      } else if (index < scenario.hotVotes + scenario.coldVotes) {
        thing.vote = "cold";
      }
      return thing;
    },
  );
  return [
    ...furnitureFor(scenario.kind),
    ...people,
    make("temperature", 88, 34, scenario),
    make("humidity", 88, 48, scenario),
    make("occupancy", 88, 62, scenario),
    make("outdoor", 84, 16, scenario),
  ];
}

function average(things: Thing[], kind: ThingKind): number | undefined {
  const found = things.filter((thing) => thing.kind === kind);
  if (found.length === 0) {
    return undefined;
  }
  return found.reduce((sum, thing) => sum + thing.reading, 0) / found.length;
}

function derive(things: Thing[], scenario: Scenario): Partial<Scenario> {
  const people = things.filter((thing) => thing.kind === "person");
  const partial: Partial<Scenario> = {
    occupancy: people.length,
    hotVotes: people.filter((thing) => thing.vote === "hot").length,
    coldVotes: people.filter((thing) => thing.vote === "cold").length,
  };
  const indoor = average(things, "temperature");
  const humidity = average(things, "humidity");
  const outdoor = average(things, "outdoor");
  if (indoor !== undefined) {
    partial.indoorC = indoor;
  }
  if (humidity !== undefined) {
    partial.humidityPct = humidity;
  }
  if (outdoor !== undefined) {
    partial.outdoorC = outdoor;
  }
  if (!changed(partial, scenario)) {
    return {};
  }
  return partial;
}

function changed(partial: Partial<Scenario>, scenario: Scenario): boolean {
  return Object.entries(partial).some(([key, value]) => {
    const current = scenario[key as keyof Scenario];
    if (typeof value === "number" && typeof current === "number") {
      return Math.abs(value - current) > 0.05;
    }
    return value !== current;
  });
}

function reconcile(
  things: Thing[],
  scenario: Scenario,
  kindChanged: boolean,
): Thing[] {
  let next = things;
  if (kindChanged) {
    next = [
      ...next.filter((thing) => !isFurniture(thing.kind)),
      ...furnitureFor(scenario.kind),
    ];
  }
  const people = next.filter((thing) => thing.kind === "person");
  const target = Math.round(scenario.occupancy);
  let resized = people;
  if (people.length > target) {
    resized = people.slice(0, target);
  } else if (people.length < target) {
    const added = Array.from({ length: target - people.length }, (_, index) => {
      const spot = personSpot(people.length + index);
      return make("person", spot.x, spot.y, scenario);
    });
    resized = [...people, ...added];
  }
  const hot = Math.round(scenario.hotVotes);
  const cold = Math.round(scenario.coldVotes);
  const hotNow = resized.filter((thing) => thing.vote === "hot").length;
  const coldNow = resized.filter((thing) => thing.vote === "cold").length;
  if (hotNow !== hot || coldNow !== cold) {
    resized = resized.map((thing, index) => {
      const vote: Vote =
        index < hot ? "hot" : index < hot + cold ? "cold" : "none";
      return thing.vote === vote ? thing : { ...thing, vote };
    });
  }
  if (resized !== people) {
    next = [...next.filter((thing) => thing.kind !== "person"), ...resized];
  }
  next = syncSensors(next, "temperature", scenario.indoorC);
  next = syncSensors(next, "humidity", scenario.humidityPct);
  next = syncSensors(next, "outdoor", scenario.outdoorC);
  return sameThings(next, things) ? things : next;
}

function syncSensors(things: Thing[], kind: ThingKind, value: number): Thing[] {
  const current = average(things, kind);
  if (current === undefined || Math.abs(current - value) <= 0.05) {
    return things;
  }
  let changedSensor = false;
  const next = things.map((thing) => {
    if (thing.kind !== kind || Math.abs(thing.reading - value) <= 0.05) {
      return thing;
    }
    changedSensor = true;
    return { ...thing, reading: value };
  });
  return changedSensor ? next : things;
}

function sameThings(left: Thing[], right: Thing[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((thing, index) => thing === right[index]);
}

function outdoorSky(outdoorC: number): string {
  if (outdoorC < 16) {
    return "linear-gradient(#16324f, #8fb4d6)";
  }
  if (outdoorC > 26) {
    return "linear-gradient(#b85a32, #f0c36a)";
  }
  return "linear-gradient(#3e5870, #d5ddd4)";
}

export function RoomScene({
  scenario,
  result,
  layoutToken,
  onChange,
}: {
  scenario: Scenario;
  result: ThermalResult;
  layoutToken: number;
  onChange: (partial: Partial<Scenario>) => void;
}) {
  const [things, setThings] = useState<Thing[]>(() => buildLayout(scenario));
  const [tool, setTool] = useState<Tool>("move");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const thingsRef = useRef(things);
  const kindRef = useRef(scenario.kind);
  const tokenRef = useRef(layoutToken);
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    px: number;
    py: number;
    moved: boolean;
  } | null>(null);

  thingsRef.current = things;

  useEffect(() => {
    const reset = tokenRef.current !== layoutToken;
    tokenRef.current = layoutToken;
    const kindChanged = kindRef.current !== scenario.kind;
    kindRef.current = scenario.kind;
    if (reset) {
      setSelectedId(null);
    }
    setThings((current) =>
      reset ? buildLayout(scenario) : reconcile(current, scenario, kindChanged),
    );
  }, [scenario, layoutToken]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (!selectedId) {
        return;
      }
      event.preventDefault();
      removeThing(selectedId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const selected = things.find((thing) => thing.id === selectedId) ?? null;
  const people = things.filter((thing) => thing.kind === "person");
  const warmth = Math.min(1, Math.max(0, (result.perceivedC - 19) / 12));

  function commit(next: Thing[]) {
    setThings(next);
    const partial = derive(next, scenario);
    if (Object.keys(partial).length > 0) {
      onChange(partial);
    }
  }

  function removeThing(id: string) {
    commit(thingsRef.current.filter((thing) => thing.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }

  function place(event: PointerEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLElement) || !event.target.dataset.stage) {
      return;
    }
    if (tool === "move") {
      setSelectedId(null);
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    if (tool === "person" && people.length >= scenario.capacity) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 6, 94);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 10, 92);
    const thing = make(tool, x, y, scenario);
    commit([...thingsRef.current, thing]);
    setSelectedId(thing.id);
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    event.stopPropagation();
    const thing = thingsRef.current.find((item) => item.id === id);
    if (!thing) {
      return;
    }
    drag.current = {
      id,
      x: thing.x,
      y: thing.y,
      px: event.clientX,
      py: event.clientY,
      moved: false,
    };
    setSelectedId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    const stage = stageRef.current;
    if (!active || !stage) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    const dx = ((event.clientX - active.px) / rect.width) * 100;
    const dy = ((event.clientY - active.py) / rect.height) * 100;
    if (Math.hypot(dx, dy) > 1.2) {
      active.moved = true;
    }
    const x = clamp(active.x + dx, 6, 94);
    const y = clamp(active.y + dy, 10, 92);
    setThings((current) =>
      current.map((thing) =>
        thing.id === active.id ? { ...thing, x, y } : thing,
      ),
    );
  }

  function pointerUp() {
    const active = drag.current;
    drag.current = null;
    if (!active || active.moved || tool !== "move") {
      return;
    }
    const thing = thingsRef.current.find((item) => item.id === active.id);
    if (!thing || thing.kind !== "person") {
      return;
    }
    const vote: Vote =
      thing.vote === "none" ? "hot" : thing.vote === "hot" ? "cold" : "none";
    commit(
      thingsRef.current.map((item) =>
        item.id === thing.id ? { ...item, vote } : item,
      ),
    );
  }

  function setReading(id: string, reading: number) {
    commit(
      thingsRef.current.map((thing) =>
        thing.id === id ? { ...thing, reading } : thing,
      ),
    );
  }

  function setVote(id: string, vote: Vote) {
    commit(
      thingsRef.current.map((thing) =>
        thing.id === id ? { ...thing, vote } : thing,
      ),
    );
  }

  return (
    <section className="room-scene">
      <div className="room-scene-head">
        <p className={`badge ${result.action}`}>
          {result.action} · {result.targetC.toFixed(1)}°C
        </p>
      </div>
      <div className="tool-row" role="toolbar" aria-label="Canvas tools">
        {tools.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ghost"
            aria-pressed={tool === item.id}
            onClick={() => setTool(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        ref={stageRef}
        className={`room-stage ${scenario.kind}${scenario.scheduledOpen ? "" : " closed"}`}
      >
        <div
          className="room-air"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(255, 150, 110, ${warmth * 0.22}), transparent 46%), linear-gradient(0deg, rgba(140, 180, 255, ${(1 - warmth) * 0.2}), transparent 42%)`,
          }}
        />
        <div
          className="room-windows"
          style={{ background: outdoorSky(scenario.outdoorC) }}
        >
          <span>Outside {scenario.outdoorC.toFixed(1)}°C</span>
        </div>
        <div className="room-door" aria-hidden="true">
          Door
        </div>
        <div className="stage-hit" data-stage="true" onPointerDown={place} />
        {things.map((thing) => (
          <button
            key={thing.id}
            type="button"
            className={`thing ${thing.kind} ${thing.vote} ${selectedId === thing.id ? "selected" : ""}`}
            style={{ left: `${thing.x}%`, top: `${thing.y}%` }}
            aria-label={labelFor(thing, people.length)}
            onPointerDown={(event) => pointerDown(event, thing.id)}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
          >
            <ThingBody thing={thing} people={people.length} />
          </button>
        ))}
        {scenario.scheduledOpen ? null : <p className="room-closed">Closed</p>}
      </div>
      {selected ? (
        <Inspector
          thing={selected}
          people={people.length}
          onVote={setVote}
          onReading={setReading}
          onRemove={removeThing}
        />
      ) : null}
    </section>
  );
}

function labelFor(thing: Thing, people: number): string {
  if (thing.kind === "person") {
    if (thing.vote === "hot") {
      return "Person who says the room is too hot";
    }
    if (thing.vote === "cold") {
      return "Person who says the room is too cold";
    }
    return "Person who has not voted";
  }
  if (thing.kind === "temperature") {
    return `Temperature sensor, ${thing.reading.toFixed(1)} degrees`;
  }
  if (thing.kind === "humidity") {
    return `Humidity sensor, ${Math.round(thing.reading)} percent`;
  }
  if (thing.kind === "occupancy") {
    return `Occupancy sensor, ${people} people`;
  }
  if (thing.kind === "outdoor") {
    return `Outdoor sensor, ${thing.reading.toFixed(1)} degrees`;
  }
  return thing.kind;
}

function ThingBody({ thing, people }: { thing: Thing; people: number }) {
  if (thing.kind === "person") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="7" r="3.1" />
        <path d="M5.2 19.5c1.1-3.3 3.4-5 6.8-5s5.7 1.7 6.8 5" />
      </svg>
    );
  }
  if (thing.kind === "temperature") {
    return <SensorFace name="Temp" value={`${thing.reading.toFixed(1)}°`} />;
  }
  if (thing.kind === "humidity") {
    return <SensorFace name="RH" value={`${Math.round(thing.reading)}%`} />;
  }
  if (thing.kind === "occupancy") {
    return <SensorFace name="Occ" value={String(people)} />;
  }
  if (thing.kind === "outdoor") {
    return <SensorFace name="Out" value={`${thing.reading.toFixed(0)}°`} />;
  }
  return <span className="furniture-label">{thing.kind}</span>;
}

function SensorFace({ name, value }: { name: string; value: string }) {
  return (
    <>
      <span>{name}</span>
      <strong>{value}</strong>
    </>
  );
}

function Inspector({
  thing,
  people,
  onVote,
  onReading,
  onRemove,
}: {
  thing: Thing;
  people: number;
  onVote: (id: string, vote: Vote) => void;
  onReading: (id: string, reading: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="inspector">
      <p>{labelFor(thing, people)}</p>
      {thing.kind === "person" ? (
        <div className="choice-row">
          {(["none", "hot", "cold"] as Vote[]).map((vote) => (
            <button
              key={vote}
              type="button"
              className="ghost"
              aria-pressed={thing.vote === vote}
              onClick={() => onVote(thing.id, vote)}
            >
              {vote === "none"
                ? "No vote"
                : vote === "hot"
                  ? "Too hot"
                  : "Too cold"}
            </button>
          ))}
        </div>
      ) : null}
      {thing.kind === "temperature" || thing.kind === "outdoor" ? (
        <label className="slider">
          <span>
            Reading
            <strong>{thing.reading.toFixed(1)} °C</strong>
          </span>
          <input
            type="range"
            min={thing.kind === "outdoor" ? 0 : 16}
            max={thing.kind === "outdoor" ? 40 : 32}
            step={0.1}
            value={thing.reading}
            onChange={(event) =>
              onReading(thing.id, Number(event.target.value))
            }
          />
        </label>
      ) : null}
      {thing.kind === "humidity" ? (
        <label className="slider">
          <span>
            Reading
            <strong>{Math.round(thing.reading)}%</strong>
          </span>
          <input
            type="range"
            min={20}
            max={90}
            step={1}
            value={thing.reading}
            onChange={(event) =>
              onReading(thing.id, Number(event.target.value))
            }
          />
        </label>
      ) : null}
      <button
        type="button"
        className="ghost"
        onClick={() => onRemove(thing.id)}
      >
        Remove
      </button>
    </div>
  );
}
