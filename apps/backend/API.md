# Backend API

There's no custom server. Supabase generates a REST API from the tables in [DBSCHEMA.md](DBSCHEMA.md), and the database's access rules decide which key can do what. Call it with plain HTTP from any language, or with `supabase-js` / `supabase-py`.

## Connecting

**Base URL:** `https://avcqkyfobsalzdzzgvqm.supabase.co/rest/v1`

**Headers:** `apikey: <key>` on every request, plus `Content-Type: application/json` when you send a body. Nothing else is needed.

| Key | Looks like | Use it in | Can do |
| --- | --- | --- | --- |
| Publishable | `sb_publishable_…` | Vote page, dashboard (browser) | Read everything, cast votes |
| Secret | `sb_secret_…` | YOLO script, device-gateway, admin scripts | Everything |

Both keys are in the Supabase Dashboard under **Project Settings → API Keys**. Never put the secret key in browser code or in a `NEXT_PUBLIC_*` variable.

```ts
// browser (apps/web/.env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
```

```python
# YOLO script (.env: SUPABASE_URL, SUPABASE_SECRET_KEY)
from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])
```

## Who can do what

| Resource | Read | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| `room_now` (view) | publishable | — | — | — |
| `room` | publishable | secret | secret | secret |
| `vote` | publishable | **publishable** (`room_id`, `is_hot` only) | secret | secret |
| `occupancy_reading` | publishable | secret | secret | secret |
| `temp_reading` | publishable | secret | secret | secret |

Anything the publishable key can do, the secret key can do too.

## `room_now`: current state of every room

Read-only. This is the main endpoint for the dashboard and the algorithm.

| Operation | REST | supabase-js |
| --- | --- | --- |
| All rooms | `GET /room_now` | `supabase.from("room_now").select("*")` |
| One room | `GET /room_now?room_id=eq.lab-101` | `supabase.from("room_now").select("*").eq("room_id", "lab-101").single()` |

```json
[{ "room_id": "lab-101", "name": "Lab 101",
   "ppl": 12, "ppl_at": "2026-10-24T20:51:03.12+00:00",
   "temp_c": 24.5, "temp_at": "2026-10-24T20:50:58.40+00:00",
   "hot_count": 3, "cold_count": 1 }]
```

`ppl` and `temp_c` are `null` until the first reading arrives. `hot_count` and `cold_count` cover the last 10 minutes.

## `room`

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| List | `GET /room` | `.from("room").select("*")` | publishable |
| Create | `POST /room` `{"id": "lab-101", "name": "Lab 101"}` | `.from("room").insert({ id: "lab-101", name: "Lab 101" })` | secret |
| Rename | `PATCH /room?id=eq.lab-101` `{"name": "Lab 101A"}` | `.from("room").update({ name: "Lab 101A" }).eq("id", "lab-101")` | secret |
| Delete | `DELETE /room?id=eq.lab-101` | `.from("room").delete().eq("id", "lab-101")` | secret |

The database starts with no rooms. Create them with the secret key, or in the Dashboard's SQL editor: `insert into room (id, name) values ('lab-101', 'Lab 101');`. A room id can only contain lowercase letters, digits and `-`, because it's also the MQTT `deviceId`. You can't delete a room that still has votes or readings, so delete those first.

## `vote`

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| Cast a vote | `POST /vote` `{"room_id": "lab-101", "is_hot": true}` | `.from("vote").insert({ room_id: "lab-101", is_hot: true })` | publishable |
| Recent votes for a room | `GET /vote?room_id=eq.lab-101&created_at=gt.2026-10-24T20:00:00Z&order=created_at.desc` | `.from("vote").select("*").eq("room_id", "lab-101").gt("created_at", since).order("created_at", { ascending: false })` | publishable |
| Change one | `PATCH /vote?id=eq.42` `{"is_hot": false}` | `.from("vote").update({ is_hot: false }).eq("id", 42)` | secret |
| Delete one | `DELETE /vote?id=eq.42` | `.from("vote").delete().eq("id", 42)` | secret |

`is_hot: true` means hot and `false` means cold. The database sets `id` and `created_at`. A vote that includes `created_at` and is sent with the publishable key is rejected.

