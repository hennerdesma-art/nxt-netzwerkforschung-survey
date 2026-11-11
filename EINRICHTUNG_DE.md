# NXT Netzwerkforschung | Einrichtung

Die Website ist als GitHub-Pages-Projekt vorbereitet. Sie kann nach dem Verbinden
mit Supabase von mehreren angemeldeten Geräten gleichzeitig genutzt werden.

## 1. Supabase-Projekt einrichten

1. Das separate Supabase-Projekt **NXT Netzwerkforschung** wurde in Frankfurt erstellt.
2. Die Migrationen `sql/001_initial_schema.sql` und `sql/003_questionnaire_v7.sql` sowie die Live-Synchronisierung sind bereits eingerichtet.
3. Unter **Authentication > Users** einen Benutzer mit einer gültigen,
   teamverwalteten E-Mail-Adresse anlegen. Als temporäres Passwort das
   getrennt mitgeteilte Team-Passwort setzen. Es steht absichtlich nirgends
   im öffentlich zugänglichen GitHub-Code.
4. Die echte Auth-UUID des Benutzers in folgendem SQL einsetzen:

   ```sql
   insert into public.survey_members (user_id, display_name, role)
   values ('ECHTE_AUTH_UUID', 'NXT Interview-Team', 'admin');
   ```

5. Projekt-URL und **Publishable Key** sind in `js/config.js` bereits hinterlegt.
   `AUTH_EMAIL` ist optional: Leer lassen für Login mit E-Mail und Passwort;
   eine feste Team-E-Mail ermöglicht später einen Passwort-only-Login.
6. Die Realtime-Publikation fuer `persons`, `interviews` und `edges` ist aktiv;
   zusätzlich synchronisiert die Website alle 30 Sekunden.

## 2. GitHub Pages einrichten

1. Alle Dateien aus dem Projektpaket in den `main`-Branch des neu angelegten
   Repositories uebernehmen.
2. In **Settings > Pages > Build and deployment** die Quelle
   **GitHub Actions** einstellen.
3. Der Workflow `.github/workflows/pages.yml` veröffentlicht nur die
   Website-Dateien (ohne SQL-Skripte, Testdateien oder Forschungsdaten).
4. Nach erfolgreichem Workflow die GitHub-Pages-URL aufrufen.

## 3. Funktionstest mit fiktiven Daten

1. Mit der unter Supabase Auth angelegten E-Mail-Adresse und dem Team-Passwort anmelden.
2. Eine fiktive Testperson anlegen und ein Interview beginnen.
3. Eine zweite fiktive Person als Austauschpartner hinterlegen.
4. Entwurf speichern, dieselbe Website auf einem zweiten Gerät oeffnen
   und die aktualisierten Daten prüfen.
5. Interview abschliessen und unter **Datenexport** die XLSX-Datei erzeugen.
6. Kontrollieren, ob `Gesamt_Personen`, `Gesamt_Netzwerk`, `Codebuch` sowie `Persons`, `Interviews`, `Answers`, `Edges`, `Locations`, `Nodes` und `Datenqualitaet` vorhanden sind.
7. Testdaten vor dem echten Studienstart wieder entfernen.

## Wichtige Hinweise

- Die Interviewmaske entspricht der hochgeladenen **Excel-Fragenbogenfassung V7** (Einwilligung, A1–A6, B1–B6, C1–C9). Die echte Verwendung setzt weiterhin die fachliche Freigabe der Fragen und eine angepasste Datenschutzerklärung voraus. Die Excel-Vorlage behauptet teilweise eine sofortige Pseudonymisierung; in der Web-App bleiben Namen für die Erhebung geschützt gespeichert.
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
