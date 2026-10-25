"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  getSpace,
  simulatorPresets,
  spaces,
  scenarioFrom,
} from "../lib/campus";
import { type Scenario, type SpaceKind } from "../lib/thermal";
import { RoomModel } from "../lib/ac-model";
import {
  clockLabel,
  evaluateWithModel,
  roomAtC,
  shiftClock,
  simulatedVotes,
} from "../lib/model-sim";
import { ModelPanel, type HourLog } from "./sim/model-panel";
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

const opening = simulatorPresets[0]!;

// The model's clock starts on a Wednesday morning; "Same time next week" returns here.
const START_AT = "2026-11-04T09:00";
// Read-only stand-in until a room has been stepped (preview never changes it).
const UNTRAINED = new RoomModel();

type Track = { room: RoomModel; at: string; weekStart: string; history: HourLog[] };

export function SimulatorView() {
  const params = useSearchParams();
  const campus = useCampus();
  const [scenario, setScenario] = useState<Scenario>(opening.scenario);
  const [mode, setMode] = useState<SimMode>("room");
  const [pick, setPick] = useState<SimPick | null>(null);
  const [factorsOpen, setFactorsOpen] = useState(true);
  const [spaceId, setSpaceId] = useState(opening.spaceId);
  const [presetId, setPresetId] = useState<string | null>(opening.id);
  const [playLabel, setPlayLabel] = useState<PlayLabel>("play");
  const [progress, setProgress] = useState(0);
  const [personVotes, setPersonVotes] = useState<PersonVote[] | null>(null);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [wantC, setWantC] = useState(21);
  const [autoVotes, setAutoVotes] = useState(true);
  const applied = useRef(false);
  const scenarioRef = useRef(scenario);
  const storyRef = useRef<StoryClock | null>(null);
  const easeRef = useRef<EaseClock | null>(null);
  const playingRef = useRef(false);
  const loopRef = useRef(0);
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
    if (!campus.ready || applied.current) {
      return;
    }
    applied.current = true;
    const id = params.get("space");
    if (!id) {
      return;
    }
    const space = getSpace(id);
    const reading = campus.readings[id];
    if (!space || !reading) {
      return;
    }
    const next = settle(scenarioFrom(space, reading));
    storyRef.current = null;
    easeRef.current = null;
    playingRef.current = false;
    setPlayLabel("play");
    setProgress(0);
    setSpaceId(id);
    setPresetId(presetFor(next, id));
    showRef.current(next);
  }, [campus.ready, campus.readings, params]);

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

  const track = tracks[spaceId];
  const clockAt = track?.at ?? START_AT;
  const result = evaluateWithModel(scenario, track?.room ?? UNTRAINED, clockAt);

  function trackFor(id: string): Track {
    return tracks[id] ?? { room: new RoomModel(), at: START_AT, weekStart: START_AT, history: [] };
  }

  /** The model learns from this hour; the room reacts and the same people vote again. */
  function nextHour() {
    const s = scenarioRef.current;
    const t = trackFor(spaceId);
    const open = s.scheduledOpen;
    const hot = open ? Math.round(s.hotVotes) : 0;
    const cold = open ? Math.round(s.coldVotes) : 0;
    const d = t.room.update(open ? s.occupancy : 0, hot, cold, t.at);
    const setpointC = open ? d.setpointC : 28;
    const roomC = roomAtC(setpointC, s);
    const log: HourLog = {
      at: t.at,
      label: clockLabel(t.at, START_AT),
      people: Math.round(s.occupancy),
      hot,
      cold,
      setpointC,
      roomC,
      wantC: autoVotes ? wantC : null,
      group: d.group ? `G${String(d.group.gid).padStart(2, "0")}` : "drop-in",
    };
    setTracks({
      ...tracks,
      [spaceId]: { ...t, at: shiftClock(t.at, 1), history: [...t.history, log].slice(-48) },
    });
    const votes = autoVotes ? simulatedVotes(roomC, wantC, s.occupancy) : { hotVotes: 0, coldVotes: 0 };
    clearStory();
    setPresetId(null);
    setPersonVotes(null);
    showRef.current({ ...s, indoorC: Number(roomC.toFixed(1)), ...votes });
  }

  /** The same class walks in a week later: the model already knows what they like. */
  function nextWeek() {
    const s = scenarioRef.current;
    const t = trackFor(spaceId);
    const at = shiftClock(t.weekStart, 24 * 7);
    const startC = t.room.preview(s.scheduledOpen ? s.occupancy : 0, 0, 0, at).startC;
    const roomC = roomAtC(startC, s);
    setTracks({ ...tracks, [spaceId]: { ...t, at, weekStart: at } });
    const votes = autoVotes ? simulatedVotes(roomC, wantC, s.occupancy) : { hotVotes: 0, coldVotes: 0 };
    clearStory();
    setPresetId(null);
    setPersonVotes(null);
    showRef.current({ ...s, indoorC: Number(roomC.toFixed(1)), ...votes });
  }

  function resetModel() {
    const rest = { ...tracks };
    delete rest[spaceId];
    setTracks(rest);
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
    setPresetId(null);
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
    setPresetId(null);
    showRef.current({ ...scenarioRef.current, ...partial });
  }

  function focusScenario(
    next: Scenario,
    nextSpaceId: string,
    nextPresetId: string | null,
  ) {
    setSpaceId(nextSpaceId);
    setPresetId(nextPresetId);
    setPick(null);
    setMode("room");
    easeTo(next);
  }

  function showMode(next: SimMode) {
    if (next === "campus") {
      pausePlayback();
    }
    setMode(next);
    setPick(null);
  }

  function openSpace(id: string) {
    const space = getSpace(id);
    const reading = campus.readings[id];
    if (!space || !reading) {
      return;
    }
    const next = scenarioFrom(space, reading);
    focusScenario(next, id, presetFor(next, id));
  }

  function openPreset(id: string) {
    const preset = simulatorPresets.find((item) => item.id === id);
    if (!preset) {
      return;
    }
    focusScenario(preset.scenario, preset.spaceId, preset.id);
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
        />
      </div>
      <div className="sim-overlay">
        <div className="sim-top">
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
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="sim-select">
              <span>Scenario</span>
              <select
                value={presetId ?? ""}
                onChange={(event) => openPreset(event.target.value)}
              >
                {presetId ? null : (
                  <option value="" disabled>
                    Custom
                  </option>
                )}
                {simulatorPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <button
          type="button"
          className="ghost sim-factors"
          aria-expanded={factorsOpen}
          onClick={() => setFactorsOpen((open) => !open)}
        >
          {factorsOpen ? "Hide factors" : "Factors"}
        </button>
        <div className="sim-dock">
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
                clock={clockLabel(clockAt, START_AT)}
                result={result}
                history={track?.history ?? []}
                onNextHour={nextHour}
                onNextWeek={nextWeek}
                onReset={resetModel}
              />
            ) : null}
            <div className="result-card">
              <ResultBlock result={result} />
            </div>
          </div>
        </div>
        {factorsOpen ? (
          <aside className="sim-drawer" aria-label="Scenario factors">
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

function sameScenario(a: Scenario, b: Scenario): boolean {
  return (Object.keys(a) as (keyof Scenario)[]).every((key) => a[key] === b[key]);
}

function presetFor(next: Scenario, id: string): string | null {
  return (
    simulatorPresets.find(
      (preset) => preset.spaceId === id && sameScenario(preset.scenario, next),
    )?.id ?? null
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
