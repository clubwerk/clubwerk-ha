# Clubwerk – Arbeitsanweisung für Claude Code

Clubwerk ist eine modulare Vereinsverwaltung als Home-Assistant-Add-on. Dazu gehören Verkauf am Tablet, Buchungssystem, Spielbetrieb, Helferdienste, Zeiterfassung, Beregnung, Zugang, Mitgliederverwaltung, Buchhaltung und eine Mitglieder-App. Projektsprache ist **Deutsch**, auch in Code-Kommentaren, Commits und Antworten.

Falls `CLAUDE.local.md` existiert, enthält sie den privaten Hintergrund (Verein, Betrieb, Ansprechpartner). Lies sie mit, aber übernimm daraus **nie etwas** ins Repository.

## Aufbau des Repositorys

| Ordner | Inhalt |
|---|---|
| `clubwerk/` | Das Add-on, zugleich der Quellcode. Hier wird entwickelt. Home Assistant baut genau diesen Ordner. |
| `clubwerk/src/` | Server (Node 22, Express, better-sqlite3). |
| `clubwerk/public/` | Verwaltung (`admin.html`/`admin.js`), Tablet (`index.html`, `nav.js`, `style.css`, `kit.css`), Mitglieder-App (`public/app/`). |
| `clubwerk/erweiterungen/<modul>/` | Module mit `erweiterung.json`, `server.js` und `public/` (`admin.js`, `tablet.js`, `member.js`, `index.html`). |
| `clubwerk/sprachen/` | `katalog.json` (alle deutschen Texte, erzeugt) und `en.json` (Englisch). |
| `tests/` | Kerntests. Sie laufen bei jedem Push in GitHub Actions. |
| `werkzeuge/` | Paket bauen, Modulversionen, Prüfsummen, Übersetzungen, Demo-Server, erweiterte Tests, Design-Prüfstand. |
| `ERWEITERUNGEN.md` | Entwicklerdoku für Module: Styleguide, Bausteine, Protokoll, Übersetzungen. Vor Arbeiten an Modulen lesen. |

## Einrichtung (einmal)

```bash
cd clubwerk && npm ci && cd ..
cd werkzeuge/i18n && npm ci && cd ../..
pip install playwright && python3 -m playwright install chromium webkit
# für die Testreihe „targets“: pip install wsgidav cheroot pyftpdlib asyncssh
```

Danach `werkzeuge/geheim-muster.txt` anlegen bzw. von Thorsten erhalten (siehe Abschnitt Geheimnisse). Auch der Name `werkzeuge/.geheim-muster` funktioniert.

**Demo-Server** mit erfundenen Daten: `bash werkzeuge/demo/start.sh`. Jeder Start lädt die Daten frisch, `--behalten` setzt sie nicht zurück. Beenden mit `bash werkzeuge/demo/stop.sh`.

| Oberfläche | Adresse |
|---|---|
| Verwaltung | http://127.0.0.1:3801/admin.html (admin / `Test-Kennwort-42`) |
| Tablet | http://127.0.0.1:3801/ (Tablet-Passwort `Theke-Abend7`) |
| Mitglieder-App | http://127.0.0.1:5803/ |
| Beregnungs-Webapp | http://127.0.0.1:5801/ |

PINs der Demo: Mitglieder 2468, Zeiterfassung 1234 und 5678.

## Feste Regeln – nicht verhandelbar

**Auslieferung und Versionen**
- Jede Änderung am Paket bekommt eine **neue Versionsnummer**, sonst erkennt Home Assistant kein Update. Die Nummer steht an vier Stellen und muss überall gleich sein:
  - `clubwerk/config.yaml`
  - `clubwerk/package.json`
  - `clubwerk/package-lock.json` (zweimal)
  - `APP_VER` in `clubwerk/public/app/app.js`
- Jedes geänderte Modul bekommt eine eigene neue Version in `erweiterungen/<modul>/erweiterung.json`. Das Modul „Verkauf“ hat seine Version in `verkaufVersion` in `package.json`. `werkzeuge/modver.js` prüft das.
- Geliefert wird immer das **vollständige Paket als ZIP**: der ganze Ordner `clubwerk/`, ohne `node_modules`. Thorsten löscht den alten Ordner, kopiert den neuen hinein und klickt in Home Assistant „Neu bauen“. Einzelne Dateien liefert man nicht.
- Jede Version bekommt einen Abschnitt in `clubwerk/CHANGELOG.md`, in Alltagssprache.

