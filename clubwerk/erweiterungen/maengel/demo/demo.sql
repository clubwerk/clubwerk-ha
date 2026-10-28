-- Clubwerk Demo-Daten (erfunden): Mängel. Bearbeiten: siehe werkzeuge/demo/aufteilen.js
BEGIN;
CREATE TABLE IF NOT EXISTS mg_also (report_id INTEGER NOT NULL, member_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY(report_id, member_id));
CREATE TABLE IF NOT EXISTS mg_photo (id INTEGER PRIMARY KEY AUTOINCREMENT, report_id INTEGER NOT NULL, file TEXT NOT NULL, thumb TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS mg_place (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS mg_report (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER,
  place TEXT NOT NULL, text TEXT NOT NULL, urgent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'neu',
  answer TEXT, note TEXT, assignee INTEGER,
  source TEXT NOT NULL DEFAULT 'app',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), updated_at TEXT, done_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_mg_photo_report ON mg_photo(report_id);
CREATE INDEX IF NOT EXISTS ix_mg_report_status ON mg_report(status, place);
INSERT INTO "mg_also"(report_id, member_id, created_at) VALUES(1,4,'2026-10-19 16:00:00');
INSERT INTO "mg_also"(report_id, member_id, created_at) VALUES(1,7,'2026-10-20 11:30:00');
INSERT INTO "mg_also"(report_id, member_id, created_at) VALUES(4,3,'2026-10-21 08:45:00');
INSERT INTO "mg_place"(id, name, sort) VALUES(1,'Clubhaus',0);
INSERT INTO "mg_place"(id, name, sort) VALUES(2,'Clubhaus Damen-WC',1);
INSERT INTO "mg_place"(id, name, sort) VALUES(3,'Parkplatz',2);
INSERT INTO "mg_report"(id, member_id, place, text, urgent, status, answer, note, assignee, source, created_at, updated_at, done_at) VALUES(1,3,'Platz 2','Netz in der Mitte eingerissen, hängt durch.',0,'arbeit','Danke! Das neue Netz ist bestellt und kommt am Samstag.',NULL,1,'app','2026-10-18 17:42:10','2026-10-19 09:10:00',NULL);
INSERT INTO "mg_report"(id, member_id, place, text, urgent, status, answer, note, assignee, source, created_at, updated_at, done_at) VALUES(2,6,'Clubhaus Damen-WC','Wasserhahn tropft ständig, lässt sich nicht ganz zudrehen.',1,'neu',NULL,NULL,NULL,'tablet','2026-10-21 10:05:33',NULL,NULL);
INSERT INTO "mg_report"(id, member_id, place, text, urgent, status, answer, note, assignee, source, created_at, updated_at, done_at) VALUES(3,3,'Parkplatz','Lampe am Eingang geht abends nicht an.',0,'erledigt','Lampe ist getauscht – danke für den Hinweis!',NULL,1,'app','2026-10-02 19:20:00','2026-10-05 08:00:00','2026-10-05 08:00:00');
INSERT INTO "mg_report"(id, member_id, place, text, urgent, status, answer, note, assignee, source, created_at, updated_at, done_at) VALUES(4,8,'Platz 1','Linie an der Grundlinie hat sich gelöst – Stolpergefahr.',1,'neu',NULL,NULL,NULL,'app','2026-10-20 18:12:00',NULL,NULL);
INSERT INTO "mg_report"(id, member_id, place, text, urgent, status, answer, note, assignee, source, created_at, updated_at, done_at) VALUES(5,4,'Clubhaus','Kühlschrank in der Küche brummt laut und kühlt kaum noch.',0,'erledigt','Der Kühlschrank ist abgetaut und läuft wieder normal – danke!',NULL,1,'tablet','2026-03-20 19:10:55','2026-10-21 14:53:08','2026-10-21 14:53:08');
INSERT INTO "mg_report"(id, member_id, place, text, urgent, status, answer, note, assignee, source, created_at, updated_at, done_at) VALUES(6,3,'Clubhaus','Tür zum Ballraum klemmt beim Abschließen, Schlüssel geht schwer.',0,'neu',NULL,NULL,NULL,'tablet','2026-03-20 19:10:55',NULL,NULL);
COMMIT;
