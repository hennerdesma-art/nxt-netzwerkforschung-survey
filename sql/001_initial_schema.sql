-- NXT Netzwerkforschung: PostgreSQL schema for one dedicated Supabase project.
-- Apply once in the Supabase SQL Editor. No personal sample data is included.
-- Create the Supabase Auth user and its survey_members entry AFTER running this script.

create table if not exists public.survey_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Interview-Team',
  role text not null default 'interviewer' check (role in ('admin', 'interviewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 2 and 40),
  full_name text not null check (length(trim(full_name)) > 0),
  role_group text,
  professional_title text,
  unit text,
  building text,
  room text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists persons_name_idx on public.persons(full_name);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.persons(id) on delete cascade,
  status text not null default 'planned' check (status in ('planned','in_progress','completed')),
  interviewer_name text,
  notes text,
  version bigint not null default 0 check (version >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists interviews_status_idx on public.interviews(status);
create index if not exists interviews_updated_idx on public.interviews(updated_at desc);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  question_key text not null check (length(question_key) between 1 and 80),
  answer jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  unique (interview_id, question_key)
);

create table if not exists public.edges (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  source_person_id uuid not null references public.persons(id) on delete restrict,
  target_person_id uuid not null references public.persons(id) on delete restrict,
  frequency text,
  topics text[] not null default '{}',
  exchange_mode text,
  note text,
  updated_at timestamptz not null default now(),
  check (source_person_id <> target_person_id),
  unique (interview_id, target_person_id)
);
create index if not exists edges_source_idx on public.edges(source_person_id);
create index if not exists edges_target_idx on public.edges(target_person_id);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  building text not null,
  place text,
  frequency text,
  notes text,
  updated_at timestamptz not null default now()
);
create index if not exists locations_person_idx on public.locations(person_id);

-- Explicit grants + RLS. No anonymous role gets access to survey data.
alter table public.survey_members enable row level security;
alter table public.persons enable row level security;
alter table public.interviews enable row level security;
alter table public.answers enable row level security;
alter table public.edges enable row level security;
alter table public.locations enable row level security;

revoke all on public.survey_members, public.persons, public.interviews,
  public.answers, public.edges, public.locations from anon;
grant usage on schema public to authenticated;
grant select on public.survey_members to authenticated;
grant select, insert, update, delete on public.persons, public.interviews,
  public.answers, public.edges, public.locations to authenticated;

create policy survey_members_read_self on public.survey_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy persons_read_active_team on public.persons
  for select to authenticated
  using (exists (select 1 from public.survey_members m
                where m.user_id = (select auth.uid()) and m.active));
create policy persons_insert_active_team on public.persons
  for insert to authenticated
  with check (exists (select 1 from public.survey_members m
                     where m.user_id = (select auth.uid()) and m.active));
create policy persons_update_active_team on public.persons
  for update to authenticated
  using (exists (select 1 from public.survey_members m
                where m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.survey_members m
                     where m.user_id = (select auth.uid()) and m.active));
create policy persons_delete_admin_only on public.persons
  for delete to authenticated
  using (exists (select 1 from public.survey_members m
                where m.user_id = (select auth.uid()) and m.active and m.role = 'admin'));

-- All confirmed members may conduct assigned interviews. Future individual
-- interviewer permissions can be narrowed by changing these policies.
do $rls$
declare t text;
begin
  foreach t in array array['interviews','answers','edges','locations'] loop
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.survey_members m where m.user_id = (select auth.uid()) and m.active))', t || '_read_team', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.survey_members m where m.user_id = (select auth.uid()) and m.active))', t || '_insert_team', t);
    execute format('create policy %I on public.%I for update to authenticated using (exists (select 1 from public.survey_members m where m.user_id = (select auth.uid()) and m.active)) with check (exists (select 1 from public.survey_members m where m.user_id = (select auth.uid()) and m.active))', t || '_update_team', t);
    execute format('create policy %I on public.%I for delete to authenticated using (exists (select 1 from public.survey_members m where m.user_id = (select auth.uid()) and m.active))', t || '_delete_team', t);
  end loop;
