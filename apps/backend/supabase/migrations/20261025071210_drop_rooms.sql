-- One room only: drop the room table and every room_id column

drop view public.room_now;

-- rows from different rooms can't be told apart once room_id is gone, so start empty
-- (apps/backend/scripts/seed.py refills the sample data)
truncate public.vote, public.occupancy_reading, public.temp_reading, public.setpoint;

-- dropping room_id also drops its foreign key and the (room_id, created_at) index
alter table public.vote              drop column room_id;
alter table public.occupancy_reading drop column room_id;
alter table public.temp_reading      drop column room_id;
alter table public.setpoint          drop column room_id;

drop table public.room;

-- Covering indexes: the latest reading and the 10-minute vote window never touch the table

create index vote_time_idx              on public.vote              (created_at desc) include (is_hot);
create index occupancy_reading_time_idx on public.occupancy_reading (created_at desc) include (ppl);
create index temp_reading_time_idx      on public.temp_reading      (created_at desc) include (temp_c);
create index setpoint_time_idx          on public.setpoint          (created_at desc) include (target_c);

-- Current state of the room: always exactly one row

create view public.room_now with (security_invoker = true) as  -- without this, the view bypasses RLS
select o.ppl,
       o.created_at as ppl_at,
       t.temp_c,
       t.created_at as temp_at,
       v.hot_count,
       v.cold_count,
       s.target_c,
       s.created_at as target_at
from (
  select count(*) filter (where is_hot)     as hot_count,
         count(*) filter (where not is_hot) as cold_count
  from public.vote
  where created_at > now() - interval '10 minutes'
) v
left join lateral (
  select ppl, created_at from public.occupancy_reading order by created_at desc limit 1
) o on true
left join lateral (
  select temp_c, created_at from public.temp_reading order by created_at desc limit 1
) t on true
left join lateral (
  select target_c, created_at from public.setpoint order by created_at desc limit 1
) s on true;

revoke all on public.room_now from anon, authenticated;
grant select on public.room_now to anon, authenticated, service_role;
