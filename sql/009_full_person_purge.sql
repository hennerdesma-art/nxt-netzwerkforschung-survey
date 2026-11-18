-- NXT | Full erasure of a research participant (not a team login).
-- Safe migration: creates privileged RPC and redacted audit; does NOT delete records.
-- Apply only to the dedicated NXT research Supabase project.

create schema if not exists nxt_private;
revoke all on schema nxt_private from public, anon;
grant usage on schema nxt_private to authenticated;

create table if not exists public.person_purge_audit (
  id uuid primary key default gen_random_uuid(),
  purged_by uuid references auth.users(id) on delete set null,
  purged_at timestamptz not null default now(),
  own_interviews_deleted integer not null default 0,
  own_answers_deleted integer not null default 0,
  directed_edges_deleted integer not null default 0,
  incoming_edges_deleted integer not null default 0,
  locations_deleted integer not null default 0,
  third_party_answers_deleted integer not null default 0,
  third_party_text_fields_cleared integer not null default 0,
  old_reset_audits_deleted integer not null default 0
);
create index if not exists person_purge_audit_recent_idx
  on public.person_purge_audit (purged_at desc);
alter table public.person_purge_audit enable row level security;
revoke all on public.person_purge_audit from public, anon, authenticated;
grant select on public.person_purge_audit to authenticated;
drop policy if exists person_purge_audit_admin_select on public.person_purge_audit;
create policy person_purge_audit_admin_select on public.person_purge_audit
  for select to authenticated
  using (exists (
    select 1 from public.survey_members m
    where m.user_id = (select auth.uid()) and m.active and m.role='admin'
  ));

-- Recognizes a full name, exact UUID, or a bounded person code in text/JSON.
-- For nonstandard code formats, a literal case-insensitive fallback is used.
create or replace function nxt_private.matches_purged_person(
  p_text text, p_id uuid, p_code text, p_name text
) returns boolean
language sql immutable
set search_path = ''
as $fn$
  select case when p_text is null then false else
    (p_name is not null and char_length(trim(p_name)) >= 3
      and strpos(lower(p_text),lower(trim(p_name))) > 0)
    or strpos(lower(p_text),lower(p_id::text)) > 0
    or (p_code is not null and (
        case when p_code ~ '^[A-Za-z0-9_-]+$'
          then lower(p_text) ~ ('(^|[^[:alnum:]_])' || lower(p_code) || '($|[^[:alnum:]_])')
          else strpos(lower(p_text),lower(p_code)) > 0
        end
    ))
  end;
$fn$;
revoke all on function nxt_private.matches_purged_person(text,uuid,text,text) from public, anon, authenticated;

create or replace function nxt_private.preview_person_purge(
  p_person_id uuid
) returns jsonb
language plpgsql security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_name text;
  v_code text;
  v_own_interviews integer := 0;
  v_own_answers integer := 0;
  v_edges integer := 0;
  v_incoming integer := 0;
  v_locations integer := 0;
  v_other_answers integer := 0;
  v_notes integer := 0;
  v_old_audits integer := 0;
