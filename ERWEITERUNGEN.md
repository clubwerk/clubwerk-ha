# Erweiterungen für Clubwerk bauen

Eine Erweiterung ist ein Ordner. Clubwerk lädt ihn beim Start, in der Verwaltung wird er unter
**Einstellungen → Erweiterungen** ein- und ausgeschaltet. Vorlage: `vorlage-erweiterung/beispiel`.

```
meine-erweiterung/
├── erweiterung.json      Pflicht – Name, Version, Rechte, Menüeinträge
├── server.js             optional – eigene Schnittstellen und Tabellen
└── public/               optional – Dateien unter /x/<id>/
    ├── index.html        Tablet-Seite (erscheint oben in der Kopfzeile)
    ├── tablet.js
    └── admin.js          Verwaltungsseite (erscheint im Menü der Verwaltung)
```

## erweiterung.json

```json
{
  "id": "beispiel",                      // klein, a–z, 0–9, Bindestrich; eindeutig
  "name": "Beispiel-Erweiterung",
  "version": "1.0.0",
  "beschreibung": "Was sie tut – erscheint in der Verwaltung.",
  "minApp": "1.13.0",                    // ältere Version → wird nicht geladen, Hinweis in der Verwaltung
  "perms": { "beispiel": "Beispiel bearbeiten" },   // eigene Rechte für „Benutzer & Rechte“
  "tablet": { "label": "Beispiel", "seite": "", "pfad": "beispiel" },   // Reiter am Tablet → /beispiel/  (weglassen = kein Reiter; „pfad“ optional, Standard = id)
  "verwaltung": { "label": "Beispiel", "recht": "beispiel" }
}
```

## server.js

```js
exports.activate = ctx => {
  ctx.db.exec('CREATE TABLE IF NOT EXISTS beispiel_daten (...)');      // eigene Tabellen mit Präfix
  ctx.tablet.get('/liste', (req, res) => res.json([...]));             // GET /api/tablet/x/beispiel/liste
  ctx.admin.post('/eintrag', ctx.need('beispiel'), (req, res) => {});  // POST /api/admin/x/beispiel/eintrag
};
```

`ctx` enthält: `tablet` und `admin` (Express-Router, schon abgesichert: Admin-Routen nur mit Anmeldung,
Tablet-Routen mit dem Passwortschutz der Buchungsseite), `db` (SQLite, better-sqlite3), `getSetting`, `setSetting`,
`audit(user, aktion, details)`, `need(recht)`, `rateLimit(name, max, ms)` (Bremse je Absenderadresse),
`rateLimitKey(name, max, ms, req => schlüssel)` (Bremse je frei gewähltem Schlüssel, z. B. `req.member.id`), `bad(res, text)`, `int`, `cleanName`, `nowTs`,
`util` (gemeinsame Helfer: `today()`, `nowTs()`, `isDate(s)`, `addDays(s, n)`, `deD(s)` → „TT.MM.JJJJ“, `euro(cents)`, `esc(html)`, `pad(n)`),
`isActive()`, `hooks.tabletVisible = () => bool` (Link am Tablet nur zeigen, wenn sinnvoll), `hooks.appVisible = memberId => bool` (Bereich in der Mitglieder-App nur für bestimmte Mitglieder zeigen, z. B. nur für Spieler einer Mannschaft). Bereiche mit `"unterwegs": false` oder `"vertraulich": true` unter `mitgliederApp` in der erweiterung.json gelten als vertraulich: Auf einem Handy, das von unterwegs ohne SMS-Code freigeschaltet wurde, gehen sie erst nach dem ersten Öffnen im Vereins-WLAN (oder nach Freigabe durch den Vorstand). `memberAddress(id)` der Mitgliederverwaltung liefert auch `mobile` und `phone`. Außerdem
`require(name)` für die Bibliotheken von Clubwerk (`exceljs`, `pdfkit`, `nodemailer`, `express`).

