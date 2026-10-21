# Design-Prüfstand

Prüft alle Clubwerk-Oberflächen automatisch, bevor eine Version erscheint. Ohne grünes Ergebnis wird kein Paket gebaut.

**Was geprüft wird**

- Oberflächen: Verwaltung (auch im Tablet-Rahmen), Tablet mit allen Modulen, Mitglieder-App, Beregnungs-Webapp
- Größen: Handy 390 × 664 (sichtbare iPhone-Höhe ohne Safari-Leisten), Tablet hochkant, Tablet quer, Rechner
- Hell und Dunkel
- Abläufe: jeder Reiter, je ein Fenster pro Seite, Menü am Handy, bis ganz unten scrollen

**Regeln**

| Regel | Bedeutung |
|---|---|
| `ueberbreite`, `ausserhalb` | Nichts ist breiter als der Bildschirm. |
| `ueberlappung` | Texte und Bedienelemente überdecken sich nicht. |
| `abgeschnitten` | Kein abgeschnittener Text, außer gewollt mit „…“. |
| `kontrast` | Text hat mindestens 4,5 : 1 Kontrast, große Schrift 3 : 1. |
| `ios-zoom` | Eingabefelder am Handy haben mindestens 16 px Schrift, sonst zoomt das iPhone hinein. |
| `tippflaeche` | Am Handy ist jede Tippfläche mindestens 32 px groß, Schalter 24 px. |
| `nicht-erreichbar` | Das Seitenende lässt sich erreichen, auch hinter festen Leisten. |
| `scrollt-hinter-fenster`, `scrollt-hinter-menue` | Ist ein Fenster oder Menü offen, steht die Seite dahinter still. |
| `eigene-kopfzeile` | Keine Seite überschreibt die gemeinsame Kopfzeile. |
| `iphone-hoehe-100vh` | Volle Höhe braucht `dvh`, sonst liegt das Ende unter der Safari-Leiste. |
| `font-kurzform-ungueltig` | Keine ungültigen Schriftangaben. |
| `app-neues-fenster` | Die Mitglieder-App öffnet nie ein neues Fenster. |

Ausnahmen stehen mit Begründung in `erlaubt.txt`.

**Starten** (gegen einen Test-Server mit Beispieldaten)

```
pip install playwright
CW_ADMIN_PW=… CW_TABLET_PW=… python3 gate.py ausgabe        # vollständig, ca. 10 Minuten
CW_ADMIN_PW=… CW_TABLET_PW=… python3 gate.py ausgabe --schnell
```

Das Ergebnis liegt in `ausgabe/befunde.txt`, dazu markierte Bilder jeder betroffenen Ansicht.
