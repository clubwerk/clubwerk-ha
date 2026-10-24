# Turniere – Vorschlag (noch nicht gebaut)

Vorbild: turnigo.de (am 24.10.2026 angesehen: Startseite, FAQ, Demo-Turnier). Turnigo ist **keine Planungs-Software**, sondern eine Hilfe **für den Turniertag** von LK-Tennisturnieren. Angelegt, zugelassen, ausgelost und terminiert wird weiter in nuLiga. Turnigo liest die nuLiga-Datei ein und übernimmt dann den Ablauf vor Ort. Die Ergebnisse trägt man danach von Hand in nuLiga ein.

## Was Turnigo kann (Stand Oktober 2026)
- **Import** aus nuLiga (PDF oder XML): Spieler, Konkurrenzen, Spielplan. Formate: Spiralturnier, Gruppenturnier, Leiterturnier, mehrtägiges K.-o. mit Nebenrunde.
- **Check-in-Zentrale:** Spieler einchecken, Nenngeld bar oder digital erfassen, Kassenbericht (eingenommen, bar, digital, offen), Spieler als „abwesend“ und wieder zurück melden. Zuschauer, Helfer und TV einchecken, Spielerausweise drucken. Sortierung nach Nachname, Startzeit oder LK.
- **Persönliche Spielerseite ohne Anmeldung:** Beim Check-in gibt es einen QR-Code. Darauf: nächstes eigenes Match (wann, wo, gegen wen), Ablauf des eigenen Platzes, Tagesrückblick mit LK-Änderung.
- **Turnierzentrale:** je Platz das laufende Match mit Stand und Dauer, das nächste Match („bereit zum Start“) und eine Warteschlange („Spieler spielt noch“). Automatische Platzverteilung, auch begrenzt („max. 3 Plätze“), und „ursprüngliche Planung wiederherstellen“.
- **Zeitplan:** je Platz eine Spalte, jedes Match in geplanter Länge, rote Linie für die aktuelle Uhrzeit. Läuft ein Match länger, rutschen die Folgespiele automatisch nach hinten und werden markiert (z. B. „+28 min über Plan“). Am Handy blättert man Platz für Platz.
- **Match-Start Schritt für Schritt:** Bälle abholen, Platz, Gegner, Timer fürs Einspielen.
- **Live-Ergebnis:** Spieler tragen den Stand auf dem Handy mit Plus/Minus ein, Satz für Satz. Ein Handy pro Match reicht. Sonst tragen Helfer oder die Turnierleitung ein.
- **Zuschauer:** Link oder QR-Code, alle laufenden Spiele live mitverfolgen.
- Weiteres: Turnierinfo mit Nenngeld je Konkurrenz und Wetter (nach Postleitzahl).

## Vorschlag für Clubwerk: Modul „Turniere“

### Stufe 1 – der Turniertag (wie Turnigo)
- **nuLiga-Import (XML, notfalls PDF):** Konkurrenzen, Spieler (Name, Verein, LK) und Spielplan. Fehlt eine Datei, lässt sich alles auch von Hand anlegen.
- **Check-in am Tablet oder in der Verwaltung:**
  - Nenngeld bar oder digital, mit Kassenbericht. Barzahlung kann optional in die Kasse des Verkaufs gebucht werden.
  - „Abwesend“ und „Zurück“.
  - QR-Code je Spieler zum Zeigen oder Ausdrucken.
- **Spielerseite per QR-Code** ohne Konto und ohne App: nächstes Match, Ablauf des Platzes, eigene Ergebnisse. Der Link gilt nur für dieses Turnier und läuft danach ab. Eigene Mitglieder sehen dasselbe zusätzlich in der Mitglieder-App.
- **Turnierzentrale** für die Turnierleitung: Plätze mit laufendem und nächstem Match, Warteschlange, Platzverteilung von Hand oder automatisch.
- **Zeitplan** mit Uhrzeit-Linie und automatisch nachrutschenden Folgespielen.
- **Live-Ergebnis** durch die Spieler (Plus/Minus, Satz für Satz, Match-Tiebreak), durch Helfer oder durch die Turnierleitung.
- **Zuschauer- und TV-Ansicht:** eine Seite für den Fernseher im Clubhaus oder für Handys (Link/QR).
- **Push** für Mitglieder mit App: „Dein Match beginnt auf Platz 3“.
- **Buchungssystem** (wenn aktiv): Plätze am Turniertag automatisch sperren, über `ctx.callHooks`.

### Stufe 2 – eigene Turniere ohne nuLiga
- Vereinsmeisterschaft, Schleifchenturnier (Doppel je Runde neu gelost), Jugendturniere.
- Anmeldung in der Mitglieder-App, Auslosung mit Setzliste (K.-o., Jeder gegen jeden, Gruppen mit K.-o.).
- Ehrentafel der Vereinsmeister.

### Nicht geplant
- Rückübertragung nach nuLiga (das kann auch Turnigo nicht).
- Eigene LK-Berechnung: Die DTB-Formel ist aufwendig, und nuLiga rechnet sie ohnehin. Höchstens später als Schätzung.