**Produkt**
- **Jedes Modul ist einzeln nutzbar.** Ohne Mitgliederverwaltung gibt es nur Vor- und Nachname. Module sprechen nur über `ctx.callHooks(...)` miteinander und prüfen mit `ctx.isModuleActive(...)`, ob das andere Modul da ist.
- Clubwerk muss **komplett lokal** funktionieren, also ohne Cloudflare und ohne Zugang von außen. Es gibt keinen unnötigen Datenverkehr, und Performance wird bei jeder Änderung mitgeprüft.
- Die **Mitglieder-App öffnet nie ein neues Fenster oder Safari**. Alles bleibt in der App, ohne `target="_blank"` und ohne `window.open`.
- Mitgliederlisten werden **immer nach Nachname, dann Vorname** sortiert und als „Nachname, Vorname“ angezeigt (`window.CWNames.lastFirst`).
- Doku und Texte sind **generisch**. Kein echter Vereinsname und keine echte Domain, nur Beispiele wie „TC Grün-Weiß Musterstadt“ oder „dein-verein“.
- Das Tablet-Passwort ist Pflicht. Vertrauliche Daten liegen verschlüsselt im Tresor.
- **Größere Funktionen erst planen und mit Thorsten abstimmen**, dann bauen.

**Design – ein System für alle Oberflächen**
- Verwaltung, Tablet, Mitglieder-App und Webapps folgen denselben Mustern. Innerhalb von Seiten gibt es **Reiter oben**, keine verschachtelten Seitenmenüs. Gleiche Aufgaben bekommen gleiche Steuerelemente, Größen, Abstände und Beschriftungen.
- **Strikte Symmetrie**: keine Sprünge, kein Versatz. Überschriften fluchten mit Knöpfen und Kacheln darunter.
- **Nichts überlappt**, nichts ist abgeschnitten, nichts ist breiter als der Bildschirm. Am Handy wird alles geprüft, auch iPhone-Safari mit seinen Leisten.
- Wer eine Oberfläche ändert, prüft die anderen mit, denn Tablet, App und Verwaltung teilen sich `style.css` und `kit.css`.
- Bausteine aus `ERWEITERUNGEN.md` verwenden:
  - `GK.tabTools`
  - `GK.registerAppSection`
  - `.empty`
  - `.vh-names`
  - Leisten mit `.tabrow`
  - Protokolleinträge mit `ctx.auditDiff`. Das Protokoll zeigt nie interne Schlüssel.
- Farben nur über Tokens (`--ink`, `--muted`, `--faint`, `--brand` …), nie feste Hex-Werte für Text. Kontrast mindestens 4,5 : 1 in hell und dunkel.

**Sprache**
- Jeder neue sichtbare Text braucht eine englische Übersetzung (britisches Englisch). Siehe Abschnitt Übersetzungen.

## Daten und Geheimnisse

- **Nie echte Vereinsdaten ins Repository**: keine Mitgliedernamen, keine CSV-Exporte, keine Datenbanken. Das Repository ist öffentlich. Demo- und Testdaten sind erfunden (`werkzeuge/demo/demo.sql`, `werkzeuge/tests/fixtures/names.json`).
- Testwerte sind `Test-Kennwort-42` (Admin), `Theke-Abend7` (Tablet) und die PINs 2468, 1234, 5678. Echte Passwörter, PINs, API-Schlüssel und Tunnel-Tokens kommen nie in Code, Tests, Doku oder Commits.
- `werkzeuge/geheim-muster.txt` (oder `.geheim-muster`) liegt nur lokal und ist in `.gitignore`. Pro Zeile steht dort eine Zeichenfolge, die nie im Repository stehen darf, etwa der alte API-Schlüssel der Beregnung, echte PINs oder echte Passwörter. `werkzeuge/paket.sh` bricht ab, wenn eine davon irgendwo vorkommt. Fehlt die Datei, Thorsten bitten, sie anzulegen.
- Exporte und Sicherungen enthalten keine PINs, Passwörter oder Schlüssel. Die Tests prüfen das.
- Zugangsdaten gibt Claude nie für Thorsten ein, und ein vollständiges Token gibt Claude nie aus.

## Neue Version – Ablauf

1. Ändern. Danach Versionen hochzählen (siehe oben) und den CHANGELOG-Abschnitt schreiben.
2. Übersetzungen ergänzen:
   - `node werkzeuge/i18n/extract.js`
   - `node werkzeuge/i18n/fehlend.js`
   - Fehlende Texte nach `werkzeuge/i18n/ANLEITUNG-EN.md` übersetzen und mit `node werkzeuge/i18n/fehlend.js --einspielen <datei.json>` übernehmen.
3. `bash werkzeuge/paket.sh` prüft alles der Reihe nach und baut erst danach das ZIP:
   - Versionen
   - Modulversionen
   - Übersetzungen
   - Geheimnisse
   - Kerntests
   - erweiterte Tests
   - Design-Prüfstand
4. `node werkzeuge/pruef.js` trägt die Prüfsumme in `PRUEFSUMMEN.md` ein.
5. Committen und pushen. Commit-Text auf Deutsch, `Clubwerk X.Y.Z: …`.
6. `node werkzeuge/modver.js save clubwerk`, `werkzeuge/modulstand.json` mitcommitten und pushen. Optional `git tag vX.Y.Z && git push --tags`. Als veröffentlicht gilt eine Version durch ihren Eintrag in `PRUEFSUMMEN.md`.
7. Prüfen, dass GitHub Actions grün ist: `gh run list --limit 3`.
8. Thorsten das ZIP aus `werkzeuge/ausgabe/` geben. Dazu eine kurze Zusammenfassung der Änderungen in Alltagssprache.

