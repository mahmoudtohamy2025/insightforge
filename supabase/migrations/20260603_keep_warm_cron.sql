-- =====================================================
-- Keep-warm cron: prevent free-tier auto-pause (B2 interim mitigation)
-- =====================================================
-- Free-tier Supabase projects pause after ~7 days with no API activity. A pause
-- takes the whole app down -- the database becomes unreachable -- and it has
-- already happened once (2026-06-02, the live app was down against a paused DB).
--
-- Decision (2026-06-03): defer Supabase Pro ($25/mo, no-pause + backups) until the
-- first paying customer, and mitigate ONLY the pause for free in the meantime. This
-- buys no-pause but NOT backups -- acceptable while prod data is throwaway; upgrade
-- to Pro the day a real customer's data exists.
--
-- How it works: pg_cron fires once a day and pg_net makes a real HTTP request to
-- our own API gateway, resetting the inactivity timer well inside the 7-day window.
--
-- Why an HTTP request, not just an internal pg_cron SELECT: Supabase measures
-- inactivity at the API/connection layer, so a purely-internal heartbeat is not
-- reliably counted. pg_net issues a genuine request to the public REST gateway,
-- which unambiguously registers as activity.
--
-- Why pg_cron (in-database) and not GitHub Actions: Actions is frozen account-wide
-- by an unrelated billing lock, so the scheduler must live inside Postgres.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Observability only: a single-row table bumped on every run so we can confirm the
-- job is firing (select * from public.keep_warm_heartbeat;). Not the activity
-- signal itself -- the pg_net request below is.
create table if not exists public.keep_warm_heartbeat (
  id          boolean     primary key default true,
  last_run_at timestamptz not null default now(),
  run_count   bigint      not null default 0,
  last_request_id bigint,
  constraint keep_warm_singleton check (id)
);

insert into public.keep_warm_heartbeat (id) values (true)
  on conflict (id) do nothing;

-- Lock it down: RLS on, no policies => no anon/authenticated access at all. The
-- SECURITY DEFINER function and the service role can still read/write it.
alter table public.keep_warm_heartbeat enable row level security;

create or replace function public.keep_warm()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req_id bigint;
begin
  -- Real query against our own REST data API so the pause detector sees activity:
  -- this reaches PostgREST -> Postgres (the data plane), the strongest activity
  -- signal. Returns 200 with an empty array under RLS (anon sees no rows) -- a real
  -- request that leaks nothing. The REST *root* requires service_role, so we hit a
  -- concrete table with a trivial select instead.
  -- apikey/Bearer is the PUBLIC publishable (anon) key -- it already ships in the
  -- browser bundle, so embedding it here leaks nothing (role "anon", RLS applies).
  select net.http_get(
    url     := 'https://xwjvsmwefbukaswkwpbf.supabase.co/rest/v1/workspaces?select=id&limit=1',
    headers := jsonb_build_object(
      'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3anZzbXdlZmJ1a2Fzd2t3cGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODM2NTIsImV4cCI6MjA4ODU1OTY1Mn0.MSrPykhMbp16TJ6dcAVvgmE4hnJt4PjqqwadKJDUeZg',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3anZzbXdlZmJ1a2Fzd2t3cGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODM2NTIsImV4cCI6MjA4ODU1OTY1Mn0.MSrPykhMbp16TJ6dcAVvgmE4hnJt4PjqqwadKJDUeZg'
    )
  ) into req_id;

  update public.keep_warm_heartbeat
     set last_run_at     = now(),
         run_count       = run_count + 1,
         last_request_id = req_id
   where id = true;
exception when others then
  -- Best-effort insurance: never let a keep-warm failure raise.
  null;
end;
$$;

-- keep_warm() is invoked only by the cron job (which runs as the postgres role).
-- Postgres grants EXECUTE to PUBLIC by default, which would expose it via
-- /rest/v1/rpc/keep_warm to anon/authenticated callers -- pointless surface. Revoke it.
revoke execute on function public.keep_warm() from public, anon, authenticated;

-- Daily at 06:00 UTC. ~7x safety margin vs the 7-day pause window, so a single
-- missed run can never cause a pause. cron.schedule upserts by job name, so
-- re-applying this migration is idempotent.
select cron.schedule('keep-warm', '0 6 * * *', $$ select public.keep_warm(); $$);
