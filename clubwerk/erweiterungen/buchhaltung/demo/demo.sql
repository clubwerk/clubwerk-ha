-- Clubwerk Demo-Daten (erfunden): Buchhaltung. Bearbeiten: siehe werkzeuge/demo/aufteilen.js
BEGIN;
CREATE TABLE IF NOT EXISTS "bh_donation" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, no TEXT NOT NULL UNIQUE, year INTEGER NOT NULL, donor_type TEXT NOT NULL,  -- member | partner | einmalig
  member_id INTEGER, partner_id INTEGER, donor TEXT NOT NULL, kind TEXT NOT NULL,                     -- geld | sach | verzicht
  date TEXT NOT NULL, cents INTEGER NOT NULL, item TEXT, sach_origin TEXT, sach_docs INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aktiv', sent_at TEXT, cancel_reason TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS "bh_invoice" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, no TEXT NOT NULL UNIQUE, year INTEGER NOT NULL, kind TEXT NOT NULL,      -- partner | member
  partner_id INTEGER, member_id INTEGER, recipient TEXT NOT NULL, date TEXT NOT NULL, due_date TEXT, period TEXT, intro TEXT, note TEXT,
  items TEXT NOT NULL, net INTEGER NOT NULL, vat INTEGER NOT NULL, gross INTEGER NOT NULL, small_business INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'offen',                                                            -- offen | bezahlt | storniert
  paid_at TEXT, paid_via TEXT, sent_at TEXT, reminders INTEGER NOT NULL DEFAULT 0, reminded_at TEXT, charge_id INTEGER, yearly INTEGER,
  cancel_reason TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, department_id INTEGER, account_id INTEGER, bank TEXT);
CREATE TABLE IF NOT EXISTS "bh_partner" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT, street TEXT, zip TEXT, city TEXT, country TEXT, email TEXT, phone TEXT, vat_id TEXT, customer_no TEXT,
  items TEXT NOT NULL DEFAULT '[]',          -- jährliche Rechnungspositionen [{ text, qty, unit_cents, vat }]
  note TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, department_id INTEGER);
