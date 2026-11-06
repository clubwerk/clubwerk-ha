'use strict';
/* Anbindung an den Kern und andere Module: Hooks (Tablet-Reiter, Verknüpfungen, Datenschutz, Übersicht, Suche, Sicherheitswarnungen, Funktionsexport). */
const konfigio = require('../../../src/konfigio');

function register(sh) {
  const { ctx, db, S, SET, cfg, one, txt, fail, euro, personName, itemsOf, pieceText, dropFile, issueView, openItems, KINDS, deD, today, int } = sh;
  const H = ctx.hooks;

  /* Tablet: der Reiter „Schlüssel“ erscheint nur, solange eine Übergabe mit Code auf die Unterschrift wartet */
  H.tabletVisible = () => db.prepare("SELECT COUNT(*) n FROM sl_issue WHERE status = 'wartet' AND code_expires > ?").get(Date.now()).n > 0;

  /* Mitglied hängt noch an Schlüsseln: Löschen blockiert, Austritts-Fenster nennt sie, Reiter „Dokumente“ zeigt die Protokolle */
  const heldBy = id => db.prepare("SELECT * FROM sl_issue WHERE member_id = ? AND status IN ('wartet','ausgegeben')").all(id)
    .flatMap(i => itemsOf(i.id).filter(x => x.state === 'ausgegeben' || x.state === 'reserviert').map(x => pieceText(x)));
  H.memberLinks = id => heldBy(id).map(t => `Hat Schlüssel: ${t}`);
  H.exitNotes = id => { const l = heldBy(id); return l.length ? [`Hat noch ${l.length === 1 ? 'den Schlüssel' : 'die Schlüssel'} ${l.join(', ')} – bitte zurückfordern (Anlage › Schlüssel).`] : []; };
  H.memberDocuments = id => db.prepare(`SELECT p.id, p.no, p.kind, p.at FROM sl_protocol p JOIN sl_issue i ON i.id = p.issue_id WHERE i.member_id = ? AND p.file IS NOT NULL ORDER BY p.id DESC`).all(id)
    .map(p => ({ source: 'schluessel', id: p.id, title: `${{ ausgabe: 'Schlüsselübergabe', rueckgabe: 'Schlüsselrückgabe', verlust: 'Verlustanzeige', storno: 'Stornierung' }[p.kind]} ${p.no}`, created_at: p.at, href: `api/admin/x/schluessel/protocols/${p.id}/pdf` }));
  H.memberRemoved = (fromId, intoId) => { db.prepare('UPDATE sl_issue SET member_id = ? WHERE member_id = ?').run(intoId || null, fromId); };

  /* Datenschutz: Löschfristen (laufende Ausgaben nie), Auskunft, Verzeichnis */
  function dropIssues(ids) {
    for (const id of ids) {
      for (const p of db.prepare('SELECT file FROM sl_protocol WHERE issue_id = ?').all(id)) dropFile(p.file);
      db.prepare('DELETE FROM sl_protocol WHERE issue_id = ?').run(id); db.prepare('DELETE FROM sl_issue_piece WHERE issue_id = ?').run(id); db.prepare('DELETE FROM sl_issue WHERE id = ?').run(id);
    }
  }
  const dueRows = (pfand, cut) => db.prepare(`SELECT id FROM sl_issue WHERE status IN ('zurueck','storniert') AND closed_at IS NOT NULL AND closed_at < ? AND ((deposit_cents > 0 OR cost_cents > 0) = ${pfand ? 1 : 0})`).all(cut).map(r => r.id);
  H.retention = () => [
    { id: 'ohnepfand', label: 'Schlüssel-Protokolle ohne Pfand', text: 'Ausgabe, Rückgabe, Verlust mit Unterschriften und PDF; laufende Ausgaben bleiben immer.', unit: 'monate', value: cfg().keep_ohnepfand, def: 36, min: 12, max: 120,
      due: cut => dueRows(false, cut).length, purge: cut => { const ids = dueRows(false, cut); db.transaction(() => dropIssues(ids))(); return ids.length; }, set: v => SET('keep_ohnepfand', v) },
    { id: 'mitpfand', label: 'Schlüssel-Protokolle mit Pfand oder Kosten', text: 'Wie Belege aufbewahren; mit dem Steuerberater abstimmen.', unit: 'monate', value: cfg().keep_mitpfand, def: 120, min: 12, max: 120,
      due: cut => dueRows(true, cut).length, purge: cut => { const ids = dueRows(true, cut); db.transaction(() => dropIssues(ids))(); return ids.length; }, set: v => SET('keep_mitpfand', v) },
  ];
  H.privacyRecord = () => [{ purpose: 'Nachweis über ausgegebene Schlüssel (Übergabe, Rückgabe, Verlust)', data: 'Name, ggf. Mitgliedsnummer, bei Personen ohne Konto Kontakt und Geburtsdatum, Unterschriften, Pfand und Kosten, Protokoll-PDF',
    persons: 'Empfänger und ausgebende Personen', frist: 'Rechtsgrundlage Vertrag/Vereinszweck (Art. 6 Abs. 1 lit. b DSGVO). Löschfrist nach Rückgabe: einstellbar (ohne Pfand 3 Jahre, mit Pfand 10 Jahre).' }];
  H.memberData = id => {
    const issues = db.prepare('SELECT * FROM sl_issue WHERE member_id = ? ORDER BY id').all(id);
    if (!issues.length) return {};
    return { ausgaben: issues.map(i => ({ schluessel: itemsOf(i.id).map(x => pieceText(x)), ausgegeben_am: i.issued_at, rueckgabe_bis: i.due || '', pfand: i.deposit_cents ? euro(i.deposit_cents) : 'kein', status: i.status, uebernommen_ohne_protokoll: Boolean(i.legacy) })),
      protokolle: db.prepare(`SELECT p.no AS nummer, p.kind AS art, p.at AS datum, p.status, (p.sig_a IS NOT NULL) AS sig FROM sl_protocol p JOIN sl_issue i ON i.id = p.issue_id WHERE i.member_id = ? ORDER BY p.id`).all(id)
        .map(p => ({ nummer: p.nummer, art: p.art, datum: p.datum, status: p.status, unterschrift_gespeichert: p.sig ? 'ja' : 'nein' })) };
  };

  /* Übersicht, Suche, Sicherheitswarnungen */
  H.overview = () => {
    const rows = db.prepare("SELECT * FROM sl_issue WHERE status = 'ausgegeben'").all().map(issueView);
    const reclaim = rows.filter(r => r.reclaim).length, out = rows.reduce((n, r) => n + openItems(r.pieces).length, 0);
    return { kpis: [{ l: 'Schlüssel ausgegeben', v: out }], alerts: reclaim ? [{ level: 'a', text: reclaim === 1 ? ctx.T('1 Person hat noch Schlüssel – bitte zurückfordern.') : ctx.T('{0} Personen haben noch Schlüssel – bitte zurückfordern.', [reclaim]), link: 'Ansehen', sec: ['tab_schluessel', 'ausgegeben'] }] : [] };
  };
  H.search = s => {
    const w = s.where('t.ident', 't.name', 'm.name');
    const rows = db.prepare(`SELECT i.id AS issue_id, i.member_id, i.ext_first, i.ext_last, t.ident, t.name AS tname, p.label FROM sl_issue_piece ip JOIN sl_issue i ON i.id = ip.issue_id JOIN sl_piece p ON p.id = ip.piece_id
      JOIN sl_type t ON t.id = p.type_id LEFT JOIN members m ON m.id = i.member_id WHERE ip.state = 'ausgegeben' AND i.status = 'ausgegeben' AND ${w.sql}`).all(...w.args);
    return [{ group: 'Schlüssel', art: 'schluessel', page: 'schluessel', detail: false, hits: s.pick(rows, r => [`Nr. ${r.ident}`, r.tname, r.label, personName(r)]).map(r => ({
      id: r.issue_id, label: `Nr. ${r.ident} ${r.tname}`, sub: [personName(r), 'ausgegeben'], person: true, score: r._score, ref: '' })) }];
  };
  H.securityEvents = () => [
    { id: 'verlust_sicher', label: 'Sicherheitsrelevanter Schlüssel verloren', level: 'r', push: 'Ein sicherheitsrelevanter Schlüssel wurde als verloren gemeldet – bitte in der Verwaltung ansehen.' },
    { id: 'verlust', label: 'Schlüssel verloren', level: 'a', push: 'Ein Schlüssel wurde als verloren gemeldet.' },
    { id: 'code', label: 'Falsche Codes bei der Schlüsselübergabe am Tablet', level: 'a', push: 'Am Tablet wurde bei der Schlüsselübergabe mehrfach ein falscher Code eingegeben.' },
    { id: 'code_alle', label: 'Code-Eingabe der Schlüsselübergabe für alle Tablets gesperrt', level: 'a', push: 'Die Code-Eingabe der Schlüsselübergabe ist für alle Tablets gesperrt.' },
  ];
  H.probeCounts = () => [{ label: 'Schlüssel-Sorten', n: db.prepare('SELECT COUNT(*) n FROM sl_type').get().n }, { label: 'Schlüssel-Ausgaben', n: db.prepare('SELECT COUNT(*) n FROM sl_issue').get().n }, { label: 'Schlüssel-Protokolle', n: db.prepare('SELECT COUNT(*) n FROM sl_protocol').get().n }];
  H.setupSteps = () => [{ id: 'bestand', title: 'Schlüssel: Bestand anlegen', text: 'Welche Schlüssel, Transponder und Karten es gibt – und die Bedingungen für die Ausgabe.', page: 'schluessel', tab: ['schluessel', 'bestand'], card: [], done: () => Boolean(db.prepare('SELECT 1 FROM sl_type LIMIT 1').get()) }];

  /* Funktionsexport/-import: Sorten, Vorlagen, Einstellungen – keine Stücke, Personen, Ausgaben oder Unterschriften */
  H.exportConfig = () => ({
    types: db.prepare('SELECT t.ident, t.name, t.kind, t.opens, t.deposit_cents, t.sensitive, t.note, (SELECT COUNT(*) FROM sl_piece p WHERE p.type_id = t.id AND p.status != \'ausgemustert\') AS count FROM sl_type t ORDER BY t.sort, t.ident').all().map(t => ({ ...t, sensitive: Boolean(t.sensitive) })),
    templates: db.prepare('SELECT name, text FROM sl_template ORDER BY sort, id').all(), settings: cfg() });
  H.importConfig = data => {
    if (!data || typeof data !== 'object') throw new Error('Leere Funktionsdatei.');
    const z = konfigio.zaehler(); let ungueltig = 0;
    db.transaction(() => {
      const types = new Map(db.prepare('SELECT * FROM sl_type').all().map(t => [t.ident.toLowerCase(), t]));
      for (const x of konfigio.liste(data.types, 300)) {
        const ident = one(x.ident, 20), name = one(x.name, 80); if (!ident || name.length < 2 || !KINDS[x.kind]) { ungueltig++; continue; }
        const dep = Math.min(100000, Math.max(0, int(x.deposit_cents))), found = types.get(ident.toLowerCase());
        const v = { ident, name, kind: x.kind, opens: one(x.opens, 200) || null, deposit_cents: dep, sensitive: x.sensitive ? 1 : 0, note: txt(x.note, 500) || null };
        if (found) { db.prepare('UPDATE sl_type SET name = ?, kind = ?, opens = ?, deposit_cents = ?, sensitive = ?, note = ? WHERE id = ?').run(v.name, v.kind, v.opens, v.deposit_cents, v.sensitive, v.note, found.id); z('Sorten', 'aktualisiert'); }
        else {
          const tid = Number(db.prepare('INSERT INTO sl_type(ident, name, kind, opens, deposit_cents, sensitive, note, sort) VALUES (?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sort), 0) + 1 FROM sl_type))').run(v.ident, v.name, v.kind, v.opens, v.deposit_cents, v.sensitive, v.note).lastInsertRowid);
          const n = Math.min(100, Math.max(1, int(x.count) || 1)); for (let k = 1; k <= n; k++) db.prepare('INSERT INTO sl_piece(type_id, label) VALUES (?,?)').run(tid, n === 1 ? ident : `${ident}-${k}`);
          types.set(ident.toLowerCase(), { id: tid, ident }); z('Sorten', 'neu');
        }
      }
      const tpls = new Map(db.prepare('SELECT * FROM sl_template').all().map(t => [t.name.toLowerCase(), t]));
      for (const x of konfigio.liste(data.templates, 30)) {
        const name = one(x.name, 60), text = txt(x.text, 6000); if (name.length < 2 || text.length < 10) { ungueltig++; continue; }
        const found = tpls.get(name.toLowerCase());
        if (found) { db.prepare('UPDATE sl_template SET text = ? WHERE id = ?').run(text, found.id); z('Vorlagen', 'aktualisiert'); }
        else { db.prepare('INSERT INTO sl_template(name, text, sort) VALUES (?,?,(SELECT COALESCE(MAX(sort), 0) + 1 FROM sl_template))').run(name, text); z('Vorlagen', 'neu'); }
      }
    })();
    const c = data.settings || {};
    if (Number.isInteger(c.max_cost_cents) && c.max_cost_cents >= 0 && c.max_cost_cents <= 1000000) SET('max_cost_cents', c.max_cost_cents);
    for (const k of ['keep_ohnepfand', 'keep_mitpfand']) if (Number.isInteger(c[k]) && c[k] >= 12 && c[k] <= 120) SET(k, c[k]);
    if (c.mail_on !== undefined) SET('mail_on', c.mail_on ? '1' : '0');
    if (typeof c.cc === 'string' && (c.cc === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.cc))) SET('cc', c.cc);
    if (ungueltig) z.hinweis(`${ungueltig} ungültige Einträge übersprungen`);
    return z.text();
  };
}

module.exports = { register };
