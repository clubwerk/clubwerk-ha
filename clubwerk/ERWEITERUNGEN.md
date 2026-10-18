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
`audit(user, aktion, details)`, `need(recht)`, `rateLimit(name, max, ms)`, `bad(res, text)`, `int`, `cleanName`, `nowTs`,
`isActive()`, `hooks.tabletVisible = () => bool` (Link am Tablet nur zeigen, wenn sinnvoll) und
`require(name)` für die Bibliotheken von Clubwerk (`exceljs`, `pdfkit`, `nodemailer`, `express`).

**E-Mail:** `ctx.mail.send({ to, cc, subject, text, attachments })` verschickt über das zentrale Postfach (Einstellungen → E-Mail-Versand), `ctx.mail.ready()` sagt, ob eins eingerichtet ist. Eigene Postfach-Einstellungen braucht eine Erweiterung nicht – nur den Empfänger.

**Deinstallieren:** In `erweiterung.json` mit `"tabellen": ["meine_tabelle", …]` die eigenen Tabellen angeben (sonst gelten alle Tabellen mit dem Präfix `<id>_`) und bei Bedarf `"einstellungen": ["praefix_"]` für Einstellungen außerhalb von `ext_<id>_…`. Diese Daten landen in der Modul-Sicherung und werden beim Deinstallieren gelöscht.

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
Die gemeinsame Kopfzeile bindet ihr so ein:

```html
<header class="top"><h1>Titel</h1><nav id="topnav"><span class="clock" id="clock"></span></nav></header>
<script src="../../nav.js" data-base="../../" data-active="beispiel"></script>
```

Mit `nav.js` kehrt die Seite nach 30 Sekunden ohne Eingabe automatisch zum Start-Reiter zurück.

Am Tablet erscheint die Seite unter `/<pfad>/` (z. B. `/beispiel/`). Clubwerk setzt dabei `<base href="../x/<id>/">` – relative Adressen in der Seite (`tablet.js`, `../../style.css`, `../../api/tablet/…`) funktionieren deshalb unverändert wie unter `/x/<id>/`. Ist der Pfad belegt (Dateien der Hauptseite, `api`, `x` …) oder schon vergeben, bleibt die Seite unter `/x/<id>/`. Ist die Erweiterung Start-Reiter, erscheint sie direkt unter `/`.

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
