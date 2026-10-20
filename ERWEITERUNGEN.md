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
`isActive()`, `hooks.tabletVisible = () => bool` (Link am Tablet nur zeigen, wenn sinnvoll), `hooks.appVisible = memberId => bool` (Bereich in der Mitglieder-App nur für bestimmte Mitglieder zeigen, z. B. nur für Spieler einer Mannschaft) und
`require(name)` für die Bibliotheken von Clubwerk (`exceljs`, `pdfkit`, `nodemailer`, `express`).

**Hooks für den Lebenszyklus (optional):** `ctx.hooks.shutdown = async () => {}` (Clubwerk wird beendet – Update, Neustart),
`ctx.hooks.deactivate = () => {}` (das Modul wird in der Verwaltung ausgeschaltet – laufende Vorgänge beenden, z. B. offene Ventile schließen)
und `ctx.hooks.memberRemoved = (fromId, intoId) => {}`: Ein Mitgliedskonto wird zusammengeführt (`intoId` = Zielkonto) oder endgültig
gelöscht (`intoId = null`). Der Hook läuft **synchron** in der Transaktion des Kerns, *bevor* der Kern alle Spalten mit
`REFERENCES members(id)` – auch in Modultabellen – generisch umhängt bzw. löscht (bei UNIQUE-Konflikt fällt die Zeile des alten Kontos weg).
Im Hook erledigt das Modul nur, was der Kern nicht sieht: Verweise ohne Fremdschlüssel (z. B. Verlauf, IDs in JSON-Listen), Dateien,
eigene Protokolleinträge. Wirft der Hook, bricht der Kern ab und zeigt den Fehlertext an.

**Datums-/Zeitformate:** Fachliche Tage und Zeitpunkte stehen in der Datenbank in lokaler Zeit ohne Zonenangabe –
`JJJJ-MM-TT` bzw. `JJJJ-MM-TT HH:MM:SS` (wie SQLites `datetime('now','localtime')`; genau das liefern `ctx.util.today()` und
`ctx.util.nowTs()`). Vergleiche funktionieren dann als Textvergleich. Millisekunden seit 1970 (`Date.now()`) nur für Zeitgeber
und Sperren (z. B. Ablauf eines Ventils, Gerätesperre), ISO mit `Z` nur, wo der Kern es vorgibt (`locked_until` der Konten).
Formate in einer Spalte nie mischen; für die Anzeige `ctx.util.deD()` verwenden.

**E-Mail:** `ctx.mail.send({ to, cc, subject, text, attachments })` verschickt über das zentrale Postfach (Einstellungen → Postfach), `ctx.mail.ready()` sagt, ob eins eingerichtet ist. Eigene Postfach-Einstellungen braucht eine Erweiterung nicht – nur den Empfänger. Seit 3.20 bekommt jede Mail automatisch ein gestaltetes HTML-Layout (Vereinslogo, Vereinsfarbe, Fuß); die Textfassung bleibt erhalten. Für eine Infokarte zusätzlich `card: { heading, before, title, rows: [['Platz', 'Platz 1'], ['Wann', 'Di, 20.10. 17:00']], after, button: { label, url }, calendar: { label, url } }` mitgeben (`calendar` setzt einen Knopf wie „Zum Kalender hinzufügen“ direkt in die Karte, z. B. auf eine .ics-Adresse). Eigenes HTML (`html`) bleibt unverändert.

**Push-Benachrichtigungen (ab Clubwerk 3.19):** Die Erweiterung meldet ihre Anlässe an:
`ctx.hooks.pushEvents = () => [{ id: 'erinnerung', label: 'Erinnerung', desc: 'Wann die Nachricht kommt', default: true, lead: { default: 120, label: 'Vorlauf' } }]`
(`id` nur Kleinbuchstaben/Ziffern/Unterstrich; `lead` nur für Anlässe mit Vorlauf in Minuten). Der Vorstand gibt Anlässe unter
Mitglieder-App → Benachrichtigungen frei (`default` ist die Vorgabe), jedes Mitglied wählt je Handy daraus. Senden:
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
