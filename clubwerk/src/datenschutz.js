'use strict';
/* ---------- Datenschutz: Löschfristen, täglicher Löschlauf, Datenschutzhinweis der App, Verzeichnis der Verarbeitungstätigkeiten ----------
   Fristen des Kerns (Protokoll, Anmeldungen, Rundmails) stehen hier; jedes Modul meldet seine über den Hook
   retention = () => [{ id, label, text, unit: 'tage'|'monate', value, def, min, max, due(cut), purge(cut), set(v) }]
   cut ist der erste Tag, der bleibt ('JJJJ-MM-TT'): due zählt, purge löscht alles davor und gibt die Anzahl zurück.
   Ohne purge löscht das Modul selbst (z. B. Mängel, Turniere); die Zeile erscheint dann nur in der Übersicht.
   Das Verzeichnis baut sich aus privacyRecord = () => [{ title, purpose, data, persons }] der Module und den Fristen. */
const { db, getSetting, setSetting, audit, auditDiff } = require('./db');
const { today, addDays, addMonths, nowTs } = require('./util');
const plugins = require('./plugins');

// Protokolleinträge mit IP-Adresse (Anmeldungen, Fehlversuche, Sicherheitswarnungen) haben eine eigene, kürzere Frist
const LOGIN_SQL = "(action LIKE '%Anmeldung%' OR action LIKE 'Buchungsseite%' OR action LIKE 'Erste Einrichtung: falscher%' OR action = 'Sicherheitswarnung' OR action LIKE 'Beregnung: PIN-Eingabe%')";
const RUN_ACTION = 'Datenschutz: Löschlauf';

const keep = (k, def) => { const n = parseInt(getSetting(`ds_keep_${k}`, String(def)), 10); return Number.isFinite(n) ? n : def; };
const core = () => {
  const mailer = require('./mailer');
  const e = (id, label, text, unit, def, min, max, due, purge) => ({ id, label, text, unit, def, min, max, value: keep(id, def), due, purge, set: v => setSetting(`ds_keep_${id}`, String(v)) });
  return [
    e('anmeldungen', 'Anmeldungen und Sicherheitsmeldungen', 'Im Protokoll, mit IP-Adresse. Nur für die Sicherheit nötig.', 'tage', 30, 7, 365,
      cut => db.prepare(`SELECT COUNT(*) n FROM audit_log WHERE ${LOGIN_SQL} AND at < ?`).get(cut).n,
      cut => db.prepare(`DELETE FROM audit_log WHERE ${LOGIN_SQL} AND at < ?`).run(cut).changes),
    e('protokoll', 'Übriges Protokoll', 'Wer wann was geändert hat.', 'monate', 12, 1, 120,
      cut => db.prepare(`SELECT COUNT(*) n FROM audit_log WHERE NOT ${LOGIN_SQL} AND at < ?`).get(cut).n,
      cut => db.prepare(`DELETE FROM audit_log WHERE NOT ${LOGIN_SQL} AND at < ?`).run(cut).changes),
    e('rundmails', 'Gesendete Rundmails', 'Samt Empfängerliste und Anhängen.', 'monate', 12, 6, 120, cut => mailer.oldSent(cut).length, cut => mailer.purgeSent(cut)),
    e('kontoauszug', 'Kontoauszug: „gehört nicht zu Clubwerk“', 'Bankbuchungen, die nicht zum Verein gehören (Name, IBAN, Verwendungszweck). Zugeordnete Zahlungen bleiben als Nachweis.', 'tage', 90, 30, 365,
      cut => require('./kontoauszug').foreignOlder(cut), cut => require('./kontoauszug').purge(cut)),
  ].map(x => ({ ...x, key: `kern.${x.id}`, module: 'Clubwerk' }));
};
const fromModules = () => plugins.withHook('retention').flatMap(p => {
  try { return (p.hooks.retention() || []).map(x => ({ ...x, key: `${p.meta.id}.${x.id}`, module: p.meta.name })); } catch (e) { console.error(`Hook retention (${p.meta.id}):`, e.message); return []; }
});
const all = () => [...core(), ...fromModules()];
const cutOf = x => (x.unit === 'monate' ? addMonths(today(), -x.value) : addDays(today(), -x.value));
const fristText = x => `${x.value} ${x.unit === 'monate' ? (x.value === 1 ? 'Monat' : 'Monate') : (x.value === 1 ? 'Tag' : 'Tage')}`;

