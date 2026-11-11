# NXT Netzwerkforschung | Einrichtung

Die Website ist als GitHub-Pages-Projekt vorbereitet. Sie kann nach dem Verbinden
mit Supabase von mehreren angemeldeten Geräten gleichzeitig genutzt werden.

## 1. Supabase-Projekt einrichten

1. Ein eigenes, von anderen Projekten getrenntes Supabase-Projekt anlegen.
2. Die Datei `sql/001_initial_schema.sql` im **SQL Editor** ausführen.
3. Unter **Authentication > Users** einen Benutzer mit einer gültigen,
   teamverwalteten E-Mail-Adresse anlegen. Als temporäres Passwort das
   getrennt mitgeteilte Team-Passwort setzen. Es steht absichtlich nirgends
   im öffentlich zugänglichen GitHub-Code.
4. Die echte Auth-UUID des Benutzers in folgendem SQL einsetzen:

   ```sql
   insert into public.survey_members (user_id, display_name, role)
   values ('ECHTE_AUTH_UUID', 'NXT Interview-Team', 'admin');
   ```

5. URL und **Publishable Key** (NICHT Secret-/Service-Key!) im Supabase-Dashboard
   kopieren. In `js/config.js` die Werte `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY` und die verwendete `AUTH_EMAIL` eintragen.
6. Unter **Database > Publications** in `supabase_realtime` die Tabellen
   `persons`, `interviews` und `edges` freischalten. Ohne diese Option
   aktualisiert die Website den Datenstand alle 30 Sekunden.

## 2. GitHub Pages einrichten

1. Alle Dateien aus dem Projektpaket in den `main`-Branch des neu angelegten
   Repositories uebernehmen.
2. In **Settings > Pages > Build and deployment** die Quelle
   **GitHub Actions** einstellen.
3. Der Workflow `.github/workflows/pages.yml` veröffentlicht nur die
   Website-Dateien (ohne SQL-Skripte, Testdateien oder Forschungsdaten).
4. Nach erfolgreichem Workflow die GitHub-Pages-URL aufrufen.

## 3. Funktionstest mit fiktiven Daten

1. Mit dem Team-Passwort anmelden.
2. Eine fiktive Testperson anlegen und ein Interview beginnen.
3. Eine zweite fiktive Person als Austauschpartner hinterlegen.
4. Entwurf speichern, dieselbe Website auf einem zweiten Gerät oeffnen
   und die aktualisierten Daten prüfen.
5. Interview abschliessen und unter **Datenexport** die XLSX-Datei erzeugen.
6. Kontrollieren, ob `Persons`, `Interviews`, `Answers`, `Edges`, `Locations`,
   `Nodes` und `Datenqualitaet` vorhanden sind.
7. Testdaten vor dem echten Studienstart wieder entfernen.

## Wichtige Hinweise

- Die aktuell eingebauten Fragen sind ein **erster Entwurf** anhand der
  Rückmeldungen vom 10.11.2026. Der vollstaendige endgültige Fragenkatalog
  muss vor der Datenerhebung eingearbeitet und abgestimmt werden.
- Das vereinbarte Anfangspasswort **vor echten Interviews ändern** und
  moeglichst individuelle Teamkonten nutzen.
- Ein passwortgeschuetzter Login ist kein Datenschutzkonzept. Speicherung,
  Auftragsverarbeitung, Rechtsgrundlage, Informationspflichten und Löschfristen
  muessen vorher mit der Hochschule geklaert werden.
- Excel-Exporte und Namenslisten niemals im GitHub-Repository speichern.
- `interviews.started_at` erfasst den Interviewbeginn beim ersten Öffnen;
  fuer den Pilot-Test wird die Zeitdifferenz bis zum Abschluss exportiert.
- Ein Interviewentwurf wird nach 12 Sekunden ohne weitere Eingabe automatisch
  gespeichert, sofern keine unvollstaendige Kantenzeile vorliegt.
