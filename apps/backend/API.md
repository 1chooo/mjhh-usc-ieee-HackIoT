# Backend API

There's no custom server. Supabase generates a REST API from the tables in [DBSCHEMA.md](DBSCHEMA.md), and the database's access rules decide which key can do what. Call it with plain HTTP from any language, or with `supabase-js` / `supabase-py`.

The backend serves a single room, so no call takes a room or location.

## Connecting

**Base URL:** `https://avcqkyfobsalzdzzgvqm.supabase.co/rest/v1`

**Headers:** `apikey: <key>` on every request, plus `Content-Type: application/json` when you send a body. Nothing else is needed.

| Key | Looks like | Use it in | Can do |
| --- | --- | --- | --- |
| Publishable | `sb_publishable_…` | Vote page, dashboard (browser) | Read everything, cast votes |
| Secret | `sb_secret_…` | YOLO script, AC model, device-gateway, admin scripts | Everything |

Both keys are in the Supabase Dashboard under **Project Settings → API Keys**. Never put the secret key in browser code or in a `NEXT_PUBLIC_*` variable.

```ts
// browser (apps/web/.env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
```

```python
# YOLO script or AC model (.env: SUPABASE_URL, SUPABASE_SECRET_KEY)
from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])
```

## Who can do what

| Resource | Read | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| `room_now` (view) | publishable | — | — | — |
| `vote` | publishable | **publishable** (`is_hot` only) | secret | secret |
| `occupancy_reading` | publishable | secret | secret | secret |
| `temp_reading` | publishable | secret | secret | secret |
| `setpoint` | publishable | secret | secret | secret |

Anything the publishable key can do, the secret key can do too.

## `room_now`: current state of the room

Read-only, always exactly one row. This is the main endpoint for the dashboard.

| Operation | REST | supabase-js |
| --- | --- | --- |
| Current state | `GET /room_now` | `supabase.from("room_now").select("*").single()` |

```json
[{ "ppl": 12, "ppl_at": "2026-10-24T20:51:03.12+00:00",
   "temp_c": 24.5, "temp_at": "2026-10-24T20:50:58.40+00:00",
   "hot_count": 3, "cold_count": 1,
   "target_c": 22.5, "target_at": "2026-10-24T20:30:01.07+00:00" }]
```

REST returns a one-item array. Add the header `Accept: application/vnd.pgrst.object+json` to get the object without the array, which is what `.single()` does.

`ppl`, `temp_c`, and `target_c` are `null` until the first row arrives. `hot_count` and `cold_count` cover the last 10 minutes.

## `vote`

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| Cast a vote | `POST /vote` `{"is_hot": true}` | `.from("vote").insert({ is_hot: true })` | publishable |
| Recent votes | `GET /vote?created_at=gt.2026-10-24T20:00:00Z&order=created_at.desc` | `.from("vote").select("*").gt("created_at", since).order("created_at", { ascending: false })` | publishable |
| Change one | `PATCH /vote?id=eq.42` `{"is_hot": false}` | `.from("vote").update({ is_hot: false }).eq("id", 42)` | secret |
| Delete one | `DELETE /vote?id=eq.42` | `.from("vote").delete().eq("id", 42)` | secret |

`is_hot: true` means hot and `false` means cold. The database sets `id` and `created_at`. A vote that includes `created_at` and is sent with the publishable key is rejected.

## `occupancy_reading`

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| Add a reading | `POST /occupancy_reading` `{"ppl": 7}` | `.from("occupancy_reading").insert({ ppl: 7 })` | secret |
| Add several | `POST /occupancy_reading` `[{…}, {…}]` | `.insert([{ … }, { … }])` | secret |
| Latest | `GET /occupancy_reading?order=created_at.desc&limit=1` | `.from("occupancy_reading").select("*").order("created_at", { ascending: false }).limit(1)` | publishable |
| History since a time | `GET /occupancy_reading?created_at=gte.2026-10-24T19:00:00Z&order=created_at.asc` | `.select("*").gte("created_at", since).order("created_at")` | publishable |
| Fix one | `PATCH /occupancy_reading?id=eq.42` `{"ppl": 8}` | `.update({ ppl: 8 }).eq("id", 42)` | secret |
| Delete one | `DELETE /occupancy_reading?id=eq.42` | `.delete().eq("id", 42)` | secret |

