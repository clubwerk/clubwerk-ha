-- Clubwerk Demo-Daten (erfunden): Spielbetrieb. Bearbeiten: siehe werkzeuge/demo/aufteilen.js
BEGIN;
CREATE TABLE IF NOT EXISTS sp_avail (
  game_id INTEGER NOT NULL REFERENCES sp_game(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id),
  state TEXT NOT NULL,                                          -- ja | nein
  from_t TEXT, until_t TEXT, note TEXT, at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY (game_id, member_id)
);
CREATE TABLE IF NOT EXISTS sp_extern (
  member_id INTEGER NOT NULL PRIMARY KEY REFERENCES members(id), phone TEXT, club TEXT, token TEXT NOT NULL UNIQUE,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), last_seen TEXT
, token_at TEXT);
CREATE TABLE IF NOT EXISTS sp_game (
  id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER NOT NULL REFERENCES sp_team(id) ON DELETE CASCADE,
  date TEXT NOT NULL, start TEXT, home INTEGER NOT NULL DEFAULT 1, opponent TEXT NOT NULL, venue TEXT, league TEXT,
  ext_key TEXT, status TEXT NOT NULL DEFAULT 'geplant',        -- geplant | abgesagt
  meet_time TEXT, meet_place TEXT, note TEXT, result TEXT,
  rem_players INTEGER NOT NULL DEFAULT 0, rem_captain INTEGER NOT NULL DEFAULT 0, lineup_sent_at TEXT,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, kind TEXT NOT NULL DEFAULT 'spiel', za INTEGER NOT NULL DEFAULT 0, released INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS sp_lineup (
  game_id INTEGER NOT NULL REFERENCES sp_game(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id),
  role TEXT NOT NULL DEFAULT 'spielt',                          -- spielt | ersatz
  pos INTEGER, withdraw INTEGER NOT NULL DEFAULT 0, withdraw_note TEXT, withdraw_at TEXT,
  by_user TEXT, at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY (game_id, member_id)
);
CREATE TABLE IF NOT EXISTS sp_player (
  team_id INTEGER NOT NULL REFERENCES sp_team(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id),
  rank INTEGER NOT NULL DEFAULT 99, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY (team_id, member_id)
);
CREATE TABLE IF NOT EXISTS sp_task (
  id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER NOT NULL REFERENCES sp_game(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, label TEXT NOT NULL, member_id INTEGER REFERENCES members(id), note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS sp_team (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, league TEXT, season TEXT, min_players INTEGER NOT NULL DEFAULT 4,
  captain_id INTEGER REFERENCES members(id), vice_id INTEGER REFERENCES members(id), import_key TEXT,
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, age_class TEXT);
CREATE INDEX IF NOT EXISTS ix_sp_game_key ON sp_game(ext_key);
CREATE INDEX IF NOT EXISTS ix_sp_game_team ON sp_game(team_id, date);
CREATE INDEX IF NOT EXISTS ix_sp_task_game ON sp_task(game_id);
INSERT INTO "settings"(key, value) VALUES('ext_spielbetrieb_ics_key','245cdc0f1342d111142539ee7e3b55793e5f6fa142ef9935');
INSERT INTO "settings"(key, value) VALUES('ext_spielbetrieb_tasks','1');
INSERT INTO "settings"(key, value) VALUES('ext_spielbetrieb_task_kinds','[{"k":"fahrer","l":"Fahrer","when":"auswaerts"},{"k":"bewirtung","l":"Bewirtung","when":"heim"},{"k":"kuchen","l":"Kuchen backen","when":"heim"},{"k":"baelle","l":"Bälle mitbringen","when":"immer"},{"k":"bericht","l":"Spielbericht eintragen","when":"immer"}]');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(4,14,'ja',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(4,16,'ja',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(4,18,'ja',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(4,20,'ja',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(4,32,'ja',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(4,34,'nein',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(5,14,'ja',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(5,16,'ja',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(5,18,'ja',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(5,20,'ja',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(5,32,'ja',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(5,34,'nein',NULL,NULL,NULL,'2026-09-30 14:53:03');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(6,12,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(6,21,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(6,23,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(6,25,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(6,29,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(6,33,'nein',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(7,9,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(7,22,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(7,24,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(7,26,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(7,28,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(7,30,'nein',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(8,36,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(8,38,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(8,40,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(8,42,'nein',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(9,11,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(9,16,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(9,18,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(9,20,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(9,22,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(9,24,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(9,26,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(9,28,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(9,30,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(9,32,'nein',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(10,11,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(10,16,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(10,18,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(10,20,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(10,22,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(10,24,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(10,26,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(10,28,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(10,30,'ja',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(10,32,'nein',NULL,NULL,NULL,'2026-09-30 14:53:04');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(11,14,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(11,16,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(11,18,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(11,20,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(11,32,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(11,34,'nein',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(12,14,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(12,16,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(12,20,'nein',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(13,12,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(13,21,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(13,23,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(13,25,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(13,29,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(14,12,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(14,23,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(14,25,'nein',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(15,9,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(15,22,'nein',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(15,26,'nein',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(15,28,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(17,36,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(17,38,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(17,40,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(18,11,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(18,16,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(18,18,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(18,20,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(18,22,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(18,24,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(18,26,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(18,28,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(18,30,'nein',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(19,11,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(19,16,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(19,18,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(1,3,'ja',NULL,NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(1,4,'ja',NULL,NULL,NULL,'2026-03-20 19:10:55');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(1,5,'ja',NULL,NULL,NULL,'2026-03-20 19:10:55');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(1,6,'nein',NULL,NULL,NULL,'2026-03-20 19:10:55');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(1,8,'ja',NULL,NULL,NULL,'2026-03-20 19:10:55');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(2,3,'ja',NULL,NULL,NULL,'2026-03-20 19:10:55');
INSERT INTO "sp_avail"(game_id, member_id, state, from_t, until_t, note, at) VALUES(2,4,'ja',NULL,NULL,NULL,'2026-03-20 19:10:55');
INSERT INTO "sp_extern"(member_id, phone, club, token, created_by, created_at, last_seen, token_at) VALUES(13,'0171 2223333','TC Nachbarort','PpWOkYt3sXCLaACOKotw2keT','Adminkonto','2026-02-13 14:52:50',NULL,'2026-10-21 17:26:50');
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(1,1,'2026-10-28','10:00',1,'TC Nachbarort 1',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,NULL,0,0,NULL,'Adminkonto','2026-02-13 14:52:50','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(2,1,'2026-11-04','10:00',0,'TC Nachbarort 2',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,NULL,0,0,NULL,'Adminkonto','2026-02-13 14:52:50','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(3,1,'2026-11-11','10:00',1,'TC Nachbarort 3',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,NULL,0,0,NULL,'Adminkonto','2026-02-13 14:52:50','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(4,2,'2026-10-03','14:00',1,'TC Blau-Weiß Beispielstadt',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,'4:2',0,0,'2026-10-21 14:53:03','Adminkonto','2026-09-30 14:53:03','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(5,2,'2026-10-17','14:00',0,'TV Musterdorf','Tennishalle Musterdorf, Hallenweg 3',NULL,NULL,'geplant','12:45','Parkplatz am Clubhaus',NULL,'3:3',0,0,'2026-10-21 14:53:04','Adminkonto','2026-09-30 14:53:03','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(6,3,'2026-10-11','10:00',0,'TC Beispielstadt','Tennishalle Beispielstadt, Am Sportpark 1',NULL,NULL,'geplant','08:45','Parkplatz am Clubhaus',NULL,'1:5',0,0,'2026-10-21 14:53:04','Adminkonto','2026-09-30 14:53:04','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(7,4,'2026-10-10','10:00',1,'TSV Musterhausen',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,'5:1',0,0,'2026-10-21 14:53:04','Adminkonto','2026-09-30 14:53:04','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(8,5,'2026-10-04','10:00',1,'TC Exempelhausen',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,'2:4',0,0,'2026-10-21 14:53:04','Adminkonto','2026-09-30 14:53:04','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(9,6,'2026-10-09','19:00',1,'SG Beispielstadt',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,'3:2',0,0,'2026-10-21 14:53:04','Adminkonto','2026-09-30 14:53:04','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(10,6,'2026-10-16','19:00',0,'SV Musterdorf','Sportplatz am Waldrand',NULL,NULL,'geplant','18:00','Parkplatz am Clubhaus',NULL,'1:1',0,0,'2026-10-21 14:53:04','Adminkonto','2026-09-30 14:53:04','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(11,2,'2026-10-24','14:00',1,'TC Rot-Weiß Probstadt',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,NULL,0,0,'2026-10-21 14:53:07','Adminkonto','2026-03-20 19:10:54','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(12,2,'2026-11-07','14:00',0,'SV Exempelhausen','Tennishalle Musterdorf, Hallenweg 3',NULL,NULL,'geplant','12:45','Parkplatz am Clubhaus',NULL,NULL,0,0,NULL,'Adminkonto','2026-03-20 19:10:54','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(13,3,'2026-10-25','10:00',1,'TV Musterdorf',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,NULL,0,0,NULL,'Adminkonto','2026-03-20 19:10:54','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(14,3,'2026-11-08','10:00',0,'TC Grün-Gelb Modellheim','Tennishalle Beispielstadt, Am Sportpark 1',NULL,NULL,'geplant','08:45','Parkplatz am Clubhaus',NULL,NULL,0,0,NULL,'Adminkonto','2026-03-20 19:10:54','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(15,4,'2026-10-31','10:00',0,'TC Probstadt','Tennishalle Probstadt, Ringstraße 12',NULL,NULL,'geplant','08:45','Parkplatz am Clubhaus',NULL,NULL,0,0,NULL,'Adminkonto','2026-03-20 19:10:54','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(16,4,'2026-11-14','10:00',1,'TV Beispieltal',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,NULL,0,0,NULL,'Adminkonto','2026-03-20 19:10:54','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(17,5,'2026-11-01','10:00',0,'TV Musterdorf','Tennishalle Musterdorf, Hallenweg 3',NULL,NULL,'geplant','08:45','Parkplatz am Clubhaus',NULL,NULL,0,0,NULL,'Adminkonto','2026-03-20 19:10:54','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(18,6,'2026-10-30','19:00',1,'FC Modellheim',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,NULL,0,0,'2026-10-21 14:53:07','Adminkonto','2026-03-20 19:10:54','spiel',0,1);
INSERT INTO "sp_game"(id, team_id, date, start, home, opponent, venue, league, ext_key, status, meet_time, meet_place, note, result, rem_players, rem_captain, lineup_sent_at, created_by, created_at, kind, za, released) VALUES(19,6,'2026-11-13','19:00',0,'SpVgg Probstadt','Sportplatz am Waldrand',NULL,NULL,'geplant','18:00','Parkplatz am Clubhaus',NULL,NULL,0,0,NULL,'Adminkonto','2026-03-20 19:10:54','spiel',0,1);
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(4,14,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:03');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(4,16,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:03');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(4,18,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:03');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(4,20,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:03');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(4,32,'ersatz',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:03');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(5,14,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:03');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(5,16,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:03');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(5,18,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:03');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(5,20,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:03');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(5,32,'ersatz',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:03');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(6,12,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(6,21,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(6,23,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(6,25,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(6,29,'ersatz',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(7,9,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(7,22,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(7,24,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(7,26,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(7,28,'ersatz',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(8,36,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(8,38,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(8,40,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(9,11,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(9,16,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(9,18,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(9,20,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(9,22,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(9,24,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(9,26,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(9,28,'ersatz',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(9,30,'ersatz',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(10,11,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(10,16,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(10,18,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(10,20,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(10,22,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(10,24,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(10,26,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(10,28,'ersatz',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(10,30,'ersatz',NULL,0,NULL,NULL,'Adminkonto','2026-09-30 14:53:04');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(11,14,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(11,16,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(11,18,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(11,20,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(11,32,'ersatz',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(13,12,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(13,21,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(13,23,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(13,25,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(13,29,'ersatz',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(18,11,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(18,16,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(18,18,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(18,20,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(18,22,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(18,24,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(18,26,'spielt',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_lineup"(game_id, member_id, role, pos, withdraw, withdraw_note, withdraw_at, by_user, at) VALUES(18,28,'ersatz',NULL,0,NULL,NULL,'Adminkonto','2026-03-20 19:10:54');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(1,3,1,'2026-02-13 14:52:50');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(1,4,2,'2026-02-13 14:52:50');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(1,5,3,'2026-02-13 14:52:50');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(1,6,4,'2026-02-13 14:52:50');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(1,7,5,'2026-02-13 14:52:50');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(1,8,6,'2026-02-13 14:52:50');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(1,13,7,'2026-02-13 14:52:50');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(2,14,1,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(2,16,2,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(2,18,3,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(2,20,4,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(2,32,5,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(2,34,6,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(3,12,1,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(3,21,2,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(3,23,3,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(3,25,4,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(3,29,5,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(3,33,6,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(4,9,1,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(4,22,2,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(4,24,3,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(4,26,4,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(4,28,5,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(4,30,6,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(5,36,1,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(5,38,2,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(5,40,3,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(5,42,4,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(6,11,1,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(6,16,2,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(6,18,3,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(6,20,4,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(6,22,5,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(6,24,6,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(6,26,7,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(6,28,8,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(6,30,9,'2026-09-30 14:53:03');
INSERT INTO "sp_player"(team_id, member_id, rank, created_at) VALUES(6,32,10,'2026-09-30 14:53:03');
INSERT INTO "sp_task"(id, game_id, kind, label, member_id, note, created_at) VALUES(1,11,'bewirtung','Bewirtung',20,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_task"(id, game_id, kind, label, member_id, note, created_at) VALUES(2,11,'kuchen','Kuchen backen',NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_task"(id, game_id, kind, label, member_id, note, created_at) VALUES(3,11,'baelle','Bälle mitbringen',14,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_task"(id, game_id, kind, label, member_id, note, created_at) VALUES(4,13,'bewirtung','Bewirtung',25,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_task"(id, game_id, kind, label, member_id, note, created_at) VALUES(5,13,'kuchen','Kuchen backen',29,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_task"(id, game_id, kind, label, member_id, note, created_at) VALUES(6,15,'fahrer','Fahrer',9,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_task"(id, game_id, kind, label, member_id, note, created_at) VALUES(7,15,'fahrer','Fahrer',NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_task"(id, game_id, kind, label, member_id, note, created_at) VALUES(8,17,'fahrer','Fahrer',10,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_task"(id, game_id, kind, label, member_id, note, created_at) VALUES(9,17,'fahrer','Fahrer',NULL,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_task"(id, game_id, kind, label, member_id, note, created_at) VALUES(10,18,'bewirtung','Bewirtung',24,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_task"(id, game_id, kind, label, member_id, note, created_at) VALUES(11,18,'bericht','Spielbericht eintragen',20,NULL,'2026-03-20 19:10:54');
INSERT INTO "sp_team"(id, name, league, season, min_players, captain_id, vice_id, import_key, active, sort, note, created_at, age_class) VALUES(1,'Herren 30',NULL,NULL,4,3,NULL,'herren30',1,0,NULL,'2026-02-13 14:52:50','H30');
INSERT INTO "sp_team"(id, name, league, season, min_players, captain_id, vice_id, import_key, active, sort, note, created_at, age_class) VALUES(2,'Herren','Bezirksliga','Winter 2026/27',4,14,16,'herren',1,0,NULL,'2026-09-30 14:53:03','H');
INSERT INTO "sp_team"(id, name, league, season, min_players, captain_id, vice_id, import_key, active, sort, note, created_at, age_class) VALUES(3,'Damen','Bezirksoberliga','Winter 2026/27',4,12,21,'damen',1,0,NULL,'2026-09-30 14:53:03','D');
INSERT INTO "sp_team"(id, name, league, season, min_players, captain_id, vice_id, import_key, active, sort, note, created_at, age_class) VALUES(4,'Herren 40','Bezirksliga','Winter 2026/27',4,9,22,'herren40',1,0,NULL,'2026-09-30 14:53:03','H40');
INSERT INTO "sp_team"(id, name, league, season, min_players, captain_id, vice_id, import_key, active, sort, note, created_at, age_class) VALUES(5,'Junioren U15','Kreisliga','Winter 2026/27',4,10,NULL,'juniorenu15',1,0,NULL,'2026-09-30 14:53:03',NULL);
INSERT INTO "sp_team"(id, name, league, season, min_players, captain_id, vice_id, import_key, active, sort, note, created_at, age_class) VALUES(6,'Fußball AH','Freundschaftsspiele','2026/27',7,20,11,'fußballah',1,0,NULL,'2026-09-30 14:53:03',NULL);
COMMIT;
