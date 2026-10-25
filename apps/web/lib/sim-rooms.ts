import { defaultAssumptions, type Scenario, type SpaceKind } from "./thermal";

/**
 * Rooms for the simulator: fixed floor area and capacity, and a weekly timetable. Each class
 * is a group of people with its own preferred temperature, so stepping through the week shows
 * the model meeting different groups, learning each one, and recognising it the next week.
 * The first four ids match lib/campus.ts so the campus view can open them. Demo data.
 */

export type SimClass = {
  id: string;
  name: string;
  day: number; // 0 = Monday
  start: number; // hour, local time
  hours: number;
  people: number;
  prefersC: number; // the room temperature this group likes (median of its people)
};

export type SimRoom = {
  id: string;
  name: string;
  building: string;
  kind: SpaceKind;
  floorAreaM2: number;
  capacity: number;
  note: string;
  classes: SimClass[];
};

/** Monday of week 1. */
export const WEEK0 = "2026-11-02";

const c = (id: string, name: string, days: number[], start: number, hours: number, people: number, prefersC: number): SimClass[] =>
  days.map((day) => ({ id: `${id}-${day}`, name, day, start, hours, people, prefersC }));

/** One week of classes, listed in time order (Monday first). */
const week = (...lists: SimClass[][]): SimClass[] => lists.flat().sort((a, b) => a.day - b.day || a.start - b.start);

/*
 * Back-to-back classes differ by at least a third in head count, so the model sees a new
 * group walk in rather than the same one staying on.
 */
export const simRooms: SimRoom[] = [
  {
    id: "leavey-reading",
    name: "Reading Room",
    building: "Leavey Library",
    kind: "library",
    floorAreaM2: 640,
    capacity: 180,
    note: "Study blocks all week. Same room, different crowds: the model keeps a separate taste for each.",
    classes: week(
      c("study-am", "Morning study", [0, 1, 2, 3, 4], 9, 3, 70, 25),
      c("study-pm", "Afternoon study", [0, 1, 2, 3, 4], 14, 3, 140, 24.5),
      c("study-eve", "Evening cram", [0, 1, 2, 3], 19, 3, 110, 23.5),
      c("study-sat", "Weekend study", [5], 11, 4, 40, 25.5),
    ),
  },
  {
    id: "doheny-2",
    name: "Second Floor",
    building: "Doheny Memorial Library",
    kind: "library",
    floorAreaM2: 420,
    capacity: 90,
    note: "Quiet floor. The daytime groups like it warm, so the AC learns to work less.",
    classes: week(
      c("grad-reading", "Grad reading", [0, 2, 4], 9, 3, 30, 25),
      c("stacks", "Quiet stacks", [1, 3], 10, 4, 45, 26),
      c("stacks-eve", "Evening stacks", [0, 1, 2, 3], 18, 3, 60, 24.5),
    ),
  },
  {
    id: "thh-201",
    name: "THH 201",
    building: "Taper Hall",
    kind: "classroom",
    floorAreaM2: 140,
    capacity: 40,
    note: "A full teaching room. WRIT 150 and MATH 125 run back to back with opposite tastes: the model has to tell them apart.",
    classes: week(
      c("writ150", "WRIT 150", [0, 2], 9, 2, 36, 23),
      c("math125", "MATH 125", [0, 2], 11, 1, 22, 26),
      c("econ351", "ECON 351", [0, 2], 14, 2, 38, 22.5),
      c("psyc100", "PSYC 100", [1, 3], 9, 2, 32, 24),
      c("span120", "SPAN 120", [1, 3], 12, 2, 25, 24.5),
      c("buad304", "BUAD 304", [1, 3], 16, 2, 40, 23.5),
      c("ctwr101", "CTWR 101", [4], 10, 3, 18, 25.5),
    ),
  },
  {
    id: "sal-127",
    name: "SAL 127",
    building: "Salvatori",
    kind: "classroom",
    floorAreaM2: 110,
    capacity: 30,
    note: "Computer lab. The evening CSCI 270 section likes it cold: the model gives them what they ask for, and that costs energy.",
    classes: week(
      c("csci104", "CSCI 104 lab", [0, 2], 10, 2, 28, 23.5),
      c("ee109", "EE 109", [0, 2], 14, 2, 20, 24.5),
      c("itp115", "ITP 115", [1, 3], 12, 2, 24, 24),
      c("csci270", "CSCI 270", [1, 3], 18, 2, 26, 22),
      c("hack-club", "Hack club", [4], 15, 3, 16, 23),
    ),
  },
  {
    id: "sgm-124",
    name: "SGM 124",
    building: "Seeley G. Mudd",
    kind: "classroom",
    floorAreaM2: 420,
    capacity: 300,
    note: "Large lecture hall. Hundreds of people make a lot of heat, so the AC sits far below the room temperature and each degree saved is worth many kWh.",
    classes: week(
      c("bisc120", "BISC 120", [0, 2], 10, 2, 260, 25),
      c("chem105", "CHEM 105", [0, 2], 13, 2, 220, 24),
      c("phys151", "PHYS 151", [1, 3], 10, 2, 150, 25.5),
      c("econ203", "ECON 203", [1, 3], 14, 2, 180, 24.5),
      c("gesm", "GESM forum", [4], 9, 2, 120, 24),
    ),
  },
  {
    id: "kap-160",
    name: "KAP 160",
    building: "Kaprielian Hall",
    kind: "classroom",
    floorAreaM2: 60,
    capacity: 20,
    note: "Seminar room. Under 15 people is a drop-in hour with no group memory; 15 or more is a group.",
    classes: week(
      c("reading-group", "Reading group", [0, 2], 13, 2, 16, 24.5),
      c("office", "Office hours", [1, 2], 15, 2, 9, 24),
      c("seminar", "Grad seminar", [3], 11, 2, 18, 25.5),
      c("thesis", "Thesis meeting", [4], 10, 2, 6, 23),
    ),
  },
];

