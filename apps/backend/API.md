# Backend API

There's no custom server. Supabase generates a REST API from the tables in [DBSCHEMA.md](DBSCHEMA.md), and the database's access rules decide which key can do what. Call it with plain HTTP from any language, or with `supabase-js` / `supabase-py`.

The backend serves a single room, so no call takes a room or location.

## Connecting

**Base URL:** `https://avcqkyfobsalzdzzgvqm.supabase.co/rest/v1`

**Headers:** `apikey: <key>` on every request, plus `Content-Type: application/json` when you send a body. Nothing else is needed.

| Key | Looks like | Use it in | Can do |
| --- | --- | --- | --- |
| Publishable | `sb_publishable_…` | Vote page, dashboard (browser) | Read everything, cast votes |
| Secret | `sb_secret_…` | Raspberry Pi (`apps/alg`), admin scripts | Everything |

Both keys are in the Supabase Dashboard under **Project Settings → API Keys**. Never put the secret key in browser code or in a `NEXT_PUBLIC_*` variable.

```ts
// browser (apps/web/.env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
```

```python
# Raspberry Pi (.env: SUPABASE_URL, SUPABASE_SECRET_KEY)
from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])
```

## Who can do what

| Resource | Read | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| `record` | publishable | secret | secret | secret |
| `vote` | publishable | **publishable** (`is_hot` only) | secret | secret |
| `setpoint` | publishable | secret | secret | secret |
| `saving` | publishable | secret | secret | secret |

Anything the publishable key can do, the secret key can do too.

## `record`: one snapshot per Pi cycle

The newest row holds the room's current readings. This is the main endpoint for the dashboard.

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| Current state | `GET /record?order=created_at.desc&limit=1` | `.from("record").select("*").order("created_at", { ascending: false }).limit(1).single()` | publishable |
| History since a time | `GET /record?created_at=gte.2026-10-24T19:00:00Z&order=created_at.asc` | `.from("record").select("*").gte("created_at", since).order("created_at")` | publishable |
| Save a snapshot | `POST /record` `{"ppl": 36, "temp_c": 21.4}` | `.from("record").insert({ ppl: 36, temp_c: 21.4 })` | secret |
| Fix / delete one | `PATCH` / `DELETE /record?id=eq.42` | `.update({ ppl: 35 }).eq("id", 42)` / `.delete().eq("id", 42)` | secret |

```json
[{ "id": 13, "ppl": 36, "temp_c": 21.4, "created_at": "2026-10-25T08:10:00.12+00:00" }]
```

- `ppl` is required and must be 0 or more.
- `temp_c` can be `null` (the DHT11 read failed). Otherwise it must be between −40 and 85 °C.
- There are no vote counts here. They come from `vote`, below.

## `vote`: the vote inbox

The vote page drops one row per tap here. Votes are grouped by time: the votes after the latest `record` are the live count for the next cycle, and a past cycle counted the votes between its `record` and the one before it.

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| Cast a vote | `POST /vote` `{"is_hot": true}` | `.from("vote").insert({ is_hot: true })` | publishable |
| Votes since the latest record | `GET /vote?created_at=gt.<latest record's created_at>&select=is_hot` | `.from("vote").select("is_hot").gt("created_at", latestAt)` | publishable |
| Votes a past cycle counted | `GET /vote?created_at=gt.<previous record's created_at>&created_at=lte.<that record's created_at>&select=is_hot` | `.select("is_hot").gt("created_at", previousAt).lte("created_at", recordAt)` | publishable |
| Votes between two times | `GET /vote?created_at=gte.2026-10-25T07:50:53.007145Z&created_at=lte.2026-10-25T08:12:01.237115Z&order=created_at.asc` | `.select("*").gte("created_at", from).lte("created_at", to).order("created_at")` | publishable |
| Change / delete one | `PATCH` / `DELETE /vote?id=eq.42` | `.update({ is_hot: false }).eq("id", 42)` / `.delete().eq("id", 42)` | secret |

Count them on the client: rows with `is_hot: true` are hot, the rest are cold. For a time range, `gte` / `lte` include both ends; use `gt` / `lt` to leave an end out. The database sets `id` and `created_at`. A vote that includes `created_at` and is sent with the publishable key is rejected.

## `setpoint`: the model's target temperature

One row per prediction by the model in `apps/alg`.

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| Latest | `GET /setpoint?order=created_at.desc&limit=1` | `.from("setpoint").select("*").order("created_at", { ascending: false }).limit(1)` | publishable |
| History since a time | `GET /setpoint?created_at=gte.2026-10-24T19:00:00Z&order=created_at.asc` | `.select("*").gte("created_at", since).order("created_at")` | publishable |
| Save a prediction | `POST /setpoint` `{"target_c": 22.5}` | `.from("setpoint").insert({ target_c: 22.5 })` | secret |
| Fix / delete one | `PATCH` / `DELETE /setpoint?id=eq.42` | `.update({ target_c: 23 }).eq("id", 42)` / `.delete().eq("id", 42)` | secret |

