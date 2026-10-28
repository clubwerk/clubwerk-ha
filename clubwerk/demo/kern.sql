-- Clubwerk Demo-Daten (erfunden): Kern. Bearbeiten: siehe werkzeuge/demo/aufteilen.js
-- Stichtag: 2026-10-21
BEGIN;
CREATE TABLE IF NOT EXISTS "admin_roles" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT,
  perms       TEXT NOT NULL DEFAULT '[]',
  dept_scope  INTEGER NOT NULL DEFAULT 0,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS "admin_users" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name        TEXT,
  pw_hash     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('oberadmin','admin')),
  perms       TEXT NOT NULL DEFAULT '[]',
  active      INTEGER NOT NULL DEFAULT 1,
  last_login  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, builtin INTEGER NOT NULL DEFAULT 0, roles TEXT NOT NULL DEFAULT '[]', departments TEXT NOT NULL DEFAULT '[]', member_id INTEGER);
CREATE TABLE IF NOT EXISTS app_forme_seen (   -- „Für mich“: quittierte Neuigkeiten (Bereich:Kennung) je Mitglied
  member_id INTEGER NOT NULL REFERENCES members(id),
  key       TEXT NOT NULL,
  at        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (member_id, key)
);
CREATE TABLE IF NOT EXISTS "audit_log" (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  username   TEXT,
  action     TEXT NOT NULL,
  detail     TEXT
);
CREATE TABLE IF NOT EXISTS "bank_accounts" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, holder TEXT, iban TEXT NOT NULL, bic TEXT, bank TEXT,
  departments TEXT NOT NULL DEFAULT '[]', is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS languages (
    code TEXT PRIMARY KEY, name TEXT NOT NULL, locale TEXT, dir TEXT NOT NULL DEFAULT 'ltr', strings TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS mail_list (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, spec TEXT NOT NULL DEFAULT '{}', updated_by TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS mail_message (
  id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL DEFAULT '', html TEXT NOT NULL DEFAULT '',
  spec TEXT NOT NULL DEFAULT '{}',                 -- Empfänger: { groups:[{t,v}], members:[id], addresses:[…], lists:[id], payer:1 }
  files TEXT NOT NULL DEFAULT '[]',                -- [{ id, name, size, type }]
  status TEXT NOT NULL DEFAULT 'entwurf',          -- entwurf | sendet | gesendet | teilweise
  copy_me INTEGER NOT NULL DEFAULT 1,
  from_name TEXT, reply_to TEXT, signature_html TEXT,
  user_id INTEGER, user_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), updated_at TEXT, sent_at TEXT,
  total INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0
, channels TEXT NOT NULL DEFAULT '["mail"]', keep_months INTEGER, expires_at TEXT, pinned INTEGER NOT NULL DEFAULT 0, app_stats TEXT);
CREATE TABLE IF NOT EXISTS mail_recipient (
  id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL REFERENCES mail_message(id) ON DELETE CASCADE,
  member_id INTEGER, name TEXT, email TEXT NOT NULL, via TEXT,
  status TEXT NOT NULL DEFAULT 'wartet', error TEXT, sent_at TEXT
);
CREATE TABLE IF NOT EXISTS mail_template (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '', html TEXT NOT NULL DEFAULT '', updated_by TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS member_access (
  member_id   INTEGER NOT NULL REFERENCES members(id),
  module      TEXT NOT NULL,
  profile     TEXT,                    -- z. B. Zeitprofil beim Zugang
  valid_until TEXT,                    -- JJJJ-MM-TT einschließlich, NULL = unbegrenzt
  blocked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')), away INTEGER NOT NULL DEFAULT 0, flags TEXT,
  PRIMARY KEY (member_id, module)
);
CREATE TABLE IF NOT EXISTS "member_devices" (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  scope          TEXT NOT NULL,                 -- z. B. 'beregnung', 'zugang'
  member_id      INTEGER NOT NULL REFERENCES members(id),
  invite_hash    TEXT,                          -- sha256 der Einladung (bis eingelöst)
  invite_expires INTEGER,                       -- ms
  token_hash     TEXT,                          -- sha256 des Geräteschlüssels (nach Kopplung)
  pin_hash       TEXT,
  device         TEXT,                          -- Gerätebeschreibung aus dem Browser
  created_by     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  paired_at      TEXT,
  last_used      TEXT,
  failed         INTEGER NOT NULL DEFAULT 0,
  locked_until   INTEGER
, failed_total INTEGER NOT NULL DEFAULT 0, blocked_at TEXT, issuer_perms TEXT, transfer_hash TEXT, transfer_expires INTEGER, paired_host TEXT, token2_hash TEXT, handover_hash TEXT, handover_expires INTEGER, invite_kind TEXT, used_hash TEXT, used_at TEXT, used_alerted INTEGER NOT NULL DEFAULT 0, remote INTEGER NOT NULL DEFAULT 0, verified TEXT, otp_hash TEXT, otp_expires INTEGER, otp_tries INTEGER NOT NULL DEFAULT 0, otp_day TEXT, otp_count INTEGER NOT NULL DEFAULT 0, otp_last INTEGER, pin_synced INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS "members" (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'mitglied'
                CHECK (kind IN ('mitglied','mannschaft','verein','gast','extern','nichtmitglied')),
  pin_hash      TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  failed_pins   INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, pending INTEGER NOT NULL DEFAULT 0, first_name TEXT, last_name TEXT, deleted INTEGER NOT NULL DEFAULT 0, pin_strikes INTEGER NOT NULL DEFAULT 0, pin_changed_at TEXT, pin_changed_by TEXT, photo TEXT, photo_use TEXT NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS msg_inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL REFERENCES mail_message(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id), read_at TEXT, push TEXT,
  UNIQUE(message_id, member_id)
);
CREATE TABLE IF NOT EXISTS "mv_dunning" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES members(id), date TEXT NOT NULL, level INTEGER NOT NULL, title TEXT NOT NULL,
  cents INTEGER NOT NULL, fee_cents INTEGER NOT NULL DEFAULT 0, fee_id INTEGER, ref TEXT, charges TEXT NOT NULL,
  via TEXT NOT NULL, by_user TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS "push_log" (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  member_id INTEGER,
  event     TEXT NOT NULL,
  title     TEXT,
  ok        INTEGER NOT NULL,
  info      TEXT
);
CREATE TABLE IF NOT EXISTS "push_subs" (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id  INTEGER NOT NULL,
  device_id  INTEGER,                              -- member_devices.id (Handy), für Aufräumen bei Entkopplung
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  events     TEXT,                                 -- JSON { "<modul>.<id>": false } – nur Abweichungen von „an“
  label      TEXT,                                 -- Gerätebeschreibung
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  last_ok    TEXT,
  fails      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS vault_mail (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  data       TEXT NOT NULL,            -- verschlüsselte Mail (p1/e1), wartet auf das Entsperren
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  tries      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS vault_wrap (
  user_id    INTEGER PRIMARY KEY,      -- admin_users.id; 0 = Wiederherstellungscode
  salt       TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_audit_at ON audit_log(at);
CREATE INDEX IF NOT EXISTS ix_devices_scope ON member_devices(scope, member_id);
CREATE INDEX IF NOT EXISTS ix_devices_token ON member_devices(scope, token_hash);
CREATE INDEX IF NOT EXISTS ix_devices_token2 ON member_devices(scope, token2_hash);
CREATE INDEX IF NOT EXISTS ix_inbox_member ON msg_inbox(member_id, message_id);
CREATE INDEX IF NOT EXISTS ix_mailrcpt_msg ON mail_recipient(message_id);
CREATE INDEX IF NOT EXISTS ix_mvd_member ON mv_dunning(member_id);
CREATE INDEX IF NOT EXISTS ix_push_member ON push_subs(member_id);
INSERT INTO "admin_roles"(id, name, description, perms, dept_scope, sort, created_at) VALUES(1,'Vorstand','Mitglieder, Anträge, Auswertungen, Dokumente, E-Mail, Veranstaltungen und Helferdienste – ohne Bankdaten und Einzug.','["mitglieder","mitglieder_dokumente","export","veranstaltungen","arbeitseinsatz","konten","email","app"]',0,1,'2026-02-13 14:52:50');
INSERT INTO "admin_roles"(id, name, description, perms, dept_scope, sort, created_at) VALUES(2,'Kassenwart','Beitragslauf, Lastschriften, offene Posten, Bankdaten, Verkaufs-Abrechnung und Export.','["mitglieder","mitglieder_bank","mitglieder_finanzen","mitglieder_dokumente","abrechnung","uebernahme","export","konten","app"]',0,2,'2026-02-13 14:52:50');
INSERT INTO "admin_roles"(id, name, description, perms, dept_scope, sort, created_at) VALUES(3,'Abteilungsleitung','Nur Mitglieder der eigenen Abteilung(en): Stammdaten ändern, Austritte eintragen, neue Mitglieder anlegen und Anträge mit dieser Abteilung annehmen.','["mitglieder"]',1,3,'2026-02-13 14:52:50');
INSERT INTO "admin_roles"(id, name, description, perms, dept_scope, sort, created_at) VALUES(4,'Thekenteam','Verkauf: Lieferungen, Bestand, Bestellung, Buchungen, Artikel und neue Konten bestätigen.','["lieferungen","bestand","bestellung","buchungen","artikel","konten","veranstaltungen","app"]',0,4,'2026-02-13 14:52:50');
INSERT INTO "admin_roles"(id, name, description, perms, dept_scope, sort, created_at) VALUES(5,'Kassenprüfer','Nur ansehen und exportieren.','["export"]',0,5,'2026-02-13 14:52:50');
INSERT INTO "admin_users"(id, username, name, pw_hash, role, perms, active, last_login, created_at, builtin, roles, departments, member_id) VALUES(1,'admin','Adminkonto','761a7324f3ec5b86700ce1c928b2eaee:d61cfe0884cf2fec5c979c91be90f88b8106985dcdf05b90785b2cb641c49b49','oberadmin','[]',1,'2026-10-21 14:55:37','2026-02-13 14:52:50',1,'[]','[]',NULL);
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1,'2026-02-13 14:52:50','admin','Adminkonto eingerichtet',NULL);
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(3,'2026-02-13 14:52:50','admin','Konto angelegt','Felix Adler (mitglied)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(4,'2026-02-13 14:52:50','admin','Konto angelegt','Anna Becker (mitglied)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(5,'2026-02-13 14:52:50','admin','Konto angelegt','Jonas Schmitt (mitglied)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(6,'2026-02-13 14:52:50','admin','Konto angelegt','Lea Wagner (mitglied)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(7,'2026-02-13 14:52:50','admin','Konto angelegt','Peter Hofmann (mitglied)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(8,'2026-02-13 14:52:50','admin','Konto angelegt','Sabine Klein (mitglied)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(9,'2026-02-13 14:52:50','admin','Konto angelegt','Markus Weber (mitglied)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(10,'2026-02-13 14:52:50','admin','Konto angelegt','Julia Fischer (mitglied)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(11,'2026-02-13 14:52:50','admin','Konto angelegt','Tobias Neumann (mitglied)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(12,'2026-02-13 14:52:50','admin','Konto angelegt','Laura Schulz (mitglied)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(13,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Felix Adler: 1 × Bier 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(14,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Anna Becker: 2 × Bier alkoholfrei 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(15,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Jonas Schmitt: 3 × Pils 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(16,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Lea Wagner: 1 × Radler 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(17,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Peter Hofmann: 2 × Kaffee am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(18,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Sabine Klein: 3 × Chips am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(19,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Markus Weber: 1 × Süßes am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(20,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Julia Fischer: 2 × Apfelschorle 0,5 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(21,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Tobias Neumann: 3 × Cola 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(22,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Laura Schulz: 1 × Cola Zero 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(23,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Felix Adler: 2 × Limonade 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(24,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Anna Becker: 3 × Wasser 0,7 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(25,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Weizen 0,5 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(26,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Lea Wagner: 2 × Weizen alkoholfrei 0,5 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(27,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Peter Hofmann: 3 × Bier 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(28,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Sabine Klein: 1 × Bier alkoholfrei 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(29,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Markus Weber: 2 × Pils 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(30,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Julia Fischer: 3 × Radler 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(31,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Tobias Neumann: 1 × Kaffee am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(32,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Laura Schulz: 2 × Chips am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(33,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Felix Adler: 3 × Süßes am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(34,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Anna Becker: 1 × Apfelschorle 0,5 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(35,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Jonas Schmitt: 2 × Cola 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(36,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Lea Wagner: 3 × Cola Zero 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(37,'2026-02-13 14:52:50','admin','Buchung nachgetragen','Peter Hofmann: 1 × Limonade 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(38,'2026-02-13 14:52:50','admin','Spielbetrieb: Mannschaft angelegt','Herren 30');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(39,'2026-02-13 14:52:50','admin','Spielbetrieb: Spieler zugeordnet','Herren 30: 6 Spieler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(40,'2026-02-13 14:52:50','admin','Spielbetrieb: Spieltag angelegt','Herren 30 28.10.2026 TC Nachbarort 1');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(41,'2026-02-13 14:52:50','admin','Spielbetrieb: Spieltag angelegt','Herren 30 04.11.2026 TC Nachbarort 2');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(42,'2026-02-13 14:52:50','admin','Spielbetrieb: Spieltag angelegt','Herren 30 11.11.2026 TC Nachbarort 3');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(43,'2026-02-13 14:52:50','admin','Spielbetrieb: Gastspieler/in angelegt','Max Gast → Herren 30');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(52,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(53,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(54,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(55,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(56,'2026-02-13 14:52:50','admin','Beregnung: freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(57,'2026-02-13 14:52:50','admin','Zugang: freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(59,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(60,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(61,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(63,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(64,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(65,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(66,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(67,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(68,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(71,'2026-02-13 14:52:50','admin','Mitglieder-App: Startseite','Buchen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(72,'2026-02-13 14:52:50','admin','Mitglieder-App: Reihenfolge der Bereiche geändert','Spieltage, Buchen, Meine Daten, Dienste, Türen, Beregnung');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(74,'2026-02-13 14:52:50','admin','Buchungssystem: angelegt','Platz 3');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(75,'2026-02-13 14:52:50','admin','Buchungssystem: angelegt','Padel');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(76,'2026-02-13 14:52:50','admin','Platz gebucht (Verwaltung)','Platz 1 21.10.2026 19:00–20:00 Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(77,'2026-02-13 14:52:50','admin','Platz gebucht (Verwaltung)','Platz 2 21.10.2026 20:00–22:00 Medenspiel');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(78,'2026-02-13 14:52:50','admin','Platz gebucht (Verwaltung)','Platz 3 21.10.2026 18:00–19:00 Sabine Klein');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(80,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(82,'2026-02-13 14:52:50','admin','Zeiterfassung: Person angelegt','Maria Putz (Reinigung)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(83,'2026-02-13 14:52:50','admin','Zeiterfassung: Person angelegt','Karl Platzwart (Platzwart)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(84,'2026-02-13 14:52:50','admin','Arbeitseinsatz angelegt','Plätze herrichten 21.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(85,'2026-02-13 14:52:50','admin','Zugang eingerichtet','1 Türen, 2 Zeitprofile');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(86,'2026-02-13 14:52:50',NULL,'Sicherheitswarnung','Im Modul Zugang wurden die Türen geändert (von Adminkonto).

Vorher: –
Jetzt: Clubhaus=lock.clubhaus

War das so geplant? Sonst bitte in der Verwaltung prüfen.');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(87,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(88,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(90,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(92,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(94,'2026-02-13 14:52:50','admin','Beregnung eingerichtet','3 Plätze, Anderer Hersteller (alle Ventile/Schalter aus Home Assistant), Schutz: Vereins-PIN');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(95,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(96,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(97,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(99,'2026-02-13 14:52:50','admin','Beregnung: freigeschaltet','Anna Becker');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(100,'2026-02-13 14:52:50','admin','Zugang: freigeschaltet','Anna Becker');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(102,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Anna Becker');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(105,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(107,'2026-02-13 14:52:50','admin','Mitglieder-App: Vorauswahl beim Freischalten','Beregnung: ja');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(108,'2026-02-13 14:52:50','admin','Mitglieder-App: Vorauswahl beim Freischalten','Beregnung: nein');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(109,'2026-02-13 14:52:50','admin','Mitglieder-App: Bereich allen entzogen','Beregnung: 2 Mitglieder');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(111,'2026-02-13 14:52:50','admin','Beregnung: freigeschaltet','Anna Becker');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(112,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Anna Becker');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(114,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Anna Becker');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(118,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(120,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(122,'2026-02-13 14:52:50','admin','Buchungssystem: Sonderrechte','Felix Adler: für andere buchen, alle Buchungsarten');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(124,'2026-02-13 14:52:50','admin','Buchungssystem: Sonderrechte','Felix Adler: für andere buchen, alle Buchungsarten');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(126,'2026-02-13 14:52:50','admin','Buchungssystem: Sonderrechte','Felix Adler: für andere buchen, alle Buchungsarten');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(127,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(128,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(129,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(130,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(131,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(132,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(133,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(137,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(138,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(140,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(141,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(142,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(143,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(144,'2026-02-13 14:52:50','admin','Beregnung: freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(145,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(148,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(149,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(150,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(151,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(152,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(153,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(155,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(158,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(159,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(161,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(162,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(163,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(164,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(165,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(166,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(168,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(170,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(172,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(173,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(174,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(175,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(176,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(177,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(179,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(181,'2026-02-13 14:52:50','admin','Vereinslogo hochgeladen','SVG, 0 KB');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(183,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(184,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(186,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(187,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(188,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(189,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(190,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(191,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(193,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(195,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(196,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(198,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(199,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(200,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(201,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(202,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(203,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(205,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(207,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(208,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(209,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(212,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(213,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(214,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(215,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(216,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(217,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(219,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(221,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(223,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: Beitragsart angelegt','Erwachsene 10,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(224,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: Beitragsart angelegt','Jugend 10,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(225,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: Beitragsart angelegt','Familie 10,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(226,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: Reihenfolge der Beitragsarten','Jugend, Familie, Erwachsene');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(227,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(228,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(230,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(231,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(232,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(233,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(234,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(235,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(237,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(239,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(240,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(243,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(244,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(253,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(254,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(255,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(256,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(257,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(258,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(262,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(263,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(264,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(268,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(269,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(270,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(271,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(272,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(273,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(277,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(278,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(279,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(290,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(291,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(292,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(297,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(298,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(299,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(300,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(301,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(302,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(304,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(305,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(306,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(307,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(315,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(316,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(317,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(318,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(319,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(320,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(322,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(326,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(327,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(328,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(333,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(334,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(335,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(336,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(337,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(338,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(340,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(341,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(349,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(350,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(351,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(352,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(353,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(354,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(356,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(357,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(359,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(361,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(366,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(367,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(368,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(373,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(374,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(375,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(376,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(377,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(378,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(380,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(381,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(382,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(383,'2026-02-13 14:52:50',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(391,'2026-02-13 14:52:50','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(392,'2026-02-13 14:52:50','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(393,'2026-02-13 14:52:50','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(394,'2026-02-13 14:52:50','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(395,'2026-02-13 14:52:50','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(396,'2026-02-13 14:52:50','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(398,'2026-02-13 14:52:50',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(400,'2026-02-13 14:52:51','admin','Bankkonto angelegt','Vereinskonto DE02 •••• •••• 2051');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(401,'2026-02-13 14:52:51','admin','Mitglieder: Einstellungen geändert','Straße: – → Am Sportplatz 1 · PLZ und Ort: – → 12345 Musterstadt · Zahlungsempfänger: – → TC Grün-Weiß Musterstadt · Gläubiger-ID: – → DE98ZZZ09999999999 · Konto für Lastschriften geändert · Mandatsreferenz-Vorsilbe: – → GWM · Mitgliedsnummern ab: – → 1001 · Vorabinformation (Tage): – → 14 · Rücklastschrift-Gebühr: – → 5,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(402,'2026-02-13 14:52:51','admin','Mitglieder: Abteilung angelegt','Tennis');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(403,'2026-02-13 14:52:51','admin','Mitglieder: Abteilung angelegt','Fußball');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(404,'2026-02-13 14:52:51','admin','Mitglieder: Beitragsart angelegt','Erwachsene 120,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(405,'2026-02-13 14:52:51','admin','Mitglieder: Beitragsart angelegt','Kinder und Jugendliche 60,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(406,'2026-02-13 14:52:51','admin','Mitglieder: Beitragsart angelegt','Familie 220,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(407,'2026-02-13 14:52:51','admin','Mitglieder: Beitragsart angelegt','Passiv 40,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(408,'2026-02-13 14:52:51','admin','Mitglieder: Beitragsart angelegt','Tennis Erwachsene 90,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(409,'2026-02-13 14:52:51','admin','Mitglieder: Beitragsart angelegt','Tennis Jugend 40,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(410,'2026-02-13 14:52:52','admin','Mitglieder: Beitragsart angelegt','Fußball 30,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(411,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Felix Adler, neues Mandat GWM3');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(412,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Anna Becker, neues Mandat GWM4');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(413,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Jonas Schmitt, neues Mandat GWM5');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(414,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Lea Wagner, neues Mandat GWM6');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(415,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Peter Hofmann, neues Mandat GWM7');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(416,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Sabine Klein, neues Mandat GWM8');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(417,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Markus Weber, neues Mandat GWM9');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(418,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Julia Fischer, neues Mandat GWM10');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(419,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Tobias Neumann, neues Mandat GWM11');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(420,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Jan Albrecht, neues Mandat GWM14');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(421,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Miriam Bauer, neues Mandat GWM15');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(422,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Stefan Brandt, neues Mandat GWM16');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(423,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Nina Dietrich');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(424,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Oliver Engel');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(425,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Katrin Frank, neues Mandat GWM19');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(426,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Daniel Graf, neues Mandat GWM20');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(427,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Sophie Hahn, neues Mandat GWM21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(428,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Martin Huber, neues Mandat GWM22');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(429,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Lena Jäger, neues Mandat GWM23');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(430,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Thomas Keller, neues Mandat GWM24');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(431,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Sarah König, neues Mandat GWM25');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(432,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Michael Lang, neues Mandat GWM26');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(433,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Hanna Lorenz, neues Mandat GWM27');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(434,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Christian Maier, neues Mandat GWM28');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(435,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Paula Möller, neues Mandat GWM29');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(436,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Andreas Nagel, neues Mandat GWM30');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(437,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Emma Otto, neues Mandat GWM31');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(438,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Florian Peters, neues Mandat GWM32');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(439,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Clara Roth');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(440,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Sebastian Sauer, neues Mandat GWM34');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(441,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Marie Schäfer, neues Mandat GWM35');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(442,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Philipp Schreiber, neues Mandat GWM36');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(443,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Johanna Seidel, neues Mandat GWM37');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(444,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Dominik Simon, neues Mandat GWM38');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(445,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Katharina Vogel, neues Mandat GWM39');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(446,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Tim Walter, neues Mandat GWM40');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(447,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Lisa Winkler, neues Mandat GWM41');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(448,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Moritz Wolf, neues Mandat GWM42');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(449,'2026-02-13 14:52:52','admin','Mitglied: Bankverbindung geändert','Elena Ziegler, neues Mandat GWM43');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(450,'2026-02-13 14:52:52','admin','Mitglied angelegt','Mia Hofmann');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(451,'2026-02-13 14:52:52','admin','Mitglied angelegt','Ben Hofmann');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(452,'2026-02-13 14:52:52','admin','Mitglied angelegt','Paul Weber');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(453,'2026-02-13 14:52:52','admin','Mitglied: Austritt eingetragen','Moritz Wolf zum 31.12.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(454,'2026-02-13 14:52:52','admin','Beitragslauf','80 Positionen, 6.991,67 € (bis 20.02.2026)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(455,'2026-02-13 14:52:53','admin','Buchhaltung: Einstellungen geändert','Straße: – → Am Sportplatz 1 · PLZ und Ort: – → 12345 Musterstadt · Steuernummer: – → 012/345/67890 · E-Mail: – → kasse@example.org · Finanzamt: – → Finanzamt Musterstadt · Steuernummer (Finanzamt): – → 012/345/67890 · Veranlagungszeitraum: – → 2022–2024 · Unterschrift: – → Andreas Nagel · Funktion: Vorsitzende/r → Kassenwart · Ort: – → Musterstadt · Satzungszwecke geändert · Datum des Bescheids: – → 2025-06-15');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(456,'2026-02-13 14:52:53','admin','Buchhaltung: Firma angelegt','Musterbau GmbH');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(457,'2026-02-13 14:52:53','admin','Buchhaltung: Firma angelegt','Autohaus Beispiel KG');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(458,'2026-02-13 14:52:53','admin','Rechnung erstellt','R-2026-0001');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(460,'2026-02-23 14:52:54','admin','SEPA-Einzug erstellt','33 Lastschriften, 6.321,67 € zum 16.03.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(461,'2026-02-23 14:52:54','admin','SEPA-Datei heruntergeladen','Einzug 1 (33 Lastschriften, 6.321,67 €)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(463,'2026-03-11 14:52:55','admin','Kontoauszug eingelesen','Vereinskonto: 7 Buchungen neu (camt.053 V08, 18.03.2026–18.03.2026)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(464,'2026-03-11 14:52:55','admin','Kontoauszug: Zahlung zugeordnet','18.03.2026 210,00 € → Lastschrift-Einzug vom 16.03.2026 (Erstlastschriften): 2 Posten bezahlt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(465,'2026-03-11 14:52:55','admin','Kontoauszug: Zahlung zugeordnet','18.03.2026 6.111,67 € → Lastschrift-Einzug vom 16.03.2026 (Folgelastschriften): 71 Posten bezahlt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(466,'2026-03-11 14:52:55','admin','Kontoauszug: Zahlung zugeordnet','18.03.2026 210,00 € → Dietrich, Nina: Erwachsene 01/2026–12/2026, Tennis Erwachsene 01/2026–12/2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(467,'2026-03-11 14:52:55','admin','Kontoauszug: Zahlung zugeordnet','18.03.2026 595,00 € → Rechnung R-2026-0001 – Musterbau GmbH');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(468,'2026-03-11 14:52:55','admin','Kontoauszug: Rücklastschrift gebucht','18.03.2026 -213,00 € → Neumann, Tobias: Rücklastschrift 210,00 € aus dem Einzug vom 16.03.2026 – Konto erloschen (AC04), Gebühr 3,00 €, Mandat gesperrt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(469,'2026-03-11 14:52:55','admin','Kontoauszug: Zahlung zugeordnet','18.03.2026 100,00 € → Roth, Clara: Erwachsene 01/2026–12/2026 (Teilzahlung, Rest bleibt offen)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(470,'2026-03-11 14:52:55','admin','Kontoauszug: Zahlung zugeordnet','18.03.2026 40,00 € → Engel, Oliver: Passiv 01/2026–12/2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(472,'2026-03-31 14:52:56','admin','Mahnbrief gedruckt','Tobias Neumann: Zahlungserinnerung über 213,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(473,'2026-03-31 14:52:56','admin','Mahnbrief gedruckt','Clara Roth: Zahlungserinnerung über 110,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(474,'2026-03-31 14:52:56','admin','Mahnbrief gedruckt','Laura Schulz: Zahlungserinnerung über 210,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(476,'2026-04-16 14:52:58','admin','Mahnbrief gedruckt','Tobias Neumann: 1. Mahnung über 215,50 €, Mahngebühr 2,50 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(477,'2026-04-16 14:52:58','admin','Mahnbrief gedruckt','Laura Schulz: 1. Mahnung über 212,50 €, Mahngebühr 2,50 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(479,'2026-05-02 14:52:59','admin','Mahnbrief gedruckt','Laura Schulz: 2. Mahnung über 215,00 €, Mahngebühr 2,50 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(481,'2026-09-21 14:53:01','admin','Rechnung erstellt','R-2026-0002');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(482,'2026-09-21 14:53:01','admin','Spendenquittung erstellt','SQ-2026-0001: Michael Lang 100,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(483,'2026-09-21 14:53:01','admin','Spendenquittung erstellt','SQ-2026-0002: Musterbau GmbH 450,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(484,'2026-09-21 14:53:01','admin','Spendenquittung erstellt','SQ-2026-0003: Gerda Muster 50,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(486,'2026-10-18 14:53:02','admin','Kontoauszug eingelesen','Vereinskonto: 3 Buchungen neu (camt.053 V08, 25.10.2026–25.10.2026)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(487,'2026-10-18 14:53:02','admin','Kontoauszug: gehört nicht zu Clubwerk','25.10.2026 300,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(489,'2026-09-30 14:53:03','admin','Spielbetrieb: Einstellungen geändert','Aufgaben je Spieltag: nein → ja · Aufgaben: [object Object], [object Object], [object Object], [object Object] → [object Object], [object Object], [object Object], [object Object], [object Object]');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(490,'2026-09-30 14:53:03','admin','Spielbetrieb: Mannschaft angelegt','Herren');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(491,'2026-09-30 14:53:03','admin','Spielbetrieb: Spieler zugeordnet','Herren: 6 Spieler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(492,'2026-09-30 14:53:03','admin','Spielbetrieb: Mannschaft angelegt','Damen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(493,'2026-09-30 14:53:03','admin','Spielbetrieb: Spieler zugeordnet','Damen: 6 Spieler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(494,'2026-09-30 14:53:03','admin','Spielbetrieb: Mannschaft angelegt','Herren 40');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(495,'2026-09-30 14:53:03','admin','Spielbetrieb: Spieler zugeordnet','Herren 40: 6 Spieler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(496,'2026-09-30 14:53:03','admin','Spielbetrieb: Mannschaft angelegt','Junioren U15');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(497,'2026-09-30 14:53:03','admin','Spielbetrieb: Spieler zugeordnet','Junioren U15: 4 Spieler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(498,'2026-09-30 14:53:03','admin','Spielbetrieb: Mannschaft angelegt','Fußball AH');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(499,'2026-09-30 14:53:03','admin','Spielbetrieb: Spieler zugeordnet','Fußball AH: 10 Spieler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(500,'2026-09-30 14:53:03','admin','Spielbetrieb: Spieltag angelegt','Herren 10.10.2026 TC Blau-Weiß Beispielstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(501,'2026-09-30 14:53:03','admin','Spielbetrieb: Aufstellung verschickt','Herren gegen TC Blau-Weiß Beispielstadt 10.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(502,'2026-09-30 14:53:03','admin','Spielbetrieb: Spieltag angelegt','Herren 24.10.2026 TV Musterdorf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(503,'2026-09-30 14:53:04','admin','Spielbetrieb: Aufstellung verschickt','Herren bei TV Musterdorf 24.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(504,'2026-09-30 14:53:04','admin','Spielbetrieb: Spieltag angelegt','Damen 18.10.2026 TC Beispielstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(505,'2026-09-30 14:53:04','admin','Spielbetrieb: Aufstellung verschickt','Damen bei TC Beispielstadt 18.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(506,'2026-09-30 14:53:04','admin','Spielbetrieb: Spieltag angelegt','Herren 40 17.10.2026 TSV Musterhausen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(507,'2026-09-30 14:53:04','admin','Spielbetrieb: Aufstellung verschickt','Herren 40 gegen TSV Musterhausen 17.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(508,'2026-09-30 14:53:04','admin','Spielbetrieb: Spieltag angelegt','Junioren U15 11.10.2026 TC Exempelhausen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(509,'2026-09-30 14:53:04','admin','Spielbetrieb: Aufstellung verschickt','Junioren U15 gegen TC Exempelhausen 11.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(510,'2026-09-30 14:53:04','admin','Spielbetrieb: Spieltag angelegt','Fußball AH 16.10.2026 SG Beispielstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(511,'2026-09-30 14:53:04','admin','Spielbetrieb: Aufstellung verschickt','Fußball AH gegen SG Beispielstadt 16.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(512,'2026-09-30 14:53:04','admin','Spielbetrieb: Spieltag angelegt','Fußball AH 23.10.2026 SV Musterdorf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(513,'2026-09-30 14:53:04','admin','Spielbetrieb: Aufstellung verschickt','Fußball AH bei SV Musterdorf 23.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(515,'2026-10-07 14:53:06','admin','Serienbuchung angelegt','Training Herren: 46 Termine');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(516,'2026-10-07 14:53:06','admin','Serienbuchung angelegt','Jugendtraining: 47 Termine');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(517,'2026-10-07 14:53:06','admin','Serienbuchung angelegt','Training Damen: 24 Termine');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(518,'2026-10-07 14:53:06','admin','Serienbuchung angelegt','Tenniskurs Einsteiger: 11 Termine');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(519,'2026-10-07 14:53:06','admin','Serienbuchung angelegt','Padel-Treff: 24 Termine');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(520,'2026-10-07 14:53:06','admin','Sperre angelegt','Platzpflege: 23 Termine');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(521,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 2 14.10.2026 15:00–16:00 Felix Adler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(522,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Padel 14.10.2026 12:00–13:00 Peter Hofmann');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(523,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Padel 15.10.2026 12:00–13:00 Julia Fischer');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(524,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 1 16.10.2026 16:00–17:00 Laura Schulz');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(525,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 3 16.10.2026 14:00–15:00 Miriam Bauer');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(526,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Padel 17.10.2026 15:00–16:00 Stefan Brandt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(527,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 3 18.10.2026 14:00–15:00 Daniel Graf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(528,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Padel 18.10.2026 11:00–12:00 Martin Huber');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(529,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 2 19.10.2026 15:00–16:00 Thomas Keller');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(530,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Padel 20.10.2026 12:00–13:00 Michael Lang');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(531,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 1 20.10.2026 16:00–17:00 Christian Maier');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(532,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 1 21.10.2026 16:00–17:00 Florian Peters');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(533,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 3 22.10.2026 14:00–15:00 Sebastian Sauer');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(534,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 1 22.10.2026 09:00–10:00 Johanna Seidel');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(535,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 1 23.10.2026 09:00–10:00 Katharina Vogel');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(536,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 1 24.10.2026 09:00–10:00 Elena Ziegler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(537,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Padel 24.10.2026 15:00–16:00 Lea Wagner');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(538,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Padel 25.10.2026 15:00–16:00 Markus Weber');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(539,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 1 26.10.2026 16:00–17:00 Tobias Neumann');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(540,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 3 26.10.2026 14:00–15:00 Jan Albrecht');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(541,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 3 27.10.2026 14:00–15:00 Stefan Brandt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(542,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 1 10.10.2026 14:00–18:00 Herren – TC Blau-Weiß Beispielstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(543,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 2 10.10.2026 14:00–18:00 Herren – TC Blau-Weiß Beispielstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(544,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 1 17.10.2026 10:00–14:00 Herren 40 – TSV Musterhausen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(545,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 2 17.10.2026 10:00–14:00 Herren 40 – TSV Musterhausen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(546,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 1 11.10.2026 10:00–14:00 Junioren U15 – TC Exempelhausen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(547,'2026-10-07 14:53:06','admin','Platz gebucht (Verwaltung)','Platz 2 11.10.2026 10:00–14:00 Junioren U15 – TC Exempelhausen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(549,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag geändert','Herren 10.10.2026 TC Blau-Weiß Beispielstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(550,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag geändert','Herren 24.10.2026 TV Musterdorf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(551,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag geändert','Damen 18.10.2026 TC Beispielstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(552,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag geändert','Herren 40 17.10.2026 TSV Musterhausen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(553,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag geändert','Junioren U15 11.10.2026 TC Exempelhausen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(554,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag geändert','Fußball AH 16.10.2026 SG Beispielstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(555,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag geändert','Fußball AH 23.10.2026 SV Musterdorf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(556,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag angelegt','Herren 31.10.2026 TC Rot-Weiß Probstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(557,'2026-03-20 19:10:54','admin','Spielbetrieb: Aufstellung verschickt','Herren gegen TC Rot-Weiß Probstadt 31.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(558,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag angelegt','Herren 14.11.2026 SV Exempelhausen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(559,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag angelegt','Damen 01.11.2026 TV Musterdorf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(560,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag angelegt','Damen 15.11.2026 TC Grün-Gelb Modellheim');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(561,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag angelegt','Herren 40 07.11.2026 TC Probstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(562,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag angelegt','Herren 40 21.11.2026 TV Beispieltal');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(563,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag angelegt','Junioren U15 08.11.2026 TV Musterdorf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(564,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag angelegt','Fußball AH 06.11.2026 FC Modellheim');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(565,'2026-03-20 19:10:54','admin','Spielbetrieb: Aufstellung verschickt','Fußball AH gegen FC Modellheim 06.11.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(566,'2026-03-20 19:10:54','admin','Spielbetrieb: Spieltag angelegt','Fußball AH 20.11.2026 SpVgg Probstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(567,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 1 28.10.2026 09:00–10:00 Daniel Graf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(568,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 2 28.10.2026 15:00–16:00 Martin Huber');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(569,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Padel 28.10.2026 12:00–13:00 Lena Jäger');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(570,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 2 29.10.2026 15:00–16:00 Sarah König');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(571,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Padel 29.10.2026 12:00–13:00 Hanna Lorenz');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(572,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Padel 30.10.2026 12:00–13:00 Emma Otto');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(573,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 1 30.10.2026 16:00–17:00 Clara Roth');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(574,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 3 30.10.2026 14:00–15:00 Marie Schäfer');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(575,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Padel 31.10.2026 11:00–12:00 Katharina Vogel');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(576,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 1 31.10.2026 09:00–10:00 Elena Ziegler');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(577,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 1 01.11.2026 09:00–10:00 Lea Wagner');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(578,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Padel 01.11.2026 15:00–16:00 Peter Hofmann');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(579,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 3 01.11.2026 14:00–15:00 Julia Fischer');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(580,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 1 02.11.2026 09:00–10:00 Laura Schulz');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(581,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 2 02.11.2026 15:00–16:00 Miriam Bauer');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(582,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 2 03.11.2026 15:00–16:00 Katrin Frank');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(583,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Padel 03.11.2026 12:00–13:00 Sophie Hahn');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(584,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 1 03.11.2026 16:00–17:00 Lena Jäger');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(585,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 1 31.10.2026 14:00–18:00 Herren – TC Rot-Weiß Probstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(586,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 2 31.10.2026 14:00–18:00 Herren – TC Rot-Weiß Probstadt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(587,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 1 01.11.2026 10:00–14:00 Damen – TV Musterdorf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(588,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 2 01.11.2026 10:00–14:00 Damen – TV Musterdorf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(589,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 1 21.11.2026 10:00–14:00 Herren 40 – TV Beispieltal');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(590,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 2 21.11.2026 10:00–14:00 Herren 40 – TV Beispieltal');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(591,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 1 04.11.2026 10:00–14:00 Herren 30 – TC Nachbarort 1');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(592,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 2 04.11.2026 10:00–14:00 Herren 30 – TC Nachbarort 1');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(593,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 1 18.11.2026 10:00–14:00 Herren 30 – TC Nachbarort 3');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(594,'2026-03-20 19:10:55','admin','Platz gebucht (Verwaltung)','Platz 2 18.11.2026 10:00–14:00 Herren 30 – TC Nachbarort 3');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(595,'2026-03-20 19:10:55','admin','Buchung storniert (Verwaltung)','#222 2026-11-03 15:00 – Krank – Spiel fällt aus');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(596,'2026-03-20 19:10:55','admin','Zugang eingerichtet','3 Türen, 4 Zeitprofile');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(597,'2026-03-20 19:10:55',NULL,'Sicherheitswarnung','Im Modul Zugang wurden die Türen geändert (von Adminkonto).

Vorher: Clubhaus=lock.clubhaus
Jetzt: Ballraum=lock.ballraum, Clubhaus=lock.clubhaus, Halle=switch.hallentor

War das so geplant? Sonst bitte in der Verwaltung prüfen.');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(598,'2026-03-20 19:10:55','admin','Zugang: freigeschaltet','Peter Hofmann');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(599,'2026-03-20 19:10:55','admin','Zugang: freigeschaltet','Markus Weber');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(600,'2026-03-20 19:10:55','admin','Zugang: freigeschaltet','Julia Fischer');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(601,'2026-03-20 19:10:55','admin','Zugang: freigeschaltet','Laura Schulz');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(602,'2026-03-20 19:10:55','admin','Zugang: freigeschaltet','Jan Albrecht');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(603,'2026-03-20 19:10:55','admin','Zugang: freigeschaltet','Daniel Graf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(604,'2026-03-20 19:10:55','admin','Zugang: freigeschaltet','Michael Lang');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(605,'2026-03-20 19:10:55','admin','Zugang: freigeschaltet','Dominik Simon');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(606,'2026-03-20 19:10:55','admin','Zugang: freigeschaltet','Tim Walter');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(607,'2026-03-20 19:10:55','admin','Zugang: freigeschaltet','Moritz Wolf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(608,'2026-03-20 19:10:55','admin','Zugang: freigeschaltet','Stefan Brandt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(609,'2026-03-20 19:10:55',NULL,'Sicherheitswarnung','Im Modul Beregnung wurden die geschalteten Geräte geändert (von Adminkonto).

Vorher: switch.platz1, switch.platz2, switch.platz3
Jetzt: switch.platz1, switch.platz2, switch.platz3, switch.platz4_nord, switch.platz4_sued

War das so geplant? Sonst bitte in der Verwaltung prüfen.');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(610,'2026-03-20 19:10:55','admin','Beregnung eingerichtet','4 Plätze, Anderer Hersteller (alle Ventile/Schalter aus Home Assistant), Schutz: Vereins-PIN');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(611,'2026-03-20 19:10:55','admin','Beregnung: freigeschaltet','Peter Hofmann');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(612,'2026-03-20 19:10:55','admin','Beregnung: freigeschaltet','Markus Weber');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(613,'2026-03-20 19:10:55','admin','Beregnung: freigeschaltet','Daniel Graf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(614,'2026-03-20 19:10:55',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · node');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(615,'2026-03-20 19:10:55','tablet','Mängel: neue Meldung','Clubhaus');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(616,'2026-03-20 19:10:55','admin','Mängel: Meldung bearbeitet','Clubhaus: Status: Neu → Erledigt · Antwort geändert · Zuständig: – → Adminkonto');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(617,'2026-03-20 19:10:55','tablet','Mängel: neue Meldung','Clubhaus');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(619,'2026-03-20 19:10:56','admin','Dienste & Termine: Einstellungen geändert','Hinweis für Mitglieder geändert · Kontakt für kurzfristige Absagen: – → Sportwart (Telefon im Aushang)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(620,'2026-03-20 19:10:56','admin','Arbeitsstunden: Soll geändert','Thomas Keller 2026: 0:00 h');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(621,'2026-03-20 19:10:56','admin','Arbeitseinsatz: Mitglied befreit','Elena Ziegler bis 31.12.2026 – Elternzeit');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(623,'2026-03-21 20:05:13','admin','Arbeitseinsatz angelegt','Frühjahrsputz Anlage 11.04.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(626,'2026-04-04 13:25:32','admin','Arbeitsstunden gutgeschrieben','Frühjahrsputz Anlage 11.04.2026: 5 × 4:00 h');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(628,'2026-05-25 19:30:54','admin','Arbeitsstunden nachgetragen','2 Mitglieder, 4:00 h am 30.05.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(630,'2026-06-03 20:15:25','admin','Dienstplan angelegt','Sommerfest 10.07.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(631,'2026-06-03 20:15:25','admin','Dienst angelegt','Aufbau 10.07.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(632,'2026-06-03 20:15:25','admin','Dienst angelegt','Theke 11.07.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(633,'2026-06-03 20:15:25','admin','Dienst angelegt','Theke 11.07.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(634,'2026-06-03 20:15:25','admin','Dienst angelegt','Grill 11.07.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(635,'2026-06-03 20:15:25','admin','Dienst angelegt','Kuchenbuffet 12.07.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(636,'2026-06-03 20:15:25','admin','Dienst angelegt','Abbau 12.07.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(639,'2026-07-06 19:20:10','admin','Arbeitsstunden gutgeschrieben','Aufbau 10.07.2026: 5 × 3:00 h');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(640,'2026-07-06 19:20:10','admin','Arbeitsstunden gutgeschrieben','Theke 11.07.2026: 3 × 4:00 h');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(641,'2026-07-06 19:20:10','admin','Arbeitsstunden gutgeschrieben','Theke 11.07.2026: 3 × 4:00 h');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(642,'2026-07-06 19:20:10','admin','Arbeitsstunden gutgeschrieben','Grill 11.07.2026: 1 × 4:00 h');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(643,'2026-07-06 19:20:10','admin','Arbeitsstunden gutgeschrieben','Kuchenbuffet 12.07.2026: 2 × 3:00 h');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(644,'2026-07-06 19:20:10','admin','Arbeitsstunden gutgeschrieben','Abbau 12.07.2026: 5 × 2:00 h');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(646,'2026-08-05 20:05:44','admin','Arbeitseinsatz angelegt','Hecke schneiden 26.08.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(649,'2026-08-19 19:25:57','admin','Arbeitsstunden gutgeschrieben','Hecke schneiden 26.08.2026: 3 × 2:00 h');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(651,'2026-08-24 07:05:24','admin','Zeiterfassung: Person geändert','Karl Platzwart, Stundensatz 15,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(652,'2026-08-24 07:05:24','admin','Zeiterfassung: Person geändert','Maria Putz, Stundensatz 13,50 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(664,'2026-09-03 21:10:35','admin','Termin angelegt','Saisonabschlussfeier 10.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(672,'2026-09-07 20:20:08','admin','Termin: Antwort eingetragen','Felix Adler: Saisonabschlussfeier 10.10.2026 – kommt mit 2 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(673,'2026-09-07 20:20:08','admin','Termin: Antwort eingetragen','Jonas Schmitt: Saisonabschlussfeier 10.10.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(674,'2026-09-07 20:20:08','admin','Termin: Antwort eingetragen','Markus Weber: Saisonabschlussfeier 10.10.2026 – kommt mit 2 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(675,'2026-09-07 20:20:08','admin','Termin: Antwort eingetragen','Laura Schulz: Saisonabschlussfeier 10.10.2026 – kommt nicht');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(691,'2026-09-17 19:50:39','admin','Termin: Antwort eingetragen','Jan Albrecht: Saisonabschlussfeier 10.10.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(692,'2026-09-17 19:50:40','admin','Termin: Antwort eingetragen','Stefan Brandt: Saisonabschlussfeier 10.10.2026 – kommt mit 3 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(693,'2026-09-17 19:50:40','admin','Termin: Antwort eingetragen','Oliver Engel: Saisonabschlussfeier 10.10.2026 – kommt mit 2 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(694,'2026-09-17 19:50:40','admin','Termin: Antwort eingetragen','Daniel Graf: Saisonabschlussfeier 10.10.2026 – kommt nicht');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(695,'2026-09-17 19:50:40','admin','Termin: Antwort eingetragen','Martin Huber: Saisonabschlussfeier 10.10.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(703,'2026-09-21 20:30:20','admin','Arbeitsstunden bestätigt','1 Einträge');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(714,'2026-09-26 20:05:40','admin','Arbeitseinsatz angelegt','Platzpflege & Netze abbauen 17.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(717,'2026-09-26 21:30:04','admin','Termin: Antwort eingetragen','Thomas Keller: Saisonabschlussfeier 10.10.2026 – kommt mit 2 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(718,'2026-09-26 21:30:04','admin','Termin: Antwort eingetragen','Michael Lang: Saisonabschlussfeier 10.10.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(719,'2026-09-26 21:30:04','admin','Termin: Antwort eingetragen','Christian Maier: Saisonabschlussfeier 10.10.2026 – kommt mit 4 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(720,'2026-09-26 21:30:04','admin','Termin: Antwort eingetragen','Andreas Nagel: Saisonabschlussfeier 10.10.2026 – kommt nicht');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(721,'2026-09-26 21:30:04','admin','Termin: Antwort eingetragen','Clara Roth: Saisonabschlussfeier 10.10.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(722,'2026-09-26 21:30:04','admin','Termin: Antwort eingetragen','Peter Hofmann: Saisonabschlussfeier 10.10.2026 – kommt mit 2 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(734,'2026-10-05 07:40:55','admin','Zeiterfassung: Einsatz korrigiert','Karl Platzwart: 2026-10-08 07:22–offen → 2026-10-08 07:22–11:45 (vergessen auszustempeln)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(737,'2026-10-06 08:53:54','admin','Zeiterfassung: Einsatz nachgetragen','Maria Putz: 2026-10-11 10:00 – 13:30 (Zusatzreinigung nach der Saisonabschlussfeier (Tablet war aus))');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(746,'2026-10-10 13:25:59','admin','Arbeitsstunden gutgeschrieben','Platzpflege & Netze abbauen 17.10.2026: 5 × 3:00 h');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(750,'2026-10-12 20:00:53','admin','Arbeitseinsatz angelegt','Laub rechen & Wege kehren 07.11.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(751,'2026-10-12 20:00:53','admin','Arbeitseinsatz angelegt','Vereinsheim winterfest machen 21.11.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(755,'2026-10-13 20:40:36','admin','Dienstplan angelegt','Glühweinabend 04.12.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(756,'2026-10-13 20:40:36','admin','Dienst angelegt','Aufbau 04.12.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(757,'2026-10-13 20:40:36','admin','Dienst angelegt','Theke 04.12.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(758,'2026-10-13 20:40:36','admin','Dienst angelegt','Theke 04.12.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(759,'2026-10-13 20:40:36','admin','Dienst angelegt','Glühweinstand 04.12.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(760,'2026-10-13 20:40:36','admin','Dienst angelegt','Abbau 05.12.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(765,'2026-10-15 20:50:48','admin','Termin: Antwort eingetragen','Felix Adler: Mitgliederversammlung 27.11.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(766,'2026-10-15 20:50:48','admin','Termin: Antwort eingetragen','Jonas Schmitt: Mitgliederversammlung 27.11.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(767,'2026-10-15 20:50:48','admin','Termin: Antwort eingetragen','Peter Hofmann: Mitgliederversammlung 27.11.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(768,'2026-10-15 20:50:48','admin','Termin: Antwort eingetragen','Markus Weber: Mitgliederversammlung 27.11.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(769,'2026-10-15 20:50:48','admin','Termin: Antwort eingetragen','Laura Schulz: Mitgliederversammlung 27.11.2026 – kommt nicht');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(770,'2026-10-15 20:50:48','admin','Termin: Antwort eingetragen','Jan Albrecht: Mitgliederversammlung 27.11.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(777,'2026-10-17 21:05:28','admin','Termin: Antwort eingetragen','Markus Weber: Weihnachtsfeier 19.12.2026 – kommt mit 2 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(778,'2026-10-17 21:05:28','admin','Termin: Antwort eingetragen','Julia Fischer: Weihnachtsfeier 19.12.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(779,'2026-10-17 21:05:28','admin','Termin: Antwort eingetragen','Jan Albrecht: Weihnachtsfeier 19.12.2026 – kommt mit 3 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(780,'2026-10-17 21:05:28','admin','Termin: Antwort eingetragen','Oliver Engel: Weihnachtsfeier 19.12.2026 – kommt mit 2 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(781,'2026-10-17 21:05:28','admin','Termin: Antwort eingetragen','Laura Schulz: Weihnachtsfeier 19.12.2026 – kommt nicht');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(783,'2026-10-18 19:45:23','admin','Arbeitsstunden bestätigt','2 Einträge');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(784,'2026-10-18 19:45:23','admin','Arbeitsstunden abgelehnt','1 Einträge');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(791,'2026-10-20 19:35:27','admin','Termin: Antwort eingetragen','Tobias Neumann: Mitgliederversammlung 27.11.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(792,'2026-10-20 19:35:27','admin','Termin: Antwort eingetragen','Stefan Brandt: Mitgliederversammlung 27.11.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(793,'2026-10-20 19:35:27','admin','Termin: Antwort eingetragen','Daniel Graf: Mitgliederversammlung 27.11.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(794,'2026-10-20 19:35:27','admin','Termin: Antwort eingetragen','Thomas Keller: Mitgliederversammlung 27.11.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(795,'2026-10-20 19:35:27','admin','Termin: Antwort eingetragen','Hanna Lorenz: Mitgliederversammlung 27.11.2026 – kommt nicht');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(796,'2026-10-20 19:35:27','admin','Termin: Antwort eingetragen','Andreas Nagel: Mitgliederversammlung 27.11.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(797,'2026-10-20 19:35:27','admin','Termin: Antwort eingetragen','Katharina Vogel: Mitgliederversammlung 27.11.2026 – kommt nicht');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(799,'2026-10-20 20:10:13','admin','Termin: Antwort eingetragen','Martin Huber: Weihnachtsfeier 19.12.2026 – kommt mit 4 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(800,'2026-10-20 20:10:13','admin','Termin: Antwort eingetragen','Michael Lang: Weihnachtsfeier 19.12.2026 – kommt mit 2 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(801,'2026-10-20 20:10:13','admin','Termin: Antwort eingetragen','Paula Möller: Weihnachtsfeier 19.12.2026 – kommt');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(802,'2026-10-20 20:10:13','admin','Termin: Antwort eingetragen','Clara Roth: Weihnachtsfeier 19.12.2026 – kommt mit 2 Personen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(803,'2026-10-20 20:10:13','admin','Termin: Antwort eingetragen','Tim Walter: Weihnachtsfeier 19.12.2026 – kommt nicht');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(805,'2026-10-20 21:15:29','admin','Arbeitsstunden nachgetragen','1 Mitglied, 1:30 h am 26.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(806,'2026-10-20 21:15:29','admin','Arbeitsstunden nachgetragen','1 Mitglied, 1:00 h am 27.10.2026');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(809,'2026-08-22 14:55:25','admin','Lieferung gespeichert','Getränke Muster GmbH 2026-08-29 Beleg RE-2026-0815 (11 Positionen)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(810,'2026-08-22 14:55:25','admin','Lieferung gespeichert','Großmarkt Beispiel 2026-08-29 (2 Positionen)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(812,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Martin Huber: 2 × Chips am 2026-08-31');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(813,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Anna Becker: 1 × Pils 0,33 am 2026-09-01');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(814,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Martin Huber: 1 × Chips am 2026-09-01');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(815,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Anna Becker: 2 × Limonade 0,33 am 2026-09-02');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(816,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Nina Dietrich: 2 × Weizen 0,5 am 2026-09-02');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(817,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Stefan Brandt: 2 × Cola Zero 0,33 am 2026-09-02');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(818,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Peter Hofmann: 1 × Kaffee am 2026-09-02');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(819,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Julia Fischer: 1 × Wasser 0,7 am 2026-09-04');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(820,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Jan Albrecht: 2 × Chips am 2026-09-05');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(821,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Markus Weber: 1 × Weizen alkoholfrei 0,5 am 2026-09-05');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(822,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Peter Hofmann: 1 × Weizen alkoholfrei 0,5 am 2026-09-05');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(823,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Markus Weber: 1 × Pils 0,33 am 2026-09-05');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(824,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Markus Weber: 1 × Weizen 0,5 am 2026-09-05');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(825,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Daniel Graf: 1 × Weizen alkoholfrei 0,5 am 2026-09-05');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(826,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Weizen 0,5 am 2026-09-05');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(827,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Moritz Wolf: 2 × Radler 0,33 am 2026-09-05');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(828,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Felix Adler: 1 × Pils 0,33 am 2026-09-06');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(829,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Tobias Neumann: 1 × Cola Zero 0,33 am 2026-09-06');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(830,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Peter Hofmann: 1 × Kaffee am 2026-09-06');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(831,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Stefan Brandt: 2 × Apfelschorle 0,5 am 2026-09-06');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(832,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Jan Albrecht: 2 × Wasser 0,7 am 2026-09-06');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(833,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Oliver Engel: 1 × Apfelschorle 0,5 am 2026-09-06');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(834,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Peter Hofmann: 1 × Cola 0,33 am 2026-09-06');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(835,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Sophie Hahn: 2 × Pils 0,33 am 2026-09-07');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(836,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Tobias Neumann: 1 × Pils 0,33 am 2026-09-07');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(837,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Nina Dietrich: 1 × Süßes am 2026-09-08');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(838,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Laura Schulz: 1 × Pils 0,33 am 2026-09-08');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(839,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Laura Schulz: 1 × Chips am 2026-09-09');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(840,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Felix Adler: 1 × Cola 0,33 am 2026-09-09');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(841,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Felix Adler: 2 × Cola Zero 0,33 am 2026-09-09');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(842,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Katrin Frank: 1 × Apfelschorle 0,5 am 2026-09-10');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(843,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Peter Hofmann: 1 × Cola Zero 0,33 am 2026-09-12');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(844,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Stefan Brandt: 1 × Weizen 0,5 am 2026-09-12');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(845,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Julia Fischer: 1 × Pils 0,33 am 2026-09-12');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(846,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Martin Huber: 2 × Radler 0,33 am 2026-09-12');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(847,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Peter Hofmann: 1 × Pils 0,33 am 2026-09-12');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(848,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Markus Weber: 2 × Radler 0,33 am 2026-09-12');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(849,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Felix Adler: 1 × Bier 0,33 am 2026-09-12');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(850,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Felix Adler: 1 × Limonade 0,33 am 2026-09-13');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(851,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Sabine Klein: 1 × Süßes am 2026-09-13');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(852,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Tobias Neumann: 1 × Apfelschorle 0,5 am 2026-09-13');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(853,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Thomas Keller: 1 × Apfelschorle 0,5 am 2026-09-13');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(854,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Andreas Nagel: 1 × Limonade 0,33 am 2026-09-13');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(855,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Felix Adler: 1 × Limonade 0,33 am 2026-09-13');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(856,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Florian Peters: 2 × Weizen alkoholfrei 0,5 am 2026-09-14');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(857,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Felix Adler: 1 × Wasser 0,7 am 2026-09-16');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(858,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Sebastian Sauer: 1 × Chips am 2026-09-16');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(859,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Daniel Graf: 1 × Cola 0,33 am 2026-09-16');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(860,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Anna Becker: 1 × Pils 0,33 am 2026-09-16');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(861,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Anna Becker: 1 × Chips am 2026-09-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(862,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Felix Adler: 2 × Bier 0,33 am 2026-09-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(863,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Peter Hofmann: 1 × Chips am 2026-09-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(864,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Florian Peters: 1 × Kaffee am 2026-09-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(865,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Felix Adler: 1 × Bier alkoholfrei 0,33 am 2026-09-19');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(866,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Stefan Brandt: 1 × Chips am 2026-09-19');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(867,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Apfelschorle 0,5 am 2026-09-19');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(868,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Jan Albrecht: 1 × Weizen alkoholfrei 0,5 am 2026-09-19');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(869,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Lea Wagner: 1 × Chips am 2026-09-19');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(870,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Katrin Frank: 1 × Süßes am 2026-09-19');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(871,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Tim Walter: 1 × Pils 0,33 am 2026-09-20');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(872,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Peter Hofmann: 1 × Bier alkoholfrei 0,33 am 2026-09-20');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(873,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Sabine Klein: 1 × Radler 0,33 am 2026-09-20');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(874,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Apfelschorle 0,5 am 2026-09-20');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(875,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Jan Albrecht: 2 × Chips am 2026-09-20');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(876,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Daniel Graf: 1 × Weizen alkoholfrei 0,5 am 2026-09-20');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(877,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Miriam Bauer: 2 × Pils 0,33 am 2026-09-20');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(878,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Moritz Wolf: 1 × Radler 0,33 am 2026-09-20');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(879,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Florian Peters: 1 × Kaffee am 2026-09-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(880,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Anna Becker: 1 × Bier 0,33 am 2026-09-22');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(881,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Julia Fischer: 1 × Kaffee am 2026-09-23');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(882,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Daniel Graf: 1 × Radler 0,33 am 2026-09-23');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(883,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Daniel Graf: 1 × Kaffee am 2026-09-23');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(884,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Tim Walter: 2 × Bier 0,33 am 2026-09-24');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(885,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Martin Huber: 2 × Bier 0,33 am 2026-09-24');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(886,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Felix Adler: 1 × Weizen 0,5 am 2026-09-25');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(887,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Peter Hofmann: 1 × Weizen 0,5 am 2026-09-26');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(888,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Felix Adler: 1 × Apfelschorle 0,5 am 2026-09-26');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(889,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Andreas Nagel: 1 × Limonade 0,33 am 2026-09-26');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(890,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Jonas Schmitt: 2 × Radler 0,33 am 2026-09-26');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(891,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Cola Zero 0,33 am 2026-09-26');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(892,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Daniel Graf: 1 × Kaffee am 2026-09-26');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(893,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Martin Huber: 1 × Radler 0,33 am 2026-09-26');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(894,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Stefan Brandt: 1 × Cola 0,33 am 2026-09-26');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(895,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Lea Wagner: 2 × Bier 0,33 am 2026-09-26');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(896,'2026-09-20 14:55:27','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Cola Zero 0,33 am 2026-09-26');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(897,'2026-09-20 14:55:27','admin','Alle Konten abgerechnet','25 Konten: 157,50 € (Stand 2026-09-27 14:55)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(899,'2026-09-21 14:55:28','admin','Inventur','4 Abweichungen');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(900,'2026-09-21 14:55:28','admin','Bruch gebucht','Weizen 0,5: -2');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(901,'2026-09-21 14:55:28','admin','Bruch gebucht','Wasser 0,7: -1');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(903,'2026-09-27 14:55:29','admin','E-Mail: Vorlage angelegt','Einladung Veranstaltung');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(904,'2026-09-27 14:55:29','admin','Nachricht gesendet','Nr. 1 · App, Push · 43 Empfänger');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(905,'2026-10-03 14:55:30','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(906,'2026-10-03 14:55:30','admin','Lieferung gespeichert','Getränke Muster GmbH 2026-10-10 Beleg LS-48213 (7 Positionen)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(907,'2026-10-05 14:55:32','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(908,'2026-10-05 14:55:32','admin','Veranstaltung angelegt','Saisonabschluss');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(909,'2026-10-05 14:55:32','admin','Veranstaltung aktiviert','Saisonabschluss');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(910,'2026-10-05 14:55:32','admin','Veranstaltung: hat bezahlt','Uwe Beispiel (Gast): 7,50 € bar');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(911,'2026-10-05 14:55:32','admin','Veranstaltung: hat bezahlt','Karin Muster (Gast): 7,50 € mit Karte');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(912,'2026-10-05 14:55:32','admin','Veranstaltung: hat bezahlt','Trainer SV Musterdorf: 8,50 € bar');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(913,'2026-10-05 14:55:32','admin','Veranstaltung: hat bezahlt','Felix Adler: 5,00 € bar');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(914,'2026-10-05 14:55:32','admin','Veranstaltung: hat bezahlt','Peter Hofmann: 5,50 € mit Karte');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(915,'2026-10-05 14:55:32','admin','Veranstaltung übernommen','Saisonabschluss: 10 Personen, 55,00 € auf die Konten');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(916,'2026-10-05 14:55:32','admin','Veranstaltung abgeschlossen','Saisonabschluss, Kasse 32,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(917,'2026-10-12 14:55:33','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(918,'2026-10-12 14:55:33','admin','Lieferung gespeichert','Großmarkt Beispiel 2026-10-19 (2 Positionen)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(919,'2026-10-16 14:55:34','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(920,'2026-10-16 14:55:35','admin','Nachricht gesendet','Nr. 2 · App · 43 Empfänger');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(921,'2026-10-20 14:55:36','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(922,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Andreas Nagel: 2 × Limonade 0,33 am 2026-09-28');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(923,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jan Albrecht: 2 × Bier alkoholfrei 0,33 am 2026-09-28');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(924,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jonas Schmitt: 2 × Bier alkoholfrei 0,33 am 2026-09-29');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(925,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Felix Adler: 2 × Radler 0,33 am 2026-09-30');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(926,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Martin Huber: 1 × Kaffee am 2026-09-30');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(927,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jonas Schmitt: 2 × Wasser 0,7 am 2026-09-30');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(928,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Anna Becker: 1 × Weizen alkoholfrei 0,5 am 2026-10-02');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(929,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Katrin Frank: 1 × Limonade 0,33 am 2026-10-03');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(930,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jan Albrecht: 2 × Süßes am 2026-10-03');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(931,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Tobias Neumann: 1 × Cola 0,33 am 2026-10-03');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(932,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jan Albrecht: 1 × Kaffee am 2026-10-03');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(933,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Peter Hofmann: 1 × Weizen 0,5 am 2026-10-03');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(934,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Radler 0,33 am 2026-10-03');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(935,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Markus Weber: 1 × Pils 0,33 am 2026-10-03');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(936,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Dominik Simon: 2 × Apfelschorle 0,5 am 2026-10-03');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(937,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Stefan Brandt: 1 × Cola 0,33 am 2026-10-03');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(938,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Laura Schulz: 2 × Wasser 0,7 am 2026-10-04');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(939,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Tobias Neumann: 1 × Chips am 2026-10-04');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(940,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Katrin Frank: 1 × Bier 0,33 am 2026-10-04');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(941,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Peter Hofmann: 1 × Chips am 2026-10-04');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(942,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Thomas Keller: 1 × Pils 0,33 am 2026-10-04');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(943,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Tobias Neumann: 2 × Wasser 0,7 am 2026-10-04');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(944,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Wasser 0,7 am 2026-10-04');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(945,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Andreas Nagel: 2 × Radler 0,33 am 2026-10-04');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(946,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Tobias Neumann: 1 × Radler 0,33 am 2026-10-06');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(947,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Pils 0,33 am 2026-10-06');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(948,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jan Albrecht: 1 × Pils 0,33 am 2026-10-07');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(949,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Peter Hofmann: 1 × Pils 0,33 am 2026-10-07');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(950,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Christian Maier: 2 × Apfelschorle 0,5 am 2026-10-07');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(951,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Süßes am 2026-10-08');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(952,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Martin Huber: 1 × Bier 0,33 am 2026-10-08');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(953,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Weizen alkoholfrei 0,5 am 2026-10-10');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(954,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Daniel Graf: 2 × Limonade 0,33 am 2026-10-10');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(955,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Stefan Brandt: 1 × Weizen 0,5 am 2026-10-10');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(956,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Stefan Brandt: 2 × Wasser 0,7 am 2026-10-10');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(957,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Julia Fischer: 1 × Cola 0,33 am 2026-10-10');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(958,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Nina Dietrich: 1 × Pils 0,33 am 2026-10-10');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(959,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Martin Huber: 1 × Cola Zero 0,33 am 2026-10-10');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(960,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Nina Dietrich: 1 × Limonade 0,33 am 2026-10-10');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(961,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Martin Huber: 1 × Bier 0,33 am 2026-10-10');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(962,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Oliver Engel: 1 × Kaffee am 2026-10-11');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(963,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Stefan Brandt: 1 × Limonade 0,33 am 2026-10-11');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(964,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Anna Becker: 1 × Apfelschorle 0,5 am 2026-10-11');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(965,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Stefan Brandt: 2 × Weizen 0,5 am 2026-10-11');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(966,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Pils 0,33 am 2026-10-11');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(967,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jan Albrecht: 1 × Pils 0,33 am 2026-10-11');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(968,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Laura Schulz: 1 × Limonade 0,33 am 2026-10-14');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(969,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Laura Schulz: 2 × Pils 0,33 am 2026-10-14');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(970,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Markus Weber: 1 × Bier alkoholfrei 0,33 am 2026-10-14');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(971,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Markus Weber: 1 × Cola Zero 0,33 am 2026-10-14');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(972,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Christian Maier: 1 × Bier alkoholfrei 0,33 am 2026-10-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(973,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Peter Hofmann: 2 × Süßes am 2026-10-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(974,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Daniel Graf: 1 × Pils 0,33 am 2026-10-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(975,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Dominik Simon: 2 × Weizen 0,5 am 2026-10-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(976,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Miriam Bauer: 2 × Cola Zero 0,33 am 2026-10-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(977,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Oliver Engel: 1 × Cola 0,33 am 2026-10-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(978,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Sophie Hahn: 1 × Weizen alkoholfrei 0,5 am 2026-10-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(979,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Daniel Graf: 1 × Weizen 0,5 am 2026-10-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(980,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Tobias Neumann: 1 × Weizen alkoholfrei 0,5 am 2026-10-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(981,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Anna Becker: 1 × Pils 0,33 am 2026-10-17');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(982,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Martin Huber: 1 × Pils 0,33 am 2026-10-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(983,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Stefan Brandt: 1 × Pils 0,33 am 2026-10-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(984,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Felix Adler: 1 × Süßes am 2026-10-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(985,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Martin Huber: 1 × Süßes am 2026-10-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(986,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Oliver Engel: 1 × Pils 0,33 am 2026-10-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(987,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Andreas Nagel: 1 × Cola Zero 0,33 am 2026-10-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(988,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Moritz Wolf: 2 × Pils 0,33 am 2026-10-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(989,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Martin Huber: 1 × Cola Zero 0,33 am 2026-10-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(990,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Felix Adler: 1 × Süßes am 2026-10-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(991,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Apfelschorle 0,5 am 2026-10-18');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(992,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Dominik Simon: 2 × Weizen alkoholfrei 0,5 am 2026-10-19');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(993,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Anna Becker: 2 × Limonade 0,33 am 2026-10-20');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(994,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Martin Huber: 1 × Weizen alkoholfrei 0,5 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(995,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Andreas Nagel: 2 × Pils 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(996,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Anna Becker: 2 × Bier alkoholfrei 0,33 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(997,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Michael Lang: 1 × Apfelschorle 0,5 am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(998,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Martin Huber: 1 × Kaffee am 2026-10-21');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(999,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Felix Adler: 1 × Weizen 0,5 am 2026-10-22');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1000,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Peter Hofmann: 1 × Bier 0,33 am 2026-10-22');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1001,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Felix Adler: 1 × Bier 0,33 am 2026-10-24');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1002,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Tobias Neumann: 1 × Weizen 0,5 am 2026-10-24');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1003,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Cola Zero 0,33 am 2026-10-24');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1004,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Anna Becker: 1 × Pils 0,33 am 2026-10-24');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1005,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Felix Adler: 1 × Apfelschorle 0,5 am 2026-10-24');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1006,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Lea Wagner: 1 × Kaffee am 2026-10-24');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1007,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Weizen 0,5 am 2026-10-24');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1008,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jan Albrecht: 1 × Kaffee am 2026-10-24');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1009,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Daniel Graf: 1 × Bier 0,33 am 2026-10-25');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1010,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Jan Albrecht: 2 × Pils 0,33 am 2026-10-25');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1011,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Tobias Neumann: 1 × Süßes am 2026-10-25');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1012,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Philipp Schreiber: 1 × Pils 0,33 am 2026-10-25');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1013,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Markus Weber: 1 × Weizen alkoholfrei 0,5 am 2026-10-25');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1014,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Stefan Brandt: 2 × Limonade 0,33 am 2026-10-25');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1015,'2026-10-20 14:55:36','admin','Buchung nachgetragen','Anna Becker: 1 × Radler 0,33 am 2026-10-25');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1016,'2026-10-20 14:55:36','admin','Nachricht gesendet','Nr. 3 · App · 43 Empfänger');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1017,'2026-10-21 14:55:37','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1018,'2026-10-21 14:55:38','tablet','Gäste-Deckel geöffnet','Gäste Platz 2 (Familie Beispiel)');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1019,'2026-10-21 14:55:38','tablet','Gäste-Deckel bar bezahlt','Gäste Platz 2 (Familie Beispiel): 4,00 €');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1020,'2026-10-21 14:55:38','tablet','Gäste-Deckel geöffnet','Gastmannschaft SV Musterdorf');
INSERT INTO "audit_log"(id, at, username, action, detail) VALUES(1021,'2026-10-21 14:55:38','admin','Datenschutz: Hinweis der Mitglieder-App geändert','1033 Zeichen');
INSERT INTO "bank_accounts"(id, name, holder, iban, bic, bank, departments, is_default, active, sort, created_at) VALUES(1,'Vereinskonto','TC Grün-Weiß Musterstadt','DE02120300000000202051','BYLADEM1001','Musterbank','[]',1,1,100,'2026-02-13 14:52:51');
INSERT INTO "mail_message"(id, subject, html, spec, files, status, copy_me, from_name, reply_to, signature_html, user_id, user_name, created_at, updated_at, sent_at, total, sent, failed, channels, keep_months, expires_at, pinned, app_stats) VALUES(1,'Einladung zum Saisonabschluss','<p>{briefanrede},</p><p>die Freiluftsaison geht zu Ende – das feiern wir gemeinsam! Am <strong>12.10.2026</strong> ab 17 Uhr gibt es im Vereinsheim Gegrilltes, Getränke zum Saisonabschluss-Preis und die Siegerehrung der Clubmeisterschaft.</p><p>Gäste sind willkommen. Getränke bitte am Tablet auf die Veranstaltungsliste buchen.</p><p>Bis bald<br>Dein Vorstand</p>','{"groups":[{"t":"status","v":"aktuell"}],"members":[],"addresses":[],"payer":true,"allApp":true,"lists":[]}','[]','gesendet',1,'Adminkonto',NULL,NULL,1,'Adminkonto','2026-09-27 14:55:29','2026-09-27 14:55:29','2026-09-27 14:55:29',43,43,0,'["app","push"]',NULL,'2027-03-28',0,NULL);
INSERT INTO "mail_message"(id, subject, html, spec, files, status, copy_me, from_name, reply_to, signature_html, user_id, user_name, created_at, updated_at, sent_at, total, sent, failed, channels, keep_months, expires_at, pinned, app_stats) VALUES(2,'Plätze 3 und 4 gesperrt','<p>{briefanrede},</p><p>wegen der Herbstarbeiten sind die Plätze 3 und 4 ab sofort bis auf Weiteres gesperrt. Die Plätze 1 und 2 bleiben bespielbar, solange das Wetter mitspielt.</p><p>Danke für dein Verständnis!<br>Der Platzwart</p>','{"groups":[{"t":"status","v":"aktuell"}],"members":[],"addresses":[],"payer":true,"allApp":true,"lists":[]}','[]','gesendet',1,'Adminkonto',NULL,NULL,1,'Adminkonto','2026-10-16 14:55:34','2026-10-16 14:55:34','2026-10-16 14:55:35',43,43,0,'["app"]',NULL,'2027-04-16',0,NULL);
INSERT INTO "mail_message"(id, subject, html, spec, files, status, copy_me, from_name, reply_to, signature_html, user_id, user_name, created_at, updated_at, sent_at, total, sent, failed, channels, keep_months, expires_at, pinned, app_stats) VALUES(3,'Wintertraining in der Halle','<p>{briefanrede},</p><p>ab November trainieren wir wieder in der Sporthalle der Grundschule Musterstadt: dienstags 18–20 Uhr Erwachsene, donnerstags 16–18 Uhr Jugend.</p><p>Bitte Hallenschuhe mitbringen.</p>','{"groups":[{"t":"status","v":"aktuell"}],"members":[],"addresses":[],"payer":true,"allApp":true,"lists":[]}','[]','gesendet',1,'Adminkonto',NULL,NULL,1,'Adminkonto','2026-10-20 14:55:36','2026-10-20 14:55:36','2026-10-20 14:55:36',43,43,0,'["app"]',NULL,NULL,1,NULL);
INSERT INTO "mail_template"(id, name, subject, html, updated_by, updated_at) VALUES(1,'Einladung Veranstaltung','Einladung: …','<p>{briefanrede},</p><p>wir laden dich herzlich ein zu …</p><p>Wann: …<br>Wo: Vereinsheim</p><p>Wir freuen uns auf dich!<br>Dein Vorstand des {verein}</p>','Adminkonto','2026-09-27 14:55:29');
INSERT INTO "member_devices"(id, scope, member_id, invite_hash, invite_expires, token_hash, pin_hash, device, created_by, created_at, paired_at, last_used, failed, locked_until, failed_total, blocked_at, issuer_perms, transfer_hash, transfer_expires, paired_host, token2_hash, handover_hash, handover_expires, invite_kind, used_hash, used_at, used_alerted, remote, verified, otp_hash, otp_expires, otp_tries, otp_day, otp_count, otp_last, pin_synced) VALUES(5,'app',4,NULL,NULL,'00a3fbaf737dc37c63a03ccc2a49c5ab:d556e50757f98156c6656068d3e8bf93a4d4402c15380a666bac5edeab71e593','354ec6877294c7dadd7a530decf2905d:f469fb6e9868617941151f1dde26c542ce1514f5485148dbef673a7b8c8fe5cc','Gerät · Chrome','Adminkonto','2026-02-13 14:52:50','2026-10-21 19:17:49',NULL,0,NULL,0,NULL,'*','c958e44d4b996b2b88c67b4c3a93936d:f0bab5338cd6985fa2e321631e37055163c3db0d654891c772cf0c9da234f84b',1793207869494,'127.0.0.1:5803',NULL,NULL,NULL,'qr','d93e0177f1ff7c6737449519965209c0:a98a271f84e55fb8ca5e584f68f8a161e6518feda2d979739bb7fa37a58fd957','2026-10-21 19:17:49',0,0,NULL,NULL,NULL,0,NULL,0,NULL,1);
INSERT INTO "member_devices"(id, scope, member_id, invite_hash, invite_expires, token_hash, pin_hash, device, created_by, created_at, paired_at, last_used, failed, locked_until, failed_total, blocked_at, issuer_perms, transfer_hash, transfer_expires, paired_host, token2_hash, handover_hash, handover_expires, invite_kind, used_hash, used_at, used_alerted, remote, verified, otp_hash, otp_expires, otp_tries, otp_day, otp_count, otp_last, pin_synced) VALUES(22,'app',3,NULL,NULL,'ae3cbd26a164a12394721d8e7ee57ecd:19ddb08eb04ced1e6d32aec7712bf732ca282a29424c41253e51484e7e13e868','2e00ff092ca5d4258998b328a3a1da21:a8d5c56a24e87aac58e751486a84fb3c5a3b7253482f60307224abbeb11a419f','Gerät · Chrome','Adminkonto','2026-02-13 14:52:50','2026-10-21 23:25:08',NULL,0,NULL,0,NULL,'*','7b846fc97ca423f6be6922e421af85de:6406c0e218127a932ac2b690a7500523b02e8eec535b067e7a0b592447a52efa',1793222708114,'127.0.0.1:5803',NULL,NULL,NULL,'qr','36e5525bb68ddfdc7a7769c8c16b5292:6b9e4e5c79a63b026ba10a95d01b0136b7d24b838d9769602f1e9ea549152881','2026-10-21 23:25:08',0,0,NULL,NULL,NULL,0,NULL,0,NULL,1);
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(1,'Verein (kostenfrei)','verein',NULL,1,0,NULL,'2026-02-13 14:52:50',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(2,'Gast (bar)','gast',NULL,1,0,NULL,'2026-02-13 14:52:50',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(3,'Felix Adler','mitglied','f6e82245b285d9752bf83ba6691cb239:65ed90b7a3d0a8bd5c55ce09a05ae3b585f6fdf5d64e0d41d4156fa476ca3482',1,0,NULL,'2026-02-13 14:52:50',0,'Felix','Adler',0,0,'2026-10-21 17:36:07','Mitglieder-App',NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(4,'Anna Becker','mitglied','8416332b7f8701930b73f819e6aaa766:c16718f3ed5352d574c19e8fa91118b2733408f098a64c7656bbc850ee20d186',1,0,NULL,'2026-02-13 14:52:50',0,'Anna','Becker',0,0,'2026-10-21 19:14:10','Mitglieder-App',NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(5,'Jonas Schmitt','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Jonas','Schmitt',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(6,'Lea Wagner','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Lea','Wagner',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(7,'Peter Hofmann','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Peter','Hofmann',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(8,'Sabine Klein','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Sabine','Klein',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(9,'Markus Weber','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Markus','Weber',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(10,'Julia Fischer','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Julia','Fischer',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(11,'Tobias Neumann','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Tobias','Neumann',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(12,'Laura Schulz','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Laura','Schulz',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(13,'Max Gast','extern',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Max','Gast',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(14,'Jan Albrecht','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Jan','Albrecht',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(15,'Miriam Bauer','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Miriam','Bauer',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(16,'Stefan Brandt','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Stefan','Brandt',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(17,'Nina Dietrich','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Nina','Dietrich',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(18,'Oliver Engel','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Oliver','Engel',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(19,'Katrin Frank','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Katrin','Frank',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(20,'Daniel Graf','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Daniel','Graf',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(21,'Sophie Hahn','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Sophie','Hahn',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(22,'Martin Huber','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Martin','Huber',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(23,'Lena Jäger','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Lena','Jäger',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(24,'Thomas Keller','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Thomas','Keller',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(25,'Sarah König','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Sarah','König',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(26,'Michael Lang','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Michael','Lang',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(27,'Hanna Lorenz','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Hanna','Lorenz',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(28,'Christian Maier','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Christian','Maier',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(29,'Paula Möller','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Paula','Möller',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(30,'Andreas Nagel','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Andreas','Nagel',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(31,'Emma Otto','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Emma','Otto',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(32,'Florian Peters','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Florian','Peters',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(33,'Clara Roth','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Clara','Roth',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(34,'Sebastian Sauer','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Sebastian','Sauer',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(35,'Marie Schäfer','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Marie','Schäfer',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(36,'Philipp Schreiber','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Philipp','Schreiber',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(37,'Johanna Seidel','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Johanna','Seidel',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(38,'Dominik Simon','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Dominik','Simon',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(39,'Katharina Vogel','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Katharina','Vogel',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(40,'Tim Walter','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Tim','Walter',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(41,'Lisa Winkler','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Lisa','Winkler',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(42,'Moritz Wolf','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Moritz','Wolf',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(43,'Elena Ziegler','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:50',0,'Elena','Ziegler',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(44,'Mia Hofmann','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:52',0,'Mia','Hofmann',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(45,'Ben Hofmann','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:52',0,'Ben','Hofmann',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members"(id, name, kind, pin_hash, active, failed_pins, locked_until, created_at, pending, first_name, last_name, deleted, pin_strikes, pin_changed_at, pin_changed_by, photo, photo_use) VALUES(46,'Paul Weber','mitglied',NULL,1,0,NULL,'2026-02-13 14:52:52',0,'Paul','Weber',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(1,1,3,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(2,1,14,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(3,1,15,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(4,1,4,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(5,1,16,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(6,1,17,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(7,1,18,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(8,1,10,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(9,1,19,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(10,1,20,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(11,1,21,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(12,1,45,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(13,1,44,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(14,1,7,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(15,1,22,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(16,1,23,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(17,1,24,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(18,1,8,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(19,1,25,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(20,1,26,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(21,1,27,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(22,1,28,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(23,1,29,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(24,1,30,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(25,1,11,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(26,1,31,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(27,1,32,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(28,1,33,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(29,1,34,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(30,1,35,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(31,1,5,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(32,1,36,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(33,1,12,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(34,1,37,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(35,1,38,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(36,1,39,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(37,1,6,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(38,1,40,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(39,1,9,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(40,1,46,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(41,1,41,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(42,1,42,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(43,1,43,NULL,'nein');
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(44,2,3,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(45,2,14,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(46,2,15,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(47,2,4,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(48,2,16,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(49,2,17,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(50,2,18,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(51,2,10,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(52,2,19,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(53,2,20,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(54,2,21,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(55,2,45,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(56,2,44,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(57,2,7,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(58,2,22,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(59,2,23,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(60,2,24,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(61,2,8,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(62,2,25,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(63,2,26,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(64,2,27,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(65,2,28,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(66,2,29,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(67,2,30,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(68,2,11,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(69,2,31,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(70,2,32,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(71,2,33,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(72,2,34,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(73,2,35,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(74,2,5,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(75,2,36,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(76,2,12,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(77,2,37,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(78,2,38,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(79,2,39,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(80,2,6,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(81,2,40,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(82,2,9,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(83,2,46,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(84,2,41,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(85,2,42,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(86,2,43,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(87,3,3,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(88,3,14,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(89,3,15,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(90,3,4,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(91,3,16,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(92,3,17,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(93,3,18,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(94,3,10,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(95,3,19,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(96,3,20,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(97,3,21,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(98,3,45,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(99,3,44,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(100,3,7,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(101,3,22,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(102,3,23,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(103,3,24,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(104,3,8,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(105,3,25,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(106,3,26,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(107,3,27,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(108,3,28,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(109,3,29,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(110,3,30,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(111,3,11,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(112,3,31,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(113,3,32,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(114,3,33,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(115,3,34,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(116,3,35,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(117,3,5,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(118,3,36,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(119,3,12,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(120,3,37,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(121,3,38,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(122,3,39,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(123,3,6,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(124,3,40,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(125,3,9,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(126,3,46,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(127,3,41,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(128,3,42,NULL,NULL);
INSERT INTO "msg_inbox"(id, message_id, member_id, read_at, push) VALUES(129,3,43,NULL,NULL);
INSERT INTO "mv_dunning"(id, member_id, date, level, title, cents, fee_cents, fee_id, ref, charges, via, by_user, created_at) VALUES(1,11,'2026-03-31',1,'Zahlungserinnerung',21300,0,NULL,'RE-2026-0005','[{"id":49,"text":"Erwachsene 01/2026–12/2026","cents":12000,"level":1,"adv":true},{"id":50,"text":"Tennis Erwachsene 01/2026–12/2026","cents":9000,"level":1,"adv":true},{"id":87,"text":"Gebühr Rücklastschrift vom 16.03.2026","cents":300,"level":1,"adv":true}]','brief','Adminkonto','2026-03-31 14:52:56');
INSERT INTO "mv_dunning"(id, member_id, date, level, title, cents, fee_cents, fee_id, ref, charges, via, by_user, created_at) VALUES(2,33,'2026-03-31',1,'Zahlungserinnerung',11000,0,NULL,'RE-2026-0004','[{"id":56,"text":"Tennis Erwachsene 01/2026–12/2026","cents":9000,"level":1,"adv":true},{"id":88,"text":"Rest: Erwachsene 01/2026–12/2026","cents":2000,"level":1,"adv":true}]','brief','Adminkonto','2026-03-31 14:52:56');
INSERT INTO "mv_dunning"(id, member_id, date, level, title, cents, fee_cents, fee_id, ref, charges, via, by_user, created_at) VALUES(3,12,'2026-03-31',1,'Zahlungserinnerung',21000,0,NULL,'RE-2026-0001','[{"id":66,"text":"Erwachsene 01/2026–12/2026","cents":12000,"level":1,"adv":true},{"id":67,"text":"Tennis Erwachsene 01/2026–12/2026","cents":9000,"level":1,"adv":true}]','brief','Adminkonto','2026-03-31 14:52:56');
INSERT INTO "mv_dunning"(id, member_id, date, level, title, cents, fee_cents, fee_id, ref, charges, via, by_user, created_at) VALUES(4,11,'2026-04-16',2,'1. Mahnung',21550,250,89,'RE-2026-0005','[{"id":49,"text":"Erwachsene 01/2026–12/2026","cents":12000,"level":2,"adv":true},{"id":50,"text":"Tennis Erwachsene 01/2026–12/2026","cents":9000,"level":2,"adv":true},{"id":87,"text":"Gebühr Rücklastschrift vom 16.03.2026","cents":300,"level":2,"adv":true}]','brief','Adminkonto','2026-04-16 14:52:58');
INSERT INTO "mv_dunning"(id, member_id, date, level, title, cents, fee_cents, fee_id, ref, charges, via, by_user, created_at) VALUES(5,12,'2026-04-16',2,'1. Mahnung',21250,250,90,'RE-2026-0001','[{"id":66,"text":"Erwachsene 01/2026–12/2026","cents":12000,"level":2,"adv":true},{"id":67,"text":"Tennis Erwachsene 01/2026–12/2026","cents":9000,"level":2,"adv":true}]','brief','Adminkonto','2026-04-16 14:52:58');
INSERT INTO "mv_dunning"(id, member_id, date, level, title, cents, fee_cents, fee_id, ref, charges, via, by_user, created_at) VALUES(6,12,'2026-05-02',3,'2. Mahnung',21500,250,91,'RE-2026-0001','[{"id":66,"text":"Erwachsene 01/2026–12/2026","cents":12000,"level":3,"adv":true},{"id":67,"text":"Tennis Erwachsene 01/2026–12/2026","cents":9000,"level":3,"adv":true},{"id":90,"text":"Mahngebühr (1. Mahnung vom 23.04.2026)","cents":250,"level":3,"adv":true}]','brief','Adminkonto','2026-05-02 14:52:59');
INSERT INTO "settings"(key, value) VALUES('mig_event_guests','1');
INSERT INTO "settings"(key, value) VALUES('roles_seeded','1');
INSERT INTO "settings"(key, value) VALUES('mig_member_settle','1');
INSERT INTO "settings"(key, value) VALUES('art_icons_v1','1');
INSERT INTO "settings"(key, value) VALUES('pin_sync_324','1');
INSERT INTO "settings"(key, value) VALUES('update_running_version','3.91.1');
INSERT INTO "settings"(key, value) VALUES('mail_perm_migrated','1');
INSERT INTO "settings"(key, value) VALUES('club_name','TC Grün-Weiß Musterstadt');
INSERT INTO "settings"(key, value) VALUES('tablet_pw_hash','3fe3a76d426fe51b69bb9a6b8937c2ed:dd290266288a1608062507df24ca66581e8e66c979c0c5627c44baa1550be1f8');
INSERT INTO "settings"(key, value) VALUES('tablet_pw_at','2026-10-21 17:26:50');
INSERT INTO "settings"(key, value) VALUES('tablet_pw_ver','225fbcf5849c');
INSERT INTO "settings"(key, value) VALUES('app_url','http://127.0.0.1:5803');
INSERT INTO "settings"(key, value) VALUES('tablet_gate_secret','d302e305702715a4b8a0ec7da1f814f873cfae8e907772615c20f0dff9ed1e9d');
INSERT INTO "settings"(key, value) VALUES('app_module_order','["spielbetrieb","buchung","mitglieder","arbeitseinsatz","zugang","beregnung"]');
INSERT INTO "settings"(key, value) VALUES('app_preselect','{"beregnung":false}');
INSERT INTO "settings"(key, value) VALUES('club_logo','PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMTIwIj48c3R5bGU+Lmd7ZmlsbDojMDA4NDNkfTwvc3R5bGU+CjxjaXJjbGUgY3g9IjYwIiBjeT0iNjAiIHI9IjUwIiBjbGFzcz0iZyIvPjxjaXJjbGUgY3g9IjYwIiBjeT0iNjAiIHI9IjMwIiBmaWxsPSIjZmZmZmZmIi8+CjxyZWN0IHg9IjEyMCIgeT0iMjAiIHdpZHRoPSI3MCIgaGVpZ2h0PSI4MCIgZmlsbD0iIzAwODQzZCIvPjxhPjx0ZXh0IHg9IjEyNSIgeT0iNzAiIGZpbGw9IiNmZmYiPlRDPC90ZXh0PjwvYT48L3N2Zz4=');
INSERT INTO "settings"(key, value) VALUES('club_logo_type','svg');
INSERT INTO "settings"(key, value) VALUES('club_logo_ver','1792607925689');
INSERT INTO "settings"(key, value) VALUES('club_icon','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');
INSERT INTO "settings"(key, value) VALUES('club_icon_ver','1792607925689:#1f6b3a:2');
INSERT INTO "settings"(key, value) VALUES('club_logo_png','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');
INSERT INTO "settings"(key, value) VALUES('club_logo_png_ver','1792607925689');
INSERT INTO "settings"(key, value) VALUES('setup_state','{"ok":["willkommen","verein","module","getraenke.artikel","buchung.plaetze","buchung.regeln"],"skip":["postfach"],"hide":[]}');
INSERT INTO "settings"(key, value) VALUES('mig_app_perm','1');
INSERT INTO "settings"(key, value) VALUES('mig_club_address','1');
INSERT INTO "settings"(key, value) VALUES('mig_app_start','1');
INSERT INTO "settings"(key, value) VALUES('update_last_error','');
INSERT INTO "settings"(key, value) VALUES('admin_device_secret','0c1aab950d4f41e27c2c37095c40f092b4681d75306d63253c040c9040776dce');
INSERT INTO "settings"(key, value) VALUES('app_privacy_text','Datenschutzhinweis für die Mitglieder-App

Verantwortlich: TC Grün-Weiß Musterstadt e. V., Musterstraße 1, 12345 Musterstadt, vorstand@example.org

Welche Daten? Name, Mitgliedschaft und was du in der App selbst einträgst oder nutzt (z. B. Platzbuchungen, Helferstunden, Meldungen). Kontakt- und Bankdaten nur, soweit du sie dem Verein gegeben hast.

Wofür? Für die Mitgliederverwaltung und den Vereinsbetrieb (Art. 6 Abs. 1 b DSGVO, Satzung). Freiwillige Angaben nur mit deiner Einwilligung, die du jederzeit widerrufen kannst.

Wo? Die Daten liegen auf dem Server des Vereins im Vereinsheim. Persönliche Daten sind verschlüsselt. Es gibt keine Werbung und keine Weitergabe an Dritte.

Wie lange? Nur so lange wie nötig. Protokolle werden nach festen Fristen automatisch gelöscht. Nach dem Austritt bleiben nur Daten, die der Verein gesetzlich aufbewahren muss.

Deine Rechte: Auskunft (unter „Meine Daten“), Berichtigung, Löschung, Einschränkung, Widerspruch und Beschwerde bei der Datenschutz-Aufsichtsbehörde deines Bundeslandes.');
INSERT INTO "settings"(key, value) VALUES('app_privacy_at','2026-10-21 14:55:38');
COMMIT;