`ppl` must be 0 or more.

```python
sb.table("occupancy_reading").insert({"ppl": n}).execute()
```

## `temp_reading`

Same operations as `occupancy_reading`, with `temp_c` in place of `ppl`.

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| Add a reading | `POST /temp_reading` `{"temp_c": 23.4}` | `.from("temp_reading").insert({ temp_c: 23.4 })` | secret |
| Latest | `GET /temp_reading?order=created_at.desc&limit=1` | `.from("temp_reading").select("*").order("created_at", { ascending: false }).limit(1)` | publishable |
| History since a time | `GET /temp_reading?created_at=gte.2026-10-24T19:00:00Z&order=created_at.asc` | `.select("*").gte("created_at", since).order("created_at")` | publishable |
| Fix / delete one | `PATCH` / `DELETE /temp_reading?id=eq.42` | `.update({ temp_c: 23.0 }).eq("id", 42)` / `.delete().eq("id", 42)` | secret |

`temp_c` must be between −40 and 85 °C.

## `setpoint`

AC target temperatures predicted by the model in `apps/alg`, one row per prediction.

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| Save a prediction | `POST /setpoint` `{"target_c": 22.5}` | `.from("setpoint").insert({ target_c: 22.5 })` | secret |
| Latest | `GET /setpoint?order=created_at.desc&limit=1` | `.from("setpoint").select("*").order("created_at", { ascending: false }).limit(1)` | publishable |
| History since a time | `GET /setpoint?created_at=gte.2026-10-24T19:00:00Z&order=created_at.asc` | `.select("*").gte("created_at", since).order("created_at")` | publishable |
| Fix / delete one | `PATCH` / `DELETE /setpoint?id=eq.42` | `.update({ target_c: 23 }).eq("id", 42)` / `.delete().eq("id", 42)` | secret |

`target_c` must be between 16 and 30 °C, the same range the model clamps to.

In `apps/alg/main.py`, save each target next to `set_ac(target)`. `run_preset` can return `None`, so skip the insert then.

```python
sb.table("setpoint").insert({"target_c": target}).execute()
```

The gateway can pick up each new target the moment it's saved and forward it to the AC:

```ts
sb.channel("setpoints")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "setpoint" },
      ({ new: row }) => sendToAc(row.target_c))   // sendToAc: your DeviceCommand "set" call
  .subscribe();
```

## Filters and options

| You want | REST query | supabase-js |
| --- | --- | --- |
| Equal / not equal | `col=eq.x` / `col=neq.x` | `.eq()` / `.neq()` |
| Greater / less than | `col=gt.x`, `gte`, `lt`, `lte` | `.gt()`, `.gte()`, `.lt()`, `.lte()` |
| One of several | `id=in.(41,42,43)` | `.in("id", [41, 42, 43])` |
| Sort | `order=created_at.desc` | `.order("created_at", { ascending: false })` |
| Page | `limit=50&offset=100` | `.range(100, 149)` |
| Only some columns | `select=ppl,created_at` | `.select("ppl, created_at")` |
| Get the new row back after insert | header `Prefer: return=representation` | `.insert({...}).select()` |

A request returns at most 1,000 rows. At one YOLO reading every 5 seconds, that's about 80 minutes of history.

## Errors

Error bodies look like `{"code": "...", "message": "...", "details": "..."}`.

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 401 | `42501` | This key isn't allowed to do that. For example, the publishable key writing a reading, or sending `created_at` with a vote. |
| 400 | `23514` | A value is out of range: `ppl < 0`, `temp_c` outside −40..85, or `target_c` outside 16..30. |
| 400 | `23502` | A required field is missing. |

## Live updates

Views can't be subscribed to, so listen to the tables and refetch `room_now` whenever something lands.

```ts
supabase
  .channel("room-now")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "vote" }, refetch)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "occupancy_reading" }, refetch)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "temp_reading" }, refetch)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "setpoint" }, refetch)
  .subscribe();
```