## `occupancy_reading`

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| Add a reading | `POST /occupancy_reading` `{"room_id": "lab-101", "ppl": 7}` | `.from("occupancy_reading").insert({ room_id: "lab-101", ppl: 7 })` | secret |
| Add several | `POST /occupancy_reading` `[{…}, {…}]` | `.insert([{ … }, { … }])` | secret |
| Latest for a room | `GET /occupancy_reading?room_id=eq.lab-101&order=created_at.desc&limit=1` | `.from("occupancy_reading").select("*").eq("room_id", "lab-101").order("created_at", { ascending: false }).limit(1)` | publishable |
| History since a time | `GET /occupancy_reading?room_id=eq.lab-101&created_at=gte.2026-10-24T19:00:00Z&order=created_at.asc` | `.select("*").eq("room_id", "lab-101").gte("created_at", since).order("created_at")` | publishable |
| Fix one | `PATCH /occupancy_reading?id=eq.42` `{"ppl": 8}` | `.update({ ppl: 8 }).eq("id", 42)` | secret |
| Delete one | `DELETE /occupancy_reading?id=eq.42` | `.delete().eq("id", 42)` | secret |

`ppl` must be 0 or more.

```python
sb.table("occupancy_reading").insert({"room_id": "lab-101", "ppl": n}).execute()
```

## `temp_reading`

Same operations as `occupancy_reading`, with `temp_c` in place of `ppl`.

| Operation | REST | supabase-js | Key |
| --- | --- | --- | --- |
| Add a reading | `POST /temp_reading` `{"room_id": "lab-101", "temp_c": 23.4}` | `.from("temp_reading").insert({ room_id: "lab-101", temp_c: 23.4 })` | secret |
| Latest for a room | `GET /temp_reading?room_id=eq.lab-101&order=created_at.desc&limit=1` | `.from("temp_reading").select("*").eq("room_id", "lab-101").order("created_at", { ascending: false }).limit(1)` | publishable |
| History since a time | `GET /temp_reading?room_id=eq.lab-101&created_at=gte.2026-10-24T19:00:00Z&order=created_at.asc` | `.select("*").eq("room_id", "lab-101").gte("created_at", since).order("created_at")` | publishable |
| Fix / delete one | `PATCH` / `DELETE /temp_reading?id=eq.42` | `.update({ temp_c: 23.0 }).eq("id", 42)` / `.delete().eq("id", 42)` | secret |

`temp_c` must be between −40 and 85 °C.

## Filters and options

| You want | REST query | supabase-js |
| --- | --- | --- |
| Equal / not equal | `col=eq.x` / `col=neq.x` | `.eq()` / `.neq()` |
| Greater / less than | `col=gt.x`, `gte`, `lt`, `lte` | `.gt()`, `.gte()`, `.lt()`, `.lte()` |
| One of several | `col=in.(lab-101,lab-102)` | `.in("col", [...])` |
| Sort | `order=created_at.desc` | `.order("created_at", { ascending: false })` |
| Page | `limit=50&offset=100` | `.range(100, 149)` |
| Only some columns | `select=room_id,ppl` | `.select("room_id, ppl")` |
| Get the new row back after insert | header `Prefer: return=representation` | `.insert({...}).select()` |

A request returns at most 1,000 rows. At one YOLO reading every 5 seconds, that's about 80 minutes of history for one room.

## Errors

Error bodies look like `{"code": "...", "message": "...", "details": "..."}`.

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 401 | `42501` | This key isn't allowed to do that. For example, the publishable key writing a reading, or sending `created_at` with a vote. |
| 409 | `23503` | `room_id` doesn't exist, or you're deleting a room that still has rows. |
| 409 | `23505` | That room id already exists. |
| 400 | `23514` | A value is out of range: `ppl < 0`, `temp_c` outside −40..85, or a room id with uppercase letters, spaces or `/`. |
| 400 | `23502` | A required field is missing. |

## Live updates

Views can't be subscribed to, so listen to the tables and refetch `room_now` whenever something lands.

```ts
supabase
  .channel("room-now")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "vote" }, refetch)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "occupancy_reading" }, refetch)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "temp_reading" }, refetch)
  .subscribe();
```

Add `filter: "room_id=eq.lab-101"` to any of them to follow a single room.
