-- NXT network survey | PDF-final questionnaire 2026/27
-- One-time idempotent normalization of legacy V7 B2 topic codes.
-- New people P40–P44 were added directly to protected Supabase from the supplied roster.
-- Their names and personal details are deliberately not stored in the public repository.
-- The answers JSONB schema already supports A6.1/B7/C9–C13 without DDL.
-- The edges.topics text[] schema already supports multiple topic codes without DDL.
update public.edges e
set topics = array(
  select canonical from (values ('F'),('L'),('SV')) as code(canonical)
  where canonical=any(e.topics)
     or (canonical='SV' and 'S'=any(e.topics))
     or ('A'=any(e.topics))
)
where 'S'=any(e.topics) or 'A'=any(e.topics);
