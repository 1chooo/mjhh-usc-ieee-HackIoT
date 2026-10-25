/**
 * AC setpoint model: people count + hot/cold votes -> AC setpoint (16-30 C, 0.5 C steps).
 *
 *   setpoint = curve(people) + offset(group)
 *
 * The curve is how cold the AC must be for that many people (26 C for one person down to
 * 18 C for 300 before any vote) and is re-fitted after every vote. A group is 15 or more
 * people who start on the same weekday and hour, with a similar headcount, as in an earlier
 * week; its offset is learned from its own votes. Majority rule: the model aims for as many
 * hot votes as cold ones and only moves the way a vote points.
 *
 * Port of apps/alg/acmodel.py (same answers). One `RoomModel` per room; call `update` once an
 * hour after the vote, or `preview` to see what an hour would give without learning from it.
 */

export const N_MIN = 1;
export const N_MAX = 300;
export const SET_MIN = 16;
export const SET_MAX = 30;
const GROUP_KEY0 = 168; // keys below this are weekly hours (drop-in time)
const EPOCH_UTC = Date.UTC(2024, 0, 1); // a Monday; week numbers count from here

type VoteConfig = {
  voteMap: "atanh" | "linear";
  voteGain: number;
  maxCorrection: number;
  maxStep: number;
};

const CONFIG = {
  acStep: 0.5,
  voterWeightPower: 0.5,
  priorWeight: 3,
  priorPoints: 7,
  hysteresis: 0.3,
  decay: 0.98,
  classChange: 50,
  transientWeight: 0.1,
  slotShrink: 1,
  slotWeekDecay: 0.9,
  offsetLimit: 7,
  cyclesPerWeek: 168,
  keepWeeks: 6,
  presetMinChange: 0.5,
  group: { voteMap: "atanh", voteGain: 2.5, maxCorrection: 5, maxStep: 4 } as VoteConfig,
  dropIn: { voteMap: "linear", voteGain: 2, maxCorrection: 1.5, maxStep: 1 } as VoteConfig,
};

const DETECT = { minGroup: 15, sameAbs: 6, sameRel: 0.3, matchAbs: 5, matchRel: 0.25, presetRecentWeeks: 2 };

const GRID = Array.from({ length: N_MAX - N_MIN + 1 }, (_, i) => i + N_MIN);

export const clampTo = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Python round(): halves go to the even neighbour. */
function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function binOf(n: number): number {
  return Math.min(5, Math.floor((clampTo(Math.trunc(n), N_MIN, N_MAX) - 1) / 50));
}

/** Setpoint before any vote: 26 C for 1 person down to 18 C for 300. */
export const priorSetpoint = (n: number) => 26 - (8 * (n - N_MIN)) / (N_MAX - N_MIN);

/** Votes -> [correction C, weight]. Hot majority -> cooler. */
export function voteCorrection(hot: number, cold: number, cfg: VoteConfig): [number, number] {
  const voters = hot + cold;
  if (voters === 0) return [0, 1];
  const margin = (hot - cold) / voters;
  const weight = 1 + Math.pow(voters, CONFIG.voterWeightPower);
  const signal = cfg.voteMap === "atanh" ? Math.atanh(0.95 * margin) : margin;
  const corr = -clampTo(cfg.voteGain * signal, -cfg.maxCorrection, cfg.maxCorrection);
  return [corr === 0 ? 0 : corr, weight];
}

/** Weighted quadratic regression of setpoint on people/300 -> curve for 1..300 people. */
function fitPoly2(n: number[], y: number[], w: number[]): number[] {
  const alpha = 1e-2;
  let sw = 0, m1 = 0, m2 = 0, my = 0;
  n.forEach((ni, i) => {
    const x = ni / N_MAX, wi = w[i]!;
    sw += wi; m1 += wi * x; m2 += wi * x * x; my += wi * y[i]!;
  });
  m1 /= sw; m2 /= sw; my /= sw;
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
  n.forEach((ni, i) => {
    const x = ni / N_MAX, wi = w[i]!;
    const c1 = x - m1, c2 = x * x - m2, cy = y[i]! - my;
    a11 += wi * c1 * c1; a12 += wi * c1 * c2; a22 += wi * c2 * c2;
    b1 += wi * c1 * cy; b2 += wi * c2 * cy;
  });
  a11 += alpha; a22 += alpha;
  const det = a11 * a22 - a12 * a12;
  const k1 = (b1 * a22 - a12 * b2) / det;
  const k2 = (a11 * b2 - a12 * b1) / det;
  const k0 = my - m1 * k1 - m2 * k2;
  return GRID.map((v) => k0 + k1 * (v / N_MAX) + k2 * (v / N_MAX) ** 2);
}

