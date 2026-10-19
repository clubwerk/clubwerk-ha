'use strict';
const path = require('path');
const fs = require('fs');
const { db } = require('./db');

/** Lädt beim allerersten Start Mitglieder und Artikel aus seed/startdaten.json. */
function seedIfEmpty() {
  if (process.env.SEED === 'off') return;
  const hasData = db.prepare('SELECT (SELECT COUNT(*) FROM members) + (SELECT COUNT(*) FROM articles WHERE custom = 0) AS n').get().n;
  if (hasData) return;
  const file = path.join(__dirname, '..', 'seed', 'startdaten.json');
  if (!fs.existsSync(file)) return;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const insM = db.prepare('INSERT INTO members(name, kind) VALUES (?,?)');
  const insA = db.prepare(`INSERT INTO articles(name, category, price_cents, crate_size, track_stock, sort, icon)
    VALUES (?,?,?,?,?,?,?)`);
  const { guess } = require('./articleicons');
  db.transaction(() => {
    (data.members || []).forEach(m => insM.run(m.name, m.kind || 'mitglied'));
    (data.articles || []).forEach(a => insA.run(a.name, a.category, a.price_cents, a.crate_size || 1,
      a.track_stock === 0 ? 0 : 1, a.sort || 100, guess(a.name, a.category)));
  })();
  console.log(`Startdaten geladen: ${(data.members || []).length} Konten, ${(data.articles || []).length} Artikel.`);
}

module.exports = { seedIfEmpty };