**Hooks für den Lebenszyklus (optional):** `ctx.hooks.shutdown = async () => {}` (Clubwerk wird beendet – Update, Neustart),
`ctx.hooks.deactivate = () => {}` (das Modul wird in der Verwaltung ausgeschaltet – laufende Vorgänge beenden, z. B. offene Ventile schließen)
und `ctx.hooks.memberRemoved = (fromId, intoId) => {}`: Ein Mitgliedskonto wird zusammengeführt (`intoId` = Zielkonto) oder endgültig
gelöscht (`intoId = null`). Der Hook läuft **synchron** in der Transaktion des Kerns, *bevor* der Kern alle Spalten mit
`REFERENCES members(id)` – auch in Modultabellen – generisch umhängt bzw. löscht (bei UNIQUE-Konflikt fällt die Zeile des alten Kontos weg).
Im Hook erledigt das Modul nur, was der Kern nicht sieht: Verweise ohne Fremdschlüssel (z. B. Verlauf, IDs in JSON-Listen), Dateien,
eigene Protokolleinträge. Wirft der Hook, bricht der Kern ab und zeigt den Fehlertext an.
Vor dem endgültigen Löschen fragt der Kern `ctx.hooks.memberLinks = id => ['Spielt in: Herren 30', …]` (synchron): Jedes Modul nennt in
Alltagssprache, was in **seinen** Daten noch am Mitglied hängt (laufende Zuordnungen, Kommendes, Offenes – nicht Vergangenes). Steht
irgendwo etwas, löscht der Kern nicht und zeigt die Liste (mit dem Modulnamen dahinter). Leere Liste = nichts im Weg.
Tabellen, deren Zeilen dabei als Verlauf bleiben sollen (z. B. bezahlte Forderungen), nennt `ctx.hooks.historyTables = () => ['mv_charge']`;
der Kern löscht sie nicht und markiert das Konto dann nur als gelöscht, damit der Name lesbar bleibt.

**Kontoarten:** `members.kind` ist `mitglied`, `nichtmitglied` („Kein Mitglied“, z. B. Trainer: Verkaufskonto mit PIN, ohne Mitgliedschaft), `mannschaft`, `verein`, `gast` oder `extern` (Gastspieler im Spielbetrieb, kein Konto). Module, die **Mitglieder** meinen (Platzbuchung, Helferdienste, App …), filtern auf `kind = 'mitglied'` – „Kein Mitglied“ bleibt dort draußen. Namen von Personen (`mitglied`, `nichtmitglied`) zeigt `lastFirst(name, kind)` als „Nachname, Vorname“. Ist die Mitgliederverwaltung aktiv, entsteht ein `mitglied` nur dort; der Kern fragt vor dem Wechsel der Kontoart `ctx.hooks.memberKindLock = id => ['Grund', …]` (synchron, leer = darf wechseln) zusätzlich zu `memberLinks`.

**Datums-/Zeitformate:** Fachliche Tage und Zeitpunkte stehen in der Datenbank in lokaler Zeit ohne Zonenangabe –
`JJJJ-MM-TT` bzw. `JJJJ-MM-TT HH:MM:SS` (wie SQLites `datetime('now','localtime')`; genau das liefern `ctx.util.today()` und
`ctx.util.nowTs()`). Vergleiche funktionieren dann als Textvergleich. Millisekunden seit 1970 (`Date.now()`) nur für Zeitgeber
und Sperren (z. B. Ablauf eines Ventils, Gerätesperre), ISO mit `Z` nur, wo der Kern es vorgibt (`locked_until` der Konten).
Formate in einer Spalte nie mischen; für die Anzeige `ctx.util.deD()` verwenden.

**E-Mail:** `ctx.mail.send({ to, cc, subject, text, attachments })` verschickt über das zentrale Postfach (Einstellungen → Postfach), `ctx.mail.ready()` sagt, ob eins eingerichtet ist. Eigene Postfach-Einstellungen braucht eine Erweiterung nicht – nur den Empfänger. Seit 3.20 bekommt jede Mail automatisch ein gestaltetes HTML-Layout (Vereinslogo, Vereinsfarbe, Fuß); die Textfassung bleibt erhalten. Für eine Infokarte zusätzlich `card: { heading, before, title, rows: [['Platz', 'Platz 1'], ['Wann', 'Di, 20.10. 17:00']], after, button: { label, url }, calendar: { label, url } }` mitgeben (`calendar` setzt den Knopf „Zu deinem Kalender hinzufügen“ direkt in die Karte, z. B. auf eine .ics-Adresse – Termine nie als Anhang). `ctx.appUrl()` liefert die https-Adresse der Mitglieder-App (extern, sonst im Vereins-WLAN) für solche Links, leer ohne Adresse. Eigenes HTML (`html`) bleibt unverändert.

