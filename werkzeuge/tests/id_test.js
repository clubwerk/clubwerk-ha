// IDs nie doppelt + Artikel-Import mit Entscheidung je Artikel + Zugang-IDs. Startet den Server selbst.
const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_idt'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3252/';
const ExcelJS = require(APP + '/node_modules/exceljs'); const D = require(APP + '/node_modules/better-sqlite3');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 220) : '')); if (!c) fails++; };
let ck = ''; async function A(url, method = 'GET', body, raw) { const h = { 'X-Clubwerk': '1', Cookie: ck }; if (body !== undefined && !raw) h['Content-Type'] = 'application/json'; if (raw) h['Content-Type'] = raw; const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0]; const ct = r.headers.get('content-type') || ''; return [r.status, ct.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer())]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let srv;
async function start() { srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3252', BEREGNUNG_PORT: '5283', MEMBER_PORT: '5284', HA_URL: 'http://127.0.0.1:5241/api', HA_TOKEN: 'tok' }, stdio: ['ignore', fs.openSync(S + '/idt_srv.log', 'a'), fs.openSync(S + '/idt_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); } }
async function stop() { srv.kill(); await new Promise(r => srv.on('exit', r)); await sleep(300); }
(async () => {
  let s, j;
  // Alte Datenbank ohne AUTOINCREMENT simulieren: erst starten (legt an), dann eine Tabelle zurückbauen
  await start();
  await A('api/admin/setup', 'POST', { clubName: 'TC Test', password: 'Test-Kennwort-42', modules: { getraenke: true, zugang: true } });
  { const d = new D(DATA + '/clubwerk.db', { readonly: true }); const plain = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%id INTEGER PRIMARY KEY%' AND sql NOT LIKE '%AUTOINCREMENT%'").all(); d.close(); ok('Alle Tabellen vergeben IDs nie doppelt', plain.length === 0, JSON.stringify(plain)); }
  ok('Frische Installation: keine unnötige Sicherung', !fs.readdirSync(DATA + '/backups').some(f => f.includes('vor-ID')));
  // Artikel: höchste ID löschen, neu anlegen
  [s, j] = await A('api/admin/articles', 'POST', { name: 'Testartikel A', category: 'Test', price_cents: 100 }); const a1 = j.id;
  await A('api/admin/articles/' + a1, 'DELETE');
  [s, j] = await A('api/admin/articles', 'POST', { name: 'Testartikel B', category: 'Test', price_cents: 100 }); const a2 = j.id;
  ok('Artikel: gelöschte ID wird nicht wieder vergeben', a2 > a1, `${a1} → ${a2}`);
  // Mitglied
  [s, j] = await A('api/admin/members', 'POST', { name: 'Erika Probe', kind: 'mitglied' }); const m1 = j.id;
  await A('api/admin/members/' + m1, 'DELETE');
  [s, j] = await A('api/admin/members', 'POST', { name: 'Otto Probe', kind: 'mitglied' }); const m2 = j.id;
  ok('Mitglied: gelöschte ID wird nicht wieder vergeben', m2 > m1, `${m1} → ${m2}`);
  // Excel-Export enthält IDs
  [s, j] = await A('api/admin/articles/export.xlsx'); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(j); const ws = wb.worksheets[0];
  ok('Export hat ID-Spalte', ws.getRow(1).getCell(1).text === 'ID' && Number(ws.getRow(2).getCell(1).text) > 0);
  // Datei bearbeiten: Zeile 2 Preis ändern, Zeile 3 umbenennen (ID bleibt), neue Zeile mit fremder ID 9999
  const r2 = ws.getRow(2), r3 = ws.getRow(3); const id2 = Number(r2.getCell(1).text), id3 = Number(r3.getCell(1).text), n3 = r3.getCell(2).text;
  r2.getCell(4).value = 9.99; r3.getCell(2).value = n3 + ' (neu benannt)';
  ws.addRow([9999, 'Importartikel', 'Test', 2.5, 1, 'nein', 0, 0, 'ja']);
  const file = Buffer.from(await wb.xlsx.writeBuffer());
  [s, j] = await A('api/admin/articles/import-excel', 'POST', file, 'application/octet-stream');
  const c2 = j.rows.find(r => r.id === id2), c3 = j.rows.find(r => r.id === id3), nw = j.rows.find(r => r.name === 'Importartikel');
  ok('Vorschau: Preisänderung erkannt (über ID)', c2 && c2.status === 'ändern' && c2.match === 'id' && c2.diff.includes('price_cents') && c2.current.price_cents !== 999, JSON.stringify(c2 && c2.diff));
  ok('Vorschau: Umbenennung erkannt (über ID)', c3 && c3.status === 'ändern' && c3.diff.includes('name') && c3.current.name === n3);
  ok('Vorschau: fremde ID → neuer Artikel', nw && nw.status === 'neu' && !nw.id);
  // nur Zeile 2 aus der Datei übernehmen, Zeile 3 Bestand behalten
  [s, j] = await A('api/admin/articles/import-excel?commit=1&take=' + id2, 'POST', file, 'application/octet-stream');
  ok('Import: Zusammenfassung', s === 200 && j.takenCount === 1, JSON.stringify({ n: j.newCount, t: j.takenCount, c: j.changeCount }));
  [s, j] = await A('api/admin/articles');
  ok('Übernommen: Preis aus der Datei', j.find(a => a.id === id2).price_cents === 999);
  ok('Behalten: Name unverändert', j.find(a => a.id === id3).name === n3);
  const imp = j.find(a => a.name === 'Importartikel');
  ok('Neuer Artikel mit eigener, neuer ID (nicht 9999)', imp && imp.id !== 9999 && imp.id > a2, imp && imp.id);
  // Umbenennen übernehmen
  [s, j] = await A('api/admin/articles/import-excel?commit=1&take=' + id3, 'POST', file, 'application/octet-stream');
  [s, j] = await A('api/admin/articles'); ok('Umbenennen per Import übernommen, ID gleich', j.find(a => a.id === id3).name === n3 + ' (neu benannt)');
  ok('Kein doppelter Artikel durch erneuten Import', j.filter(a => a.name === 'Importartikel').length === 1);
  // Gelöschten Artikel nicht wiederbeleben
  [s, j] = await A('api/admin/bookings', 'POST', { memberId: m2, articleId: a2, qty: 1, date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) });
  await A('api/admin/articles/' + a2, 'DELETE');   // benutzt → nur als gelöscht markiert
  const wb2 = new ExcelJS.Workbook(); const w2 = wb2.addWorksheet('A'); w2.addRow(['ID', 'Artikel', 'Kategorie', 'Preis']); w2.addRow([a2, 'Testartikel B', 'Test', 1]);
  [s, j] = await A('api/admin/articles/import-excel?commit=1', 'POST', Buffer.from(await wb2.xlsx.writeBuffer()), 'application/octet-stream');
  [s, j] = await A('api/admin/articles'); const tb = j.filter(a => a.name === 'Testartikel B');
  ok('Gelöschter Artikel bleibt gelöscht, neuer bekommt neue ID', tb.length === 1 && tb[0].id > a2, JSON.stringify(tb.map(a => a.id)));
  // Zugang: Tür-IDs nie wieder vergeben, Import mit fremden IDs
  await A('api/admin/x/zugang/config', 'PUT', { doors: [{ name: 'Tür A', type: 'lock', ref: 'lock.a' }] });
  [s, j] = await A('api/admin/x/zugang/config'); const dA = j.cfg.doors[0].id;
  await A('api/admin/x/zugang/config', 'PUT', { doors: [] });
  await A('api/admin/x/zugang/config', 'PUT', { doors: [{ id: dA, name: 'Tür B', type: 'lock', ref: 'lock.b' }] });
  [s, j] = await A('api/admin/x/zugang/config'); const dB = j.cfg.doors[0].id;
  ok('Zugang: alte Tür-ID wird nicht wiederverwendet (auch wenn mitgeschickt)', dB !== dA, `${dA} / ${dB}`);
  await A('api/admin/x/zugang/config', 'PUT', { doors: [{ id: dB, name: 'Tür B umbenannt', type: 'lock', ref: 'lock.b' }] });
  [s, j] = await A('api/admin/x/zugang/config'); ok('Zugang: vorhandene Tür behält ihre ID', j.cfg.doors[0].id === dB);
  const all = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, [['00:00', '24:00']]]));
  [s, j] = await A('api/admin/extensions/zugang/import', 'POST', { format: 'vereinsheim-funktion', module: 'zugang', data: { doors: [{ id: 'abcdef12', name: 'Fremdtür', type: 'lock', ref: 'lock.x' }], profiles: [{ id: 'fremd', name: 'Nur Fremdtür', doors: ['abcdef12'], windows: all, isDefault: true }] } });
  [s, j] = await A('api/admin/x/zugang/config');
  const fd = j.cfg.doors.find(d => d.name === 'Fremdtür'), fp = j.cfg.profiles.find(p => p.name === 'Nur Fremdtür');
  ok('Funktionsimport: Zeitprofil zeigt auf die Tür, ID eindeutig', fd && fp && fp.doors.length === 1 && fp.doors[0] === fd.id && fd.id !== dA && fd.id !== dB, JSON.stringify({ fd, fp: fp && fp.doors }));
  // Import mit einer hier schon einmal vergebenen Tür-ID → neue ID, Profil wird umgehängt
  [s, j] = await A('api/admin/extensions/zugang/import', 'POST', { format: 'vereinsheim-funktion', module: 'zugang', data: { doors: [{ id: dA, name: 'Alte Nummer', type: 'lock', ref: 'lock.y' }], profiles: [{ id: 'p2', name: 'Nur alte Nummer', doors: [dA], windows: all, isDefault: true }] } });
  [s, j] = await A('api/admin/x/zugang/config');
  const od = j.cfg.doors.find(d => d.name === 'Alte Nummer'), op = j.cfg.profiles.find(p => p.name === 'Nur alte Nummer');
  ok('Funktionsimport: schon einmal vergebene ID wird ersetzt, Profil umgehängt', od && od.id !== dA && op && op.doors[0] === od.id, JSON.stringify({ od, op: op && op.doors }));
  await stop();
  // Bestehende alte Datenbank: Tabelle ohne AUTOINCREMENT → wird beim Start umgestellt, mit Sicherung, IDs bleiben
  { const d = new D(DATA + '/clubwerk.db'); d.pragma('foreign_keys = OFF');
    const t = d.prepare("SELECT sql FROM sqlite_master WHERE name='articles'").get().sql.replace(/ AUTOINCREMENT/i, '');
    const cols = d.prepare('PRAGMA table_info(articles)').all().map(c => c.name).join(',');
    d.exec(`CREATE TABLE art_old AS SELECT * FROM articles; DROP TABLE articles; ${t}; INSERT INTO articles(${cols}) SELECT ${cols} FROM art_old; DROP TABLE art_old;`); d.close(); }
  const before = (() => { const d = new D(DATA + '/clubwerk.db', { readonly: true }); const r = d.prepare('SELECT id, name FROM articles ORDER BY id').all(); d.close(); return r; })();
  await start();
  { const d = new D(DATA + '/clubwerk.db', { readonly: true }); const sql = d.prepare("SELECT sql FROM sqlite_master WHERE name='articles'").get().sql; const after = d.prepare('SELECT id, name FROM articles ORDER BY id').all();
    ok('Alte Datenbank umgestellt', /AUTOINCREMENT/i.test(sql)); ok('IDs und Namen unverändert', JSON.stringify(after) === JSON.stringify(before)); ok('Integrität', d.pragma('integrity_check')[0].integrity_check === 'ok' && d.pragma('foreign_key_check').length === 0); d.close(); }
  ok('Sicherung vor der Umstellung angelegt', fs.readdirSync(DATA + '/backups').some(f => f.includes('vor-ID-Umstellung')));
  ck = ''; await A('api/admin/login', 'POST', { username: 'admin', password: 'Test-Kennwort-42' });
  [s, j] = await A('api/admin/articles', 'POST', { name: 'Nach Umstellung', category: 'Test', price_cents: 100 });
  ok('Neue ID nach Umstellung größer als alle bisherigen', j.id > Math.max(...before.map(r => r.id)), j.id);
  await stop();
  console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); try { await stop(); } catch (x) { /* */ } process.exit(1); });
