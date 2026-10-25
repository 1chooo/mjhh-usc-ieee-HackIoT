"""Fill the database with default data.

Writes two hours of sample Pi cycles, one every 10 minutes: each cycle adds a
record (people, temperature), a setpoint and a saving row. The vote inbox holds
the votes cast before each cycle, plus a few cast since the last one. It follows
the THH 201 classroom the web app simulates (apps/web/lib/campus.ts): empty
until a class starts 25 minutes ago, then over-cooled, so most votes are cold.
The latest cycle ends at that room's default readings.

    python3 apps/backend/scripts/seed.py            # stops if the tables already have rows
    python3 apps/backend/scripts/seed.py --reset    # deletes every vote, record, setpoint and saving first

Needs SUPABASE_SECRET_KEY from the environment or apps/backend/.env (gitignored).
SUPABASE_URL defaults to the hosted project. Standard library only.
"""

import argparse
import json
import os
import random
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
DEFAULT_URL = "https://avcqkyfobsalzdzzgvqm.supabase.co"
TABLES = ("vote", "record", "setpoint", "saving")
CYCLES = range(122, 1, -10)  # minutes ago of each Pi cycle; the last one is 2 minutes ago

# ppl and temp are keypoints (minutes ago, value), interpolated with a little noise.
PPL = [(122, 0), (30, 0), (25, 34), (0, 36)]
TEMP = [(122, 23.5), (25, 23.2), (2, 21.4)]
# votes cast in the 10 minutes before the cycle at that minute: (hot, cold); other cycles get none
VOTES = {22: (0, 2), 12: (0, 5), 2: (1, 12)}
PENDING_VOTES = (1, 2)  # cast after the last cycle, waiting for the next one
# model output per cycle: setback while empty, then nudged up by the cold votes
TARGETS = {22: 23.0, 12: 23.5, 2: 24.0}
EMPTY_TARGET = 26.0
# dollars saved in each cycle against a fixed setpoint; negative = used more
SAVINGS = {22: -0.0050, 12: 0.0080, 2: 0.0100}
EMPTY_SAVING = 0.0450


def load_env():
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def call(url, key, method, path, body=None):
    req = urllib.request.Request(
        url.rstrip("/") + "/rest/v1" + path,
        method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={"apikey": key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            status, raw = res.status, res.read()
    except urllib.error.HTTPError as err:
        status, raw = err.code, err.read()
    data = json.loads(raw) if raw else None
    if status >= 300:
        sys.exit(f"{method} {path} failed with HTTP {status}: {data}")
    return data


def interpolate(points, minutes_ago):
    for (m1, v1), (m2, v2) in zip(points, points[1:]):
        if m2 <= minutes_ago <= m1:
            return v1 if m1 == m2 else v1 + (v2 - v1) * (m1 - minutes_ago) / (m1 - m2)
    return points[-1][1]


def tally(votes):
    hot = sum(1 for vote in votes if vote["is_hot"])
    return hot, len(votes) - hot


def build_rows(now, rng):
    rows = {table: [] for table in TABLES}
    last = CYCLES[-1]

    def at(minutes_ago):
        return (now - timedelta(minutes=minutes_ago)).isoformat()

    def cast(hot, cold, newest, oldest):
        for is_hot, count in ((True, hot), (False, cold)):
            for _ in range(count):
                rows["vote"].append({"is_hot": is_hot, "created_at": at(rng.uniform(newest, oldest))})

    for m in CYCLES:
        ppl = interpolate(PPL, m)
        temp = interpolate(TEMP, m)
        if m != last:
            ppl = ppl + rng.uniform(-2, 2) if ppl > 0 else 0
            temp += rng.uniform(-0.15, 0.15)
        cast(*VOTES.get(m, (0, 0)), m + 0.1, m + 9.9)  # after the previous cycle, before this one
        rows["record"].append({"ppl": max(0, round(ppl)), "temp_c": round(temp, 1), "created_at": at(m)})
        rows["setpoint"].append({"target_c": TARGETS.get(m, EMPTY_TARGET), "created_at": at(m)})
        rows["saving"].append({"saved_usd": SAVINGS.get(m, EMPTY_SAVING), "created_at": at(m)})
    cast(*PENDING_VOTES, 0.1, last - 0.1)
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--reset", action="store_true", help="delete every vote, record, setpoint and saving first")
    args = parser.parse_args()

    load_env()
    url = os.environ.get("SUPABASE_URL", DEFAULT_URL)
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not key:
        sys.exit(f"Set SUPABASE_SECRET_KEY in the environment or in {ENV_FILE}")

    def sec(*args):
        return call(url, key, *args)

    print(f"Seeding {url}")

    if args.reset:
        for table in TABLES:
            sec("DELETE", f"/{table}?id=gt.0")  # ids start at 1, so this matches every row
        print("  cleared every vote, record, setpoint and saving")
    else:
        busy = [table for table in TABLES if sec("GET", f"/{table}?select=id&limit=1")]
        if busy:
            sys.exit(f"{', '.join(busy)} already have rows. Rerun with --reset to replace everything.")

    rows = build_rows(datetime.now(timezone.utc), random.Random(7))
    for table in TABLES:
        sec("POST", f"/{table}", rows[table])
        print(f"  {len(rows[table]):>4} rows into {table}")

    # the same reads the dashboard and the Pi make (API.md)
    latest, previous = sec("GET", "/record?order=created_at.desc&limit=2")
    last_at, prev_at = quote(latest["created_at"]), quote(previous["created_at"])
    counted = tally(sec("GET", f"/vote?created_at=gt.{prev_at}&created_at=lte.{last_at}&select=is_hot"))
    pending = tally(sec("GET", f"/vote?created_at=gt.{last_at}&select=is_hot"))
    target = sec("GET", "/setpoint?order=created_at.desc&limit=1")[0]
    total = sum(float(row["saved_usd"]) for row in sec("GET", "/saving?select=saved_usd"))
    print(f"\nlatest cycle: {latest['ppl']} people, {latest['temp_c']} °C, hot {counted[0]} / cold {counted[1]}, target {target['target_c']} °C")
    print(f"votes since then: hot {pending[0]} / cold {pending[1]}")
    print(f"total saved: ${total:.4f}")


if __name__ == "__main__":
    main()
