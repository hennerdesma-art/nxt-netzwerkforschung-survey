-- NXT | Team access administration audit. No survey data is changed.
create table if not exists public.team_access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text not null,
  action text not null check (action in ('invite','set_active','set_role')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists team_access_audit_created_idx on public.team_access_audit (created_at desc);
alter table public.team_access_audit enable row level security;
revoke all on table public.team_access_audit from public, anon, authenticated;
grant select on public.team_access_audit to authenticated;
grant select, insert, update, delete on public.team_access_audit to service_role;
drop policy if exists team_access_audit_admin_read on public.team_access_audit;
create policy team_access_audit_admin_read on public.team_access_audit
  for select to authenticated
  using (exists (
    select 1 from public.survey_members m
    where m.user_id = (select auth.uid()) and m.active = true and m.role = 'admin'
  ));