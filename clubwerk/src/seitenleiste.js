'use strict';
/* Seitenleiste der Verwaltung anpassen (planung/seitenleiste-anpassen.md, Auftrag 04.11.2026).
   Gespeichert wird eine Einstellung für den ganzen Verein (club_nav):
     { names: { gastro: 'Vereinsheim' }, order: ['sport', 'gastro', …], lists: { gastro: ['lager', 'getraenke'], … } }
   - names: eigene Namen der sechs festen Bereiche (leer = Standardname)
   - order: Reihenfolge der Bereiche
   - lists: Menüeinträge je Bereich in ihrer Reihenfolge; ein Eintrag steht höchstens in einer Liste.
   Einträge ohne Zuordnung bleiben in ihrem Standardbereich (am Ende) – so verschwindet nie etwas, und neue Module erscheinen von selbst.
   Die Oberfläche kennt die Einträge; der Server prüft nur Form und Länge. */
const BEREICHE = ['gastro', 'sport', 'anlage', 'mitglieder', 'finanzen', 'verein'];
const STANDARD = { gastro: 'Gastro', sport: 'Sport', anlage: 'Anlage', mitglieder: 'Mitglieder', finanzen: 'Finanzen', verein: 'Verein' };
const NAME_MAX = 24, EINTRAEGE_MAX = 40;
const KEY_RE = /^[a-z0-9-]{1,40}$/;
const sauber = s => String(s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();

/** Streng: für Eingaben aus der Verwaltung. Wirft einen Fehler mit verständlicher Meldung. */
function pruefen(raw) {
  const b = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  if (!b) throw new Error('Die Angaben zur Seitenleiste fehlen.');
  const out = { names: {}, order: [], lists: {} };
  for (const [k, v] of Object.entries(b.names && typeof b.names === 'object' && !Array.isArray(b.names) ? b.names : {})) {
    if (!BEREICHE.includes(k)) throw new Error('Unbekannter Bereich in den Namen.');
    if (typeof v !== 'string') throw new Error('Ein Bereichsname ist ungültig.');
    const n = sauber(v);
    if ([...n].length > NAME_MAX) throw new Error(`Ein Bereichsname darf höchstens ${NAME_MAX} Zeichen haben.`);
    if (n && n !== STANDARD[k]) out.names[k] = n;
  }
  const ord = Array.isArray(b.order) ? b.order : [];
  for (const k of ord) { if (!BEREICHE.includes(k)) throw new Error('Unbekannter Bereich in der Reihenfolge.'); if (!out.order.includes(k)) out.order.push(k); }
  if (out.order.length) for (const k of BEREICHE) if (!out.order.includes(k)) out.order.push(k);
  const seen = new Set();
  for (const [k, v] of Object.entries(b.lists && typeof b.lists === 'object' && !Array.isArray(b.lists) ? b.lists : {})) {
    if (!BEREICHE.includes(k)) throw new Error('Unbekannter Bereich bei den Menüeinträgen.');
    if (!Array.isArray(v) || v.length > EINTRAEGE_MAX) throw new Error('Die Menüeinträge eines Bereichs sind ungültig.');
    const l = [];
    for (const e of v) { if (typeof e !== 'string' || !KEY_RE.test(e)) throw new Error('Ein Menüeintrag ist ungültig.'); if (!seen.has(e)) { seen.add(e); l.push(e); } }
    if (l.length) out.lists[k] = l;
  }
  return out;
}
/** Nachsichtig: für gespeicherte Werte und Übernahmen – Ungültiges fällt weg, der Rest gilt. */
function lesen(text) {
  let raw = null; try { raw = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { raw = null; }
  if (!raw || typeof raw !== 'object') return { names: {}, order: [], lists: {} };
  const names = {}, lists = {}, seen = new Set();
  for (const [k, v] of Object.entries(raw.names || {})) if (BEREICHE.includes(k) && typeof v === 'string') { const n = sauber(v).slice(0, NAME_MAX); if (n && n !== STANDARD[k]) names[k] = n; }
  let order = (Array.isArray(raw.order) ? raw.order : []).filter((k, i, a) => BEREICHE.includes(k) && a.indexOf(k) === i);
  if (order.length) order = [...order, ...BEREICHE.filter(k => !order.includes(k))];
  for (const [k, v] of Object.entries(raw.lists || {})) {
    if (!BEREICHE.includes(k) || !Array.isArray(v)) continue;
    const l = v.filter(e => typeof e === 'string' && KEY_RE.test(e) && !seen.has(e) && seen.add(e)).slice(0, EINTRAEGE_MAX);
    if (l.length) lists[k] = l;
  }
  return { names, order, lists };
}
const leer = l => !Object.keys(l.names).length && !l.order.length && !Object.keys(l.lists).length;
const name = (l, b) => l.names[b] || STANDARD[b];
const reihenfolge = l => (l.order.length ? l.order : BEREICHE);
const bereichVon = (l, key) => BEREICHE.find(b => (l.lists[b] || []).includes(key)) || null;

/** Protokolltext: Bereichs- und Eintragsnamen, nie interne Schlüssel. labels: { eintragsschlüssel: 'Bezeichnung' } und ausgang: { eintragsschlüssel: bereich } (Bereich vor der Änderung, von der Oberfläche) */
function aenderung(auditDiff, vor, nach, labels = {}, ausgang = {}) {
  const lab = k => sauber((labels && typeof labels[k] === 'string' && labels[k]) || '').slice(0, 60) || 'Eintrag';
  const bn = (l, k) => name(l, k);
  const keys = [...new Set([...Object.values(vor.lists).flat(), ...Object.values(nach.lists).flat()])];
  const L = {}, A = {}, B = {};
  for (const b of BEREICHE) { L['n_' + b] = `Name „${STANDARD[b]}“`; B['n_' + b] = bn(vor, b); A['n_' + b] = bn(nach, b); }
  L.reihenfolge = ['Reihenfolge der Bereiche', 'list']; B.reihenfolge = reihenfolge(vor).map(b => bn(vor, b)); A.reihenfolge = reihenfolge(nach).map(b => bn(nach, b));
  for (const k of keys) {
    const bv = bereichVon(vor, k), bnw = bereichVon(nach, k);
    L['e_' + k] = `„${lab(k)}“ liegt in`; B['e_' + k] = bv ? bn(vor, bv) : BEREICHE.includes(ausgang && ausgang[k]) ? bn(vor, ausgang[k]) : 'Standard'; A['e_' + k] = bnw ? bn(nach, bnw) : 'Standard';
  }
  for (const b of BEREICHE) {
    const sv = (vor.lists[b] || []).filter(k => bereichVon(nach, k) === b), sn = (nach.lists[b] || []).filter(k => bereichVon(vor, k) === b);
    if (JSON.stringify(sv) !== JSON.stringify(sn)) { L['r_' + b] = [`Reihenfolge in „${bn(nach, b)}“`, 'list']; B['r_' + b] = sv.map(lab); A['r_' + b] = sn.map(lab); }
  }
  return auditDiff(L, B, A) || 'Seitenleiste geändert';
}

module.exports = { BEREICHE, STANDARD, NAME_MAX, pruefen, lesen, leer, aenderung };
