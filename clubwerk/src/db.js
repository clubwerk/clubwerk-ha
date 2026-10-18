'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = require('./dbfile')(DATA_DIR);

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 3000');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS members (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'mitglied'
                CHECK (kind IN ('mitglied','mannschaft','verein','gast')),
  pin_hash      TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  failed_pins   INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS articles (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Sonstiges',
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  crate_size  INTEGER NOT NULL DEFAULT 1 CHECK (crate_size >= 1),
  min_stock   INTEGER NOT NULL DEFAULT 0,
  track_stock INTEGER NOT NULL DEFAULT 1,
  active      INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  date        TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 0,
  cash_cents  INTEGER,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  closed_at   TEXT
);

-- kind: konto (Mitglied/Mannschaft, wird berechnet), verein (kostenfrei),
--       gast (bar bezahlt), event (Veranstaltung, bar)
CREATE TABLE IF NOT EXISTS bookings (
  id           INTEGER PRIMARY KEY,
  member_id    INTEGER REFERENCES members(id),
  article_id   INTEGER NOT NULL REFERENCES articles(id),
  event_id     INTEGER REFERENCES events(id),
  kind         TEXT NOT NULL CHECK (kind IN ('konto','verein','gast','event')),
  qty          INTEGER NOT NULL CHECK (qty > 0),
  unit_cents   INTEGER NOT NULL,
  total_cents  INTEGER NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  cancelled_at TEXT,
  cancelled_by TEXT
);
CREATE INDEX IF NOT EXISTS ix_bookings_created ON bookings(created_at);
CREATE INDEX IF NOT EXISTS ix_bookings_member  ON bookings(member_id);

CREATE TABLE IF NOT EXISTS deliveries (
  id          INTEGER PRIMARY KEY,
  date        TEXT NOT NULL,
  supplier    TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id          INTEGER PRIMARY KEY,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  article_id  INTEGER NOT NULL REFERENCES articles(id),
  crates      INTEGER NOT NULL DEFAULT 0,
  bottles     INTEGER NOT NULL DEFAULT 0
);

