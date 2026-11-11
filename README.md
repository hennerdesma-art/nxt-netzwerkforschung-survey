# NXT | Netzwerkforschung - Interviewplattform

Responsive GitHub Pages website for centrally collecting ~40 interviews about the
relationship between spatial proximity and professional exchange at NXT, Reutlingen.
The university/NXT logo is provided in `assets/nxt-logo.png`.

## Features

- NXT-themed login and responsive dashboard (desktop / iPad / mobile)
- Person directory, manual creation, Excel/CSV import
- Exact survey instrument V7 from the provided Excel template: consent, A1-A6, B1-B6 roster matrix, C1-C9, review
- Central Postgres database with Supabase Auth and strict RLS membership checks
- Atomic interview save and optimistic-lock version to prevent concurrent overwriting
- Cross-device status sync with realtime listener (if publication enabled) and 30s polling
- Automatic draft save after 12 seconds without edits, plus manual save and completion
- Interview start/completion timestamps and duration in minutes for pilot timing checks
- Ten-sheet Excel export, including coded Gesamt_Personen, Gesamt_Netzwerk and original Codebuch
- Gephi-compatible Node/Edge sheet headers (Id, Label, Source, Target)

QUESTIONNAIRE VERSION: `Fragebogen_NXT_Erfassung_2(1).xlsx` (Excel version of questionnaire V7, winter semester 2026/27). The A/B/C question wording, choice lists and variable coding come from P00, Listen and Codebuch. IMPORTANT: the original Excel privacy notice describes handling that differs from this web platform. The web UI explicitly flags this. University privacy/ethics review and final information/consent wording are required before real data collection.

## Setup 1: dedicated Supabase project

1. Create an independent Supabase project, preferably in a vetted EU region
   selected by your university's data protection officer.
2. Open `SQL Editor` and run `sql/001_initial_schema.sql` once (already applied in the connected NXT project).
3. In `Authentication > Users`, create an email/password user with a real
   organization-controlled email address. Set **the temporary password agreed separately in the private team conversation**
   as requested. Confirm the email within the Supabase dashboard or follow its
   normal verification flow.
4. Copy the user's real UUID from Supabase Auth and execute:

   ```sql
   insert into public.survey_members (user_id, display_name, role)
   values ('ACTUAL_AUTH_USER_UUID', 'NXT Interview-Team', 'admin');
   ```

5. Configure `js/config.js` with your `SUPABASE_URL`, public
   `SUPABASE_PUBLISHABLE_KEY` (begins `sb_publishable_`), and optionally `AUTH_EMAIL` (leave it empty for an email + password login).
   **NEVER** use a secret key, service_role key, or database password in the site.
6. Realtime publication is already active for `persons`, `interviews`, and `edges`
   in the connected NXT project. The website also polls every 30 seconds.
7. In Authentication, restrict self-registration and configure Auth rate
   limiting as appropriate. Do not enable anonymous sign-in.
8. Validate from two browsers: sign in, create a test person, start an
   interview, record an edge, save, observe sync, export Excel, sign out.
9. Change `the temporary team password (shared separately)` to a strong, unique password through Supabase Auth
   before collecting real data; communicate changes via an approved channel.

A shared login is convenient but does not give strong person-level auditability.
`interviewer_name` records who completed the interview but is self-reported.
For a production study, unique individual Auth accounts with dedicated access
policies are preferred.

## Setup 2: GitHub Pages

1. Add all repository files to the `main` branch.
2. In GitHub repo Settings > Pages, choose **GitHub Actions** as the source.
3. The workflow `.github/workflows/pages.yml` will upload **only**
   `index.html`, `css/`, `js/`, `assets/`, and `.nojekyll` to GitHub Pages.
4. Open the Pages URL ending in `/YOUR-REPO/`. Relative paths support this URL.

The page is publicly fetchable, but all survey content is gated through
Supabase Auth + RLS. Public source code and the publishable key are not secrets.

## Data model

- `survey_members`: allowlisted authentication accounts and roles
- `persons`: registered people / network nodes
- `interviews`: one interview per person, version, status, timestamp, interviewer
- `answers`: JSON interview answers (question_key, answer)
- `edges`: directed source -> target, B2 topic, B3 frequency, B4 occurrence, B5 medium, B6 prior acquaintance
- `locations`: repeated spatial activity locations per person

The SQL RPC `save_interview_snapshot` saves data in one transaction. If two
interviewers edit the same interview, the second save is rejected instead of
silently overwriting the first. Different interviews can be edited in parallel.

## Security and research-data handling

- GitHub Pages does NOT host any interview results or passwords.
- `the temporary team password (shared separately)` is intentionally NOT coded into the website. It must be set as
  the temporary password of the actual Supabase Auth user.
- SQL enables RLS on all sensitive tables. Anonymous users receive no data rights.
- Membership is allowlisted by auth user ID. Users not in `survey_members`
  cannot retrieve or change research data.
- The export button is hidden/disabled for the `interviewer` UI role.
  NOTE: Active survey members may currently query shared tables via the API.
  Use stricter per-user RLS and assignments if introducing individual accounts.
- Never commit real CSV/XLSX exports, source lists, or credentials to GitHub.
- The app is not a substitute for research ethics/privacy review, university
  approval, documented legal basis, retention periods, and a valid DPA/AVV.
- Avoid third-party fonts, analytics, advertising, or user-tracking scripts.
- Supabase JS 2.119.0 and SheetJS 0.20.3 load from pinned CDNs. For a formal
  production deployment, vendor and integrity-check third-party dependencies.
- Create backups regularly using approved, encrypted storage.

## Known limits / TODO

- Confirm the V7 wording and adjust the privacy/consent text to the actual Supabase storage setup before real interviews.
- Add individual Auth accounts and per-interviewer assignments if requested.
- Add automated retention/deletion policy after research approval.
- Confirm university branding usage and privacy review.
- Multi-visit spatial route frequency and distance matrix can be added after
  the research team finalizes locations and distance measurements.

## Local preview

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. Without a Supabase configuration the page shows
an installation guide (it does NOT expose an unprotected demo survey).

## Questionnaire V7 and coding

Source: user-provided `Fragebogen_NXT_Erfassung_2(1).xlsx`. Only generic question texts, choice lists, codebook variables and the embedded non-personal campus map were used in source code. No participant names or answers from the workbook are included in GitHub.

- A: consent and A1-A6 with exact choices (single selection where the Excel sheet specifies it).
- B: full participant roster (except the respondent), B1 binary directed edge, B2 F/L/S/A, B3 1-5, B4 S/G/B, B5 P/D/B, B6 known-before-NXT; plus the separate B6 attitudinal Likert item.
- C: C1 office, C2 locations and floor, C3/C4 weekdays, C5 arrival, C6 six room entries, C7 campus destinations, C8 maximum 3 locations, C9 five Likert statements.
- `Gesamt_Personen` and `Gesamt_Netzwerk` follow the workbook variable names and include missing versus zero distinction for B1. The `Codebuch` sheet holds the workbook coding reference.
- Declined participation is saved as a separate interview status and never creates a positive exchange edge. Server-side completion requires affirmative consent.
- `sql/003_questionnaire_v7.sql` extends the existing schema without dropping the participant list or collected data. This migration has been applied to the connected NXT Supabase project.
- To run the offline browser regression test: `python tests/questionnaire_v7_smoke.py` (requires Playwright and Chromium).

