import { RoomModel } from "./ac-model";
import type { Scenario } from "./thermal";
import { BASELINE_AC_C, SETBACK_C, hourKwh, roomAtC, shiftClock, simulatedVotes } from "./model-sim";
import { classAt, scenarioFor, weekLabel, type SimRoom } from "./sim-rooms";
import { addHour, NO_TOTALS, type EnergyTotals } from "./billing";
import type { HourLog } from "../components/sim/model-panel";

/** Stepping a simulated room through time, one hour at a time. No React state in here. */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const round1 = (v: number) => Number(v.toFixed(1));
export const noVotes = { hotVotes: 0, coldVotes: 0 };

export function clockText(at: string): string {
  const day = (new Date(`${at.slice(0, 10)}T00:00Z`).getUTCDay() + 6) % 7;
  return `${weekLabel(at)} · ${DAY_NAMES[day]} ${at.slice(11, 16)}`;
}

/**
 * The room at `at`: this hour's class walks in and the AC is at what the model plans for
 * them. Outdoor, humidity and the heat sliders carry over from `keep`.
 */
export function arrival(def: SimRoom, model: RoomModel, at: string, keep: Scenario | null, autoVotes: boolean) {
  const k = classAt(def, at);
  const fresh = scenarioFor(def, k, 24);
  const base: Scenario = keep
    ? {
        ...fresh,
        outdoorC: keep.outdoorC,
        humidityPct: keep.humidityPct,
        wattsPerPerson: keep.wattsPerPerson,
        lossWPerM2K: keep.lossWPerM2K,
        hours: keep.hours,
      }
    : fresh;
  const startC = model.preview(base.occupancy, 0, 0, at).startC;
  const indoorC = round1(roomAtC(startC, base));
  const wantC = k?.prefersC ?? 24;
  const votes = autoVotes ? simulatedVotes(indoorC, wantC, base.occupancy) : noVotes;
  return { scenario: { ...base, indoorC, ...votes }, wantC };
}

/** Let the model learn from the hour at `at` with the room as `s` shows it. */
export function commit(def: SimRoom, room: RoomModel, s: Scenario, at: string, want: number | null) {
  const open = s.scheduledOpen;
  const hot = open ? Math.round(s.hotVotes) : 0;
  const cold = open ? Math.round(s.coldVotes) : 0;
  const d = room.update(open ? s.occupancy : 0, hot, cold, at);
  const setpointC = open ? d.setpointC : SETBACK_C;
  const roomC = roomAtC(setpointC, s);
  const log: HourLog = {
    at,
    label: clockText(at),
    people: Math.round(s.occupancy),
    hot,
    cold,
    setpointC,
    roomC,
    wantC: want,
    group: !open ? "empty" : d.group ? `G${String(d.group.gid).padStart(2, "0")}` : "drop-in",
    className: classAt(def, at)?.name ?? "No class",
    fixedKwh: hourKwh(roomAtC(BASELINE_AC_C, s), s),
    modelKwh: hourKwh(roomC, s),
  };
  return { log, roomC };
}

/**
 * The model learns from the hour at `at`, then the clock moves on one hour. The class goes on
 * (votes follow the new room temperature), the next class walks in, or the room is empty
 * and the AC sets back.
 */
export function step(def: SimRoom, room: RoomModel, s: Scenario, at: string, want: number, autoVotes: boolean) {
  const { log, roomC } = commit(def, room, s, at, autoVotes ? want : null);
  const k = classAt(def, at);
  const nextAt = shiftClock(at, 1);
  const sameClass = k !== null && classAt(def, nextAt)?.id === k.id;
  const next = sameClass
    ? { scenario: { ...s, indoorC: round1(roomC), ...(autoVotes ? simulatedVotes(roomC, want, s.occupancy) : noVotes) }, wantC: want }
    : arrival(def, room, nextAt, s, autoVotes);
  return { log, nextAt, next };
}

/** Hours the scale-up estimate looks ahead: eight weeks, about one two-month bill. */
export const PROJECTION_HOURS = 24 * 7 * 8;

/**
 * Dollars one room saves per day: the next eight weeks run on a copy of the model (so the
 * real one is untouched), billed with LADWP two-month bills, divided by the days.
 */
export function dailySavingsUsd(def: SimRoom, model: RoomModel, at: string, keep: Scenario): number {
  const room = new RoomModel();
  room.load(model.save());
  let current = arrival(def, room, at, keep, true);
  let clock = at;
  let totals: EnergyTotals = NO_TOTALS;
  for (let h = 0; h < PROJECTION_HOURS; h++) {
    const r = step(def, room, current.scenario, clock, current.wantC, true);
    totals = addHour(totals, clock, r.log.fixedKwh, r.log.modelKwh);
    clock = r.nextAt;
    current = r.next;
  }
  const saved = totals.bills.reduce((sum, b) => sum + b.fixedCost - b.modelCost, 0);
  return saved / (PROJECTION_HOURS / 24);
}
