-- One snapshot row per Pi cycle replaces the per-sensor tables and the room_now view.
-- vote stays as the inbox the browser writes to; the Pi counts it each cycle.

drop view public.room_now;
drop table public.occupancy_reading, public.temp_reading;  -- also leaves the realtime publication

-- Tables

create table public.record (
  id         bigint generated always as identity primary key,
  ppl        smallint not null check (ppl >= 0),
  temp_c     real check (temp_c between -40 and 85),  -- null when the DHT11 read fails
  hot_count  integer not null default 0 check (hot_count >= 0),
  cold_count integer not null default 0 check (cold_count >= 0),
  created_at timestamptz not null default now()
);

create table public.saving (
  id         bigint generated always as identity primary key,
  saved_usd  numeric(10, 4) not null,  -- saved in this cycle; negative when the policy used more
  created_at timestamptz not null default now()
);

create index record_time_idx on public.record (created_at desc);
create index saving_time_idx on public.saving (created_at desc);

-- Access: anyone reads; only the secret key (the Pi) writes

alter table public.record enable row level security;
alter table public.saving enable row level security;

create policy "anyone can read" on public.record for select to anon, authenticated using (true);
create policy "anyone can read" on public.saving for select to anon, authenticated using (true);

revoke all on public.record, public.saving from anon, authenticated;
grant select on public.record, public.saving to anon, authenticated;
grant all on public.record, public.saving to service_role;

-- Live updates: each new record row is the full current state

alter publication supabase_realtime add table public.record, public.saving;