// ------------------------------------------------------------------ setpoint = curve + offset

type ControllerState = {
  n: number[]; y: number[]; w0: number[]; t: number[]; slot: number[]; cycle: number;
  slotN: Record<string, number>; lastSet: Record<string, number>; prevN: number | null;
  current: number | null; curve: number[]; offsets: Record<string, number>;
  curSlot: number | null; curKey: [number, number] | null; transient: boolean; lastCorr: number;
};

class Controller {
  n: number[] = []; y: number[] = []; w0: number[] = []; t: number[] = []; slot: number[] = [];
  cycle = 0;
  curve: number[] = GRID.map(priorSetpoint);
  offsets = new Map<number, number>();
  slotN = new Map<number, number>();
  lastSet = new Map<string, number>();
  current: number | null = null;
  curKey: [number, number] | null = null;
  curSlot: number | null = null;
  prevN: number | null = null;
  transient = false;
  lastCorr = 0;

  readonly scheduled: Set<number>;

  constructor(scheduled: Set<number>) {
    this.scheduled = scheduled;
  }

  curveAt(n: number): number {
    return this.curve[clampTo(Math.trunc(n), N_MIN, N_MAX) - N_MIN]!;
  }
  isGroup(slot: number | null): boolean {
    return slot !== null && this.scheduled.has(slot);
  }
  offsetOf(slot: number | null): number {
    return slot !== null && this.isGroup(slot) ? (this.offsets.get(slot) ?? 0) : 0;
  }
  ideal(n: number, slot: number | null): number {
    return clampTo(this.curveAt(n) + this.offsetOf(slot), SET_MIN, SET_MAX);
  }
  quantize(v: number, ref: number | null, limit: boolean, maxStep = CONFIG.group.maxStep): number {
    const step = CONFIG.acStep;
    const q = roundHalfEven(v / step) * step;
    if (ref === null) return q;
    if (Math.abs(v - ref) < step / 2 + CONFIG.hysteresis) return ref; // small change: leave the AC alone
    return limit ? ref + clampTo(q - ref, -maxStep, maxStep) : q;
  }
  plan(n: number, slot: number): number {
    const v = this.ideal(n, slot);
    if (this.current !== null && Math.abs(v - this.current) < CONFIG.acStep / 2 + CONFIG.hysteresis) return this.current;
    return this.quantize(v, this.lastSet.get(`${slot}:${binOf(n)}`) ?? null, false);
  }
  startCycle(people: number, slot: number, continuing: boolean): number {
    const n = clampTo(Math.trunc(people), N_MIN, N_MAX);
    this.transient = this.prevN !== null && Math.abs(n - this.prevN) >= CONFIG.classChange;
    this.prevN = n;
    this.curSlot = slot;
    this.curKey = [slot, binOf(n)];
    if (continuing && this.current !== null) {
      let s = this.quantize(this.ideal(n, slot), this.current, true);
      const last = this.lastCorr;
      if ((last > 0 && s < this.current) || (last < 0 && s > this.current)) s = this.current; // follow the last vote
      this.current = s;
    } else {
      this.current = this.plan(n, slot);
    }
    return this.current;
  }
  onVotes(people: number, hot: number, cold: number): number {
    const n = clampTo(Math.trunc(people), N_MIN, N_MAX);
    const cfg = this.isGroup(this.curSlot) ? CONFIG.group : CONFIG.dropIn;
    const [corr, weight] = voteCorrection(hot, cold, cfg);
    this.lastCorr = corr;
    const w = this.transient ? weight * CONFIG.transientWeight : weight; // room still catching up after a class change
    const before = this.current ?? priorSetpoint(n);
    this.n.push(n); this.y.push(before + corr); this.w0.push(w);
    this.t.push(this.cycle); this.slot.push(this.curSlot ?? 0);
    const s = this.curSlot ?? 0;
    const seen = this.slotN.get(s);
    this.slotN.set(s, seen === undefined ? n : 0.5 * seen + 0.5 * n);
    this.cycle += 1;
    this.refit();
    let next = this.quantize(this.ideal(n, s), before, true, cfg.maxStep);
    if (corr > 0) next = Math.max(next, before); // "too cold": never cool further
    else if (corr < 0) next = Math.min(next, before); // "too hot": never warm further
    else next = before; // balanced or nobody voted: hold
    this.current = next;
    if (this.curKey) this.lastSet.set(`${this.curKey[0]}:${this.curKey[1]}`, next);
    return next;
  }
  /** Re-estimate the curve and every group's offset from the last 6 weeks of votes. */
  refit() {
    const horizon = CONFIG.keepWeeks * CONFIG.cyclesPerWeek;
    if (this.t.some((t) => this.cycle - t >= horizon)) {
      const keep = this.t.map((t) => this.cycle - t < horizon);
      this.n = this.n.filter((_, i) => keep[i]); this.y = this.y.filter((_, i) => keep[i]);
      this.w0 = this.w0.filter((_, i) => keep[i]); this.t = this.t.filter((_, i) => keep[i]);
      this.slot = this.slot.filter((_, i) => keep[i]);
    }
    const L = this.n.length;
    const wc = this.w0.map((w, i) => w * Math.pow(CONFIG.decay, this.cycle - this.t[i]!)); // curve: recent hours
    const ws = this.w0.map((w, i) => w * Math.pow(CONFIG.slotWeekDecay, Math.floor((this.cycle - this.t[i]!) / CONFIG.cyclesPerWeek))); // groups: recent weeks
    const k = CONFIG.priorPoints;
    const pn = Array.from({ length: k }, (_, j) => roundHalfEven(N_MIN + ((N_MAX - N_MIN) * j) / (k - 1)));
    let off = new Map(this.offsets);
    const nAll = [...this.n, ...pn];
    const wAll = [...wc, ...pn.map(() => CONFIG.priorWeight)];
    for (let it = 0; it < 2; it++) { // alternate: curve <-> group offsets
      const yAll = [...this.y.map((v, i) => v - (off.get(this.slot[i]!) ?? 0)), ...pn.map(priorSetpoint)];
      this.curve = fitPoly2(nAll, yAll, wAll);
      const num = new Map<number, number>(), den = new Map<number, number>();
      for (let i = 0; i < L; i++) {
        const key = this.slot[i]!;
        const r = this.y[i]! - this.curve[this.n[i]! - N_MIN]!;
        num.set(key, (num.get(key) ?? 0) + ws[i]! * r);
        den.set(key, (den.get(key) ?? 0) + ws[i]!);
      }
      off = new Map();
      for (const [key, total] of num) {
        off.set(key, this.scheduled.has(key)
          ? clampTo(total / ((den.get(key) ?? 0) + CONFIG.slotShrink), -CONFIG.offsetLimit, CONFIG.offsetLimit) : 0);
      }
    }
    this.offsets = new Map([...new Set(this.slot)].sort((a, b) => a - b).map((key) => [key, off.get(key) ?? 0]));
  }
  toState(): ControllerState {
    return {
      n: [...this.n], y: [...this.y], w0: [...this.w0], t: [...this.t], slot: [...this.slot], cycle: this.cycle,
      slotN: Object.fromEntries([...this.slotN].map(([k, v]) => [String(k), v])),
      lastSet: Object.fromEntries(this.lastSet), prevN: this.prevN, current: this.current, curve: [...this.curve],
      offsets: Object.fromEntries([...this.offsets].map(([k, v]) => [String(k), v])),
      curSlot: this.curSlot, curKey: this.curKey ? [...this.curKey] : null, transient: this.transient, lastCorr: this.lastCorr,
    };
  }
  load(s: ControllerState) {
    this.n = [...s.n]; this.y = [...s.y]; this.w0 = [...s.w0]; this.t = [...s.t]; this.slot = [...s.slot];
    this.cycle = s.cycle; this.prevN = s.prevN; this.current = s.current; this.curve = [...s.curve];
    this.slotN = new Map(Object.entries(s.slotN).map(([k, v]) => [Number(k), v]));
    this.lastSet = new Map(Object.entries(s.lastSet));
    this.offsets = new Map(Object.entries(s.offsets).map(([k, v]) => [Number(k), v]));
    this.curSlot = s.curSlot; this.curKey = s.curKey ? [s.curKey[0], s.curKey[1]] : null;
    this.transient = s.transient; this.lastCorr = s.lastCorr;
  }
}