/** Löschlauf über alle Fristen. Ins Protokoll kommt eine Zeile mit Anzahl und Frist je Bereich – nie die gelöschten Inhalte. */
function run(user = null) {
  const parts = [];
  for (const x of all()) {
    if (typeof x.purge !== 'function') continue;
    try { const n = x.purge(cutOf(x)) || 0; if (n) parts.push(`${x.label}: ${n} (älter als ${fristText(x)})`); } catch (e) { console.error(`Löschfrist ${x.key}:`, e.message); }
  }
  setSetting('ds_last_run', nowTs());
  setSetting('ds_last_result', parts.join(' · '));
  if (parts.length) audit(user, RUN_ACTION, parts.join(' · '));
  return parts;
}

/** Einmal am Tag (und gleich nach dem Start – auch nach dem Zurückspielen einer Sicherung) */
function start() {
  const tick = () => { try { if (String(getSetting('ds_last_run', '')).slice(0, 10) !== today()) run(); } catch (e) { console.error('Löschlauf:', e.message); } };
  setTimeout(() => { try { run(); } catch (e) { console.error('Löschlauf:', e.message); } }, process.env.CW_TEST_FAST ? 3000 : 20000).unref();
  setInterval(tick, 3600000).unref();
}

const view = x => {
  let due = null; try { due = typeof x.due === 'function' ? x.due(cutOf(x)) : null; } catch (e) { due = null; }
  return { key: x.key, module: x.module, label: x.label, text: x.text || '', unit: x.unit, value: x.value, def: x.def, min: x.min, max: x.max, choices: x.choices || null, due, self: typeof x.purge !== 'function' };
};

/* ---------- Datenschutzhinweis der Mitglieder-App ---------- */
const NOTICE_TEMPLATE = `Datenschutzhinweis für die Mitglieder-App

Verantwortlich: [Name des Vereins, Anschrift, E-Mail]
Datenschutzbeauftragte/r (falls benannt): [Name, E-Mail]

Welche Daten? Name, Mitgliedschaft und was du in der App selbst einträgst oder nutzt (z. B. Platzbuchungen, Helferstunden, Meldungen). Kontakt- und Bankdaten nur, soweit du sie dem Verein gegeben hast.

Wofür? Für die Mitgliederverwaltung und den Vereinsbetrieb (Art. 6 Abs. 1 b DSGVO, Satzung). Freiwillige Angaben nur mit deiner Einwilligung, die du jederzeit widerrufen kannst.

Wo? Die Daten liegen auf dem Server des Vereins im Vereinsheim. Persönliche Daten sind verschlüsselt. Es gibt keine Werbung und keine Weitergabe an Dritte. [Falls genutzt: Tunnel- oder Mail-Anbieter nennen.]

Wie lange? Nur so lange wie nötig. Protokolle werden nach festen Fristen automatisch gelöscht. Nach dem Austritt bleiben nur Daten, die der Verein gesetzlich aufbewahren muss.

Deine Rechte: Auskunft (unter „Meine Daten“ kannst du sie anfordern), Berichtigung, Löschung, Einschränkung, Widerspruch und Beschwerde bei der Datenschutz-Aufsichtsbehörde deines Bundeslandes.`;
const notice = () => ({ text: getSetting('app_privacy_text', ''), at: getSetting('app_privacy_at', '') });

