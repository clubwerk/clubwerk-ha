# Turniere – Vorschlag (noch nicht gebaut)

Anstoß: Thorsten möchte die Funktionen einer Turnier-Software wie turnigo.de als Clubwerk-Modul. Die Seite war aus der Cloud nicht erreichbar, der Vorschlag beruht auf üblichen Funktionen solcher Programme.

## Stufe 1
- Turnier anlegen: Name, Datum, Plätze, Meldeschluss. Wettbewerbe je Turnier (Einzel, Doppel, Mixed, Altersklassen).
- Formen: K.-o. mit Setzliste und automatischer Auslosung, Jeder gegen jeden.
- Anmeldung in der Mitglieder-App (Doppelpartner aus der Mitgliederliste). Gäste trägt die Turnierleitung in der Verwaltung ein.
- Spielplan: Uhrzeit und Platz je Spiel, Prüfung auf Doppelbelegung von Spielern.
- Ergebnisse (Sätze, Match-Tiebreak): Tablet, App (Sieger trägt ein, Gegner bestätigt) oder Turnierleitung.
- Turnierbaum und Tabellen live in App und am Tablet. Push „Dein Spiel beginnt … auf Platz …“.

## Stufe 2
- Gruppenphase mit K.-o., Trostrunde.
- Schleifchenturnier (Doppel je Runde neu gelost).
- Plätze im Buchungssystem sperren (über `ctx.callHooks`, wenn aktiv).
- Startgeld über `ctx.drinks.charge` bzw. als Forderung der Mitgliederverwaltung.
- Großbildanzeige für Fernseher im Clubhaus.
- Ehrentafel der Vereinsmeister.

Nicht geplant: offizielle Verbands-/Ranglistenturniere (laufen über die Verbandssoftware).

## Offene Fragen an Thorsten
1. Was an Turnigo ist besonders wichtig? (Bildschirmfotos helfen.)
2. Welche Turnierformen werden gebraucht?
3. Gäste: mitspielen? Selbst anmelden (bräuchte eine Anmeldeseite außerhalb der App)?
4. Nur Tennis oder auch Padel und andere Sportarten?
5. Startgeld ja/nein?
6. Fernseher im Clubhaus für die Anzeige?
