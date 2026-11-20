-- NXT: recode historical C12/C13 quantity-response labels to 5-level quality labels.
-- The raw original labels are retained in a PRIVATE, RLS-protected audit table.
-- This migration changes ONLY C12/C13 answer values which exactly match an old label.
-- No persons, interviews, network edges or location records are modified.
-- Research-method limitation: quantity != quality. Document this as ordinal recoding.

create schema if not exists nxt_private;
revoke all on schema nxt_private from public, anon;
create table if not exists nxt_private.c12_c13_scale_recoding_audit (
  answer_id uuid primary key references public.answers(id) on delete cascade,
  question_key text not null check (question_key in ('C12','C13')),
  old_answer jsonb not null,
  new_answer jsonb not null,
  recoded_at timestamptz not null default now()
);
alter table nxt_private.c12_c13_scale_recoding_audit enable row level security;
revoke all on nxt_private.c12_c13_scale_recoding_audit from public, anon, authenticated;

with old_values as (
  select a.id, a.question_key, a.answer,
    case a.answer #>> '{}'
      when 'Sehr wenig' then 'Sehr schlecht'
      when 'Wenig'      then 'Schlecht'
      when 'Neutral'    then 'Neutral'
      when 'Viel'       then 'Gut'
      when 'Sehr viel'  then 'Sehr gut'
      else null
    end as new_label
  from public.answers a
  where a.question_key in ('C12','C13')
    and jsonb_typeof(a.answer)='string'
    and a.answer #>> '{}' in ('Sehr wenig','Wenig','Neutral','Viel','Sehr viel')
)
insert into nxt_private.c12_c13_scale_recoding_audit(answer_id,question_key,old_answer,new_answer)
select id, question_key, answer, to_jsonb(new_label)
from old_values
where new_label is distinct from (answer #>> '{}')
on conflict (answer_id) do nothing;

update public.answers a
set answer=b.new_answer, updated_at=now()
from nxt_private.c12_c13_scale_recoding_audit b
where a.id=b.answer_id and a.question_key=b.question_key
  and a.answer=b.old_answer
  and b.old_answer is distinct from b.new_answer;
