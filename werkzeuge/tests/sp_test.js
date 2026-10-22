// Spielbetrieb: Grundfunktionen über die Verwaltungs-API. Startet den Server selbst.  node sp_test.js <S>
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_sp'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const B = 'http://127.0.0.1:3284/'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 400) : '')); if (!c) fails++; };
let ck = '';
async function A(url, method = 'GET', body) {
  const h = { 'X-Clubwerk': '1', Cookie: ck }; if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(B + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('gadmin=') && !sc.startsWith('gadmin=;')) ck = sc.split(';')[0];
  let j = {}; try { j = JSON.parse(await r.text()); } catch (e) { /* */ } return [r.status, j];
}
const X = p => 'api/admin/x/spielbetrieb/' + p;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Datum relativ zu heute (lokale Zeit)
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
let srv;
async function start() {
  srv = spawn('node', ['src/server.js'], { cwd: APP, env: { ...process.env, CW_TEST_NO_SETUP_CODE: '1', DATA_DIR: DATA, PORT: '3284', BEREGNUNG_PORT: '5291', MEMBER_PORT: '5289', EXT_DIR: S + '/none' }, stdio: ['ignore', fs.openSync(S + '/sp_srv.log', 'w'), fs.openSync(S + '/sp_srv.log', 'a')] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(B + 'api/admin/status'); if (r.status) return; } catch (e) { /* */ } await sleep(250); }
}
const usage = async () => (await A('api/admin/extensions/spielbetrieb/usage'))[1].rows || {};
(async () => {
  let s, j;
  // 6. Modul-Sicherung: Tabellenliste in erweiterung.json deckt alle Tabellen des Moduls ab (reiner Dateivergleich)
  {
    const dir = path.join(APP, 'erweiterungen/spielbetrieb');
    const meta = JSON.parse(fs.readFileSync(dir + '/erweiterung.json', 'utf8'));
    const src = fs.readFileSync(dir + '/server.js', 'utf8');
    const made = [...src.matchAll(/CREATE TABLE IF NOT EXISTS (sp_\w+)/g)].map(m => m[1]);
    const miss = made.filter(t => !(meta.tabellen || []).includes(t)), extra = (meta.tabellen || []).filter(t => !made.includes(t));
    ok('Sicherung: Tabellenliste vollständig', made.length >= 7 && !miss.length && !extra.length, `fehlt: ${miss.join(',')} · zu viel: ${extra.join(',')}`);
    ok('Sicherung: sp_extern in der Liste', (meta.tabellen || []).includes('sp_extern'));
  }
  await start();
  [s, j] = await A('api/admin/setup', 'POST', { clubName: 'TC Grün-Weiß Musterstadt', password: 'Test-Kennwort-42', modules: { spielbetrieb: true } });
  ok('Setup', s === 200, JSON.stringify(j));
  [s, j] = await A(X('meta')); ok('Modul aktiv (Meta)', s === 200 && Array.isArray(j.teams), s + ' ' + JSON.stringify(j).slice(0, 200));
  // Mitglieder (Kernkonten, ohne Mitgliederverwaltung)
  const mk = async name => (await A('api/admin/members', 'POST', { name }))[1].id;
  const ids = {}; for (const n of ['Max Muster', 'Eva Muster', 'Paul Beispiel', 'Lena Probe', 'Udo Test']) ids[n] = await mk(n);
  ok('Mitglieder angelegt', Object.values(ids).every(Boolean), JSON.stringify(ids));
  const max = ids['Max Muster'], eva = ids['Eva Muster'], paul = ids['Paul Beispiel'], lena = ids['Lena Probe'], udo = ids['Udo Test'];

  // 1. Mannschaft, Spieler, Spieltag
  [s, j] = await A(X('teams'), 'POST', { name: 'Herren 40 I', league: 'Bezirksliga', min_players: 2, captain_id: max, vice_id: eva });
  ok('Mannschaft angelegt', s === 200 && j.id, JSON.stringify(j)); const team = j.id;
  [s, j] = await A(X('teams'), 'POST', { name: 'Herren 40', league: 'Bezirksliga', min_players: 2 }); ok('Doppelte Mannschaft abgelehnt', s === 409, s + ' ' + JSON.stringify(j));
  [s, j] = await A(X('teams'), 'POST', { name: 'X', min_players: 2 }); ok('Zu kurzer Name abgelehnt', s === 400);
  [s, j] = await A(X(`teams/${team}/players`), 'PUT', { players: [max, eva, paul, lena] });
  ok('Spieler zugeordnet', s === 200 && j.players.length === 4 && j.players[0].id === max, JSON.stringify(j));
  [s, j] = await A(X(`teams/${team}/extern`), 'POST', { name: 'Gerd Gast', club: 'TC Nachbarort' });
  ok('Gastspieler/in angelegt', s === 200 && j.id && j.players.length === 5, JSON.stringify(j)); const gast = j.id;
  [s, j] = await A(X('meta')); const tm = j.teams.find(t => t.id === team);
  ok('Mannschaft in Meta mit Mannschaftsführer', tm && tm.captain === 'Muster, Max' && tm.vice === 'Muster, Eva' && tm.players.length === 5, JSON.stringify(tm));
  const d1 = day(10), d2 = day(17);
  [s, j] = await A(X('games'), 'POST', { team_id: team, date: d1, start: '10:00', home: 1, opponent: 'TC Beispielhausen' });
  ok('Spieltag angelegt', s === 200 && j.id, JSON.stringify(j)); const g1 = j.id;
  [s, j] = await A(X('games'), 'POST', { team_id: team, date: 'morgen', opponent: 'TC Y' }); ok('Ungültiges Datum abgelehnt', s === 400);
  [s, j] = await A(X('games'), 'POST', { team_id: 999999, date: d1, opponent: 'TC Y' }); ok('Unbekannte Mannschaft abgelehnt', s === 400);
  [s, j] = await A(X('games')); ok('Spieltag in der Liste', s === 200 && j.some(g => g.id === g1 && g.date === d1 && g.opponent === 'TC Beispielhausen' && g.stats.roster === 5), JSON.stringify(j).slice(0, 300));

  // 2. Verfügbarkeit und Aufstellung
  [s, j] = await A(X(`games/${g1}/avail`), 'POST', { member_id: max, state: 'ja' }); ok('Verfügbarkeit „kann“', s === 200);
  await A(X(`games/${g1}/avail`), 'POST', { member_id: eva, state: 'ja' });
  [s, j] = await A(X(`games/${g1}/avail`), 'POST', { member_id: paul, state: 'nein' }); ok('Verfügbarkeit „kann nicht“', s === 200);
  [s, j] = await A(X(`games/${g1}/avail`), 'POST', { member_id: lena, state: 'vielleicht' }); ok('Unbekannter Wert abgelehnt', s === 400);
  [s, j] = await A(X(`games/${g1}/lineup`), 'POST', { member_id: max, role: 'spielt' }); ok('Aufgestellt', s === 200, JSON.stringify(j).slice(0, 200));
  await A(X(`games/${g1}/lineup`), 'POST', { member_id: eva, role: 'spielt' });
  [s, j] = await A(X(`games/${g1}/lineup`), 'POST', { member_id: lena, role: 'ersatz' }); ok('Ersatz', s === 200);
  [s, j] = await A(X(`games/${g1}/lineup`), 'POST', { member_id: paul, role: 'spielt' }); ok('Abgesagter Spieler nicht aufstellbar', s === 400 && /abgesagt/.test(j.error), JSON.stringify(j));
  [s, j] = await A(X(`games/${g1}/task`), 'POST', { kind: 'bewirtung', member_id: udo }); ok('Aufgabe angelegt', s === 200);
  [s, j] = await A(X(`games/${g1}`)); const P = id => (j.people || []).find(p => p.id === id) || {};
  ok('Spieltag: Rückmeldungen und Aufstellung', s === 200 && P(max).state === 'ja' && P(max).role === 'spielt' && P(paul).state === 'nein' && P(lena).role === 'ersatz' && P(udo).id === undefined,
    JSON.stringify(j.people));
  ok('Spieltag: Ampel', j.stats && j.stats.yes === 2 && j.stats.no === 1 && j.stats.open === 2 && j.stats.ok && j.stats.playing === 2 && j.stats.reserve === 1 && j.stats.lineupOk, JSON.stringify(j.stats));
  [s, j] = await A(X('dashboard')); const dt = (j.teams || []).find(t => t.id === team);
  const row = id => ((dt && dt.matrix) || []).find(r => r.id === id);
  ok('Übersicht: Mannschaft und Spieltag', s === 200 && dt && dt.games.length === 1 && dt.games[0].id === g1 && dt.games[0].yes === 2, JSON.stringify(dt).slice(0, 300));
  ok('Übersicht: Rückmeldungen in der Matrix', row(max) && row(max).cells[0].s === 'ja' && row(max).cells[0].r === 'spielt' && row(paul).cells[0].s === 'nein' && row(lena).cells[0].r === 'ersatz' && row(gast) && row(gast).open === 1,
    JSON.stringify(dt && dt.matrix));
  ok('Übersicht: Kennzahlen', j.kpi && j.kpi.next14 === 1 && j.kpi.crit === 0 && j.kpi.teams === 1, JSON.stringify(j.kpi));

  // 3. Spieltag löschen: Rückmeldungen, Aufstellung, Aufgaben verschwinden mit (ON DELETE CASCADE)
  let u = await usage();
  ok('Sicherung zählt Modultabellen (inkl. sp_extern)', u.sp_avail === 3 && u.sp_lineup === 3 && u.sp_task === 1 && u.sp_extern === 1 && 'sp_game' in u && 'sp_player' in u && 'sp_team' in u, JSON.stringify(u));
  [s, j] = await A(X(`games/${g1}`), 'DELETE'); ok('Spieltag gelöscht', s === 200);
  [s, j] = await A(X(`games/${g1}`)); ok('Gelöschter Spieltag weg', s === 404);
  u = await usage();
  ok('Rückmeldungen/Aufstellung/Aufgaben mitgelöscht', u.sp_avail === 0 && u.sp_lineup === 0 && u.sp_task === 0 && u.sp_game === 0, JSON.stringify(u));
  [s, j] = await A(X('games'), 'POST', { team_id: team, date: d1, start: '10:00', home: 1, opponent: 'TC Beispielhausen' }); const g2 = j.id;
  [s, j] = await A(X(`games/${g2}`));
  ok('Neuer Spieltag erbt keine alten Einträge', s === 200 && g2 !== g1 && (j.people || []).every(p => !p.state && !p.role) && j.stats.yes === 0 && j.stats.no === 0, JSON.stringify(j.people));

  // 4. Mannschaft mit Spieltagen löschen
  await A(X('games'), 'POST', { team_id: team, date: d2, home: 0, opponent: 'TC Irgendwo' });
  await A(X(`games/${g2}/avail`), 'POST', { member_id: max, state: 'ja' });
  // Gastspieler/innen: wer in einer anderen Mannschaft spielt, bleibt; wer nur hier spielt, geht mit
  [s, j] = await A(X('teams'), 'POST', { name: 'Damen 30', min_players: 2 }); const team2 = j.id;
  [s, j] = await A(X(`teams/${team2}/extern`), 'POST', { name: 'Hanna Hilfe', club: 'TC Nachbarort' }); const hanna = j.id;
  { const [, m] = await A(X('meta')); const cur = (m.teams.find(t => t.id === team) || {}).players || []; await A(X(`teams/${team}/players`), 'PUT', { players: [...cur.map(p => p.id), hanna] }); }
  [s, j] = await A(X(`teams/${team}/delete-info`)); ok('Rückfrage nennt, was mitgeht', s === 200 && j.games === 2 && j.players >= 5 && JSON.stringify(j.guests) === JSON.stringify(['Gast, Gerd']), JSON.stringify(j));
  [s, j] = await A(X(`teams/${team}`), 'DELETE'); ok('Mannschaft mit Spieltagen: ohne Bestätigung 409', s === 409 && /2 Spieltage/.test(j.error), s + ' ' + JSON.stringify(j));
  [s, j] = await A(X('meta')); ok('… Mannschaft noch da', j.teams.some(t => t.id === team));
  [s, j] = await A(X(`teams/${team}`), 'DELETE', { force: true }); ok('Mannschaft mit force gelöscht', s === 200 && JSON.stringify(j.removed) === JSON.stringify(['Gast, Gerd']), JSON.stringify(j));
  [s, j] = await A(X('meta')); ok('Gastspieler/in ohne Mannschaft entfernt, die andere bleibt', !(j.externs || []).some(x => x.id === gast) && (j.externs || []).some(x => x.id === hanna), JSON.stringify(j.externs));
  [s, j] = await A(X(`teams/${team2}/players`), 'PUT', { players: [] }); ok('Nur aus der Meldeliste genommen → bleibt (Wiedereintragen möglich)', s === 200 && !('removed' in j), JSON.stringify(j));
  [s, j] = await A(X('meta')); ok('… noch auswählbar', (j.externs || []).some(x => x.id === hanna));
  [s, j] = await A(X(`teams/${team2}`), 'DELETE', { force: true }); ok('Leere Mannschaft gelöscht → Gastspieler/in ohne Mannschaft entfernt', s === 200 && JSON.stringify(j.removed) === JSON.stringify(['Hilfe, Hanna']), JSON.stringify(j));
  [s, j] = await A(X('meta')); ok('Mannschaft weg', !j.teams.some(t => t.id === team));
  [s, j] = await A(X('games')); ok('Spieltage weg', Array.isArray(j) && j.length === 0, JSON.stringify(j).slice(0, 200));
  u = await usage();
  ok('Spieler, Spieltage, Rückmeldungen weg', u.sp_team === 0 && u.sp_player === 0 && u.sp_game === 0 && u.sp_avail === 0, JSON.stringify(u));
  [s, j] = await A(X('teams/999999'), 'DELETE'); ok('Unbekannte Mannschaft: 404', s === 404);

  // 5. Einstellungen: Protokoll mit deutschen Bezeichnungen, ohne interne Schlüssel
  [s, j] = await A(X('settings'), 'PUT', { remind_days: 10, tasks: true, captain_days: 3 });
  ok('Einstellungen gespeichert', s === 200 && j.settings.remindDays === 10 && j.settings.tasks === true && j.settings.captainDays === 3, JSON.stringify(j));
  [s, j] = await A('api/admin/audit'); const e = (Array.isArray(j) ? j : []).find(x => x.action === 'Spielbetrieb: Einstellungen geändert');
  ok('Protokolleintrag Einstellungen', e && /Spieler erinnern \(Tage vorher\): 7 → 10/.test(e.detail) && /Aufgaben je Spieltag: nein → ja/.test(e.detail) && /Mannschaftsführer warnen \(Tage vorher\): 5 → 3/.test(e.detail), JSON.stringify(e));
  ok('Protokoll ohne interne Schlüssel', e && !/remind_?days|remindDays|captain_?days|captainDays|tasks|ext_spielbetrieb|\{|"/i.test(e.detail), e && e.detail);
  [s, j] = await A(X('settings'), 'PUT', { remind_days: 10 });
  [s, j] = await A('api/admin/audit'); ok('Unveränderte Einstellungen: kein neuer Eintrag', j.filter(x => x.action === 'Spielbetrieb: Einstellungen geändert').length === 1);
  [s, j] = await A('api/admin/audit');
  ok('Protokoll der Mannschaft/Spieltage', ['Mannschaft angelegt', 'Spieler zugeordnet', 'Spieltag angelegt', 'Spieltag gelöscht', 'Mannschaft gelöscht'].every(a => j.some(x => x.action === 'Spielbetrieb: ' + a)), JSON.stringify(j.map(x => x.action)));

  // 6b. echte Modul-Sicherung enthält sp_extern
  [s, j] = await A('api/admin/extensions/spielbetrieb/backup', 'POST', {});
  ok('Modul-Sicherung erstellt', s === 200 && j.file && 'sp_extern' in ((j.usage || {}).rows || {}), JSON.stringify(j).slice(0, 300));
})().catch(e => { console.log('ABBRUCH ' + (e && e.stack || e)); fails++; }).finally(() => { if (srv) srv.kill(); console.log(fails ? `${fails} Fehler` : 'alles ok'); process.exit(fails ? 1 : 0); });