export function getSimRoom(id: string): SimRoom | undefined {
  return simRooms.find((room) => room.id === id);
}

const z = (v: number) => String(v).padStart(2, "0");

function parse(at: string): { dayIndex: number; hour: number } {
  const days = Math.round((Date.parse(`${at.slice(0, 10)}T00:00Z`) - Date.parse(`${WEEK0}T00:00Z`)) / 86_400_000);
  return { dayIndex: days, hour: Number(at.slice(11, 13)) };
}

function stamp(dayIndex: number, hour: number): string {
  const d = new Date(Date.parse(`${WEEK0}T00:00Z`) + dayIndex * 86_400_000);
  return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}T${z(hour)}:00`;
}

/** The class in session at this hour, if any. */
export function classAt(room: SimRoom, at: string): SimClass | null {
  const { dayIndex, hour } = parse(at);
  const day = ((dayIndex % 7) + 7) % 7;
  return room.classes.find((k) => k.day === day && hour >= k.start && hour < k.start + k.hours) ?? null;
}

/** The next hour after `at` with a class in session (empty hours are skipped). */
export function nextClassHour(room: SimRoom, at: string): string {
  const { dayIndex, hour } = parse(at);
  for (let step = 1; step <= 24 * 14; step++) {
    const h = hour + step;
    const next = stamp(dayIndex + Math.floor(h / 24), h % 24);
    if (classAt(room, next)) return next;
  }
  return stamp(dayIndex, hour + 1);
}

/** When the class running at `at` started (or `at` itself outside class). */
export function classStartAt(room: SimRoom, at: string): string {
  const k = classAt(room, at);
  if (!k) return at;
  return stamp(parse(at).dayIndex, k.start);
}

/** The first class of week 1. */
export function firstClassAt(room: SimRoom): string {
  return nextClassHour(room, `${WEEK0}T00:00`);
}

/** This class's start in the same week as `at`. */
export function classInWeek(k: SimClass, at: string): string {
  const { dayIndex } = parse(at);
  const monday = dayIndex - (((dayIndex % 7) + 7) % 7);
  return stamp(monday + k.day, k.start);
}

export function weekLabel(at: string): string {
  const { dayIndex } = parse(at);
  return `Week ${Math.floor(dayIndex / 7) + 1}`;
}

/** The scenario the simulator shows for this room and hour (closed when no class). Outdoor and humidity are fixed demo values. */
export function scenarioFor(room: SimRoom, k: SimClass | null, indoorC: number): Scenario {
  return {
    kind: room.kind,
    floorAreaM2: room.floorAreaM2,
    capacity: room.capacity,
    indoorC,
    outdoorC: 27,
    humidityPct: 50,
    occupancy: Math.min(room.capacity, k ? k.people : 0),
    hotVotes: 0,
    coldVotes: 0,
    scheduledOpen: k !== null, // empty room: the AC sets back
    ...defaultAssumptions,
  };
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function classLabel(k: SimClass): string {
  return `${DAYS[k.day]} ${z(k.start)}:00 · ${k.name} · ${k.people} people`;
}
