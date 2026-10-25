"""Test the Supabase REST API described in ../API.md against the live project.

Runs every documented call with both keys and checks the access rules and
constraints. The backend serves one room, so the test writes into the live
tables, keeps the ids of every row it adds, and deletes exactly those rows at
the end. Existing data is left alone, but run it while the Pi isn't writing:
a row that lands mid-run would change the "latest" values it checks.

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
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
DEFAULT_URL = "https://avcqkyfobsalzdzzgvqm.supabase.co"
TABLES = ("vote", "record", "setpoint", "saving")

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
    return status, json.loads(raw, parse_float=Decimal) if raw else None  # Decimal keeps saved_usd exact


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


def latest(pub, table):
    rows = pub("GET", f"/{table}?order=created_at.desc&limit=1")[1]
    return rows[0] if isinstance(rows, list) and rows else {}


def run(pub, sec):
    print("removed")
    for name in ("room_now", "occupancy_reading", "temp_reading"):
        expect(f"{name} is gone", pub("GET", f"/{name}"), 404, "PGRST205")

    print("\nvote inbox")
    since = quote(latest(pub, "record").get("created_at") or "1970-01-01T00:00:00Z")  # '+00:00' must not become a space
    before = expect("publishable key reads votes since the last record", pub("GET", f"/vote?created_at=gt.{since}&select=id"), 200)
    add("publishable key casts a hot vote", pub, "vote", {"is_hot": True})
    add("publishable key casts a cold vote", pub, "vote", {"is_hot": False})
    after = expect("publishable key reads votes again", pub("GET", f"/vote?created_at=gt.{since}&select=id,is_hot"), 200)
    new = [v for v in after or [] if v["id"] in created["vote"]]
    check(
        "the window since the last record holds both new votes",
        len(after or []) - len(before or []) == 2 and sorted(v["is_hot"] for v in new) == [False, True],
        after,
    )
    expect(
        "publishable key can't backdate a vote",
        pub("POST", "/vote", {"is_hot": True, "created_at": "2020-01-01T00:00:00Z"}),
        401,
        "42501",
    )
    expect("vote without is_hot is rejected", pub("POST", "/vote", {}), 400, "23502")
    vote_id = created["vote"][0] if created["vote"] else 0
    expect("publishable key can't change a vote", pub("PATCH", f"/vote?id=eq.{vote_id}", {"is_hot": False}), 401, "42501")
    expect("publishable key can't delete a vote", pub("DELETE", f"/vote?id=eq.{vote_id}"), 401, "42501")
    expect("secret key changes a vote", sec("PATCH", f"/vote?id=eq.{vote_id}", {"is_hot": False}), 204)

    print("\nrecord")
    expect("publishable key can't add a record", pub("POST", "/record", {"ppl": 1}), 401, "42501")
    no_temp = add("secret key adds a record without a temperature", sec, "record", {"ppl": 5, "temp_c": None})
    check("temp_c is null and the vote counts default to 0", no_temp.get("temp_c") is None and no_temp.get("hot_count") == 0 and no_temp.get("cold_count") == 0, no_temp)
    full = add("secret key adds a full record", sec, "record", {"ppl": 7, "temp_c": 23.5, "hot_count": 2, "cold_count": 1})
    row = latest(pub, "record")
    check("publishable key reads it as the latest record", row.get("id") == full.get("id") and row.get("ppl") == 7, row)
    check("with temp 23.5, hot 2, cold 1", row.get("temp_c") == Decimal("23.5") and row.get("hot_count") == 2 and row.get("cold_count") == 1, row)
    record_id = full.get("id", 0)
    expect("publishable key can't change a record", pub("PATCH", f"/record?id=eq.{record_id}", {"ppl": 0}), 401, "42501")
    expect("publishable key can't delete a record", pub("DELETE", f"/record?id=eq.{record_id}"), 401, "42501")
    expect("secret key fixes a record", sec("PATCH", f"/record?id=eq.{record_id}", {"ppl": 8}), 204)

    print("\nsetpoint")
    expect("publishable key can't add a target", pub("POST", "/setpoint", {"target_c": 22}), 401, "42501")
    add("secret key adds a target", sec, "setpoint", {"target_c": 22.5})
    newer = add("secret key adds a newer target", sec, "setpoint", {"target_c": 23})
    row = latest(pub, "setpoint")
    check("publishable key reads 23 as the latest target", row.get("id") == newer.get("id") and row.get("target_c") == 23, row)

    print("\nsaving")
    expect("publishable key can't add a saving", pub("POST", "/saving", {"saved_usd": 1}), 401, "42501")
    add("secret key adds a saving of $0.0750", sec, "saving", {"saved_usd": 0.075})
    add("secret key adds a negative saving of -$0.0125", sec, "saving", {"saved_usd": -0.0125})
    ids = ",".join(map(str, created["saving"]))
    rows = expect("publishable key reads them back", pub("GET", f"/saving?id=in.({ids})&select=saved_usd"), 200)
    total = sum(Decimal(str(r["saved_usd"])) for r in rows or [])
    check("they add up to exactly $0.0625", total == Decimal("0.0625"), rows)

    print("\nconstraints")
    expect("negative people count is rejected", sec("POST", "/record", {"ppl": -1}), 400, "23514")
    expect("negative hot count is rejected", sec("POST", "/record", {"ppl": 1, "hot_count": -1}), 400, "23514")
    expect("temperature of 200 °C is rejected", sec("POST", "/record", {"ppl": 1, "temp_c": 200}), 400, "23514")
    expect("record without ppl is rejected", sec("POST", "/record", {"temp_c": 22}), 400, "23502")
    expect("target outside 16–30 °C is rejected", sec("POST", "/setpoint", {"target_c": 35}), 400, "23514")
    expect("saving without saved_usd is rejected", sec("POST", "/saving", {}), 400, "23502")


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
