-- Clubwerk Demo-Daten (erfunden): Zugang. Bearbeiten: siehe werkzeuge/demo/aufteilen.js
BEGIN;
CREATE TABLE IF NOT EXISTS "zugang_log" (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL,
  who    TEXT,
  door   TEXT,
  action TEXT NOT NULL,               -- auf | zu | oeffnen | abgelehnt | fehler | freischaltung | alarm | sperre
  detail TEXT
);
CREATE INDEX IF NOT EXISTS ix_zugang_log_at ON zugang_log(at);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(3,'zugang','mitglied',NULL,0,'2026-02-13 14:52:50',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(4,'zugang','mitglied',NULL,0,'2026-02-13 14:52:50',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(7,'zugang','immer',NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(9,'zugang','trainer',NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(10,'zugang','trainer',NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(12,'zugang','mitglied',NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(14,'zugang','mitglied',NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(20,'zugang','mitglied',NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(26,'zugang','mitglied',NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(38,'zugang','jugend',NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(40,'zugang','jugend',NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(42,'zugang','jugend','2027-03-20',0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(16,'zugang','mitglied',NULL,1,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "settings"(key, value) VALUES('ext_zugang_cfg','{"vendor":"other","doors":[{"id":"c145a1d4","name":"Clubhaus","type":"lock","ref":"lock.clubhaus","sensor":"","pulseSec":3},{"id":"2a7e1b01","name":"Ballraum","type":"lock","ref":"lock.ballraum","sensor":"binary_sensor.ballraum_tuer","pulseSec":3},{"id":"2a7e1b02","name":"Halle","type":"impulse","ref":"switch.hallentor","sensor":"","pulseSec":5}],"profiles":[{"id":"mitglied","name":"Mitglied","doors":"all","windows":{"0":[["07:00","23:00"]],"1":[["07:00","23:00"]],"2":[["07:00","23:00"]],"3":[["07:00","23:00"]],"4":[["07:00","23:00"]],"5":[["07:00","23:00"]],"6":[["07:00","23:00"]]},"isDefault":true},{"id":"immer","name":"Rund um die Uhr","doors":"all","windows":{"0":[["00:00","24:00"]],"1":[["00:00","24:00"]],"2":[["00:00","24:00"]],"3":[["00:00","24:00"]],"4":[["00:00","24:00"]],"5":[["00:00","24:00"]],"6":[["00:00","24:00"]]},"isDefault":false},{"id":"trainer","name":"Trainer","doors":"all","windows":{"0":[["07:00","22:00"]],"1":[["06:00","23:30"]],"2":[["06:00","23:30"]],"3":[["06:00","23:30"]],"4":[["06:00","23:30"]],"5":[["06:00","23:30"]],"6":[["07:00","22:00"]]},"isDefault":false},{"id":"jugend","name":"Jugend","doors":["2a7e1b01","2a7e1b02"],"windows":{"0":[],"1":[["14:00","20:00"]],"2":[["14:00","20:00"]],"3":[["14:00","20:00"]],"4":[["14:00","20:00"]],"5":[["14:00","20:00"]],"6":[["09:00","18:00"]]},"isDefault":false}],"wlanOnly":true,"header":true,"appName":"Zugang","subtitle":"Türen öffnen","notify":"","openAlertMin":0,"blockAll":false,"blockDays":[{"from":"2026-12-05","to":"2026-12-06","note":"Grundreinigung Clubhaus"}]}');
INSERT INTO "settings"(key, value) VALUES('ext_zugang_used_ids','["mitglied","immer","c145a1d4","2a7e1b01","2a7e1b02","trainer","jugend"]');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(1,'2026-10-08 15:58:42','Moritz Wolf','Halle','oeffnen',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(2,'2026-10-08 19:10:42','Laura Schulz','Clubhaus','auf','am Tablet');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(3,'2026-10-09 08:12:49','Peter Hofmann','Clubhaus','auf',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(4,'2026-10-09 21:47:49','Felix Adler','Clubhaus','zu',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(5,'2026-10-10 16:52:56','Markus Weber','Halle','oeffnen',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(6,'2026-10-10 17:05:56','Tim Walter','Ballraum','auf','am Tablet');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(7,'2026-10-10 18:58:56','Tim Walter','Ballraum','zu','am Tablet');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(8,'2026-10-11 09:31:03','Anna Becker','Clubhaus','auf',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(9,'2026-10-11 18:40:03','Julia Fischer','Halle','oeffnen',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(10,'2026-10-11 22:05:03','Julia Fischer','Clubhaus','zu',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(11,'2026-10-12 15:58:10','Moritz Wolf','Halle','oeffnen',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(12,'2026-10-12 19:10:10','Laura Schulz','Clubhaus','auf','am Tablet');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(13,'2026-10-13 08:12:17','Peter Hofmann','Clubhaus','auf',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(14,'2026-10-13 21:47:17','Felix Adler','Clubhaus','zu',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(15,'2026-10-14 16:52:24','Markus Weber','Halle','oeffnen',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(16,'2026-10-14 17:05:24','Tim Walter','Ballraum','auf','am Tablet');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(17,'2026-10-14 18:58:24','Tim Walter','Ballraum','zu','am Tablet');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(18,'2026-10-15 09:31:31','Anna Becker','Clubhaus','auf',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(19,'2026-10-15 18:40:31','Julia Fischer','Halle','oeffnen',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(20,'2026-10-15 22:05:31','Julia Fischer','Clubhaus','zu',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(21,'2026-10-16 15:58:38','Moritz Wolf','Halle','oeffnen',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(22,'2026-10-16 19:10:38','Laura Schulz','Clubhaus','auf','am Tablet');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(23,'2026-10-17 08:12:45','Peter Hofmann','Clubhaus','auf',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(24,'2026-10-17 21:47:45','Felix Adler','Clubhaus','zu',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(25,'2026-10-18 16:52:52','Markus Weber','Halle','oeffnen',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(26,'2026-10-18 17:05:52','Tim Walter','Ballraum','auf','am Tablet');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(27,'2026-10-18 18:58:52','Tim Walter','Ballraum','zu','am Tablet');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(28,'2026-10-19 09:31:59','Anna Becker','Clubhaus','auf',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(29,'2026-10-19 18:40:59','Julia Fischer','Halle','oeffnen',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(30,'2026-10-19 22:05:59','Julia Fischer','Clubhaus','zu',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(31,'2026-10-20 15:58:06','Moritz Wolf','Halle','oeffnen',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(32,'2026-10-20 19:10:06','Laura Schulz','Clubhaus','auf','am Tablet');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(33,'2026-10-15 20:41:31','Moritz Wolf','Halle','abgelehnt','Jetzt nicht – wieder möglich ab morgen 14:00 Uhr.');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(34,'2026-10-17 19:02:45','Stefan Brandt','Clubhaus','abgelehnt','Dieser Bereich ist für dich gesperrt – bitte beim Vorstand melden.');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(35,'2026-10-19 23:30:59',NULL,'Ballraum','alarm','steht seit 30 Minuten offen');
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(36,'2026-10-21 11:43:06','Peter Hofmann','Clubhaus','auf',NULL);
INSERT INTO "zugang_log"(id, at, who, door, action, detail) VALUES(37,'2026-10-21 13:38:06','Jan Albrecht','Halle','oeffnen','am Tablet');
COMMIT;
