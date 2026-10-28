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
COMMIT;
