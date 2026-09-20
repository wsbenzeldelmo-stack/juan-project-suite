-- JUAN PROJECT Platform V1.3.3.2 — eight-stage client project tracker
-- Adds the Delivered stage at tracker index 7 while preserving all existing values.

begin;

alter table public.projects
  drop constraint if exists projects_tracker_stage_check;

alter table public.projects
  add constraint projects_tracker_stage_check
  check (tracker_stage >= 0 and tracker_stage <= 7);

commit;
