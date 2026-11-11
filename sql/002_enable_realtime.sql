-- NXT survey: idempotent Realtime publication setup.
-- Already applied to the connected NXT Supabase project on 11 Nov 2026.
-- Safe to run again in the SQL editor, provided the publication exists.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['persons', 'interviews', 'edges'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  else
    raise notice 'supabase_realtime publication is not available';
  end if;
end $$;