// ------------------------------------------------------------------ which group is in the room

export type Group = { gid: number; weekday: number; startHour: number; size: number; weeks: number[]; lengths: number[] };
type Session = { gid: number; hours: number; sizes: number[]; lastAbsHour: number };

const groupKey = (g: Group) => GROUP_KEY0 + g.gid;
const groupLength = (g: Group) => (g.lengths.length ? median(g.lengths) : 1);
const similar = (a: number, b: number) => Math.abs(a - b) <= Math.max(DETECT.sameAbs, DETECT.sameRel * Math.max(a, b));
const matches = (a: number, b: number) => Math.abs(a - b) <= Math.max(DETECT.matchAbs, DETECT.matchRel * Math.max(a, b));

class Detector {
  groups: Group[] = [];
  session: Session | null = null;

  private endSession() {
    if (this.session) this.groups[this.session.gid]!.lengths.push(this.session.hours);
    this.session = null;
  }
  private knownStart(week: number, weekday: number, hour: number, n: number, exclude: Group): Group | null {
    let best: Group | null = null;
    for (const g of this.groups) {
      if (g !== exclude && g.weekday === weekday && g.startHour === hour && g.weeks.length
        && !g.weeks.includes(week) && matches(n, g.size) && (!best || g.weeks.length > best.weeks.length)) best = g;
    }
    return best;
  }
  observe(week: number, weekday: number, hour: number, n: number): [number, Group | null, boolean] {
    const absHour = (week * 7 + weekday) * 24 + hour;
    const s = this.session;
    if (s && s.lastAbsHour === absHour - 1) {
      const last2 = s.sizes.slice(-2);
      const g = this.groups[s.gid]!;
      if (similar(n, last2.reduce((a, b) => a + b, 0) / last2.length)
        && !this.knownStart(week, weekday, hour, n, g) && !(g.lengths.length >= 1 && s.hours >= roundHalfEven(groupLength(g)))) {
        s.hours += 1; s.sizes.push(n); s.lastAbsHour = absHour;
        return [groupKey(g), g, true];
      }
    }
    this.endSession();
    if (n < DETECT.minGroup) return [weekday * 24 + hour, null, false]; // drop-in hour
    let match: Group | null = null;
    for (const g of this.groups) {
      if (g.weekday === weekday && g.startHour === hour && !g.weeks.includes(week) && matches(n, g.size)
        && (!match || Math.abs(g.size - n) < Math.abs(match.size - n))) match = g;
    }
    if (!match) {
      match = { gid: this.groups.length, weekday, startHour: hour, size: n, weeks: [], lengths: [] };
      this.groups.push(match);
    }
    match.weeks.push(week);
    match.weeks.sort((a, b) => a - b);
    match.size = match.weeks.length > 1 ? 0.7 * match.size + 0.3 * n : n;
    this.session = { gid: match.gid, hours: 1, sizes: [n], lastAbsHour: absHour };
    return [groupKey(match), match, false];
  }
  expectedNext(week: number, weekday: number, hour: number): Group | null {
    const s = this.session;
    if (s && s.hours < roundHalfEven(groupLength(this.groups[s.gid]!))) return null; // this class normally runs longer
    let nh = hour + 1, nd = weekday;
    if (nh === 24) { nh = 0; nd = (weekday + 1) % 7; }
    let best: Group | null = null;
    for (const g of this.groups) {
      if (g.weekday !== nd || g.startHour !== nh || !g.weeks.length) continue;
      let recent = 0;
      for (let w = week - DETECT.presetRecentWeeks; w < week; w++) if (g.weeks.includes(w)) recent++;
      if (recent >= 1 && (!best || g.weeks.length > best.weeks.length)) best = g;
    }
    return best;
  }
}

