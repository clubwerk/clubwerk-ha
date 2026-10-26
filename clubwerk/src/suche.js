'use strict';
/**
 * Suche nach Datensätzen (Strg/⌘ K in der Verwaltung, ab 3.61)
 *
 * Neben Seiten, Reitern und Einstellungen (sucht der Browser selbst) findet die Suche Datensätze: Mitglieder, Konten, Artikel,
 * Rechnungen, Firmen, Dienstpläne, Spieltage … Der Kern sucht Konten und Artikel, jedes Modul meldet seine Suche über
 * hooks.search an. Gefragt werden nur Module, deren Recht (erweiterung.json › verwaltung.recht) der Benutzer hat; das Modul
 * schränkt selbst weiter ein (z. B. Abteilungsleitung → nur Mitglieder der eigenen Abteilungen).
 *
 *   hooks.search(s) → [{ group: 'Rechnungen', art: 'rechnung', page: 'bh-rechnungen', detail: false, hits: s.pick(rows, r => [r.no, r.recipient]).map(…) }]
 *   s = { q, toks, user, locked, limit, where(...spalten), pick(rows, texte, tie) } – locked: Tresor gesperrt, Personen gar nicht erst suchen
 *   Treffer: { id, label, sub: ['kurze Zuordnung', …], person: true|false, score, ref } – ref (optional) bekommt der Sprung in der Verwaltung mit (GK.registerHit)
 *
 * Treffer zeigen nur Namen und eine kurze Zuordnung – nie Bankdaten, PINs oder Beträge. Ist der Tresor gesperrt, fallen alle
 * Personen-Treffer weg (die Antwort sagt locked: true, die Verwaltung zeigt einen Hinweis). Suchbegriffe landen nie im Protokoll.
 */
const { db, deKey, isPerson, lastFirst } = require('./db');

const LIMIT = 5, MAX_Q = 60;

/** Hilfen für die Module: Vorauswahl in SQL und Rangfolge in JS */
function helpers(q, user, locked) {
  const toks = deKey(q).split(/[^a-z0-9]+/).filter(Boolean);
  const longest = [...toks].sort((a, b) => b.length - a.length)[0] || '';
  return {
    q, toks, user, locked, limit: LIMIT,
    /** where('m.name', 'p.member_no') → { sql, args } – grobe Vorauswahl: das längste Suchwort steckt in einer der Spalten (ohne Groß/Klein und Umlaute) */
    where: (...cols) => ({ sql: '(' + cols.map(c => `instr(de_key(${c}),?)`).join('+') + '>0)', args: cols.map(() => longest) }),
    /** Zeilen bewerten: texte(zeile) → [Name, weitere Suchfelder …]. Jedes Suchwort muss passen; Wortanfang im Namen zählt am meisten.
     *  Bei gleicher Bewertung entscheidet tie(a, b) (z. B. kommende Spieltage zuerst), sonst der Name. */
    pick: (rows, texts, tie) => rows.map(r => {
      const [label, ...extra] = texts(r).map(deKey);
      const words = label.split(/[^a-z0-9]+/), more = extra.join(' ');
      let score = 0;
      for (const t of toks) {
        const s = words.some(w => w.startsWith(t)) ? 3 : label.includes(t) ? 2 : more.includes(t) ? 1 : 0;
        if (!s) return null;
        score += s;
      }
      return { r, score: score + (label.startsWith(toks.join(' ')) ? 2 : 0), key: label };
    }).filter(Boolean).sort((a, b) => b.score - a.score || (tie ? tie(a.r, b.r) : 0) || a.key.localeCompare(b.key, 'de')).slice(0, LIMIT).map(x => ({ ...x.r, _score: x.score })),
  };
}

const KIND = { mitglied: 'Mitglied', nichtmitglied: 'Kein Mitglied', mannschaft: 'Mannschaft', verein: 'Sonderkonto', gast: 'Sonderkonto' };

/** Suchen des Kerns: Konten (Verkauf am Tablet) und Artikel */
function coreGroups(s) {
  const out = [], has = p => s.user.perms.includes(p);
  if (has('konten')) {
    const w = s.where('name');
    const rows = db.prepare(`SELECT id, name, kind, active, pending FROM members WHERE deleted = 0 AND kind != 'extern' AND ${w.sql}`).all(...w.args).filter(r => !(s.locked && isPerson(r.kind)));
    out.push({ group: 'Konten', art: 'konto', page: 'konten', hits: s.pick(rows, r => [lastFirst(r.name, r.kind)]).map(r => ({
      id: r.id, label: lastFirst(r.name, r.kind), person: isPerson(r.kind), score: r._score, ref: r.active || r.pending ? '' : 'aus',
      sub: [KIND[r.kind] || '', r.pending ? 'neu am Tablet' : !r.active ? 'ausgeblendet' : ''] })) });
  }
  if (has('artikel')) {
    const w = s.where('name', 'category');
    const rows = db.prepare(`SELECT id, name, category, active FROM articles WHERE ${w.sql}`).all(...w.args);
    out.push({ group: 'Artikel', art: 'artikel', page: 'artikel', hits: s.pick(rows, r => [r.name, r.category]).map(r => ({
      id: r.id, label: r.name, person: false, score: r._score, sub: [r.category, r.active ? '' : 'ausgeblendet'] })) });
  }
  return out;
}

/** Anfrage der Verwaltung: { groups: [{ group, art, page, detail, hits: [{ id, label, sub }] }], locked } */
function run(user, raw) {
  const { T } = require('./i18n'), plugins = require('./plugins'), vault = require('./vault');
  const q = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().slice(0, MAX_Q);
  const locked = vault.locked(), s = helpers(q, user, locked);
  if (q.length < 2 || !s.toks.length) return { groups: [], locked: false };
  const groups = coreGroups(s);
  for (const p of plugins.withHook('search')) {
    const perm = p.meta.verwaltung && p.meta.verwaltung.recht;
    if (!perm || !user.perms.includes(perm)) continue;   // nur Module, deren Recht der Benutzer hat
    try { groups.push(...(p.hooks.search(s) || [])); } catch (e) { console.error(`Suche (${p.meta.id}):`, e.message); }
  }
  const order = ['Mitglieder', 'Konten', 'Artikel', 'Rechnungen', 'Firmen & Sponsoren', 'Dienstpläne', 'Spieltage'];
  const pos = g => (order.includes(g) ? order.indexOf(g) : order.length);
  return {
    locked,
    groups: groups.map(g => ({ ...g, hits: (g.hits || []).filter(h => h && h.label && !(locked && h.person)).slice(0, LIMIT) }))
      .filter(g => g.hits.length && /^[a-z0-9-]+$/.test(g.art || '') && g.page)
      .map(g => ({ g, best: Math.max(...g.hits.map(h => h.score || 0)) }))
      .sort((a, b) => b.best - a.best || pos(a.g.group) - pos(b.g.group)).map(({ g }) => ({
        group: T(g.group), art: g.art, page: g.page, detail: Boolean(g.detail),
        hits: g.hits.map(h => ({ id: h.id, ref: h.ref ? String(h.ref) : undefined, label: String(h.label), sub: (h.sub || []).filter(Boolean).map(x => T(String(x))).join(' · ') })),
      })),
  };
}

module.exports = { run };