**Push-Benachrichtigungen (ab Clubwerk 3.19):** Die Erweiterung meldet ihre Anlässe an:
`ctx.hooks.pushEvents = () => [{ id: 'erinnerung', label: 'Erinnerung', desc: 'Wann die Nachricht kommt', default: true, lead: { default: 120, label: 'Vorlauf' } }]`
(`id` nur Kleinbuchstaben/Ziffern/Unterstrich; `lead` nur für Anlässe mit Vorlauf in Minuten). Der Vorstand gibt Anlässe unter
Mitglieder-App → Benachrichtigungen frei (`default` ist die Vorgabe), das Mitglied schaltet Benachrichtigungen je Handy nur an oder aus (keine eigene Auswahl der Anlässe). Senden:
`ctx.push.send(memberIds, 'erinnerung', { title, body, url: './#meinmodul', tag })` – der Kern prüft Freigabe und Abos, verschlüsselt,
protokolliert und räumt erloschene Abos weg; nicht freigegebene Anlässe werden still übersprungen. `ctx.push.enabled('erinnerung')`
und `ctx.push.lead('erinnerung')` (Vorlauf in Minuten) für eigene Zeitgeber. Nur Titel und ein Satz senden – nichts, was in der
App PIN-pflichtig ist (Bankdaten, Adressen).

**Deinstallieren:** In `erweiterung.json` mit `"tabellen": ["meine_tabelle", …]` die eigenen Tabellen angeben (sonst gelten alle Tabellen mit dem Präfix `<id>_`) und bei Bedarf `"einstellungen": ["praefix_"]` für Einstellungen außerhalb von `ext_<id>_…`. Diese Daten landen in der Modul-Sicherung und werden beim Deinstallieren gelöscht.

**Mitgliederverwaltung – Zahler vs. Familienmitgliedschaft:** Die Mitgliederverwaltung kennt zwei getrennte Zuordnungen je Person:
`payer_id` (Zahler – reine Geldbeziehung; Beiträge, Verkauf und Lastschrift laufen beim Zahler zusammen) und `family_of`
(Familienmitgliedschaft – zeigt auf das Oberhaupt, dessen Familienbeitrag die Person abdeckt; Oberhaupt + ein Partner + Kinder).
Für andere Module gibt es `ctx.hooks.familyOf(id) → { head, members, kind }`: die Familienmitgliedschaft (`kind: 'familie'`),
ohne eine solche die Zahlergruppe (`'zahler'`) bzw. die Person allein (`'einzeln'`), wenn ihre Zahlergruppe schon eine Familie enthält –
die Helferdienste bilden daraus den Familienpool. `ctx.hooks.memberInfo(id)` liefert `payer`, `family_of` und `fee` (mit `viaFamily`/`viaPayer`,
wenn der Beitrag vom Oberhaupt bzw. Zahler stammt). Der Verkauf „beim Zahler“ nutzt bewusst nur den Zahler.

**Daten der Mitgliederverwaltung nur über Hooks** – nie deren Tabellen (`mv_*`) oder Einstellungen (`ext_mitglieder_*`) direkt lesen. Hooks antworten nur, solange die Mitgliederverwaltung eingeschaltet ist. Für Abfragen mitten in einer Berechnung gibt es `ctx.callHooksSync(name, …)` (wie `callHooks`, aber ohne `await`, nur für Hooks, die sofort antworten). Die Mitgliederverwaltung bietet: `departments()` (alle Abteilungen mit `active`), `functionsOf(id)` und `functionNames()` (Ämter), `fees()` (aktive Beiträge ohne Zusatzbeiträge), `memberNumbers()` (`{ id: Mitgliedsnummer }`), `clubInfo()` (`{ street, city, yearStart }`), `memberAddress(id)` und `memberInfo(id)`.

**Spielplan (Buchung ↔ Spielbetrieb):** Den Parser für den Verbands-Spielplan gibt es im Kern (`src/spielplan.js`). Übernimmt das Buchungssystem einen Spielplan, ruft es `ctx.hooks.spielplanGames(rows, { all, user })` auf (der Spielbetrieb legt daraus Spieltage an, mit `all` auch Auswärtsspiele). Umgekehrt bucht `ctx.hooks.bookImportedGames(rows, { user })` des Buchungssystems Plätze für Heimspiele von Mannschaften, für die Plätze hinterlegt sind.

