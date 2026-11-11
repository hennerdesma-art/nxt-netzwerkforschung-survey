# NXT geografische Ebene – Koordinaten und Datenqualität

## Zweck
Die geografische Ebene ergänzt die vorhandene soziale Netzwerkanalyse. Sie visualisiert Gebäudezuordnungen (`persons.building`), gerichtet gemeldete Austauschbeziehungen (`edges`) und aggregierte Begegnungsorte aus dem Fragebogen (`answers` zu C2/C7/C8). Die Erhebung wird dadurch **nicht** geändert.

## Zwei getrennte Ebenen
- Soziales Netzwerk: B1–B6; Quelle → Ziel, Häufigkeit, Austauschthema, Medium, Erhebungsstatus.
- Räumliche Ebene: Arbeits-/Bürogebäude, vorhandene Räume und vorläufige Campusmarker. Die angezeigten Personenwerte sind keine Live-Anwesenheitsdaten.

## Bild-Koordinatensystem v1
`NXT-IMG-1000`: x = 0…1000 und y = 0…563 (links oben = 0,0). Es sind reine Bildkoordinaten für die **illustrative** WebP-Karte im Seitenverhältnis 1672:941. Sie entsprechen weder Dezimalgrad/GPS noch Metern. Die Marker bleiben beim Skalieren auf dem Bild verankert. Als verlässlich beschriftete Referenz wird der bereits im Fragebogen verwendete `assets/nxt-lageplan.webp` (Campusplan Stand 07/2025, bearbeitet) zum manuellen Vergleich geöffnet; beide Ansichten sind noch nicht deckungsgleich kalibriert.

| Gebäude | X | Y | angenommene oberirdische Geschosse | angenommene Höhe | Herkunft |
| --- | ---: | ---: | ---: | ---: | --- |
| 21 | 328 | 58 | 2 | ca. 7 m | Bildposition manuell, Höhe unbestätigt |
| 5 | 482 | 154 | 2 | ca. 7 m | Bildposition manuell, Höhe unbestätigt |
| 16 | 553 | 385 | 2 | ca. 7 m | Bildposition manuell, Höhe unbestätigt |
| 17 | 485 | 392 | 2 | ca. 7 m | Bildposition manuell, Höhe unbestätigt |
| D | 815 | 394 | 2 | ca. 7 m | Bildposition manuell, Höhe unbestätigt |

Die ungefähren 7 m entsprechen einer **Modellannahme** für EG + ein Obergeschoss. Ein Keller ist eine separate Annahme und zählt **nicht** zur oberirdischen Gebäudehöhe. Vorhandene Geschosspläne Bau 17 OG und Bau 5 UG reichen nicht zur Bestätigung der Gesamthöhen. Die 2,5D-Illustration darf nicht als Originalbauplan oder vermessene Karte genutzt werden. Die im Bild enthaltene künstlerische Maßstabsleiste ist **nicht gültig** für wissenschaftliche Messungen.

## Soziale Treffpunkte
Die Orte **6–9** (Interimsmensa Geb. 11, Lernzentrum/Verwaltung Geb. 3, Rechen- und Medienzentrum Geb. 8, Aula Geb. 6) und Anreiseorte **10–16** stammen aus dem beschrifteten Lageplan des Fragebogens. Sie wurden **manuell auf den 2,5D-Entwurf übertragen**, weshalb diese neuen Bildpositionen noch ungenau sind. C7/C8-Nennungen werden kategorienbezogen ausgewertet; breite Angaben wie Parkplatz/Haltestelle, Flure und Küchen dürfen nicht einem beliebigen einzelnen Pin zugeschrieben werden. Geteilte Infrastruktur aus C2 sowie Angaben aus C7/C8 können separat nach Anzahl positiver Nennungen gefiltert werden.

## Zusammenführung und Berechnungen
1. `persons.id` verknüpft die Stammdaten mit den gerichteten `edges.source_person_id` und `edges.target_person_id`.
2. Gebäude werden nur bei explizit eindeutigen Stammdaten wie `16`, `Gebäude 16` oder `Bau 16` zugeordnet. Nicht interpretierbare Angaben bleiben offen.
3. Ein Link `16 → 21` zählt gemeldete gerichtete Nennungen aus B1. Die Gegenseite entsteht nicht automatisch.
4. Die Gebäude-Matrix zeigt vollständig verortete Quell-/Zielpaare. Fehlende Gebäudedaten werden gesondert ausgewiesen und **nicht** geschätzt.
5. Filter nach B2 (Austauschthema), B3 (Antwortcode), Status des Quellinterviews, Mitarbeitergruppe, Gebäude und Richtung ändern nur die Ansicht.
6. Positive Ortsantworten aus `answers` (C2, C7, C8) zählen einmal je Interview und Variable. Diese sind keine beobachteten Ereignisse oder ortsgenauen Bewegungsdaten.
7. Die Benutzeroberfläche zeigt Personenzahlen pro Bürogebäude; nicht die Zahl aktuell anwesender Personen.
8. Die Originalantworten und die Personentabelle bleiben in Supabase. CSV-Exporte enthalten eine aggregierte Gebäudematrix beziehungsweise pseudonymisierte Personen-IDs.

## Noch offen – für die Forschungsfrage zwingend
- Originalgrundriss / CAD-Kontrollpunkte der fünf Gebäude mit korrekten Gebäudeflächen und Eingängen.
- Verifizierte Etagen/Room-Centroids und tatsächliche Wege (Tür zu Tür, einschließlich kürzester begehbarer Strecken).
- Routenlängen, die **nicht** aus Pixelabständen oder der Maßstabsleiste der Illustration berechnet werden dürfen.
- Ortskoordinaten der tatsächlichen Mensa, Lernzonen, Gemeinschaftsräume, Flure, Kaffeeküchen und anderer sozialer Treffpunkte.
- Vor Abschluss der Erhebung: unbekannte/nicht befragte Werte nicht als fehlenden Austausch interpretieren.

Die Karte ist als explorative und präsentationsgeeignete Ebene gedacht. Statistische Auswertungen räumlicher Nähe müssen auf einer gesonderten validierten Distanzmatrix beruhen.
