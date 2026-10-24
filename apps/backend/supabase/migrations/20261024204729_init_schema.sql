-- Tables

create table public.room (
  id   text primary key check (id ~ '^[a-z0-9-]+$'),  -- also used in MQTT topics, so no '/', '+', '#'
  name text not null
);

create table public.vote (
  id         bigint generated always as identity primary key,
  room_id    text not null references public.room (id),
  is_hot     boolean not null,
  created_at timestamptz not null default now()
);

create table public.occupancy_reading (
  id         bigint generated always as identity primary key,
  room_id    text not null references public.room (id),
  ppl        smallint not null check (ppl >= 0),
  created_at timestamptz not null default now()
);

create table public.temp_reading (
  id         bigint generated always as identity primary key,
  room_id    text not null references public.room (id),
  temp_c     real not null check (temp_c between -40 and 85),
  created_at timestamptz not null default now()
);

-- Covering indexes: latest-per-room and time-window queries never touch the table

create index vote_room_time_idx              on public.vote              (room_id, created_at desc) include (is_hot);
create index occupancy_reading_room_time_idx on public.occupancy_reading (room_id, created_at desc) include (ppl);
create index temp_reading_room_time_idx      on public.temp_reading      (room_id, created_at desc) include (temp_c);

-- Access: anyone reads everything; the browser may insert votes only;
-- the secret key (service_role) bypasses RLS for sensor writes

alter table public.room              enable row level security;
alter table public.vote              enable row level security;
alter table public.occupancy_reading enable row level security;
alter table public.temp_reading      enable row level security;

create policy "anyone can read" on public.room              for select to anon, authenticated using (true);
create policy "anyone can read" on public.vote              for select to anon, authenticated using (true);
create policy "anyone can read" on public.occupancy_reading for select to anon, authenticated using (true);
create policy "anyone can read" on public.temp_reading      for select to anon, authenticated using (true);

create policy "anyone can vote" on public.vote for insert to anon, authenticated with check (true);

-- the project's default privileges give anon and authenticated everything on new tables, so start from nothing
revoke all on public.room, public.vote, public.occupancy_reading, public.temp_reading from anon, authenticated;
grant select on public.room, public.vote, public.occupancy_reading, public.temp_reading to anon, authenticated;
grant insert (room_id, is_hot) on public.vote to anon, authenticated;  -- column grant: clients can't set created_at
grant all on public.room, public.vote, public.occupancy_reading, public.temp_reading to service_role;

-- Current state per room

create view public.room_now with (security_invoker = true) as  -- without this, the view bypasses RLS
select r.id as room_id,
       r.name,
       o.ppl,
       o.created_at as ppl_at,
       t.temp_c,
       t.created_at as temp_at,
       v.hot_count,
       v.cold_count
from public.room r
left join lateral (
  select ppl, created_at from public.occupancy_reading
  where room_id = r.id order by created_at desc limit 1
) o on true
left join lateral (
  select temp_c, created_at from public.temp_reading
  where room_id = r.id order by created_at desc limit 1
) t on true
cross join lateral (
  select count(*) filter (where is_hot)     as hot_count,
         count(*) filter (where not is_hot) as cold_count
  from public.vote
  where room_id = r.id and created_at > now() - interval '10 minutes'
) v;

revoke all on public.room_now from anon, authenticated;
grant select on public.room_now to anon, authenticated, service_role;

-- Live updates for the dashboard (views can't be subscribed to, so publish the tables)

alter publication supabase_realtime add table public.vote, public.occupancy_reading, public.temp_reading;