/* ---------- Verzeichnis von Verarbeitungstätigkeiten (Vorlage zum Ergänzen) ---------- */
function registry() {
  const roles = db.prepare('SELECT name, perms FROM admin_roles ORDER BY sort, name').all().map(r => { let p = []; try { p = JSON.parse(r.perms) || []; } catch (e) { /* */ } return { name: r.name, perms: p }; });
  const who = perm => { const want = [].concat(perm || []); const r = roles.filter(x => x.perms.some(q => want.includes(q))).map(x => x.name); return [...r, 'Benutzer mit allen Rechten'].join(', '); };
  const frist = list => list.map(x => `${x.label}: ${fristText(x)}`).join(' · ');
  const ret = all();
  const out = [
    { title: 'Verwaltung und Protokoll', purpose: 'Anmeldung der Vorstandsmitglieder, Nachweis von Änderungen, Schutz vor Missbrauch', data: 'Benutzername, Zeitpunkt, Aktion, IP-Adresse bei Anmeldungen', persons: 'Benutzer der Verwaltung', access: who('einstellungen'), frist: frist(ret.filter(x => x.key === 'kern.anmeldungen' || x.key === 'kern.protokoll')) },
    { title: 'Rundmails', purpose: 'Informationen an Mitglieder', data: 'Name, E-Mail-Adresse, Inhalt und Anhänge', persons: 'Mitglieder und weitere Empfänger', access: who('email'), frist: frist(ret.filter(x => x.key === 'kern.rundmails')) },
  ];
  if (plugins.isActive('getraenke')) out.push({ title: 'Verkauf', purpose: 'Verkauf im Vereinsheim, Abrechnung mit den Mitgliedern', data: 'Name, Buchungen (Artikel, Menge, Betrag, Zeitpunkt), PIN nur als Hash', persons: 'Mitglieder und Gäste mit Konto', access: who(['buchungen', 'abrechnung', 'export', 'konten']), frist: 'Buchungen als Belege 8 Jahre (gesetzlich), nicht automatisch gelöscht' });
  out.push({ title: 'Mitglieder-App', purpose: 'Zugang der Mitglieder zu ihren Daten und Angeboten des Vereins', data: 'Gekoppelte Handys (Gerätename, letzte Nutzung), Push-Abos, Profilfoto (freiwillig)', persons: 'Mitglieder', access: who('app'), frist: 'Bis zum Entkoppeln bzw. Anonymisieren' });
  for (const p of plugins.withHook('privacyRecord')) {
    let recs = []; try { recs = p.hooks.privacyRecord() || []; } catch (e) { recs = []; }
    const mine = ret.filter(x => x.key.startsWith(p.meta.id + '.'));
    for (const r of recs) out.push({ title: r.title || p.meta.name, purpose: r.purpose || '', data: r.data || '', persons: r.persons || '', access: who(p.meta.verwaltung && p.meta.verwaltung.recht), frist: [frist(mine), r.frist].filter(Boolean).join(' · ') || 'Keine automatische Löschung' });
  }
  return { club: getSetting('club_name', ''), street: getSetting('club_street', ''), city: getSetting('club_city', ''), email: getSetting('club_email', ''), created: today(), rows: out };
}

function routes(admin, { need, bad }) {
  const P = need('einstellungen');
  admin.get('/datenschutz', P, (req, res) => {
    const g = k => getSetting(k, '');
    res.json({ rows: all().map(view), lastRun: g('ds_last_run'), lastResult: g('ds_last_result'), notice: notice(), template: NOTICE_TEMPLATE,
      backups: { daily: parseInt(getSetting('backup_daily', '7'), 10) || 7, weekly: parseInt(getSetting('backup_weekly', '4'), 10), monthly: parseInt(getSetting('backup_monthly', '12'), 10) } });
  });
  admin.put('/datenschutz', P, (req, res) => {
    const want = (req.body || {}).keep || {};
    const rows = all(), before = {}, after = {}, labels = {};
    for (const [k, v] of Object.entries(want)) {
      const x = rows.find(y => y.key === k);
      if (!x || typeof x.set !== 'function') return bad(res, 'Unbekannte Frist.');
      const n = parseInt(v, 10);
      if (x.choices && !x.choices.includes(n)) return bad(res, `${x.label}: bitte eine der angebotenen Fristen wählen.`);
      if (!(n >= x.min && n <= x.max)) return bad(res, `${x.label}: bitte eine Frist zwischen ${x.min} und ${x.max} ${x.unit === 'monate' ? 'Monaten' : 'Tagen'}.`);
      before[k] = fristText(x); after[k] = fristText({ ...x, value: n }); labels[k] = x.label;
    }
    try { for (const [k, v] of Object.entries(want)) rows.find(y => y.key === k).set(parseInt(v, 10)); } catch (e) { return bad(res, e.message); }
    const d = auditDiff(labels, before, after);
    if (d) audit(req.user, 'Datenschutz: Löschfristen geändert', d);
    res.json({ ok: true, rows: all().map(view) });
  });
  admin.post('/datenschutz/run', P, (req, res) => { const parts = run(req.user); res.json({ ok: true, parts, rows: all().map(view) }); });
  admin.put('/datenschutz/hinweis', P, (req, res) => {
    const t = String((req.body || {}).text || '').replace(/\r/g, '').trim();
    if (t.length > 8000) return bad(res, 'Der Text ist zu lang (höchstens 8 000 Zeichen).');
    if (t === getSetting('app_privacy_text', '')) return res.json({ ok: true, notice: notice() });
    setSetting('app_privacy_text', t); setSetting('app_privacy_at', t ? nowTs() : '');
    audit(req.user, 'Datenschutz: Hinweis der Mitglieder-App geändert', t ? `${t.length} Zeichen` : 'entfernt');
    res.json({ ok: true, notice: notice() });
  });
  admin.get('/datenschutz/verzeichnis', P, (req, res) => res.json(registry()));
}

module.exports = { routes, run, start, all, notice, RUN_ACTION };