## Tests

- `bash tests/run.sh` enthält die Kerntests. Sie laufen auch in GitHub Actions.
- `bash werkzeuge/tests/run.sh [namen…]` startet rund 50 erweiterte Testreihen. Die Liste steht in `werkzeuge/tests/namen.txt`. Bekannte Fehlschläge stehen in `werkzeuge/tests/erwartet.txt`, und nur **neue** Fehlschläge lassen den Lauf scheitern.
- Einen bekannten Fehlschlag behebt man im Code. Danach `CW_ERWARTET_SPEICHERN=1 bash werkzeuge/tests/run.sh` und die Änderung an `erwartet.txt` bewusst committen. Neue Fehlschläge nie einfach in `erwartet.txt` eintragen.
- Fehlersuche: `CW_TEST_BEHALTEN=1 bash werkzeuge/tests/run.sh <name>` behält die Ausgaben (`t_<name>.out`) und die Serverprotokolle.
- Eine Testreihe ohne ein einziges `✔` oder mit Stacktrace gilt als abgebrochen und damit als Fehler.
- Für neue Funktionen eine passende Testreihe ergänzen oder erweitern. Die Tests sind HTTP-Tests gegen einen eigenen Server mit den Ausgaben `✔`/`✘`. Zeitabhängige Tests rechnen relativ zur aktuellen Uhrzeit, nie mit festen Uhrzeiten wie „morgen 6 Uhr“.

## Design-Prüfstand

`werkzeuge/design-pruefstand/` (Details in der README dort) prüft rund 1 000 Ansichten:
- Verwaltung, auch im Tablet-Rahmen
- Tablet
- Mitglieder-App
- Beregnung

Jeweils in Handy-, Tablet- und Rechnergröße, hell und dunkel, mit Reitern, Fenstern, Menü und Scrollen. Geprüft werden:
- Überbreite, Überlappung und abgeschnittener Text
- Kontrast
- iPhone-Zoom (Felder unter 16 px)
- Tippflächen
- Erreichbarkeit des Seitenendes
- Scrollen hinter Fenstern oder dem Menü
- Regeln im Quelltext

Auf dem Mac mit `--webkit` laufen die Handy-Ansichten zusätzlich in der Safari-Technik.

- Zwischendurch reicht ein schneller Lauf: `python3 werkzeuge/design-pruefstand/gate.py --schnell` (Demo-Server muss laufen).
- Ausnahmen kommen nur mit Begründung in `erlaubt.txt`. Vorher den Befund im Bild ansehen. Viele Treffer sind echte Fehler.
- Regeln ersetzen nicht das Hinsehen. Geänderte Ansichten per Screenshot (Playwright) **selbst anschauen**, auch am Handy (390 × 664) und im dunklen Modus.
- Bekannte Eigenheiten von Headless-Screenshots: Datumsfelder zeigen das US-Format, und feste oder klebende Leisten liegen in Ganzseiten-Aufnahmen über dem Inhalt. Das sind keine Fehler.

## Übersetzungen

Texte werden über `public/i18n-core.js` zur Laufzeit übersetzt. Der deutsche Text ist der Schlüssel. `extract.js` sammelt alle Texte in `clubwerk/sprachen/katalog.json`. `en.json` muss jeden Schlüssel enthalten, sonst bricht `paket.sh` ab. Platzhalter wie `{0}` bleiben erhalten. Das Glossar steht in `werkzeuge/i18n/ANLEITUNG-EN.md`.

## Offene Themen

- **20 bekannte Fehlschläge in `werkzeuge/tests/erwartet.txt` klären** (mod, age, abtipp, inact, v114, zeit, ber, dbx): bei jedem entscheiden, ob die Erwartung veraltet ist (Test anpassen) oder ein echter Fehler vorliegt (Code korrigieren). Besonders `v114` (Mitglieder entfernen mit offenem Betrag/Historie) und `dbx` (Dropbox-Export) genau ansehen. Ziel: `erwartet.txt` leer.
- **Platzbelegung (Fußball, Teilflächen):** Der ausführliche Plan steht in `planung/platzbelegung.md`. Geplant ist ein eigenes Modul „Platzbelegung“ für Plätze, die zugeteilt statt selbst gebucht werden. Es umfasst Felder mit Teilflächen-Raster (ganz, ½, ¼), Mannschaften (aus dem Spielbetrieb, falls aktiv), Trainingspläne, Heimspiele und Sperren mit Push, Kabinen sowie Flutlicht über Home Assistant. Das Buchungssystem bleibt unverändert. Vor dem Bau beantwortet Thorsten die offenen Fragen: Name, Teilung, wer plant, Mannschaften, Kabinen in Stufe 1, Flutlicht, Pilotverein. Erst danach Stufe 1 bauen.
- Bekannte Kleinigkeit: Im Buchungssystem rutschen die Knöpfe der Reiterzeile bei schmalen Fenstern unter die Reiter.
