// Mehrsprachigkeit + Umbenennung: API, Import/Export, Server-Übersetzung, Excel-Import in Englisch
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_i18n'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3291/';
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 220) : '')); if (!c) fails++; };
let ck = '';
async function A(url, method = 'GET', body, extra = {}) {
  const h = { 'X-Clubwerk': '1', Cookie: ck, ...extra }; let b = body;
  if (body !== undefined && !(body instanceof Buffer) && typeof body !== 'string') { h['Content-Type'] = 'application/json'; b = JSON.stringify(body); }
  const r = await fetch(B + url, { method, headers: h, body: b });
  const sc = r.headers.get('set-cookie'); if (sc && /^gadmin=/.test(sc) && !/^gadmin=;/.test(sc)) ck = sc.split(';')[0];
  const ct = r.headers.get('content-type') || '';
  return [r.status, ct.includes('json') ? await r.json().catch(() => ({})) : Buffer.from(await r.arrayBuffer()), r.headers];
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  // alte Datenbank „getraenke.db“ wird übernommen
  fs.copyFileSync(path.join(S, 'mig_old', 'getraenke.db'), path.join(DATA, 'getraenke.db'));
  const env = { ...process.env, DATA_DIR: DATA, PORT: '3291', BEREGNUNG_PORT: '5293', MEMBER_PORT: '5294', EXT_DIR: S + '/none', CW_TEST_NO_SETUP_CODE: '1' };
  const srv = spawn('node', [APP + '/src/server.js'], { env, stdio: ['ignore', fs.openSync(S + '/i18n_srv.log', 'w'), fs.openSync(S + '/i18n_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { await fetch(B + 'api/branding'); break; } catch (e) { await sleep(250); } }
  try {
    ok('DB umbenannt: clubwerk.db', fs.existsSync(path.join(DATA, 'clubwerk.db')) && !fs.existsSync(path.join(DATA, 'getraenke.db')));
    let [s, j] = await A('api/admin/status');
    if (!j.configured) { [s, j] = await A('api/admin/setup', 'POST', { password: 'Test-Kennwort-42' }); }
    [s, j] = await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' }); ok('Login', s === 200, JSON.stringify(j));
    // Seiten-Skript
    let r = await fetch(B + 'i18n.js?l=auto'); let t = await r.text();
    ok('i18n.js (Deutsch, klein)', r.ok && /CWI18N\.start\(/.test(t) && /"lang":"de"/.test(t) && t.length < 40000, t.length);
    r = await fetch(B + 'i18n.js?l=en'); t = await r.text();
    ok('i18n.js (Englisch, mit Texten)', /"lang":"en"/.test(t) && /"locale":"en-GB"/.test(t) && t.includes('"Speichern":"Save"'), t.length);
    r = await fetch(B + 'i18n.js?l=auto&b=' + encodeURIComponent('en-US,en;q=0.9')); t = await r.text();
    ok('Handy-Sprache en-US → en', /"lang":"en"/.test(t));
    r = await fetch(B + 'i18n.js?l=xx'); t = await r.text(); ok('unbekannte Sprache → Vereinssprache', /"lang":"de"/.test(t));
    r = await fetch(B + 'i18n.js?l=' + encodeURIComponent('</script><script>alert(1)')); t = await r.text(); ok('kein Einschleusen über l', !/alert\(1\)/.test(t));
    // Liste
    [s, j] = await A('api/admin/sprachen'); const en = (j.languages || []).find(l => l.code === 'en');
    ok('Sprachenliste de + en', s === 200 && j.club === 'de' && en && en.builtin && en.coverage > 95, JSON.stringify(j.languages && j.languages.map(l => [l.code, l.coverage])));
    // Fehlermeldungen übersetzt
    [s, j] = await A('api/admin/sprachen/verein', 'PUT', { code: 'zz' }, { 'X-Lang': 'en' }); ok('Fehler auf Englisch', s === 400 && j.error === 'This language does not exist.', j.error);
    [s, j] = await A('api/admin/sprachen/verein', 'PUT', { code: 'zz' }); ok('Fehler auf Deutsch', j.error === 'Diese Sprache gibt es nicht.', j.error);
    // Download
    let [s2, buf, hd] = await A("api/admin/sprachen/en/download"); const dj = Buffer.isBuffer(buf) ? JSON.parse(buf.toString()) : buf;
    ok('Download JSON en', s2 === 200 && dj._meta.code === 'en' && dj.strings['Speichern'] === 'Save' && /attachment/.test(hd.get('content-disposition')));
    [s2, buf] = await A("api/admin/sprachen/vorlage/download"); const tj = Buffer.isBuffer(buf) ? JSON.parse(buf.toString()) : buf;
    ok('Vorlage leer, mit Anleitung', tj._meta.code === '' && tj.strings['Speichern'] === '' && /Platzhalter/.test(tj._anleitung) && Object.keys(tj.strings).length > 2000);
    [s2, buf] = await A('api/admin/sprachen/vorlage/download?format=xlsx'); ok('Vorlage Excel', s2 === 200 && buf[0] === 0x50 && buf.length > 20000, buf.length);
    // Import Französisch (Teil 1 JSON, Teil 2 Excel)
    const fr = { _meta: { code: 'fr', name: 'Français', locale: 'fr-FR' }, strings: { 'Speichern': 'Enregistrer', 'Abbrechen': 'Annuler', '{0} Dateien': '{0} fichiers', 'Diese Sprache gibt es nicht.': 'Cette langue n’existe pas.', 'Unsinn-Text': 'x', 'Löschen': '' } };
    fr.strings['Bitte {0} bar in die Kasse'] = 'Mettez {1} en caisse';   // Platzhalter falsch
    [s, j] = await A('api/admin/sprachen/import', 'POST', Buffer.from('```json\n' + JSON.stringify(fr) + '\n```'), { 'Content-Type': 'application/octet-stream', 'X-Filename': 'fr.json' });
    ok('Import fr (aus KI-Codeblock)', s === 200 && j.report.taken === 4 && j.report.unknown === 1 && j.report.empty === 1 && j.report.rejected.length === 1, JSON.stringify(j.report || j));
    const ExcelJS = require(APP + '/node_modules/exceljs');
    { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const ws = wb.getWorksheet('Texte'); const info = wb.getWorksheet('Info');
      info.getCell('B3').value = 'fr'; info.getCell('B4').value = 'Français';
      ws.eachRow((row, n) => { if (row.getCell(2).value === 'Löschen') row.getCell(4).value = 'Supprimer'; });
      const out = Buffer.from(await wb.xlsx.writeBuffer());
      [s, j] = await A('api/admin/sprachen/import', 'POST', out, { 'Content-Type': 'application/octet-stream', 'X-Filename': 'fr.xlsx' });
      ok('Import fr Teil 2 (Excel) ergänzt', s === 200 && j.report.taken === 1, JSON.stringify(j.report || j)); }
    [s, j] = await A('api/admin/sprachen'); const frl = j.languages.find(l => l.code === 'fr');
    ok('fr in Liste, 5 Texte', frl && frl.custom && frl.customCount === 5 && !frl.builtin, JSON.stringify(frl));
    [s, j] = await A('api/admin/sprachen/verein', 'PUT', { code: 'zz' }, { 'X-Lang': 'fr' }); ok('Fehler auf Französisch', j.error === 'Cette langue n’existe pas.', j.error);
    r = await fetch(B + 'i18n.js?l=fr'); t = await r.text(); ok('i18n.js fr', /"lang":"fr"/.test(t) && t.includes('Enregistrer'));
    // Ohne Code → Fehler; mit Override
    [s, j] = await A('api/admin/sprachen/import', 'POST', Buffer.from(JSON.stringify({ strings: { Speichern: 'Salvar' } })), { 'Content-Type': 'application/octet-stream' });
    ok('Import ohne Code abgelehnt', s === 400 && /Sprachcode/.test(j.error), j.error);
    [s, j] = await A('api/admin/sprachen/import?code=pt-br&name=Portugu%C3%AAs', 'POST', Buffer.from(JSON.stringify({ strings: { Speichern: 'Salvar' } })), { 'Content-Type': 'application/octet-stream' });
    ok('Import mit Code pt-BR', s === 200 && j.report.code === 'pt-BR', JSON.stringify(j.report || j));
    [s, j] = await A('api/admin/sprachen/import', 'POST', Buffer.from('kein json'), { 'Content-Type': 'application/octet-stream' }); ok('Unsinn abgelehnt', s === 400);
    // Deutsch anpassen (Begriffe)
    [s, j] = await A('api/admin/sprachen/import', 'POST', Buffer.from(JSON.stringify({ _meta: { code: 'de' }, strings: { Mitglieder: 'Spieler' } })), { 'Content-Type': 'application/octet-stream' });
    ok('Deutsch anpassen', s === 200 && j.report.code === 'de');
    r = await fetch(B + 'i18n.js?l=de'); t = await r.text(); ok('angepasstes Deutsch wird geladen', t.includes('"Mitglieder":"Spieler"'));
    [s, j] = await A('api/admin/sprachen/de', 'DELETE'); ok('Anpassungen Deutsch entfernen', s === 200 && j.builtinRemains);
    // Vereinssprache Englisch → Exporte/E-Mails
    [s, j] = await A('api/admin/sprachen/verein', 'PUT', { code: 'en' }); ok('Vereinssprache en', s === 200 && j.club === 'en');
    r = await fetch(B + 'i18n.js?l=auto'); t = await r.text(); ok('auto → en', /"lang":"en"/.test(t));
    [s2, buf] = await A('api/admin/members/import-vorlage.xlsx');
    { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const ws = wb.worksheets[0]; const head = []; ws.getRow(1).eachCell(c => head.push(String(c.value)));
      ok('Mitglieder-Vorlage auf Englisch', head.some(h => /First name/i.test(h)) && !head.some(h => h === 'Vorname'), head.join('|'));
      // englische Vorlage wieder importieren
      ws.addRow(['Mitglied', 'Erika', 'Beispiel']);
      const out = Buffer.from(await wb.xlsx.writeBuffer());
      [s, j] = await A('api/admin/members/import-excel', 'POST', out, { 'Content-Type': 'application/octet-stream' });
      ok('englische Vorlage wird erkannt', s === 200 && j.rows && j.rows.length >= 1, JSON.stringify(j).slice(0, 200)); }
    [s2, buf] = await A('api/admin/articles/export.xlsx');
    { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const ws = wb.worksheets[0]; const head = []; ws.getRow(1).eachCell(c => head.push(String(c.value)));
      const out = Buffer.from(await wb.xlsx.writeBuffer());
      [s, j] = await A('api/admin/articles/import-excel', 'POST', out, { 'Content-Type': 'application/octet-stream' });
      ok('englische Artikelliste wieder importierbar', s === 200, head.join('|') + ' → ' + JSON.stringify(j).slice(0, 160)); }
    // Sprache löschen → Verein fällt zurück
    [s, j] = await A('api/admin/sprachen/verein', 'PUT', { code: 'fr' });
    [s, j] = await A('api/admin/sprachen/fr', 'DELETE'); ok('fr löschen', s === 200 && !j.builtinRemains && j.club !== 'fr', JSON.stringify({ club: j.club }));
    [s, j] = await A('api/admin/sprachen/en', 'DELETE'); ok('mitgelieferte Sprache ohne Anpassung nicht löschbar', s === 400);
    // Rechte: ohne einstellungen kein Import
    [s, j] = await A('api/admin/users', 'POST', { username: 'kasse', name: 'Kasse', password: 'kasse12345', role: 'admin', perms: ['abrechnung'] });
    const save = ck; ck = ''; await A('api/admin/login', 'POST', { username: 'kasse', password: 'kasse12345' });
    [s, j] = await A('api/admin/sprachen'); ok('Liste für alle Admins', s === 200 && j.canEdit === false);
    [s, j] = await A('api/admin/sprachen/import', 'POST', Buffer.from(JSON.stringify(fr)), { 'Content-Type': 'application/octet-stream' }); ok('Import ohne Recht verboten', s === 403);
    [s2] = await A('api/admin/sprachen/en/download'); ok('Download ohne Recht verboten', s2 === 403);
    ck = save;
    // Manifest = Vereinsname
    r = await fetch(B + 'manifest.webmanifest'); j = await r.json(); ok('Tablet-Manifest mit Vereinsname', j.name && j.name !== 'Vereinsheim' && j.name !== 'Clubwerk', j.name);
  } finally { srv.kill('SIGTERM'); await sleep(500); }
  console.log(fails ? fails + ' FEHLER' : 'ALLES OK');
  process.exit(fails ? 1 : 0);
})();
