-- AC target temperatures predicted by the model (apps/alg), one row per prediction

create table public.setpoint (
  id         bigint generated always as identity primary key,
  room_id    text not null references public.room (id),
  target_c   real not null check (target_c between 16 and 30),  -- same range the model clamps to (SET_MIN, SET_MAX)
  created_at timestamptz not null default now()
);

create index setpoint_room_time_idx on public.setpoint (room_id, created_at desc) include (target_c);

-- Access: anyone reads; only the secret key (the model) writes

alter table public.setpoint enable row level security;

create policy "anyone can read" on public.setpoint for select to anon, authenticated using (true);

revoke all on public.setpoint from anon, authenticated;
grant select on public.setpoint to anon, authenticated;
grant all on public.setpoint to service_role;

-- room_now gains the latest target (create or replace can only append columns)

create or replace view public.room_now with (security_invoker = true) as
select r.id as room_id,
       r.name,
       o.ppl,
       o.created_at as ppl_at,
       t.temp_c,
       t.created_at as temp_at,
       v.hot_count,
       v.cold_count,
       s.target_c,
       s.created_at as target_at
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
) v
left join lateral (
  select target_c, created_at from public.setpoint
  where room_id = r.id order by created_at desc limit 1
) s on true;

-- Live updates: the gateway listens for new targets to send to the AC

alter publication supabase_realtime add table public.setpoint;
