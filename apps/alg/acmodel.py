"""acmodel.py - classroom AC setpoint model in one file. Python 3.8+, standard library only.

    from acmodel import SimpleModel
    model = SimpleModel("R101", state_file="R101.json")   # state_file: remembers what it learned
    target = model.update(120, 30, 2)                      # head count, hot votes, cold votes -> 21.5

Call update() once an hour, after the vote. The time comes from the computer clock; pass
timestamp="2026-11-04T12:30:00" (local time) to set it yourself. Optional: next_hour(n_people)
about 15 minutes before the hour returns a temperature to switch to now, or None.

Same model and same answers as acmodel.js and the Python reference in the full package.
"""
from __future__ import annotations

import json
import math
import os
import re
from datetime import date, datetime
from statistics import median

N_MIN, N_MAX, SET_MIN, SET_MAX = 1, 300, 16.0, 30.0
GROUP_KEY0 = 168                                  # keys below this are weekly hours (free time)
DEFAULT_EDGES = (1, 51, 101, 151, 201, 251, 301)
EPOCH = date(2024, 1, 1)                          # a Monday; week numbers count from here
GRID = list(range(N_MIN, N_MAX + 1))

CONFIG = dict(
    ac_step=0.5, voter_weight_power=0.5, prior_weight=3.0, prior_points=7, hysteresis=0.3,
    decay=0.98, class_change=50, transient_weight=0.1,
    vote_map="atanh", vote_gain=2.5, max_correction=5.0, max_step=4.0,          # group hours
    slot_shrink=1.0, slot_week_decay=0.9, offset_limit=7.0, cycles_per_week=168, keep_weeks=6,
    preset_min_change=0.5, direction_guard=True, vote_guard=True,
    free_vote_map="linear", free_vote_gain=2.0, free_max_correction=1.5, free_max_step=1.0,  # drop-in hours
)
DETECT = dict(min_group=15, same_abs=6, same_rel=0.3, match_abs=5, match_rel=0.25,
              confirm_weeks=1, preset_recent_weeks=2)


def clip(v, lo, hi):
    return min(max(v, lo), hi)


def prior_setpoint(n):
    """Default before any vote: 26 C for 1 person down to 18 C for 300."""
    return 26.0 - 8.0 * (n - N_MIN) / (N_MAX - N_MIN)


def bin_of(n, edges=DEFAULT_EDGES):
    v = clip(int(n), N_MIN, N_MAX)
    b = 0
    while b + 1 < len(edges) and edges[b + 1] <= v:
        b += 1
    return b


def vote_correction(hot, cold, cfg):
    """Votes -> (correction C, weight). Majority rule: hot == cold is right; hot majority -> cooler."""
    voters = hot + cold
    if voters == 0:
        return 0.0, 1.0
    margin = (hot - cold) / voters
    weight = 1.0 + voters ** cfg["voter_weight_power"]
    signal = math.atanh(0.95 * margin) if cfg["vote_map"] == "atanh" else margin
    corr = -clip(cfg["vote_gain"] * signal, -cfg["max_correction"], cfg["max_correction"])
    return (0.0 if corr == 0 else corr), weight


def fit_poly2(n, y, w):
    """Weighted quadratic regression of setpoint on N/300 (ridge 0.01, intercept free) -> curve for N=1..300."""
    alpha = 1e-2
    sw = m1 = m2 = my = 0.0
    for ni, yi, wi in zip(n, y, w):
        x = ni / N_MAX
        sw += wi; m1 += wi * x; m2 += wi * x * x; my += wi * yi
    m1 /= sw; m2 /= sw; my /= sw
    a11 = a12 = a22 = b1 = b2 = 0.0
    for ni, yi, wi in zip(n, y, w):
        x = ni / N_MAX
        c1, c2, cy = x - m1, x * x - m2, yi - my
        a11 += wi * c1 * c1; a12 += wi * c1 * c2; a22 += wi * c2 * c2
        b1 += wi * c1 * cy; b2 += wi * c2 * cy
    a11 += alpha; a22 += alpha
    det = a11 * a22 - a12 * a12
    k1 = (b1 * a22 - a12 * b2) / det
    k2 = (a11 * b2 - a12 * b1) / det
    k0 = my - m1 * k1 - m2 * k2
    return [k0 + k1 * (v / N_MAX) + k2 * (v / N_MAX) ** 2 for v in GRID]


