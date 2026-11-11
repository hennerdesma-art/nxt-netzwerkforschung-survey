-- NXT Questionnaire V7: forward-only schema extension; no existing interview data deleted.
-- Adds B5 modality, B6 pre-NXT acquaintance, and declined status.
alter table public.edges
  add column if not exists exchange_medium text,
  add column if not exists known_before_nxt boolean;

alter table public.interviews drop constraint if exists interviews_status_check;
alter table public.interviews add constraint interviews_status_check
  check (status in ('planned','in_progress','completed','declined'));

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
  if p_status not in ('planned','in_progress','completed','declined') then
    raise exception 'INVALID_INTERVIEW_STATUS';
  end if;
  if p_status = 'completed'
    and not exists (
      select 1 from jsonb_to_recordset(coalesce(p_answers, '[]'::jsonb)) as a(question_key text, answer jsonb)
      where a.question_key = 'Einwilligung' and a.answer #>> '{}' = 'Ja, ich bin einverstanden.'
    ) then
      raise exception 'CONSENT_REQUIRED';
  end if;
  if p_status = 'declined'
    and not exists (
      select 1 from jsonb_to_recordset(coalesce(p_answers, '[]'::jsonb)) as a(question_key text, answer jsonb)
      where a.question_key = 'Einwilligung' and a.answer #>> '{}' = 'Nein, ich möchte nicht teilnehmen.'
    ) then
      raise exception 'DECLINED_REQUIRES_NO_CONSENT';
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
                            frequency, topics, exchange_mode, exchange_medium, known_before_nxt, note)
  select p_interview_id, v_person_id, e.target_person_id,
         nullif(trim(e.frequency), ''), coalesce(e.topics, '{}'),
         nullif(trim(e.exchange_mode), ''), nullif(trim(e.exchange_medium), ''),
         e.known_before_nxt, nullif(trim(e.note), '')
  from jsonb_to_recordset(coalesce(p_edges, '[]'::jsonb))
       as e(target_person_id uuid, frequency text, topics text[],
            exchange_mode text, exchange_medium text, known_before_nxt boolean, note text)
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
