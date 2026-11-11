-- Move privileged implementation outside the Data API-exposed public schema.
-- The public wrapper executes with the requester's privileges; access to the
-- private implementation is limited to authenticated sessions and its body
-- explicitly verifies an active NXT administrator before any modification.

create schema if not exists nxt_private;
revoke all on schema nxt_private from public, anon;
grant usage on schema nxt_private to authenticated;

alter function public.reset_interview(uuid,bigint,text) set schema nxt_private;
revoke execute on function nxt_private.reset_interview(uuid,bigint,text) from public, anon;
grant execute on function nxt_private.reset_interview(uuid,bigint,text) to authenticated;

create or replace function public.reset_interview(
  p_interview_id uuid,
  p_expected_version bigint,
  p_confirm_code text
) returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select nxt_private.reset_interview(p_interview_id, p_expected_version, p_confirm_code);
$function$;

revoke execute on function public.reset_interview(uuid,bigint,text) from public, anon;
grant execute on function public.reset_interview(uuid,bigint,text) to authenticated;
