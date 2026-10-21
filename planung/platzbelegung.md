# Planung: Modul „Platzbelegung“ (Fußball und andere Mannschaftssportarten)

Stand: 21.10.2026. Dies ist ein Vorschlag und noch nicht freigegeben. Gebaut wird erst, wenn die offenen Entscheidungen am Ende geklärt sind.

Der Vorschlag ist ein eigenes, neues Modul **„Platzbelegung“**. Es übernimmt alles rund um große Felder und Mannschaften. Das Buchungssystem bleibt dabei genau so, wie es ist.

## Ausgangslage

Heute kennt Clubwerk Plätze an drei Stellen, und jede davon dient einem anderen Zweck:

| Modul | Was dort ein „Platz“ ist | Wer entscheidet über die Belegung |
| --- | --- | --- |
| Buchungssystem | Buchbare Plätze und Geräte mit Zeitraster, Kontingent, Gästen und Warteliste | Das Mitglied bucht selbst |
| Beregnung | Ein Platz mit seinen Ventilen | Der Platzwart startet die Beregnung |
| Spielbetrieb | Ein Spielort als Text bei einem Spiel; Heimspiele lassen sich ins Buchungssystem übernehmen | Der Spielplan des Verbands |

Beim Fußball wird ein Platz anders genutzt als beim Tennis:

- **Zuteilung statt Selbstbuchung.** Ein Platzwart oder Jugendleiter verteilt die Zeiten auf die Mannschaften, meist für eine ganze Saison.
- **Ein Feld, mehrere Gruppen.** Die F-Jugend trainiert auf einem Viertel, die D-Jugend auf einer Hälfte, die Erste spielt auf dem ganzen Feld. Die Belegung muss wissen, welche Flächen sich überschneiden.
- **Mehr als nur der Platz.** Ein Heimspiel braucht Kabinen für Heim, Gast und Schiedsrichter, außerdem Flutlicht sowie eine Vor- und Nachlaufzeit.
- **Ausfälle betreffen viele.** Wird der Rasen gesperrt, müssen alle betroffenen Trainer sofort davon erfahren.

## Drei Varianten

| | A: Buchungssystem erweitern | **B: Eigenes Modul „Platzbelegung“** (empfohlen) | C: Zentrale Anlagen im Kern |
| --- | --- | --- | --- |
| Idee | Teilflächen, Mannschaften und Saisonpläne kommen ins Buchungssystem | Ein neues Modul für Plätze, die zugeteilt werden; das Buchungssystem bleibt für Selbstbucher | Alle Plätze und Flächen liegen einmal im Kern |
| Buchungssystem | Wird deutlich größer | Bleibt unverändert | Muss umgebaut werden |
| Ein Modul allein nutzbar | Ja | Ja | Nur mit dem neuen Kernbaustein |
| Aufwand und Risiko | Mittel, mit Risiko für bestehende Buchungen | Mittel, ohne Risiko für Bestehendes | Hoch |

Der Schnitt bei B: **Jeder Platz gehört genau einem Modul.** Selbst gebucht wird im Buchungssystem (Tennis, Padel, Geräte), zugeteilt wird in der Platzbelegung (Fußball, Halle, Beachfeld für Mannschaften). Variante C bleibt als späterer Schritt möglich.

## Bausteine

1. **Felder und Teilflächen.** Ein Feld wird einmal geteilt, zum Beispiel ganz, in Hälften oder in Viertel. Clubwerk weiß dann, welche Teile sich überschneiden. Zu jedem Feld gehören Belag, Flutlicht und Maße.
2. **Mannschaften.** Name, Altersklasse, Trainer und Farbe. Ist der Spielbetrieb aktiv, kommen die Mannschaften von dort, sonst gibt es eine eigene kurze Liste.
3. **Trainingsplan.** Wochenpläne je Mannschaft: Wochentag, Uhrzeit, Teilfläche, gültig von bis, etwa als Sommer- und Winterplan. Überschneidungen zeigt der Plan schon beim Eintragen an.
4. **Spiele und Sperren.** Heimspiele aus dem Spielbetrieb belegen das ganze Feld, mit Vor- und Nachlauf. Der Platzwart sperrt ein Feld mit einem Tipp in der App oder am Tablet, und betroffene Trainer bekommen eine Push-Nachricht.
5. **Kabinen.** Bei Heimspielen werden sie automatisch zugeteilt (Heim, Gast, Schiedsrichter), fürs Training freiwillig.
6. **Flutlicht.** Schaltet über Home Assistant nach Plan, mit Vor- und Nachlauf. Die Brennstunden werden je Mannschaft gezählt.