## Wichtige Punkte für Clubwerk
- **Fremde Spieler:** Bei LK-Turnieren kommen die meisten Spieler aus anderen Vereinen und haben keine Clubwerk-App. Ihre Handys müssen die Spielerseite trotzdem erreichen: über den Tunnel der Mitglieder-App oder über ein Gäste-WLAN mit Zugang zu Home Assistant. Ohne eines von beiden geht es nur über TV und Tablet.
- **Datenschutz:** Namen, Vereine und LK fremder Spieler werden nach einer einstellbaren Frist nach dem Turnier gelöscht. Echte nuLiga-Dateien kommen nie ins Repository. Für Tests wird eine Beispieldatei mit erfundenen Namen gebaut.
- **Sicherheit:** Die Spieler-Links sind lange Zufallsschlüssel, gelten nur für ein Turnier und nur bis zum Turnierende. Ergebnisse darf nur eintragen, wer im Match spielt, ein Helfer oder die Turnierleitung.

## nuLiga-Dateien (Aufbau, angesehen an echten Exporten eines vergangenen Turniers)
Die echten Dateien enthalten Namen, Anschriften, Geburtsdaten, E-Mails und Telefonnummern fremder Spieler. Sie kommen **nie** ins Repository. Für Tests baut man eine Beispieldatei mit demselben Aufbau und erfundenen Daten.

- **XML** (`TurnierExport_….xml`, DTD `dtb-tournament-1.1`) ist die richtige Quelle. **Eine Datei je Turnier.** Ein Wochenende kann mehrere Turniere haben (z. B. Aktive Samstag, Doppel Sonntag, Senioren), dann gibt es mehrere Dateien. Der Import muss mehrere Dateien zu **einem Turniertag** zusammenführen können.
  - `tournament`: Name, Start- und Enddatum, Meldeschluss, Auslosungstermin, Nenngeld, Altersgruppe (`general`/`seniors`), Ballmarke.
  - `organizer`: Vereinsnummer, Kontakt.
  - `person`: nuLiga-ID, Vor- und Nachname, Geburtsdatum, Geschlecht, Verein mit Nummer, DTB-ID, `lk-single`, Kontaktdaten. **Die LK steht hier nur als ganze Zahl.** Die Meldeliste (PDF/CSV) hat sie mit Komma (z. B. 16,1).
  - `event` (Konkurrenz): Name (z. B. „Herren 40 Einzel“), Einzel/Doppel, Geschlecht (auch `mixed`), Alter, Nenngeld, LK-Bereich, `consolation="match1"` (Nebenrunde), Hinweise.
    - `registration-list`: Teilnehmer (bei Doppel zwei Personen), Anmeldezeit, **`registration-note`** mit Zeitwünschen („bitte nur vormittags“, „zeitgleich mit meiner Schwester“). Das muss die Turnierleitung sehen.
    - `draw`: `mode="one-day-tournament"` (LK-Tagesturnier, jeder spielt in der Regel zwei Runden), `final="third-place"`, Feldgröße, Setzliste.
    - `match`: Runde, Match-Nr., Gruppe (0 Hauptfeld, 1 Nebenrunde), **Platz** („Platz 3“), **geplante Uhrzeit**, Zählweise (`CT_2S6G_MTB10` = 2 Gewinnsätze + Match-Tiebreak bis 10, `CT_LEGACY`), Status (`walk-over-a/b` = kampflos, `retired-a/b` = Aufgabe), Sätze (`games-a`/`games-b`, der Match-Tiebreak steht als dritter Satz, z. B. 10:6).
    - Konkurrenzen ohne Meldungen stehen leer in der Datei und werden beim Import übersprungen.
- **CSV** (`Spieleranmeldungen.csv`): Windows-1252, Semikolon. Eine Zeile je Meldung, Doppelpartner in derselben Zeile. LK mit Komma, **Gebührenabrechnung** (`bar`/`keine`) und Status (`bearbeitet`/`abgemeldet`, `Hauptfeld`/`nicht zugelassen`). Nützlich als Ergänzung: genaue LK und wer schon bezahlt hat.
- **PDF** (Sammel-Download): nur Meldelisten zum Ausdrucken, kein Spielplan. Für den Import nicht nötig.

**Datensparsamkeit beim Import:** Übernommen werden nur Name, Verein, LK, Geschlecht, Geburtsjahr (für Altersklassen) und die nuLiga-IDs. Anschrift, E-Mail und Telefon werden nicht gespeichert.

## Offene Fragen an Thorsten
1. Ist Stufe 1 (Turniertag mit nuLiga-Import) das Wichtigste, oder eher Stufe 2 (eigene Vereinsturniere)?
2. ~~nuLiga-XML-Datei~~ – erledigt, Aufbau steht oben. Noch offen: Enthält ein Export **vor** dem Turnier schon Plätze und Uhrzeiten? In den Dateien des vergangenen Turniers stehen sie.
3. Wie erreichen fremde Spieler die Seite: über den Tunnel der Mitglieder-App, über ein Gäste-WLAN, oder nur über TV und Tablet?
4. Nenngeld: bar in die Verkaufskasse buchen, oder nur im Turnier-Kassenbericht führen?
5. Gibt es im Clubhaus einen Fernseher für die Live-Anzeige?
6. Brauchen wir den Schritt-für-Schritt-Match-Start (Bälle abholen, Einspiel-Timer), oder reicht „Match starten“?
