import { RoomModel, type Decision } from "./ac-model";
import { evaluate, type Factor, type HvacAction, type Scenario, type ThermalResult } from "./thermal";

/** Reference room temperature for the cooling-load estimate. */
export const FIXED_SETPOINT_C = 24;

/** The comparison: an AC left at 22°C all day, the way many campus rooms are run. */
export const BASELINE_AC_C = 22;

/** Where the AC sits while the room is empty. */
export const SETBACK_C = 26;

/**
 * How much warmer than the AC setpoint the room ends up with these people in it. Same premise
 * as the model's starting curve (26 C is enough for one person, 18 C for 300, so the room sits
 * at 24 C), scaled by the heat from one person.
 */
export function heatLiftC(s: Scenario): number {
  const people = Math.max(0, s.occupancy);
  return -2 + ((8 * Math.max(0, people - 1)) / 299) * (s.wattsPerPerson / 100);
}

export const roomAtC = (setpointC: number, s: Scenario) => setpointC + heatLiftC(s);

function normalCdf(z: number): number {
  // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const erf = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
    * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/**
 * Votes from a group whose preferred temperatures centre on wantC (spread 2 C). Someone votes
 * hot when the room is more than 1 C above their own preference, cold when more than 1 C below,
 * and half of the uncomfortable people vote.
 */
export function simulatedVotes(roomC: number, wantC: number, people: number, share = 0.5) {
  const n = Math.max(0, Math.round(people));
  const pHot = normalCdf((roomC - 1 - wantC) / 2);
  const pCold = 1 - normalCdf((roomC + 1 - wantC) / 2);
  const hot = Math.round(n * share * pHot);
  const cold = Math.min(Math.round(n * share * pCold), n - hot);
  return { hotVotes: hot, coldVotes: Math.max(0, cold) };
}

/**
 * Published numbers behind the energy estimate (demo values, not a metered building):
 * - Cooling energy falls about 10% for each 1°C warmer setpoint. Hoyt, Arens & Zhang (2015),
 *   Building and Environment 88: raising 22.2°C to 25°C saved 29% of cooling energy on average
 *   across seven US climates. Cardiff (8%/°C) and de Chalendar et al. (2023, Energy and
 *   Buildings 278: 13-28% per 2°F in offices) bracket it.
 * - One seated person adds about 72 W sensible + 45 W latent heat (ASHRAE Fundamentals,
 *   "seated, very light work"), so the cooling load grows with the people in the room.
 * - Lights and plug loads about 10 W/m²; chiller COP 3; 0.4 kg CO₂e/kWh. Dollars: lib/billing.ts.
 */
export const ENERGY = {
  savingPerC: 0.1,
  sensibleW: 72,
  latentW: 45,
  internalWPerM2: 10,
  cop: 3,
  kgCo2PerKwh: 0.4,
} as const;

/** Heat the AC has to remove this hour at the 24°C reference, in kW (thermal). */
export function coolingLoadKw(s: Scenario): number {
  const people = Math.max(0, s.occupancy) * (ENERGY.sensibleW + ENERGY.latentW);
  const internal = Math.max(0, s.floorAreaM2) * ENERGY.internalWPerM2;
  const envelope = Math.max(0, s.floorAreaM2) * Math.max(0, s.lossWPerM2K) * Math.max(0, s.outdoorC - FIXED_SETPOINT_C);
  return (people + internal + envelope) / 1000;
}

/**
 * Electricity for this hour with the room held at roomC. The studies measure the room
 * (thermostat) temperature, so the comparison is a thermostat holding the room at 24°C:
 * each 1°C warmer room uses 10% less, each 1°C cooler 10% more.
 */
export function hourKwh(roomC: number, s: Scenario): number {
  const factor = (1 - ENERGY.savingPerC) ** (roomC - FIXED_SETPOINT_C);
  return (coolingLoadKw(s) / ENERGY.cop) * factor * Math.max(0, s.hours);
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const signed = (v: number) => (Math.abs(v) < 0.05 ? "±0.0" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`);

export type ModelResult = ThermalResult & {
  model: Decision;
  roomAfterC: number;
  closed: boolean;
};

/**
 * What the model would set the AC to this hour, shown in the simulator's result shape.
 * `room` is not changed: this is a preview. Season, humidity and the perceived temperature
 * still come from the sensor readings as before.
 */
export function evaluateWithModel(s: Scenario, room: RoomModel, at: string): ModelResult {
  const base = evaluate(s);
  const hot = Math.round(Math.max(0, s.hotVotes));
  const cold = Math.round(Math.max(0, s.coldVotes));
  const decision = room.preview(s.scheduledOpen ? s.occupancy : 0, s.scheduledOpen ? hot : 0, s.scheduledOpen ? cold : 0, at);
  const targetC = s.scheduledOpen ? decision.setpointC : SETBACK_C; // closed: set back
  const roomAfterC = roomAtC(targetC, s);
  const deadband = 0.5;
  let action: HvacAction = "hold";
  if (base.season === "cooling" && base.perceivedC > roomAfterC + deadband) action = "cool";
  if (base.season === "heating" && base.perceivedC < roomAfterC - deadband) action = "heat";

  const baselineKwh = hourKwh(roomAtC(BASELINE_AC_C, s), s);
  const adaptiveKwh = hourKwh(roomAfterC, s);
  const savedKwh = baselineKwh - adaptiveKwh;
  const people = Math.round(s.occupancy);
  const g = decision.group;

  const factors: Factor[] = s.scheduledOpen
    ? [
        {
          name: "People",
          detail: `${people} people need about ${decision.curveC.toFixed(1)}°C on the AC before anyone votes. The curve starts at 26°C for one person and 18°C for 300, and is re-fitted after every vote.`,
        },
        {
          name: "Group",
          detail: g
            ? `G${String(g.gid).padStart(2, "0")}: about ${Math.round(g.size)} people who start ${DAYS[g.weekday]} ${String(g.startHour).padStart(2, "0")}:00, seen in ${g.weeks.length} week${g.weeks.length === 1 ? "" : "s"}. Their learned taste is ${signed(decision.offsetC)}°C.`
            : "Under 15 people is a drop-in hour. No group taste applies.",
        },
        {
          name: "Votes",
          detail: hot + cold === 0
            ? "Nobody voted, so the AC holds."
            : hot === cold
              ? `${hot} hot and ${cold} cold is balanced, so the AC holds.`
              : `${hot} hot and ${cold} cold. Majority rule asks for ${signed(decision.correctionC)}°C.`,
        },
        {
          name: "Decision",
          detail: `Start of the hour ${decision.startC.toFixed(1)}°C, after the vote ${decision.setpointC.toFixed(1)}°C. The AC moves only the way the vote points, and only when the change is at least 0.5°C.`,
        },
        {
          name: "Room",
          detail: `With ${people} people the room settles near ${roomAfterC.toFixed(1)}°C.`,
        },
        {
          name: "Learning",
          // the model keeps six weeks of votes (keep_weeks in acmodel.py), so this stops at about 1,008
          detail: `Remembers ${decision.learnedHours - 1} earlier hour${decision.learnedHours === 2 ? "" : "s"} of votes in this room (it keeps the last six weeks).`,
        },
      ]
    : [{ name: "Closed", detail: `The room is closed, so votes are ignored and the AC sets back to ${SETBACK_C}°C.` }];

  const summary = !s.scheduledOpen
    ? `The room is closed, so the AC sets back to ${SETBACK_C}°C.`
    : hot + cold === 0 || hot === cold
      ? `Votes are balanced or absent, so the AC stays at ${targetC.toFixed(1)}°C.`
      : `${hot > cold ? "Hot" : "Cold"} votes lead, so the AC moves to ${targetC.toFixed(1)}°C.`;

  return {
    ...base,
    targetC,
    heatSetpointC: targetC - deadband,
    coolSetpointC: targetC + deadband,
    baselineSetpointC: BASELINE_AC_C,
    voteShiftC: decision.setpointC - decision.startC,
    action,
    summary,
    factors,
    baselineKwh,
    adaptiveKwh,
    savedKwh,
    savedPct: baselineKwh === 0 ? 0 : (savedKwh / baselineKwh) * 100,
    model: decision,
    roomAfterC,
    closed: !s.scheduledOpen,
  };
}

/** "2026-11-04T09:00" + hours, on the wall clock. */
export function shiftClock(at: string, hours: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(at);
  if (!m) return at;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]) + hours));
  const z = (v: number) => String(v).padStart(2, "0");
  return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}T${z(d.getUTCHours())}:00`;
}

export function clockLabel(at: string, startAt: string): string {
  const days = Math.round((Date.parse(`${at.slice(0, 10)}T00:00Z`) - Date.parse(`${startAt.slice(0, 10)}T00:00Z`)) / 86_400_000);
  const weekday = (new Date(`${at.slice(0, 10)}T00:00Z`).getUTCDay() + 6) % 7;
  return `Week ${Math.floor(days / 7) + 1} · ${DAYS[weekday]} ${at.slice(11, 16)}`;
}
