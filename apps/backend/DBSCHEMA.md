# Database Schema

Four tables in Supabase (Postgres), for a single room. The Raspberry Pi writes one snapshot per cycle. The vote page only drops votes into an inbox. There are no views: the newest `record` row is the current state.

```
Vote page (browser) ──tap──▶ vote (inbox)
                                 │ counted each cycle
                                 ▼
Raspberry Pi: YOLO + DHT11 + votes ──▶ AC model
   ├──insert──▶ record    ppl, temp_c, hot_count, cold_count
   ├──insert──▶ setpoint  target_c
   └──insert──▶ saving    saved_usd
                                 │ Realtime
                                 ▼
                     dashboard, gateway (→ AC)
```

To fill the tables with two hours of sample cycles, run `python3 apps/backend/scripts/seed.py`.

## Tables

### `record`

One row per Pi cycle: everything the model saw.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | |
| `ppl` | `smallint` not null, `>= 0` | People counted by YOLO |
| `temp_c` | `real`, between −40 and 85, **nullable** | °C from the DHT11. `null` when the read failed, so a sensor problem never blocks a cycle. |
| `hot_count` | `integer` not null, default 0, `>= 0` | Hot votes counted for this cycle |
| `cold_count` | `integer` not null, default 0, `>= 0` | Cold votes counted for this cycle |
| `created_at` | `timestamptz` not null, default `now()` | When the cycle ran |

There's no check that `hot_count + cold_count <= ppl`, because YOLO can undercount and a valid snapshot would be rejected.

### `vote`

The vote inbox: one row per tap on the vote page. The Pi counts the votes since the last `record` and saves the counts there.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | |
| `is_hot` | `boolean` not null | `true` = hot, `false` = cold |
| `created_at` | `timestamptz` not null, default `now()` | Set by the database, clients can't override it |

### `setpoint`

One row per AC target temperature predicted by the model in `apps/alg`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | |
| `target_c` | `real` not null, between 16 and 30 | °C. Same range the model clamps its output to (`SET_MIN`, `SET_MAX` in `acmodel.py`). |
| `created_at` | `timestamptz` not null, default `now()` | When the model made the prediction |

### `saving`

One row per cycle with the dollars saved in that cycle, compared with a fixed setpoint.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` identity primary key | |
| `saved_usd` | `numeric(10, 4)` not null | Can be negative when the policy used more, matching the signed savings in `apps/web/lib/energy-impact.ts`. Four decimal places, because a cycle often saves less than a cent. |
| `created_at` | `timestamptz` not null, default `now()` | |

The total saved is the sum of all rows. It's per cycle rather than a running total, so a missed cycle or a Pi restart can't corrupt it.

Every table has an index on `created_at desc`, so "latest row" and "rows since a time" stay fast.

## Who can read and write

| Who | Key | Reads | Writes |
| --- | --- | --- | --- |
| Vote page, dashboard (browser) | publishable key | everything | `vote` only, and only `is_hot` |
| Raspberry Pi, admin scripts | secret key | everything | everything |

Row Level Security is on for every table. The secret key bypasses it, so it must never go into browser code or a `NEXT_PUBLIC_*` variable.

## Using it

See [API.md](API.md) for every endpoint, with REST and supabase-js examples, and the Pi's per-cycle recipe.

## Changes from the original sketch

| Original | Now | Why |
| --- | --- | --- |
| `client` with `hot_count`, `cold_count` | Counts in `record`, taps in `vote` | The counts live in the snapshot, as sketched. Taps still go to their own inbox, because two browsers adding to the same counter at once could overwrite each other. |
| No "ok" vote | Still none | `ppl` already gives the number of people in the room, so "ok" adds nothing. |
| `space` with `name`, `ppl` | `record.ppl` | There's only one room, so there's no name to store. |
| `tmp_record` with `tmp`, `place` | `record.temp_c` | One snapshot table holds every reading. There's one room, so no `place`. |
| `time_stamp` | `created_at`, filled in by the database | Clients can't send a wrong or faked time. |
| — | `setpoint`, `saving` | The model saves each target, and how much each cycle saved. |

Earlier versions had a `room` table with a `room_id` on every row, a table per sensor, and a `room_now` view that put the latest of each together. They were removed: there's one room, and the Pi already gathers every reading in one cycle.

Every table keeps a plain `id`. Using `created_at` as the key would save one index, but two votes landing in the same microsecond would then be rejected.

## Open questions

1. **Vote spam.** Anyone with the page open can vote as often as they like. If that matters for the demo, add anonymous sign-in, a `user_id` column, and a one-vote-per-minute rule.
2. **Dashboard refresh rate.** The current state changes once per Pi cycle: every hour in production, every few seconds in the Pi's test mode.

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
