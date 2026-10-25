'use strict';
/**
 * Ähnliche Namen erkennen (Import-Abgleich): Spitznamen (Benni ↔ Benedikt, Susi ↔ Susanne), Kurzformen (Alex ↔ Alexander),
 * Schreibvarianten (Stefan ↔ Stephan, Müller ↔ Mueller, Meier ↔ Mayer) und kleine Tippfehler.
 */

// Gruppen gleichwertiger Vornamen – ein Spitzname kann zu mehreren Gruppen gehören (Benni: Benedikt oder Benjamin)
const GROUPS = require('./spitznamen.json');   // eine Zeile je Name mit seinen Spitznamen/Kurzformen
const NICK = new Map();
for (const g of GROUPS) { const names = g.split(' '); for (const n of names) { const k = norm(n); if (!NICK.has(k)) NICK.set(k, new Set()); names.forEach(x => NICK.get(k).add(norm(x))); } }

/** vergleichbare Form: klein, ohne Akzente/Umlaute, ph→f, th→t, y→i, ck→k, doppelte Buchstaben einfach */
function norm(v) {
  return String(v || '').toLowerCase().trim()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ph/g, 'f').replace(/th/g, 't').replace(/ck/g, 'k').replace(/y/g, 'i').replace(/ei|ai|ey|ay/g, 'ai').replace(/dt\b/g, 't').replace(/tz/g, 'z')
    .replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
}
function dist(a, b) {   // Levenshtein
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/** Vornamen ähnlich? → Grund oder null */
function firstSimilar(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return null;
  if (x === y) return String(a).trim().toLowerCase() === String(b).trim().toLowerCase() ? 'gleicher Name' : 'ähnlich geschrieben';
  if ((NICK.get(x) && NICK.get(x).has(y)) || (NICK.get(y) && NICK.get(y).has(x))) return 'Spitzname';
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  if (s.length >= 3 && l.startsWith(s)) return 'Kurzform';                 // Alex – Alexander, Susann – Susanne
  if (s.length >= 4 && dist(x, y) <= 1) return 'ähnlich geschrieben';     // Tippfehler
  return null;
}
/** Nachnamen ähnlich? (gleich nach Schreibweise, sonst höchstens ein Buchstabe Unterschied) */
function lastSimilar(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 5 && dist(x, y) <= 1);
}

module.exports = { norm, dist, firstSimilar, lastSimilar };
