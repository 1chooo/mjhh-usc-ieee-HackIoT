# Database Schema

Four tables and one view in Supabase (Postgres). Sensors and the vote page insert rows. Everyone reads the current state of each room from the `room_now` view.

```
YOLO camera    ──insert──▶ occupancy_reading ─┐
ESP32 gateway  ──insert──▶ temp_reading      ─┼─▶ room_now (view) ──▶ dashboard, algorithm
Vote page      ──insert──▶ vote              ─┘
                           every row points at a room
```

## Tables

### `room`

One row per room, rarely changes. Starts empty: add rooms with the secret key (see [API.md](API.md#room)).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` primary key | e.g. `'lab-101'`. Same string as `deviceId` in the MQTT topics. Lowercase letters, digits, and `-` only. |
| `name` | `text` not null | Display name, e.g. `'Lab 101'` |

### `vote`

One row per tap on the vote page.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | |
| `room_id` | `text` not null → `room.id` | |
| `is_hot` | `boolean` not null | `true` = hot, `false` = cold |
| `created_at` | `timestamptz` not null, default `now()` | Set by the database, clients can't override it |

### `occupancy_reading`

One row per people count from YOLO.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | |
| `room_id` | `text` not null → `room.id` | |
| `ppl` | `smallint` not null, `>= 0` | People in the room |
| `created_at` | `timestamptz` not null, default `now()` | |

### `temp_reading`

One row per temperature reading from an ESP32.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | |
| `room_id` | `text` not null → `room.id` | |
| `temp_c` | `real` not null, between −40 and 85 | °C. The range matches common ESP32 sensors and rejects garbage readings. |
| `created_at` | `timestamptz` not null, default `now()` | |

Each of the three reading tables has one index on `(room_id, created_at desc)` that also includes its value column. "Latest reading for a room" and "votes in the last 10 minutes" are then answered from the index alone, without touching the table.

## View: `room_now`

One row per room with everything current. This is the main thing the frontend reads.

| Column | Meaning |
| --- | --- |
| `room_id`, `name` | From `room` |
| `ppl`, `ppl_at` | Latest people count and when it was taken |
| `temp_c`, `temp_at` | Latest temperature and when it was taken |
| `hot_count`, `cold_count` | Votes in the last 10 minutes (0 if none) |

`ppl` and `temp_c` are `null` until the first reading arrives.

## Who can read and write

| Who | Key | Reads | Writes |
| --- | --- | --- | --- |
| Vote page, dashboard (browser) | publishable key | everything | `vote` only, and only `room_id` and `is_hot` |
| YOLO script, device-gateway | secret key | everything | everything |

Row Level Security is on for every table. The secret key bypasses it, so it must never go into browser code or a `NEXT_PUBLIC_*` variable.

## Using it

See [API.md](API.md) for every endpoint, with REST and supabase-js examples.

## Changes from the original sketch

| Original | Now | Why |
| --- | --- | --- |
| `client` with `hot_count`, `cold_count` | `vote`, one row per tap | supabase-js can't increment a counter in one step, so two taps at the same moment could overwrite each other. Counters also never expire. Single rows can't collide, and counting the last 10 minutes is cheap with the index. |
| No "ok" vote | Still none | `ppl` already gives the number of people in the room, so "ok" adds nothing. |
| `space` with `name`, `ppl` | `room` (name) + `occupancy_reading` (ppl) | The name never changes and `ppl` changes every few seconds. Together, the name would repeat on every reading. |
| `tmp_record.place` | `temp_reading.room_id` → `room` | A typo can't create a room that doesn't exist. |
| `time_stamp` | `created_at`, filled in by the database | Clients can't send a wrong or faked time. |

Every table keeps a plain `id`. Using `(room_id, created_at)` as the key would save one index, but two votes landing in the same microsecond would then be rejected.

## Open questions

1. **Charts.** If the dashboard needs history, it can query the reading tables directly for short windows. The API returns at most 1,000 rows per request, and at one YOLO reading every 5 seconds that's about 80 minutes. Longer charts need a small SQL function that returns one row per minute.
2. **Setpoint.** The AC setpoint isn't stored. If the dashboard should show it, or show why the algorithm picked it, add a `setpoint` table.
3. **Vote spam.** Anyone with the page open can vote as often as they like. If that matters for the demo, add anonymous sign-in, a `user_id` column, and a one-vote-per-minute rule.
4. **Vote window.** Votes count for 10 minutes. Change the interval in `room_now` to tune it.

## SQL and changing the schema

The schema lives in [`supabase/migrations/20261024204729_init_schema.sql`](supabase/migrations/20261024204729_init_schema.sql), and that migration is applied to the hosted project. Change the schema only through new migration files, never by editing tables in the Dashboard, so git stays the source of truth:

```sh
cd apps/backend
supabase migration new <what_changed>     # write the SQL in the new file
supabase login                            # once per machine
supabase link --project-ref avcqkyfobsalzdzzgvqm
supabase db push
```

New tables in `public` get full access for `anon` and `authenticated` by default on this project. Start each new table's grants with `revoke all ... from anon, authenticated`, then grant only what's needed, as the first migration does.
