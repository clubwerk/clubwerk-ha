-- Clubwerk Demo-Daten (erfunden): Beregnung. Bearbeiten: siehe werkzeuge/demo/aufteilen.js
BEGIN;
CREATE TABLE IF NOT EXISTS "irr_log" (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  who    TEXT,
  action TEXT NOT NULL,               -- start | stop | fehler
  platz  TEXT,
  sec    INTEGER,
  detail TEXT
);
CREATE TABLE IF NOT EXISTS "irr_steps" (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id   INTEGER NOT NULL,
  platz    INTEGER NOT NULL,          -- Index in der Platzliste
  label    TEXT,
  ref      TEXT NOT NULL,             -- Home-Assistant-Entität bzw. Hydrawise-Zonennummer
  sec      INTEGER NOT NULL,
  start_at INTEGER NOT NULL,          -- ms
  end_at   INTEGER NOT NULL,          -- ms
  state    TEXT NOT NULL DEFAULT 'wait', -- wait | run | done | stopped | fail
  err      TEXT
);
CREATE INDEX IF NOT EXISTS ix_irr_log_at ON irr_log(at);
CREATE INDEX IF NOT EXISTS ix_irr_steps_state ON irr_steps(state, start_at);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(1,'2026-02-13 14:52:50','Adminkonto','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(2,'2026-02-13 14:52:50',NULL,'fehler','Platz 1',NULL,'switch.platz1: Clubwerk hat keinen Zugangsschlüssel für Home Assistant bekommen. Bitte das Add-on einmal neu starten; hilft das nicht, im Protokoll des Add-ons die Zeile „Verbindung zu Home Assistant“ prüfen.');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(3,'2026-02-13 14:52:50','Adminkonto','stop','Platz 1',NULL,'Fehler: switch.platz1: Clubwerk hat keinen Zugangsschlüssel für Home Assistant bekommen. Bitte das Add-on einmal neu starten; hilft das nicht, im Protokoll des Add-ons die Zeile „Verbindung zu Home Assistant“ prüfen.');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(4,'2026-09-11 12:15:33','Vereins-PIN','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(5,'2026-09-11 12:15:33','Peter Hofmann','start','Platz 2',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(6,'2026-09-13 12:15:47','Vereins-PIN','start','Platz 3',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(7,'2026-09-13 12:15:47','Markus Weber','start','Platz 4',840,'2 Zonen nacheinander');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(8,'2026-09-14 07:40:54','Adminkonto','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(9,'2026-09-16 07:40:08','Daniel Graf','start','Platz 2',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(10,'2026-09-17 12:15:15','Vereins-PIN','start','Platz 3',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(11,'2026-09-17 12:15:15','Peter Hofmann','start','Platz 4',840,'2 Zonen nacheinander');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(12,'2026-09-19 12:15:29','Vereins-PIN','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(13,'2026-09-19 12:19:00','Vereins-PIN','stop','Platz 1',NULL,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(14,'2026-09-19 12:15:29','Markus Weber','start','Platz 2',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(15,'2026-09-20 07:40:36','Adminkonto','start','Platz 3',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(16,'2026-09-22 07:40:50','Daniel Graf','start','Platz 4',840,'2 Zonen nacheinander');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(17,'2026-09-23 12:15:57','Vereins-PIN','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(18,'2026-09-23 12:15:57','Peter Hofmann','start','Platz 2',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(19,'2026-09-25 12:15:11','Vereins-PIN','start','Platz 3',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(20,'2026-09-25 12:15:11','Markus Weber','start','Platz 4',840,'2 Zonen nacheinander');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(21,'2026-09-26 07:40:18','Adminkonto','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(22,'2026-09-28 07:40:32','Daniel Graf','start','Platz 2',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(23,'2026-09-28 07:44:00','Daniel Graf','stop','Platz 2',NULL,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(24,'2026-09-29 12:15:39','Vereins-PIN','start','Platz 3',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(25,'2026-09-29 12:15:39','Peter Hofmann','start','Platz 4',840,'2 Zonen nacheinander');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(26,'2026-10-01 12:15:53','Vereins-PIN','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(27,'2026-10-01 12:15:53','Markus Weber','start','Platz 2',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(28,'2026-10-02 07:40:00','Adminkonto','start','Platz 3',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(29,'2026-10-04 07:40:14','Daniel Graf','start','Platz 4',840,'2 Zonen nacheinander');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(30,'2026-10-05 12:15:21','Vereins-PIN','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(31,'2026-10-05 12:15:21','Peter Hofmann','start','Platz 2',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(32,'2026-10-07 12:15:35','Vereins-PIN','start','Platz 3',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(33,'2026-10-07 12:19:00','Vereins-PIN','stop','Platz 3',NULL,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(34,'2026-10-07 12:15:35','Markus Weber','start','Platz 4',840,'2 Zonen nacheinander');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(35,'2026-10-08 07:40:42','Adminkonto','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(36,'2026-10-10 07:40:56','Daniel Graf','start','Platz 2',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(37,'2026-10-11 12:15:03','Vereins-PIN','start','Platz 3',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(38,'2026-10-11 12:15:03','Peter Hofmann','start','Platz 4',840,'2 Zonen nacheinander');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(39,'2026-10-13 12:15:17','Vereins-PIN','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(40,'2026-10-13 12:15:17','Markus Weber','start','Platz 2',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(41,'2026-10-14 07:40:24','Adminkonto','start','Platz 3',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(42,'2026-10-16 07:40:38','Daniel Graf','start','Platz 4',840,'2 Zonen nacheinander');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(43,'2026-10-16 07:44:00','Daniel Graf','stop','Platz 4',NULL,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(44,'2026-10-17 12:15:45','Vereins-PIN','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(45,'2026-10-17 12:15:45','Peter Hofmann','start','Platz 2',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(46,'2026-10-19 12:15:59','Vereins-PIN','start','Platz 3',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(47,'2026-10-19 12:15:59','Markus Weber','start','Platz 4',840,'2 Zonen nacheinander');
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(48,'2026-10-20 07:40:06','Adminkonto','start','Platz 1',600,NULL);
INSERT INTO "irr_log"(id, at, who, action, platz, sec, detail) VALUES(49,'2026-10-21 12:33:06','Vereins-PIN','start','Platz 2',600,NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(1,1792603053771,0,NULL,'switch.platz1',600,1792603053771,1792603653771,'fail','Clubwerk hat keinen Zugangsschlüssel für Home Assistant bekommen. Bitte das Add-on einmal neu starten; hilft das nicht, im Protokoll des Add-ons die Zeile „Verbindung zu Home Assistant“ prüfen.');
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(2,1789733733000,0,NULL,'switch.platz1',600,1789733733000,1789734333000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(3,1789733733000,1,NULL,'switch.platz2',600,1789733733000,1789734333000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(4,1789906547000,2,NULL,'switch.platz3',600,1789906547000,1789907147000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(5,1789906547000,3,'Nord','switch.platz4_nord',420,1789906547000,1789906967000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(6,1789906967000,3,'Süd','switch.platz4_sued',420,1789906967000,1789907387000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(7,1789976454000,0,NULL,'switch.platz1',600,1789976454000,1789977054000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(8,1790149208000,1,NULL,'switch.platz2',600,1790149208000,1790149808000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(9,1790252115000,2,NULL,'switch.platz3',600,1790252115000,1790252715000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(10,1790252115000,3,'Nord','switch.platz4_nord',420,1790252115000,1790252535000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(11,1790252535000,3,'Süd','switch.platz4_sued',420,1790252535000,1790252955000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(12,1790424929000,0,NULL,'switch.platz1',600,1790424929000,1790425529000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(13,1790424929000,1,NULL,'switch.platz2',600,1790424929000,1790425529000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(14,1790494836000,2,NULL,'switch.platz3',600,1790494836000,1790495436000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(15,1790667650000,3,'Nord','switch.platz4_nord',420,1790667650000,1790668070000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(16,1790668070000,3,'Süd','switch.platz4_sued',420,1790668070000,1790668490000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(17,1790770557000,0,NULL,'switch.platz1',600,1790770557000,1790771157000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(18,1790770557000,1,NULL,'switch.platz2',600,1790770557000,1790771157000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(19,1790943311000,2,NULL,'switch.platz3',600,1790943311000,1790943911000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(20,1790943311000,3,'Nord','switch.platz4_nord',420,1790943311000,1790943731000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(21,1790943731000,3,'Süd','switch.platz4_sued',420,1790943731000,1790944151000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(22,1791013218000,0,NULL,'switch.platz1',600,1791013218000,1791013818000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(23,1791186032000,1,NULL,'switch.platz2',600,1791186032000,1791186632000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(24,1791288939000,2,NULL,'switch.platz3',600,1791288939000,1791289539000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(25,1791288939000,3,'Nord','switch.platz4_nord',420,1791288939000,1791289359000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(26,1791289359000,3,'Süd','switch.platz4_sued',420,1791289359000,1791289779000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(27,1791461753000,0,NULL,'switch.platz1',600,1791461753000,1791462353000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(28,1791461753000,1,NULL,'switch.platz2',600,1791461753000,1791462353000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(29,1791531600000,2,NULL,'switch.platz3',600,1791531600000,1791532200000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(30,1791704414000,3,'Nord','switch.platz4_nord',420,1791704414000,1791704834000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(31,1791704834000,3,'Süd','switch.platz4_sued',420,1791704834000,1791705254000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(32,1791807321000,0,NULL,'switch.platz1',600,1791807321000,1791807921000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(33,1791807321000,1,NULL,'switch.platz2',600,1791807321000,1791807921000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(34,1791980135000,2,NULL,'switch.platz3',600,1791980135000,1791980735000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(35,1791980135000,3,'Nord','switch.platz4_nord',420,1791980135000,1791980555000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(36,1791980555000,3,'Süd','switch.platz4_sued',420,1791980555000,1791980975000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(37,1792050042000,0,NULL,'switch.platz1',600,1792050042000,1792050642000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(38,1792222856000,1,NULL,'switch.platz2',600,1792222856000,1792223456000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(39,1792325703000,2,NULL,'switch.platz3',600,1792325703000,1792326303000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(40,1792325703000,3,'Nord','switch.platz4_nord',420,1792325703000,1792326123000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(41,1792326123000,3,'Süd','switch.platz4_sued',420,1792326123000,1792326543000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(42,1792498517000,0,NULL,'switch.platz1',600,1792498517000,1792499117000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(43,1792498517000,1,NULL,'switch.platz2',600,1792498517000,1792499117000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(44,1792568424000,2,NULL,'switch.platz3',600,1792568424000,1792569024000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(45,1792741238000,3,'Nord','switch.platz4_nord',420,1792741238000,1792741658000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(46,1792741658000,3,'Süd','switch.platz4_sued',420,1792741658000,1792742078000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(47,1792844145000,0,NULL,'switch.platz1',600,1792844145000,1792844745000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(48,1792844145000,1,NULL,'switch.platz2',600,1792844145000,1792844745000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(49,1793016959000,2,NULL,'switch.platz3',600,1793016959000,1793017559000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(50,1793016959000,3,'Nord','switch.platz4_nord',420,1793016959000,1793017379000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(51,1793017379000,3,'Süd','switch.platz4_sued',420,1793017379000,1793017799000,'done',NULL);
INSERT INTO "irr_steps"(id, run_id, platz, label, ref, sec, start_at, end_at, state, err) VALUES(52,1793086806000,0,NULL,'switch.platz1',600,1793086806000,1793087406000,'done',NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(4,'beregnung',NULL,NULL,0,'2026-02-13 14:52:50',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(3,'beregnung',NULL,NULL,0,'2026-02-13 14:52:50',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(7,'beregnung',NULL,NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(9,'beregnung',NULL,NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "member_access"(member_id, module, profile, valid_until, blocked, created_at, away, flags) VALUES(20,'beregnung',NULL,NULL,0,'2026-03-20 19:10:55',0,NULL);
INSERT INTO "settings"(key, value) VALUES('ext_beregnung_cfg','{"backend":"ha","vendor":"other","mode":"pin","stopFree":false,"cooldownMin":0,"header":true,"appName":"Beregnung","webappUrl":"","subtitle":"Bewässerungssteuerung","nextEntity":"","notify":"","plaetze":[{"name":"Platz 1","sub":"Sand","zones":[{"ref":"switch.platz1","label":"","sec":600}]},{"name":"Platz 2","sub":"Sand","zones":[{"ref":"switch.platz2","label":"","sec":600}]},{"name":"Platz 3","sub":"Sand","zones":[{"ref":"switch.platz3","label":"","sec":600}]},{"name":"Platz 4","sub":"Sand · zwei Zonen","zones":[{"ref":"switch.platz4_nord","label":"Nord","sec":420},{"ref":"switch.platz4_sued","label":"Süd","sec":420}]}]}');
INSERT INTO "settings"(key, value) VALUES('ext_beregnung_err_seen','2026-10-21 14:53:08');
COMMIT;
