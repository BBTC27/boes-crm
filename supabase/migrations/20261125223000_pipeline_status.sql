-- RFP pipeline feed.
--
-- Replaces the public pipeline-status.json file. Run this once in the
-- Supabase SQL editor (project gppskzsoxprwqymfcjtu). Nothing in this
-- repo applies it, and this file inserts no rows.
--
-- After it runs, a team member saves the current feed as one row:
--   id   = 'current'
--   data = the feed document ({ "updatedAt", "rfps" })
-- Do that in the SQL editor or from a signed-in session. Do not add the
-- document to this file.

create table if not exists public.pipeline_status (
  id text primary key default 'current',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint pipeline_status_data_object check (jsonb_typeof(data) = 'object')
);

comment on table public.pipeline_status is
  'Signed-in RFP pipeline feed. One row, id = current, holds the whole document in data.';

alter table public.pipeline_status enable row level security;

revoke all on table public.pipeline_status from public;
revoke all on table public.pipeline_status from anon;
grant select, insert, update on table public.pipeline_status to authenticated;

-- is_team_member() is the existing helper used by the other tables.
-- No delete policy and no delete grant: rows stay until a project owner
-- removes them in the SQL editor.

drop policy if exists pipeline_status_select on public.pipeline_status;
create policy pipeline_status_select
  on public.pipeline_status
  for select
  to authenticated
  using (public.is_team_member());

drop policy if exists pipeline_status_insert on public.pipeline_status;
create policy pipeline_status_insert
  on public.pipeline_status
  for insert
  to authenticated
  with check (public.is_team_member());

drop policy if exists pipeline_status_update on public.pipeline_status;
create policy pipeline_status_update
  on public.pipeline_status
  for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create or replace function public.set_pipeline_status_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pipeline_status_set_updated_at on public.pipeline_status;
create trigger pipeline_status_set_updated_at
  before insert or update on public.pipeline_status
  for each row
  execute function public.set_pipeline_status_updated_at();

revoke all on function public.set_pipeline_status_updated_at() from public;
revoke all on function public.set_pipeline_status_updated_at() from anon;
grant execute on function public.set_pipeline_status_updated_at() to authenticated;