# ---------------------------------------------------------------------- setpoint = curve(N) + offset(group)
class Controller:
    def __init__(self, scheduled):
        self.cfg = dict(CONFIG)
        c = self.cfg
        self.free_cfg = dict(c, vote_map=c["free_vote_map"], vote_gain=c["free_vote_gain"],
                             max_correction=c["free_max_correction"], max_step=c["free_max_step"])
        self.scheduled = scheduled                 # set of group keys, shared with the detector
        self.n, self.y, self.w0, self.t, self.slot = [], [], [], [], []
        self.cycle = 0
        self.curve = [prior_setpoint(v) for v in GRID]
        self.offsets, self.slot_n, self.last_set = {}, {}, {}
        self.current = self.cur_key = self.cur_slot = self.prev_n = None
        self.transient, self.last_corr = False, 0.0

    def bin_value(self, n):
        return self.curve[clip(int(n), N_MIN, N_MAX) - N_MIN]

    def is_course(self, slot):
        return slot in self.scheduled

    def ideal(self, n, slot):
        off = self.offsets.get(slot, 0.0) if self.is_course(slot) else 0.0
        return clip(self.bin_value(n) + off, SET_MIN, SET_MAX)

    def quantize(self, v, ref, limit, max_step=None):
        step = self.cfg["ac_step"]
        q = round(v / step) * step
        if ref is None:
            return q
        if abs(v - ref) < step / 2 + self.cfg["hysteresis"]:
            return ref                              # small change: leave the AC alone
        m = self.cfg["max_step"] if max_step is None else max_step
        return ref + clip(q - ref, -m, m) if limit else q

    def plan(self, n, slot):
        v = self.ideal(n, slot)
        if self.current is not None and abs(v - self.current) < self.cfg["ac_step"] / 2 + self.cfg["hysteresis"]:
            return self.current
        return self.quantize(v, self.last_set.get(f"{slot}:{bin_of(n)}"), False)

    def start_cycle(self, n_people, slot, continuing):
        n = clip(int(n_people), N_MIN, N_MAX)
        self.transient = self.prev_n is not None and abs(n - self.prev_n) >= self.cfg["class_change"]
        self.prev_n = n
        self.cur_slot = slot
        self.cur_key = [slot, bin_of(n)]
        if continuing and self.current is not None:
            s = self.quantize(self.ideal(n, slot), self.current, True)
            last = self.last_corr
            if self.cfg["direction_guard"] and ((last > 0 and s < self.current) or (last < 0 and s > self.current)):
                s = self.current                    # they just said "too cold": do not cool further
            self.current = s
        else:
            self.current = self.plan(n, slot)
        return self.current

    def on_votes(self, n_people, hot, cold):
        n = clip(int(n_people), N_MIN, N_MAX)
        vcfg = self.cfg if self.is_course(self.cur_slot) else self.free_cfg
        corr, w = vote_correction(hot, cold, vcfg)
        self.last_corr = corr
        if self.transient:
            w *= self.cfg["transient_weight"]       # room still catching up after a class change
        self.n.append(n); self.y.append(self.current + corr); self.w0.append(w)
        self.t.append(self.cycle); self.slot.append(self.cur_slot)
        s = self.cur_slot
        self.slot_n[s] = 0.5 * self.slot_n[s] + 0.5 * n if s in self.slot_n else n
        self.cycle += 1
        self.refit()
        before = self.current
        new = self.quantize(self.ideal(n, s), before, True, vcfg["max_step"])
        if self.cfg["vote_guard"]:                  # move only the way the vote points
            new = max(new, before) if corr > 0 else min(new, before) if corr < 0 else before
        self.current = new
        self.last_set[f"{self.cur_key[0]}:{self.cur_key[1]}"] = self.current
        return self.current

    def refit(self):
        """Re-estimate the head-count curve and every group's offset from the last 6 weeks of votes."""
        c = self.cfg
        horizon = c["keep_weeks"] * c["cycles_per_week"]
        if any(self.cycle - t >= horizon for t in self.t):
            keep = [self.cycle - t < horizon for t in self.t]
            for name in ("n", "y", "w0", "t", "slot"):
                setattr(self, name, [v for v, k in zip(getattr(self, name), keep) if k])
        L = len(self.n)
        wc = [self.w0[i] * c["decay"] ** (self.cycle - self.t[i]) for i in range(L)]           # curve: recent hours
        ws = [self.w0[i] * c["slot_week_decay"] ** ((self.cycle - self.t[i]) // c["cycles_per_week"])
              for i in range(L)]                                                                # groups: recent weeks
        k = c["prior_points"]
        pn = [round(N_MIN + (N_MAX - N_MIN) * j / (k - 1)) for j in range(k)]
        off = dict(self.offsets)
        n_all, w_all = self.n + pn, wc + [c["prior_weight"]] * k
        for _ in range(2):                          # alternate: curve <-> group offsets
            y_all = [self.y[i] - off.get(self.slot[i], 0.0) for i in range(L)] + [prior_setpoint(v) for v in pn]
            self.curve = fit_poly2(n_all, y_all, w_all)
            num, den = {}, {}
            for i in range(L):
                r = self.y[i] - self.curve[self.n[i] - N_MIN]
                num[self.slot[i]] = num.get(self.slot[i], 0.0) + ws[i] * r
                den[self.slot[i]] = den.get(self.slot[i], 0.0) + ws[i]
            off = {key: (clip(num[key] / (den[key] + c["slot_shrink"]), -c["offset_limit"], c["offset_limit"])
                         if key in self.scheduled else 0.0) for key in num}
        self.offsets = {key: off[key] for key in sorted(set(self.slot))}


# ---------------------------------------------------------------------- which group is in the room
class Group:
    def __init__(self, gid, weekday, start_hour, size):
        self.gid, self.weekday, self.start_hour, self.size = gid, weekday, start_hour, size
        self.weeks, self.lengths = set(), []

    @property
    def length(self):
        return float(median(self.lengths)) if self.lengths else 1.0

    @property
    def key(self):
        return GROUP_KEY0 + self.gid


class Detector:
    """Groups = sessions that start on the same weekday and hour with a similar head count."""

    def __init__(self):
        self.cfg = dict(DETECT)
        self.groups, self.session = [], None

    def similar(self, a, b):
        return abs(a - b) <= max(self.cfg["same_abs"], self.cfg["same_rel"] * max(a, b))

    def matches(self, a, b):
        return abs(a - b) <= max(self.cfg["match_abs"], self.cfg["match_rel"] * max(a, b))

    def end_session(self):
        if self.session:
            self.session["group"].lengths.append(self.session["hours"])
        self.session = None

    def known_start(self, week, weekday, hour, n, exclude):
        best = None
        for g in self.groups:
            if (g is not exclude and g.weekday == weekday and g.start_hour == hour and g.weeks
                    and week not in g.weeks and self.matches(n, g.size)):
                if best is None or len(g.weeks) > len(best.weeks):
                    best = g
        return best

    def observe(self, week, weekday, hour, n):
        abs_hour = (week * 7 + weekday) * 24 + hour
        s = self.session
        if s and s["last_abs_hour"] == abs_hour - 1 and self.similar(n, sum(s["sizes"][-2:]) / len(s["sizes"][-2:])):
            g = s["group"]
            other = self.known_start(week, weekday, hour, n, g)
            ran_full = len(g.lengths) >= 1 and s["hours"] >= round(g.length)
            if other is None and not ran_full:      # same group, next hour
                s["hours"] += 1; s["sizes"].append(n); s["last_abs_hour"] = abs_hour
                return g.key, g, True
        self.end_session()
        if n < self.cfg["min_group"]:
            return weekday * 24 + hour, None, False  # drop-in hour
        match = None
        for g in self.groups:
            if g.weekday == weekday and g.start_hour == hour and week not in g.weeks and self.matches(n, g.size):
                if match is None or abs(g.size - n) < abs(match.size - n):
                    match = g                        # seen in an earlier week
        if match is None:
            match = Group(len(self.groups), weekday, hour, n)
            self.groups.append(match)
        match.weeks.add(week)
        match.size = 0.7 * match.size + 0.3 * n if len(match.weeks) > 1 else n
        self.session = dict(group=match, hours=1, sizes=[n], last_abs_hour=abs_hour)
        return match.key, match, False

    def expected_next(self, week, weekday, hour):
        s = self.session
        if s and len(s["group"].weeks) >= self.cfg["confirm_weeks"] and s["hours"] < round(s["group"].length):
            return None                              # this class normally runs longer
        nh, nd = hour + 1, weekday
        if nh == 24:
            nh, nd = 0, (weekday + 1) % 7
        best = None
        for g in self.groups:
            if g.weekday == nd and g.start_hour == nh and g.weeks:
                recent = sum(1 for w in range(week - self.cfg["preset_recent_weeks"], week) if w in g.weeks)
                if recent >= 1 and (best is None or len(g.weeks) > len(best.weeks)):
                    best = g
        return best


class Room:
    def __init__(self):
        self.det = Detector()
        self.keys = set()
        self.ctl = Controller(self.keys)
        self.group = self.pos = self.s1 = None

    def start(self, week, weekday, hour, n):
        key, g, continuing = self.det.observe(week, weekday, hour, n)
        self.group = g
        if g is not None:
            self.keys.add(g.key)
        self.pos = (week, weekday, hour)
        return self.ctl.start_cycle(n, key, continuing)

    def votes(self, n, hot, cold):
        self.s1 = self.ctl.on_votes(n, hot, cold)
        return self.s1

    def preset(self, n):
        g = self.det.expected_next(*self.pos)
        if g is None or g is self.group:
            return None
        base = self.s1 if self.s1 is not None else self.ctl.current
        target = self.ctl.bin_value(n) + self.ctl.offsets.get(g.key, 0.0)
        if abs(target - base) < self.ctl.cfg["preset_min_change"]:
            return None
        s = clip(self.ctl.quantize(target, None, False), SET_MIN, SET_MAX)
        if s == self.ctl.current:
            return None
        self.ctl.current = s
        return s

    # same JSON schema as the reference implementation and acmodel.js
    def to_state(self):
        c, d, ses = self.ctl, self.det, self.det.session
        return dict(
            controller=dict(version=1, n=c.n, y=c.y, w0=c.w0, t=c.t, slot=c.slot, cycle=c.cycle,
                            slot_n={str(k): v for k, v in c.slot_n.items()}, last_set=c.last_set,
                            prev_n=c.prev_n, current=c.current, curve=c.curve,
                            offsets={str(k): v for k, v in c.offsets.items()}, cur_slot=c.cur_slot,
                            cur_key=c.cur_key, transient=c.transient, last_corr=c.last_corr),
            groups=[dict(gid=g.gid, weekday=g.weekday, start_hour=g.start_hour, size=g.size,
                         weeks=sorted(g.weeks), lengths=g.lengths) for g in d.groups],
            session=None if ses is None else dict(gid=ses["group"].gid, hours=ses["hours"], sizes=ses["sizes"],
                                                  last_abs_hour=ses["last_abs_hour"]),
            confirmed=sorted(self.keys), pos=list(self.pos) if self.pos else None, s1=self.s1)

    @classmethod
    def from_state(cls, st):
        r = cls()
        for g in st["groups"]:
            G = Group(g["gid"], g["weekday"], g["start_hour"], g["size"])
            G.weeks, G.lengths = set(g["weeks"]), list(g["lengths"])
            r.det.groups.append(G)
        if st["session"]:
            s = st["session"]
            r.det.session = dict(group=r.det.groups[s["gid"]], hours=s["hours"], sizes=list(s["sizes"]),
                                 last_abs_hour=s["last_abs_hour"])
        r.keys.update(st["confirmed"])
        c, cs = r.ctl, st["controller"]
        c.n, c.y, c.w0, c.t, c.slot = (list(cs[k]) for k in ("n", "y", "w0", "t", "slot"))
        c.cycle, c.prev_n, c.current, c.curve = cs["cycle"], cs["prev_n"], cs["current"], list(cs["curve"])
        c.slot_n = {int(k): v for k, v in cs["slot_n"].items()}
        c.last_set = dict(cs["last_set"])
        c.offsets = {int(k): v for k, v in cs["offsets"].items()}
        c.cur_slot, c.cur_key = cs["cur_slot"], (list(cs["cur_key"]) if cs["cur_key"] else None)
        c.transient, c.last_corr = cs["transient"], cs.get("last_corr", 0.0)
        r.pos = tuple(st["pos"]) if st.get("pos") else None
        r.s1 = st.get("s1")
        if r.det.session:
            r.group = r.det.session["group"]
        return r


# ---------------------------------------------------------------------- the two ways to call it
def _when(ts: str):
    """(week number, weekday Mon=0, hour) read from the timestamp text itself (no time zones)."""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})", ts or "")
    if not m:
        raise ValueError(f"timestamp must look like 2026-11-04T12:30:00, got {ts!r}")
    d = date(int(m[1]), int(m[2]), int(m[3]))
    hour = int(m[4])
    if hour > 23 or int(m[5]) > 59:
        raise ValueError(f"timestamp has an impossible time: {ts!r}")
    return (d - EPOCH).days // 7, d.weekday(), hour


