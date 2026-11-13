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

## Netzwerkmonitor: interaktive Analysen (November 2026)

Im geschützten Netzwerkbereich gibt es jetzt eine drehbare 3D-Netzwerkansicht
(Canvas mit 3D-Koordinaten und perspektivischer Kamera), einen 2D-Kreismodus
und ein Gebäude-Cluster-Layout. Drag mit Maus oder Touch dreht die 3D-Ansicht,
Mausrad zoomt; Pfeiltasten und +/- sind Alternativen. Klick auf einen Knoten
markiert seine eingehenden und ausgehenden Beziehungen. Die Positionen sind
rechnerische Visualisierungskoordinaten **und keine Gebäudedistanzen**.

Ein Stift-Button öffnet die Darstellungseinstellungen, darunter Knotenanzahl,
Sortierung, Größe, Beschriftung, Gebäudeansicht, B2-Austauschbereich und
Isoliertenfilter. Der Vollbild-Button nutzt die Browser-Fullscreen-API,
mit einem vollflächigen Dialog als Fallback. Alle Einstellungen wirken nur
auf die Darstellung; globale KPI-Kacheln beziehen sich weiterhin auf alle
vorhandenen gerichteten Kanten.

Der Monitor berechnet gerichtete Dichte, gegenseitige Nennung, isolierte
Knoten, schwach verbundene Komponenten, Ein-/Ausgangsgrad, normalisierte
Betweenness (Brandes, gerichtete ungewichtete kürzeste Pfade),
Gebäudeverbindungen und B2-Austauschbereiche. Diese Kennzahlen sind **nur
explorativ**, solange noch Interviews fehlen. Fehlende Nennungen unbefragter
Personen dürfen nicht als Nullkanten interpretiert werden. Unbekannte Gebäude
werden gesondert ausgewiesen, nicht als gleiche Gebäude gezählt.

Technik: `js/network-viz.js` ist ein eigenes, lokal eingebundenes Modul ohne
zusätzlichen externen Grafikdienst. Die Visualisierung wird erst nach der
Supabase-Anmeldung und dem Laden der berechtigten Daten erzeugt.

Regressionstests (synthetische Daten, keine Verbindung zur echten Datenbank):
`python tests/network_analysis_smoke.py` und
`python tests/questionnaire_v7_smoke.py`.

## Netzwerk-Analyse-Studio (11.11.2026)

Der neue Bereich **Netzwerk** ist an typische Social-Network-Analysis-Dashboards angelehnt, bleibt aber auf die NXT-Interviewdaten zugeschnitten:

- **Network Graphs:** Alle Knoten statt einer begrenzten 16-Personen-Vorschau, interaktives 3D/2D-Canvas (Drehen, Zoomen, Antippen), Vollbild, ID-Auswahl und Kategorienauswahl.
- **Graph-Filter:** Labels, gerichtete Pfeile, Mehrfachkanten, Schleifen (für importierte GraphML-Dateien), Isolierte, nur interviewte Personen, Themenbereich, Kategorie nach Gebäude/Mitarbeitergruppe, schwache oder starke Komponenten und Mindestgröße.
- **Darstellung:** 3D-Kraftlayout, 2D-Kraftlayout, Gebäudecluster und Kreis; Streuung, Tiefe, Größe nach In-/Out-/Gesamtgrad oder Betweenness, Multiplikator und Diagrammhöhe.
- **Network Metrics:** Gerichtete Dichte, schwache/starke Komponenten, Erreichbarkeit, In-/Out-Degree, Betweenness und Closeness.
- **Textanalyse:** Häufigkeiten der B2-Austauschbereiche und aggregierte Worthäufigkeiten aus optionalen Kanten-Notizen (mindestens zwei Vorkommen, einfache Stopwortfilterung). Das ersetzt keine wissenschaftliche qualitative Inhaltsanalyse.
- **Assortativität:** gerichtete Mischungsmatrix und Newman-r nach Gebäude oder Mitarbeitergruppe; unbekannte Kategorien werden aus der Berechnung ausgeschlossen.
- **Lokale GraphML-Import-Vorschau** (keine Datenbankschreiboperation), rein synthetische Demodaten, GraphML-Export, interaktive eigenständige HTML-Datei und PNG-Ausgabe. Exporte realer Forschungsdaten sind Administratoren vorbehalten.

