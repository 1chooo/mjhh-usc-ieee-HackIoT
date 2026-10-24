import {
  defaultAssumptions,
  evaluate,
  type Scenario,
  type SpaceKind,
  type ThermalResult,
} from "./thermal";

export type Vote = "hot" | "cold";

export type Space = {
  id: string;
  name: string;
  building: string;
  kind: SpaceKind;
  floorAreaM2: number;
  capacity: number;
  note: string;
};

export type Reading = {
  indoorC: number;
  outdoorC: number;
  humidityPct: number;
  occupancy: number;
  hotVotes: number;
  coldVotes: number;
  scheduledOpen: boolean;
};

export type CampusState = {
  readings: Record<string, Reading>;
  myVotes: Record<string, Vote>;
};

export const spaces: Space[] = [
  {
    id: "leavey-reading",
    name: "Reading Room",
    building: "Leavey Library",
    kind: "library",
    floorAreaM2: 640,
    capacity: 180,
    note: "Long sits and low activity. The comfort band sits warmer than a classroom.",
  },
  {
    id: "doheny-2",
    name: "Second Floor",
    building: "Doheny Memorial Library",
    kind: "library",
    floorAreaM2: 420,
    capacity: 90,
    note: "Quiet stacks. Votes here should only nudge the setpoint when enough people answer.",
  },
  {
    id: "thh-201",
    name: "THH 201",
    building: "Taper Hall",
    kind: "classroom",
    floorAreaM2: 140,
    capacity: 40,
    note: "Lecture room. A cold vote means the cooling can relax.",
  },
  {
    id: "sal-127",
    name: "SAL 127",
    building: "Salvatori",
    kind: "classroom",
    floorAreaM2: 110,
    capacity: 30,
    note: "Evening section. After the room closes, the setpoint sets back.",
  },
];

const outdoorC = 27;

export const defaultReadings: Record<string, Reading> = {
  "leavey-reading": {
    indoorC: 24.8,
    outdoorC,
    humidityPct: 58,
    occupancy: 72,
    hotVotes: 14,
    coldVotes: 3,
    scheduledOpen: true,
  },
  "doheny-2": {
    indoorC: 23.4,
    outdoorC,
    humidityPct: 48,
    occupancy: 22,
    hotVotes: 2,
    coldVotes: 2,
    scheduledOpen: true,
  },
  "thh-201": {
    indoorC: 21.4,
    outdoorC,
    humidityPct: 46,
    occupancy: 36,
    hotVotes: 1,
    coldVotes: 12,
    scheduledOpen: true,
  },
  "sal-127": {
    indoorC: 22.6,
    outdoorC,
    humidityPct: 44,
    occupancy: 0,
    hotVotes: 0,
    coldVotes: 0,
    scheduledOpen: false,
  },
};

export function getSpace(id: string): Space | undefined {
  return spaces.find((space) => space.id === id);
}

export function defaultCampusState(): CampusState {
  return {
    readings: structuredClone(defaultReadings),
    myVotes: {},
  };
}

export function scenarioFrom(space: Space, reading: Reading): Scenario {
  return {
    kind: space.kind,
    floorAreaM2: space.floorAreaM2,
    capacity: space.capacity,
    indoorC: reading.indoorC,
    outdoorC: reading.outdoorC,
    humidityPct: reading.humidityPct,
    occupancy: reading.occupancy,
    hotVotes: reading.hotVotes,
    coldVotes: reading.coldVotes,
    scheduledOpen: reading.scheduledOpen,
    ...defaultAssumptions,
  };
}

export function evaluateSpace(space: Space, reading: Reading): ThermalResult {
  return evaluate(scenarioFrom(space, reading));
}

export const simulatorPresets: {
  id: string;
  label: string;
  spaceId: string;
  scenario: Scenario;
}[] = [
  {
    id: "warm-reading-room",
    label: "Warm reading room",
    spaceId: "leavey-reading",
    scenario: scenarioFrom(spaces[0]!, defaultReadings["leavey-reading"]!),
  },
  {
    id: "overcooled-lecture",
    label: "Overcooled lecture",
    spaceId: "thh-201",
    scenario: scenarioFrom(spaces[2]!, defaultReadings["thh-201"]!),
  },
  {
    id: "empty-classroom",
    label: "Empty classroom",
    spaceId: "sal-127",
    scenario: scenarioFrom(spaces[3]!, defaultReadings["sal-127"]!),
  },
  {
    id: "humid-stacks",
    label: "Humid stacks",
    spaceId: "doheny-2",
    scenario: {
      ...scenarioFrom(spaces[1]!, defaultReadings["doheny-2"]!),
      humidityPct: 72,
      indoorC: 24.2,
      hotVotes: 9,
      coldVotes: 1,
      occupancy: 18,
    },
  },
];
