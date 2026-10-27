'use strict';
/* ---------- Einrichtungs-Assistent ----------
   Welche Schritte es gibt und ob sie erledigt sind – der Assistent selbst setzt nur vorhandene Einstellungen (die Verwaltung zeigt dafür
   dieselben Karten wie unter Einstellungen). Kern-Schritte stehen hier, jedes Modul meldet seine eigenen über den Hook
   setupSteps = () => [{ id, title, text, done, page, tab, sec, card }] (auch async; nur aktive Module werden gefragt).
   Stand je Schritt in der Einstellung setup_state: ok (bestätigt mit „Weiter“), skip („Später“), hide (aus der Checkliste genommen).
   Erledigt = Zustand erfüllt (Schritte mit Prüfung, done) bzw. bestätigt (Schritte ohne Prüfung). setup_auto = '1': Assistent öffnet sich nach der Anmeldung von selbst (erster Start). */
const { getSetting, setSetting, audit } = require('./db');
const plugins = require('./plugins');

const arr = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.length <= 80).slice(0, 200) : []);
function state() {
  let s = {}; try { s = JSON.parse(getSetting('setup_state', '{}')) || {}; } catch (e) { s = {}; }
  return { ok: arr(s.ok), skip: arr(s.skip), hide: arr(s.hide) };
}
const save = s => setSetting('setup_state', JSON.stringify({ ok: [...new Set(s.ok)], skip: [...new Set(s.skip)], hide: [...new Set(s.hide)] }));
/** Wurde der Assistent auf dieser Installation schon benutzt? (Nur dann erscheint die Checkliste auf der Übersicht.) */
const used = () => getSetting('setup_state', '') !== '';

const SET = sec => ['cw_setsec', sec];
/** Kern-Schritte; c = Prüfungen aus dem Kern (server.js). before: steht vor den Modul-Schritten. */
const CORE = c => [
  { id: 'willkommen', title: 'Willkommen und Sprache', text: 'In welcher Sprache arbeitet der Verein? Tablet, Mitglieder-App, E-Mails und Dateien folgen der Vereinssprache – jede Person kann für sich eine andere wählen.',
    page: 'einstellungen', sec: SET('verein'), card: ['Vereinssprache'], before: true },
  { id: 'admin', title: 'Admin-Konto', text: 'Dein Konto mit allen Rechten. Passwort vergessen? Dann hilft das Notfallpasswort: in Home Assistant unter Add-on › Konfiguration „notfall_passwort“ setzen und neu starten.',
    page: 'konto', card: ['Mein Passwort'], done: () => true, before: true },
  { id: 'verein', title: 'Verein', text: 'Name, Anschrift, Vereinsfarbe und Logo – sie erscheinen auf Tablet, Mitglieder-App, Rechnungen und E-Mails. Ist die Farbe für Schrift zu hell, gleicht Clubwerk den Kontrast selbst aus.',
    page: 'einstellungen', sec: SET('verein'), card: ['Verein', 'Vereinslogo'], before: true },
  { id: 'tablet', title: 'Wie nutzt ihr Clubwerk?', text: 'Mit einem Tablet im Vereinsheim oder nur mit Verwaltung und Mitglieder-App? Mit Tablet legst du gleich das Passwort fest, mit dem jedes Tablet einmal freigeschaltet wird.',
    page: 'einstellungen', sec: SET('tablet'), card: ['Tablet im Vereinsheim'], done: () => !c.tabletOn() || c.tabletPw(), before: true },
  { id: 'module', title: 'Module wählen', text: 'Was soll Clubwerk für euch erledigen? Jedes Modul lässt sich einzeln nutzen und später unter Einstellungen › Module ein- und ausschalten.',
    page: 'einrichtung', before: true },
  { id: 'sicherheit', title: 'Sicherheit', text: 'Persönliche Daten verschlüsseln und ein Passwort für die Komplettsicherung festlegen. Wiederherstellungscode und Passwort sicher aufbewahren – am besten ausgedruckt im Vereinsordner.',
    page: 'sicherung', card: ['Verschlüsselung der persönlichen Daten', 'Sicherungspasswort'], done: () => c.vaultOn() && c.backupKey(), before: true },
  { id: 'postfach', title: 'Postfach', text: 'Damit Clubwerk E-Mails verschicken kann – Rechnungen, Bestellungen, Einladungen. Nach dem Speichern eine Testmail an dich selbst schicken.',
    page: 'einstellungen', sec: SET('mail'), card: ['Postfach'], done: () => c.mailReady(), before: true },
  // Verkauf ist ins Programm eingebaut (kein eigener Hook) – sein Schritt steht wie ein Modul-Schritt bei den Modulen
  { id: 'getraenke.artikel', title: 'Artikel und Preise', text: 'Was am Tablet verkauft wird – Getränke, Speisen, Vereinsartikel – mit Preisen. Eine Grundliste ist schon angelegt: anpassen, ergänzen, löschen.',
    page: 'artikel', card: [], module: 'getraenke', moduleName: 'Verkauf', when: () => plugins.isActive('getraenke') },
  { id: 'app', title: 'Mitglieder-App', text: 'Unter welcher Adresse die Mitglieder die App im Vereins-WLAN erreichen – und, wenn ihr wollt, von unterwegs über einen Tunnel.',
    page: 'app', sec: ['cw_appsec', 'einstellungen'], card: ['Adresse & Aussehen'], done: () => Boolean(getSetting('app_url', '')), when: () => c.appModules() },
  { id: 'netz', title: 'Vereinsnetz', text: 'Welche Netze als Vereinsheim gelten. Dann kommen Gast-WLAN oder VPN nicht an Verwaltung und Tablet, und Türen oder Beregnung bleiben im Verein.',
    page: 'einstellungen', sec: SET('erreichbar'), card: ['Vereinsnetz'], done: () => c.clubNets() },
  { id: 'sicherung', title: 'Sicherungen', text: 'Wohin die nächtliche Komplettsicherung zusätzlich geht (NAS, Dropbox, Cloud) – und gleich die erste Sicherung anlegen.',
    page: 'sicherung', card: ['Sicherungsziele', 'Jetzt'], done: () => c.backupDone() },
];

