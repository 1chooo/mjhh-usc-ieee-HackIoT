"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { type Scenario } from "../lib/thermal";
import { RoomModel } from "../lib/ac-model";
import {
  evaluateWithModel,
  shiftClock,
  simulatedVotes,
} from "../lib/model-sim";
import {
  classAt,
  classInWeek,
  classLabel,
  firstClassAt,
  getSimRoom,
  simRooms,
} from "../lib/sim-rooms";
import { ModelPanel, type HourLog, type KnownGroup } from "./sim/model-panel";
import { addHour, NO_TOTALS, type EnergyTotals } from "../lib/billing";
import { arrival, clockText, step } from "../lib/sim-run";
import {
  SCALE_RATE,
  YEAR_HOURS,
  acceleratedHours,
  formatScaleDollars,
  formatScaleKw,
  formatScaleTime,
  scaleDollars,
} from "../lib/scale-savings";
import { roomFootprint } from "./sim/layout";
import {
  activePersonVotes,
  castPersonVote,
  voteAt,
  type PersonVote,
} from "./sim/layout";
import { useCampus } from "../lib/use-campus";
import { ResultBlock } from "./result-block";
import { DetailCard } from "./sim/detail-card";
import { SimStage } from "./sim/sim-stage";
import type { SimMode, SimPick } from "./sim/sim-types";
import {
  EASE_MS,
  lerpScenario,
  sampleStory,
  STORY_MS,
} from "./sim/story";

type PlayLabel = "play" | "pause" | "replay";

type StoryClock = { end: Scenario; elapsed: number };
type EaseClock = { from: Scenario; to: Scenario; elapsed: number };

// Read-only stand-in until a room has been stepped (preview never changes it).
const UNTRAINED = new RoomModel();

/** The charts show the last week of hours. */
const HISTORY_HOURS = 24 * 7;

type Track = { room: RoomModel; at: string; history: HourLog[]; totals: EnergyTotals };

const firstRoom = simRooms[0]!;
const opening = arrival(firstRoom, UNTRAINED, firstClassAt(firstRoom), null, true);