def _count(name, v):
    if not isinstance(v, int) or isinstance(v, bool) or v < 0:
        raise ValueError(f"{name} must be a whole number >= 0, got {v!r}")
    return v


class SimpleModel:
    """Head count + votes -> target AC temperature (16-30 C, 0.5 C steps). One object per room."""

    def __init__(self, room_id: str = "R101", state_file: str | None = None):
        self.room_id, self.state_file = room_id, state_file
        self.room, self.started_hour = Room(), None
        if state_file and os.path.exists(state_file):
            with open(state_file) as f:
                st = json.load(f)
            self.room, self.started_hour = Room.from_state(st["room"]), st.get("started_hour")

    @staticmethod
    def _now():
        return datetime.now().replace(microsecond=0).isoformat()

    def update(self, n_people: int, hot: int, cold: int, timestamp: str | None = None) -> float:
        """Call once an hour, after the vote. Returns the target temperature for the AC."""
        _count("n_people", n_people); _count("hot", hot); _count("cold", cold)
        if hot + cold > max(n_people, 1):
            raise ValueError(f"hot + cold ({hot + cold}) is more than n_people ({n_people})")
        ts = timestamp or self._now()
        week, weekday, hour = _when(ts)
        n = clip(n_people, N_MIN, N_MAX)
        if ts[:13] != self.started_hour:            # first call this hour: open the hour
            self.room.start(week, weekday, hour, n)
            self.started_hour = ts[:13]
        target = self.room.votes(n, hot, cold)
        self.save()
        return target

    def next_hour(self, n_people: int, timestamp: str | None = None):
        """Optional, ~15 min before the hour: temperature to switch to now for the group coming next, or None."""
        _count("n_people", n_people)
        if self.room.pos is None:
            return None
        _when(timestamp or self._now())
        return self.room.preset(clip(n_people, N_MIN, N_MAX))

    def state(self) -> dict:
        return dict(started_hour=self.started_hour, room=self.room.to_state())

    def save(self):
        if self.state_file:
            tmp = self.state_file + ".tmp"
            with open(tmp, "w") as f:
                json.dump(self.state(), f)
            os.replace(tmp, self.state_file)


if __name__ == "__main__":
    m = SimpleModel("demo")
    for week in range(3):
        for hour, n, hot, cold in [(12, 120, 30, 2), (13, 118, 12, 3)]:
            ts = f"2026-11-{4 + 7 * week:02d}T{hour}:30:00"
            print(f"week {week + 1} Wed {hour}:30  {n} people, hot {hot} / cold {cold} -> {m.update(n, hot, cold, ts)} C")