/** Alle Schritte mit Zustand: Kern vor den Modulen, Module in fester Reihenfolge, danach App, Netz, Sicherungen */
async function steps(c) {
  const st = state();
  const core = CORE(c).filter(s => !s.when || s.when());
  const mods = [];
  for (const p of plugins.withHook('setupSteps').sort((a, b) => plugins.orderPos(a.meta.id) - plugins.orderPos(b.meta.id))) {
    let list = [];
    try { list = await Promise.race([Promise.resolve(p.hooks.setupSteps()), new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), 3000))]); }
    catch (e) { console.error(`Einrichtung (${p.meta.id}):`, e.message); continue; }
    for (const s of Array.isArray(list) ? list : []) {
      if (!s || !/^[a-z0-9-]{1,40}$/.test(String(s.id || '')) || !s.title || !s.page) continue;
      mods.push({ ...s, id: `${p.meta.id}.${s.id}`, module: p.meta.id, moduleName: p.meta.name, done: s.done === undefined ? undefined : Boolean(s.done) });
    }
  }
  const all = [...core.filter(s => s.before), ...core.filter(s => s.module), ...mods, ...core.filter(s => !s.before && !s.module)];
  return all.map(s => {
    const check = s.done !== undefined;   // mit Prüfung: erledigt nur, wenn der Zustand stimmt – sonst genügt „Weiter“
    const done = check ? Boolean(typeof s.done === 'function' ? s.done() : s.done) : st.ok.includes(s.id);
    return { id: s.id, title: s.title, text: s.text || '', module: s.module || null, moduleName: s.moduleName || null, check,
      page: s.page, tab: Array.isArray(s.tab) ? s.tab.map(String) : undefined, sec: Array.isArray(s.sec) ? s.sec.map(String) : undefined,
      card: (Array.isArray(s.card) ? s.card : s.card ? [s.card] : []).map(String),
      done, skipped: !done && st.skip.includes(s.id), hidden: st.hide.includes(s.id) };
  });
}
function summary(list) {
  const rel = list.filter(s => !s.hidden), done = rel.filter(s => s.done).length;
  return { percent: rel.length ? Math.round(done / rel.length * 100) : 100, open: rel.length - done };
}

function routes(admin, { need, bad, checks }) {
  admin.get('/einrichtung', need('einstellungen'), (req, res, next) => steps(checks).then(list => res.json({ steps: list, ...summary(list), used: used(), auto: getSetting('setup_auto', '') === '1' })).catch(next));
  /* Stand eines Schritts: weiter (bestätigt; mit Prüfung und noch nicht erfüllt = wie „Später“), skip („Später“),
     hide (aus der Checkliste nehmen), show (wieder zeigen) */
  admin.put('/einrichtung/:id', need('einstellungen'), (req, res, next) => steps(checks).then(list => {
    const s = list.find(x => x.id === String(req.params.id)), act = String((req.body || {}).action || '');
    if (!s) return bad(res, 'Diesen Schritt gibt es nicht (mehr).', 404);
    if (!['weiter', 'skip', 'hide', 'show'].includes(act)) return bad(res, 'Unbekannte Aktion.');
    const st = state(), drop = (k, id) => { st[k] = st[k].filter(x => x !== id); };
    if (act === 'weiter' && !s.check) st.ok.push(s.id);
    if (act === 'weiter' && (!s.check || s.done)) drop('skip', s.id);
    if (act === 'skip' || (act === 'weiter' && s.check && !s.done)) st.skip.push(s.id);
    if (act === 'hide') { st.hide.push(s.id); audit(req.user, 'Einrichtung: Punkt ausgeblendet', s.title); }
    if (act === 'show') { drop('hide', s.id); drop('skip', s.id); audit(req.user, 'Einrichtung: Punkt wieder gezeigt', s.title); }
    save(st);
    return steps(checks).then(l2 => res.json({ ok: true, steps: l2, ...summary(l2) }));
  }).catch(next));
  /* Assistent beenden: öffnet sich nach der Anmeldung nicht mehr von selbst (Menüpunkt und Checkliste bleiben) */
  admin.put('/einrichtung', need('einstellungen'), (req, res) => {
    if ((req.body || {}).auto === false && getSetting('setup_auto', '') === '1') setSetting('setup_auto', '0');
    if (!used()) save(state());
    res.json({ ok: true });
  });
}

/** Erster Start über den Assistenten: Stand anlegen und den Assistenten nach der Anmeldung öffnen */
function begin() { save({ ok: ['willkommen'], skip: [], hide: [] }); setSetting('setup_auto', '1'); }

module.exports = { routes, steps, summary, begin, used };
