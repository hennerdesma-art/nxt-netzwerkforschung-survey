-- NXT Network Survey - administrator-only reset, 2026-11-11
-- Transactional operation; preserves people and their master data.
-- Run only after 001_initial_schema.sql and 003_questionnaire_v7.sql.

create table if not exists public.interview_reset_audit (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null,
  person_id uuid not null,
  person_code text not null,
  reset_by uuid not null,
  reset_at timestamptz not null default now(),
  previous_status text not null,
  previous_version bigint not null,
  answers_deleted integer not null default 0,
  edges_deleted integer not null default 0,
  locations_deleted integer not null default 0
);

create index if not exists interview_reset_audit_recent_idx
on public.interview_reset_audit (reset_at desc);

alter table public.interview_reset_audit enable row level security;
revoke all on public.interview_reset_audit from public, anon, authenticated;
grant select on public.interview_reset_audit to authenticated;
drop policy if exists interview_reset_audit_admin_read on public.interview_reset_audit;
create policy interview_reset_audit_admin_read
on public.interview_reset_audit for select to authenticated
using (exists (
  select 1 from public.survey_members as m
  where m.user_id = (select auth.uid())
    and m.active = true and m.role = 'admin'
));

create or replace function public.reset_interview(
  p_interview_id uuid,
  p_expected_version bigint,
  p_confirm_code text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid;
  v_person uuid;
  v_code text;
  v_status text;
  v_version bigint;
  v_answers integer;
  v_edges integer;
  v_locations integer;
begin
  v_user := (select auth.uid());
  if v_user is null or not exists (
    select 1 from public.survey_members m
    where m.user_id = v_user
      and m.active = true
      and m.role = 'admin'
  ) then
    raise exception 'ADMIN_ONLY_RESET' using errcode = '42501';
  end if;

  if p_interview_id is null or p_expected_version is null or p_confirm_code is null then
    raise exception 'RESET_PARAMETERS_REQUIRED' using errcode = '22023';
  end if;

  select i.person_id, p.code, i.status, i.version
    into v_person, v_code, v_status, v_version
  from public.interviews i
  join public.persons p on p.id = i.person_id
  where i.id = p_interview_id
  for update of i;

  if not found then
    raise exception 'INTERVIEW_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_version <> p_expected_version then
    raise exception 'INTERVIEW_CHANGED_RELOAD' using errcode = 'P0001';
  end if;
  if p_confirm_code <> v_code then
    raise exception 'PERSON_CODE_CONFIRMATION_FAILED' using errcode = '22023';
  end if;

  select count(*) into v_answers from public.answers where interview_id = p_interview_id;
  select count(*) into v_edges from public.edges where interview_id = p_interview_id;
  select count(*) into v_locations from public.locations where person_id = v_person;

  delete from public.answers where interview_id = p_interview_id;
  delete from public.edges where interview_id = p_interview_id;
  delete from public.locations where person_id = v_person;

  update public.interviews
  set status = 'planned',
      interviewer_name = null,
      notes = null,
      started_at = null,
      completed_at = null,
      updated_at = now(),
      version = version + 1
  where id = p_interview_id;

  insert into public.interview_reset_audit
    (interview_id, person_id, person_code, reset_by, previous_status,
     previous_version, answers_deleted, edges_deleted, locations_deleted)
  values
    (p_interview_id, v_person, v_code, v_user, v_status,
     v_version, v_answers, v_edges, v_locations);

  return jsonb_build_object(
    'person_code', v_code,
    'answers_deleted', v_answers,
    'edges_deleted', v_edges,
    'locations_deleted', v_locations,
    'new_status', 'planned',
    'new_version', v_version + 1
  );
end;
$function$;

-- SECURITY DEFINER is necessary only to write the protected audit log.
-- The function explicitly checks active administrator membership above.
revoke execute on function public.reset_interview(uuid,bigint,text) from public, anon;
grant execute on function public.reset_interview(uuid,bigint,text) to authenticated;
