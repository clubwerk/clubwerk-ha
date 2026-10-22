// Einheitstests ohne Server: Namenssortierung (Browser = Server), Protokoll-Änderungslisten, Rechnungsleser.  node einheit_test.js <S>
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const S = process.argv[2]; const APP = process.env.CW_APP;
process.env.DATA_DIR = S + '/r_einheit'; fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };

const dbm = require(path.join(APP, 'src/db'));
// names.js läuft im Browser – hier in einer Sandbox mit eigenem window
const win = {}; vm.runInNewContext(fs.readFileSync(path.join(APP, 'public/names.js'), 'utf8'), { window: win });
const W = win.CWNames;

/* ---------- Namen: Browser und Server sortieren und schreiben gleich ---------- */
const NAMES = ['Max Muster', 'Anna von der Heide', 'Jonas Ähren', 'Lea Abel', 'Ute de Vries', 'Peter Zander', 'Eva Muster', 'Ölmühle Team'];
const KINDS = ['mitglied', 'mitglied', 'mitglied', 'mitglied', 'mitglied', 'mitglied', 'mitglied', 'mannschaft'];
const srv = NAMES.map((n, i) => [n, KINDS[i]]).sort((a, b) => (dbm.nameKey(a[0], a[1]) < dbm.nameKey(b[0], b[1]) ? -1 : 1)).map(x => x[0]);
const cli = NAMES.map((n, i) => [n, KINDS[i]]).sort((a, b) => (W.nameKey(a[0], a[1]) < W.nameKey(b[0], b[1]) ? -1 : 1)).map(x => x[0]);
ok('Sortierung Browser = Server', JSON.stringify(srv) === JSON.stringify(cli), JSON.stringify({ srv, cli }));
ok('Nachname zuerst, „von der“ zählt nicht', srv.indexOf('Lea Abel') < srv.indexOf('Jonas Ähren') && srv.indexOf('Jonas Ähren') < srv.indexOf('Anna von der Heide') && srv.indexOf('Anna von der Heide') < srv.indexOf('Eva Muster') && srv.indexOf('Eva Muster') < srv.indexOf('Max Muster'), JSON.stringify(srv));
ok('SQL-Sortierung name_key = nameKey', JSON.stringify(dbm.db.prepare(`SELECT n FROM (${NAMES.map(() => 'SELECT ? n, ? k').join(' UNION ALL ')}) ORDER BY name_key(n, k)`).all(...NAMES.flatMap((n, i) => [n, KINDS[i]])).map(r => r.n)) === JSON.stringify(srv));
ok('„Nachname, Vorname“ gleich', NAMES.every((n, i) => dbm.lastFirst(n, KINDS[i]) === W.lastFirst(n, KINDS[i])), NAMES.map((n, i) => dbm.lastFirst(n, KINDS[i]) + ' | ' + W.lastFirst(n, KINDS[i])).join(' ; '));
ok('Beispiel „von der Heide, Anna“', dbm.lastFirst('Anna von der Heide', 'mitglied') === 'von der Heide, Anna', dbm.lastFirst('Anna von der Heide', 'mitglied'));
ok('Mannschaften bleiben wie geschrieben', dbm.lastFirst('Ölmühle Team', 'mannschaft') === 'Ölmühle Team');

/* ---------- Protokoll: lesbare Änderungen, nie interne Schlüssel ---------- */
const L = { lead_days: 'Vorlauf (Tage)', guest_fee_cents: 'Gastgebühr', open: ['Geöffnet', 'bool'], intro: ['Begrüßung', 'text'], secret_key: undefined };
let d = dbm.auditDiff(L, { lead_days: 7, guest_fee_cents: 500, open: false, intro: 'Hallo', secret_key: 'a' }, { lead_days: 14, guest_fee_cents: 600, open: true, intro: 'Moin', secret_key: 'b' });
ok('Änderungen mit Bezeichnung und Einheit', d === 'Vorlauf (Tage): 7 → 14 · Gastgebühr: 5,00 € → 6,00 € · Geöffnet: nein → ja · Begrüßung geändert', d);
ok('keine internen Schlüssel', !/lead_days|guest_fee_cents|secret/.test(d));
ok('nichts geändert → leer', dbm.auditDiff(L, { lead_days: 7 }, { lead_days: '7' }) === '');
ok('fehlende Werte als „–“', dbm.auditDiff({ x: 'X' }, {}, { x: 'neu' }) === 'X: – → neu');

