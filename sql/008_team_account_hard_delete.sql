-- NXT | Benutzerkonten können endgültig aus Supabase Auth entfernt werden.
-- Bisherige Team-Verwaltungsaktionen bleiben unverändert; das Audit erhält
-- zusätzlich den Wert delete_user. Forschungsmaterial wird NICHT gelöscht.
alter table public.team_access_audit
  drop constraint if exists team_access_audit_action_check;
alter table public.team_access_audit
  add constraint team_access_audit_action_check
  check (action in ('invite','set_active','set_role','delete_user'));