**Methodischer Hinweis:** 3D-Layouträume sind keine echten Gebäudekoordinaten. Wegen noch offener Interviews sind Dichte, Reziprozität, Zentralität und Isolierung stets vorläufig und explorativ. Die GraphML-Importvorschau wird im Browser gehalten und nicht mit Supabase synchronisiert.

## Einstellungen – Interview einzeln zurücksetzen

Der neue Navigationsreiter **Einstellungen** bietet Administratoren eine Personenliste mit Suche. Der Reset eines vorhandenen Interviews erfordert:

1. Person auswählen und die Personen-ID im Bestätigungsdialog erneut eintippen.
2. Die Warnung zum irreversiblen Löschen bestätigen.
3. Eine **serverseitige** RPC `public.reset_interview(uuid,bigint,text)` mit Rollenprüfung, Versionsprüfung und atomarem Reset ausführen.

Gelöscht werden **nur die Antworten dieses Interviews, dessen ausgehende Kanten und die zugeordneten Ortsdaten**; das Interview selbst bleibt mit Status `planned` erhalten, damit es erneut begonnen werden kann. Person und deren Stammdaten bleiben bestehen, ebenso alle anderen Interviews. Ein Audit-Log hält Zeitpunkt, Admin-ID, Ziel-ID, vorherigen Status und die Anzahl der entfernten Datensätze fest. Bei gleichzeitiger Bearbeitung wird ein Versionskonflikt statt einer stillen Löschung erzeugt.

Die produktive Datenbank verwendet dafür `sql/004_admin_reset_interview.sql` **gefolgt von** `sql/005_harden_reset_rpc.sql`. Die privilegierte Implementierung liegt im privaten Schema `nxt_private`; öffentlich erreichbar ist nur ein `SECURITY INVOKER`-Wrapper. Die Oberfläche allein schützt keine Löschoperation – die Autorisierung erfolgt in der Datenbank. **Es wurde bei der Einrichtung kein echtes Interview zurückgesetzt.**

Testläufe mit synthetischen Daten:

```bash
python tests/network_studio_reset_smoke.py
python tests/verify_standalone_html.py
python tests/questionnaire_v7_smoke.py
```

## Geografische Ebene (2,5D, konzeptionelles Campusmodell)

Unter **Netzwerk** kann zwischen **Soziale Ebene** und **Geografische Ebene** gewechselt werden. Die neue Ansicht zeigt die grafische Campusbasis, Personen/Bürogebäude, B1-Kanten als gerichtete Gebäudeaggregation, Themen-/Statusfilter, Matrix, Campusorte und Datenqualität. Die Bürostandortzählung ist **keine Anwesenheitsmessung**. C2/C7/C8-Werte werden ausschließlich als aggregierte Antwortnennungen und nicht als punktgenaue Bewegungen angezeigt. Die Karte bleibt auch beim Zoomen durch das Bild-Koordinatensystem (`NXT-IMG-1000`) konsistent.

Die künstlerische 2,5D-Grafik hat **keinen gültigen Metermaßstab**. Die fünf Gebäudehöhen sind vorläufig mit ca. zwei oberirdischen Geschossen bzw. 7 m angenommen. Der Originalplan ist über den Karten-Button abrufbar. Positionen der im Fragebogen markierten sozialen Orte und Anreisepunkte sind auf dem 2,5D-Bild näherungsweise übertragen. Methodik, Kontrollpunkte und ausstehende Validierung: [`CAMPUS_KOORDINATEN.md`](CAMPUS_KOORDINATEN.md).

**Datenquellen:** `persons` (Hauptgebäude, Raum, Rolle), `interviews` (Status), `edges` (gerichtete fachliche Nennungen) und nach Anmeldung `answers` (C2/C7/C8). Es gibt **keine** Änderung des Supabase-Schemas, der bestehenden Fragebögen oder ihrer Antworten. Das Browsermodul wird erst nach erfolgreicher Team-Anmeldung mit Forschungsdaten befüllt. Test: `python tests/campus_smoke.py` (nur synthetische Daten).

## Team & Zugänge: persönliche Konten