**Funktionsexport/-import (optional):** Mit `ctx.hooks.exportConfig = () => ({...})` und
`ctx.hooks.importConfig = (data, { user }) => 'Zusammenfassung'` bekommt die Erweiterung in der Verwaltung die Knöpfe
„Export“/„Import“ (Einstellungen → Module & Erweiterungen) und kann auf ihrer Seite `GK.funcBox(element, id, name)` zeigen.
Der Export darf **keine PINs, Passwörter oder Schlüssel** enthalten; `importConfig` prüft die Daten selbst und wirft bei
Fehlern einen `Error` (Text wird angezeigt), ohne etwas zu ändern. Dateiformat:
`{ "format": "clubwerk-funktion", "module": "<id>", "name", "version", "exported", "club", "data": {...} }`.

Alle Routen einer ausgeschalteten Erweiterung antworten mit 404 – Hintergrundaufgaben prüfen `ctx.isActive()`.
Daten liegen in der Datenbank von Clubwerk und sind in jeder Datensicherung enthalten.

## Tablet-Seite (public/index.html)

Pfade relativ angeben (`../../style.css`, `../../api/...`), damit die Seite auch über Home Assistant (Ingress) funktioniert.
Die gemeinsame Kopfzeile bindet ihr so ein (Gestaltung der Seite: siehe „Styleguide“ unten, `<body class="tk">`):

```html
<header id="gkHeader"></header>
<script src="../../nav.js" data-base="../../" data-active="beispiel"></script>
```

Mit `nav.js` kehrt die Seite nach 30 Sekunden ohne Eingabe automatisch zum Start-Reiter zurück.

Am Tablet erscheint die Seite unter `/<pfad>/` (z. B. `/beispiel/`). Clubwerk setzt dabei `<base href="../x/<id>/">` – relative Adressen in der Seite (`tablet.js`, `../../style.css`, `../../api/tablet/…`) funktionieren deshalb unverändert wie unter `/x/<id>/`. Ist der Pfad belegt (Dateien der Hauptseite, `api`, `x` …) oder schon vergeben, bleibt die Seite unter `/x/<id>/`. Ist die Erweiterung Start-Reiter, erscheint sie direkt unter `/`.

## Styleguide – so sehen alle Seiten gleich aus

Alle Module folgen denselben Regeln. Vorbild ist die Verkaufsseite. Eigene Farben, Schriftgrößen oder Abstände nur, wenn es den Baustein nicht gibt – und dann nur über die Farbvariablen (`--brand`, `--brand-soft`, `--brand-ink`, `--muted`, `--line`, `--card`, `--hover`, `--red`, `--amber` …), nie mit festen Farbwerten. So passen helles und dunkles Design und die Vereinsfarbe von selbst.

**Tablet (public/index.html)** – `<body class="tk">`, dann nur Bausteine des Tablet-Kits aus `style.css`:

| Baustein | Wofür | Regeln |
|---|---|---|
| `<main>` | Seite | volle Breite, 24 px Rand (Handy 16/12 px) – keine eigene `max-width` |
| `.tab-head` > `.tab-title` + `.tab-sub` | Seitenkopf | Titel = **Name des Reiters in der Kopfzeile** („Verkauf“, „Plätze“), **immer** ein Untertitel, der sagt, was man hier tut; rechts optional Suche/Auswahl |
| `h2.sec` | Abschnitt | 12 px, Großbuchstaben, gedämpft; optional `<small>` mit Zusatz |
| `.tk-grid` | Raster | 4 Spalten (ab 1600 px 5, schmal 2, Handy 1), Abstand 16 px; `.span2` für doppelte Breite |
| `.tk-tile` | Kachel | 80 px hoch: `.av` (Initialen) oder `.tk-ico` (Symbol) · `.tk-txt` mit `<b>` Titel und `<span>` Zeile · optional `.tk-chip` rechts; `.on` = aktiv/da, `.warn` = Achtung |
| `.tk-tile.big` | Aktionskachel | Symbol oben, Titel 20 px, kurzer Text – für Einstiege wie „Mitglied werden“ |
| `.tk-chip` `.g` `.a` `.r` | Statusmarke | ein, zwei Wörter („da“, „nicht da“, „vergessen“) |
| `.tk-empty` | Leerzustand | gestrichelter Kasten, ein Satz, der sagt, was als Nächstes geht |
| `.tk-big` | Hauptknopf | 64 px, Vereinsfarbe – höchstens einer je Bereich |
| `.tk-cols` | (nicht mehr verwenden) | Bereiche stehen untereinander, jeder mit `h2.sec` und eigenem `.tk-grid` |
| `.overlay` > `.dialog`, `.pad`, `.pin-dots`, `.err`, `.done .big` | Fenster, PIN-Eingabe, Erfolgsmeldung | Ziffernblock 3 × 4, 68 px hohe Tasten |
| `.gate` > `.gatecard` | Sperrseite (Tablet-Passwort) | unverändert übernehmen |