export function SimulatorView() {
  const params = useSearchParams();
  const campus = useCampus();
  const [scenario, setScenario] = useState<Scenario>(opening.scenario);
  const [mode, setMode] = useState<SimMode>("room");
  const [pick, setPick] = useState<SimPick | null>(null);
  const [factorsOpen, setFactorsOpen] = useState(true);
  const [spaceId, setSpaceId] = useState(firstRoom.id);
  const [playLabel, setPlayLabel] = useState<PlayLabel>("play");
  const [progress, setProgress] = useState(0);
  const [personVotes, setPersonVotes] = useState<PersonVote[] | null>(null);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [wantC, setWantC] = useState(opening.wantC);
  const [autoVotes, setAutoVotes] = useState(true);
  const applied = useRef(false);
  const scenarioRef = useRef(scenario);
  const storyRef = useRef<StoryClock | null>(null);
  const easeRef = useRef<EaseClock | null>(null);
  const playingRef = useRef(false);
  const loopRef = useRef(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const cornerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const showRef = useRef<(next: Scenario) => void>(() => {});
  const personVotesRef = useRef(personVotes);
  personVotesRef.current = personVotes;

  showRef.current = (next: Scenario) => {
    const settled = settle(next);
    scenarioRef.current = settled;
    setScenario(settled);
  };

  useEffect(() => {
    if (window.matchMedia("(max-width: 800px)").matches) {
      setFactorsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (applied.current) {
      return;
    }
    applied.current = true;
    const id = params.get("space");
    const def = id ? getSimRoom(id) : undefined;
    if (!def) {
      return;
    }
    const next = arrival(def, UNTRAINED, firstClassAt(def), null, true);
    storyRef.current = null;
    easeRef.current = null;
    playingRef.current = false;
    setPlayLabel("play");
    setProgress(0);
    setSpaceId(def.id);
    setWantC(next.wantC);
    showRef.current(next.scenario);
  }, [params]);

  // The factors drawer ends just above the bottom dock, however tall the dock gets.
  useEffect(() => {
    const dock = dockRef.current;
    const overlay = overlayRef.current;
    const corner = cornerRef.current;
    const top = topRef.current;
    if (!dock || !overlay || typeof ResizeObserver === "undefined") {
      return;
    }
    const controls = [corner, top?.querySelector(".sim-toolbar"), top?.querySelector(".sim-tags")].filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
    const sync = () => {
      const overlayTop = overlay.getBoundingClientRect().top;
      overlay.style.setProperty("--dock-h", `${Math.ceil(dock.getBoundingClientRect().height)}px`);
      const bottom = Math.max(0, ...controls.map((node) => node.getBoundingClientRect().bottom));
      overlay.style.setProperty("--controls-h", `${Math.ceil(bottom - overlayTop + 12)}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(dock);
    for (const node of controls) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pick?.type === "person" && pick.index >= Math.round(scenario.occupancy)) {
      setPick(null);
    }
  }, [pick, scenario.occupancy]);

  useEffect(() => {
    return () => {
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
      }
    };
  }, []);

  const roomDef = getSimRoom(spaceId) ?? firstRoom;
  const track = tracks[spaceId];
  const clockAt = track?.at ?? firstClassAt(roomDef);
  const model = track?.room ?? UNTRAINED;
  const result = evaluateWithModel(scenario, model, clockAt);
  const knownGroups: KnownGroup[] = model.groups.map((g) => ({ ...g, offsetC: model.offsetFor(g.gid) }));
  const nowClass = classAt(roomDef, clockAt);

  // Bird's-eye: rooms × this hour's saved power × $/kWh × an accelerating clock.
  const [fleetRooms, setFleetRooms] = useState("");
  const roomsN = Math.max(0, Math.floor(Number(fleetRooms) || 0));
  const fleetActive = roomsN > 0 && mode === "fleet";
  const hourSpan = scenario.hours > 0 ? scenario.hours : 1;
  const savedKw = result.savedKwh / hourSpan;
  const footprint = roomFootprint(roomDef.floorAreaM2, roomDef.kind);
  const fleetShape = {
    count: Math.max(1, roomsN),
    kind: roomDef.kind,
    width: footprint.width,
    depth: footprint.depth,
    people: scenario.scheduledOpen ? scenario.occupancy : 0,
    hotVotes: scenario.hotVotes,
    coldVotes: scenario.coldVotes,
  };

  function trackFor(id: string): Track {
    return tracks[id] ?? { room: new RoomModel(), at: firstClassAt(getSimRoom(id) ?? firstRoom), history: [], totals: NO_TOTALS };
  }

  function showArrival(next: { scenario: Scenario; wantC: number }) {
    clearStory();
    setPersonVotes(null);
    setWantC(next.wantC);
    showRef.current(next.scenario);
  }

  function save(t: Track, at: string, logs: HourLog[]) {
    const totals = logs.reduce((sum, h) => addHour(sum, h.at, h.fixedKwh, h.modelKwh), t.totals);
    setTracks({ ...tracks, [spaceId]: { room: t.room, at, history: [...t.history, ...logs].slice(-HISTORY_HOURS), totals } });
  }

  function nextHour() {
    const t = trackFor(spaceId);
    const { log, nextAt, next } = step(roomDef, t.room, scenarioRef.current, t.at, wantC, autoVotes);
    save(t, nextAt, [log]);
    showArrival(next);
  }

  /** 168 hours go by: every class on the timetable and every empty hour in between. */
  function nextWeek() {
    const t = trackFor(spaceId);
    let at = t.at;
    let current = { scenario: scenarioRef.current, wantC };
    const logs: HourLog[] = [];
    for (let h = 0; h < 24 * 7; h++) {
      const r = step(roomDef, t.room, current.scenario, at, current.wantC, autoVotes);
      logs.push(r.log);
      at = r.nextAt;
      current = r.next;
    }
    save(t, at, logs);
    showArrival(current);
  }

  function resetModel() {
    const rest = { ...tracks };
    delete rest[spaceId];
    setTracks(rest);
    showArrival(arrival(roomDef, UNTRAINED, firstClassAt(roomDef), scenarioRef.current, autoVotes));
  }

  /** Jump to a class on the timetable (its next start, never back in time). */
  function selectClass(id: string) {
    const k = roomDef.classes.find((item) => item.id === id);
    if (!k) {
      return;
    }
    const t = trackFor(spaceId);
    let at = classInWeek(k, t.at);
    if (at <= t.at) {
      at = shiftClock(at, 24 * 7);
    }
    setTracks({ ...tracks, [spaceId]: { ...t, at } });
    showArrival(arrival(roomDef, t.room, at, scenarioRef.current, autoVotes));
  }

  function changeWant(next: number) {
    setWantC(next);
    if (autoVotes) {
      patch(simulatedVotes(scenarioRef.current.indoorC, next, scenarioRef.current.occupancy));
    }
  }

  function toggleAutoVotes() {
    const next = !autoVotes;
    setAutoVotes(next);
    if (next) {
      patch(simulatedVotes(scenarioRef.current.indoorC, wantC, scenarioRef.current.occupancy));
    }
  }

  function stopLoop() {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = 0;
    }
  }

  function ensureLoop() {
    if (loopRef.current) {
      return;
    }
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      let keep = false;
      const storyClock = storyRef.current;
      if (playingRef.current && storyClock) {
        storyClock.elapsed = Math.min(STORY_MS, storyClock.elapsed + dt);
        const t = storyClock.elapsed / STORY_MS;
        showRef.current({
          ...storyClock.end,
          ...sampleStory(storyClock.end, t),
        });
        setProgress(t);
        if (t >= 1) {
          playingRef.current = false;
          setPlayLabel("replay");
        } else {
          keep = true;
        }
      } else if (easeRef.current) {
        const clock = easeRef.current;
        clock.elapsed = Math.min(EASE_MS, clock.elapsed + dt);
        const t = clock.elapsed / EASE_MS;
        if (t >= 1) {
          easeRef.current = null;
          showRef.current(clock.to);
        } else {
          showRef.current(lerpScenario(clock.from, clock.to, t));
          keep = true;
        }
      }
      loopRef.current = keep ? requestAnimationFrame(step) : 0;
    };
    loopRef.current = requestAnimationFrame(step);
  }

  function clearStory() {
    storyRef.current = null;
    easeRef.current = null;
    playingRef.current = false;
    setPlayLabel("play");
    setProgress(0);
    stopLoop();
  }

  function easeTo(next: Scenario) {
    const target = settle(next);
    storyRef.current = null;
    playingRef.current = false;
    setPlayLabel("play");
    setProgress(0);
    stopLoop();
    if (motionReduced()) {
      easeRef.current = null;
      showRef.current(target);
      return;
    }
    const from: Scenario = {
      ...scenarioRef.current,
      kind: target.kind,
      scheduledOpen: target.scheduledOpen,
    };
    easeRef.current = { from, to: target, elapsed: 0 };
    showRef.current(from);
    ensureLoop();
  }

  function pausePlayback() {
    playingRef.current = false;
    const elapsed = storyRef.current?.elapsed ?? 0;
    setPlayLabel(elapsed >= STORY_MS ? "replay" : "play");
    if (!easeRef.current) {
      stopLoop();
    }
  }

  function beginStory(end: Scenario) {
    const target = settle(end);
    easeRef.current = null;
    storyRef.current = { end: target, elapsed: 0 };
    playingRef.current = true;
    setPlayLabel("pause");
    setProgress(0);
    stopLoop();
    showRef.current({ ...target, ...sampleStory(target, 0) });
    ensureLoop();
  }

  function onPlay() {
    if (mode !== "room") {
      return;
    }
    if (playingRef.current) {
      pausePlayback();
      return;
    }
    if (motionReduced()) {
      const target = easeRef.current?.to ?? storyRef.current?.end;
      if (target) {
        clearStory();
        showRef.current(target);
      }
      return;
    }
    const storyClock = storyRef.current;
    if (storyClock && storyClock.elapsed < STORY_MS && !easeRef.current) {
      playingRef.current = true;
      setPlayLabel("pause");
      ensureLoop();
      return;
    }
    const end =
      easeRef.current?.to ??
      (storyClock && storyClock.elapsed >= STORY_MS
        ? storyClock.end
        : scenarioRef.current);
    beginStory(end);
  }

  function votePerson(index: number, vote: "hot" | "cold") {
    const current = scenarioRef.current;
    const cast = castPersonVote(
      current.occupancy,
      current.hotVotes,
      current.coldVotes,
      personVotesRef.current,
      index,
      vote,
    );
    if (!cast) {
      return;
    }
    clearStory();
    setAutoVotes(false);
    setPersonVotes(cast.votes);
    showRef.current({
      ...scenarioRef.current,
      hotVotes: cast.hotVotes,
      coldVotes: cast.coldVotes,
    });
  }

  function patch(partial: Partial<Scenario>) {
    clearStory();
    showRef.current({ ...scenarioRef.current, ...partial });
  }

  function showMode(next: SimMode) {
    if (next === "campus") {
      pausePlayback();
    }
    if (next !== "fleet") {
      setFleetRooms("");
    }
    setMode(next);
    setPick(null);
  }

  function openSpace(id: string) {
    const def = getSimRoom(id);
    if (!def) {
      return;
    }
    const t = tracks[id];
    const next = arrival(def, t?.room ?? UNTRAINED, t?.at ?? firstClassAt(def), scenarioRef.current, autoVotes);
    setWantC(next.wantC);
    setSpaceId(id);
    setPick(null);
    setFleetRooms("");
    setMode("room");
    easeTo(next.scenario);
  }

  const shownVotes = activePersonVotes(
    scenario.occupancy,
    scenario.hotVotes,
    scenario.coldVotes,
    personVotes,
  );
  const personVote =
    pick?.type === "person"
      ? (shownVotes?.[pick.index] ??
        voteAt(pick.index, scenario.hotVotes, scenario.coldVotes))
      : null;
  const roomOnly = mode === "room";
  const playText =
    playLabel === "pause" ? "Pause" : playLabel === "replay" ? "Replay" : "Play";

  return (
    <section className="sim-shell" aria-label="Room simulator">
      <div className="sim-stage">
        <SimStage
          mode={mode}
          scenario={scenario}
          result={result}
          readings={campus.readings}
          votes={shownVotes}
          selected={pick}
          onSelect={setPick}
          onSelectSpace={openSpace}
          fleet={fleetShape}
        />
      </div>
      <div className="sim-overlay" ref={overlayRef}>
        <div className="sim-top" ref={topRef}>
          <div className="sim-toolbar">
            <div className="choice-row">
              <button
                type="button"
                className="ghost"
                aria-pressed={mode === "room"}
                onClick={() => showMode("room")}
              >
                Room
              </button>
              <button
                type="button"
                className="ghost"
                aria-pressed={mode === "campus"}
                onClick={() => showMode("campus")}
              >
                Campus
              </button>
            </div>
            <p className={`badge ${result.action}`}>
              {result.action} · {result.targetC.toFixed(1)}°C
            </p>
          </div>
          <div className="sim-tags">
            <button
              type="button"
              className="ghost sim-play"
              aria-pressed={playLabel === "pause"}
              disabled={!roomOnly}
              onClick={onPlay}
            >
              <span
                className="sim-play-fill"
                style={{ width: `${progress * 100}%` }}
                aria-hidden="true"
              />
              <span className="sim-play-label">{playText}</span>
            </button>
            <button
              type="button"
              className="ghost"
              aria-pressed={scenario.scheduledOpen}
              disabled={!roomOnly}
              onClick={() =>
                patch({
                  scheduledOpen: !scenarioRef.current.scheduledOpen,
                })
              }
            >
              {scenario.scheduledOpen ? "Open" : "Closed"}
            </button>
            <label className="sim-select">
              <span>Room</span>
              <select
                value={spaceId}
                onChange={(event) => openSpace(event.target.value)}
              >
                {simRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="sim-select">
              <span>Class</span>
              <select
                value={nowClass?.id ?? ""}
                onChange={(event) => selectClass(event.target.value)}
              >
                {nowClass ? null : (
                  <option value="" disabled>
                    No class
                  </option>
                )}
                {roomDef.classes.map((k) => (
                  <option key={k.id} value={k.id}>
                    {classLabel(k)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="sim-corner" ref={cornerRef}>
          <ScaleFormula
            active={fleetActive}
            savedKw={savedKw}
            rooms={fleetActive ? roomsN : 1}
            roomsValue={fleetRooms}
            onRoomsFocus={() => {
              if (roomsN > 0) showMode("fleet");
            }}
            onRoomsChange={(value) => {
              const next = Math.floor(Number(value) || 0);
              if (next > 0) {
                setFleetRooms(value);
                if (mode !== "fleet") showMode("fleet");
              } else if (mode === "fleet") {
                showMode("room");
              } else {
                setFleetRooms(value);
              }
            }}
          />
          <button
            type="button"
            className="ghost sim-factors"
            aria-expanded={factorsOpen}
            onClick={() => setFactorsOpen((open) => !open)}
          >
            {factorsOpen ? "Hide factors" : "Factors"}
          </button>
        </div>
        <div className="sim-dock" ref={dockRef}>
          {pick ? (
            <DetailCard
              pick={pick}
              scenario={scenario}
              vote={personVote}
              onVote={(vote) => {
                if (pick?.type === "person") {
                  votePerson(pick.index, vote);
                }
              }}
              onClose={() => setPick(null)}
            />
          ) : null}
          <div className="sim-metrics">
            {roomOnly ? (
              <ModelPanel
                clock={clockText(clockAt)}
                result={result}
                history={track?.history ?? []}
                totals={track?.totals ?? NO_TOTALS}
                groups={knownGroups}
                hot={scenario.scheduledOpen ? Math.round(scenario.hotVotes) : 0}
                cold={scenario.scheduledOpen ? Math.round(scenario.coldVotes) : 0}
                wantC={autoVotes ? wantC : null}
                className={nowClass?.name ?? "No class"}
                onNextHour={nextHour}
                onNextWeek={nextWeek}
                onReset={resetModel}
              />
            ) : mode === "fleet" ? null : (
              <div className="result-card">
                <ResultBlock result={result} />
              </div>
            )}
          </div>
        </div>
        {factorsOpen ? (
          <aside className="sim-drawer" aria-label="Scenario factors">
            <fieldset>
              <legend>Room</legend>
              <dl className="room-facts">
                <div>
                  <dt>Building</dt>
                  <dd>{roomDef.building}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{roomDef.kind}</dd>
                </div>
                <div>
                  <dt>Floor area</dt>
                  <dd>{roomDef.floorAreaM2} m²</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>{roomDef.capacity} people</dd>
                </div>
              </dl>
              <p className="model-hint">{roomDef.note}</p>
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
                onChange={(hotVotes) => {
                  setAutoVotes(false);
                  patch({ hotVotes });
                }}
              />
              <Slider
                label="Cold votes"
                min={0}
                max={scenario.occupancy}
                step={1}
                unit="votes"
                value={scenario.coldVotes}
                onChange={(coldVotes) => {
                  setAutoVotes(false);
                  patch({ coldVotes });
                }}
              />
              <Slider
                label="Group prefers"
                min={16}
                max={30}
                step={0.5}
                unit="°C"
                value={wantC}
                onChange={changeWant}
              />
              <button
                type="button"
                className="ghost"
                aria-pressed={autoVotes}
                onClick={toggleAutoVotes}
              >
                {autoVotes ? "Votes follow the group" : "Votes set by hand"}
              </button>
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
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function motionReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

function ScaleFormula({
  active,
  savedKw,
  rooms,
  roomsValue,
  onRoomsChange,
  onRoomsFocus,
}: {
  active: boolean;
  savedKw: number;
  rooms: number;
  roomsValue: string;
  onRoomsChange: (value: string) => void;
  onRoomsFocus: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [hours, setHours] = useState(1);
  const elapsedRef = useRef(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!active) {
      elapsedRef.current = 0;
      setPaused(false);
      setHours(1);
      return;
    }
    if (reduce) {
      setHours(YEAR_HOURS);
      return;
    }
    if (paused) {
      return;
    }
    const origin = performance.now() - elapsedRef.current;
    let frame = 0;
    const tick = (now: number) => {
      elapsedRef.current = now - origin;
      setHours(acceleratedHours(elapsedRef.current));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, paused, reduce]);

  const shownHours = active ? hours : 1;
  const dollars = scaleDollars(rooms, savedKw, SCALE_RATE, shownHours);
  const racing = active && !reduce && !paused;

  return (
    <div
      className="sim-scale"
      role="group"
      aria-label="Savings: rooms × kilowatts × dollars per kilowatt-hour × time"
    >
      <div className="sim-scale-row">
        <label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="1"
            aria-label="Rooms"
            value={roomsValue}
            onFocus={onRoomsFocus}
            onChange={(event) => onRoomsChange(event.target.value)}
          />
          <small>rooms</small>
        </label>
        <span aria-hidden="true">×</span>
        <span className="sim-scale-rate" title="Saved power this hour versus a 22°C baseline">
          {formatScaleKw(savedKw)}
        </span>
        <span aria-hidden="true">×</span>
        <span className="sim-scale-rate" title="LADWP R-1A Zone 1, Tier 1, November. The first 700 kWh of a simulator bill.">
          ${SCALE_RATE}/kWh
        </span>
        <span aria-hidden="true">×</span>
        <span className="sim-scale-time">
          <span>{formatScaleTime(shownHours)}</span>
          {active && !reduce ? (
            <button
              type="button"
              className="sim-scale-pause"
              aria-pressed={paused}
              onClick={() => setPaused((current) => !current)}
            >
              {paused ? "Resume" : "Pause"}
            </button>
          ) : null}
        </span>
        <span aria-hidden="true">=</span>
        <output
          className={dollars < 0 ? "spend" : "save"}
          aria-live={racing ? "off" : "polite"}
          aria-label="Scaled savings"
        >
          {formatScaleDollars(dollars)}
        </output>
      </div>
      <p className="sim-scale-note">If this hour&apos;s saving held for every room and every later hour.</p>
    </div>
  );
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
  const places = step >= 1 ? 0 : 1;
  const capped = Math.min(max, Math.max(min, value));
  let stepped = Number((Math.round(capped / step) * step).toFixed(places));
  if (stepped > max) {
    stepped = Number((stepped - step).toFixed(places));
  }
  if (stepped < min) {
    stepped = Number(Math.max(min, stepped).toFixed(places));
  }
  const shown = places === 0 ? String(stepped) : stepped.toFixed(1);
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
        value={stepped}
        aria-valuetext={`${shown} ${unit}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function SimulatorFallback(): ReactNode {
  return <p className="note">Loading the lab…</p>;
}
