-- Clubwerk Demo-Daten (erfunden): Dienste & Termine. Bearbeiten: siehe werkzeuge/demo/aufteilen.js
BEGIN;
CREATE TABLE IF NOT EXISTS "aw_entry" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES members(id), event_id INTEGER REFERENCES aw_event(id),
  date TEXT NOT NULL, minutes INTEGER, text TEXT, in_at TEXT, out_at TEXT,
  status TEXT NOT NULL DEFAULT 'offen',              -- laeuft | offen | bestaetigt | abgelehnt
  source TEXT NOT NULL DEFAULT 'verwaltung',         -- verwaltung | app | tablet
  by_user TEXT, reviewed_by TEXT, reviewed_at TEXT, reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS "aw_event" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'arbeit', title TEXT NOT NULL, date TEXT NOT NULL, start TEXT, end TEXT, place TEXT,
  slots INTEGER, note TEXT, cancelled INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, permanent INTEGER NOT NULL DEFAULT 0, plan_id INTEGER, counts INTEGER NOT NULL DEFAULT 1, deadline TEXT, asked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS aw_exempt (member_id INTEGER NOT NULL PRIMARY KEY REFERENCES members(id), note TEXT, until_date TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS "aw_extern" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES aw_event(id), name TEXT NOT NULL, note TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS "aw_plan" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, from_date TEXT NOT NULL, to_date TEXT NOT NULL, place TEXT, note TEXT,
  counts INTEGER NOT NULL DEFAULT 1, published INTEGER NOT NULL DEFAULT 1, sales_event_id INTEGER, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS "aw_signup" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES aw_event(id), member_id INTEGER NOT NULL REFERENCES members(id), reminded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), answer TEXT NOT NULL DEFAULT 'ja', persons INTEGER NOT NULL DEFAULT 1, note TEXT, UNIQUE(event_id, member_id)
);
CREATE TABLE IF NOT EXISTS aw_target (member_id INTEGER NOT NULL REFERENCES members(id), year INTEGER NOT NULL, minutes INTEGER, note TEXT, PRIMARY KEY(member_id, year));
CREATE INDEX IF NOT EXISTS ix_awe_member ON aw_entry(member_id, date);
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(1,3,5,'2026-04-04',240,'Frühjahrsputz Anlage',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-04-04 13:25:33',NULL,'2026-04-04 13:25:32');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(2,10,5,'2026-04-04',240,'Frühjahrsputz Anlage',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-04-04 13:25:33',NULL,'2026-04-04 13:25:32');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(3,12,5,'2026-04-04',240,'Frühjahrsputz Anlage',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-04-04 13:25:33',NULL,'2026-04-04 13:25:32');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(4,14,5,'2026-04-04',240,'Frühjahrsputz Anlage',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-04-04 13:25:33',NULL,'2026-04-04 13:25:32');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(5,24,5,'2026-04-04',240,'Frühjahrsputz Anlage',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-04-04 13:25:33',NULL,'2026-04-04 13:25:32');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(6,21,NULL,'2026-05-23',240,'Küche im Vereinsheim gestrichen',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-05-25 19:30:55',NULL,'2026-05-25 19:30:54');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(7,27,NULL,'2026-05-23',240,'Küche im Vereinsheim gestrichen',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-05-25 19:30:55',NULL,'2026-05-25 19:30:54');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(8,11,6,'2026-07-03',180,'Aufbau',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(9,15,6,'2026-07-03',180,'Aufbau',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(10,17,6,'2026-07-03',180,'Aufbau',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(11,19,6,'2026-07-03',180,'Aufbau',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(12,26,6,'2026-07-03',180,'Aufbau',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(13,22,7,'2026-07-04',240,'Theke',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(14,23,7,'2026-07-04',240,'Theke',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(15,25,7,'2026-07-04',240,'Theke',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(16,28,8,'2026-07-04',240,'Theke',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(17,29,8,'2026-07-04',240,'Theke',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(18,30,8,'2026-07-04',240,'Theke',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(19,31,9,'2026-07-04',240,'Grill',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(20,33,10,'2026-07-05',180,'Kuchenbuffet',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(21,35,10,'2026-07-05',180,'Kuchenbuffet',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(22,11,11,'2026-07-05',120,'Abbau',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(23,15,11,'2026-07-05',120,'Abbau',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(24,34,11,'2026-07-05',120,'Abbau',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(25,36,11,'2026-07-05',120,'Abbau',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(26,38,11,'2026-07-05',120,'Abbau',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-07-06 19:20:11',NULL,'2026-07-06 19:20:10');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(27,39,12,'2026-08-19',120,'Hecke schneiden',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-08-19 19:25:58',NULL,'2026-08-19 19:25:57');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(28,40,12,'2026-08-19',120,'Hecke schneiden',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-08-19 19:25:58',NULL,'2026-08-19 19:25:57');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(29,41,12,'2026-08-19',120,'Hecke schneiden',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-08-19 19:25:58',NULL,'2026-08-19 19:25:57');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(30,4,1,'2026-09-04',270,'Thekendienst','2026-09-04 17:45:08','2026-09-04 22:10:48','bestaetigt','tablet',NULL,NULL,NULL,NULL,'2026-09-04 17:45:07');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(31,5,1,'2026-09-12',210,'Thekendienst','2026-09-12 15:30:49','2026-09-12 19:05:30','bestaetigt','tablet',NULL,'Adminkonto','2026-09-21 20:30:21',NULL,'2026-09-12 15:30:49');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(32,7,1,'2026-09-18',270,'Thekendienst','2026-09-18 18:00:04','2026-09-18 22:30:50','bestaetigt','tablet',NULL,'Adminkonto','2026-10-18 19:45:24',NULL,'2026-09-18 18:00:03');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(33,11,1,'2026-09-25',15,'Thekendienst','2026-09-25 18:05:40','2026-09-25 18:22:23','abgelehnt','tablet',NULL,'Adminkonto','2026-10-18 19:45:24','Versehentlich eingestempelt – kein Thekendienst','2026-09-25 18:05:39');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(34,9,1,'2026-09-26',255,'Thekendienst','2026-09-26 16:00:30','2026-09-26 20:15:31','bestaetigt','tablet',NULL,'Adminkonto','2026-10-18 19:45:24',NULL,'2026-09-26 16:00:29');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(35,4,1,'2026-10-02',225,'Thekendienst','2026-10-02 17:50:46','2026-10-02 21:40:13','bestaetigt','tablet',NULL,NULL,NULL,NULL,'2026-10-02 17:50:46');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(36,20,1,'2026-10-09',210,'Thekendienst','2026-10-09 17:30:48','2026-10-09 21:00:34','offen','tablet',NULL,NULL,NULL,NULL,'2026-10-09 17:30:48');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(37,6,14,'2026-10-10',180,'Platzpflege & Netze abbauen',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-10-10 13:26:00',NULL,'2026-10-10 13:25:59');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(38,17,14,'2026-10-10',180,'Platzpflege & Netze abbauen',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-10-10 13:26:00',NULL,'2026-10-10 13:25:59');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(39,33,14,'2026-10-10',180,'Platzpflege & Netze abbauen',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-10-10 13:26:00',NULL,'2026-10-10 13:25:59');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(40,39,14,'2026-10-10',180,'Platzpflege & Netze abbauen',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-10-10 13:26:00',NULL,'2026-10-10 13:25:59');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(41,40,14,'2026-10-10',180,'Platzpflege & Netze abbauen',NULL,NULL,'bestaetigt','verwaltung','Adminkonto','Adminkonto','2026-10-10 13:26:00',NULL,'2026-10-10 13:25:59');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(42,16,1,'2026-10-17',225,'Thekendienst','2026-10-17 15:00:18','2026-10-17 18:45:35','offen','tablet',NULL,NULL,NULL,NULL,'2026-10-17 15:00:17');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(43,26,NULL,'2026-10-19',90,'Rasen am Kleinfeld gemäht',NULL,NULL,'offen','app',NULL,NULL,NULL,NULL,'2026-10-20 21:15:29');
INSERT INTO "aw_entry"(id, member_id, event_id, date, minutes, text, in_at, out_at, status, source, by_user, reviewed_by, reviewed_at, reason, created_at) VALUES(44,35,NULL,'2026-10-20',60,'Blumenkübel am Eingang bepflanzt',NULL,NULL,'offen','app',NULL,NULL,NULL,NULL,'2026-10-20 21:15:29');
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(1,'theke','Thekendienst','2026-10-21',NULL,NULL,NULL,NULL,NULL,0,'Clubwerk','2026-02-13 14:52:50',1,NULL,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(2,'arbeit','Plätze herrichten','2026-10-21','17:00','20:00','Anlage',8,NULL,0,'Adminkonto','2026-02-13 14:52:50',0,NULL,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(3,'termin','Weihnachtsfeier','2026-12-12','18:00','23:00','Vereinsheim',60,'Mit Essen vom Buffet – bitte Begleitung angeben.',0,'Adminkonto','2026-02-13 14:52:50',0,NULL,0,'2026-12-05',0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(4,'termin','Mitgliederversammlung','2026-11-20','19:00',NULL,'Vereinsheim',NULL,NULL,0,'Adminkonto','2026-02-13 14:52:50',0,NULL,0,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(5,'arbeit','Frühjahrsputz Anlage','2026-04-04','09:00','13:00','Anlage',12,'Plätze abziehen, Linien setzen, Hecken schneiden. Bitte Arbeitshandschuhe mitbringen.',0,'Adminkonto','2026-03-21 20:05:13',0,NULL,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(6,'dienst','Aufbau','2026-07-03','16:00','19:00',NULL,6,NULL,0,'Adminkonto','2026-06-03 20:15:25',0,1,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(7,'dienst','Theke','2026-07-04','14:00','18:00',NULL,3,NULL,0,'Adminkonto','2026-06-03 20:15:25',0,1,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(8,'dienst','Theke','2026-07-04','18:00','22:00',NULL,3,NULL,0,'Adminkonto','2026-06-03 20:15:25',0,1,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(9,'dienst','Grill','2026-07-04','17:00','21:00',NULL,2,NULL,0,'Adminkonto','2026-06-03 20:15:25',0,1,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(10,'dienst','Kuchenbuffet','2026-07-05','14:00','17:00',NULL,3,NULL,0,'Adminkonto','2026-06-03 20:15:25',0,1,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(11,'dienst','Abbau','2026-07-05','17:00','19:00',NULL,6,NULL,0,'Adminkonto','2026-06-03 20:15:25',0,1,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(12,'arbeit','Hecke schneiden','2026-08-19','17:00','19:00','Anlage',4,NULL,0,'Adminkonto','2026-08-05 20:05:44',0,NULL,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(13,'termin','Saisonabschlussfeier','2026-10-03','18:00','23:00','Vereinsheim',80,'Mit Grillbuffet und Siegerehrung der Clubmeisterschaft – bitte Begleitung angeben.',0,'Adminkonto','2026-09-03 21:10:35',0,NULL,0,'2026-09-28',0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(14,'arbeit','Platzpflege & Netze abbauen','2026-10-10','10:00','13:00','Anlage',8,NULL,0,'Adminkonto','2026-09-26 20:05:40',0,NULL,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(15,'arbeit','Laub rechen & Wege kehren','2026-10-31','10:00','13:00','Anlage',8,'Rechen und Schubkarren sind im Geräteraum.',0,'Adminkonto','2026-10-12 20:00:53',0,NULL,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(16,'arbeit','Vereinsheim winterfest machen','2026-11-14','09:00','12:00','Vereinsheim',6,'Wasser abstellen, Terrassenmöbel einlagern, Dachrinnen reinigen.',0,'Adminkonto','2026-10-12 20:00:53',0,NULL,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(17,'dienst','Aufbau','2026-11-27','15:00','18:00',NULL,4,NULL,0,'Adminkonto','2026-10-13 20:40:36',0,2,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(18,'dienst','Theke','2026-11-27','18:00','21:00',NULL,3,NULL,0,'Adminkonto','2026-10-13 20:40:36',0,2,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(19,'dienst','Theke','2026-11-27','21:00','00:00',NULL,3,NULL,0,'Adminkonto','2026-10-13 20:40:36',0,2,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(20,'dienst','Glühweinstand','2026-11-27','18:00','22:00',NULL,2,NULL,0,'Adminkonto','2026-10-13 20:40:36',0,2,1,NULL,0);
INSERT INTO "aw_event"(id, kind, title, date, start, end, place, slots, note, cancelled, created_by, created_at, permanent, plan_id, counts, deadline, asked) VALUES(21,'dienst','Abbau','2026-11-28','10:00','12:00',NULL,4,NULL,0,'Adminkonto','2026-10-13 20:40:36',0,2,1,NULL,0);
INSERT INTO "aw_exempt"(member_id, note, until_date, created_by, created_at) VALUES(43,'Elternzeit','2026-12-24','Adminkonto','2026-03-20 19:10:56');
INSERT INTO "aw_extern"(id, event_id, name, note, created_by, created_at) VALUES(1,11,'Herbert Sommer','Förderverein','Adminkonto','2026-06-21 21:00:24');
INSERT INTO "aw_extern"(id, event_id, name, note, created_by, created_at) VALUES(2,17,'Herbert Sommer','Förderverein','Adminkonto','2026-10-16 19:05:30');
INSERT INTO "aw_plan"(id, title, from_date, to_date, place, note, counts, published, sales_event_id, created_by, created_at) VALUES(1,'Sommerfest','2026-07-03','2026-07-05','Vereinsheim und Terrasse','Danke an alle Helfer! Getränke für Helfer gehen aufs Haus.',1,1,NULL,'Adminkonto','2026-06-03 20:15:25');
INSERT INTO "aw_plan"(id, title, from_date, to_date, place, note, counts, published, sales_event_id, created_by, created_at) VALUES(2,'Glühweinabend','2026-11-27','2026-11-28','Terrasse am Vereinsheim','Bitte warm anziehen. Kinderpunsch und Waffeln gibt es auch.',1,1,NULL,'Adminkonto','2026-10-13 20:40:36');
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(1,3,4,0,'2026-02-13 14:52:50','ja',2,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(2,3,5,0,'2026-02-13 14:52:50','ja',3,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(3,3,6,0,'2026-02-13 14:52:50','nein',0,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(4,3,7,0,'2026-02-13 14:52:50','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(5,4,4,0,'2026-02-13 14:52:50','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(6,5,3,0,'2026-03-29 18:40:04','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(7,5,10,0,'2026-03-29 18:40:04','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(8,5,12,0,'2026-03-29 18:40:04','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(9,5,14,0,'2026-03-29 18:40:04','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(10,5,24,0,'2026-03-29 18:40:04','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(11,6,11,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(12,6,15,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(13,6,17,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(14,6,19,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(15,6,26,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(16,7,22,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(17,7,23,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(18,7,25,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(19,8,28,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(20,8,29,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(21,8,30,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(22,9,31,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(23,10,33,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(24,10,35,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(25,11,11,0,'2026-06-21 21:00:23','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(26,11,15,0,'2026-06-21 21:00:24','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(27,11,34,0,'2026-06-21 21:00:24','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(28,11,36,0,'2026-06-21 21:00:24','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(29,11,38,0,'2026-06-21 21:00:24','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(30,12,39,0,'2026-08-13 18:40:36','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(31,12,40,0,'2026-08-13 18:40:36','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(32,12,41,0,'2026-08-13 18:40:36','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(33,13,3,0,'2026-09-07 20:20:08','ja',2,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(34,13,5,0,'2026-09-07 20:20:08','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(35,13,9,0,'2026-09-07 20:20:08','ja',2,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(36,13,12,0,'2026-09-07 20:20:08','nein',0,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(37,13,14,0,'2026-09-17 19:50:39','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(38,13,16,0,'2026-09-17 19:50:40','ja',3,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(39,13,18,0,'2026-09-17 19:50:40','ja',2,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(40,13,20,0,'2026-09-17 19:50:40','nein',0,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(41,13,22,0,'2026-09-17 19:50:40','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(42,13,24,0,'2026-09-26 21:30:04','ja',2,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(43,13,26,0,'2026-09-26 21:30:04','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(44,13,28,0,'2026-09-26 21:30:04','ja',4,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(45,13,30,0,'2026-09-26 21:30:04','nein',0,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(46,13,33,0,'2026-09-26 21:30:04','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(47,13,7,0,'2026-09-26 21:30:04','ja',2,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(48,14,6,0,'2026-10-04 18:40:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(49,14,17,0,'2026-10-04 18:40:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(50,14,33,0,'2026-10-04 18:40:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(51,14,39,0,'2026-10-04 18:40:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(52,14,40,0,'2026-10-04 18:40:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(53,15,3,0,'2026-10-14 19:20:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(54,15,9,0,'2026-10-14 19:20:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(55,4,3,0,'2026-10-15 20:50:48','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(56,4,5,0,'2026-10-15 20:50:48','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(57,4,7,0,'2026-10-15 20:50:48','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(58,4,9,0,'2026-10-15 20:50:48','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(59,4,12,0,'2026-10-15 20:50:48','nein',0,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(60,4,14,0,'2026-10-15 20:50:48','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(61,17,7,0,'2026-10-16 19:05:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(62,17,16,0,'2026-10-16 19:05:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(63,18,5,0,'2026-10-16 19:05:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(64,18,18,0,'2026-10-16 19:05:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(65,18,22,0,'2026-10-16 19:05:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(66,19,30,0,'2026-10-16 19:05:30','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(67,3,9,0,'2026-10-17 21:05:28','ja',2,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(68,3,10,0,'2026-10-17 21:05:28','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(69,3,14,0,'2026-10-17 21:05:28','ja',3,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(70,3,18,0,'2026-10-17 21:05:28','ja',2,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(71,3,12,0,'2026-10-17 21:05:28','nein',0,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(72,15,14,0,'2026-10-19 18:10:14','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(73,16,40,0,'2026-10-19 18:10:14','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(74,4,11,0,'2026-10-20 19:35:27','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(75,4,16,0,'2026-10-20 19:35:27','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(76,4,20,0,'2026-10-20 19:35:27','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(77,4,24,0,'2026-10-20 19:35:27','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(78,4,27,0,'2026-10-20 19:35:27','nein',0,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(79,4,30,0,'2026-10-20 19:35:27','ja',1,'Komme etwas später, ca. 19:30');
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(80,4,39,0,'2026-10-20 19:35:27','nein',0,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(81,3,22,0,'2026-10-20 20:10:13','ja',4,'Zwei Kinder (6 und 9 Jahre)');
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(82,3,26,0,'2026-10-20 20:10:13','ja',2,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(83,3,29,0,'2026-10-20 20:10:13','ja',1,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(84,3,33,0,'2026-10-20 20:10:13','ja',2,NULL);
INSERT INTO "aw_signup"(id, event_id, member_id, reminded, created_at, answer, persons, note) VALUES(85,3,40,0,'2026-10-20 20:10:13','nein',0,NULL);
INSERT INTO "aw_target"(member_id, year, minutes, note) VALUES(24,2026,0,'Jugendtrainer – über das Training abgegolten');
INSERT INTO "settings"(key, value) VALUES('ext_arbeitseinsatz_seed_theke','1');
INSERT INTO "settings"(key, value) VALUES('ext_arbeitseinsatz_start_year','2026');
INSERT INTO "settings"(key, value) VALUES('ext_arbeitseinsatz_text','Jedes Mitglied ab 12 Jahren leistet 4 Arbeitsstunden im Jahr – Familien gemeinsam. Nicht geleistete Stunden berechnen wir mit 15 € je Stunde.');
INSERT INTO "settings"(key, value) VALUES('ext_arbeitseinsatz_contact','Sportwart (Telefon im Aushang)');
COMMIT;
