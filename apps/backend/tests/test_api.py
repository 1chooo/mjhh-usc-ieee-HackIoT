"""Test the Supabase REST API described in ../API.md against the live project.

Creates a throwaway room (test-xxxxxx), runs every documented call with both
keys, checks the access rules and constraints, then deletes everything it made.

    python3 apps/backend/tests/test_api.py

Needs SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY, from the environment or
from apps/backend/.env (gitignored). SUPABASE_URL defaults to the hosted project.
Standard library only.
"""

import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
DEFAULT_URL = "https://avcqkyfobsalzdzzgvqm.supabase.co"

failures = []


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
        with urllib.request.urlopen(req, timeout=15) as res:
            status, raw = res.status, res.read()
    except urllib.error.HTTPError as err:
        status, raw = err.code, err.read()
    return status, json.loads(raw) if raw else None


def check(name, ok, got=None):
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}")
    if not ok:
        print(f"        got: {got}")
        failures.append(name)


def expect(name, res, status, code=None):
    """Check the HTTP status (and Postgres error code, if given); return the body."""
    got_status, body = res
    ok = got_status == status and (code is None or (isinstance(body, dict) and body.get("code") == code))
    check(name, ok, res)
    return body


def run(pub, sec, room):
    only_room = f"?room_id=eq.{room}"

    print("room")
    expect("secret key creates a room", sec("POST", "/room", {"id": room, "name": "API test"}), 201)
    expect("publishable key can't create a room", pub("POST", "/room", {"id": f"{room}-x", "name": "x"}), 401, "42501")
    rows = expect("publishable key lists rooms", pub("GET", f"/room?id=eq.{room}"), 200)
    check("the new room is listed", rows == [{"id": room, "name": "API test"}], rows)

    print("\nroom_now (empty room)")
    rows = expect("publishable key reads room_now", pub("GET", f"/room_now{only_room}"), 200)
    row = rows[0] if rows else {}
    check(
        "no readings and no votes yet",
        row.get("ppl") is None and row.get("temp_c") is None and row.get("hot_count") == 0 and row.get("cold_count") == 0,
        row,
    )

    print("\nvote")
    expect("publishable key casts a hot vote", pub("POST", "/vote", {"room_id": room, "is_hot": True}), 201)
    expect("publishable key casts a cold vote", pub("POST", "/vote", {"room_id": room, "is_hot": False}), 201)
    expect(
        "publishable key can't backdate a vote",
        pub("POST", "/vote", {"room_id": room, "is_hot": True, "created_at": "2020-01-01T00:00:00Z"}),
        401,
        "42501",
    )
    expect("vote for an unknown room is rejected", pub("POST", "/vote", {"room_id": "no-such-room", "is_hot": True}), 409, "23503")
    expect("vote without is_hot is rejected", pub("POST", "/vote", {"room_id": room}), 400, "23502")
    old = (datetime.now(timezone.utc) - timedelta(minutes=11)).isoformat()
    expect("secret key adds an 11-minute-old vote", sec("POST", "/vote", {"room_id": room, "is_hot": True, "created_at": old}), 201)
    votes = expect("publishable key lists the room's votes", pub("GET", f"/vote{only_room}&order=created_at.desc"), 200)
    check("3 votes listed", isinstance(votes, list) and len(votes) == 3, votes)

    # change only the old vote, so the 10-minute counts checked below stay 1 hot + 1 cold
    old_id = votes[-1]["id"] if votes else 0
    expect("publishable key can't change a vote", pub("PATCH", f"/vote?id=eq.{old_id}", {"is_hot": False}), 401, "42501")
    expect("publishable key can't delete a vote", pub("DELETE", f"/vote?id=eq.{old_id}"), 401, "42501")
    expect("secret key changes a vote", sec("PATCH", f"/vote?id=eq.{old_id}", {"is_hot": False}), 204)

    print("\noccupancy_reading / temp_reading")
    expect("publishable key can't add a people count", pub("POST", "/occupancy_reading", {"room_id": room, "ppl": 1}), 401, "42501")
    expect("publishable key can't add a temperature", pub("POST", "/temp_reading", {"room_id": room, "temp_c": 20}), 401, "42501")
    expect("secret key adds a people count", sec("POST", "/occupancy_reading", {"room_id": room, "ppl": 3}), 201)
    expect("secret key adds a newer people count", sec("POST", "/occupancy_reading", {"room_id": room, "ppl": 7}), 201)
    expect("secret key adds a temperature", sec("POST", "/temp_reading", {"room_id": room, "temp_c": 23.5}), 201)
    rows = expect("publishable key reads the latest people count", pub("GET", f"/occupancy_reading{only_room}&order=created_at.desc&limit=1"), 200)
    check("latest people count is 7", bool(rows) and rows[0]["ppl"] == 7, rows)
    rows = expect("publishable key reads temperature history", pub("GET", f"/temp_reading{only_room}&order=created_at.asc"), 200)
    check("1 temperature reading", isinstance(rows, list) and len(rows) == 1, rows)

    print("\nconstraints")
    expect("negative people count is rejected", sec("POST", "/occupancy_reading", {"room_id": room, "ppl": -1}), 400, "23514")
    expect("temperature of 200 °C is rejected", sec("POST", "/temp_reading", {"room_id": room, "temp_c": 200}), 400, "23514")
    expect("room id with uppercase and '/' is rejected", sec("POST", "/room", {"id": "Bad/Id", "name": "x"}), 400, "23514")
    expect("duplicate room id is rejected", sec("POST", "/room", {"id": room, "name": "again"}), 409, "23505")

    print("\nroom_now (with data)")
    rows = expect("publishable key reads room_now", pub("GET", f"/room_now{only_room}"), 200)
    row = rows[0] if rows else {}
    check("shows the latest people count (7)", row.get("ppl") == 7, row)
    check("shows the latest temperature (23.5)", row.get("temp_c") == 23.5, row)
    check("counts 1 hot + 1 cold, ignoring the 11-minute-old vote", row.get("hot_count") == 1 and row.get("cold_count") == 1, row)

    print("\nroom update / delete")
    expect("publishable key can't rename the room", pub("PATCH", f"/room?id=eq.{room}", {"name": "x"}), 401, "42501")
    expect("secret key renames the room", sec("PATCH", f"/room?id=eq.{room}", {"name": "API test renamed"}), 204)
    expect("a room that still has rows can't be deleted", sec("DELETE", f"/room?id=eq.{room}"), 409, "23503")


def cleanup(pub, sec, room):
    print("\ncleanup")
    for table in ("vote", "occupancy_reading", "temp_reading"):
        expect(f"secret key deletes test rows from {table}", sec("DELETE", f"/{table}?room_id=eq.{room}"), 204)
    expect("secret key deletes the test room", sec("DELETE", f"/room?id=eq.{room}"), 204)
    rows = expect("publishable key confirms it's gone", pub("GET", f"/room?id=eq.{room}"), 200)
    check("test room no longer listed", rows == [], rows)


def main():
    load_env()
    url = os.environ.get("SUPABASE_URL", DEFAULT_URL)
    pub_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    sec_key = os.environ.get("SUPABASE_SECRET_KEY")
    if not pub_key or not sec_key:
        sys.exit(f"Set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in the environment or in {ENV_FILE}")

    def pub(*args):
        return call(url, pub_key, *args)

    def sec(*args):
        return call(url, sec_key, *args)

    room = f"test-{uuid.uuid4().hex[:6]}"
    print(f"Testing {url} with throwaway room '{room}'\n")
    try:
        run(pub, sec, room)
    finally:
        cleanup(pub, sec, room)

    print(f"\n{len(failures)} check(s) failed" if failures else "\nAll checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
