import { clamp, type Scenario } from "../../lib/thermal";

export const STORY_MS = 12_000;
export const EASE_MS = 700;

export type StorySample = {
  occupancy: number;
  hotVotes: number;
  coldVotes: number;
  indoorC: number;
  scheduledOpen: boolean;
};

const numericKeys = [
  "floorAreaM2",
  "capacity",
  "indoorC",
  "outdoorC",
  "humidityPct",
  "occupancy",
  "hotVotes",
  "coldVotes",
  "voteInfluenceC",
  "deadbandC",
  "lossWPerM2K",
  "wattsPerPerson",
  "hours",
] as const satisfies readonly (keyof Scenario)[];

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function phase(t: number, start: number, end: number): number {
  if (t <= start) {
    return 0;
  }
  if (t >= end) {
    return 1;
  }
  return smoothstep((t - start) / (end - start));
}

function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function indoorStart(endC: number): number {
  const offset = endC > 24 ? -2 : 2;
  return clamp(endC + offset, 16, 32);
}

export function storyStart(end: Scenario): StorySample {
  if (end.occupancy > 0) {
    return {
      occupancy: 0,
      hotVotes: 0,
      coldVotes: 0,
      indoorC: indoorStart(end.indoorC),
      scheduledOpen: true,
    };
  }
  const occupancy = Math.round(Math.max(0, end.capacity) * 0.6);
  const hotVotes = Math.round(occupancy * 0.45);
  const coldVotes = Math.min(
    Math.round(occupancy * 0.15),
    Math.max(0, occupancy - hotVotes),
  );
  return {
    occupancy,
    hotVotes,
    coldVotes,
    indoorC: indoorStart(end.indoorC),
    scheduledOpen: true,
  };
}

export function sampleStory(end: Scenario, t: number): StorySample {
  const time = clamp(t, 0, 1);
  if (time >= 1) {
    return {
      occupancy: end.occupancy,
      hotVotes: end.hotVotes,
      coldVotes: end.coldVotes,
      indoorC: end.indoorC,
      scheduledOpen: end.scheduledOpen,
    };
  }
  const start = storyStart(end);
  const leaving = end.occupancy <= 0;
  const people = phase(time, 0, leaving ? 0.55 : 0.45);
  const votes = phase(time, leaving ? 0.2 : 0.35, leaving ? 0.7 : 0.75);
  const temperature = phase(time, 0.15, 1);
  const occupancy = mix(start.occupancy, end.occupancy, people);
  let scheduledOpen = end.scheduledOpen;
  if (!end.scheduledOpen) {
    scheduledOpen = leaving ? occupancy > 0.5 : !(time >= 0.85 && people >= 1);
  }
  return {
    occupancy,
    hotVotes: mix(start.hotVotes, end.hotVotes, votes),
    coldVotes: mix(start.coldVotes, end.coldVotes, votes),
    indoorC: mix(start.indoorC, end.indoorC, temperature),
    scheduledOpen,
  };
}

export function lerpScenario(from: Scenario, to: Scenario, t: number): Scenario {
  const blended = smoothstep(t);
  const next: Scenario = { ...to };
  for (const key of numericKeys) {
    next[key] = mix(from[key], to[key], blended);
  }
  if (next.capacity < next.occupancy) {
    next.capacity = next.occupancy;
  }
  return next;
}
