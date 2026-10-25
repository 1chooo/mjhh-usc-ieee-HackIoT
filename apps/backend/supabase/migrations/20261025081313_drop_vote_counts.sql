-- The vote inbox already holds every vote with its time, so a cycle's counts are the votes
-- between two records. Storing them in record too was only a copy.

alter table public.record
  drop column hot_count,
  drop column cold_count;