CREATE INDEX IF NOT EXISTS ix_bh_inv ON bh_invoice(status, due_date);
INSERT INTO "bh_donation"(id, no, year, donor_type, member_id, partner_id, donor, kind, date, cents, item, sach_origin, sach_docs, status, sent_at, cancel_reason, created_by, created_at) VALUES(1,'SQ-2026-0001',2026,'member',26,NULL,'{"name":"Michael Lang","street":"Gartenstraße 37","zip":"12345","city":"Musterstadt","email":"michael.lang@example.org"}','geld','2026-09-16',10000,NULL,NULL,0,'aktiv',NULL,NULL,'Adminkonto','2026-09-21 14:53:01');
INSERT INTO "bh_donation"(id, no, year, donor_type, member_id, partner_id, donor, kind, date, cents, item, sach_origin, sach_docs, status, sent_at, cancel_reason, created_by, created_at) VALUES(2,'SQ-2026-0002',2026,'partner',NULL,1,'{"name":"Musterbau GmbH","street":"Industriestraße 5","zip":"12345","city":"Musterstadt","email":"buchhaltung@musterbau.example.org"}','sach','2026-09-19',45000,'Ballmaschine, gebraucht (2 Jahre), guter Zustand, Kaufpreis 900 €','betrieb',0,'aktiv',NULL,NULL,'Adminkonto','2026-09-21 14:53:01');
INSERT INTO "bh_donation"(id, no, year, donor_type, member_id, partner_id, donor, kind, date, cents, item, sach_origin, sach_docs, status, sent_at, cancel_reason, created_by, created_at) VALUES(3,'SQ-2026-0003',2026,'einmalig',NULL,NULL,'{"name":"Gerda Muster","street":"Rosenweg 12","zip":"12345","city":"Musterstadt","email":"gerda.muster@example.org"}','geld','2026-09-20',5000,NULL,NULL,0,'aktiv',NULL,NULL,'Adminkonto','2026-09-21 14:53:01');
INSERT INTO "bh_invoice"(id, no, year, kind, partner_id, member_id, recipient, date, due_date, period, intro, note, items, net, vat, gross, small_business, status, paid_at, paid_via, sent_at, reminders, reminded_at, charge_id, yearly, cancel_reason, created_by, created_at, department_id, account_id, bank) VALUES(1,'R-2026-0001',2026,'partner',1,NULL,'{"name":"Musterbau GmbH","contact":"Frau Beispiel","street":"Industriestraße 5","zip":"12345","city":"Musterstadt","country":"","email":"buchhaltung@musterbau.example.org"}','2026-02-13','2026-02-27','Saison 2026',NULL,NULL,'[{"text":"Bandenwerbung Platz 1, Saison 2026","qty":1,"unit_cents":50000,"vat":19}]',50000,9500,59500,0,'bezahlt','2026-03-11','kontoauszug',NULL,0,NULL,NULL,NULL,NULL,'Adminkonto','2026-02-13 14:52:53',NULL,1,'{"id":1,"name":"Vereinskonto","holder":"TC Grün-Weiß Musterstadt","iban":"DE02120300000000202051","bic":"BYLADEM1001","bank":"Musterbank"}');
INSERT INTO "bh_invoice"(id, no, year, kind, partner_id, member_id, recipient, date, due_date, period, intro, note, items, net, vat, gross, small_business, status, paid_at, paid_via, sent_at, reminders, reminded_at, charge_id, yearly, cancel_reason, created_by, created_at, department_id, account_id, bank) VALUES(2,'R-2026-0002',2026,'partner',2,NULL,'{"name":"Autohaus Beispiel KG","contact":"Herr Muster","street":"Hauptstraße 80","zip":"12345","city":"Musterstadt","country":"","email":"info@autohaus.example.org"}','2026-09-21','2026-10-05','Saison 2026/27',NULL,NULL,'[{"text":"Trikotsponsoring Fußball, Saison 2026/27","qty":1,"unit_cents":80000,"vat":19}]',80000,15200,95200,0,'offen',NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,'Adminkonto','2026-09-21 14:53:01',NULL,1,'{"id":1,"name":"Vereinskonto","holder":"TC Grün-Weiß Musterstadt","iban":"DE02120300000000202051","bic":"BYLADEM1001","bank":"Musterbank"}');
INSERT INTO "bh_partner"(id, name, contact, street, zip, city, country, email, phone, vat_id, customer_no, items, note, active, created_at, department_id) VALUES(1,'Musterbau GmbH','Frau Beispiel','Industriestraße 5','12345','Musterstadt',NULL,'buchhaltung@musterbau.example.org',NULL,NULL,NULL,'[{"text":"Bandenwerbung Platz 1, Saison 2026","qty":1,"unit_cents":50000,"vat":19}]',NULL,1,'2026-02-13 14:52:53',NULL);
INSERT INTO "bh_partner"(id, name, contact, street, zip, city, country, email, phone, vat_id, customer_no, items, note, active, created_at, department_id) VALUES(2,'Autohaus Beispiel KG','Herr Muster','Hauptstraße 80','12345','Musterstadt',NULL,'info@autohaus.example.org',NULL,NULL,NULL,'[{"text":"Trikotsponsoring Fußball, Saison 2026/27","qty":1,"unit_cents":80000,"vat":19}]',NULL,1,'2026-02-13 14:52:53',NULL);
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_street','Am Sportplatz 1');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_city','12345 Musterstadt');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_tax_no','012/345/67890');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_finanzamt','Finanzamt Musterstadt');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_fa_tax_no','012/345/67890');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_veranlagungszeitraum','2022–2024');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_signer','Andreas Nagel');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_signer_role','Kassenwart');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_place','Musterstadt');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_zwecke','Förderung des Sports');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_email','kasse@example.org');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_vat_default','19');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_due_days','14');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_bescheid_type','freistellung');
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_bescheid_date','2025-06-08');
-- Ausgaben, Kassen und Kassenbuch (Belegdateien entstehen beim Laden, lib/kasse.js)
CREATE TABLE IF NOT EXISTS "bh_expense_type" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sphere TEXT NOT NULL DEFAULT 'ideell', active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "bh_cash" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, start_date TEXT NOT NULL, start_cents INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS "bh_expense" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, no TEXT NOT NULL UNIQUE, year INTEGER NOT NULL, date TEXT NOT NULL,
  gross INTEGER NOT NULL, vat_rate INTEGER NOT NULL DEFAULT 0, vat INTEGER NOT NULL DEFAULT 0, bu TEXT,   -- brutto; Vorsteuer nur mit Einstellung
  payee TEXT NOT NULL, partner_id INTEGER, type_id INTEGER NOT NULL, purpose TEXT NOT NULL,
  paid_from TEXT NOT NULL, account_id INTEGER, cash_id INTEGER,                                          -- bank | kasse
  beleg_file TEXT, beleg_sha TEXT, beleg_mime TEXT, beleg_size INTEGER, eigenbeleg TEXT,                 -- Beleg im Tresor (eingefroren) oder Eigenbeleg mit Begründung
  delivery_id INTEGER, bank_entry_id INTEGER,
  status TEXT NOT NULL DEFAULT 'aktiv', cancel_reason TEXT, cancelled_at TEXT, cancelled_by TEXT,         -- aktiv | storniert
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS "bh_cash_move" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cash_id INTEGER NOT NULL, date TEXT NOT NULL, kind TEXT NOT NULL,              -- transit | umbuchung | differenz
  cents INTEGER NOT NULL,                                                                                -- + in die Kasse, − aus der Kasse
  other_cash_id INTEGER, account_id INTEGER, text TEXT, count_id INTEGER,
  status TEXT NOT NULL DEFAULT 'aktiv', cancel_reason TEXT, cancelled_at TEXT, cancelled_by TEXT,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS "bh_cash_count" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cash_id INTEGER NOT NULL, date TEXT NOT NULL, counted_cents INTEGER NOT NULL, soll_cents INTEGER NOT NULL, diff_cents INTEGER NOT NULL,
  coins TEXT, reason TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS "bh_cash_close" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cash_id INTEGER NOT NULL, month TEXT NOT NULL, opening_cents INTEGER NOT NULL, soll_cents INTEGER NOT NULL, rows TEXT NOT NULL,
  closed_by TEXT, closed_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), UNIQUE(cash_id, month)
);
INSERT INTO "bh_cash"(id, name, start_date, start_cents, is_default, active, created_at) VALUES(1,'Thekenkasse','2026-09-01',25000,1,1,'2026-09-01 19:30:00');
INSERT INTO "bh_cash"(id, name, start_date, start_cents, is_default, active, created_at) VALUES(2,'Turnierkasse','2026-09-23',0,0,1,'2026-09-23 19:30:00');
INSERT INTO "bh_cash_count"(id, cash_id, date, counted_cents, soll_cents, diff_cents, coins, reason, created_by, created_at) VALUES(1,1,'2026-09-08',21520,21520,0,'{"20":1,"500":1,"1000":1,"10000":2}',NULL,'Kassenwart','2026-09-08 19:30:00');
INSERT INTO "bh_cash_count"(id, cash_id, date, counted_cents, soll_cents, diff_cents, coins, reason, created_by, created_at) VALUES(2,1,'2026-10-19',8220,8470,-250,'{"20":1,"200":1,"1000":1,"2000":1,"5000":1}','Wechselgeld falsch herausgegeben','Kassenwart','2026-10-19 19:30:00');
INSERT INTO "bh_cash_move"(id, cash_id, date, kind, cents, other_cash_id, account_id, text, count_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(1,1,'2026-09-09','transit',-10000,NULL,1,'Einzahlung auf das Vereinskonto',NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-09-09 19:30:00');
INSERT INTO "bh_cash_move"(id, cash_id, date, kind, cents, other_cash_id, account_id, text, count_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(2,1,'2026-09-19','transit',5000,NULL,1,'Wechselgeld für das Sommerfest',NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-09-19 19:30:00');
INSERT INTO "bh_cash_move"(id, cash_id, date, kind, cents, other_cash_id, account_id, text, count_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(3,1,'2026-09-24','umbuchung',-3000,2,NULL,'Wechselgeld für das Turnier',NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-09-24 19:30:00');
INSERT INTO "bh_cash_move"(id, cash_id, date, kind, cents, other_cash_id, account_id, text, count_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(4,1,'2026-10-19','differenz',-250,NULL,NULL,'Wechselgeld falsch herausgegeben',2,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-10-19 19:30:00');
INSERT INTO "bh_expense"(id, no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, bank_entry_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(1,'A-2026-0001',2026,'2026-09-05',186450,0,0,NULL,'Platzbau Rot-Erde GmbH',NULL,2,'Ziegelmehl und Linienband für die Frühjahrsinstandsetzung','bank',1,NULL,'demo_1.pdf',NULL,'application/pdf',135,NULL,NULL,NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-09-05 19:30:00');
INSERT INTO "bh_expense"(id, no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, bank_entry_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(2,'A-2026-0002',2026,'2026-09-06',3480,0,0,NULL,'Baumarkt Musterstadt',NULL,2,'Schrauben und Farbe für die Bänke','kasse',NULL,1,'demo_2.png',NULL,'image/png',70,NULL,NULL,NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-09-06 19:30:00');
INSERT INTO "bh_expense"(id, no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, bank_entry_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(3,'A-2026-0003',2026,'2026-09-11',124000,0,0,NULL,'Landessportbund Musterland e. V.',NULL,4,'Verbandsbeitrag 2026','bank',1,NULL,'demo_3.pdf',NULL,'application/pdf',135,NULL,NULL,NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-09-11 19:30:00');
INSERT INTO "bh_expense"(id, no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, bank_entry_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(4,'A-2026-0004',2026,'2026-09-14',8600,0,0,NULL,'Stadtwerke Musterstadt',NULL,3,'Strom Abschlag September','bank',1,NULL,'demo_4.pdf',NULL,'application/pdf',135,NULL,NULL,11,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-09-14 19:30:00');
INSERT INTO "bh_expense"(id, no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, bank_entry_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(5,'A-2026-0005',2026,'2026-09-18',36000,0,0,NULL,'Musterfrau, Sabine (Übungsleiterin)',NULL,5,'Training September, 12 Stunden','bank',1,NULL,NULL,NULL,NULL,NULL,'Abrechnung nach Stundenzettel, unterschrieben im Ordner Übungsleiter 2026',NULL,NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-09-18 19:30:00');
INSERT INTO "bh_expense"(id, no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, bank_entry_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(6,'A-2026-0006',2026,'2026-09-20',6450,0,0,NULL,'Bäckerei Sonnenschein',NULL,7,'Brötchen und Kuchen fürs Sommerfest','kasse',NULL,1,'demo_6.png',NULL,'image/png',70,NULL,NULL,NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-09-20 19:30:00');
INSERT INTO "bh_expense"(id, no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, bank_entry_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(7,'A-2026-0007',2026,'2026-09-22',41230,0,0,NULL,'Getränke Muster KG',NULL,1,'Lieferung Wasser und Apfelschorle','bank',1,NULL,'demo_7.pdf',NULL,'application/pdf',135,NULL,NULL,NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-09-22 19:30:00');
INSERT INTO "bh_expense"(id, no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, bank_entry_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(8,'A-2026-0008',2026,'2026-09-28',2290,0,0,NULL,'Baumarkt Musterstadt',NULL,2,'Grassamen für die Böschung','kasse',NULL,1,'demo_8.png',NULL,'image/png',70,NULL,NULL,NULL,'storniert','doppelt erfasst – der Bon war schon gebucht','2026-09-29 18:40:00','Kassenwart','Kassenwart','2026-09-28 19:30:00');
INSERT INTO "bh_expense"(id, no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, bank_entry_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(9,'A-2026-0009',2026,'2026-10-03',48900,0,0,NULL,'Versicherungskammer Musterland',NULL,6,'Vereinshaftpflicht 2026/2027','bank',1,NULL,'demo_9.pdf',NULL,'application/pdf',135,NULL,NULL,NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-10-03 19:30:00');
INSERT INTO "bh_expense"(id, no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, bank_entry_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(10,'A-2026-0010',2026,'2026-10-17',1800,0,0,NULL,'Hausmeisterservice Muster',NULL,9,'Zweitschlüssel Geräteraum','kasse',NULL,1,NULL,NULL,NULL,NULL,'Quittung beim Schlüsseldienst vergessen, Betrag laut Preisaushang',NULL,NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-10-17 19:30:00');
INSERT INTO "bh_expense"(id, no, year, date, gross, vat_rate, vat, bu, payee, partner_id, type_id, purpose, paid_from, account_id, cash_id, beleg_file, beleg_sha, beleg_mime, beleg_size, eigenbeleg, delivery_id, bank_entry_id, status, cancel_reason, cancelled_at, cancelled_by, created_by, created_at) VALUES(11,'A-2026-0011',2026,'2026-10-21',8990,0,0,NULL,'Pokale & Ehrenpreise Muster',NULL,7,'Pokale für die Clubmeisterschaft','kasse',NULL,2,'demo_11.png',NULL,'image/png',70,NULL,NULL,NULL,'aktiv',NULL,NULL,NULL,'Kassenwart','2026-10-21 19:30:00');
INSERT INTO "bh_expense_type"(id, name, sphere, active, sort) VALUES(1,'Wareneinkauf Getränke','wgb',1,0);
INSERT INTO "bh_expense_type"(id, name, sphere, active, sort) VALUES(2,'Platzpflege und Anlage','ideell',1,1);
INSERT INTO "bh_expense_type"(id, name, sphere, active, sort) VALUES(3,'Strom, Wasser, Heizung','ideell',1,2);
INSERT INTO "bh_expense_type"(id, name, sphere, active, sort) VALUES(4,'Verbandsbeiträge','ideell',1,3);
INSERT INTO "bh_expense_type"(id, name, sphere, active, sort) VALUES(5,'Trainer und Übungsleiter','zweck',1,4);
INSERT INTO "bh_expense_type"(id, name, sphere, active, sort) VALUES(6,'Versicherungen','ideell',1,5);
INSERT INTO "bh_expense_type"(id, name, sphere, active, sort) VALUES(7,'Veranstaltungen','wgb',1,6);
INSERT INTO "bh_expense_type"(id, name, sphere, active, sort) VALUES(8,'Büro, Porto und Bank','ideell',1,7);
INSERT INTO "bh_expense_type"(id, name, sphere, active, sort) VALUES(9,'Sonstiges','ideell',1,8);
INSERT INTO "settings"(key, value) VALUES('ext_buchhaltung_cash_map','{"tu.nenngeld":2}');
CREATE INDEX IF NOT EXISTS ix_bh_ccount ON bh_cash_count(cash_id, date);
CREATE INDEX IF NOT EXISTS ix_bh_cmove ON bh_cash_move(cash_id, date);
CREATE INDEX IF NOT EXISTS ix_bh_cmove_o ON bh_cash_move(other_cash_id, date);
CREATE INDEX IF NOT EXISTS ix_bh_exp_cash ON bh_expense(cash_id, date);
CREATE INDEX IF NOT EXISTS ix_bh_exp_date ON bh_expense(date);
CREATE UNIQUE INDEX IF NOT EXISTS ux_bh_exp_deliv ON bh_expense(delivery_id) WHERE delivery_id IS NOT NULL AND status = 'aktiv';
COMMIT;
