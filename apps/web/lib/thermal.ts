import { fmtDeltaF, fmtF, toF } from "./units";

export type SpaceKind = "library" | "classroom";

export type HvacAction = "heat" | "cool" | "hold";

export type Season = "heating" | "cooling";

export type Scenario = {
  kind: SpaceKind;
  floorAreaM2: number;
  capacity: number;
  indoorC: number;
  outdoorC: number;
  humidityPct: number;
  occupancy: number;
  hotVotes: number;
  coldVotes: number;
  scheduledOpen: boolean;
  voteInfluenceC: number;
  deadbandC: number;
  lossWPerM2K: number;
  wattsPerPerson: number;
  hours: number;
};

export type Factor = {
  name: string;
  detail: string;
};

export type ThermalResult = {
  season: Season;
  perceivedC: number;
  humidityLiftC: number;
  comfortLowC: number;
  comfortHighC: number;
  midpointC: number;
  voteShiftC: number;
  voteTrust: number;
  peoplePresent: boolean;
  targetC: number;
  heatSetpointC: number;
  coolSetpointC: number;
  baselineSetpointC: number;
  action: HvacAction;
  summary: string;
  baselineKwh: number;
  adaptiveKwh: number;
  savedKwh: number;
  savedPct: number;
  peopleKw: number;
  envelopeKw: number;
  factors: Factor[];
  hours: number;
};

export const defaultAssumptions = {
  voteInfluenceC: 1.5,
  deadbandC: 0.5,
  lossWPerM2K: 1.8,
  wattsPerPerson: 100,
  hours: 1,
} as const;

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function comfortBand(kind: SpaceKind): { lowC: number; highC: number } {
  if (kind === "library") {
    return { lowC: 22, highC: 25 };
  }
  return { lowC: 21, highC: 24 };
}

function steadyState(
  targetC: number,
  scenario: Scenario,
): {
  kwh: number;
  envelopeKw: number;
  peopleKw: number;
} {
  const area = Math.max(0, finite(scenario.floorAreaM2));
  const loss = Math.max(0, finite(scenario.lossWPerM2K));
  const people = Math.max(0, finite(scenario.occupancy));
  const watts = Math.max(0, finite(scenario.wattsPerPerson));
  const hours = Math.max(0, finite(scenario.hours));
  const envelopeKw =
    (area * loss * (targetC - finite(scenario.outdoorC))) / 1000;
  const peopleKw = (people * watts) / 1000;
  const kwh = Math.abs(envelopeKw - peopleKw) * hours;
  return { kwh, envelopeKw, peopleKw };
}

