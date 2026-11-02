'use strict';
/* ---------- Datenqualität (Einstellungen › Datenqualität, planung/betriebssicherheit.md Teil 2) ----------
   Regelmäßige Prüfungen auf Widersprüche in den Daten. Kern und Module tragen bei:
   Hook healthChecks = () => [{ id, title, level: 'r'|'a', count, why, names?, detail?, fix: { label, page, tab?, sec? } }] (auch async).
   Nur aktive Module werden gefragt, je Modul höchstens 3 Sekunden; ein Fehler im Hook wird selbst zum Fund.
   Gespeichert werden nur Ergebnis und Zeitpunkt (Anzahlen, höchstens 5 Namen) – keine Inhalte aus dem Tresor.
   Die Knöpfe führen immer zur Stelle, an der man es selbst behebt; Geld wird nie per Knopf korrigiert. */
const { db, getSetting, setSetting } = require('./db');
const plugins = require('./plugins');

const KEY = 'datenqualitaet';
const str = (v, n) => String(v == null ? '' : v).slice(0, n);

/** Prüfungen des Kerns */
function kern() {
  const out = [];
  if (plugins.isActive('getraenke')) {
    // Verkauf: Kontostände werden aus den Buchungen berechnet – Geld kann nur auf gelöschten Konten „verschwinden“
    const r = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(c), 0) s FROM (SELECT b.member_id, SUM(b.total_cents) c FROM bookings b JOIN members m ON m.id = b.member_id
      WHERE m.deleted = 1 AND b.kind = 'konto' AND b.cancelled_at IS NULL AND b.settled_id IS NULL GROUP BY b.member_id HAVING c != 0)`).get();
    out.push({ id: 'konten', title: 'Gelöschte Konten mit offenem Betrag', level: 'r', count: r.n, detail: r.n ? `${(r.s / 100).toFixed(2).replace('.', ',')} €` : '',
      why: 'Angeschriebenes auf einem gelöschten Konto taucht in keiner Abrechnung mehr auf – das Geld fehlt.', fix: { label: 'Konten öffnen', page: 'konten' } });
  }
  out.push(require('./gobd').healthCheck());   // Prüfkette des Änderungsjournals
  const inv = db.prepare(`SELECT COUNT(*) n FROM member_devices d JOIN members m ON m.id = d.member_id AND m.deleted = 0
    WHERE d.invite_hash IS NOT NULL AND d.token_hash IS NULL AND d.blocked_at IS NULL AND d.invite_expires < ?`).get(Date.now()).n;
  out.push({ id: 'einladungen', title: 'Abgelaufene Einladungen', level: 'a', count: inv,
    why: 'Wer die Einladung nicht rechtzeitig eingelöst hat, kommt nicht in die App bzw. nicht an Tür oder Beregnung.', fix: { label: 'Mitglieder-App öffnen', page: 'app' } });
  return out;
}

const sauber = (c, mod) => ({
  id: `${mod ? mod.id : 'kern'}.${str(c.id, 40)}`, module: mod ? mod.name : '', title: str(c.title, 120), level: c.level === 'r' ? 'r' : 'a',
  count: Math.max(0, parseInt(c.count, 10) || 0), why: str(c.why, 300), detail: str(c.detail, 80),
  names: Array.isArray(c.names) ? c.names.slice(0, 5).map(n => str(n, 80)) : [],
  fix: c.fix && c.fix.page ? { label: str(c.fix.label || 'Öffnen', 60), page: str(c.fix.page, 60), tab: Array.isArray(c.fix.tab) ? c.fix.tab.map(x => str(x, 60)) : undefined, sec: Array.isArray(c.fix.sec) ? c.fix.sec.map(x => str(x, 60)) : undefined } : null,
});

/** Alle Prüfungen laufen lassen und das Ergebnis speichern */
async function pruefen() {
  const list = [];
  try { kern().forEach(c => list.push(sauber(c))); } catch (e) { list.push(sauber({ id: 'fehler', title: 'Prüfung des Kerns fehlgeschlagen', level: 'r', count: 1, why: e.message })); }
  for (const p of plugins.withHook('healthChecks')) {
    const mod = { id: p.meta.id, name: p.meta.name };
    try {
      const r = await Promise.race([Promise.resolve(p.hooks.healthChecks()), new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), 3000))]);
      for (const c of Array.isArray(r) ? r : []) if (c && c.id && c.title) list.push(sauber(c, mod));
    } catch (e) {
      list.push(sauber({ id: 'fehler', title: `Prüfung von „${mod.name}“ fehlgeschlagen`, level: 'r', count: 1, why: `Das Modul antwortet nicht richtig (${str(e.message, 120)}). Automatiken, die von ihm abhängen, laufen womöglich ins Leere.`, fix: { label: 'Module ansehen', page: 'einstellungen', sec: ['cw_setsec', 'module'] } }, mod));
    }
  }
  const res = { at: new Date().toISOString(), list };
  setSetting(KEY, JSON.stringify(res));
  return res;
}

function stand() {
  try { const r = JSON.parse(getSetting(KEY, '')); if (r && Array.isArray(r.list)) return r; } catch (e) { /* noch nie geprüft */ }
  return { at: '', list: [] };
}
const funde = r => r.list.filter(c => c.count > 0);

function routes(admin, { need, rateLimit, asyncRoute }) {
  admin.get('/datenqualitaet', need('einstellungen'), asyncRoute(async (req, res) => { const r = stand(); res.json(r.at ? r : await pruefen()); }));   // noch nie geprüft: gleich prüfen
  admin.post('/datenqualitaet', need('einstellungen'), rateLimit('dq', 20, 10 * 60000), asyncRoute(async (req, res) => res.json(await pruefen())));
}

module.exports = { pruefen, stand, funde, routes };