begin
  if v_actor is null or not exists (
    select 1 from public.survey_members m
    where m.user_id=v_actor and m.active and m.role='admin'
  ) then
    raise exception 'ADMIN_ONLY_PERSON_PURGE' using errcode='42501';
  end if;
  if p_person_id is null then
    raise exception 'PERSON_ID_REQUIRED' using errcode='22023';
  end if;
  select p.code,p.full_name into v_code,v_name
  from public.persons p where p.id=p_person_id;
  if not found then
    raise exception 'PERSON_NOT_FOUND' using errcode='P0002';
  end if;

  select count(*) into v_own_interviews
    from public.interviews i where i.person_id=p_person_id;
  select count(*) into v_own_answers
    from public.answers a join public.interviews i on i.id=a.interview_id
    where i.person_id=p_person_id;
  select count(*) into v_edges from public.edges e
    where e.source_person_id=p_person_id or e.target_person_id=p_person_id
      or exists (select 1 from public.interviews i where i.id=e.interview_id and i.person_id=p_person_id);
  select count(*) into v_incoming from public.edges e
    where e.target_person_id=p_person_id and e.source_person_id<>p_person_id;
  select count(*) into v_locations from public.locations l where l.person_id=p_person_id;

  select count(*) into v_other_answers
    from public.answers a join public.interviews i on i.id=a.interview_id
    where i.person_id<>p_person_id
      and nxt_private.matches_purged_person(a.answer::text,p_person_id,v_code,v_name);

  select (
    (select count(*) from public.interviews i where i.person_id<>p_person_id
      and (nxt_private.matches_purged_person(i.notes,p_person_id,v_code,v_name)
        or nxt_private.matches_purged_person(i.interviewer_name,p_person_id,v_code,v_name)))
    + (select count(*) from public.edges e where e.source_person_id<>p_person_id and e.target_person_id<>p_person_id
      and nxt_private.matches_purged_person(e.note,p_person_id,v_code,v_name))
    + (select count(*) from public.locations l where l.person_id<>p_person_id
      and (nxt_private.matches_purged_person(l.notes,p_person_id,v_code,v_name)
        or nxt_private.matches_purged_person(l.place,p_person_id,v_code,v_name)))
    + (select count(*) from public.persons p where p.id<>p_person_id
      and nxt_private.matches_purged_person(p.notes,p_person_id,v_code,v_name))
  ) into v_notes;

  select count(*) into v_old_audits from public.interview_reset_audit r
    where r.person_id=p_person_id;
  return jsonb_build_object(
    'person_id',p_person_id,'person_code',v_code,'full_name',v_name,
    'own_interviews',v_own_interviews,'own_answers',v_own_answers,
    'directed_edges',v_edges,'incoming_edges',v_incoming,'locations',v_locations,
    'other_answers',v_other_answers,'other_note_rows',v_notes,
    'old_reset_audits',v_old_audits);
end;
$fn$;
revoke all on function nxt_private.preview_person_purge(uuid) from public, anon;
grant execute on function nxt_private.preview_person_purge(uuid) to authenticated;

create or replace function public.preview_person_purge(
  p_person_id uuid
) returns jsonb
language sql security invoker
set search_path = ''
as $fn$
  select nxt_private.preview_person_purge(p_person_id);
$fn$;
revoke all on function public.preview_person_purge(uuid) from public, anon;
grant execute on function public.preview_person_purge(uuid) to authenticated;