// ------------------------------------------------------------------ the room

/** Week number, weekday (Mon = 0) and hour, read from a local timestamp "YYYY-MM-DDTHH:MM". */
export function clockOf(timestamp: string): { week: number; weekday: number; hour: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2})/.exec(timestamp);
  if (!m) throw new Error(`timestamp must look like 2026-11-04T12:30, got ${timestamp}`);
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const days = Math.round((utc - EPOCH_UTC) / 86_400_000);
  return { week: Math.floor(days / 7), weekday: (new Date(utc).getUTCDay() + 6) % 7, hour: Number(m[4]) };
}

/** Why the model picked a setpoint, for display. */
export type Decision = {
  setpointC: number; // what the AC is set to after this hour's votes
  startC: number; // what it was set to at the start of the hour, before the votes
  curveC: number; // curve(people): what this many people need before any group taste
  offsetC: number; // the group's learned offset
  correctionC: number; // what the votes alone asked for
  group: Group | null; // null = drop-in hour (under 15 people)
  continuing: boolean; // same group as the previous hour
  learnedHours: number; // votes the model has learned from so far
};

export type RoomState = { controller: ControllerState; groups: Group[]; session: Session | null; keys: number[]; hour: string | null };

export class RoomModel {
  private det = new Detector();
  private keys = new Set<number>();
  private ctl = new Controller(this.keys);
  private openHour: string | null = null;
  private pos: { week: number; weekday: number; hour: number } | null = null;
  private group: Group | null = null;
  private continuing = false;