## Daten

| Tabelle | Inhalt |
| --- | --- |
| pb_field | Feld: Name, Belag, Flutlicht, Sortierung |
| pb_part | Teilfläche: Feld, Name, Lage im Raster (welche Viertel sie abdeckt) |
| pb_team | Eigene Mannschaften, nur wenn der Spielbetrieb fehlt |
| pb_plan | Plan: Name, gültig von bis, aktiv |
| pb_slot | Wiederkehrender Termin: Plan, Mannschaft, Teilfläche, Wochentag, Beginn, Ende |
| pb_event | Einzeltermin: Spiel, Sperre, Zusatztraining, Ausfall eines Slots |
| pb_room | Kabine und ihre Zuteilung zu Terminen |

Überschneidungen werden nicht gespeichert, sondern aus dem Raster berechnet. Zwei Teilflächen kollidieren, wenn sie mindestens ein Viertel gemeinsam haben.

## Oberflächen und Rechte

| Wo | Was man dort sieht und tut |
| --- | --- |
| Verwaltung | Reiter Belegung (Wochenraster je Feld, Spalten = Teilflächen), Trainingsplan, Sperren, Einstellungen (Felder, Kabinen, Flutlicht) |
| Mitglieder-App | Reiter „Platzplan“: eigene Mannschaft und „heute auf dem Platz“; Trainer sehen Ausfälle sofort; der Platzwart hat den Knopf „Feld sperren“ |
| Tablet | „Heute auf dem Platz“: Feldskizze mit Mannschaft je Teilfläche und Kabinen, wie ein Aushang |

Rechte nach dem Muster der anderen Module: *ansehen*, *planen*, *sperren* (Platzwart), *Einstellungen*. Trainer sehen ihre Mannschaften auch ohne Verwaltungsrecht.

## Zusammenspiel mit anderen Modulen

Nur über vorhandene Hooks. Jede Verbindung ist optional:

- **Spielbetrieb** liefert Heimspiele, Mannschaften und Trainer.
- **Mitgliederverwaltung** liefert Personen und Push-Empfänger.
- **Beregnung** fragt vor dem Start, ob das Feld belegt ist.
- **Home Assistant** schaltet das Flutlicht.
- **Kern** liefert Rechte, Push, die Tablet-Leiste und den App-Reiter.
- **Buchungssystem** bleibt bewusst ohne Verbindung.

## Ausbaustufen

1. **Plan und Anzeige:** Felder und Teilflächen, Mannschaften, Trainingspläne mit Überschneidungsprüfung, Belegungsraster in der Verwaltung, „Heute auf dem Platz“ am Tablet, Platzplan in der App.
2. **Spieltag und Ausfall:** Heimspiele übernehmen, Sperren mit Push, Kabinen, Zusatztraining und einzelne Ausfälle.
3. **Technik und Auswertung:** Flutlicht über Home Assistant, Brennstunden, Auslastung, auf Wunsch eine Anfrage- und Tauschfunktion für Trainer.

## Offene Entscheidungen

- [ ] **Name:** „Platzbelegung“, „Sportplätze“ oder „Trainingsbetrieb“?
- [ ] **Teilung:** ganz, Hälften und Viertel? Oder auch Drittel und freie Kleinfelder?
- [ ] **Wer plant:** nur Platzwart oder Jugendleiter, oder Trainer mit Freigabe?
- [ ] **Mannschaften:** aus dem Spielbetrieb übernehmen, wenn er aktiv ist? (Vorschlag: ja)
- [ ] **Kabinen:** schon in Stufe 1 oder in Stufe 2?
- [ ] **Flutlicht:** Gibt es einen Verein mit Flutlicht, das schon in Home Assistant schaltbar ist?
- [ ] **Pilot:** Welcher Fußballverein testet mit echten Mannschaften?
