# Werkzeuge

Hilfsmittel für die Entwicklung. Sie gehören nicht zum Add-on, Home Assistant ignoriert diesen Ordner. Den Ablauf einer neuen Version beschreibt `CLAUDE.md` im Hauptordner.

| Datei / Ordner | Zweck |
|---|---|
| `paket.sh` | Prüft eine neue Version vollständig und baut `ausgabe/clubwerk-<version>.zip`. |
| `modver.js`, `modulstand.json` | Erkennt geänderte Module ohne neue Versionsnummer. |
| `pruef.js` | Trägt die Prüfsumme der Version in `PRUEFSUMMEN.md` ein. |
| `i18n/` | Sammelt Texte (`extract.js`), listet fehlende Übersetzungen und spielt sie ein (`fehlend.js`). Übersetzungsregeln stehen in `ANLEITUNG-EN.md`. |
| `demo/` | Demo-Server mit erfundenen Daten: `start.sh`, `stop.sh`, `demo.sql`. |
| `tests/` | Rund 50 erweiterte Testreihen mit Vergleich gegen die bekannten Fehlschläge (`erwartet.txt`). |
| `design-pruefstand/` | Automatische Design-Prüfung aller Oberflächen. |
| `.geheim-muster` | Nur lokal. Zeichenfolgen, die nie im Repository stehen dürfen. |