**Feste Regeln für jede Tablet-Seite (ab 3.29.3):**
1. Seitenkopf wie oben, darunter nur Abschnitte: **jede** Liste beginnt mit `h2.sec` („Was möchtest du tun?“, „Personal“, „Gerade im Einsatz“, „Türen“ …).
2. Einstiege/Aktionen („Einsatz beginnen“, „Ich möchte Mitglied werden“) sind `.tk-tile.big.span2` mit Symbol oben – unter „Was möchtest du tun?“. Keine großen Einzelknöpfe.
3. Personen, Termine und Konten sind `.tk-tile` (Initialen bzw. Symbol links, Marke rechts) im 4-Spalten-Raster `.tk-grid`.
4. Geräte (Türen, Beregnungsplätze) sind große Kacheln mit Symbol oben und den Bedienknöpfen unten – vier je Zeile.
5. Leere Abschnitte: `.tk-empty` über die ganze Breite. Namen werden nie aufgelistet, sondern nach 2 Buchstaben gesucht; danach Ziffernblock für die PIN.
6. Belegungen (Plätze) im gemeinsamen Belegungsplan – derselbe wie in Verwaltung und Mitglieder-App.
7. Seiten aus der Mitglieder-App (Kit `.vh-…`) bekommen am Tablet über `body.embedded` automatisch dieses Aussehen.

**Gleiche Sache = gleiches Aussehen in allen Oberflächen (ab 3.30.0):**
- **Geräte bedienen** (Türen, Beregnung): überall dieselbe Gerätekachel – Raster `.vh-tiles` (mit `.doors` bzw. `.zones` für das Symbol) und das gemeinsame Skript des Moduls (`doors.js`, `plaetze.js`). Das gilt für Mitglieder-App, Tablet, eigene Webapp **und** Verwaltung (die Verwaltung lädt `kit.css` mit). Handy 2, ab 700 px 3, ab 1000 px 4 Kacheln je Zeile.
- **Belegungen**: überall der gemeinsame Belegungsplan (Plätze nebeneinander, Zeitachse, Blöcke in der Farbe der Buchungsart).
- **Termine**: überall ein Datumsblock – Datum groß, Wochentag klein darunter (`.vh-date` in der App, `.tk-date` am Tablet, gleicher Aufbau in der Verwaltung).
- Wer eine Funktion in einer Oberfläche ändert, prüft die anderen Oberflächen mit.

**Mitglieder-App (public/member.js)** – nur Bausteine aus `kit.css` (`.vh-…`); ein Modul braucht dafür kein eigenes CSS. Der Bereich rendert direkt in `el`, der Abstand zwischen den Blöcken (12 px) kommt von der App. Vorbild: `vorlage-erweiterung/beispiel/public/member.js`.

| Baustein | Wofür | Regeln |
|---|---|---|
| `.vh-card` > `h3` | Karte mit Kopf | Kopf 16 px fett; rechts höchstens eine Textaktion (`<button>` im `h3`, z. B. „Ändern“); Zusatz als `<small>`. `.vh-card.flush` für Listen bis an den Rand |
| `.vh-cap` | Gruppenüberschrift außerhalb von Karten | 12 px, Großbuchstaben, gedämpft – sparsam |
| `.vh-rows` | Liste in einer Karte | eine Zeile je Eintrag, Trennlinie; links Text (`.vh-tx` mit `<strong>` + `<small>`), rechts Wert, Marke oder Knopf |
| `.vh-date` | Datumsblock | `<b>31.05.</b><span>Mo</span>` – jeder Termin beginnt damit; `<i class="g|r|a">` als Status-Punkt |
| `.vh-kv` | Angaben (Schlüssel/Wert) | `<dl>` mit `dt`/`dd`, Wert rechtsbündig |
| `.vh-chip` `.g` `.a` `.r` | Statusmarke | ein, zwei Wörter („bezahlt“, „8 frei“, „offen“) |
| `.vh-seg` | Umschalter | Ansicht, Mannschaft, Tag – oben im Bereich |
| `.vh-bar` (`.a`) | Hinweisleiste oben | ein Satz, rechts kleine Knöpfe; `.a` = bitte erledigen |
| `.vh-btn.sm` (`.sec`) | Knopf in Zeilen/Karten | 40 px; Hauptknopf gefüllt, sonst `.sec`; `.vh-btn.wide` volle Breite |
| `.vh-yn` | Ja/Nein antworten | `button.y` / `button.n`, gewählt mit `.on` |
| `.vh-big`, `.vh-prog` | große Zahl, Fortschritt | z. B. Stunden, Kontingent |
| `.vh-none`, `.vh-lead` | leerer Inhalt, Erklärsatz in der Karte | ein Satz; ganz leerer Bereich: `.vh-empty` |
| `.vh-danger` | gefährliche Aktion | immer ganz unten (Kündigen …) |
| `.vh-sheet.vh-form` > `.vh-box` | Fenster mit Formular | `label` + `.vh-input`/`.vh-select`, Häkchen als `label.vh-check`, unten `.vh-row` mit `.no` / `.ok`; nie ein neues Browserfenster |
| `.vh-tile` | große Aktionskachel | Beregnung, Türen – eine Kachel je Gerät |

