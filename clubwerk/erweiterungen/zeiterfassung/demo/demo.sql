-- Clubwerk Demo-Daten (erfunden): Zeiterfassung. Bearbeiten: siehe werkzeuge/demo/aufteilen.js
BEGIN;
CREATE TABLE IF NOT EXISTS "staff" (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  job        TEXT,
  pin_hash   TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS staff_rates (
  staff_id   INTEGER NOT NULL REFERENCES staff(id),
  from_month TEXT NOT NULL,              -- JJJJ-MM: gilt ab diesem Monat
  cents      INTEGER,                    -- NULL = kein Stundensatz
  PRIMARY KEY (staff_id, from_month)
);
CREATE TABLE IF NOT EXISTS "time_entries" (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id   INTEGER NOT NULL REFERENCES staff(id),
  start_at   TEXT NOT NULL,
  end_at     TEXT,
  manual     INTEGER NOT NULL DEFAULT 0, -- 1 = in der Verwaltung nachgetragen
  note       TEXT,
  orig_start TEXT,                       -- Originalzeiten vor der ersten Korrektur
  orig_end   TEXT,
  edited_by  TEXT,
  edited_at  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_time_staff ON time_entries(staff_id, start_at);
INSERT INTO "staff"(id, name, job, pin_hash, active, created_at) VALUES(1,'Maria Putz','Reinigung','a5fd740ce9f96e2258dc7796c35742ee:b213b9cc16e4793a56c89bb2b78d023017aa14bec5b7f1288415acf5469bbd10',1,'2026-02-13 14:52:50');
INSERT INTO "staff"(id, name, job, pin_hash, active, created_at) VALUES(2,'Karl Platzwart','Platzwart','44d35a8991e845e4086c09583b85466f:a32e4a66b5d9442b057eda1cd1c6db8df91787c0001bb5cdc838ad2e8feeccee',1,'2026-02-13 14:52:50');
INSERT INTO "staff_rates"(staff_id, from_month, cents) VALUES(2,'2026-08',1500);
INSERT INTO "staff_rates"(staff_id, from_month, cents) VALUES(1,'2026-08',1350);
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(1,2,'2026-08-27 07:37:02','2026-08-27 11:53:02',0,NULL,NULL,NULL,NULL,NULL,'2026-08-27 07:37:01');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(2,1,'2026-08-28 08:50:01','2026-08-28 11:05:13',0,NULL,NULL,NULL,NULL,NULL,'2026-08-28 08:50:00');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(3,2,'2026-08-31 07:32:39','2026-08-31 12:23:53',0,NULL,NULL,NULL,NULL,NULL,'2026-08-31 07:32:38');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(4,1,'2026-09-01 08:45:38','2026-09-01 11:15:35',0,NULL,NULL,NULL,NULL,NULL,'2026-09-01 08:45:37');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(5,2,'2026-09-03 07:34:46','2026-09-03 12:31:54',0,NULL,NULL,NULL,NULL,NULL,'2026-09-03 07:34:46');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(6,1,'2026-09-04 08:47:45','2026-09-04 11:27:32',0,NULL,NULL,NULL,NULL,NULL,'2026-09-04 08:47:44');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(7,2,'2026-09-07 07:29:23','2026-09-07 12:11:46',0,NULL,NULL,NULL,NULL,NULL,'2026-09-07 07:29:22');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(8,1,'2026-09-08 08:42:22','2026-09-08 10:57:45',0,NULL,NULL,NULL,NULL,NULL,'2026-09-08 08:42:21');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(9,2,'2026-09-10 07:31:30','2026-09-10 12:19:47',0,NULL,NULL,NULL,NULL,NULL,'2026-09-10 07:31:30');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(10,1,'2026-09-11 08:44:29','2026-09-11 11:09:31',0,NULL,NULL,NULL,NULL,NULL,'2026-09-11 08:44:28');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(11,2,'2026-09-14 07:26:07','2026-09-14 11:59:49',0,NULL,NULL,NULL,NULL,NULL,'2026-09-14 07:26:06');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(12,1,'2026-09-15 08:47:58','2026-09-15 11:22:50',0,NULL,NULL,NULL,NULL,NULL,'2026-09-15 08:47:58');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(13,2,'2026-09-17 07:28:14','2026-09-17 12:07:40',0,NULL,NULL,NULL,NULL,NULL,'2026-09-17 07:28:13');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(14,1,'2026-09-18 08:41:12','2026-09-18 10:51:41',0,NULL,NULL,NULL,NULL,NULL,'2026-09-18 08:41:12');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(15,2,'2026-09-21 07:23:51','2026-09-21 11:47:43',0,NULL,NULL,NULL,NULL,NULL,'2026-09-21 07:23:50');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(16,1,'2026-09-22 08:44:42','2026-09-22 11:04:49',0,NULL,NULL,NULL,NULL,NULL,'2026-09-22 08:44:41');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(17,2,'2026-09-24 07:25:58','2026-09-24 11:55:44',0,NULL,NULL,NULL,NULL,NULL,'2026-09-24 07:25:57');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(18,1,'2026-09-25 08:46:49','2026-09-25 11:16:46',0,NULL,NULL,NULL,NULL,NULL,'2026-09-25 08:46:48');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(19,2,'2026-09-28 07:20:35','2026-09-28 11:35:36',0,NULL,NULL,NULL,NULL,NULL,'2026-09-28 07:20:34');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(20,1,'2026-09-29 08:41:26','2026-09-29 10:46:59',0,NULL,NULL,NULL,NULL,NULL,'2026-09-29 08:41:25');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(21,2,'2026-10-01 07:22:42','2026-10-01 11:45:00',0,'vergessen auszustempeln','2026-10-01 07:22:42','','Adminkonto','2026-10-05 07:40:56','2026-10-01 07:22:41');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(22,1,'2026-10-02 08:43:32','2026-10-02 10:58:56',0,NULL,NULL,NULL,NULL,NULL,'2026-10-02 08:43:32');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(23,2,'2026-10-05 07:40:56','2026-10-05 11:20:32',0,NULL,NULL,NULL,NULL,NULL,'2026-10-05 07:40:55');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(24,1,'2026-10-04 10:00:00','2026-10-04 13:30:00',1,'Zusatzreinigung nach der Saisonabschlussfeier (Tablet war aus)',NULL,NULL,'Adminkonto','2026-10-06 08:53:55','2026-10-06 08:53:54');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(25,1,'2026-10-06 08:53:55','2026-10-06 11:23:51',0,NULL,NULL,NULL,NULL,NULL,'2026-10-06 08:53:54');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(26,2,'2026-10-08 07:42:03','2026-10-08 11:28:33',0,NULL,NULL,NULL,NULL,NULL,'2026-10-08 07:42:02');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(27,1,'2026-10-09 08:40:17','2026-10-09 11:20:04',0,NULL,NULL,NULL,NULL,NULL,'2026-10-09 08:40:16');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(28,2,'2026-10-12 07:37:40','2026-10-12 11:08:25',0,NULL,NULL,NULL,NULL,NULL,'2026-10-12 07:37:39');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(29,1,'2026-10-13 08:50:39','2026-10-13 11:05:51',0,NULL,NULL,NULL,NULL,NULL,'2026-10-13 08:50:38');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(30,2,'2026-10-15 07:39:47','2026-10-15 11:16:26',0,NULL,NULL,NULL,NULL,NULL,'2026-10-15 07:39:47');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(31,1,'2026-10-16 08:52:46','2026-10-16 11:17:48',0,NULL,NULL,NULL,NULL,NULL,'2026-10-16 08:52:45');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(32,2,'2026-10-19 07:34:38','2026-10-19 11:46:34',0,NULL,NULL,NULL,NULL,NULL,'2026-10-19 07:34:37');
INSERT INTO "time_entries"(id, staff_id, start_at, end_at, manual, note, orig_start, orig_end, edited_by, edited_at, created_at) VALUES(33,1,'2026-10-20 08:47:39','2026-10-20 11:27:52',0,NULL,NULL,NULL,NULL,NULL,'2026-10-20 08:47:38');
COMMIT;
