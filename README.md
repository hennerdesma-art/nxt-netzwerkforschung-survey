# NXT | Netzwerkforschung - Interviewplattform

Responsive GitHub Pages website for centrally collecting ~40 interviews about the
relationship between spatial proximity and professional exchange at NXT, Reutlingen.
The university/NXT logo is provided in `assets/nxt-logo.png`.

## Features

- NXT-themed login and responsive dashboard (desktop / iPad / mobile)
- Person directory, manual creation, Excel/CSV import
- Interview steps A (person group), B (directed professional edges), C (locations), D (review)
- Central Postgres database with Supabase Auth and strict RLS membership checks
- Atomic interview save and optimistic-lock version to prevent concurrent overwriting
- Cross-device status sync with realtime listener (if publication enabled) and 30s polling
- Automatic draft save after 12 seconds without edits, plus manual save and completion
- Interview start/completion timestamps and duration in minutes for pilot timing checks
- Seven-sheet Excel export: Persons, Interviews, Answers, Edges, Locations, Nodes, Datenqualitaet
- Gephi-compatible Node/Edge sheet headers (Id, Label, Source, Target)

IMPORTANT: The questionnaire is a FIRST INSTRUMENT DRAFT based on the feedback
notes dated 10 November 2026. The final full questionnaire was not provided.
Do not collect real interview data until the wording and the privacy process are approved.

## Setup 1: dedicated Supabase project

1. Create an independent Supabase project, preferably in a vetted EU region
   selected by your university's data protection officer.
2. Open `SQL Editor` and run `sql/001_initial_schema.sql` once.
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
   `SUPABASE_PUBLISHABLE_KEY` (begins `sb_publishable_`), and `AUTH_EMAIL`.
   **NEVER** use a secret key, service_role key, or database password in the site.
6. In Supabase > Database > Publications, add `persons`, `interviews`, and
   `edges` to `supabase_realtime` if you want immediate updates. Otherwise
   the website checks the shared data every 30 seconds.
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
- `edges`: directed source -> target, frequency, topics, exchange form
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

- Integrate the FINAL complete questionnaire before real interviews.
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

## Source of questionnaire content

`Fragen zum Fragenkatalog: 10.11.2026` (feedback notes, supplied by the user):
A1 group membership, A2 professional self-classification and organizational
mapping question, B exchange frequency/mode/content categories including
research, teaching, and self-governance; interview conducted together with
respondent, interview timing to be tested, attendance tracking.