**Verwaltung (public/admin.js)** – über `GK`, nach diesen festen Regeln (ab 3.29.1 überall gleich):

| Baustein | Regel |
|---|---|
| Seitenkopf | `h2.page` = **Name der Seite wie im Menü** (bei Modulen mit mehreren Seiten der Modulname – Clubwerk setzt ihn selbst), darunter `p.lead` mit einem Satz zum aktuellen Bereich |
| Navigation, Ebene 1 | **Reiter oben** (`GK.tabs` oder Seiten mit `group` in `registerPage`) – kein Seitenmenü |
| Navigation, Ebene 2 | Segment-Umschalter `.seg` (innerhalb eines Reiters; `GK.sectionize` macht das von selbst) |
| Aktionsleiste | `.toolbar` direkt unter den Reitern: Suche und Filter links, **Aktionen rechts, Hauptaktion („+ Neu …“) ganz rechts**; eine reine Knopfleiste wird automatisch rechts ausgerichtet |
| Karten | `.card` mit `<h3>`; Formulare `label.f`; Tabellen `.tbl`; Marken `.pill` (`g`/`a`/`r`) |
| Speichern | der Absende-Knopf eines Formulars ist immer `.btn.primary` (unten rechts, bei einzeiligen Formularen am Zeilenende) |
| Knöpfe | `.btn` (`primary`, `small`, `ghost`, `danger`); Aktionen in Tabellenzeilen als Symbolknopf `.btn.ico` (mit `title`, zusammen in `.acts`) |
| Leerzustand | ein Satz in der Karte, der sagt, was als Nächstes geht |
| Reihenfolge/Start festlegen | Liste `.torows` mit ↑ ↓ und Radio „Start“ – wie „Leiste am Tablet“ und „Reiter in der App“ |

Überschriften fluchten mit den Feldern und Knöpfen darunter; nichts überlappt.

**Texte:** kurz, freundlich, in der Sprache der Mitglieder („Namen antippen“, nicht „Datensatz auswählen“). Uhrzeiten „19:00 Uhr“, Daten „Di, 20.10.“. Namen „Nachname, Vorname“ in Listen.

## Verwaltungsseite (public/admin.js)

```js
(() => {
  const GK = window.GK;   // api, dialog, closeDialog, toast, fail, esc, euro, deDate, deTime, can, $, RENDER …
  GK.registerPage({ key: 'beispiel', title: 'Beispiel', perm: 'beispiel', render: async () => {
    const daten = await GK.api('x/beispiel/liste');
    GK.$('main').innerHTML = `<h2 class="page">Beispiel</h2> …`;
  } });
})();
```

## Installieren

**Über die Verwaltung (empfohlen):** Den Ordner der Erweiterung als ZIP packen (mit `erweiterung.json` oben oder in
einem Unterordner) → Verwaltung → Einstellungen → Module & Erweiterungen → „Erweiterung einspielen (ZIP)“ → „Jetzt neu
starten“ → aktivieren. Nur Benutzer mit allen Rechten dürfen das. Eine neuere Version ersetzt die alte; „Entfernen“ löscht
die Dateien, die Daten bleiben. Mitgelieferte Module können nicht überschrieben werden. Hochgeladene Erweiterungen liegen
im Datenordner des Add-ons und überstehen Updates.