/* ---------- Rechnungsleser ---------- */
const inv = require(path.join(APP, 'src/invoices'));
const T = `GETRÄNKE MUSTERMANN e.K.
Musterweg 1 · 12345 Musterstadt
Rechnung
Rechn.-Nr. 4711 vom 03.05.2026
LS-Nr. 815 vom 02.05.2026
Art-Nr  Artikel                         Menge   EP      GP
  2144 Musterbräu Helles 20/0,33          6   16,90  101,40
  3060 E Quelle naturell 12/0,7          -7    0,25   -1,75
       Bruch
Leergut
Rechnungsbetrag:              99,65 EUR`;
const r = inv.parseInvoiceText(T);
ok('Lieferant aus dem Kopf: „Getränke Mustermann“', r.supplier === 'Getränke Mustermann', r.supplier);
ok('Rechnungsnummer und Datum', r.docNo === '4711' && r.date === '2026-05-03' && r.deliveryDate === '2026-05-02', JSON.stringify([r.docNo, r.date, r.deliveryDate]));
ok('Summe', r.total_cents === 9965, r.total_cents);
ok('zwei Positionen', r.lines.length === 2, JSON.stringify(r.lines));
ok('Kiste: Menge, Gebinde, Preise', r.lines[0] && r.lines[0].qty === 6 && r.lines[0].packSize === 20 && r.lines[0].unit_cents === 1690 && r.lines[0].line_cents === 10140, JSON.stringify(r.lines[0]));
ok('Einzelflaschen mit Bruch', r.lines[1] && r.lines[1].single && r.lines[1].qty === -7 && r.lines[1].note === 'Bruch', JSON.stringify(r.lines[1]));
ok('Firmenname ohne „Getränke“', inv.parseInvoiceText('Musterhandel GmbH\nRechnung').supplier === 'Musterhandel GmbH', inv.parseInvoiceText('Musterhandel GmbH\nRechnung').supplier);
ok('Gutschrift erkannt', inv.parseInvoiceText('Getränke Beispiel\nGutschrift\n').docKind === 'gutschrift');

/* ---------- Mitglieder-App: „zuletzt benutzt“ zählt jede Nutzung (nicht nur die PIN-Eingabe), höchstens alle 10 Minuten geschrieben ---------- */
{
  const inv = require(path.join(APP, 'src/invites')), sha = x => require('crypto').createHash('sha256').update(x).digest('hex'), { nowTs } = require(path.join(APP, 'src/util'));
  const mid = Number(dbm.db.prepare("INSERT INTO members(name) VALUES ('Lea Abel')").run().lastInsertRowid);
  const did = Number(dbm.db.prepare("INSERT INTO member_devices(scope, member_id, token_hash) VALUES ('app', ?, ?)").run(mid, sha('geraet-1')).lastInsertRowid);
  const lu = () => dbm.db.prepare('SELECT last_used FROM member_devices WHERE id = ?').get(did).last_used, ago = m => nowTs(new Date(Date.now() - m * 60000));
  ok('App-Aufruf ohne PIN erkennt das Handy', inv.whoIs('app', 'geraet-1') && inv.whoIs('app', 'geraet-1').memberId === mid);
  ok('… und setzt „zuletzt benutzt“', lu() && lu() >= ago(1), lu());
  dbm.db.prepare('UPDATE member_devices SET last_used = ? WHERE id = ?').run(ago(5), did); inv.whoIs('app', 'geraet-1');
  ok('… vor 5 Minuten: nicht neu geschrieben', lu() === ago(5) || lu() < ago(4), lu());
  dbm.db.prepare('UPDATE member_devices SET last_used = ? WHERE id = ?').run(ago(60 * 48), did); inv.whoIs('app', 'geraet-1');
  ok('… vor zwei Tagen: aktualisiert', lu() >= ago(1), lu());
}

dbm.db.close(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
console.log(fails ? fails + ' FEHLER' : 'alles ok'); process.exit(fails ? 1 : 0);