`target_c` must be between 16 and 30 °C, the same range the model clamps to.

## `saving`: dollars saved per cycle

One row per cycle with the money saved in that cycle, compared with a fixed setpoint. It's negative when the policy used more.

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| All rows | `GET /saving?select=saved_usd,created_at&order=created_at.asc` | `.from("saving").select("saved_usd, created_at").order("created_at")` | publishable |
| Since a time | `GET /saving?created_at=gte.2026-10-25T00:00:00Z` | `.select("*").gte("created_at", since)` | publishable |
| Save one | `POST /saving` `{"saved_usd": 0.0125}` | `.from("saving").insert({ saved_usd: 0.0125 })` | secret |
| Fix / delete one | `PATCH` / `DELETE /saving?id=eq.42` | `.update({ saved_usd: 0.01 }).eq("id", 42)` / `.delete().eq("id", 42)` | secret |

`saved_usd` keeps 4 decimal places, because a cycle's savings are often a fraction of a cent. There's no total column: add the rows up on the client. A request returns at most 1,000 rows, which is about 41 days of hourly cycles.

```ts
const { data } = await supabase.from("saving").select("saved_usd");
const totalUsd = (data ?? []).reduce((sum, row) => sum + Number(row.saved_usd), 0);
```

## The Pi's cycle (`apps/alg/main.py`)

`run_cycle` already gathers everything `record` needs. Read the votes from the inbox, then save the three rows after the model runs:

```python
def read_votes() -> tuple[int, int]:
    """Votes cast since the last saved record -> (hot, cold)."""
    last = sb.table("record").select("created_at").order("created_at", desc=True).limit(1).execute().data
    since = last[0]["created_at"] if last else "1970-01-01T00:00:00Z"
    votes = sb.table("vote").select("is_hot").gt("created_at", since).execute().data
    hot = sum(1 for v in votes if v["is_hot"])
    return hot, len(votes) - hot

# in run_cycle, after target = model.update(...)
sb.table("record").insert({"ppl": n, "temp_c": temp}).execute()
sb.table("setpoint").insert({"target_c": target}).execute()
sb.table("saving").insert({"saved_usd": saved}).execute()   # saved: your estimate for this cycle
```

A vote cast in the second between counting and saving the record is missed by the model. That's fine for comfort votes.

## Filters and options

| You want | REST query | supabase-js |
| --- | --- | --- |
| Equal / not equal | `col=eq.x` / `col=neq.x` | `.eq()` / `.neq()` |
| Greater / less than | `col=gt.x`, `gte`, `lt`, `lte` | `.gt()`, `.gte()`, `.lt()`, `.lte()` |
| Between two values | `col=gte.a&col=lte.b` (repeat the column) | `.gte("col", a).lte("col", b)` |
| One of several | `id=in.(41,42,43)` | `.in("id", [41, 42, 43])` |
| Sort | `order=created_at.desc` | `.order("created_at", { ascending: false })` |
| Page | `limit=50&offset=100` | `.range(100, 149)` |
| Only some columns | `select=ppl,created_at` | `.select("ppl, created_at")` |
| Get the new row back after insert | header `Prefer: return=representation` | `.insert({...}).select()` |

**Timestamps in a raw URL:** write them as ISO 8601 with `Z`, like `2026-10-25T07:50:53.007145Z`. The Postgres format works too (`2026-10-25 07:50:53.007145+00`), but encode its space as `%20` and its `+` as `%2B`. Otherwise the `+` turns into a space. supabase-js and supabase-py encode timestamps for you.

## Errors

Error bodies look like `{"code": "...", "message": "...", "details": "..."}`.

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 401 | `42501` | This key isn't allowed to do that. For example, the publishable key writing a record, or sending `created_at` with a vote. |
| 400 | `23514` | A value is out of range: negative `ppl`, `temp_c` outside −40..85, or `target_c` outside 16..30. |
| 400 | `23502` | A required field is missing (`ppl`, `is_hot`, `target_c`, `saved_usd`). |
| 400 | `PGRST204` | A column that doesn't exist, for example `hot_count` on `record`. Vote counts come from `vote`. |

## Live updates

Each new `record` row has the latest readings, so the dashboard can show it straight from the event. New `vote` rows add to the live count, which starts over at zero when the next `record` arrives:

```ts
supabase
  .channel("live")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "record" }, ({ new: row }) => setCurrent(row))
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "vote" }, ({ new: row }) => countVote(row))
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "setpoint" }, ({ new: row }) => setTarget(row))
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "saving" }, ({ new: row }) => addSaving(row))
  .subscribe();
```

The gateway can listen to `setpoint` the same way, and forward each new `target_c` to the AC.