**Per Samba:** Ordner nach `share/clubwerk/erweiterungen/` kopieren, Add-on neu starten, in der Verwaltung aktivieren.
Erweiterungen laufen mit denselben Rechten wie Clubwerk – nur aus vertrauenswürdiger Quelle installieren.

**Freigabe (ab 2.12):** Eine Erweiterung, die nicht mitgeliefert wird, läuft erst nach der Freigabe durch das Adminkonto
(„Prüfen & freigeben“, mit Passwort). Freigegeben wird genau der angezeigte Stand (Prüfsumme); Erweiterungen aus dem
Netzwerkordner werden dabei in einen geschützten Bereich unter /data kopiert und laufen von dort. Änderungen im Ordner
erscheinen als neue Version und laufen erst nach erneuter Freigabe. Home-Assistant-Geräte, die ein anderes Modul schon
nutzt, meldet `ctx.entityOwner(entity)`; eigene Geräte gibt eine Erweiterung über `ctx.hooks.usedEntities = () => [...]` an. Hochgeladene Erweiterungen sind nach dem Hochladen freigegeben, starten aber ausgeschaltet.
Die Rechtenamen `benutzer`, `einstellungen` und `deinstallieren` sind reserviert und werden ignoriert.

## Übersetzungen (ab Clubwerk 3.0)

Texte werden auf Deutsch geschrieben – Clubwerk übersetzt die Oberfläche automatisch anhand von Sprachdateien. Für eine Erweiterung heißt das:

- **Nichts tun** reicht für den Anfang: Fehlermeldungen (`{ error }`), E-Mails, Excel- und PDF-Dateien und alle Seiten mit `theme-init.js` laufen durch die Übersetzung; Texte ohne Übersetzung bleiben deutsch.
- **Eigene Übersetzungen** liegen im Ordner `sprachen/` der Erweiterung: `katalog.json` (`{ "strings": ["Deutscher Text", "{0} Einträge", …] }`) und je Sprache `<code>.json` (`{ "_meta": { "name": "English", "locale": "en-GB" }, "strings": { "Deutscher Text": "German text", "{0} Einträge": "{0} entries" } }`). Platzhalter `{0}`, `{1}` stehen für eingesetzte Werte.
- Im Browser übersetzt `T('Text {0}', [wert])`, im Server `ctx.T('Text {0}', [wert])` (Sprache der Anfrage bzw. Vereinssprache), `ctx.lang()` liefert den Sprachcode.
- Bereiche mit Vereinsdaten (Namen, eigene Texte) mit `translate="no"` markieren.
- Die Texte der Erweiterung erscheinen in den Vorlagen unter Einstellungen → Sprachen, sodass Vereine sie mit übersetzen können.

### Bausteine, die überall gleich aussehen (ab 3.30.2)

- **Knöpfe einer Seite** („+ Neu …“, Export) gehören rechts in die Reiterzeile: eine `<div class="toolbar">` nur mit Knöpfen ganz oben im Seiteninhalt wandert automatisch dorthin. Gezielt: `GK.tabTools(html, owner)` – die Knöpfe verschwinden, sobald `owner` nicht mehr angezeigt wird.
- **Leerzustand:** `<p class="empty">Noch keine …</p>` – nie eine nackte graue Zeile.
- **Namensauswahl am Tablet („Wer bist du?“):** Container `.vh-names`, Hinweis `.vh-names-hint`, Treffer als `<button><span>Nachname, Vorname</span></button>` (kit.css).
- **Eigener Reiter auf der Seite „Mitglieder-App“:** `GK.registerAppSection({ key, label, perm, render(el) })`.
- **Protokoll:** nie interne Schlüssel. Für Einstellungen `ctx.audit(user, 'Modul: Einstellungen geändert', ctx.auditDiff(LABELS, vorher, nachher))` mit `LABELS = { schluessel: 'Bezeichnung' | ['Bezeichnung', 'bool'|'euro'|'list'|'text'] }`.
- **Hinweise auf der Übersicht** (`hooks.overview` → `alerts`) können mit `sec: ['tab_<seite>', '<reiter>']` und `link: 'Protokoll öffnen'` direkt in den Reiter führen, in dem sie erledigt werden.
- **Beschriftungen** beginnen groß, gesperrte Knöpfe nur über `disabled` (der Kern färbt sie lesbar grau).