  /** Learn from this hour: call once an hour after the vote. */
  update(people: number, hot: number, cold: number, timestamp: string): Decision {
    const n = clampTo(Math.max(0, Math.trunc(people)), N_MIN, N_MAX);
    let h = Math.max(0, Math.trunc(hot)), c = Math.max(0, Math.trunc(cold));
    if (h + c > Math.max(people, 1)) { // more votes than people (repeated taps): one vote per person
      const k = Math.max(people, 1) / (h + c);
      h = Math.floor(h * k); c = Math.floor(c * k);
    }
    const clock = clockOf(timestamp);
    if (timestamp.slice(0, 13) !== this.openHour) {
      const [key, g, continuing] = this.det.observe(clock.week, clock.weekday, clock.hour, n);
      this.group = g; this.continuing = continuing;
      if (g) this.keys.add(groupKey(g));
      this.pos = clock;
      this.ctl.startCycle(n, key, continuing);
      this.openHour = timestamp.slice(0, 13);
    }
    const startC = this.ctl.current!;
    const cfg = this.ctl.isGroup(this.ctl.curSlot) ? CONFIG.group : CONFIG.dropIn;
    const [correctionC] = voteCorrection(h, c, cfg);
    const setpointC = this.ctl.onVotes(n, h, c);
    return {
      setpointC, startC, correctionC, curveC: this.ctl.curveAt(n), offsetC: this.ctl.offsetOf(this.ctl.curSlot),
      group: this.group ? { ...this.group } : null, continuing: this.continuing, learnedHours: this.ctl.n.length,
    };
  }

  /** What `update` would give, without learning from it. */
  preview(people: number, hot: number, cold: number, timestamp: string): Decision {
    const copy = new RoomModel();
    copy.load(this.save());
    return copy.update(people, hot, cold, timestamp);
  }

  /** Optional, ~15 min before the hour: setpoint that readies the room for the group expected next. */
  nextHour(people: number): number | null {
    if (!this.pos) return null;
    const g = this.det.expectedNext(this.pos.week, this.pos.weekday, this.pos.hour);
    if (!g || (this.group && g.gid === this.group.gid)) return null;
    const n = clampTo(Math.trunc(people), N_MIN, N_MAX);
    const base = this.ctl.current ?? priorSetpoint(n);
    const target = this.ctl.curveAt(n) + (this.ctl.offsets.get(groupKey(g)) ?? 0);
    if (Math.abs(target - base) < CONFIG.presetMinChange) return null;
    const s = clampTo(this.ctl.quantize(target, null, false), SET_MIN, SET_MAX);
    if (s === this.ctl.current) return null;
    this.ctl.current = s;
    return s;
  }

  get groups(): Group[] {
    return this.det.groups.map((g) => ({ ...g, weeks: [...g.weeks], lengths: [...g.lengths] }));
  }
  offsetFor(gid: number): number {
    return this.ctl.offsets.get(GROUP_KEY0 + gid) ?? 0;
  }
  curve(): number[] {
    return [...this.ctl.curve];
  }

  save(): RoomState {
    return {
      controller: this.ctl.toState(), groups: this.groups,
      session: this.det.session ? { ...this.det.session, sizes: [...this.det.session.sizes] } : null,
      keys: [...this.keys], hour: this.openHour,
    };
  }
  load(s: RoomState) {
    this.det.groups = s.groups.map((g) => ({ ...g, weeks: [...g.weeks], lengths: [...g.lengths] }));
    this.det.session = s.session ? { ...s.session, sizes: [...s.session.sizes] } : null;
    this.keys.clear();
    for (const k of s.keys) this.keys.add(k);
    this.ctl.load(s.controller);
    this.openHour = s.hour;
    this.group = this.det.session ? this.det.groups[this.det.session.gid] ?? null : null;
  }
}