-- reason: bruch, inventur, korrektur
CREATE TABLE IF NOT EXISTS stock_moves (
  id          INTEGER PRIMARY KEY,
  article_id  INTEGER NOT NULL REFERENCES articles(id),
  qty         INTEGER NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('bruch','inventur','korrektur')),
  date        TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS settlements (
  id          INTEGER PRIMARY KEY,
  until_date  TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`);

/* ---------- Erweiterungen für Belege / Rechnungsimport (idempotent) ---------- */
function addColumn(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addColumn('deliveries', 'doc_no', 'TEXT');

addColumn('deliveries', 'doc_kind', "TEXT NOT NULL DEFAULT 'lieferung'");
addColumn('deliveries', 'file', 'TEXT');
addColumn('deliveries', 'total_cents', 'INTEGER');
addColumn('delivery_items', 'supplier_art_no', 'TEXT');
addColumn('delivery_items', 'supplier_text', 'TEXT');
addColumn('delivery_items', 'cost_cents', 'INTEGER');
db.exec(`
-- Merkt sich, welcher Lieferanten-Artikel zu welchem App-Artikel gehört.
-- article_id NULL = Position ignorieren (z. B. Anfahrtspauschale).
CREATE TABLE IF NOT EXISTS supplier_map (
  supplier    TEXT NOT NULL,
  art_no      TEXT NOT NULL,
  article_id  INTEGER REFERENCES articles(id),
  pack_size   INTEGER NOT NULL DEFAULT 1,
  text        TEXT,
  PRIMARY KEY (supplier, art_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_deliveries_doc ON deliveries(supplier, doc_no) WHERE doc_no IS NOT NULL;
`);

/* ---------- Version 1.1: Benutzer & Rechte, neue Mitglieder, Bestellung, Veranstaltungslisten ---------- */
db.exec(`
-- role: oberadmin (alles + Benutzer + Einstellungen) oder admin (nur freigegebene Bereiche)
CREATE TABLE IF NOT EXISTS admin_users (
  id          INTEGER PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name        TEXT,
  pw_hash     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('oberadmin','admin')),
  perms       TEXT NOT NULL DEFAULT '[]',
  active      INTEGER NOT NULL DEFAULT 1,
  last_login  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
-- Getränke, die es bei einer Veranstaltung gibt (mit eigenem Preis)
CREATE TABLE IF NOT EXISTS event_articles (
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  article_id  INTEGER NOT NULL REFERENCES articles(id),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  PRIMARY KEY (event_id, article_id)
);
`);
addColumn('members', 'pending', 'INTEGER NOT NULL DEFAULT 0');      // 1 = am Tablet angelegt, noch nicht bestätigt
addColumn('members', 'first_name', 'TEXT');                          // aus dem Excel-Import, für die Abtippliste
addColumn('members', 'last_name', 'TEXT');
addColumn('articles', 'target_stock', 'INTEGER NOT NULL DEFAULT 0'); // „bestellen bis“ in Flaschen
addColumn('bookings', 'paid_cash', 'INTEGER');                      // Veranstaltung: 1 bar bezahlt, 0 angeschrieben
addColumn('bookings', 'transferred_at', 'TEXT');                    // angeschrieben → auf normale Liste übertragen
addColumn('bookings', 'transferred_by', 'TEXT');

/* ---------- Version 1.2: Protokoll wichtiger Admin-Aktionen ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY,
  at         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  username   TEXT,
  action     TEXT NOT NULL,
  detail     TEXT
);
CREATE INDEX IF NOT EXISTS ix_audit_at ON audit_log(at);
`);
/* ---------- Version 1.3: Abrechnungsliste je Veranstaltung, freier Betrag ---------- */
db.exec(`
-- Namen auf der Abrechnungsliste einer Veranstaltung (Mitglied verknüpft oder frei eingetragen)
CREATE TABLE IF NOT EXISTS event_guests (
  id          INTEGER PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  member_id   INTEGER REFERENCES members(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  created_by  TEXT
);
CREATE INDEX IF NOT EXISTS ix_guests_event ON event_guests(event_id);
-- „Hat bezahlt“: eine Zahlung deckt alle bis dahin offenen Buchungen eines Namens
CREATE TABLE IF NOT EXISTS event_payments (
  id          INTEGER PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id    INTEGER NOT NULL REFERENCES event_guests(id) ON DELETE CASCADE,
  method      TEXT NOT NULL CHECK (method IN ('bar','karte')),
  cents       INTEGER NOT NULL,
  at          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  by_user     TEXT
);
`);
addColumn('bookings', 'event_guest_id', 'INTEGER REFERENCES event_guests(id)');
addColumn('bookings', 'payment_id', 'INTEGER REFERENCES event_payments(id)');
addColumn('bookings', 'note', 'TEXT');                               // z. B. Text zum freien Betrag
addColumn('articles', 'custom', 'INTEGER NOT NULL DEFAULT 0');      // 1 = „Freier Betrag“ (Systemartikel)
addColumn('articles', 'icon', 'TEXT');     // v2.9: Symbol (Schlüssel aus public/artikel-icons.js)
addColumn('articles', 'image', 'TEXT');    // v2.9: eigenes Bild (Datei in DATA_DIR/artikelbilder)
db.exec('CREATE INDEX IF NOT EXISTS ix_bookings_guest ON bookings(event_guest_id)');

/** Systemartikel für frei eingegebene Beträge (einmalig anlegen). */
function customArticleId() {
  const r = db.prepare('SELECT id FROM articles WHERE custom = 1 ORDER BY id LIMIT 1').get();
  if (r) return r.id;
  return Number(db.prepare(`INSERT INTO articles(name, category, price_cents, crate_size, track_stock, active, sort, custom)
    VALUES ('Freier Betrag', 'Sonstiges', 0, 1, 0, 1, 9999, 1)`).run().lastInsertRowid);
}
customArticleId();

/* Bisherige Veranstaltungsbuchungen (Version 1.1/1.2: bar oder angeschrieben je Buchung) in Listen umwandeln */
(function migrateEventGuests() {
  const done = db.prepare("SELECT value FROM settings WHERE key = 'mig_event_guests'").get();
  if (done) return;
  db.transaction(() => {
    const rows = db.prepare(`SELECT b.event_id, b.member_id, m.name FROM bookings b JOIN members m ON m.id = b.member_id
      WHERE b.event_id IS NOT NULL AND b.event_guest_id IS NULL AND b.member_id IS NOT NULL
        AND (b.kind = 'event' OR b.transferred_at IS NOT NULL) GROUP BY b.event_id, b.member_id`).all();
    for (const r of rows) {
      const gid = Number(db.prepare("INSERT INTO event_guests(event_id, name, member_id, created_by) VALUES (?,?,?, 'Umstellung')")
        .run(r.event_id, r.name, r.member_id).lastInsertRowid);
      db.prepare(`UPDATE bookings SET event_guest_id = ? WHERE event_id = ? AND member_id = ? AND event_guest_id IS NULL
        AND (kind = 'event' OR transferred_at IS NOT NULL)`).run(gid, r.event_id, r.member_id);
      const paid = db.prepare(`SELECT COALESCE(SUM(total_cents),0) c FROM bookings WHERE event_guest_id = ? AND kind = 'event'
        AND paid_cash = 1 AND cancelled_at IS NULL`).get(gid).c;
      if (paid) {
        const pid = Number(db.prepare("INSERT INTO event_payments(event_id, guest_id, method, cents, by_user) VALUES (?,?, 'bar', ?, 'Umstellung')")
          .run(r.event_id, gid, paid).lastInsertRowid);
        db.prepare("UPDATE bookings SET payment_id = ? WHERE event_guest_id = ? AND kind = 'event' AND paid_cash = 1").run(pid, gid);
      }
      db.prepare("UPDATE bookings SET paid_cash = 0 WHERE event_guest_id = ? AND kind = 'event'").run(gid);
    }
    db.prepare("INSERT INTO settings(key, value) VALUES ('mig_event_guests', '1')").run();
  })();
})();

function audit(user, action, detail) {
  try {
    db.prepare('INSERT INTO audit_log(username, action, detail) VALUES (?,?,?)')
      .run(user ? (user.username || String(user)) : null, String(action).slice(0, 60), detail ? String(detail).slice(0, 500) : null);
  } catch (e) { console.error('Protokoll:', e.message); }
}

// Altes Einzel-Passwort (Version 1.0) wird zum Adminkonto „admin“
(function migrateAdmin() {
  const n = db.prepare('SELECT COUNT(*) n FROM admin_users').get().n;
  const old = db.prepare("SELECT value FROM settings WHERE key = 'admin_hash'").get();
  if (!n && old && old.value) {
    db.prepare(`INSERT INTO admin_users(username, name, pw_hash, role) VALUES ('admin', 'Adminkonto', ?, 'oberadmin')`).run(old.value);
    db.prepare("DELETE FROM settings WHERE key = 'admin_hash'").run();
  }
})();

/* v1.6: festes Adminkonto (Benutzername „admin“, Name „Adminkonto“) – nicht umbenennbar, nicht sperr- oder löschbar.
   Weitere Benutzer können dieselben Rechte bekommen (Rolle „alle Rechte“). */
addColumn('admin_users', 'builtin', 'INTEGER NOT NULL DEFAULT 0');

/* v1.7: Gäste-Deckel – Gäste (z. B. gegnerische Mannschaft) schreiben an und zahlen vor der Heimfahrt */
db.exec(`
CREATE TABLE IF NOT EXISTS guest_tabs (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','bezahlt','uebernommen','abgeschrieben')),
  method      TEXT CHECK (method IN ('bar','karte')),
  cents       INTEGER,
  member_id   INTEGER REFERENCES members(id),
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  created_by  TEXT,
  closed_at   TEXT,
  closed_by   TEXT
);
CREATE INDEX IF NOT EXISTS ix_tabs_status ON guest_tabs(status);
`);
addColumn('bookings', 'tab_id', 'INTEGER REFERENCES guest_tabs(id)');
(function migrateBuiltin() {
  if (db.prepare('SELECT 1 FROM admin_users WHERE builtin = 1').get()) return;
  const u = db.prepare("SELECT * FROM admin_users WHERE role = 'oberadmin' ORDER BY active DESC, id LIMIT 1").get();
  if (!u) return;
  const free = !db.prepare("SELECT 1 FROM admin_users WHERE username = 'admin' AND id <> ?").get(u.id);
  db.prepare("UPDATE admin_users SET builtin = 1, active = 1, name = 'Adminkonto', username = CASE WHEN ? THEN 'admin' ELSE username END WHERE id = ?")
    .run(free ? 1 : 0, u.id);
  if (free && u.username !== 'admin') console.log(`Hinweis: Das Konto „${u.username}“ ist jetzt das Adminkonto – Anmeldung ab sofort mit Benutzername „admin“ (Passwort unverändert).`);
})();

/* v3.3: Rollen – benannte Rechte-Sätze (Vorlagen anpassbar). Ein Benutzer hat eine oder mehrere Rollen plus ggf. Einzelrechte.
   Rollen „nur eigene Abteilung(en)“ gelten nur für Mitglieder der Abteilungen, die beim Benutzer eingetragen sind. */
db.exec(`
CREATE TABLE IF NOT EXISTS admin_roles (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT,
  perms       TEXT NOT NULL DEFAULT '[]',
  dept_scope  INTEGER NOT NULL DEFAULT 0,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`);
addColumn('admin_users', 'roles', "TEXT NOT NULL DEFAULT '[]'");
addColumn('admin_users', 'departments', "TEXT NOT NULL DEFAULT '[]'");
addColumn('admin_users', 'member_id', 'INTEGER');
(function seedRoles() {
  if (db.prepare("SELECT value FROM settings WHERE key = 'roles_seeded'").get()) return;
  const ins = db.prepare('INSERT OR IGNORE INTO admin_roles(name, description, perms, dept_scope, sort) VALUES (?,?,?,?,?)');
  const R = [
    ['Vorstand', 'Mitglieder, Anträge, Auswertungen, Dokumente, Veranstaltungen und Helferdienste – ohne Bankdaten und Einzug.', ['mitglieder', 'mitglieder_dokumente', 'export', 'veranstaltungen', 'arbeitseinsatz', 'konten']],
    ['Kassenwart', 'Beitragslauf, Lastschriften, offene Posten, Bankdaten, Verkaufs-Abrechnung und Export.', ['mitglieder', 'mitglieder_bank', 'mitglieder_finanzen', 'mitglieder_dokumente', 'abrechnung', 'uebernahme', 'export', 'konten']],
    ['Abteilungsleitung', 'Nur Mitglieder der eigenen Abteilung(en): Stammdaten ändern, Austritte eintragen, neue Mitglieder anlegen und Anträge mit dieser Abteilung annehmen.', ['mitglieder'], 1],
    ['Thekenteam', 'Verkauf: Lieferungen, Bestand, Bestellung, Buchungen, Artikel und neue Konten bestätigen.', ['lieferungen', 'bestand', 'bestellung', 'buchungen', 'artikel', 'konten', 'veranstaltungen']],
    ['Kassenprüfer', 'Nur ansehen und exportieren.', ['export']],
  ];
  R.forEach(([n, d, p, s], i) => ins.run(n, d, JSON.stringify(p), s ? 1 : 0, i + 1));
  db.prepare("INSERT OR REPLACE INTO settings(key, value) VALUES ('roles_seeded', '1')").run();
})();

/* ---------- Sortierung (überall gleich: Personen nach Nachname, Artikel nach Kategorie und Name) ----------
   de_key: deutsche Sortierung nach DIN 5007 (ä=a, ö=o, ü=u, ß=ss, ohne Groß/Klein)
   name_key: Personen nach Nachname, dann Vorname; „von/van/de …“ zählen nicht (von der Heide → H);
             „Müller, Karl“ wird erkannt; Mannschaften & Sonderkonten nach ihrem ganzen Namen */
const NAME_PARTICLES = new Set(['von', 'van', 'vom', 'zu', 'zum', 'zur', 'de', 'der', 'den', 'la', 'le', 'di', 'da', 'ten', 'op', 'del', 'dos']);
function deKey(v) {
  return String(v == null ? '' : v).toLocaleLowerCase('de').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
function splitPersonName(name) {
  const n = String(name || '').trim().replace(/\s+/g, ' ');
  if (n.includes(',')) { const [l, ...f] = n.split(','); return { first: f.join(',').trim(), last: l.trim() }; }
  const w = n.split(' ');
  if (w.length < 2) return { first: '', last: n };
  let i = w.length - 1;
  while (i > 1 && NAME_PARTICLES.has(w[i - 1].toLowerCase())) i--;
  return { first: w.slice(0, i).join(' '), last: w.slice(i).join(' ') };
}
function nameKey(name, kind) {
  if (kind && kind !== 'mitglied') return deKey(name);
  const { first, last } = splitPersonName(name);
  const core = last.split(' ').filter(x => !NAME_PARTICLES.has(x.toLowerCase())).join(' ') || last;
  return deKey(core) + '\u0001' + deKey(first);
}
db.function('de_key', { deterministic: true }, v => deKey(v));
db.function('name_key', { deterministic: true }, (n, k) => nameKey(n, k));
/* Reihenfolge der Kategorien: in der Verwaltung frei festgelegt (Einstellung „category_order“),
   unbekannte Kategorien folgen alphabetisch dahinter. Innerhalb einer Kategorie bleibt es alphabetisch. */
let catRank = new Map();
function loadCategoryOrder() {
  catRank = new Map();
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'category_order'").get();
    (row ? JSON.parse(row.value) : []).forEach((c, i) => catRank.set(deKey(c), i));
  } catch (e) { /* ungültig → alphabetisch */ }
}
db.function('cat_rank', { deterministic: false }, c => (catRank.has(deKey(c)) ? catRank.get(deKey(c)) : 100000));


/* ---------- v1.14: Löschen (Konten/Artikel/Veranstaltungen mit Vergangenheit verschwinden aus allen Listen,
   ihre alten Buchungen bleiben für Bestand und Abrechnung erhalten) ---------- */
addColumn('members', 'deleted', 'INTEGER NOT NULL DEFAULT 0');
addColumn('articles', 'deleted', 'INTEGER NOT NULL DEFAULT 0');
addColumn('events', 'deleted', 'INTEGER NOT NULL DEFAULT 0');

function getSetting(key, fallback = null) {
  if (!db.open) return fallback;   // beim Beenden schon geschlossen
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, value);
  if (key === 'category_order') loadCategoryOrder();
}

/** Flaschen, die über Lieferungen ins Lager gekommen sind (je Artikel). */
const stockSql = `
SELECT a.id, a.name, a.category, a.crate_size, a.min_stock, a.target_stock, a.track_stock, a.active, a.sort, a.price_cents, a.icon, a.image,
  COALESCE((SELECT SUM(di.crates * a.crate_size + di.bottles) FROM delivery_items di WHERE di.article_id = a.id), 0) AS delivered,
  COALESCE((SELECT SUM(sm.qty) FROM stock_moves sm WHERE sm.article_id = a.id), 0) AS moved,
  COALESCE((SELECT SUM(b.qty) FROM bookings b WHERE b.article_id = a.id AND b.cancelled_at IS NULL), 0) AS booked
FROM articles a
WHERE a.custom = 0 AND a.deleted = 0
ORDER BY cat_rank(a.category), de_key(a.category), de_key(a.name)`;

function stockList() {
  return db.prepare(stockSql).all().map(r => ({ ...r, stock: r.delivered + r.moved - r.booked }));
}

addColumn('members', 'pin_strikes', 'INTEGER NOT NULL DEFAULT 0');   // v1.3.1: wachsende PIN-Sperre
addColumn('members', 'pin_changed_at', 'TEXT');   // v1.5: wann die PIN zuletzt gesetzt/geändert/entfernt wurde
addColumn('members', 'pin_changed_by', 'TEXT');

/* ---------- v1.4: Abrechnung je Mitglied ----------
   Der Kassierer bucht die offenen Beträge in der Vereinsverwaltung ab und markiert dann einzelne oder alle
   Konten als abgerechnet. Jede Markierung ist eine Zeile in member_settlements; die erfassten Buchungen
   tragen deren id in bookings.settled_id. Offen = Konto-Buchung, nicht storniert, settled_id leer. */
db.exec(`
CREATE TABLE IF NOT EXISTS member_settlements (
  id          INTEGER PRIMARY KEY,
  member_id   INTEGER NOT NULL REFERENCES members(id),
  cents       INTEGER NOT NULL,
  items       INTEGER NOT NULL DEFAULT 0,
  until_at    TEXT NOT NULL,
  batch       TEXT,
  note        TEXT,
  by_user     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_msettle_member ON member_settlements(member_id);
`);
addColumn('bookings', 'settled_id', 'INTEGER REFERENCES member_settlements(id)');
addColumn('bookings', 'credit_for', 'INTEGER');   // Gutschrift für eine schon abgerechnete Buchung
db.exec('CREATE INDEX IF NOT EXISTS ix_bookings_open ON bookings(member_id) WHERE settled_id IS NULL');

/* Bisherige Stichtag-Abschlüsse einmalig in die neue Form übernehmen */
(function migrateSettlements() {
  if (db.prepare("SELECT 1 FROM settings WHERE key = 'mig_member_settle'").get()) return;
  db.transaction(() => {
    for (const st of db.prepare('SELECT * FROM settlements ORDER BY until_date, id').all()) {
      const rows = db.prepare(`SELECT member_id, SUM(total_cents) c, SUM(qty) n FROM bookings
        WHERE kind = 'konto' AND cancelled_at IS NULL AND settled_id IS NULL AND member_id IS NOT NULL AND date(created_at) <= ? AND created_at <= ?
        GROUP BY member_id`).all(st.until_date, st.created_at);
      for (const r of rows) {
        const id = Number(db.prepare(`INSERT INTO member_settlements(member_id, cents, items, until_at, batch, note, by_user, created_at)
          VALUES (?,?,?,?,?,?,?,?)`).run(r.member_id, r.c, r.n, st.until_date + ' 23:59:59', 'stichtag-' + st.id,
          'Abschluss bis ' + st.until_date, 'übernommen', st.created_at).lastInsertRowid);
        db.prepare(`UPDATE bookings SET settled_id = ? WHERE member_id = ? AND kind = 'konto' AND cancelled_at IS NULL
          AND settled_id IS NULL AND date(created_at) <= ? AND created_at <= ?`).run(id, r.member_id, st.until_date, st.created_at);
      }
    }
    db.prepare("INSERT INTO settings(key, value) VALUES ('mig_member_settle', '1')").run();
  })();
})();

/** Datum der letzten Gesamtabrechnung (alle Konten) – Startpunkt für Auswertungen. YYYY-MM-DD oder null. */
function lastSettlement() {
  const a = db.prepare('SELECT MAX(until_date) d FROM settlements').get().d;
  const b = db.prepare("SELECT MAX(date(until_at)) d FROM member_settlements WHERE batch LIKE 'alle-%'").get().d;
  return [a, b].filter(Boolean).sort().pop() || null;
}

/* v2.10: Name und Kategorie des Artikels werden mit jeder Buchung gespeichert – der Verlauf zeigt, was damals gebucht wurde,
   auch wenn der Artikel später umbenannt wird. Verknüpft bleibt die Buchung über article_id (Abrechnung, Bestand). */
addColumn('bookings', 'article_name', 'TEXT');
addColumn('bookings', 'article_category', 'TEXT');
db.exec(`CREATE TRIGGER IF NOT EXISTS bookings_snapshot AFTER INSERT ON bookings WHEN NEW.article_name IS NULL BEGIN
  UPDATE bookings SET article_name = (SELECT name FROM articles WHERE id = NEW.article_id),
    article_category = (SELECT category FROM articles WHERE id = NEW.article_id) WHERE id = NEW.id;
END`);
// einmalig: bisherige Buchungen bekommen den heutigen Namen (der damalige ist nicht mehr bekannt)
db.prepare(`UPDATE bookings SET article_name = (SELECT name FROM articles a WHERE a.id = bookings.article_id),
  article_category = (SELECT category FROM articles a WHERE a.id = bookings.article_id) WHERE article_name IS NULL`).run();

/* v2.10: IDs nie doppelt vergeben (alle Tabellen auf AUTOINCREMENT, vorher Sicherung) */
try { require('./ids').ensureAutoincrement(db, DATA_DIR); } catch (e) { console.error('IDs: Umstellung nicht möglich, Daten unverändert –', e.message); }

module.exports = { loadCategoryOrder, deKey, nameKey, splitPersonName, db, DB_FILE, DATA_DIR, getSetting, setSetting, stockList, lastSettlement, audit, customArticleId };
loadCategoryOrder();