Unter **Einstellungen → Team & Zugänge** können aktive Administratoren eigenständige Logins anlegen. Für ein neues Mitglied werden **Name**, **E-Mail** und **Rolle** (Interviewer/Administrator) angegeben. Standardmäßig ist **Interviewer** eingestellt. Der Server erstellt über Supabase Auth einen einmaligen Einladungstoken und trägt das Konto in `survey_members` ein. Der **Einladungslink** wird nur dem angemeldeten Administrator in der Website angezeigt und muss sicher (z. B. über Microsoft Teams) an genau die eingeladene Person weitergegeben werden. Es ist **kein gemeinsames Team-Passwort** erforderlich.

Die eingeladene Person öffnet den Link, die Browser-App überprüft den Auth-Token mit `verifyOtp({ type: 'invite' })` und fordert ein **eigenes Passwort von mindestens 12 Zeichen** an. Danach erfolgt jede Anmeldung mit eigener E-Mail + Passwort. Der Link nutzt ein URL-Fragment (`#nxt_invite=...`), nicht einen URL-Queryparameter; damit überträgt GitHub Pages den Einmal-Token nicht in HTTP-Zugriffspfaden. In der Oberfläche kann ein Administrator die Teamliste einsehen, Rollen ändern, Zugänge deaktivieren und die Verwaltungsaktionen nachverfolgen. Das eigene Administrator-Konto kann nicht über diese Ansicht herabgestuft oder deaktiviert werden.

**Serverseitige Sicherheit:** Die Edge Function `team-access` validiert den individuellen Supabase-Access-Token über GoTrue und prüft die aktive Administratorrolle in `survey_members`. Erst dann wird die privilegierte Auth Admin API verwendet. Geheim-/Service-Schlüssel sind ausschließlich in der Edge Function-Umgebung verfügbar und werden **niemals** an GitHub Pages ausgeliefert. Das Audit ist per RLS ausschließlich für aktive Administratoren lesbar. `verify_jwt=false` beim Deployment ist beabsichtigt, da die JWT-Prüfung **im Handler selbst** stattfindet (auch für aktuelle Publishable Keys).

**Supabase-Projekt `trqhbzzwpamcyxzxaxmk`:** Die Funktion `supabase/functions/team-access/index.ts` und das Schema `sql/007_team_access_audit.sql` wurden bereitgestellt. Zum erneuten Deployment den Code in der Supabase-Edge-Function `team-access` verwenden und die Runtime-Umgebungsvariablen `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` sowie `SUPABASE_PUBLISHABLE_KEYS` verfügbar halten (werden von Supabase gehostet automatisch bereitgestellt). Für die Link-Variante wird **kein SMTP-Server** benötigt. Wer spätere Auth-Einladungen **automatisch per E-Mail versenden** möchte, muss bei Supabase eigenes SMTP bzw. einen Send-Email-Hook konfigurieren.

Die derzeitigen vorhandenen Benutzer, Interviews, Netzwerkbeziehungen und Standorte wurden bei der Umstellung **nicht verändert**.

Tests mit synthetischen Daten:
- `node tests/team_access_edge_smoke.cjs`
- `python tests/team_access_frontend_smoke.py`

### Teamzugang endgültig löschen und erneut einladen

Administratoren finden unter **Einstellungen → Team & Zugänge** neben jedem fremden Teamkonto die Aktion **Löschen**. Nach Eingabe der vollständigen E-Mail zur Bestätigung ruft die Oberfläche die serverseitige Edge-Function-Aktion `delete_user` auf. Diese prüft den Admin-JWT, die aktive Administratorrolle, die Zielperson, die unveränderliche Benutzer-ID, den vollständigen E-Mail-Abgleich sowie den Schutz vor Selbstlöschung und Löschen des letzten aktiven Administrators. Sie ruft `auth.admin.deleteUser(userId, false)` (Hard Delete) auf. Die per Fremdschlüssel verknüpfte `survey_members`-Zuordnung wird automatisch mitgelöscht, anschließend ist **dieselbe E-Mail erneut einladbar**. Vorhandene Interviewdaten, Netzwerkbeziehungen und die 39 Forschungspersonen sind davon unabhängig und bleiben bestehen. Bestehende Zugriffs-JWTs können bis zum Ablauf gültig sein, haben nach dem Entfernen der Mitgliedschaft aber keine Datenberechtigung mehr. Ein Admin-only-Audit speichert den Vorgang mit der E-Mail (keine Wiederherstellung des gelöschten Auth-Kontos). Die Migration `sql/008_team_account_hard_delete.sql` erweitert nur die möglichen Audit-Aktionen; es werden durch die Migration **keine Konten gelöscht**.
