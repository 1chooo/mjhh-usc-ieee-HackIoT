"""Fill the database with default data.

Adds two hours of history for the room: people counts every minute,
temperatures every 5 minutes, votes, and model setpoints. It follows the
THH 201 classroom the web app simulates (apps/web/lib/campus.ts): empty until a
class starts 25 minutes ago, then over-cooled, so most recent votes are cold.
It ends at that room's default readings, so room_now shows the same numbers.

    python3 apps/backend/scripts/seed.py            # stops if the tables already have rows
    python3 apps/backend/scripts/seed.py --reset    # deletes every vote, reading and setpoint first

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

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
DEFAULT_URL = "https://avcqkyfobsalzdzzgvqm.supabase.co"
HISTORY_MINUTES = 120
TABLES = ("vote", "occupancy_reading", "temp_reading", "setpoint")

# ppl and temp are keypoints (minutes ago, value), interpolated with a little noise.
# votes are windows (hot, cold, from minutes ago, to minutes ago); the 1-9 minute window
# is what room_now counts, so it matches the web app's hotVotes / coldVotes.
# setpoints are (minutes ago, target_c), as if the model ran about once an hour.
ROOM = {
    "ppl": [(120, 0), (30, 0), (25, 34), (0, 36)],
    "temp": [(120, 23.5), (25, 23.2), (0, 21.4)],
    "votes": [(1, 12, 1, 9), (0, 5, 12, 25)],
    "setpoints": [(110, 26.0), (35, 23.0), (10, 24.0)],
}


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


def build_rows(now, rng):
    rows = {table: [] for table in TABLES}

    def at(minutes_ago):
        return (now - timedelta(minutes=minutes_ago)).isoformat()

    for m in range(HISTORY_MINUTES, -1, -1):
        ppl = interpolate(ROOM["ppl"], m)
        if m and ppl > 0:
            ppl += rng.uniform(-2, 2)
        rows["occupancy_reading"].append({"ppl": max(0, round(ppl)), "created_at": at(m)})
    for m in range(HISTORY_MINUTES, -1, -5):
        temp = interpolate(ROOM["temp"], m) + (rng.uniform(-0.15, 0.15) if m else 0)
        rows["temp_reading"].append({"temp_c": round(temp, 1), "created_at": at(m)})
    for hot, cold, lo, hi in ROOM["votes"]:
        for is_hot, count in ((True, hot), (False, cold)):
            for _ in range(count):
                rows["vote"].append({"is_hot": is_hot, "created_at": at(rng.uniform(lo, hi))})
    for m, target in ROOM["setpoints"]:
        rows["setpoint"].append({"target_c": target, "created_at": at(m)})
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--reset", action="store_true", help="delete every vote, reading and setpoint first")
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
        print("  cleared every vote, reading and setpoint")
    else:
        busy = [table for table in TABLES if sec("GET", f"/{table}?select=id&limit=1")]
        if busy:
            sys.exit(f"{', '.join(busy)} already have rows. Rerun with --reset to replace everything.")

    rows = build_rows(datetime.now(timezone.utc), random.Random(7))
    for table in TABLES:
        sec("POST", f"/{table}", rows[table])
        print(f"  {len(rows[table]):>4} rows into {table}")

    row = sec("GET", "/room_now")[0]
    print(
        f"\nroom_now: {row['ppl']} people, {row['temp_c']} °C, "
        f"hot {row['hot_count']} / cold {row['cold_count']}, target {row['target_c']} °C"
    )


if __name__ == "__main__":
    main()