export function evaluate(input: Scenario): ThermalResult {
  const scenario: Scenario = {
    ...input,
    floorAreaM2: Math.max(0, finite(input.floorAreaM2)),
    capacity: Math.max(0, finite(input.capacity)),
    indoorC: finite(input.indoorC),
    outdoorC: finite(input.outdoorC),
    humidityPct: clamp(finite(input.humidityPct), 0, 100),
    occupancy: Math.max(0, finite(input.occupancy)),
    hotVotes: Math.max(0, finite(input.hotVotes)),
    coldVotes: Math.max(0, finite(input.coldVotes)),
    voteInfluenceC: Math.max(0, finite(input.voteInfluenceC)),
    deadbandC: Math.max(0, finite(input.deadbandC, 0.5)),
    lossWPerM2K: Math.max(0, finite(input.lossWPerM2K)),
    wattsPerPerson: Math.max(0, finite(input.wattsPerPerson)),
    hours: Math.max(0, finite(input.hours, 1)),
  };

  const band = comfortBand(scenario.kind);
  const midpointC = (band.lowC + band.highC) / 2;
  const season: Season = scenario.outdoorC >= midpointC ? "cooling" : "heating";
  const humidityLiftC = Math.max(0, scenario.humidityPct - 55) * 0.05;
  const perceivedC = scenario.indoorC + humidityLiftC;
  const totalVotes = scenario.hotVotes + scenario.coldVotes;
  const peoplePresent = scenario.scheduledOpen && scenario.occupancy > 0;

  let voteShiftC = 0;
  let voteTrust = 0;
  const voteQuorum = Math.max(1, scenario.occupancy * 0.25);
  if (peoplePresent && totalVotes > 0) {
    const balance = (scenario.coldVotes - scenario.hotVotes) / totalVotes;
    voteTrust = Math.min(1, totalVotes / voteQuorum);
    voteShiftC = balance * scenario.voteInfluenceC * voteTrust;
  }

  const occupiedTargetC = clamp(midpointC + voteShiftC, band.lowC, band.highC);
  const awayTargetC = clamp(
    season === "cooling" ? band.highC + 2 : band.lowC - 2,
    16,
    28,
  );
  const targetC = peoplePresent ? occupiedTargetC : awayTargetC;
  const heatSetpointC = peoplePresent
    ? targetC - scenario.deadbandC
    : clamp(band.lowC - 2, 16, 28);
  const coolSetpointC = peoplePresent
    ? targetC + scenario.deadbandC
    : clamp(band.highC + 2, 16, 28);

  let action: HvacAction = "hold";
  if (perceivedC > coolSetpointC) {
    action = scenario.outdoorC < perceivedC ? "hold" : "cool";
  } else if (perceivedC < heatSetpointC) {
    action = scenario.outdoorC > perceivedC ? "hold" : "heat";
  }
  const drifting =
    (perceivedC > coolSetpointC && scenario.outdoorC < perceivedC) ||
    (perceivedC < heatSetpointC && scenario.outdoorC > perceivedC);

  const baseline = steadyState(midpointC, scenario);
  const adaptive = steadyState(targetC, scenario);
  const savedKwh = baseline.kwh - adaptive.kwh;
  const savedPct = baseline.kwh === 0 ? 0 : (savedKwh / baseline.kwh) * 100;

  const kindLabel = scenario.kind === "library" ? "Library" : "Classroom";
  const summary = summaryFor({
    peoplePresent,
    scheduledOpen: scenario.scheduledOpen,
    hotVotes: scenario.hotVotes,
    coldVotes: scenario.coldVotes,
    targetC,
    midpointC,
    action,
  });

  const factors: Factor[] = [
    {
      name: "Space type",
      detail: `${kindLabel} comfort band is ${toF(band.lowC).toFixed(0)}–${fmtF(band.highC, 0)}. A library sits warmer because people stay still. A classroom sits cooler.`,
    },
    {
      name: "Schedule and occupancy",
      detail: peoplePresent
        ? `${Math.round(scenario.occupancy)} people are in an open room, so the setpoint stays in the comfort band.`
        : scenario.scheduledOpen
          ? "The room is open but empty, so the setpoint sets back and votes wait."
          : "The room is closed, so votes are ignored and the setpoint sets back.",
    },
    {
      name: "Hot / cold votes",
      detail:
        !peoplePresent || totalVotes === 0
          ? "No vote is moving the setpoint."
          : `${Math.round(scenario.hotVotes)} hot and ${Math.round(scenario.coldVotes)} cold. Full influence needs ${Math.ceil(voteQuorum)} votes from the ${Math.round(scenario.occupancy)} people here, so this shift is ${Math.round(voteTrust * 100)}% of ${fmtDeltaF(scenario.voteInfluenceC)}.`,
    },
    {
      name: "Humidity",
      detail:
        humidityLiftC === 0
          ? `${Math.round(scenario.humidityPct)}% relative humidity is under 55%, so it does not change the feel of the room.`
          : `${Math.round(scenario.humidityPct)}% relative humidity adds ${fmtDeltaF(humidityLiftC)}. The model treats the room as ${fmtF(perceivedC, 1)}.`,
    },
    {
      name: "Outdoor temperature",
      detail: `${fmtF(scenario.outdoorC, 1)} is ${season === "cooling" ? "at or above" : "below"} the ${fmtF(midpointC, 1)} band middle, so this hour is ${season}.`,
    },
    {
      name: "People and the envelope",
      detail: `Bodies add ${adaptive.peopleKw.toFixed(2)} kW. Holding ${fmtF(targetC, 1)} against the outdoors is an envelope load of ${adaptive.envelopeKw.toFixed(2)} kW. HVAC covers the difference.`,
    },
    {
      name: "Deadband",
      detail: drifting
        ? `Perceived ${fmtF(perceivedC, 1)} is outside ${toF(heatSetpointC).toFixed(1)}–${fmtF(coolSetpointC)}, and the outdoor air will move it back. The live call is hold.`
        : `Perceived ${fmtF(perceivedC, 1)} against heat ${fmtF(heatSetpointC, 1)} and cool ${fmtF(coolSetpointC, 1)}. The live call is ${action}.`,
    },
  ];

  return {
    season,
    perceivedC,
    humidityLiftC,
    comfortLowC: band.lowC,
    comfortHighC: band.highC,
    midpointC,
    voteShiftC,
    voteTrust,
    peoplePresent,
    targetC,
    heatSetpointC,
    coolSetpointC,
    baselineSetpointC: midpointC,
    action,
    summary,
    baselineKwh: baseline.kwh,
    adaptiveKwh: adaptive.kwh,
    savedKwh,
    savedPct,
    peopleKw: adaptive.peopleKw,
    envelopeKw: adaptive.envelopeKw,
    factors,
    hours: scenario.hours,
  };
}

