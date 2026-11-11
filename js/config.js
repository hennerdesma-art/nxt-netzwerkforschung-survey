/*
 * Configuration for the static GitHub Pages frontend.
 * A publishable key is deliberately public. NEVER paste a secret/service_role key here.
 * The team password is NOT configured here; store it as a Supabase Auth user password.
 */
window.NXT_CONFIG = Object.freeze({
  SUPABASE_URL: "https://REPLACE_WITH_YOUR_PROJECT.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_REPLACE_WITH_YOUR_KEY",
  AUTH_EMAIL: "team@example.org",
  PROJECT_TITLE: "NXT Netzwerkforschung",
  TARGET_COUNT: 40
});
