"""Test the Supabase REST API described in ../API.md against the live project.

Runs every documented call with both keys and checks the access rules and
constraints. The backend serves one room, so the test writes into the live
tables, keeps the ids of every row it adds, and deletes exactly those rows at
the end. Existing data is left alone, but run it while no sensor is writing:
a reading that lands mid-run would change the "latest" values it checks.

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
from datetime import datetime, timedelta, timezone
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
DEFAULT_URL = "https://avcqkyfobsalzdzzgvqm.supabase.co"
TABLES = ("vote", "occupancy_reading", "temp_reading", "setpoint")

failures = []
created = {table: [] for table in TABLES}


def load_env():
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def call(url, key, method, path, body=None):
    headers = {"apikey": key, "Content-Type": "application/json"}
    if method == "POST":
        headers["Prefer"] = "return=representation"  # get the new row back, so its id can be cleaned up
    req = urllib.request.Request(
        url.rstrip("/") + "/rest/v1" + path,
        method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers=headers,
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


def add(name, client, table, row):
    """Insert one row that should succeed, and remember its id for cleanup."""
    body = expect(name, client("POST", f"/{table}", row), 201)
    if isinstance(body, list) and body:
        created[table].append(body[0]["id"])
        return body[0]
    return {}


def now_row(pub):
    rows = pub("GET", "/room_now")[1]
    return rows[0] if isinstance(rows, list) and len(rows) == 1 else {}


def vote_delta(pub, action, expected):
    """Run action and return how room_now's (hot, cold) counts moved. Seeded votes can age out
    of the 10-minute window mid-run, so retry a couple of times before calling it a failure."""
    delta = None
    for _ in range(3):
        before = now_row(pub)
        action()
        after = now_row(pub)
        delta = (after.get("hot_count", 0) - before.get("hot_count", 0), after.get("cold_count", 0) - before.get("cold_count", 0))
        if delta == expected:
            break
    return delta


def run(pub, sec):
    print("room_now")
    rows = expect("publishable key reads room_now", pub("GET", "/room_now"), 200)
    check("always exactly one row", isinstance(rows, list) and len(rows) == 1, rows)
    row = rows[0] if rows else {}
    check(
        "has no room columns",
        set(row) == {"ppl", "ppl_at", "temp_c", "temp_at", "hot_count", "cold_count", "target_c", "target_at"},
        sorted(row),
    )
    expect("the room table is gone", pub("GET", "/room"), 404, "PGRST205")

    print("\nvote")
    delta = vote_delta(
        pub,
        lambda: (
            add("publishable key casts a hot vote", pub, "vote", {"is_hot": True}),
            add("publishable key casts a cold vote", pub, "vote", {"is_hot": False}),
        ),
        (1, 1),
    )
    check("room_now counts both new votes", delta == (1, 1), delta)
    expect(
        "publishable key can't backdate a vote",
        pub("POST", "/vote", {"is_hot": True, "created_at": "2020-01-01T00:00:00Z"}),
        401,
        "42501",
    )
    expect("vote without is_hot is rejected", pub("POST", "/vote", {}), 400, "23502")
    old = (datetime.now(timezone.utc) - timedelta(minutes=11)).isoformat()
    old_vote = {}

    def add_old():
        old_vote.update(add("secret key adds an 11-minute-old vote", sec, "vote", {"is_hot": True, "created_at": old}))

    delta = vote_delta(pub, add_old, (0, 0))
    check("room_now ignores the 11-minute-old vote", delta == (0, 0), delta)
    ids = ",".join(map(str, created["vote"]))
    votes = expect("publishable key lists the test votes", pub("GET", f"/vote?id=in.({ids})&order=created_at.desc"), 200)
    check(f"{len(created['vote'])} test votes listed", isinstance(votes, list) and len(votes) == len(created["vote"]), votes)

    old_id = old_vote.get("id", 0)
    expect("publishable key can't change a vote", pub("PATCH", f"/vote?id=eq.{old_id}", {"is_hot": False}), 401, "42501")
    expect("publishable key can't delete a vote", pub("DELETE", f"/vote?id=eq.{old_id}"), 401, "42501")
    expect("secret key changes a vote", sec("PATCH", f"/vote?id=eq.{old_id}", {"is_hot": False}), 204)

    print("\noccupancy_reading / temp_reading")
    expect("publishable key can't add a people count", pub("POST", "/occupancy_reading", {"ppl": 1}), 401, "42501")
    expect("publishable key can't add a temperature", pub("POST", "/temp_reading", {"temp_c": 20}), 401, "42501")
    add("secret key adds a people count", sec, "occupancy_reading", {"ppl": 3})
    latest_ppl = add("secret key adds a newer people count", sec, "occupancy_reading", {"ppl": 7})
    latest_temp = add("secret key adds a temperature", sec, "temp_reading", {"temp_c": 23.5})
    rows = expect("publishable key reads the latest people count", pub("GET", "/occupancy_reading?order=created_at.desc&limit=1"), 200)
    check("latest people count is 7", bool(rows) and rows[0]["ppl"] == 7, rows)
    ids = ",".join(map(str, created["temp_reading"]))
    rows = expect("publishable key reads temperature by id", pub("GET", f"/temp_reading?id=in.({ids})"), 200)
    check("1 test temperature reading", isinstance(rows, list) and len(rows) == 1, rows)

    print("\nsetpoint")
    expect("publishable key can't add a target", pub("POST", "/setpoint", {"target_c": 22}), 401, "42501")
    add("secret key adds a target", sec, "setpoint", {"target_c": 22.5})
    latest_target = add("secret key adds a newer target", sec, "setpoint", {"target_c": 23})
    rows = expect("publishable key reads the latest target", pub("GET", "/setpoint?order=created_at.desc&limit=1"), 200)
    check("latest target is 23", bool(rows) and rows[0]["target_c"] == 23, rows)

    print("\nconstraints")
    expect("negative people count is rejected", sec("POST", "/occupancy_reading", {"ppl": -1}), 400, "23514")
    expect("temperature of 200 °C is rejected", sec("POST", "/temp_reading", {"temp_c": 200}), 400, "23514")
    expect("target outside 16–30 °C is rejected", sec("POST", "/setpoint", {"target_c": 35}), 400, "23514")

    print("\nroom_now (latest values)")
    row = now_row(pub)
    check("shows the latest people count (7)", row.get("ppl") == 7 and row.get("ppl_at") == latest_ppl.get("created_at"), row)
    check("shows the latest temperature (23.5)", row.get("temp_c") == 23.5 and row.get("temp_at") == latest_temp.get("created_at"), row)
    check("shows the latest target (23)", row.get("target_c") == 23 and row.get("target_at") == latest_target.get("created_at"), row)


def cleanup(pub, sec):
    print("\ncleanup")
    for table in TABLES:
        if not created[table]:
            continue
        ids = ",".join(map(str, created[table]))
        expect(f"secret key deletes {len(created[table])} test row(s) from {table}", sec("DELETE", f"/{table}?id=in.({ids})"), 204)
        rows = expect(f"publishable key confirms they're gone from {table}", pub("GET", f"/{table}?id=in.({ids})"), 200)
        check(f"no test rows left in {table}", rows == [], rows)


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

    print(f"Testing {url}\n")
    try:
        run(pub, sec)
    finally:
        cleanup(pub, sec)

    print(f"\n{len(failures)} check(s) failed" if failures else "\nAll checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