function summaryFor(input: {
  peoplePresent: boolean;
  scheduledOpen: boolean;
  hotVotes: number;
  coldVotes: number;
  targetC: number;
  midpointC: number;
  action: HvacAction;
}): string {
  const target = fmtF(input.targetC);
  const call = `The live call is ${input.action}.`;
  if (!input.peoplePresent) {
    const why = input.scheduledOpen
      ? "The room is empty"
      : "The room is closed";
    return `${why}, so the setpoint sets back to ${target} instead of ${fmtF(input.midpointC, 1)}. ${call}`;
  }
  if (input.hotVotes + input.coldVotes === 0) {
    return `Nobody has voted, so the setpoint stays at ${target}. ${call}`;
  }
  if (input.hotVotes === input.coldVotes) {
    return `Votes are split, so the setpoint stays near ${target}. ${call}`;
  }
  const lean =
    input.hotVotes > input.coldVotes ? "Hot votes lead" : "Cold votes lead";
  return `${lean}, so the setpoint moves to ${target}. ${call}`;
}

export function energyDeltaLabel(savedKwh: number): string {
  if (savedKwh > 0.005) {
    return `${savedKwh.toFixed(2)} kWh saved`;
  }
  if (savedKwh < -0.005) {
    return `${Math.abs(savedKwh).toFixed(2)} kWh more`;
  }
  return "about the same";
}

export function savingsCopy(result: ThermalResult): string {
  const base = result.baselineKwh.toFixed(2);
  const next = result.adaptiveKwh.toFixed(2);
  const hours =
    result.hours === 1 ? "this hour" : `these ${result.hours} hours`;
  if (Math.abs(result.savedKwh) < 0.005) {
    return `A fixed setpoint and this policy both use about ${base} kWh ${hours}.`;
  }
  if (result.savedKwh > 0) {
    return `A fixed ${fmtF(result.baselineSetpointC, 1)} setpoint would use ${base} kWh ${hours}. This policy would use ${next} kWh. That saves ${result.savedKwh.toFixed(2)} kWh (${Math.round(result.savedPct)}%).`;
  }
  return `A fixed ${fmtF(result.baselineSetpointC, 1)} setpoint would use ${base} kWh ${hours}. This policy would use ${next} kWh. That is ${Math.abs(result.savedKwh).toFixed(2)} kWh more, spent on comfort.`;
}
