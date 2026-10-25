# Database Schema

Four tables and one view in Supabase (Postgres), for a single room. Sensors, the vote page, and the AC model insert rows. Everyone reads the room's current state from the `room_now` view.

```
YOLO camera    ──insert──▶ occupancy_reading ─┐
ESP32 gateway  ──insert──▶ temp_reading      ─┤
Vote page      ──insert──▶ vote              ─┼─▶ room_now (view, 1 row) ──▶ dashboard
AC model (Pi)  ──insert──▶ setpoint          ─┘
```

New `setpoint` rows also go out over Realtime, so the gateway can send each target to the AC as soon as the model saves it.

To fill the tables with two hours of sample history, run `python3 apps/backend/scripts/seed.py`.

## Tables

### `vote`

One row per tap on the vote page.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | |
| `is_hot` | `boolean` not null | `true` = hot, `false` = cold |
| `created_at` | `timestamptz` not null, default `now()` | Set by the database, clients can't override it |

### `occupancy_reading`

One row per people count from YOLO.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | |
| `ppl` | `smallint` not null, `>= 0` | People in the room |
| `created_at` | `timestamptz` not null, default `now()` | |

### `temp_reading`

One row per temperature reading from an ESP32.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | |
| `temp_c` | `real` not null, between −40 and 85 | °C. The range matches common ESP32 sensors and rejects garbage readings. |
| `created_at` | `timestamptz` not null, default `now()` | |

### `setpoint`

One row per AC target temperature predicted by the model in `apps/alg`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | |
| `target_c` | `real` not null, between 16 and 30 | °C. Same range the model clamps its output to (`SET_MIN`, `SET_MAX` in `acmodel.py`). |
| `created_at` | `timestamptz` not null, default `now()` | When the model made the prediction |

Each table has one index on `created_at desc` that also includes its value column. "Latest reading" and "votes in the last 10 minutes" are then answered from the index alone, without touching the table.

## View: `room_now`

Always exactly one row with everything current. This is the main thing the frontend reads. It's a view, so it stores nothing: it's computed from the four tables on every read.

| Column | Meaning |
| --- | --- |
| `ppl`, `ppl_at` | Latest people count and when it was taken |
| `temp_c`, `temp_at` | Latest temperature and when it was taken |
| `hot_count`, `cold_count` | Votes in the last 10 minutes (0 if none) |
| `target_c`, `target_at` | Latest model target and when it was predicted |

`ppl`, `temp_c`, and `target_c` are `null` until the first row arrives.

## Who can read and write

| Who | Key | Reads | Writes |
| --- | --- | --- | --- |
| Vote page, dashboard (browser) | publishable key | everything | `vote` only, and only `is_hot` |
| YOLO script, device-gateway, AC model | secret key | everything | everything |

Row Level Security is on for every table. The secret key bypasses it, so it must never go into browser code or a `NEXT_PUBLIC_*` variable.

## Using it

See [API.md](API.md) for every endpoint, with REST and supabase-js examples.

## Changes from the original sketch

| Original | Now | Why |
| --- | --- | --- |
| `client` with `hot_count`, `cold_count` | `vote`, one row per tap | supabase-js can't increment a counter in one step, so two taps at the same moment could overwrite each other. Counters also never expire. Single rows can't collide, and counting the last 10 minutes is cheap with the index. |
| No "ok" vote | Still none | `ppl` already gives the number of people in the room, so "ok" adds nothing. |
| `space` with `name`, `ppl` | `occupancy_reading` (`ppl` only) | There's only one room, so there's no name to store. |
| `tmp_record.place` | Removed | There's only one room, so readings don't need a location. |
| `time_stamp` | `created_at`, filled in by the database | Clients can't send a wrong or faked time. |
| — | `setpoint` | The AC model needs to save each predicted target in the cloud. |

An earlier version supported several rooms with a `room` table and a `room_id` column on every table. Both were removed because the system serves one room.

Every table keeps a plain `id`. Using `created_at` as the key would save one index, but two votes landing in the same microsecond would then be rejected.

## Open questions

1. **Charts.** If the dashboard needs history, it can query the reading tables directly for short windows. The API returns at most 1,000 rows per request, and at one YOLO reading every 5 seconds that's about 80 minutes. Longer charts need a small SQL function that returns one row per minute.
2. **Vote spam.** Anyone with the page open can vote as often as they like. If that matters for the demo, add anonymous sign-in, a `user_id` column, and a one-vote-per-minute rule.
3. **Vote window.** Votes count for 10 minutes. Change the interval in `room_now` to tune it.

## SQL and changing the schema

The schema lives in [`supabase/migrations/`](supabase/migrations/), one file per change, and every migration there is applied to the hosted project. Change the schema only through new migration files, never by editing tables in the Dashboard, so git stays the source of truth:

```sh
cd apps/backend
supabase migration new <what_changed>     # write the SQL in the new file
supabase login                            # once per machine
supabase link --project-ref avcqkyfobsalzdzzgvqm
supabase db push
```

New tables in `public` get full access for `anon` and `authenticated` by default on this project. Start each new table's grants with `revoke all ... from anon, authenticated`, then grant only what's needed, as the first migration does.
