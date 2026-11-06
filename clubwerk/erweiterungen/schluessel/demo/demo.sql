-- Clubwerk Demo-Daten (erfunden): Schlüssel. Bearbeiten: siehe werkzeuge/demo/aufteilen.js
BEGIN;
CREATE TABLE IF NOT EXISTS sl_type (id INTEGER PRIMARY KEY AUTOINCREMENT, ident TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'schluessel', opens TEXT, deposit_cents INTEGER NOT NULL DEFAULT 0,
  sensitive INTEGER NOT NULL DEFAULT 0, note TEXT, sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS sl_piece (id INTEGER PRIMARY KEY AUTOINCREMENT, type_id INTEGER NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'vorraetig', note TEXT);   -- vorraetig | reserviert | ausgegeben | verloren | gesperrt | ausgemustert
CREATE INDEX IF NOT EXISTS ix_sl_piece_type ON sl_piece(type_id, status);
CREATE TABLE IF NOT EXISTS sl_template (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, text TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sl_issue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER,                                  -- Konto (ohne Fremdschlüssel: Zusammenführen/Löschen regelt der Hook memberRemoved)
  ext_first TEXT, ext_last TEXT, ext_birth TEXT, contact TEXT,   -- Person ohne Clubwerk-Konto (im Tresor)
  guardian_name TEXT,
  status TEXT NOT NULL DEFAULT 'wartet',              -- wartet | ausgegeben | zurueck | storniert
  legacy INTEGER NOT NULL DEFAULT 0, legacy_no TEXT,  -- übernommen aus der Mitgliederverwaltung, noch ohne Protokoll
  issued_by TEXT, issued_at TEXT, due TEXT,
  deposit_cents INTEGER NOT NULL DEFAULT 0, deposit_state TEXT NOT NULL DEFAULT '',   -- '' | gehalten | zurueck | einbehalten
  cost_cents INTEGER NOT NULL DEFAULT 0,
  template_id INTEGER, code_hash TEXT, code_expires INTEGER, closed_at TEXT, remind_at TEXT, created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE INDEX IF NOT EXISTS ix_sl_issue_member ON sl_issue(member_id, status);
CREATE TABLE IF NOT EXISTS sl_issue_piece (issue_id INTEGER NOT NULL, piece_id INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'reserviert', back_at TEXT, cond TEXT, PRIMARY KEY(issue_id, piece_id));   -- reserviert | ausgegeben | zurueck | verloren | storniert
CREATE TABLE IF NOT EXISTS sl_protocol (
  id INTEGER PRIMARY KEY AUTOINCREMENT, no TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,   -- ausgabe | rueckgabe | verlust | storno
  issue_id INTEGER NOT NULL, ref_id INTEGER, at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'gueltig',   -- gueltig | storniert
  terms TEXT, data TEXT NOT NULL DEFAULT '{}', sig_a TEXT, sig_b TEXT, sig_c TEXT, sha256 TEXT NOT NULL, file TEXT, by_user TEXT);
CREATE INDEX IF NOT EXISTS ix_sl_protocol_issue ON sl_protocol(issue_id);
INSERT INTO "sl_type"(id, ident, name, kind, opens, deposit_cents, sensitive, sort, created_at) VALUES(1, '08', 'Clubhaus Haupteingang', 'schluessel', 'Haupteingang, Umkleiden, Thekenraum', 2000, 1, 1, '2024-01-10 09:00:00');
INSERT INTO "sl_type"(id, ident, name, kind, opens, deposit_cents, sensitive, sort, created_at) VALUES(2, '07', 'Clubhaus Nebeneingang', 'schluessel', 'Nebeneingang, Geräteraum', 0, 0, 2, '2024-01-10 09:00:00');
INSERT INTO "sl_type"(id, ident, name, kind, opens, deposit_cents, sensitive, sort, created_at) VALUES(3, 'T-14', 'Transponder Parkplatztor', 'transponder', 'Parkplatztor', 1000, 0, 3, '2024-01-10 09:00:00');
INSERT INTO "sl_type"(id, ident, name, kind, opens, deposit_cents, sensitive, sort, created_at) VALUES(4, 'G-01', 'Generalschlüssel', 'schluessel', 'Alle Türen der Anlage', 0, 1, 4, '2024-01-10 09:00:00');
INSERT INTO "sl_type"(id, ident, name, kind, opens, deposit_cents, sensitive, sort, created_at) VALUES(5, '12', 'Geräteschuppen', 'schluessel', 'Geräteschuppen, Ballraum', 0, 0, 5, '2024-01-10 09:00:00');
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(1, 1, '08-1', 'ausgegeben', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(2, 1, '08-2', 'ausgegeben', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(3, 1, '08-3', 'vorraetig', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(4, 1, '08-4', 'ausgegeben', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(5, 1, '08-5', 'verloren', 'Verloren am 12.09.2026');
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(6, 1, '08-6', 'vorraetig', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(7, 2, '07-1', 'ausgegeben', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(8, 2, '07-2', 'vorraetig', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(9, 2, '07-3', 'ausgegeben', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(10, 2, '07-4', 'vorraetig', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(11, 3, 'T-14-1', 'ausgegeben', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(12, 3, 'T-14-2', 'ausgegeben', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(13, 3, 'T-14-3', 'vorraetig', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(14, 3, 'T-14-4', 'vorraetig', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(15, 3, 'T-14-5', 'vorraetig', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(16, 3, 'T-14-6', 'gesperrt', 'im Zutrittssystem des Pächters deaktiviert');
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(17, 4, 'G-01-1', 'ausgegeben', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(18, 4, 'G-01-2', 'vorraetig', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(19, 5, '12-1', 'ausgegeben', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(20, 5, '12-2', 'vorraetig', NULL);
INSERT INTO "sl_piece"(id, type_id, label, status, note) VALUES(21, 5, '12-3', 'vorraetig', NULL);
INSERT INTO "sl_template"(id, name, text, sort) VALUES(1, 'Standard', '1. Der Schlüssel bleibt Eigentum des {Verein}. Er ist nur für mich bestimmt und für Vereinszwecke zu nutzen.
2. Ich gebe ihn nicht an andere weiter und lasse ihn nicht nachmachen. Ich bewahre ihn sorgfältig auf und kennzeichne ihn nicht mit der Anschrift des Vereins.
3. Einen Verlust oder Diebstahl melde ich unverzüglich dem Vorstand.
4. Bei Verlust aus eigenem Verschulden trage ich die Kosten für Ersatz und, wenn die Sicherheit es verlangt, für den Umbau der Schließanlage – höchstens {Höchstbetrag}.
5. Ich gebe den Schlüssel bei Austritt, Ende meiner Aufgabe oder auf Verlangen des Vorstands unverzüglich zurück. Ein Pfand wird bei vollständiger Rückgabe erstattet.
6. Meine Angaben speichert der Verein für die Dauer der Ausgabe und danach höchstens {Frist} (Datenschutzhinweis des Vereins).', 0);
INSERT INTO "sl_template"(id, name, text, sort) VALUES(2, 'Trainer und Pächter', '1. Der Schlüssel bleibt Eigentum des {Verein}. Er ist nur für die vereinbarte Aufgabe zu nutzen.
2. Ich gebe ihn nicht weiter und lasse ihn nicht nachmachen.
3. Einen Verlust melde ich unverzüglich dem Vorstand.
4. Bei Verlust aus eigenem Verschulden trage ich die Kosten – höchstens {Höchstbetrag}.
5. Ich gebe den Schlüssel zum Ende meiner Aufgabe oder auf Verlangen unverzüglich zurück.', 1);
INSERT INTO "sl_issue"(id, member_id, ext_first, ext_last, contact, guardian_name, status, legacy, legacy_no, issued_by, issued_at, due, deposit_cents, deposit_state, cost_cents, template_id, closed_at, created_by, created_at) VALUES(1, 4, NULL, NULL, NULL, NULL, 'ausgegeben', 0, NULL, 'Paul Zimmermann', '2024-03-12 18:10:00', NULL, 3000, 'gehalten', 0, 1, NULL, 'Adminkonto', '2024-03-12 18:10:00');
INSERT INTO "sl_issue_piece"(issue_id, piece_id, state, back_at) VALUES(1, 1, 'ausgegeben', NULL);
INSERT INTO "sl_issue_piece"(issue_id, piece_id, state, back_at) VALUES(1, 11, 'ausgegeben', NULL);
INSERT INTO "sl_issue"(id, member_id, ext_first, ext_last, contact, guardian_name, status, legacy, legacy_no, issued_by, issued_at, due, deposit_cents, deposit_state, cost_cents, template_id, closed_at, created_by, created_at) VALUES(2, 6, NULL, NULL, NULL, 'Birgit Wagner', 'ausgegeben', 0, NULL, 'Paul Zimmermann', '2026-10-18 17:40:00', NULL, 2000, 'gehalten', 0, 1, NULL, 'Adminkonto', '2026-10-18 17:40:00');
INSERT INTO "sl_issue_piece"(issue_id, piece_id, state, back_at) VALUES(2, 2, 'ausgegeben', NULL);
INSERT INTO "sl_issue"(id, member_id, ext_first, ext_last, contact, guardian_name, status, legacy, legacy_no, issued_by, issued_at, due, deposit_cents, deposit_state, cost_cents, template_id, closed_at, created_by, created_at) VALUES(3, 5, NULL, NULL, NULL, NULL, 'ausgegeben', 0, NULL, 'Paul Zimmermann', '2026-04-15 19:00:00', '2027-03-31', 0, '', 0, 1, NULL, 'Adminkonto', '2026-04-15 19:00:00');
INSERT INTO "sl_issue_piece"(issue_id, piece_id, state, back_at) VALUES(3, 7, 'ausgegeben', NULL);
INSERT INTO "sl_issue"(id, member_id, ext_first, ext_last, contact, guardian_name, status, legacy, legacy_no, issued_by, issued_at, due, deposit_cents, deposit_state, cost_cents, template_id, closed_at, created_by, created_at) VALUES(4, 8, NULL, NULL, NULL, NULL, 'ausgegeben', 0, NULL, 'Paul Zimmermann', '2026-05-01 10:30:00', '2026-10-01', 0, '', 0, 1, NULL, 'Adminkonto', '2026-05-01 10:30:00');
INSERT INTO "sl_issue_piece"(issue_id, piece_id, state, back_at) VALUES(4, 19, 'ausgegeben', NULL);
INSERT INTO "sl_issue"(id, member_id, ext_first, ext_last, contact, guardian_name, status, legacy, legacy_no, issued_by, issued_at, due, deposit_cents, deposit_state, cost_cents, template_id, closed_at, created_by, created_at) VALUES(5, 3, NULL, NULL, NULL, NULL, 'ausgegeben', 1, 'G-01', 'übernommen', '2023-01-02 12:00:00', NULL, 0, '', 0, 1, NULL, 'Adminkonto', '2023-01-02 12:00:00');
INSERT INTO "sl_issue_piece"(issue_id, piece_id, state, back_at) VALUES(5, 17, 'ausgegeben', NULL);
INSERT INTO "sl_issue"(id, member_id, ext_first, ext_last, contact, guardian_name, status, legacy, legacy_no, issued_by, issued_at, due, deposit_cents, deposit_state, cost_cents, template_id, closed_at, created_by, created_at) VALUES(6, NULL, 'Reinhard', 'Wartmann', 'reinhard.wartmann@example.org', NULL, 'ausgegeben', 0, NULL, 'Paul Zimmermann', '2025-03-01 15:00:00', NULL, 3000, 'gehalten', 0, 2, NULL, 'Adminkonto', '2025-03-01 15:00:00');
INSERT INTO "sl_issue_piece"(issue_id, piece_id, state, back_at) VALUES(6, 12, 'ausgegeben', NULL);
INSERT INTO "sl_issue_piece"(issue_id, piece_id, state, back_at) VALUES(6, 4, 'ausgegeben', NULL);
INSERT INTO "sl_issue"(id, member_id, ext_first, ext_last, contact, guardian_name, status, legacy, legacy_no, issued_by, issued_at, due, deposit_cents, deposit_state, cost_cents, template_id, closed_at, created_by, created_at) VALUES(7, 42, NULL, NULL, NULL, NULL, 'ausgegeben', 0, NULL, 'Paul Zimmermann', '2025-09-10 18:30:00', NULL, 0, '', 0, 1, NULL, 'Adminkonto', '2025-09-10 18:30:00');
INSERT INTO "sl_issue_piece"(issue_id, piece_id, state, back_at) VALUES(7, 9, 'ausgegeben', NULL);
INSERT INTO "sl_issue"(id, member_id, ext_first, ext_last, contact, guardian_name, status, legacy, legacy_no, issued_by, issued_at, due, deposit_cents, deposit_state, cost_cents, template_id, closed_at, created_by, created_at) VALUES(8, 10, NULL, NULL, NULL, NULL, 'zurueck', 0, NULL, 'Paul Zimmermann', '2025-02-14 17:00:00', NULL, 0, '', 0, 1, '2026-09-30 17:20:00', 'Adminkonto', '2025-02-14 17:00:00');
INSERT INTO "sl_issue_piece"(issue_id, piece_id, state, back_at) VALUES(8, 8, 'zurueck', '2026-09-30 17:20:00');
INSERT INTO "sl_issue"(id, member_id, ext_first, ext_last, contact, guardian_name, status, legacy, legacy_no, issued_by, issued_at, due, deposit_cents, deposit_state, cost_cents, template_id, closed_at, created_by, created_at) VALUES(9, 22, NULL, NULL, NULL, NULL, 'zurueck', 0, NULL, 'Paul Zimmermann', '2024-06-03 18:00:00', NULL, 2000, 'einbehalten', 4500, 1, '2026-09-12 19:05:00', 'Adminkonto', '2024-06-03 18:00:00');
INSERT INTO "sl_issue_piece"(issue_id, piece_id, state, back_at) VALUES(9, 5, 'verloren', '2026-09-12 19:05:00');
INSERT INTO "sl_protocol"(id, no, kind, issue_id, ref_id, at, status, terms, data, sha256, by_user) VALUES(1, 'S-2024-001', 'ausgabe', 1, NULL, '2024-03-12 18:10:00', 'gueltig', '1. Der Schlüssel bleibt Eigentum des TC Grün-Weiß Musterstadt. Er ist nur für mich bestimmt und für Vereinszwecke zu nutzen.
2. Ich gebe ihn nicht an andere weiter und lasse ihn nicht nachmachen. Ich bewahre ihn sorgfältig auf und kennzeichne ihn nicht mit der Anschrift des Vereins.
3. Einen Verlust oder Diebstahl melde ich unverzüglich dem Vorstand.
4. Bei Verlust aus eigenem Verschulden trage ich die Kosten für Ersatz und, wenn die Sicherheit es verlangt, für den Umbau der Schließanlage – höchstens 50,00 €.
5. Ich gebe den Schlüssel bei Austritt, Ende meiner Aufgabe oder auf Verlangen des Vorstands unverzüglich zurück. Ein Pfand wird bei vollständiger Rückgabe erstattet.
6. Meine Angaben speichert der Verein für die Dauer der Ausgabe und danach höchstens 3 Jahre (Datenschutzhinweis des Vereins).', '{}', 'a0e9ab695589d18dad96eb1b50cb378256b7ef424031aa5ec84dfa9a6461191b', 'Paul Zimmermann');
INSERT INTO "sl_protocol"(id, no, kind, issue_id, ref_id, at, status, terms, data, sha256, by_user) VALUES(2, 'S-2024-002', 'ausgabe', 9, NULL, '2024-06-03 18:00:00', 'gueltig', '1. Der Schlüssel bleibt Eigentum des TC Grün-Weiß Musterstadt. Er ist nur für mich bestimmt und für Vereinszwecke zu nutzen.
2. Ich gebe ihn nicht an andere weiter und lasse ihn nicht nachmachen. Ich bewahre ihn sorgfältig auf und kennzeichne ihn nicht mit der Anschrift des Vereins.
3. Einen Verlust oder Diebstahl melde ich unverzüglich dem Vorstand.
4. Bei Verlust aus eigenem Verschulden trage ich die Kosten für Ersatz und, wenn die Sicherheit es verlangt, für den Umbau der Schließanlage – höchstens 50,00 €.
5. Ich gebe den Schlüssel bei Austritt, Ende meiner Aufgabe oder auf Verlangen des Vorstands unverzüglich zurück. Ein Pfand wird bei vollständiger Rückgabe erstattet.
6. Meine Angaben speichert der Verein für die Dauer der Ausgabe und danach höchstens 3 Jahre (Datenschutzhinweis des Vereins).', '{}', 'a8665e1603200b8ba04f2ff4a318e81607de44c0e3df1d4e41f32efdb856bf44', 'Paul Zimmermann');
INSERT INTO "sl_protocol"(id, no, kind, issue_id, ref_id, at, status, terms, data, sha256, by_user) VALUES(3, 'S-2025-001', 'ausgabe', 8, NULL, '2025-02-14 17:00:00', 'gueltig', '1. Der Schlüssel bleibt Eigentum des TC Grün-Weiß Musterstadt. Er ist nur für mich bestimmt und für Vereinszwecke zu nutzen.
2. Ich gebe ihn nicht an andere weiter und lasse ihn nicht nachmachen. Ich bewahre ihn sorgfältig auf und kennzeichne ihn nicht mit der Anschrift des Vereins.
3. Einen Verlust oder Diebstahl melde ich unverzüglich dem Vorstand.
4. Bei Verlust aus eigenem Verschulden trage ich die Kosten für Ersatz und, wenn die Sicherheit es verlangt, für den Umbau der Schließanlage – höchstens 50,00 €.
5. Ich gebe den Schlüssel bei Austritt, Ende meiner Aufgabe oder auf Verlangen des Vorstands unverzüglich zurück. Ein Pfand wird bei vollständiger Rückgabe erstattet.
6. Meine Angaben speichert der Verein für die Dauer der Ausgabe und danach höchstens 3 Jahre (Datenschutzhinweis des Vereins).', '{}', '53829a51db2b7effeba3df1e3dbc6c5a36d7a0c0a4bb08e7dbd641531e523ccc', 'Paul Zimmermann');
INSERT INTO "sl_protocol"(id, no, kind, issue_id, ref_id, at, status, terms, data, sha256, by_user) VALUES(4, 'S-2025-002', 'ausgabe', 6, NULL, '2025-03-01 15:00:00', 'gueltig', '1. Der Schlüssel bleibt Eigentum des TC Grün-Weiß Musterstadt. Er ist nur für mich bestimmt und für Vereinszwecke zu nutzen.
2. Ich gebe ihn nicht an andere weiter und lasse ihn nicht nachmachen. Ich bewahre ihn sorgfältig auf und kennzeichne ihn nicht mit der Anschrift des Vereins.
3. Einen Verlust oder Diebstahl melde ich unverzüglich dem Vorstand.
4. Bei Verlust aus eigenem Verschulden trage ich die Kosten für Ersatz und, wenn die Sicherheit es verlangt, für den Umbau der Schließanlage – höchstens 50,00 €.
5. Ich gebe den Schlüssel bei Austritt, Ende meiner Aufgabe oder auf Verlangen des Vorstands unverzüglich zurück. Ein Pfand wird bei vollständiger Rückgabe erstattet.
6. Meine Angaben speichert der Verein für die Dauer der Ausgabe und danach höchstens 3 Jahre (Datenschutzhinweis des Vereins).', '{}', 'dd924b782c6555fb34a72e0bdbc03d8a716a7c27d9bd9ae7e6c25b44f7a36610', 'Paul Zimmermann');
INSERT INTO "sl_protocol"(id, no, kind, issue_id, ref_id, at, status, terms, data, sha256, by_user) VALUES(5, 'S-2025-003', 'ausgabe', 7, NULL, '2025-09-10 18:30:00', 'gueltig', '1. Der Schlüssel bleibt Eigentum des TC Grün-Weiß Musterstadt. Er ist nur für mich bestimmt und für Vereinszwecke zu nutzen.
2. Ich gebe ihn nicht an andere weiter und lasse ihn nicht nachmachen. Ich bewahre ihn sorgfältig auf und kennzeichne ihn nicht mit der Anschrift des Vereins.
3. Einen Verlust oder Diebstahl melde ich unverzüglich dem Vorstand.
4. Bei Verlust aus eigenem Verschulden trage ich die Kosten für Ersatz und, wenn die Sicherheit es verlangt, für den Umbau der Schließanlage – höchstens 50,00 €.
5. Ich gebe den Schlüssel bei Austritt, Ende meiner Aufgabe oder auf Verlangen des Vorstands unverzüglich zurück. Ein Pfand wird bei vollständiger Rückgabe erstattet.
6. Meine Angaben speichert der Verein für die Dauer der Ausgabe und danach höchstens 3 Jahre (Datenschutzhinweis des Vereins).', '{}', '8cfbb148b64de32c65914cadf76e83210e3517ebc2b428934f32b6557bdc8cd2', 'Paul Zimmermann');
INSERT INTO "sl_protocol"(id, no, kind, issue_id, ref_id, at, status, terms, data, sha256, by_user) VALUES(6, 'S-2026-001', 'ausgabe', 3, NULL, '2026-04-15 19:00:00', 'gueltig', '1. Der Schlüssel bleibt Eigentum des TC Grün-Weiß Musterstadt. Er ist nur für mich bestimmt und für Vereinszwecke zu nutzen.
2. Ich gebe ihn nicht an andere weiter und lasse ihn nicht nachmachen. Ich bewahre ihn sorgfältig auf und kennzeichne ihn nicht mit der Anschrift des Vereins.
3. Einen Verlust oder Diebstahl melde ich unverzüglich dem Vorstand.
4. Bei Verlust aus eigenem Verschulden trage ich die Kosten für Ersatz und, wenn die Sicherheit es verlangt, für den Umbau der Schließanlage – höchstens 50,00 €.
5. Ich gebe den Schlüssel bei Austritt, Ende meiner Aufgabe oder auf Verlangen des Vorstands unverzüglich zurück. Ein Pfand wird bei vollständiger Rückgabe erstattet.
6. Meine Angaben speichert der Verein für die Dauer der Ausgabe und danach höchstens 3 Jahre (Datenschutzhinweis des Vereins).', '{}', 'b1260a5d21b13680d75e6a1d2e6943c0f2653fc44acdf2ee493b1055019152f4', 'Paul Zimmermann');
INSERT INTO "sl_protocol"(id, no, kind, issue_id, ref_id, at, status, terms, data, sha256, by_user) VALUES(7, 'S-2026-002', 'ausgabe', 4, NULL, '2026-05-01 10:30:00', 'gueltig', '1. Der Schlüssel bleibt Eigentum des TC Grün-Weiß Musterstadt. Er ist nur für mich bestimmt und für Vereinszwecke zu nutzen.
2. Ich gebe ihn nicht an andere weiter und lasse ihn nicht nachmachen. Ich bewahre ihn sorgfältig auf und kennzeichne ihn nicht mit der Anschrift des Vereins.
3. Einen Verlust oder Diebstahl melde ich unverzüglich dem Vorstand.
4. Bei Verlust aus eigenem Verschulden trage ich die Kosten für Ersatz und, wenn die Sicherheit es verlangt, für den Umbau der Schließanlage – höchstens 50,00 €.
5. Ich gebe den Schlüssel bei Austritt, Ende meiner Aufgabe oder auf Verlangen des Vorstands unverzüglich zurück. Ein Pfand wird bei vollständiger Rückgabe erstattet.
6. Meine Angaben speichert der Verein für die Dauer der Ausgabe und danach höchstens 3 Jahre (Datenschutzhinweis des Vereins).', '{}', 'e2a55c41dc758277553d3447aac0d88681ac969699b58e3f10f7cf044232c8a2', 'Paul Zimmermann');
INSERT INTO "sl_protocol"(id, no, kind, issue_id, ref_id, at, status, terms, data, sha256, by_user) VALUES(8, 'S-2026-003', 'ausgabe', 2, NULL, '2026-10-18 17:40:00', 'gueltig', '1. Der Schlüssel bleibt Eigentum des TC Grün-Weiß Musterstadt. Er ist nur für mich bestimmt und für Vereinszwecke zu nutzen.
2. Ich gebe ihn nicht an andere weiter und lasse ihn nicht nachmachen. Ich bewahre ihn sorgfältig auf und kennzeichne ihn nicht mit der Anschrift des Vereins.
3. Einen Verlust oder Diebstahl melde ich unverzüglich dem Vorstand.
4. Bei Verlust aus eigenem Verschulden trage ich die Kosten für Ersatz und, wenn die Sicherheit es verlangt, für den Umbau der Schließanlage – höchstens 50,00 €.
5. Ich gebe den Schlüssel bei Austritt, Ende meiner Aufgabe oder auf Verlangen des Vorstands unverzüglich zurück. Ein Pfand wird bei vollständiger Rückgabe erstattet.
6. Meine Angaben speichert der Verein für die Dauer der Ausgabe und danach höchstens 3 Jahre (Datenschutzhinweis des Vereins).', '{}', '9717248dd2aa337e51ee9a5dbc0215111f404a5d2cdf3e44ed269783786a3560', 'Paul Zimmermann');
INSERT INTO "sl_protocol"(id, no, kind, issue_id, ref_id, at, status, terms, data, sha256, by_user) VALUES(9, 'S-2026-004', 'rueckgabe', 8, 3, '2026-09-30 17:20:00', 'gueltig', NULL, '{}', '742a50cde20905abcea3886b472067870432192691031d76fd477b1155922eaf', 'Paul Zimmermann');
INSERT INTO "sl_protocol"(id, no, kind, issue_id, ref_id, at, status, terms, data, sha256, by_user) VALUES(10, 'S-2026-005', 'verlust', 9, 2, '2026-09-12 19:05:00', 'gueltig', NULL, '{}', 'ce5f5ae9e9dac99a039252afd872bda6d7c11d850696fb04b016fe8abd3559d1', 'Paul Zimmermann');
INSERT INTO "settings"(key, value) VALUES('ext_schluessel_cnt_2024', '2');
INSERT INTO "settings"(key, value) VALUES('ext_schluessel_cnt_2025', '3');
INSERT INTO "settings"(key, value) VALUES('ext_schluessel_cnt_2026', '5');
COMMIT;