create or replace function nxt_private.purge_person_record(
  p_person_id uuid,
  p_confirm_code text,
  p_confirm_name text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_code text;
  v_name text;
  v_preview jsonb;
  v_cleared integer := 0;
begin
  if v_actor is null or not exists (
    select 1 from public.survey_members m
    where m.user_id=v_actor and m.active and m.role='admin'
  ) then
    raise exception 'ADMIN_ONLY_PERSON_PURGE' using errcode='42501';
  end if;
  if p_person_id is null or p_confirm_code is null or p_confirm_name is null then
    raise exception 'PERSON_PURGE_CONFIRMATION_REQUIRED' using errcode='22023';
  end if;
  -- Locks the research person against concurrent edits until the transaction ends.
  select p.code,p.full_name into v_code,v_name
    from public.persons p where p.id=p_person_id for update;
  if not found then
    raise exception 'PERSON_NOT_FOUND' using errcode='P0002';
  end if;
  if trim(p_confirm_code)<>v_code or trim(p_confirm_name)<>v_name then
    raise exception 'PERSON_PURGE_CONFIRMATION_MISMATCH' using errcode='22023';
  end if;

  v_preview:=nxt_private.preview_person_purge(p_person_id);

  -- Remove references contained in other respondents' free-text/JSON answers.
  -- Remove only the matching answer, not the other person's interview.
  delete from public.answers a
  using public.interviews i
  where i.id=a.interview_id and i.person_id<>p_person_id
    and nxt_private.matches_purged_person(a.answer::text,p_person_id,v_code,v_name);

  update public.interviews i set
    notes=case when nxt_private.matches_purged_person(i.notes,p_person_id,v_code,v_name) then null else notes end,
    interviewer_name=case when nxt_private.matches_purged_person(i.interviewer_name,p_person_id,v_code,v_name) then null else interviewer_name end
  where i.person_id<>p_person_id
    and (nxt_private.matches_purged_person(i.notes,p_person_id,v_code,v_name)
      or nxt_private.matches_purged_person(i.interviewer_name,p_person_id,v_code,v_name));
  get diagnostics v_cleared = row_count;

  update public.edges e set note=null
  where e.source_person_id<>p_person_id and e.target_person_id<>p_person_id
    and nxt_private.matches_purged_person(e.note,p_person_id,v_code,v_name);
  update public.locations l set
    notes=case when nxt_private.matches_purged_person(l.notes,p_person_id,v_code,v_name) then null else notes end,
    place=case when nxt_private.matches_purged_person(l.place,p_person_id,v_code,v_name) then null else place end
  where l.person_id<>p_person_id
    and (nxt_private.matches_purged_person(l.notes,p_person_id,v_code,v_name)
      or nxt_private.matches_purged_person(l.place,p_person_id,v_code,v_name));
  update public.persons p set notes=null
  where p.id<>p_person_id and nxt_private.matches_purged_person(p.notes,p_person_id,v_code,v_name);

  -- Directed references by respondents to the person, and all outgoing edges
  -- from their own interview, must be removed BEFORE the parent row is deleted.
  delete from public.edges e
  where e.source_person_id=p_person_id or e.target_person_id=p_person_id
     or exists (select 1 from public.interviews i where i.id=e.interview_id and i.person_id=p_person_id);

  -- Old reset audits retain the target's code and UUID, so remove them too.
  delete from public.interview_reset_audit r where r.person_id=p_person_id;

  -- Foreign keys cascade own interviews, their answers and location records.
  delete from public.persons p where p.id=p_person_id;
  if not found then
    raise exception 'PERSON_PURGE_FAILED' using errcode='P0001';
  end if;

  -- No target identifier, code or name is stored in the permanent purge audit.
  insert into public.person_purge_audit (
    purged_by,own_interviews_deleted,own_answers_deleted,directed_edges_deleted,
    incoming_edges_deleted,locations_deleted,third_party_answers_deleted,
    third_party_text_fields_cleared,old_reset_audits_deleted
  ) values (
    v_actor,(v_preview->>'own_interviews')::integer,
    (v_preview->>'own_answers')::integer,(v_preview->>'directed_edges')::integer,
    (v_preview->>'incoming_edges')::integer,(v_preview->>'locations')::integer,
    (v_preview->>'other_answers')::integer,(v_preview->>'other_note_rows')::integer,
    (v_preview->>'old_reset_audits')::integer
  );

  return jsonb_build_object(
    'deleted',true,
    'own_interviews',v_preview->'own_interviews',
    'own_answers',v_preview->'own_answers',
    'directed_edges',v_preview->'directed_edges',
    'incoming_edges',v_preview->'incoming_edges',
    'locations',v_preview->'locations',
    'other_answers',v_preview->'other_answers',
    'other_note_rows',v_preview->'other_note_rows',
    'old_reset_audits',v_preview->'old_reset_audits'
  );
end;
$fn$;
revoke all on function nxt_private.purge_person_record(uuid,text,text) from public, anon;
grant execute on function nxt_private.purge_person_record(uuid,text,text) to authenticated;

create or replace function public.purge_person_record(
  p_person_id uuid,
  p_confirm_code text,
  p_confirm_name text
) returns jsonb
language sql security invoker
set search_path = ''
as $fn$
  select nxt_private.purge_person_record(p_person_id,p_confirm_code,p_confirm_name);
$fn$;
revoke all on function public.purge_person_record(uuid,text,text) from public, anon;
grant execute on function public.purge_person_record(uuid,text,text) to authenticated;