end
$rls$;

-- Atomic snapshot saving: a single transaction updates answers, edges, sites,
-- and person fields. Optimistic version check blocks concurrent overwrites.
create or replace function public.save_interview_snapshot(
  p_interview_id uuid,
  p_expected_version bigint,
  p_status text,
  p_interviewer_name text,
  p_notes text,
  p_role_group text,
  p_professional_title text,
  p_unit text,
  p_building text,
  p_room text,
  p_answers jsonb,
  p_edges jsonb,
  p_locations jsonb
) returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_version bigint;
  v_person_id uuid;
begin
  if p_status not in ('planned','in_progress','completed') then
    raise exception 'INVALID_INTERVIEW_STATUS';
  end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_edges, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_locations, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_PAYLOAD';
  end if;

  update public.interviews
  set version = version + 1,
      status = p_status,
      interviewer_name = nullif(trim(p_interviewer_name), ''),
      notes = nullif(trim(p_notes), ''),
      started_at = coalesce(started_at, now()),
      completed_at = case when p_status = 'completed' then coalesce(completed_at, now()) else null end,
      updated_at = now()
  where id = p_interview_id and version = p_expected_version
  returning version, person_id into v_version, v_person_id;

  if not found then
    raise exception 'INTERVIEW_CONFLICT_OR_MISSING' using errcode = 'P0001';
  end if;

  update public.persons
  set role_group = nullif(trim(p_role_group), ''),
      professional_title = nullif(trim(p_professional_title), ''),
      unit = nullif(trim(p_unit), ''),
      building = nullif(trim(p_building), ''),
      room = nullif(trim(p_room), ''),
      updated_at = now()
  where id = v_person_id;
  if not found then
    raise exception 'PERSON_NOT_ACCESSIBLE';
  end if;

  delete from public.answers where interview_id = p_interview_id;
  insert into public.answers (interview_id, question_key, answer)
  select p_interview_id, a.question_key, a.answer
  from jsonb_to_recordset(coalesce(p_answers, '[]'::jsonb))
       as a(question_key text, answer jsonb)
  where a.question_key is not null;

  delete from public.edges where interview_id = p_interview_id;
  insert into public.edges (interview_id, source_person_id, target_person_id,
                            frequency, topics, exchange_mode, note)
  select p_interview_id, v_person_id, e.target_person_id,
         nullif(trim(e.frequency), ''), coalesce(e.topics, '{}'),
         nullif(trim(e.exchange_mode), ''), nullif(trim(e.note), '')
  from jsonb_to_recordset(coalesce(p_edges, '[]'::jsonb))
       as e(target_person_id uuid, frequency text, topics text[],
            exchange_mode text, note text)
  where e.target_person_id is not null;

  delete from public.locations where person_id = v_person_id;
  insert into public.locations (person_id, building, place, frequency, notes)
  select v_person_id, trim(l.building), nullif(trim(l.place), ''),
         nullif(trim(l.frequency), ''), nullif(trim(l.notes), '')
  from jsonb_to_recordset(coalesce(p_locations, '[]'::jsonb))
       as l(building text, place text, frequency text, notes text)
  where l.building is not null and length(trim(l.building)) > 0;

  return v_version;
end
$function$;

revoke all on function public.save_interview_snapshot(
  uuid,bigint,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb
) from public, anon;
grant execute on function public.save_interview_snapshot(
  uuid,bigint,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb
) to authenticated;

-- OPTIONAL: enable database changes for instant multi-device refresh in the
-- Supabase Dashboard: Database -> Publications -> supabase_realtime.
-- The frontend also refreshes automatically every 30 seconds.

-- INITIAL AUTH ACCOUNT (manual, after creating a user in Auth -> Users):
-- insert into public.survey_members(user_id,display_name,role)
-- values ('<ACTUAL-AUTH-USER-UUID>', 'NXT Interview-Team', 'admin');
