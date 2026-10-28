-- Clubwerk Demo-Daten (erfunden). Laden: node werkzeuge/demo/laden.js
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "admin_roles" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT,
  perms       TEXT NOT NULL DEFAULT '[]',
  dept_scope  INTEGER NOT NULL DEFAULT 0,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE "admin_users" (
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
CREATE TABLE "articles" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Sonstiges',
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  crate_size  INTEGER NOT NULL DEFAULT 1 CHECK (crate_size >= 1),
  min_stock   INTEGER NOT NULL DEFAULT 0,
  track_stock INTEGER NOT NULL DEFAULT 1,
  active      INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 100
, target_stock INTEGER NOT NULL DEFAULT 0, custom INTEGER NOT NULL DEFAULT 0, icon TEXT, image TEXT, deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "audit_log" (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  username   TEXT,
  action     TEXT NOT NULL,
  detail     TEXT
);
CREATE TABLE "aw_entry" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES members(id), event_id INTEGER REFERENCES aw_event(id),
  date TEXT NOT NULL, minutes INTEGER, text TEXT, in_at TEXT, out_at TEXT,
  status TEXT NOT NULL DEFAULT 'offen',              -- laeuft | offen | bestaetigt | abgelehnt
  source TEXT NOT NULL DEFAULT 'verwaltung',         -- verwaltung | app | tablet
  by_user TEXT, reviewed_by TEXT, reviewed_at TEXT, reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE "aw_event" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'arbeit', title TEXT NOT NULL, date TEXT NOT NULL, start TEXT, end TEXT, place TEXT,
  slots INTEGER, note TEXT, cancelled INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, permanent INTEGER NOT NULL DEFAULT 0, plan_id INTEGER, counts INTEGER NOT NULL DEFAULT 1, deadline TEXT, asked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE aw_exempt (member_id INTEGER NOT NULL PRIMARY KEY REFERENCES members(id), note TEXT, until_date TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE TABLE "aw_extern" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES aw_event(id), name TEXT NOT NULL, note TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE "aw_plan" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, from_date TEXT NOT NULL, to_date TEXT NOT NULL, place TEXT, note TEXT,
  counts INTEGER NOT NULL DEFAULT 1, published INTEGER NOT NULL DEFAULT 1, sales_event_id INTEGER, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE "aw_signup" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES aw_event(id), member_id INTEGER NOT NULL REFERENCES members(id), reminded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), answer TEXT NOT NULL DEFAULT 'ja', persons INTEGER NOT NULL DEFAULT 1, note TEXT, UNIQUE(event_id, member_id)
);
CREATE TABLE aw_target (member_id INTEGER NOT NULL REFERENCES members(id), year INTEGER NOT NULL, minutes INTEGER, note TEXT, PRIMARY KEY(member_id, year));
CREATE TABLE "bank_accounts" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, holder TEXT, iban TEXT NOT NULL, bic TEXT, bank TEXT,
  departments TEXT NOT NULL DEFAULT '[]', is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE "bh_donation" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, no TEXT NOT NULL UNIQUE, year INTEGER NOT NULL, donor_type TEXT NOT NULL,  -- member | partner | einmalig
  member_id INTEGER, partner_id INTEGER, donor TEXT NOT NULL, kind TEXT NOT NULL,                     -- geld | sach | verzicht
  date TEXT NOT NULL, cents INTEGER NOT NULL, item TEXT, sach_origin TEXT, sach_docs INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aktiv', sent_at TEXT, cancel_reason TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE "bh_invoice" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, no TEXT NOT NULL UNIQUE, year INTEGER NOT NULL, kind TEXT NOT NULL,      -- partner | member
  partner_id INTEGER, member_id INTEGER, recipient TEXT NOT NULL, date TEXT NOT NULL, due_date TEXT, period TEXT, intro TEXT, note TEXT,
  items TEXT NOT NULL, net INTEGER NOT NULL, vat INTEGER NOT NULL, gross INTEGER NOT NULL, small_business INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'offen',                                                            -- offen | bezahlt | storniert
  paid_at TEXT, paid_via TEXT, sent_at TEXT, reminders INTEGER NOT NULL DEFAULT 0, reminded_at TEXT, charge_id INTEGER, yearly INTEGER,
  cancel_reason TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, department_id INTEGER, account_id INTEGER, bank TEXT);
CREATE TABLE "bh_partner" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT, street TEXT, zip TEXT, city TEXT, country TEXT, email TEXT, phone TEXT, vat_id TEXT, customer_no TEXT,
  items TEXT NOT NULL DEFAULT '[]',          -- jährliche Rechnungspositionen [{ text, qty, unit_cents, vat }]
  note TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, department_id INTEGER);
CREATE TABLE "bk_booking" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, resource_id INTEGER NOT NULL REFERENCES bk_resource(id), date TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'buchung',                 -- buchung | serie | sperre
  member_id INTEGER REFERENCES members(id), partners TEXT NOT NULL DEFAULT '[]', guests TEXT NOT NULL DEFAULT '[]',
  fee_cents INTEGER NOT NULL DEFAULT 0, charge_id INTEGER, series_id INTEGER, title TEXT, note TEXT,
  status TEXT NOT NULL DEFAULT 'aktiv',                 -- aktiv | storniert
  source TEXT NOT NULL DEFAULT 'app',                   -- app | tablet | verwaltung
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), cancelled_at TEXT, cancelled_by TEXT, cancel_reason TEXT
, booked_by_id INTEGER, label_id INTEGER, partner_device_id INTEGER, solo INTEGER NOT NULL DEFAULT 0, ext_key TEXT, reminded INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "bk_label" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#2f6fd6', sort INTEGER NOT NULL DEFAULT 100, active INTEGER NOT NULL DEFAULT 1
, use_mode TEXT NOT NULL DEFAULT 'verwaltung', use_functions TEXT NOT NULL DEFAULT '[]', use_members TEXT NOT NULL DEFAULT '[]', free_rules INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "bk_resource" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'platz', name TEXT NOT NULL, area TEXT, note TEXT,
  days TEXT NOT NULL DEFAULT '1234567', open_from TEXT NOT NULL DEFAULT '08:00', open_to TEXT NOT NULL DEFAULT '22:00',
  slot_min INTEGER NOT NULL DEFAULT 60, max_min INTEGER NOT NULL DEFAULT 120, quantity INTEGER NOT NULL DEFAULT 1, guest_fee_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 100, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, department_id INTEGER, outsiders TEXT NOT NULL DEFAULT 'gebuehr', outsider_fee_cents INTEGER NOT NULL DEFAULT 500, deleted INTEGER NOT NULL DEFAULT 0, partner_required INTEGER NOT NULL DEFAULT 0, solo_label TEXT, as_partner INTEGER NOT NULL DEFAULT 0);
CREATE TABLE bk_rights (
  member_id INTEGER NOT NULL PRIMARY KEY REFERENCES members(id), series INTEGER NOT NULL DEFAULT 0, labels TEXT NOT NULL DEFAULT '[]', note TEXT, updated_by TEXT, updated_at TEXT
, for_others INTEGER NOT NULL DEFAULT 0, all_labels INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "bk_series" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL, resources TEXT NOT NULL, weekdays TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
  from_date TEXT NOT NULL, to_date TEXT NOT NULL, member_id INTEGER, note TEXT, active INTEGER NOT NULL DEFAULT 1, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, label_id INTEGER, rule TEXT);
CREATE TABLE "bk_wait" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, resource_id INTEGER NOT NULL, date TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, member_id INTEGER NOT NULL,
  notified_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), UNIQUE(resource_id, date, start, member_id)
);
CREATE TABLE "bookings" (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id    INTEGER REFERENCES members(id),
  article_id   INTEGER NOT NULL REFERENCES articles(id),
  event_id     INTEGER REFERENCES events(id),
  kind         TEXT NOT NULL CHECK (kind IN ('konto','verein','gast','event')),
  qty          INTEGER NOT NULL CHECK (qty > 0),
  unit_cents   INTEGER NOT NULL,
  total_cents  INTEGER NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  cancelled_at TEXT,
  cancelled_by TEXT
, paid_cash INTEGER, transferred_at TEXT, transferred_by TEXT, event_guest_id INTEGER REFERENCES event_guests(id), payment_id INTEGER REFERENCES event_payments(id), note TEXT, tab_id INTEGER REFERENCES guest_tabs(id), settled_id INTEGER REFERENCES member_settlements(id), credit_for INTEGER, article_name TEXT, article_category TEXT);
CREATE TABLE "deliveries" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  supplier    TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, doc_no TEXT, doc_kind TEXT NOT NULL DEFAULT 'lieferung', file TEXT, total_cents INTEGER);
CREATE TABLE "delivery_items" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  article_id  INTEGER NOT NULL REFERENCES articles(id),
  crates      INTEGER NOT NULL DEFAULT 0,
  bottles     INTEGER NOT NULL DEFAULT 0
, supplier_art_no TEXT, supplier_text TEXT, cost_cents INTEGER);
CREATE TABLE event_articles (
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  article_id  INTEGER NOT NULL REFERENCES articles(id),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  PRIMARY KEY (event_id, article_id)
);
CREATE TABLE "event_guests" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  member_id   INTEGER REFERENCES members(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  created_by  TEXT
);
CREATE TABLE "event_payments" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id    INTEGER NOT NULL REFERENCES event_guests(id) ON DELETE CASCADE,
  method      TEXT NOT NULL CHECK (method IN ('bar','karte')),
  cents       INTEGER NOT NULL,
  at          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  by_user     TEXT
);
CREATE TABLE "events" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  date        TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 0,
  cash_cents  INTEGER,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  closed_at   TEXT
, deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "guest_tabs" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','bezahlt','uebernommen','abgeschrieben')),
  method      TEXT CHECK (method IN ('bar','karte')),
  cents       INTEGER,
  member_id   INTEGER REFERENCES members(id),
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  created_by  TEXT,
  closed_at   TEXT,
  closed_by   TEXT
);
CREATE TABLE "irr_log" (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  who    TEXT,
  action TEXT NOT NULL,               -- start | stop | fehler
  platz  TEXT,
  sec    INTEGER,
  detail TEXT
);
CREATE TABLE "irr_steps" (
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
CREATE TABLE languages (
    code TEXT PRIMARY KEY, name TEXT NOT NULL, locale TEXT, dir TEXT NOT NULL DEFAULT 'ltr', strings TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE TABLE mail_list (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, spec TEXT NOT NULL DEFAULT '{}', updated_by TEXT, updated_at TEXT);
CREATE TABLE mail_message (
  id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL DEFAULT '', html TEXT NOT NULL DEFAULT '',
  spec TEXT NOT NULL DEFAULT '{}',                 -- Empfänger: { groups:[{t,v}], members:[id], addresses:[…], lists:[id], payer:1 }
  files TEXT NOT NULL DEFAULT '[]',                -- [{ id, name, size, type }]
  status TEXT NOT NULL DEFAULT 'entwurf',          -- entwurf | sendet | gesendet | teilweise
  copy_me INTEGER NOT NULL DEFAULT 1,
  from_name TEXT, reply_to TEXT, signature_html TEXT,
  user_id INTEGER, user_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), updated_at TEXT, sent_at TEXT,
  total INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE mail_recipient (
  id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL REFERENCES mail_message(id) ON DELETE CASCADE,
  member_id INTEGER, name TEXT, email TEXT NOT NULL, via TEXT,
  status TEXT NOT NULL DEFAULT 'wartet', error TEXT, sent_at TEXT
);
CREATE TABLE mail_template (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '', html TEXT NOT NULL DEFAULT '', updated_by TEXT, updated_at TEXT);
CREATE TABLE member_access (
  member_id   INTEGER NOT NULL REFERENCES members(id),
  module      TEXT NOT NULL,
  profile     TEXT,                    -- z. B. Zeitprofil beim Zugang
  valid_until TEXT,                    -- JJJJ-MM-TT einschließlich, NULL = unbegrenzt
  blocked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')), away INTEGER NOT NULL DEFAULT 0, flags TEXT,
  PRIMARY KEY (member_id, module)
);
CREATE TABLE "member_devices" (
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
CREATE TABLE "member_settlements" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER NOT NULL REFERENCES members(id),
  cents       INTEGER NOT NULL,
  items       INTEGER NOT NULL DEFAULT 0,
  until_at    TEXT NOT NULL,
  batch       TEXT,
  note        TEXT,
  by_user     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE "members" (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'mitglied'
                CHECK (kind IN ('mitglied','mannschaft','verein','gast','extern')),
  pin_hash      TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  failed_pins   INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, pending INTEGER NOT NULL DEFAULT 0, first_name TEXT, last_name TEXT, deleted INTEGER NOT NULL DEFAULT 0, pin_strikes INTEGER NOT NULL DEFAULT 0, pin_changed_at TEXT, pin_changed_by TEXT, photo TEXT, photo_use TEXT NOT NULL DEFAULT '[]');
CREATE TABLE "mv_age_notice" (
    id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, kind TEXT NOT NULL, ref_id INTEGER NOT NULL,
    from_fee_id INTEGER, to_fee_id INTEGER, age INTEGER, due_date TEXT, status TEXT NOT NULL DEFAULT 'offen',
    decided_by TEXT, decided_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(member_id, kind, ref_id, to_fee_id));
CREATE TABLE "mv_application" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, status TEXT NOT NULL,   -- unterschrift | eingegangen | angenommen | abgelehnt
  data TEXT NOT NULL, code_hash TEXT, code_expires INTEGER,
  signed_at TEXT, signed_via TEXT, sig_member TEXT, sig_mandate TEXT, sha256 TEXT, document_id INTEGER,
  member_id INTEGER, reviewed_by TEXT, reviewed_at TEXT, reason TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, pre_by TEXT, pre_at TEXT);
CREATE TABLE mv_bank (
  member_id     INTEGER PRIMARY KEY REFERENCES members(id),
  holder        TEXT, iban TEXT, bic TEXT, bank TEXT,
  mandate_ref   TEXT UNIQUE, mandate_date TEXT, mandate_first_used TEXT, mandate_last_used TEXT, mandate_notified TEXT, mandate_revoked TEXT,
  updated_at    TEXT
);
CREATE TABLE "mv_change" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES members(id), kind TEXT NOT NULL,   -- daten | bank | kuendigung
  data TEXT NOT NULL, signature TEXT, status TEXT NOT NULL DEFAULT 'offen', reviewed_by TEXT, reviewed_at TEXT, reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, created_by TEXT);
CREATE TABLE "mv_charge" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),       -- Zahler (Schuldner)
  for_member_id INTEGER REFERENCES members(id),            -- für wen (z. B. Kind)
  kind TEXT NOT NULL,                                      -- beitrag | getraenke | arbeitsstunden | aufnahme | ruecklastschrift | mahngebuehr | sonstiges
  text TEXT NOT NULL, period_from TEXT, period_to TEXT, cents INTEGER NOT NULL, due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offen',                    -- offen | eingezogen | bezahlt | storniert
  paid_at TEXT, paid_via TEXT, collection_id INTEGER REFERENCES mv_collection(id), run_id INTEGER REFERENCES mv_run(id),
  member_fee_id INTEGER, ext_key TEXT UNIQUE, invoice_no TEXT, dunning_level INTEGER NOT NULL DEFAULT 0, dunned_at TEXT,
  returns INTEGER NOT NULL DEFAULT 0, note TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, member_dept_id INTEGER);
CREATE TABLE "mv_collection" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, collection_date TEXT NOT NULL, msg_id TEXT NOT NULL, count INTEGER, cents INTEGER, xml TEXT,
  status TEXT NOT NULL DEFAULT 'erstellt',                 -- erstellt | gebucht | verworfen
  prenotified_at TEXT, booked_at TEXT, by_user TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), note TEXT
);
CREATE TABLE "mv_department" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, federation TEXT, sort INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE "mv_document" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER REFERENCES members(id), application_id INTEGER, kind TEXT NOT NULL DEFAULT 'sonstiges',
  title TEXT NOT NULL, file TEXT NOT NULL, mime TEXT, size INTEGER, sha256 TEXT, by_user TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE "mv_fee" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, department_id INTEGER REFERENCES mv_department(id),
  cents INTEGER NOT NULL DEFAULT 0, interval TEXT NOT NULL DEFAULT 'jahr', prorate TEXT NOT NULL DEFAULT 'anteilig',
  age_min INTEGER, age_max INTEGER, family INTEGER NOT NULL DEFAULT 0,   -- family = gilt für Hauptzahler + Angehörige
  work_minutes INTEGER,                                                  -- Arbeitsstunden-Soll je Jahr (Modul Arbeitseinsatz); NULL = Vorgabe
  on_form INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, note TEXT
, kind TEXT NOT NULL DEFAULT 'grund');
CREATE TABLE "mv_function" (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES members(id), name TEXT NOT NULL, from_date TEXT, to_date TEXT);
CREATE TABLE "mv_history" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now','localtime')), by_user TEXT, field TEXT NOT NULL, old TEXT, new TEXT
);
CREATE TABLE "mv_honor" (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES members(id), name TEXT NOT NULL, date TEXT, note TEXT);
CREATE TABLE "mv_member_department" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES members(id), department_id INTEGER NOT NULL REFERENCES mv_department(id),
  entry_date TEXT, exit_date TEXT, status TEXT NOT NULL DEFAULT 'aktiv', federation_status TEXT, exit_reason TEXT
, booked_until TEXT, fee_id INTEGER, fee_free INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "mv_member_fee" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES members(id), fee_id INTEGER NOT NULL REFERENCES mv_fee(id),
  start_date TEXT NOT NULL, end_date TEXT, booked_until TEXT, cents INTEGER, note TEXT
);
CREATE TABLE mv_person (
  member_id     INTEGER PRIMARY KEY REFERENCES members(id),
  member_no     TEXT UNIQUE,
  salutation    TEXT, title TEXT, first_name TEXT, last_name TEXT,
  birth_date    TEXT, gender TEXT,
  street        TEXT, zip TEXT, city TEXT, country TEXT, address_extra TEXT,
  phone         TEXT, mobile TEXT, email TEXT, letter_salutation TEXT,
  status        TEXT NOT NULL DEFAULT 'aktiv',          -- aktiv | passiv | ehren | ruhend (ausgetreten ergibt sich aus exit_date)
  entry_date    TEXT, exit_date TEXT, exit_reason TEXT, notice_date TEXT,
  payer_id      INTEGER REFERENCES members(id),          -- zahlt für diese Person (Familie / abweichender Zahler); NULL = selbst
  drinks_to_payer INTEGER NOT NULL DEFAULT 1,
  payment       TEXT NOT NULL DEFAULT 'lastschrift',     -- lastschrift | rechnung | bar
  key_no        TEXT, notes TEXT,
  consents      TEXT NOT NULL DEFAULT '{}',              -- {"homepage": "2026-10-17", …} Datum der Einwilligung
  extra         TEXT NOT NULL DEFAULT '{}',
  anonymized_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT
, sales_mode TEXT NOT NULL DEFAULT 'payer', family_of INTEGER);
CREATE TABLE "mv_run" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'beitrag', until_date TEXT, filters TEXT, count INTEGER, cents INTEGER,
  drinks_batch TEXT, by_user TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), note TEXT
);
CREATE TABLE "push_log" (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  member_id INTEGER,
  event     TEXT NOT NULL,
  title     TEXT,
  ok        INTEGER NOT NULL,
  info      TEXT
);
CREATE TABLE "push_subs" (
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
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE "settlements" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  until_date  TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE sp_avail (
  game_id INTEGER NOT NULL REFERENCES sp_game(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id),
  state TEXT NOT NULL,                                          -- ja | nein
  from_t TEXT, until_t TEXT, note TEXT, at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY (game_id, member_id)
);
CREATE TABLE sp_extern (
  member_id INTEGER NOT NULL PRIMARY KEY REFERENCES members(id), phone TEXT, club TEXT, token TEXT NOT NULL UNIQUE,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), last_seen TEXT
, token_at TEXT);
CREATE TABLE sp_game (
  id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER NOT NULL REFERENCES sp_team(id) ON DELETE CASCADE,
  date TEXT NOT NULL, start TEXT, home INTEGER NOT NULL DEFAULT 1, opponent TEXT NOT NULL, venue TEXT, league TEXT,
  ext_key TEXT, status TEXT NOT NULL DEFAULT 'geplant',        -- geplant | abgesagt
  meet_time TEXT, meet_place TEXT, note TEXT, result TEXT,
  rem_players INTEGER NOT NULL DEFAULT 0, rem_captain INTEGER NOT NULL DEFAULT 0, lineup_sent_at TEXT,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, kind TEXT NOT NULL DEFAULT 'spiel', za INTEGER NOT NULL DEFAULT 0, released INTEGER NOT NULL DEFAULT 1);
CREATE TABLE sp_lineup (
  game_id INTEGER NOT NULL REFERENCES sp_game(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id),
  role TEXT NOT NULL DEFAULT 'spielt',                          -- spielt | ersatz
  pos INTEGER, withdraw INTEGER NOT NULL DEFAULT 0, withdraw_note TEXT, withdraw_at TEXT,
  by_user TEXT, at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY (game_id, member_id)
);
CREATE TABLE sp_player (
  team_id INTEGER NOT NULL REFERENCES sp_team(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id),
  rank INTEGER NOT NULL DEFAULT 99, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY (team_id, member_id)
);
CREATE TABLE sp_task (
  id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER NOT NULL REFERENCES sp_game(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, label TEXT NOT NULL, member_id INTEGER REFERENCES members(id), note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE sp_team (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, league TEXT, season TEXT, min_players INTEGER NOT NULL DEFAULT 4,
  captain_id INTEGER REFERENCES members(id), vice_id INTEGER REFERENCES members(id), import_key TEXT,
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
, age_class TEXT);
CREATE TABLE "staff" (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  job        TEXT,
  pin_hash   TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE staff_rates (
  staff_id   INTEGER NOT NULL REFERENCES staff(id),
  from_month TEXT NOT NULL,              -- JJJJ-MM: gilt ab diesem Monat
  cents      INTEGER,                    -- NULL = kein Stundensatz
  PRIMARY KEY (staff_id, from_month)
);
CREATE TABLE "stock_moves" (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  INTEGER NOT NULL REFERENCES articles(id),
  qty         INTEGER NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('bruch','inventur','korrektur')),
  date        TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE supplier_map (
  supplier    TEXT NOT NULL,
  art_no      TEXT NOT NULL,
  article_id  INTEGER REFERENCES articles(id),
  pack_size   INTEGER NOT NULL DEFAULT 1,
  text        TEXT,
  PRIMARY KEY (supplier, art_no)
);
CREATE TABLE "time_entries" (
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
CREATE TABLE vault_mail (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  data       TEXT NOT NULL,            -- verschlüsselte Mail (p1/e1), wartet auf das Entsperren
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  tries      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE vault_wrap (
  user_id    INTEGER PRIMARY KEY,      -- admin_users.id; 0 = Wiederherstellungscode
  salt       TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE "zugang_log" (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL,
  who    TEXT,
  door   TEXT,
  action TEXT NOT NULL,               -- auf | zu | oeffnen | abgelehnt | fehler | freischaltung | alarm | sperre
  detail TEXT
);
CREATE TRIGGER bookings_snapshot AFTER INSERT ON bookings WHEN NEW.article_name IS NULL BEGIN
  UPDATE bookings SET article_name = (SELECT name FROM articles WHERE id = NEW.article_id),
    article_category = (SELECT category FROM articles WHERE id = NEW.article_id) WHERE id = NEW.id;
END;
CREATE INDEX ix_audit_at ON audit_log(at);
CREATE INDEX ix_awe_member ON aw_entry(member_id, date);
CREATE INDEX ix_bh_inv ON bh_invoice(status, due_date);
CREATE INDEX ix_bk_booking_ext ON bk_booking(ext_key);
CREATE INDEX ix_bk_day ON bk_booking(date, resource_id, status);
CREATE INDEX ix_bookings_article ON bookings(article_id) WHERE cancelled_at IS NULL;
CREATE INDEX ix_bookings_created ON bookings(created_at);
CREATE INDEX ix_bookings_credit ON bookings(credit_for);
CREATE INDEX ix_bookings_event ON bookings(event_id);
CREATE INDEX ix_bookings_guest ON bookings(event_guest_id);
CREATE INDEX ix_bookings_member  ON bookings(member_id);
CREATE INDEX ix_bookings_open ON bookings(member_id) WHERE settled_id IS NULL;
CREATE INDEX ix_bookings_payment ON bookings(payment_id);
CREATE INDEX ix_bookings_tab ON bookings(tab_id);
CREATE INDEX ix_delivery_items_article ON delivery_items(article_id);
CREATE INDEX ix_devices_scope ON member_devices(scope, member_id);
CREATE INDEX ix_devices_token ON member_devices(scope, token_hash);
CREATE INDEX ix_devices_token2 ON member_devices(scope, token2_hash);
CREATE INDEX ix_guests_event ON event_guests(event_id);
CREATE INDEX ix_guests_member ON event_guests(member_id);
CREATE INDEX ix_irr_log_at ON irr_log(at);
CREATE INDEX ix_irr_steps_state ON irr_steps(state, start_at);
CREATE INDEX ix_mailrcpt_msg ON mail_recipient(message_id);
CREATE INDEX ix_msettle_member ON member_settlements(member_id);
CREATE INDEX ix_mvc_coll ON mv_charge(collection_id);
CREATE INDEX ix_mvc_member ON mv_charge(member_id, status);
CREATE INDEX ix_mvh_member ON mv_history(member_id);
CREATE INDEX ix_mvmd_member ON mv_member_department(member_id);
CREATE INDEX ix_mvmf_member ON mv_member_fee(member_id);
CREATE INDEX ix_push_member ON push_subs(member_id);
CREATE INDEX ix_sp_game_key ON sp_game(ext_key);
CREATE INDEX ix_sp_game_team ON sp_game(team_id, date);
CREATE INDEX ix_sp_task_game ON sp_task(game_id);
CREATE INDEX ix_stock_moves_article ON stock_moves(article_id);
CREATE INDEX ix_tabs_status ON guest_tabs(status);
CREATE INDEX ix_time_staff ON time_entries(staff_id, start_at);
CREATE INDEX ix_zugang_log_at ON zugang_log(at);
CREATE UNIQUE INDEX ux_deliveries_doc ON deliveries(supplier, doc_no) WHERE doc_no IS NOT NULL;
INSERT INTO "settings" VALUES('mig_event_guests','1');
INSERT INTO "settings" VALUES('roles_seeded','1');
INSERT INTO "settings" VALUES('mig_member_settle','1');
INSERT INTO "settings" VALUES('art_icons_v1','1');
INSERT INTO "settings" VALUES('pin_sync_324','1');
INSERT INTO "settings" VALUES('update_running_version','3.30.5');
INSERT INTO "settings" VALUES('ext_arbeitseinsatz_seed_theke','1');
INSERT INTO "settings" VALUES('ext_arbeitseinsatz_start_year','2026');
INSERT INTO "settings" VALUES('ext_buchung_labels_seeded','1');
INSERT INTO "settings" VALUES('ext_buchung_seeded','1');
INSERT INTO "settings" VALUES('ext_buchung_ics_key','2739027314bfe484661a1f7aeb26a80937c6f04831fe3120');
INSERT INTO "settings" VALUES('ext_mitglieder_family_of_migrated','1');
INSERT INTO "settings" VALUES('ext_spielbetrieb_ics_key','245cdc0f1342d111142539ee7e3b55793e5f6fa142ef9935');
INSERT INTO "settings" VALUES('mail_perm_migrated','1');
INSERT INTO "settings" VALUES('club_name','TC Grün-Weiß Musterstadt');
INSERT INTO "settings" VALUES('ext_beregnung_active','1');
INSERT INTO "settings" VALUES('ext_buchhaltung_active','1');
INSERT INTO "settings" VALUES('ext_buchung_active','1');
INSERT INTO "settings" VALUES('ext_arbeitseinsatz_active','1');
INSERT INTO "settings" VALUES('ext_mitglieder_active','1');
INSERT INTO "settings" VALUES('ext_spielbetrieb_active','1');
INSERT INTO "settings" VALUES('ext_getraenke_active','1');
INSERT INTO "settings" VALUES('ext_zeiterfassung_active','1');
INSERT INTO "settings" VALUES('ext_zugang_active','1');
INSERT INTO "settings" VALUES('tablet_pw_hash','3fe3a76d426fe51b69bb9a6b8937c2ed:dd290266288a1608062507df24ca66581e8e66c979c0c5627c44baa1550be1f8');
INSERT INTO "settings" VALUES('tablet_pw_at','2026-10-21 17:26:50');
INSERT INTO "settings" VALUES('tablet_pw_ver','225fbcf5849c');
INSERT INTO "settings" VALUES('app_url','http://127.0.0.1:5803');
INSERT INTO "settings" VALUES('tablet_gate_secret','d302e305702715a4b8a0ec7da1f814f873cfae8e907772615c20f0dff9ed1e9d');
INSERT INTO "settings" VALUES('app_start','buchung');
INSERT INTO "settings" VALUES('app_module_order','["spielbetrieb","buchung","mitglieder","arbeitseinsatz","zugang","beregnung"]');
INSERT INTO "settings" VALUES('ext_zugang_cfg','{"vendor":"other","doors":[{"id":"c145a1d4","name":"Clubhaus","type":"lock","ref":"lock.clubhaus","sensor":"","pulseSec":3}],"profiles":[{"id":"mitglied","name":"Mitglied","doors":"all","windows":{"0":[["07:00","23:00"]],"1":[["07:00","23:00"]],"2":[["07:00","23:00"]],"3":[["07:00","23:00"]],"4":[["07:00","23:00"]],"5":[["07:00","23:00"]],"6":[["07:00","23:00"]]},"isDefault":true},{"id":"immer","name":"Rund um die Uhr","doors":"all","windows":{"0":[["00:00","24:00"]],"1":[["00:00","24:00"]],"2":[["00:00","24:00"]],"3":[["00:00","24:00"]],"4":[["00:00","24:00"]],"5":[["00:00","24:00"]],"6":[["00:00","24:00"]]},"isDefault":false}],"wlanOnly":true,"header":true,"appName":"Zugang","subtitle":"Türen öffnen","notify":"","openAlertMin":0,"blockAll":false,"blockDays":[]}');
INSERT INTO "settings" VALUES('ext_zugang_used_ids','["mitglied","immer","c145a1d4"]');
INSERT INTO "settings" VALUES('ext_beregnung_cfg','{"backend":"ha","vendor":"other","mode":"pin","stopFree":false,"cooldownMin":0,"header":true,"appName":"Beregnung","webappUrl":"","subtitle":"Bewässerungssteuerung","nextEntity":"","notify":"","plaetze":[{"name":"Platz 1","sub":"Sand","zones":[{"ref":"switch.platz1","label":"","sec":600}]},{"name":"Platz 2","sub":"Sand","zones":[{"ref":"switch.platz2","label":"","sec":600}]},{"name":"Platz 3","sub":"Sand","zones":[{"ref":"switch.platz3","label":"","sec":600}]}]}');
INSERT INTO "settings" VALUES('app_preselect','{"beregnung":false}');
INSERT INTO "settings" VALUES('club_logo','PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMTIwIj48c3R5bGU+Lmd7ZmlsbDojMDA4NDNkfTwvc3R5bGU+CjxjaXJjbGUgY3g9IjYwIiBjeT0iNjAiIHI9IjUwIiBjbGFzcz0iZyIvPjxjaXJjbGUgY3g9IjYwIiBjeT0iNjAiIHI9IjMwIiBmaWxsPSIjZmZmZmZmIi8+CjxyZWN0IHg9IjEyMCIgeT0iMjAiIHdpZHRoPSI3MCIgaGVpZ2h0PSI4MCIgZmlsbD0iIzAwODQzZCIvPjxhPjx0ZXh0IHg9IjEyNSIgeT0iNzAiIGZpbGw9IiNmZmYiPlRDPC90ZXh0PjwvYT48L3N2Zz4=');
INSERT INTO "settings" VALUES('club_logo_type','svg');
INSERT INTO "settings" VALUES('club_logo_ver','1792607925689');
INSERT INTO "settings" VALUES('club_icon','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');
INSERT INTO "settings" VALUES('club_icon_ver','1792607925689:#1f6b3a:2');
INSERT INTO "settings" VALUES('club_logo_png','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');
INSERT INTO "settings" VALUES('club_logo_png_ver','1792607925689');
INSERT INTO "members" VALUES(1,'Verein (kostenfrei)','verein',NULL,1,0,NULL,'2026-10-21 17:26:44',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members" VALUES(2,'Gast (bar)','gast',NULL,1,0,NULL,'2026-10-21 17:26:44',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members" VALUES(3,'Felix Adler','mitglied','f6e82245b285d9752bf83ba6691cb239:65ed90b7a3d0a8bd5c55ce09a05ae3b585f6fdf5d64e0d41d4156fa476ca3482',1,0,NULL,'2026-10-21 17:26:50',0,NULL,NULL,0,0,'2026-10-21 17:36:07','Mitglieder-App',NULL,'[]');
INSERT INTO "members" VALUES(4,'Anna Becker','mitglied','8416332b7f8701930b73f819e6aaa766:c16718f3ed5352d574c19e8fa91118b2733408f098a64c7656bbc850ee20d186',1,0,NULL,'2026-10-21 17:26:50',0,NULL,NULL,0,0,'2026-10-21 19:14:10','Mitglieder-App',NULL,'[]');
INSERT INTO "members" VALUES(5,'Jonas Schmitt','mitglied',NULL,1,0,NULL,'2026-10-21 17:26:50',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members" VALUES(6,'Lea Wagner','mitglied',NULL,1,0,NULL,'2026-10-21 17:26:50',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members" VALUES(7,'Peter Hofmann','mitglied',NULL,1,0,NULL,'2026-10-21 17:26:50',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members" VALUES(8,'Sabine Klein','mitglied',NULL,1,0,NULL,'2026-10-21 17:26:50',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members" VALUES(9,'Markus Weber','mitglied',NULL,1,0,NULL,'2026-10-21 17:26:50',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members" VALUES(10,'Julia Fischer','mitglied',NULL,1,0,NULL,'2026-10-21 17:26:50',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members" VALUES(11,'Tobias Neumann','mitglied',NULL,1,0,NULL,'2026-10-21 17:26:50',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members" VALUES(12,'Laura Schulz','mitglied',NULL,1,0,NULL,'2026-10-21 17:26:50',0,NULL,NULL,0,0,NULL,NULL,NULL,'[]');
INSERT INTO "members" VALUES(13,'Max Gast','extern',NULL,1,0,NULL,'2026-10-21 17:26:50',0,'Max','Gast',0,0,NULL,NULL,NULL,'[]');
INSERT INTO "articles" VALUES(1,'Freier Betrag','Sonstiges',0,1,0,0,1,9999,0,1,NULL,NULL,0);
INSERT INTO "articles" VALUES(2,'Bier 0,33','Bier',150,24,0,1,1,10,0,0,'flasche',NULL,0);
INSERT INTO "articles" VALUES(3,'Pils 0,33','Bier',150,24,0,1,1,11,0,0,'pils',NULL,0);
INSERT INTO "articles" VALUES(4,'Radler 0,33','Bier',150,24,0,1,1,12,0,0,'radler',NULL,0);
INSERT INTO "articles" VALUES(5,'Bier alkoholfrei 0,33','Bier',150,24,0,1,1,13,0,0,'alkoholfrei',NULL,0);
INSERT INTO "articles" VALUES(6,'Weizen 0,5','Weizen',200,20,0,1,1,20,0,0,'weizen',NULL,0);
INSERT INTO "articles" VALUES(7,'Weizen alkoholfrei 0,5','Weizen',200,20,0,1,1,21,0,0,'alkoholfrei',NULL,0);
INSERT INTO "articles" VALUES(8,'Cola 0,33','Softdrinks',150,24,0,1,1,30,0,0,'limo',NULL,0);
INSERT INTO "articles" VALUES(9,'Cola Zero 0,33','Softdrinks',150,24,0,1,1,31,0,0,'limo',NULL,0);
INSERT INTO "articles" VALUES(10,'Limonade 0,33','Softdrinks',150,24,0,1,1,32,0,0,'limo',NULL,0);
INSERT INTO "articles" VALUES(11,'Apfelschorle 0,5','Softdrinks',150,20,0,1,1,33,0,0,'schorle',NULL,0);
INSERT INTO "articles" VALUES(12,'Wasser 0,7','Wasser',100,12,0,1,1,40,0,0,'wasser',NULL,0);
INSERT INTO "articles" VALUES(13,'Kaffee','Kaffee',100,1,0,0,1,50,0,0,'kaffee',NULL,0);
INSERT INTO "articles" VALUES(14,'Süßes','Snacks',100,1,0,1,1,60,0,0,'bonbon',NULL,0);
INSERT INTO "articles" VALUES(15,'Chips','Snacks',150,1,0,1,1,61,0,0,'chips',NULL,0);
INSERT INTO "bookings" VALUES(1,3,2,NULL,'konto',1,150,150,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Bier 0,33','Bier');
INSERT INTO "bookings" VALUES(2,4,5,NULL,'konto',2,150,300,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Bier alkoholfrei 0,33','Bier');
INSERT INTO "bookings" VALUES(3,5,3,NULL,'konto',3,150,450,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Pils 0,33','Bier');
INSERT INTO "bookings" VALUES(4,6,4,NULL,'konto',1,150,150,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Radler 0,33','Bier');
INSERT INTO "bookings" VALUES(5,7,13,NULL,'konto',2,100,200,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Kaffee','Kaffee');
INSERT INTO "bookings" VALUES(6,8,15,NULL,'konto',3,150,450,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Chips','Snacks');
INSERT INTO "bookings" VALUES(7,9,14,NULL,'konto',1,100,100,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Süßes','Snacks');
INSERT INTO "bookings" VALUES(8,10,11,NULL,'konto',2,150,300,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Apfelschorle 0,5','Softdrinks');
INSERT INTO "bookings" VALUES(9,11,8,NULL,'konto',3,150,450,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Cola 0,33','Softdrinks');
INSERT INTO "bookings" VALUES(10,12,9,NULL,'konto',1,150,150,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Cola Zero 0,33','Softdrinks');
INSERT INTO "bookings" VALUES(11,3,10,NULL,'konto',2,150,300,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Limonade 0,33','Softdrinks');
INSERT INTO "bookings" VALUES(12,4,12,NULL,'konto',3,100,300,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Wasser 0,7','Wasser');
INSERT INTO "bookings" VALUES(13,5,6,NULL,'konto',1,200,200,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Weizen 0,5','Weizen');
INSERT INTO "bookings" VALUES(14,6,7,NULL,'konto',2,200,400,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Weizen alkoholfrei 0,5','Weizen');
INSERT INTO "bookings" VALUES(15,7,2,NULL,'konto',3,150,450,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Bier 0,33','Bier');
INSERT INTO "bookings" VALUES(16,8,5,NULL,'konto',1,150,150,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Bier alkoholfrei 0,33','Bier');
INSERT INTO "bookings" VALUES(17,9,3,NULL,'konto',2,150,300,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Pils 0,33','Bier');
INSERT INTO "bookings" VALUES(18,10,4,NULL,'konto',3,150,450,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Radler 0,33','Bier');
INSERT INTO "bookings" VALUES(19,11,13,NULL,'konto',1,100,100,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Kaffee','Kaffee');
INSERT INTO "bookings" VALUES(20,12,15,NULL,'konto',2,150,300,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Chips','Snacks');
INSERT INTO "bookings" VALUES(21,3,14,NULL,'konto',3,100,300,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Süßes','Snacks');
INSERT INTO "bookings" VALUES(22,4,11,NULL,'konto',1,150,150,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Apfelschorle 0,5','Softdrinks');
INSERT INTO "bookings" VALUES(23,5,8,NULL,'konto',2,150,300,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Cola 0,33','Softdrinks');
INSERT INTO "bookings" VALUES(24,6,9,NULL,'konto',3,150,450,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Cola Zero 0,33','Softdrinks');
INSERT INTO "bookings" VALUES(25,7,10,NULL,'konto',1,150,150,'2026-10-21 12:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Limonade 0,33','Softdrinks');
INSERT INTO "admin_users" VALUES(1,'admin','Adminkonto','761a7324f3ec5b86700ce1c928b2eaee:d61cfe0884cf2fec5c979c91be90f88b8106985dcdf05b90785b2cb641c49b49','oberadmin','[]',1,'2026-10-21 23:25:05','2026-10-21 17:26:50',1,'[]','[]',NULL);
INSERT INTO "audit_log" VALUES(1,'2026-10-21 17:26:50','admin','Adminkonto eingerichtet',NULL);
INSERT INTO "audit_log" VALUES(2,'2026-10-21 17:26:50','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(3,'2026-10-21 17:26:50','admin','Konto angelegt','Felix Adler (mitglied)');
INSERT INTO "audit_log" VALUES(4,'2026-10-21 17:26:50','admin','Konto angelegt','Anna Becker (mitglied)');
INSERT INTO "audit_log" VALUES(5,'2026-10-21 17:26:50','admin','Konto angelegt','Jonas Schmitt (mitglied)');
INSERT INTO "audit_log" VALUES(6,'2026-10-21 17:26:50','admin','Konto angelegt','Lea Wagner (mitglied)');
INSERT INTO "audit_log" VALUES(7,'2026-10-21 17:26:50','admin','Konto angelegt','Peter Hofmann (mitglied)');
INSERT INTO "audit_log" VALUES(8,'2026-10-21 17:26:50','admin','Konto angelegt','Sabine Klein (mitglied)');
INSERT INTO "audit_log" VALUES(9,'2026-10-21 17:26:50','admin','Konto angelegt','Markus Weber (mitglied)');
INSERT INTO "audit_log" VALUES(10,'2026-10-21 17:26:50','admin','Konto angelegt','Julia Fischer (mitglied)');
INSERT INTO "audit_log" VALUES(11,'2026-10-21 17:26:50','admin','Konto angelegt','Tobias Neumann (mitglied)');
INSERT INTO "audit_log" VALUES(12,'2026-10-21 17:26:50','admin','Konto angelegt','Laura Schulz (mitglied)');
INSERT INTO "audit_log" VALUES(13,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Felix Adler: 1 × Bier 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(14,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Anna Becker: 2 × Bier alkoholfrei 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(15,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Jonas Schmitt: 3 × Pils 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(16,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Lea Wagner: 1 × Radler 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(17,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Peter Hofmann: 2 × Kaffee am 2026-10-21');
INSERT INTO "audit_log" VALUES(18,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Sabine Klein: 3 × Chips am 2026-10-21');
INSERT INTO "audit_log" VALUES(19,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Markus Weber: 1 × Süßes am 2026-10-21');
INSERT INTO "audit_log" VALUES(20,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Julia Fischer: 2 × Apfelschorle 0,5 am 2026-10-21');
INSERT INTO "audit_log" VALUES(21,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Tobias Neumann: 3 × Cola 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(22,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Laura Schulz: 1 × Cola Zero 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(23,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Felix Adler: 2 × Limonade 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(24,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Anna Becker: 3 × Wasser 0,7 am 2026-10-21');
INSERT INTO "audit_log" VALUES(25,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Jonas Schmitt: 1 × Weizen 0,5 am 2026-10-21');
INSERT INTO "audit_log" VALUES(26,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Lea Wagner: 2 × Weizen alkoholfrei 0,5 am 2026-10-21');
INSERT INTO "audit_log" VALUES(27,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Peter Hofmann: 3 × Bier 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(28,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Sabine Klein: 1 × Bier alkoholfrei 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(29,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Markus Weber: 2 × Pils 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(30,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Julia Fischer: 3 × Radler 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(31,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Tobias Neumann: 1 × Kaffee am 2026-10-21');
INSERT INTO "audit_log" VALUES(32,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Laura Schulz: 2 × Chips am 2026-10-21');
INSERT INTO "audit_log" VALUES(33,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Felix Adler: 3 × Süßes am 2026-10-21');
INSERT INTO "audit_log" VALUES(34,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Anna Becker: 1 × Apfelschorle 0,5 am 2026-10-21');
INSERT INTO "audit_log" VALUES(35,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Jonas Schmitt: 2 × Cola 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(36,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Lea Wagner: 3 × Cola Zero 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(37,'2026-10-21 17:26:50','admin','Buchung nachgetragen','Peter Hofmann: 1 × Limonade 0,33 am 2026-10-21');
INSERT INTO "audit_log" VALUES(38,'2026-10-21 17:26:50','admin','Spielbetrieb: Mannschaft angelegt','Herren 30');
INSERT INTO "audit_log" VALUES(39,'2026-10-21 17:26:50','admin','Spielbetrieb: Spieler zugeordnet','Herren 30: 6 Spieler');
INSERT INTO "audit_log" VALUES(40,'2026-10-21 17:26:50','admin','Spielbetrieb: Spieltag angelegt','Herren 30 28.10.2026 TC Nachbarort 1');
INSERT INTO "audit_log" VALUES(41,'2026-10-21 17:26:50','admin','Spielbetrieb: Spieltag angelegt','Herren 30 04.11.2026 TC Nachbarort 2');
INSERT INTO "audit_log" VALUES(42,'2026-10-21 17:26:50','admin','Spielbetrieb: Spieltag angelegt','Herren 30 11.11.2026 TC Nachbarort 3');
INSERT INTO "audit_log" VALUES(43,'2026-10-21 17:26:50','admin','Spielbetrieb: Gastspieler/in angelegt','Max Gast → Herren 30');
INSERT INTO "audit_log" VALUES(44,'2026-10-21 17:27:09','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(45,'2026-10-21 17:27:18','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(46,'2026-10-21 17:27:38','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(47,'2026-10-21 17:32:20','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(48,'2026-10-21 17:34:41','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(49,'2026-10-21 17:34:47','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(50,'2026-10-21 17:35:22','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(51,'2026-10-21 17:36:03','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(52,'2026-10-21 17:36:05','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(53,'2026-10-21 17:36:05','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(54,'2026-10-21 17:36:05','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(55,'2026-10-21 17:36:05','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(56,'2026-10-21 17:36:05','admin','Beregnung: freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(57,'2026-10-21 17:36:05','admin','Zugang: freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(58,'2026-10-21 17:36:05','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(59,'2026-10-21 17:36:07',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(60,'2026-10-21 17:36:38',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(61,'2026-10-21 17:36:48',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(62,'2026-10-21 17:36:58','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(63,'2026-10-21 17:37:06','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(64,'2026-10-21 17:37:06','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(65,'2026-10-21 17:37:06','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(66,'2026-10-21 17:37:06','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(67,'2026-10-21 17:37:06','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(68,'2026-10-21 17:37:06','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(69,'2026-10-21 17:37:06','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(70,'2026-10-21 17:38:40','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(71,'2026-10-21 17:38:44','admin','Mitglieder-App: Startseite','Buchen');
INSERT INTO "audit_log" VALUES(72,'2026-10-21 17:38:44','admin','Mitglieder-App: Reihenfolge der Bereiche geändert','Spieltage, Buchen, Meine Daten, Dienste, Türen, Beregnung');
INSERT INTO "audit_log" VALUES(73,'2026-10-21 18:02:20','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(74,'2026-10-21 18:02:20','admin','Buchungssystem: angelegt','Platz 3');
INSERT INTO "audit_log" VALUES(75,'2026-10-21 18:02:20','admin','Buchungssystem: angelegt','Padel');
INSERT INTO "audit_log" VALUES(76,'2026-10-21 18:02:20','admin','Platz gebucht (Verwaltung)','Platz 1 21.10.2026 19:00–20:00 Felix Adler');
INSERT INTO "audit_log" VALUES(77,'2026-10-21 18:02:20','admin','Platz gebucht (Verwaltung)','Platz 2 21.10.2026 20:00–22:00 Medenspiel');
INSERT INTO "audit_log" VALUES(78,'2026-10-21 18:02:20','admin','Platz gebucht (Verwaltung)','Platz 3 21.10.2026 18:00–19:00 Sabine Klein');
INSERT INTO "audit_log" VALUES(79,'2026-10-21 18:03:02','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(80,'2026-10-21 18:03:27',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(81,'2026-10-21 18:12:49','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(82,'2026-10-21 18:12:49','admin','Zeiterfassung: Person angelegt','Maria Putz (Reinigung)');
INSERT INTO "audit_log" VALUES(83,'2026-10-21 18:12:49','admin','Zeiterfassung: Person angelegt','Karl Platzwart (Platzwart)');
INSERT INTO "audit_log" VALUES(84,'2026-10-21 18:12:49','admin','Arbeitseinsatz angelegt','Plätze herrichten 21.10.2026');
INSERT INTO "audit_log" VALUES(85,'2026-10-21 18:12:49','admin','Zugang eingerichtet','1 Türen, 2 Zeitprofile');
INSERT INTO "audit_log" VALUES(86,'2026-10-21 18:12:49',NULL,'Sicherheitswarnung','Im Modul Zugang wurden die Türen geändert (von Adminkonto).

Vorher: –
Jetzt: Clubhaus=lock.clubhaus

War das so geplant? Sonst bitte in der Verwaltung prüfen.');
INSERT INTO "audit_log" VALUES(87,'2026-10-21 18:12:51',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(88,'2026-10-21 18:13:01',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(89,'2026-10-21 18:16:43','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(90,'2026-10-21 18:16:45',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(91,'2026-10-21 18:17:15','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(92,'2026-10-21 18:17:17',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(93,'2026-10-21 18:17:45','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(94,'2026-10-21 18:17:45','admin','Beregnung eingerichtet','3 Plätze, Anderer Hersteller (alle Ventile/Schalter aus Home Assistant), Schutz: Vereins-PIN');
INSERT INTO "audit_log" VALUES(95,'2026-10-21 18:17:47',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(96,'2026-10-21 18:18:40',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(97,'2026-10-21 19:04:26',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(98,'2026-10-21 19:13:59','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(99,'2026-10-21 19:14:08','admin','Beregnung: freigeschaltet','Anna Becker');
INSERT INTO "audit_log" VALUES(100,'2026-10-21 19:14:08','admin','Zugang: freigeschaltet','Anna Becker');
INSERT INTO "audit_log" VALUES(101,'2026-10-21 19:14:08','admin','Mitglieder-App: QR-Einladung erzeugt','Anna Becker');
INSERT INTO "audit_log" VALUES(102,'2026-10-21 19:14:10',NULL,'Mitglieder-App: Handy freigeschaltet','Anna Becker');
INSERT INTO "audit_log" VALUES(103,'2026-10-21 19:14:44','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(104,'2026-10-21 19:14:50','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(105,'2026-10-21 19:14:52',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(106,'2026-10-21 19:17:33','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(107,'2026-10-21 19:17:33','admin','Mitglieder-App: Vorauswahl beim Freischalten','Beregnung: ja');
INSERT INTO "audit_log" VALUES(108,'2026-10-21 19:17:33','admin','Mitglieder-App: Vorauswahl beim Freischalten','Beregnung: nein');
INSERT INTO "audit_log" VALUES(109,'2026-10-21 19:17:33','admin','Mitglieder-App: Bereich allen entzogen','Beregnung: 2 Mitglieder');
INSERT INTO "audit_log" VALUES(110,'2026-10-21 19:17:39','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(111,'2026-10-21 19:17:47','admin','Beregnung: freigeschaltet','Anna Becker');
INSERT INTO "audit_log" VALUES(112,'2026-10-21 19:17:47','admin','Zugang: Freischaltung geändert','Anna Becker');
INSERT INTO "audit_log" VALUES(113,'2026-10-21 19:17:47','admin','Mitglieder-App: QR-Einladung erzeugt','Anna Becker');
INSERT INTO "audit_log" VALUES(114,'2026-10-21 19:17:49',NULL,'Mitglieder-App: Handy freigeschaltet','Anna Becker');
INSERT INTO "audit_log" VALUES(115,'2026-10-21 19:32:39','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(116,'2026-10-21 19:33:19','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(117,'2026-10-21 19:34:05','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(118,'2026-10-21 19:34:10',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(119,'2026-10-21 19:34:19','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(120,'2026-10-21 19:34:21',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(121,'2026-10-21 19:44:08','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(122,'2026-10-21 19:44:08','admin','Buchungssystem: Sonderrechte','Felix Adler: für andere buchen, alle Buchungsarten');
INSERT INTO "audit_log" VALUES(123,'2026-10-21 19:44:49','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(124,'2026-10-21 19:44:50','admin','Buchungssystem: Sonderrechte','Felix Adler: für andere buchen, alle Buchungsarten');
INSERT INTO "audit_log" VALUES(125,'2026-10-21 19:45:28','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(126,'2026-10-21 19:45:28','admin','Buchungssystem: Sonderrechte','Felix Adler: für andere buchen, alle Buchungsarten');
INSERT INTO "audit_log" VALUES(127,'2026-10-21 20:01:51',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(128,'2026-10-21 20:02:34',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(129,'2026-10-21 20:04:00',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(130,'2026-10-21 20:05:07',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(131,'2026-10-21 20:06:18',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(132,'2026-10-21 20:08:03',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(133,'2026-10-21 20:09:14',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(134,'2026-10-21 20:10:52','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(135,'2026-10-21 20:12:25','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(136,'2026-10-21 20:16:04','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(137,'2026-10-21 20:21:52',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(138,'2026-10-21 20:22:34',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(139,'2026-10-21 20:23:18','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(140,'2026-10-21 20:23:18','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(141,'2026-10-21 20:23:18','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(142,'2026-10-21 20:23:18','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(143,'2026-10-21 20:23:18','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(144,'2026-10-21 20:23:18','admin','Beregnung: freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(145,'2026-10-21 20:23:18','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(146,'2026-10-21 20:23:18','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(147,'2026-10-21 20:24:03','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(148,'2026-10-21 20:24:03','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(149,'2026-10-21 20:24:03','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(150,'2026-10-21 20:24:03','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(151,'2026-10-21 20:24:03','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(152,'2026-10-21 20:24:03','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(153,'2026-10-21 20:24:03','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(154,'2026-10-21 20:24:03','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(155,'2026-10-21 20:24:05',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(156,'2026-10-21 20:30:50','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(157,'2026-10-21 20:31:33','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(158,'2026-10-21 20:32:30',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(159,'2026-10-21 20:32:36',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(160,'2026-10-21 20:35:05','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(161,'2026-10-21 20:35:05','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(162,'2026-10-21 20:35:05','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(163,'2026-10-21 20:35:05','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(164,'2026-10-21 20:35:05','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(165,'2026-10-21 20:35:05','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(166,'2026-10-21 20:35:05','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(167,'2026-10-21 20:35:05','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(168,'2026-10-21 20:35:07',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(169,'2026-10-21 20:35:49','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(170,'2026-10-21 20:36:47',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(171,'2026-10-21 20:37:13','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(172,'2026-10-21 20:37:13','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(173,'2026-10-21 20:37:13','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(174,'2026-10-21 20:37:13','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(175,'2026-10-21 20:37:13','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(176,'2026-10-21 20:37:13','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(177,'2026-10-21 20:37:13','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(178,'2026-10-21 20:37:13','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(179,'2026-10-21 20:37:15',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(180,'2026-10-21 20:38:45','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(181,'2026-10-21 20:38:45','admin','Vereinslogo hochgeladen','SVG, 0 KB');
INSERT INTO "audit_log" VALUES(182,'2026-10-21 20:39:21','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(183,'2026-10-21 20:57:56',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(184,'2026-10-21 20:58:01',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(185,'2026-10-21 20:58:31','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(186,'2026-10-21 20:58:31','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(187,'2026-10-21 20:58:31','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(188,'2026-10-21 20:58:31','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(189,'2026-10-21 20:58:31','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(190,'2026-10-21 20:58:31','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(191,'2026-10-21 20:58:31','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(192,'2026-10-21 20:58:31','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(193,'2026-10-21 20:58:33',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(194,'2026-10-21 20:59:15','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(195,'2026-10-21 21:02:46',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(196,'2026-10-21 21:02:51',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(197,'2026-10-21 21:03:21','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(198,'2026-10-21 21:03:21','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(199,'2026-10-21 21:03:21','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(200,'2026-10-21 21:03:21','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(201,'2026-10-21 21:03:21','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(202,'2026-10-21 21:03:21','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(203,'2026-10-21 21:03:21','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(204,'2026-10-21 21:03:21','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(205,'2026-10-21 21:03:23',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(206,'2026-10-21 21:03:37','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(207,'2026-10-21 21:04:26',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(208,'2026-10-21 21:19:28',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(209,'2026-10-21 21:20:12',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(210,'2026-10-21 21:20:55','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(211,'2026-10-21 21:26:33','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(212,'2026-10-21 21:26:33','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(213,'2026-10-21 21:26:33','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(214,'2026-10-21 21:26:33','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(215,'2026-10-21 21:26:33','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(216,'2026-10-21 21:26:33','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(217,'2026-10-21 21:26:33','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(218,'2026-10-21 21:26:33','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(219,'2026-10-21 21:26:36',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(220,'2026-10-21 21:27:19','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(221,'2026-10-21 21:27:42',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(222,'2026-10-21 21:28:12','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(223,'2026-10-21 21:28:12','admin','Mitgliederverwaltung: Beitragsart angelegt','Erwachsene 10,00 €');
INSERT INTO "audit_log" VALUES(224,'2026-10-21 21:28:12','admin','Mitgliederverwaltung: Beitragsart angelegt','Jugend 10,00 €');
INSERT INTO "audit_log" VALUES(225,'2026-10-21 21:28:12','admin','Mitgliederverwaltung: Beitragsart angelegt','Familie 10,00 €');
INSERT INTO "audit_log" VALUES(226,'2026-10-21 21:28:12','admin','Mitgliederverwaltung: Reihenfolge der Beitragsarten','Jugend, Familie, Erwachsene');
INSERT INTO "audit_log" VALUES(227,'2026-10-21 21:33:40',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(228,'2026-10-21 21:33:45',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(229,'2026-10-21 21:34:15','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(230,'2026-10-21 21:34:15','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(231,'2026-10-21 21:34:15','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(232,'2026-10-21 21:34:15','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(233,'2026-10-21 21:34:15','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(234,'2026-10-21 21:34:15','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(235,'2026-10-21 21:34:15','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(236,'2026-10-21 21:34:15','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(237,'2026-10-21 21:34:17',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(238,'2026-10-21 21:34:31','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(239,'2026-10-21 21:43:49',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(240,'2026-10-21 21:50:22',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(241,'2026-10-21 21:50:32','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(242,'2026-10-21 21:52:00','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(243,'2026-10-21 22:11:03',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(244,'2026-10-21 22:11:22',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(245,'2026-10-21 22:13:15','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(246,'2026-10-21 22:13:46','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(247,'2026-10-21 22:14:19','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(248,'2026-10-21 22:14:36','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(249,'2026-10-21 22:14:42','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(250,'2026-10-21 22:14:59','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(251,'2026-10-21 22:16:18','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(252,'2026-10-21 22:40:00','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(253,'2026-10-21 22:40:00','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(254,'2026-10-21 22:40:00','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(255,'2026-10-21 22:40:00','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(256,'2026-10-21 22:40:00','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(257,'2026-10-21 22:40:00','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(258,'2026-10-21 22:40:00','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(259,'2026-10-21 22:40:01','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(260,'2026-10-21 22:40:02','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(261,'2026-10-21 22:40:02','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(262,'2026-10-21 22:40:03',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(263,'2026-10-21 22:40:03',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(264,'2026-10-21 22:40:04',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(265,'2026-10-21 22:40:43','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(266,'2026-10-21 22:40:43','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(267,'2026-10-21 22:50:05','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(268,'2026-10-21 22:50:05','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(269,'2026-10-21 22:50:06','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(270,'2026-10-21 22:50:06','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(271,'2026-10-21 22:50:06','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(272,'2026-10-21 22:50:06','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(273,'2026-10-21 22:50:06','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(274,'2026-10-21 22:50:06','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(275,'2026-10-21 22:50:07','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(276,'2026-10-21 22:50:07','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(277,'2026-10-21 22:50:07',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(278,'2026-10-21 22:50:07',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(279,'2026-10-21 22:50:09',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(280,'2026-10-21 22:50:45','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(281,'2026-10-21 22:50:46','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(282,'2026-10-21 22:56:58','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(283,'2026-10-21 22:57:07','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(284,'2026-10-21 22:57:08','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(285,'2026-10-21 22:57:08','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(286,'2026-10-21 22:57:08','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(287,'2026-10-21 22:58:13','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(288,'2026-10-21 22:58:13','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(289,'2026-10-21 22:58:13','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(290,'2026-10-21 22:58:14',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(291,'2026-10-21 22:58:14',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(292,'2026-10-21 22:58:14',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(293,'2026-10-21 22:58:52','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(294,'2026-10-21 22:58:53','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(295,'2026-10-21 22:58:53','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(296,'2026-10-21 22:58:56','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(297,'2026-10-21 22:58:56','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(298,'2026-10-21 22:58:56','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(299,'2026-10-21 22:58:56','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(300,'2026-10-21 22:58:56','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(301,'2026-10-21 22:58:56','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(302,'2026-10-21 22:58:56','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(303,'2026-10-21 22:58:56','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(304,'2026-10-21 22:58:58',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(305,'2026-10-21 22:58:59',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(306,'2026-10-21 22:58:59',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(307,'2026-10-21 22:59:20',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(308,'2026-10-21 22:59:35','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(309,'2026-10-21 22:59:36','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(310,'2026-10-21 22:59:40','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(311,'2026-10-21 22:59:41','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(312,'2026-10-21 22:59:57','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(313,'2026-10-21 23:00:01','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(314,'2026-10-21 23:04:04','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(315,'2026-10-21 23:04:04','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(316,'2026-10-21 23:04:04','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(317,'2026-10-21 23:04:04','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(318,'2026-10-21 23:04:04','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(319,'2026-10-21 23:04:04','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(320,'2026-10-21 23:04:04','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(321,'2026-10-21 23:04:04','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(322,'2026-10-21 23:04:07',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(323,'2026-10-21 23:06:28','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(324,'2026-10-21 23:06:28','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(325,'2026-10-21 23:06:28','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(326,'2026-10-21 23:06:29',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(327,'2026-10-21 23:06:29',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(328,'2026-10-21 23:06:29',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(329,'2026-10-21 23:07:06','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(330,'2026-10-21 23:07:07','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(331,'2026-10-21 23:07:07','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(332,'2026-10-21 23:07:10','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(333,'2026-10-21 23:07:10','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(334,'2026-10-21 23:07:10','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(335,'2026-10-21 23:07:10','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(336,'2026-10-21 23:07:10','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(337,'2026-10-21 23:07:10','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(338,'2026-10-21 23:07:10','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(339,'2026-10-21 23:07:10','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(340,'2026-10-21 23:07:12',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(341,'2026-10-21 23:07:13',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(342,'2026-10-21 23:07:20','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(343,'2026-10-21 23:07:32','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(344,'2026-10-21 23:07:33','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(345,'2026-10-21 23:07:36','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(346,'2026-10-21 23:07:49','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(347,'2026-10-21 23:07:55','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(348,'2026-10-21 23:12:15','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(349,'2026-10-21 23:12:15','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(350,'2026-10-21 23:12:15','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(351,'2026-10-21 23:12:15','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(352,'2026-10-21 23:12:15','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(353,'2026-10-21 23:12:15','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(354,'2026-10-21 23:12:15','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(355,'2026-10-21 23:12:15','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(356,'2026-10-21 23:12:18',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(357,'2026-10-21 23:14:00',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(358,'2026-10-21 23:14:05','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(359,'2026-10-21 23:14:28',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(360,'2026-10-21 23:14:33','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(361,'2026-10-21 23:14:54',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(362,'2026-10-21 23:14:59','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(363,'2026-10-21 23:19:19','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(364,'2026-10-21 23:19:19','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(365,'2026-10-21 23:19:19','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(366,'2026-10-21 23:19:20',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(367,'2026-10-21 23:19:20',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(368,'2026-10-21 23:19:20',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(369,'2026-10-21 23:19:57','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(370,'2026-10-21 23:19:58','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(371,'2026-10-21 23:19:58','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(372,'2026-10-21 23:20:00','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(373,'2026-10-21 23:20:00','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(374,'2026-10-21 23:20:00','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(375,'2026-10-21 23:20:00','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(376,'2026-10-21 23:20:00','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(377,'2026-10-21 23:20:00','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(378,'2026-10-21 23:20:00','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(379,'2026-10-21 23:20:00','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(380,'2026-10-21 23:20:03',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(381,'2026-10-21 23:20:04',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(382,'2026-10-21 23:20:05',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(383,'2026-10-21 23:20:24',NULL,'Buchungsseite freigeschaltet','127.0.0.1 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36');
INSERT INTO "audit_log" VALUES(384,'2026-10-21 23:20:40','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(385,'2026-10-21 23:20:42','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(386,'2026-10-21 23:20:46','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(387,'2026-10-21 23:20:46','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(388,'2026-10-21 23:21:02','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(389,'2026-10-21 23:21:06','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(390,'2026-10-21 23:25:05','admin','Anmeldung','127.0.0.1');
INSERT INTO "audit_log" VALUES(391,'2026-10-21 23:25:05','admin','Buchungssystem: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(392,'2026-10-21 23:25:05','admin','Spielbetrieb: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(393,'2026-10-21 23:25:05','admin','Helferdienste: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(394,'2026-10-21 23:25:05','admin','Mitgliederverwaltung: in der App freigeschaltet','Felix Adler');
INSERT INTO "audit_log" VALUES(395,'2026-10-21 23:25:05','admin','Beregnung: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(396,'2026-10-21 23:25:05','admin','Zugang: Freischaltung geändert','Felix Adler');
INSERT INTO "audit_log" VALUES(397,'2026-10-21 23:25:05','admin','Mitglieder-App: QR-Einladung erzeugt','Felix Adler');
INSERT INTO "audit_log" VALUES(398,'2026-10-21 23:25:08',NULL,'Mitglieder-App: Handy freigeschaltet','Felix Adler');
INSERT INTO "admin_roles" VALUES(1,'Vorstand','Mitglieder, Anträge, Auswertungen, Dokumente, E-Mail, Veranstaltungen und Helferdienste – ohne Bankdaten und Einzug.','["mitglieder","mitglieder_dokumente","export","veranstaltungen","arbeitseinsatz","konten","email"]',0,1,'2026-10-21 17:26:42');
INSERT INTO "admin_roles" VALUES(2,'Kassenwart','Beitragslauf, Lastschriften, offene Posten, Bankdaten, Verkaufs-Abrechnung und Export.','["mitglieder","mitglieder_bank","mitglieder_finanzen","mitglieder_dokumente","abrechnung","uebernahme","export","konten"]',0,2,'2026-10-21 17:26:42');
INSERT INTO "admin_roles" VALUES(3,'Abteilungsleitung','Nur Mitglieder der eigenen Abteilung(en): Stammdaten ändern, Austritte eintragen, neue Mitglieder anlegen und Anträge mit dieser Abteilung annehmen.','["mitglieder"]',1,3,'2026-10-21 17:26:42');
INSERT INTO "admin_roles" VALUES(4,'Thekenteam','Verkauf: Lieferungen, Bestand, Bestellung, Buchungen, Artikel und neue Konten bestätigen.','["lieferungen","bestand","bestellung","buchungen","artikel","konten","veranstaltungen"]',0,4,'2026-10-21 17:26:42');
INSERT INTO "admin_roles" VALUES(5,'Kassenprüfer','Nur ansehen und exportieren.','["export"]',0,5,'2026-10-21 17:26:42');
INSERT INTO "member_access" VALUES(3,'zugang','mitglied',NULL,0,'2026-10-21 17:36:05',0,NULL);
INSERT INTO "member_access" VALUES(4,'zugang','mitglied',NULL,0,'2026-10-21 19:14:08',0,NULL);
INSERT INTO "member_access" VALUES(4,'beregnung',NULL,NULL,0,'2026-10-21 19:17:47',0,NULL);
INSERT INTO "member_access" VALUES(3,'beregnung',NULL,NULL,0,'2026-10-21 20:23:18',0,NULL);
INSERT INTO "bk_rights" VALUES(3,0,'[]',NULL,'Adminkonto','2026-10-21 19:45:28',1,1);
INSERT INTO "sp_team" VALUES(1,'Herren 30',NULL,NULL,4,3,NULL,'herren30',1,0,NULL,'2026-10-21 17:26:50','H30');
INSERT INTO "sp_player" VALUES(1,3,1,'2026-10-21 17:26:50');
INSERT INTO "sp_player" VALUES(1,4,2,'2026-10-21 17:26:50');
INSERT INTO "sp_player" VALUES(1,5,3,'2026-10-21 17:26:50');
INSERT INTO "sp_player" VALUES(1,6,4,'2026-10-21 17:26:50');
INSERT INTO "sp_player" VALUES(1,7,5,'2026-10-21 17:26:50');
INSERT INTO "sp_player" VALUES(1,8,6,'2026-10-21 17:26:50');
INSERT INTO "sp_player" VALUES(1,13,7,'2026-10-21 17:26:50');
INSERT INTO "sp_game" VALUES(1,1,'2026-10-28','10:00',1,'TC Nachbarort 1',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,NULL,0,0,NULL,'Adminkonto','2026-10-21 17:26:50','spiel',0,1);
INSERT INTO "sp_game" VALUES(2,1,'2026-11-04','10:00',0,'TC Nachbarort 2',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,NULL,0,0,NULL,'Adminkonto','2026-10-21 17:26:50','spiel',0,1);
INSERT INTO "sp_game" VALUES(3,1,'2026-11-11','10:00',1,'TC Nachbarort 3',NULL,NULL,NULL,'geplant',NULL,NULL,NULL,NULL,0,0,NULL,'Adminkonto','2026-10-21 17:26:50','spiel',0,1);
INSERT INTO "sp_extern" VALUES(13,'0171 2223333','TC Nachbarort','PpWOkYt3sXCLaACOKotw2keT','Adminkonto','2026-10-21 17:26:50',NULL,'2026-10-21 17:26:50');
INSERT INTO "member_devices" VALUES(5,'app',4,NULL,NULL,'00a3fbaf737dc37c63a03ccc2a49c5ab:d556e50757f98156c6656068d3e8bf93a4d4402c15380a666bac5edeab71e593','354ec6877294c7dadd7a530decf2905d:f469fb6e9868617941151f1dde26c542ce1514f5485148dbef673a7b8c8fe5cc','Gerät · Chrome','Adminkonto','2026-10-21 19:17:47','2026-10-21 19:17:49',NULL,0,NULL,0,NULL,'*','c958e44d4b996b2b88c67b4c3a93936d:f0bab5338cd6985fa2e321631e37055163c3db0d654891c772cf0c9da234f84b',1793207869494,'127.0.0.1:5803',NULL,NULL,NULL,'qr','d93e0177f1ff7c6737449519965209c0:a98a271f84e55fb8ca5e584f68f8a161e6518feda2d979739bb7fa37a58fd957','2026-10-21 19:17:49',0,0,NULL,NULL,NULL,0,NULL,0,NULL,1);
INSERT INTO "member_devices" VALUES(22,'app',3,NULL,NULL,'ae3cbd26a164a12394721d8e7ee57ecd:19ddb08eb04ced1e6d32aec7712bf732ca282a29424c41253e51484e7e13e868','2e00ff092ca5d4258998b328a3a1da21:a8d5c56a24e87aac58e751486a84fb3c5a3b7253482f60307224abbeb11a419f','Gerät · Chrome','Adminkonto','2026-10-21 23:25:05','2026-10-21 23:25:08',NULL,0,NULL,0,NULL,'*','7b846fc97ca423f6be6922e421af85de:6406c0e218127a932ac2b690a7500523b02e8eec535b067e7a0b592447a52efa',1793222708114,'127.0.0.1:5803',NULL,NULL,NULL,'qr','36e5525bb68ddfdc7a7769c8c16b5292:6b9e4e5c79a63b026ba10a95d01b0136b7d24b838d9769602f1e9ea549152881','2026-10-21 23:25:08',0,0,NULL,NULL,NULL,0,NULL,0,NULL,1);
INSERT INTO "aw_event" VALUES(1,'theke','Thekendienst','2026-10-21',NULL,NULL,NULL,NULL,NULL,0,'Clubwerk','2026-10-21 17:26:45',1,NULL,1,NULL,0);
INSERT INTO "aw_event" VALUES(2,'arbeit','Plätze herrichten','2026-10-21','17:00','20:00','Anlage',8,NULL,0,'Adminkonto','2026-10-21 18:12:49',0,NULL,1,NULL,0);
INSERT INTO "aw_event"(id,kind,title,date,start,end,place,slots,note,created_by,counts,deadline) VALUES(3,'termin','Weihnachtsfeier','2026-12-12','18:00','23:00','Vereinsheim',60,'Mit Essen vom Buffet – bitte Begleitung angeben.','Adminkonto',0,'2026-12-05');
INSERT INTO "aw_event"(id,kind,title,date,start,end,place,slots,note,created_by,counts,deadline) VALUES(4,'termin','Mitgliederversammlung','2026-11-20','19:00',NULL,'Vereinsheim',NULL,NULL,'Adminkonto',0,NULL);
INSERT INTO "aw_signup"(event_id,member_id,answer,persons) VALUES(3,4,'ja',2);
INSERT INTO "aw_signup"(event_id,member_id,answer,persons) VALUES(3,5,'ja',3);
INSERT INTO "aw_signup"(event_id,member_id,answer,persons) VALUES(3,6,'nein',0);
INSERT INTO "aw_signup"(event_id,member_id,answer,persons) VALUES(3,7,'ja',1);
INSERT INTO "aw_signup"(event_id,member_id,answer,persons) VALUES(4,4,'ja',1);
INSERT INTO "irr_steps" VALUES(1,1792603053771,0,NULL,'switch.platz1',600,1792603053771,1792603653771,'fail','Clubwerk hat keinen Zugangsschlüssel für Home Assistant bekommen. Bitte das Add-on einmal neu starten; hilft das nicht, im Protokoll des Add-ons die Zeile „Verbindung zu Home Assistant“ prüfen.');
INSERT INTO "irr_log" VALUES(1,'2026-10-21 19:17:33','Adminkonto','start','Platz 1',600,NULL);
INSERT INTO "irr_log" VALUES(2,'2026-10-21 19:17:33',NULL,'fehler','Platz 1',NULL,'switch.platz1: Clubwerk hat keinen Zugangsschlüssel für Home Assistant bekommen. Bitte das Add-on einmal neu starten; hilft das nicht, im Protokoll des Add-ons die Zeile „Verbindung zu Home Assistant“ prüfen.');
INSERT INTO "irr_log" VALUES(3,'2026-10-21 19:17:33','Adminkonto','stop','Platz 1',NULL,'Fehler: switch.platz1: Clubwerk hat keinen Zugangsschlüssel für Home Assistant bekommen. Bitte das Add-on einmal neu starten; hilft das nicht, im Protokoll des Add-ons die Zeile „Verbindung zu Home Assistant“ prüfen.');
INSERT INTO "bk_resource" VALUES(1,'platz','Platz 1','Plätze',NULL,'1234567','08:00','22:00',60,120,1,NULL,1,10,'2026-10-21 17:26:45',NULL,'gebuehr',500,0,0,NULL,0);
INSERT INTO "bk_resource" VALUES(2,'platz','Platz 2','Plätze',NULL,'1234567','08:00','22:00',60,120,1,NULL,1,20,'2026-10-21 17:26:45',NULL,'gebuehr',500,0,0,NULL,0);
INSERT INTO "bk_resource" VALUES(3,'platz','Platz 3',NULL,NULL,'1234567','08:00','22:00',30,120,1,NULL,1,30,'2026-10-21 18:02:20',NULL,'gebuehr',0,0,0,NULL,0);
INSERT INTO "bk_resource" VALUES(4,'platz','Padel',NULL,NULL,'1234567','08:00','22:00',30,120,1,NULL,1,40,'2026-10-21 18:02:20',NULL,'gebuehr',0,0,0,NULL,0);
INSERT INTO "bk_booking" VALUES(1,1,'2026-10-21','19:00','20:00','buchung',3,'[4]','[]',0,NULL,NULL,NULL,NULL,'aktiv','verwaltung','Adminkonto','2026-10-21 18:02:20',NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,1);
INSERT INTO "bk_booking" VALUES(2,2,'2026-10-21','20:00','22:00','buchung',10,'[7]','[]',0,NULL,NULL,'Medenspiel',NULL,'aktiv','verwaltung','Adminkonto','2026-10-21 18:02:20',NULL,NULL,NULL,NULL,2,NULL,0,NULL,1);
INSERT INTO "bk_booking" VALUES(3,3,'2026-10-21','18:00','19:00','buchung',8,'[]','[]',0,NULL,NULL,NULL,NULL,'aktiv','verwaltung','Adminkonto','2026-10-21 18:02:20',NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0);
INSERT INTO "bk_label" VALUES(1,'Training','#2f6fd6',10,1,'verwaltung','[]','[]',0);
INSERT INTO "bk_label" VALUES(2,'Medenspiel','#e07b16',20,1,'verwaltung','[]','[]',0);
INSERT INTO "bk_label" VALUES(3,'Turnier','#8a4fd6',30,1,'verwaltung','[]','[]',0);
INSERT INTO "bk_label" VALUES(4,'Kurs','#1f9a6b',40,1,'verwaltung','[]','[]',0);
INSERT INTO "bk_label" VALUES(5,'Platzpflege','#7a7f87',50,1,'verwaltung','[]','[]',0);
INSERT INTO "mv_fee" VALUES(1,'Erwachsene',NULL,1000,'jahr','anteilig',NULL,NULL,0,NULL,1,30,1,NULL,'grund');
INSERT INTO "mv_fee" VALUES(2,'Jugend',NULL,1000,'jahr','anteilig',NULL,NULL,0,NULL,1,10,1,NULL,'grund');
INSERT INTO "mv_fee" VALUES(3,'Familie',NULL,1000,'jahr','anteilig',NULL,NULL,0,NULL,1,20,1,NULL,'grund');
INSERT INTO "staff" VALUES(1,'Maria Putz','Reinigung','a5fd740ce9f96e2258dc7796c35742ee:b213b9cc16e4793a56c89bb2b78d023017aa14bec5b7f1288415acf5469bbd10',1,'2026-10-21 18:12:49');
INSERT INTO "staff" VALUES(2,'Karl Platzwart','Platzwart','44d35a8991e845e4086c09583b85466f:a32e4a66b5d9442b057eda1cd1c6db8df91787c0001bb5cdc838ad2e8feeccee',1,'2026-10-21 18:12:49');
DELETE FROM sqlite_sequence WHERE name='members'; INSERT INTO sqlite_sequence VALUES('members',13);
DELETE FROM sqlite_sequence WHERE name='articles'; INSERT INTO sqlite_sequence VALUES('articles',15);
DELETE FROM sqlite_sequence WHERE name='events'; INSERT INTO sqlite_sequence VALUES('events',0);
DELETE FROM sqlite_sequence WHERE name='bookings'; INSERT INTO sqlite_sequence VALUES('bookings',25);
DELETE FROM sqlite_sequence WHERE name='deliveries'; INSERT INTO sqlite_sequence VALUES('deliveries',0);
DELETE FROM sqlite_sequence WHERE name='delivery_items'; INSERT INTO sqlite_sequence VALUES('delivery_items',0);
DELETE FROM sqlite_sequence WHERE name='stock_moves'; INSERT INTO sqlite_sequence VALUES('stock_moves',0);
DELETE FROM sqlite_sequence WHERE name='settlements'; INSERT INTO sqlite_sequence VALUES('settlements',0);
DELETE FROM sqlite_sequence WHERE name='admin_users'; INSERT INTO sqlite_sequence VALUES('admin_users',1);
DELETE FROM sqlite_sequence WHERE name='audit_log'; INSERT INTO sqlite_sequence VALUES('audit_log',398);
DELETE FROM sqlite_sequence WHERE name='event_guests'; INSERT INTO sqlite_sequence VALUES('event_guests',0);
DELETE FROM sqlite_sequence WHERE name='event_payments'; INSERT INTO sqlite_sequence VALUES('event_payments',0);
DELETE FROM sqlite_sequence WHERE name='guest_tabs'; INSERT INTO sqlite_sequence VALUES('guest_tabs',0);
DELETE FROM sqlite_sequence WHERE name='admin_roles'; INSERT INTO sqlite_sequence VALUES('admin_roles',5);
DELETE FROM sqlite_sequence WHERE name='member_settlements'; INSERT INTO sqlite_sequence VALUES('member_settlements',0);
DELETE FROM sqlite_sequence WHERE name='member_devices'; INSERT INTO sqlite_sequence VALUES('member_devices',22);
DELETE FROM sqlite_sequence WHERE name='push_subs'; INSERT INTO sqlite_sequence VALUES('push_subs',0);
DELETE FROM sqlite_sequence WHERE name='push_log'; INSERT INTO sqlite_sequence VALUES('push_log',0);
DELETE FROM sqlite_sequence WHERE name='bank_accounts'; INSERT INTO sqlite_sequence VALUES('bank_accounts',0);
DELETE FROM sqlite_sequence WHERE name='aw_event'; INSERT INTO sqlite_sequence VALUES('aw_event',4);
DELETE FROM sqlite_sequence WHERE name='aw_signup'; INSERT INTO sqlite_sequence VALUES('aw_signup',5);
DELETE FROM sqlite_sequence WHERE name='aw_entry'; INSERT INTO sqlite_sequence VALUES('aw_entry',0);
DELETE FROM sqlite_sequence WHERE name='aw_plan'; INSERT INTO sqlite_sequence VALUES('aw_plan',0);
DELETE FROM sqlite_sequence WHERE name='aw_extern'; INSERT INTO sqlite_sequence VALUES('aw_extern',0);
DELETE FROM sqlite_sequence WHERE name='irr_steps'; INSERT INTO sqlite_sequence VALUES('irr_steps',1);
DELETE FROM sqlite_sequence WHERE name='irr_log'; INSERT INTO sqlite_sequence VALUES('irr_log',3);
DELETE FROM sqlite_sequence WHERE name='bh_partner'; INSERT INTO sqlite_sequence VALUES('bh_partner',0);
DELETE FROM sqlite_sequence WHERE name='bh_invoice'; INSERT INTO sqlite_sequence VALUES('bh_invoice',0);
DELETE FROM sqlite_sequence WHERE name='bh_donation'; INSERT INTO sqlite_sequence VALUES('bh_donation',0);
DELETE FROM sqlite_sequence WHERE name='bk_resource'; INSERT INTO sqlite_sequence VALUES('bk_resource',4);
DELETE FROM sqlite_sequence WHERE name='bk_booking'; INSERT INTO sqlite_sequence VALUES('bk_booking',3);
DELETE FROM sqlite_sequence WHERE name='bk_series'; INSERT INTO sqlite_sequence VALUES('bk_series',0);
DELETE FROM sqlite_sequence WHERE name='bk_label'; INSERT INTO sqlite_sequence VALUES('bk_label',5);
DELETE FROM sqlite_sequence WHERE name='bk_wait'; INSERT INTO sqlite_sequence VALUES('bk_wait',0);
DELETE FROM sqlite_sequence WHERE name='mv_department'; INSERT INTO sqlite_sequence VALUES('mv_department',0);
DELETE FROM sqlite_sequence WHERE name='mv_member_department'; INSERT INTO sqlite_sequence VALUES('mv_member_department',0);
DELETE FROM sqlite_sequence WHERE name='mv_fee'; INSERT INTO sqlite_sequence VALUES('mv_fee',3);
DELETE FROM sqlite_sequence WHERE name='mv_member_fee'; INSERT INTO sqlite_sequence VALUES('mv_member_fee',0);
DELETE FROM sqlite_sequence WHERE name='mv_run'; INSERT INTO sqlite_sequence VALUES('mv_run',0);
DELETE FROM sqlite_sequence WHERE name='mv_collection'; INSERT INTO sqlite_sequence VALUES('mv_collection',0);
DELETE FROM sqlite_sequence WHERE name='mv_charge'; INSERT INTO sqlite_sequence VALUES('mv_charge',0);
DELETE FROM sqlite_sequence WHERE name='mv_document'; INSERT INTO sqlite_sequence VALUES('mv_document',0);
DELETE FROM sqlite_sequence WHERE name='mv_honor'; INSERT INTO sqlite_sequence VALUES('mv_honor',0);
DELETE FROM sqlite_sequence WHERE name='mv_function'; INSERT INTO sqlite_sequence VALUES('mv_function',0);
DELETE FROM sqlite_sequence WHERE name='mv_history'; INSERT INTO sqlite_sequence VALUES('mv_history',0);
DELETE FROM sqlite_sequence WHERE name='mv_application'; INSERT INTO sqlite_sequence VALUES('mv_application',0);
DELETE FROM sqlite_sequence WHERE name='mv_change'; INSERT INTO sqlite_sequence VALUES('mv_change',0);
DELETE FROM sqlite_sequence WHERE name='mv_age_notice'; INSERT INTO sqlite_sequence VALUES('mv_age_notice',0);
DELETE FROM sqlite_sequence WHERE name='staff'; INSERT INTO sqlite_sequence VALUES('staff',2);
DELETE FROM sqlite_sequence WHERE name='time_entries'; INSERT INTO sqlite_sequence VALUES('time_entries',0);
DELETE FROM sqlite_sequence WHERE name='zugang_log'; INSERT INTO sqlite_sequence VALUES('zugang_log',0);
DELETE FROM sqlite_sequence WHERE name='sp_team'; INSERT INTO sqlite_sequence VALUES('sp_team',1);
DELETE FROM sqlite_sequence WHERE name='sp_game'; INSERT INTO sqlite_sequence VALUES('sp_game',3);
INSERT INTO "settings" VALUES('ext_maengel_active','1');
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
CREATE TABLE IF NOT EXISTS mg_photo (id INTEGER PRIMARY KEY AUTOINCREMENT, report_id INTEGER NOT NULL, file TEXT NOT NULL, thumb TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS mg_also (report_id INTEGER NOT NULL, member_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY(report_id, member_id));
INSERT INTO "mg_place" VALUES(1,'Clubhaus',0);
INSERT INTO "mg_place" VALUES(2,'Clubhaus Damen-WC',1);
INSERT INTO "mg_place" VALUES(3,'Parkplatz',2);
INSERT INTO "mg_report" VALUES(1,3,'Platz 2','Netz in der Mitte eingerissen, hängt durch.',0,'arbeit','Danke! Das neue Netz ist bestellt und kommt am Samstag.',NULL,1,'app','2026-10-18 17:42:10','2026-10-19 09:10:00',NULL);
INSERT INTO "mg_report" VALUES(2,6,'Clubhaus Damen-WC','Wasserhahn tropft ständig, lässt sich nicht ganz zudrehen.',1,'neu',NULL,NULL,NULL,'tablet','2026-10-21 10:05:33',NULL,NULL);
INSERT INTO "mg_report" VALUES(3,3,'Parkplatz','Lampe am Eingang geht abends nicht an.',0,'erledigt','Lampe ist getauscht – danke für den Hinweis!',NULL,1,'app','2026-10-02 19:20:00','2026-10-05 08:00:00','2026-10-05 08:00:00');
INSERT INTO "mg_report" VALUES(4,8,'Platz 1','Linie an der Grundlinie hat sich gelöst – Stolpergefahr.',1,'neu',NULL,NULL,NULL,'app','2026-10-20 18:12:00',NULL,NULL);
INSERT INTO "mg_also" VALUES(1,4,'2026-10-19 16:00:00');
INSERT INTO "mg_also" VALUES(1,7,'2026-10-20 11:30:00');
INSERT INTO "mg_also" VALUES(4,3,'2026-10-21 08:45:00');
DELETE FROM sqlite_sequence WHERE name='mg_report'; INSERT INTO sqlite_sequence VALUES('mg_report',4);
DELETE FROM sqlite_sequence WHERE name='mg_place'; INSERT INTO sqlite_sequence VALUES('mg_place',3);
-- Mitgliedsdaten für vier Mitglieder (Gratulationen: 70. Geburtstag, 81. Geburtstag, 25 und 40 Jahre im Verein rund um den Stichtag)
INSERT INTO "mv_person"(member_id, member_no, first_name, last_name, birth_date, gender, status, entry_date, payment, email) VALUES(7,'7','Peter','Hofmann','1956-10-24','m','aktiv','1990-04-01','rechnung','peter.hofmann@example.org');
INSERT INTO "mv_person"(member_id, member_no, first_name, last_name, birth_date, gender, status, entry_date, payment, email) VALUES(8,'8','Sabine','Klein','1945-11-08','w','passiv','1972-05-01','rechnung','sabine.klein@example.org');
INSERT INTO "mv_person"(member_id, member_no, first_name, last_name, birth_date, gender, status, entry_date, payment, email) VALUES(9,'9','Markus','Weber','1979-03-12','m','aktiv','2001-11-02','rechnung','markus.weber@example.org');
INSERT INTO "mv_person"(member_id, member_no, first_name, last_name, birth_date, gender, status, entry_date, payment, email) VALUES(10,'10','Julia','Fischer','1968-06-30','w','aktiv','1986-10-30','rechnung','julia.fischer@example.org');
INSERT INTO "mv_member_fee"(member_id, fee_id, start_date) VALUES(7,1,'2020-01-01');
INSERT INTO "mv_member_fee"(member_id, fee_id, start_date) VALUES(8,1,'2020-01-01');
INSERT INTO "mv_member_fee"(member_id, fee_id, start_date) VALUES(9,1,'2020-01-01');
INSERT INTO "mv_member_fee"(member_id, fee_id, start_date) VALUES(10,1,'2020-01-01');
-- Mahnwesen: offene Posten in verschiedenen Stufen (Stichtag 21.10.2026) – Hofmann ist zur 1. Mahnung dran, Klein zur Zahlungserinnerung, Weber hat die letzte Mahnung ohne Zahlung
INSERT INTO "mv_charge"(id, member_id, kind, text, cents, due_date, invoice_no, dunning_level, dunned_at, created_by) VALUES(1,7,'beitrag','Beitrag Erwachsene 2026',1000,'2026-09-01','RE-2026-0001',1,'2026-10-05','admin');
INSERT INTO "mv_charge"(id, member_id, kind, text, cents, due_date, created_by) VALUES(2,8,'sonstiges','Hallenmiete Wintersaison',4500,'2026-10-01','admin');
INSERT INTO "mv_charge"(id, member_id, kind, text, cents, due_date, invoice_no, dunning_level, dunned_at, created_by) VALUES(3,9,'beitrag','Beitrag Erwachsene 2026',1000,'2026-07-01','RE-2026-0002',3,'2026-09-20','admin');
INSERT INTO "mv_charge"(id, member_id, kind, text, cents, due_date, invoice_no, dunning_level, dunned_at, created_by) VALUES(4,9,'mahngebuehr','Mahngebühr (1. Mahnung)',250,'2026-09-06','RE-2026-0002',3,'2026-09-20','admin');
INSERT INTO "mv_charge"(id, member_id, kind, text, cents, due_date, invoice_no, dunning_level, dunned_at, created_by) VALUES(5,9,'mahngebuehr','Mahngebühr (2. Mahnung)',250,'2026-09-20','RE-2026-0002',3,'2026-09-20','admin');
INSERT INTO "mv_charge"(id, member_id, kind, text, cents, due_date, status, paid_at, paid_via, created_by) VALUES(6,10,'beitrag','Beitrag Erwachsene 2026',1000,'2026-09-01','bezahlt','2026-09-10','ueberweisung','admin');
UPDATE sqlite_sequence SET seq = 6 WHERE name = 'mv_charge';
CREATE TABLE IF NOT EXISTS mv_dunning (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), date TEXT NOT NULL, level INTEGER NOT NULL, title TEXT NOT NULL,
  cents INTEGER NOT NULL, fee_cents INTEGER NOT NULL DEFAULT 0, fee_id INTEGER, ref TEXT, charges TEXT NOT NULL,
  via TEXT NOT NULL, by_user TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
INSERT INTO mv_dunning(member_id, date, level, title, cents, fee_cents, fee_id, ref, charges, via, by_user) VALUES(7,'2026-10-05',1,'Zahlungserinnerung',1000,0,NULL,'RE-2026-0001','[{"id":1,"text":"Beitrag Erwachsene 2026","cents":1000,"level":1,"adv":true}]','email','admin');
INSERT INTO mv_dunning(member_id, date, level, title, cents, fee_cents, fee_id, ref, charges, via, by_user) VALUES(9,'2026-07-20',1,'Zahlungserinnerung',1000,0,NULL,'RE-2026-0002','[{"id":3,"text":"Beitrag Erwachsene 2026","cents":1000,"level":1,"adv":true}]','email','admin');
INSERT INTO mv_dunning(member_id, date, level, title, cents, fee_cents, fee_id, ref, charges, via, by_user) VALUES(9,'2026-09-06',2,'1. Mahnung',1250,250,4,'RE-2026-0002','[{"id":3,"text":"Beitrag Erwachsene 2026","cents":1000,"level":2,"adv":true}]','email','admin');
INSERT INTO mv_dunning(member_id, date, level, title, cents, fee_cents, fee_id, ref, charges, via, by_user) VALUES(9,'2026-09-20',3,'2. Mahnung',1500,250,5,'RE-2026-0002','[{"id":3,"text":"Beitrag Erwachsene 2026","cents":1000,"level":3,"adv":true},{"id":4,"text":"Mahngebühr (1. Mahnung)","cents":250,"level":3,"adv":true}]','email','admin');
DELETE FROM sqlite_sequence WHERE name='mv_member_fee'; INSERT INTO sqlite_sequence VALUES('mv_member_fee',4);
-- Turniere (Clubmeisterschaft): erfundene Saison mit 4 Ligen × 2 Gruppen, Endrunde und Relegation (erzeugt über den Server, Daten relativ zum Stichtag)
INSERT INTO "members"(id, name, kind, created_at) VALUES(14,'Jan Albrecht','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(15,'Miriam Bauer','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(16,'Stefan Brandt','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(17,'Nina Dietrich','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(18,'Oliver Engel','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(19,'Katrin Frank','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(20,'Daniel Graf','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(21,'Sophie Hahn','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(22,'Martin Huber','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(23,'Lena Jäger','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(24,'Thomas Keller','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(25,'Sarah König','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(26,'Michael Lang','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(27,'Hanna Lorenz','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(28,'Christian Maier','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(29,'Paula Möller','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(30,'Andreas Nagel','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(31,'Emma Otto','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(32,'Florian Peters','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(33,'Clara Roth','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(34,'Sebastian Sauer','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(35,'Marie Schäfer','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(36,'Philipp Schreiber','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(37,'Johanna Seidel','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(38,'Dominik Simon','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(39,'Katharina Vogel','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(40,'Tim Walter','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(41,'Lisa Winkler','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(42,'Moritz Wolf','mitglied','2026-10-21 17:26:50');
INSERT INTO "members"(id, name, kind, created_at) VALUES(43,'Elena Ziegler','mitglied','2026-10-21 17:26:50');
DELETE FROM sqlite_sequence WHERE name='members'; INSERT INTO sqlite_sequence VALUES('members',43);
INSERT INTO "settings" VALUES('ext_turniere_active','1');
CREATE TABLE IF NOT EXISTS tu_honor ( id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER, year TEXT NOT NULL, title TEXT NOT NULL, names TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')) );
CREATE TABLE IF NOT EXISTS tu_match ( id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER NOT NULL, comp TEXT NOT NULL DEFAULT 'E', league TEXT NOT NULL, phase TEXT NOT NULL DEFAULT 'gruppe', group_no INTEGER, slot INTEGER NOT NULL DEFAULT 0, a INTEGER NOT NULL, b INTEGER NOT NULL, result TEXT, sets TEXT NOT NULL DEFAULT '[]', winner TEXT, retired TEXT, entered_by TEXT, entered_at TEXT, plan_date TEXT, plan_time TEXT, plan_end TEXT, court TEXT, booking_id INTEGER, due_sent INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')) );
CREATE TABLE IF NOT EXISTS tu_player ( season_id INTEGER NOT NULL, member_id INTEGER NOT NULL, league TEXT NOT NULL, singles INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'app', created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), doubles INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (season_id, member_id) );
CREATE TABLE IF NOT EXISTS tu_season ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, leagues TEXT NOT NULL DEFAULT '["A","B","C","D"]', reg_until TEXT, due_groups TEXT, due_final TEXT, drawn_at TEXT, closed_at TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')) , doubles TEXT NOT NULL DEFAULT '[]', paired_at TEXT, ddrawn_at TEXT);
CREATE TABLE IF NOT EXISTS tu_team ( id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER NOT NULL, comp TEXT NOT NULL DEFAULT 'E', league TEXT NOT NULL, group_no INTEGER NOT NULL DEFAULT 1, p1 INTEGER, name TEXT NOT NULL , p2 INTEGER);
INSERT INTO "tu_season"(id, name, leagues, reg_until, due_groups, due_final, drawn_at, closed_at, created_by, created_at, doubles, paired_at, ddrawn_at) VALUES(1,'Clubmeisterschaft 2026','["A","B","C","D"]','2026-09-11','2026-10-24','2026-11-15','2026-10-21 12:21:37',NULL,'Adminkonto','2026-10-21 12:21:37','["A+B","C+D"]','2026-10-21 12:21:37','2026-10-21 12:21:37');
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,3,'A',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,4,'A',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,5,'A',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,6,'A',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,7,'A',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,9,'A',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,10,'A',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,11,'A',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,12,'A',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,14,'A',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,15,'B',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,16,'B',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,17,'B',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,18,'B',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,19,'B',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,20,'B',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,21,'B',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,22,'B',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,23,'B',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,24,'B',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,25,'C',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,26,'C',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,27,'C',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,28,'C',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,29,'C',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,30,'C',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,31,'C',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,32,'C',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,33,'C',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,34,'C',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,35,'D',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,36,'D',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,37,'D',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,38,'D',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,39,'D',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,40,'D',1,'verwaltung','2026-10-21 12:21:37',1);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,41,'D',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,42,'D',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_player"(season_id, member_id, league, singles, source, created_at, doubles) VALUES(1,43,'D',1,'verwaltung','2026-10-21 12:21:37',0);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(1,1,'E','A',1,11,'Neumann, Tobias',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(2,1,'E','A',1,14,'Albrecht, Jan',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(3,1,'E','A',1,3,'Adler, Felix',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(4,1,'E','A',1,5,'Schmitt, Jonas',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(5,1,'E','A',1,7,'Hofmann, Peter',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(6,1,'E','A',2,9,'Weber, Markus',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(7,1,'E','A',2,4,'Becker, Anna',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(8,1,'E','A',2,6,'Wagner, Lea',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(9,1,'E','A',2,10,'Fischer, Julia',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(10,1,'E','A',2,12,'Schulz, Laura',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(11,1,'E','B',1,22,'Huber, Martin',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(12,1,'E','B',1,17,'Dietrich, Nina',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(13,1,'E','B',1,24,'Keller, Thomas',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(14,1,'E','B',1,23,'Jäger, Lena',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(15,1,'E','B',1,18,'Engel, Oliver',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(16,1,'E','B',2,15,'Bauer, Miriam',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(17,1,'E','B',2,19,'Frank, Katrin',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(18,1,'E','B',2,21,'Hahn, Sophie',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(19,1,'E','B',2,16,'Brandt, Stefan',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(20,1,'E','B',2,20,'Graf, Daniel',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(21,1,'E','C',1,29,'Möller, Paula',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(22,1,'E','C',1,33,'Roth, Clara',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(23,1,'E','C',1,28,'Maier, Christian',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(24,1,'E','C',1,34,'Sauer, Sebastian',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(25,1,'E','C',1,27,'Lorenz, Hanna',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(26,1,'E','C',2,30,'Nagel, Andreas',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(27,1,'E','C',2,26,'Lang, Michael',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(28,1,'E','C',2,31,'Otto, Emma',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(29,1,'E','C',2,25,'König, Sarah',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(30,1,'E','C',2,32,'Peters, Florian',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(31,1,'E','D',1,36,'Schreiber, Philipp',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(32,1,'E','D',1,39,'Vogel, Katharina',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(33,1,'E','D',1,37,'Seidel, Johanna',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(34,1,'E','D',1,38,'Simon, Dominik',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(35,1,'E','D',1,40,'Walter, Tim',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(36,1,'E','D',2,42,'Wolf, Moritz',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(37,1,'E','D',2,43,'Ziegler, Elena',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(38,1,'E','D',2,35,'Schäfer, Marie',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(39,1,'E','D',2,41,'Winkler, Lisa',NULL);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(40,1,'D','A+B',2,5,'Schmitt, J. / Brandt, S.',16);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(41,1,'D','A+B',2,4,'Becker, A. / Frank, K.',19);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(42,1,'D','A+B',1,3,'Adler, F. / Graf, D.',20);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(43,1,'D','A+B',1,9,'Weber, M. / Bauer, M.',15);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(44,1,'D','A+B',1,6,'Wagner, L. / Dietrich, N.',17);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(45,1,'D','A+B',2,7,'Hofmann, P. / Engel, O.',18);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(46,1,'D','C+D',2,26,'Lang, M. / Simon, D.',38);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(47,1,'D','C+D',1,28,'Maier, C. / Vogel, K.',39);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(48,1,'D','C+D',1,27,'Lorenz, H. / Seidel, J.',37);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(49,1,'D','C+D',1,25,'König, S. / Schäfer, M.',35);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(50,1,'D','C+D',2,30,'Nagel, A. / Walter, T.',40);
INSERT INTO "tu_team"(id, season_id, comp, league, group_no, p1, name, p2) VALUES(51,1,'D','C+D',2,29,'Möller, P. / Schreiber, P.',36);
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(1,1,'E','A','gruppe',1,0,1,2,'normal','[[6,3],[6,4]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(2,1,'E','A','gruppe',1,0,1,3,'normal','[[4,6],[6,3],[7,10]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(3,1,'E','A','gruppe',1,0,1,4,'normal','[[5,7],[2,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(4,1,'E','A','gruppe',1,0,1,5,'normal','[[6,2],[6,1]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(5,1,'E','A','gruppe',1,0,2,3,'normal','[[6,7],[6,4],[8,10]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(6,1,'E','A','gruppe',1,0,2,4,'normal','[[4,6],[5,7]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(7,1,'E','A','gruppe',1,0,2,5,'normal','[[3,6],[4,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(8,1,'E','A','gruppe',1,0,3,4,'normal','[[6,4],[3,6],[10,7]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(9,1,'E','A','gruppe',1,0,3,5,'normal','[[7,5],[6,2]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(10,1,'E','A','gruppe',1,0,4,5,'normal','[[6,2],[6,1]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(11,1,'E','A','gruppe',2,0,6,7,'normal','[[6,7],[6,4],[8,10]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(12,1,'E','A','gruppe',2,0,6,8,'normal','[[4,6],[5,7]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(13,1,'E','A','gruppe',2,0,6,9,'normal','[[6,3],[6,4]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(14,1,'E','A','gruppe',2,0,6,10,'normal','[[4,6],[6,3],[7,10]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(15,1,'E','A','gruppe',2,0,7,8,'normal','[[7,5],[6,2]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(16,1,'E','A','gruppe',2,0,7,9,'normal','[[6,2],[6,1]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(17,1,'E','A','gruppe',2,0,7,10,'normal','[[7,6],[4,6],[10,8]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(18,1,'E','A','gruppe',2,0,8,9,'normal','[[6,4],[7,5]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(19,1,'E','A','gruppe',2,0,8,10,'normal','[[3,6],[4,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(20,1,'E','A','gruppe',2,0,9,10,'normal','[[6,4],[3,6],[10,7]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(21,1,'E','B','gruppe',1,0,11,12,'normal','[[5,7],[2,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(22,1,'E','B','gruppe',1,0,11,13,'wo','[]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(23,1,'E','B','gruppe',1,0,11,14,'normal','[[7,6],[4,6],[10,8]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(24,1,'E','B','gruppe',1,0,11,15,'normal','[[6,4],[7,5]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(25,1,'E','B','gruppe',1,0,12,13,'normal','[[6,3],[6,4]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(26,1,'E','B','gruppe',1,0,12,14,'normal','[[6,4],[3,6],[10,7]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(27,1,'E','B','gruppe',1,0,12,15,'normal','[[7,5],[6,2]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(28,1,'E','B','gruppe',1,0,13,14,'normal','[[2,6],[1,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(29,1,'E','B','gruppe',1,0,13,15,'normal','[[7,6],[4,6],[10,8]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(30,1,'E','B','gruppe',1,0,14,15,'normal','[[4,6],[5,7]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(31,1,'E','B','gruppe',2,0,16,17,'normal','[[6,3],[6,4]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(32,1,'E','B','gruppe',2,0,16,18,'normal','[[6,4],[3,6],[10,7]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(33,1,'E','B','gruppe',2,0,16,19,'normal','[[7,5],[6,2]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(34,1,'E','B','gruppe',2,0,16,20,'normal','[[2,6],[1,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(35,1,'E','B','gruppe',2,0,17,18,'normal','[[7,6],[4,6],[10,8]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(36,1,'E','B','gruppe',2,0,17,19,'normal','[[4,6],[5,7]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(37,1,'E','B','gruppe',2,0,17,20,'normal','[[6,3],[6,4]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(38,1,'E','B','gruppe',2,0,18,19,'normal','[[4,6],[6,3],[7,10]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(39,1,'E','B','gruppe',2,0,18,20,'wo','[]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(40,1,'E','B','gruppe',2,0,19,20,'normal','[[6,2],[6,1]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(41,1,'E','C','gruppe',1,0,21,22,'normal','[[7,6],[4,6],[10,8]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(42,1,'E','C','gruppe',1,0,21,23,'normal','[[4,6],[5,7]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(43,1,'E','C','gruppe',1,0,21,24,NULL,'[]',NULL,NULL,NULL,NULL,'2026-10-23','17:00',NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(44,1,'E','C','gruppe',1,0,21,25,'normal','[[3,6],[4,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(45,1,'E','C','gruppe',1,0,22,23,'normal','[[6,4],[3,6],[10,7]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(46,1,'E','C','gruppe',1,0,22,24,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(47,1,'E','C','gruppe',1,0,22,25,'normal','[[5,7],[2,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(48,1,'E','C','gruppe',1,0,23,24,'normal','[[6,2],[6,1]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(49,1,'E','C','gruppe',1,0,23,25,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(50,1,'E','C','gruppe',1,0,24,25,'normal','[[6,7],[6,4],[8,10]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(51,1,'E','C','gruppe',2,0,26,27,'normal','[[4,6],[5,7]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(52,1,'E','C','gruppe',2,0,26,28,NULL,'[]',NULL,NULL,NULL,NULL,'2026-10-25','10:00',NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(53,1,'E','C','gruppe',2,0,26,29,'normal','[[6,3],[6,4]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(54,1,'E','C','gruppe',2,0,26,30,'normal','[[6,4],[3,6],[10,7]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(55,1,'E','C','gruppe',2,0,27,28,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(56,1,'E','C','gruppe',2,0,27,29,'normal','[[5,7],[2,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(57,1,'E','C','gruppe',2,0,27,30,'normal','[[6,2],[6,1]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(58,1,'E','C','gruppe',2,0,28,29,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(59,1,'E','C','gruppe',2,0,28,30,'normal','[[7,6],[4,6],[10,8]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(60,1,'E','C','gruppe',2,0,29,30,'normal','[[4,6],[5,7]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(61,1,'E','D','gruppe',1,0,31,32,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(62,1,'E','D','gruppe',1,0,31,33,'normal','[[6,3],[6,4]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(63,1,'E','D','gruppe',1,0,31,34,'wo','[]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(64,1,'E','D','gruppe',1,0,31,35,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(65,1,'E','D','gruppe',1,0,32,33,'normal','[[5,7],[2,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(66,1,'E','D','gruppe',1,0,32,34,'normal','[[2,6],[1,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(67,1,'E','D','gruppe',1,0,32,35,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(68,1,'E','D','gruppe',1,0,33,34,'normal','[[6,7],[6,4],[8,10]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(69,1,'E','D','gruppe',1,0,33,35,'normal','[[6,4],[7,5]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(70,1,'E','D','gruppe',1,0,34,35,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(71,1,'E','D','gruppe',2,0,36,37,'normal','[[6,3],[6,4]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(72,1,'E','D','gruppe',2,0,36,38,'normal','[[4,6],[6,3],[7,10]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(73,1,'E','D','gruppe',2,0,36,39,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(74,1,'E','D','gruppe',2,0,37,38,'normal','[[5,7],[2,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(75,1,'E','D','gruppe',2,0,37,39,'normal','[[6,2],[6,1]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(76,1,'E','D','gruppe',2,0,38,39,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(77,1,'D','A+B','gruppe',1,0,42,43,'normal','[[6,4],[6,3]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(78,1,'D','A+B','gruppe',1,0,42,44,'normal','[[3,6],[6,4],[7,10]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(79,1,'D','A+B','gruppe',1,0,43,44,'normal','[[6,4],[6,3]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(80,1,'D','A+B','gruppe',2,0,40,41,'normal','[[6,4],[6,3]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(81,1,'D','A+B','gruppe',2,0,40,45,'normal','[[3,6],[6,4],[7,10]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(82,1,'D','A+B','gruppe',2,0,41,45,'normal','[[6,4],[6,3]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(83,1,'D','C+D','gruppe',1,0,47,48,'normal','[[4,6],[2,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(84,1,'D','C+D','gruppe',1,0,47,49,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(85,1,'D','C+D','gruppe',1,0,48,49,'normal','[[6,2],[6,4]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(86,1,'D','C+D','gruppe',2,0,46,50,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(87,1,'D','C+D','gruppe',2,0,46,51,'normal','[[4,6],[2,6]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(88,1,'D','C+D','gruppe',2,0,50,51,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(89,1,'E','A','halbfinale',NULL,1,3,10,NULL,'[]',NULL,NULL,NULL,NULL,'2026-10-22','18:00',NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(90,1,'E','A','halbfinale',NULL,2,7,4,'normal','[[6,4],[3,6],[10,6]]','a',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(91,1,'E','A/B','relegation',NULL,1,2,19,'normal','[[4,6],[6,3],[8,10]]','b',NULL,'Adminkonto','2026-10-21 12:21:37',NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(92,1,'E','A/B','relegation',NULL,2,9,12,NULL,'[]',NULL,NULL,NULL,NULL,'2026-10-22','17:00','19:00','Platz 2',4,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(93,1,'D','A+B','halbfinale',NULL,1,42,41,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_match"(id, season_id, comp, league, phase, group_no, slot, a, b, result, sets, winner, retired, entered_by, entered_at, plan_date, plan_time, plan_end, court, booking_id, due_sent, created_at) VALUES(94,1,'D','A+B','halbfinale',NULL,2,40,43,NULL,'[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-10-21 12:21:37');
INSERT INTO "tu_honor"(id, season_id, year, title, names, created_by, created_at) VALUES(1,NULL,'2025','Clubmeister Einzel','Jonas Schmitt','Adminkonto','2026-10-21 12:21:37');
INSERT INTO "tu_honor"(id, season_id, year, title, names, created_by, created_at) VALUES(2,NULL,'2025','Clubmeister Doppel A+B','Anna Becker/Stefan Brandt','Adminkonto','2026-10-21 12:21:37');
INSERT INTO "tu_honor"(id, season_id, year, title, names, created_by, created_at) VALUES(3,NULL,'2025','Clubmeister Doppel C+D','Sarah König/Tim Walter','Adminkonto','2026-10-21 12:21:37');
INSERT INTO "tu_honor"(id, season_id, year, title, names, created_by, created_at) VALUES(4,NULL,'2024','Clubmeister Einzel','Felix Adler','Adminkonto','2026-10-21 12:21:37');
INSERT INTO "tu_honor"(id, season_id, year, title, names, created_by, created_at) VALUES(5,NULL,'2024','Clubmeister Doppel A+B','Lea Wagner/Miriam Bauer','Adminkonto','2026-10-21 12:21:37');
INSERT INTO "tu_honor"(id, season_id, year, title, names, created_by, created_at) VALUES(6,NULL,'2023','Clubmeister Einzel','Peter Hofmann','Adminkonto','2026-10-21 12:21:37');
INSERT INTO "bk_label" VALUES(6,'Clubmeisterschaft','#8a4fd6',90,1,'verwaltung','[]','[]',1);
INSERT INTO "bk_booking"(id, resource_id, date, start, end, type, member_id, partners, guests, fee_cents, charge_id, series_id, title, note, status, source, created_by, created_at, cancelled_at, cancelled_by, cancel_reason, booked_by_id, label_id, partner_device_id, solo, ext_key, reminded) VALUES(4,2,'2026-10-22','17:00','19:00','buchung',10,'[17]','[]',0,NULL,NULL,'Clubmeisterschaft: Julia Fischer gegen Nina Dietrich – Relegation A/B',NULL,'aktiv','verwaltung','Julia Fischer','2026-10-14 19:12:00',NULL,NULL,NULL,NULL,6,NULL,0,'tu:92',0);
DELETE FROM sqlite_sequence WHERE name='bk_booking'; INSERT INTO sqlite_sequence VALUES('bk_booking',4);
DELETE FROM sqlite_sequence WHERE name='bk_label'; INSERT INTO sqlite_sequence VALUES('bk_label',6);
DELETE FROM sqlite_sequence WHERE name='tu_season'; INSERT INTO sqlite_sequence VALUES('tu_season',1);
DELETE FROM sqlite_sequence WHERE name='tu_team'; INSERT INTO sqlite_sequence VALUES('tu_team',51);
DELETE FROM sqlite_sequence WHERE name='tu_match'; INSERT INTO sqlite_sequence VALUES('tu_match',94);
DELETE FROM sqlite_sequence WHERE name='tu_honor'; INSERT INTO sqlite_sequence VALUES('tu_honor',6);
-- Turniertag (LK-Turniere): erfundene Spieler aus werkzeuge/tests/fixtures/nuliga – Stand „11:00 Uhr“ (laden.js verschiebt die Uhrzeiten auf jetzt)
CREATE TABLE IF NOT EXISTS tu_day ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, date_from TEXT NOT NULL, date_to TEXT NOT NULL, club_no TEXT, sources TEXT NOT NULL DEFAULT '[]', lock_from TEXT, lock_to TEXT, locked INTEGER NOT NULL DEFAULT 0, finished_at TEXT, purged_at TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')) );
INSERT INTO "tu_day"(id, name, date_from, date_to, club_no, sources, lock_from, lock_to, locked, finished_at, purged_at, created_by, created_at) VALUES(1,'LK-Tagesturnier Herbst (Beispiel) / LK-Doppelturnier Herbst (Beispiel)','2026-10-21','2026-10-22','12345','[{"ext":"T7001","name":"LK-Tagesturnier Herbst (Beispiel)","file":"TurnierExport_beispiel_samstag.xml","at":"2026-10-21 13:14:57"},{"ext":"T7002","name":"LK-Doppelturnier Herbst (Beispiel)","file":"TurnierExport_beispiel_sonntag.xml","at":"2026-10-27 13:14:57"}]',NULL,NULL,0,NULL,NULL,'Adminkonto','2026-10-21 13:14:57');
CREATE TABLE IF NOT EXISTS tu_event ( id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER NOT NULL, ext TEXT NOT NULL, tournament TEXT, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'einzel', gender TEXT, age TEXT, fee_cents INTEGER NOT NULL DEFAULT 0, scoring TEXT, consolation TEXT, mode TEXT, sort INTEGER NOT NULL DEFAULT 0, gone INTEGER NOT NULL DEFAULT 0 );
INSERT INTO "tu_event"(id, day_id, ext, tournament, name, kind, gender, age, fee_cents, scoring, consolation, mode, sort, gone) VALUES(1,1,'T7001:E1','LK-Tagesturnier Herbst (Beispiel)','Herren Einzel','einzel','m','open',2500,'CT_2S6G_MTB10','match1','one-day-tournament',0,0);
INSERT INTO "tu_event"(id, day_id, ext, tournament, name, kind, gender, age, fee_cents, scoring, consolation, mode, sort, gone) VALUES(2,1,'T7001:E2','LK-Tagesturnier Herbst (Beispiel)','Damen Einzel','einzel','w','open',2500,'CT_2S6G_MTB10',NULL,'one-day-tournament',1,0);
INSERT INTO "tu_event"(id, day_id, ext, tournament, name, kind, gender, age, fee_cents, scoring, consolation, mode, sort, gone) VALUES(3,1,'T7002:E9','LK-Doppelturnier Herbst (Beispiel)','Herren Doppel','doppel','m',NULL,1500,'CT_2S6G_MTB10',NULL,'knock-out',100,0);
CREATE TABLE IF NOT EXISTS tu_person ( id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER NOT NULL, ext TEXT, first TEXT, last TEXT NOT NULL, club TEXT, club_no TEXT, lk TEXT, gender TEXT, birth_year TEXT, dtb TEXT, own INTEGER NOT NULL DEFAULT 0, token TEXT, checked_in_at TEXT, absent INTEGER NOT NULL DEFAULT 0, pay_hint TEXT, paid TEXT, paid_cents INTEGER, paid_at TEXT, paid_by TEXT, gone INTEGER NOT NULL DEFAULT 0 );
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(1,1,'900101','Felix','Adler','TC Grün-Weiß Musterstadt','12345','16,1','m','1988','1900101',1,'0oLeH5NU1ktAy68LdM40vhTX6QhF21MB','2026-10-21 08:40:00',0,'bar','bar',4000,'2026-10-21 08:41:00','Adminkonto',0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(2,1,'900102','Jonas','Brenner','TV Beispielhausen','23456','12,4','m','1995','1900102',0,'FfPBBIn4BhfQEsp_RJsaFzPSzc4Y_AN1','2026-10-21 08:40:00',0,NULL,'digital',4000,'2026-10-21 08:41:00','Adminkonto',0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(3,1,'900103','Malte','Cordes','TC Rot-Weiß Probstadt','34567','19,0','m','1979','1900103',0,'Ui97HeAjeMHtUWrcA9Fr0re_X6F0pRiV','2026-10-21 08:40:00',0,'bar','bar',2500,'2026-10-21 08:41:00','Adminkonto',0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(4,1,'900104','Ole','Dietrich','TC Grün-Weiß Musterstadt','12345','14,7','m','2001','1900104',1,'bLzn1MADCMvkjO8eurYXDgCN97zrNUV-','2026-10-21 08:40:00',0,NULL,'bar',2500,'2026-10-21 08:41:00','Adminkonto',0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(5,1,'900105','Paul','Engel','SV Musterdorf','45678','21,3','m','1985','1900105',0,'t3XZ0xn75fwU6h_d86no7qhR8cPNpmFF','2026-10-21 08:40:00',0,NULL,NULL,NULL,NULL,NULL,0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(6,1,'900106','Rafael','Fink','TV Beispielhausen','23456','9,8','m','1992','1900106',0,'66KzpLJoF5Ya01-x52sxkhDIm5OZxeS9','2026-10-21 08:40:00',0,NULL,'digital',4000,'2026-10-21 08:41:00','Adminkonto',0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(7,1,'900107','Simon','Gerber','TC Blau-Gelb Testheim','56789','17,2','m','1999','1900107',0,'qneNmGoeKEIWCzMpyPOuB4-kztWeRfQA','2026-10-21 08:40:00',0,NULL,NULL,NULL,NULL,NULL,0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(8,1,'900108','Tim','Hartwig','TC Rot-Weiß Probstadt','34567','23,5','m','1983','1900108',0,'oRFz5UaeKiz-E8cUvhnCKXyZyepGHunn','2026-10-21 08:40:00',0,NULL,NULL,NULL,NULL,NULL,0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(9,1,'900201','Anna','Imhof','TC Grün-Weiß Musterstadt','12345','15,6','w','1997','1900201',1,'qjnNfEmePlMTKS8tVosL1amlBUkX_ip6','2026-10-21 08:40:00',0,NULL,'bar',2500,'2026-10-21 08:41:00','Adminkonto',0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(10,1,'900202','Berit','Jansen','TC Blau-Gelb Testheim','56789','18,1','w','1990','1900202',0,'na3OnPVWr7-HqhGOOSIe2HgxOYqg88me','2026-10-21 08:40:00',0,'bar','bar',2500,'2026-10-21 08:41:00','Adminkonto',0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(11,1,'900203','Clara','Krämer','SV Musterdorf','45678','11,9','w','2003','1900203',0,'jLX9KjAUcQGKthmMIVUBxs6Q8U_eVOOh','2026-10-21 08:40:00',0,NULL,'digital',2500,'2026-10-21 08:41:00','Adminkonto',0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(12,1,'900204','Doris','Lorenz','TV Beispielhausen','23456','22,0','w','1975','1900204',0,'uXMSdOm0Om6QRSSNaY2rDN5FPNvYunmn','2026-10-21 08:40:00',1,NULL,NULL,NULL,NULL,NULL,0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(13,1,'900109','Uwe','Maurer','TC Blau-Gelb Testheim','56789','20','m','1970','1900109',0,'bKhgOvDMKT5-r9Tg0CfSunxZsDWT6uLF','2026-10-21 08:40:00',0,NULL,NULL,NULL,NULL,NULL,0);
INSERT INTO "tu_person"(id, day_id, ext, first, last, club, club_no, lk, gender, birth_year, dtb, own, token, checked_in_at, absent, pay_hint, paid, paid_cents, paid_at, paid_by, gone) VALUES(14,1,'900110','Vito','Nolte','SV Musterdorf','45678','18','m','1986','1900110',0,'cuddkl4v-WbHOZDVkmmLOuxvZ7221LZG','2026-10-21 08:40:00',0,NULL,NULL,NULL,NULL,NULL,0);
CREATE TABLE IF NOT EXISTS tu_entry ( id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER NOT NULL, event_id INTEGER NOT NULL, ext TEXT NOT NULL, p1 INTEGER, p2 INTEGER, note TEXT, status TEXT, seed INTEGER, gone INTEGER NOT NULL DEFAULT 0 );
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(1,1,1,'T7001:R101',1,NULL,'bitte nur vormittags','accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(2,1,1,'T7001:R102',2,NULL,NULL,'accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(3,1,1,'T7001:R103',3,NULL,'zeitgleich mit meiner Schwester (Damen Einzel)','accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(4,1,1,'T7001:R104',4,NULL,NULL,'accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(5,1,1,'T7001:R105',5,NULL,NULL,'accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(6,1,1,'T7001:R106',6,NULL,NULL,'accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(7,1,1,'T7001:R107',7,NULL,NULL,'accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(8,1,1,'T7001:R108',8,NULL,NULL,'accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(9,1,2,'T7001:R201',9,NULL,NULL,'accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(10,1,2,'T7001:R202',10,NULL,NULL,'accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(11,1,2,'T7001:R203',11,NULL,'Ankunft erst gegen 10 Uhr','accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(12,1,2,'T7001:R204',12,NULL,NULL,'accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(13,1,3,'T7002:R901',1,2,NULL,'accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(14,1,3,'T7002:R902',5,6,'erst ab 11 Uhr','accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(15,1,3,'T7002:R903',7,8,NULL,'accepted',NULL,0);
INSERT INTO "tu_entry"(id, day_id, event_id, ext, p1, p2, note, status, seed, gone) VALUES(16,1,3,'T7002:R904',13,14,NULL,'accepted',NULL,0);
CREATE TABLE IF NOT EXISTS tu_court ( id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER NOT NULL, name TEXT NOT NULL, resource_id INTEGER, auto INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, manual INTEGER NOT NULL DEFAULT 0 );
INSERT INTO "tu_court"(id, day_id, name, resource_id, auto, sort, manual) VALUES(1,1,'Platz 1',NULL,1,1,0);
INSERT INTO "tu_court"(id, day_id, name, resource_id, auto, sort, manual) VALUES(2,1,'Platz 2',NULL,1,2,0);
INSERT INTO "tu_court"(id, day_id, name, resource_id, auto, sort, manual) VALUES(3,1,'Platz 3',NULL,1,3,0);
INSERT INTO "tu_court"(id, day_id, name, resource_id, auto, sort, manual) VALUES(4,1,'Platz 4',NULL,1,4,0);
INSERT INTO "tu_court"(id, day_id, name, resource_id, auto, sort, manual) VALUES(5,1,'Platz 5',NULL,1,5,0);
INSERT INTO "tu_court"(id, day_id, name, resource_id, auto, sort, manual) VALUES(6,1,'Platz 6',NULL,1,6,0);
CREATE TABLE IF NOT EXISTS tu_lkmatch ( id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER NOT NULL, event_id INTEGER NOT NULL, ext TEXT NOT NULL, round TEXT, no INTEGER NOT NULL DEFAULT 0, grp INTEGER NOT NULL DEFAULT 0, a INTEGER, b INTEGER, plan_court TEXT, plan_time TEXT, court_id INTEGER, time TEXT, started_at TEXT, ended_at TEXT, result TEXT, sets TEXT NOT NULL DEFAULT '[]', winner TEXT, retired TEXT, entered_by TEXT, entered_at TEXT, scoring TEXT, gone INTEGER NOT NULL DEFAULT 0 );
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(1,1,1,'T7001:M1101','1',1,0,1,8,'Platz 1','2026-10-21 09:00',1,'2026-10-21 09:00','2026-10-21 09:02:00','2026-10-21 10:25:00','normal','[[6,4],[6,3]]','a',NULL,'Adminkonto','2026-10-21 10:27:00','CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(2,1,1,'T7001:M1102','1',2,0,2,7,'Platz 2','2026-10-21 09:00',2,'2026-10-21 09:00','2026-10-21 09:05:00','2026-10-21 10:48:00','normal','[[4,6],[6,3],[10,7]]','a',NULL,'Adminkonto','2026-10-21 10:50:00','CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(3,1,1,'T7001:M1103','1',3,0,3,6,'Platz 3','2026-10-21 09:00',3,'2026-10-21 09:00','2026-10-21 10:20:00',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(4,1,1,'T7001:M1104','1',4,0,4,5,'Platz 4','2026-10-21 09:00',4,'2026-10-21 09:00','2026-10-21 09:06:00',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(5,1,1,'T7001:M1201','2',1,0,1,2,'Platz 1','2026-10-21 11:00',1,'2026-10-21 11:00',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(6,1,1,'T7001:M1202','2',2,0,NULL,NULL,'Platz 2','2026-10-21 11:00',2,'2026-10-21 11:00',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(7,1,1,'T7001:M1203','2',3,1,8,7,'Platz 3','2026-10-21 11:00',3,'2026-10-21 11:00',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(8,1,1,'T7001:M1204','2',4,1,NULL,NULL,'Platz 4','2026-10-21 11:00',4,'2026-10-21 11:00',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(9,1,2,'T7001:M2101','1',1,0,9,12,'Platz 5','2026-10-21 09:00',5,'2026-10-21 09:00','2026-10-21 09:03:00','2026-10-21 10:12:00','normal','[[6,2],[6,1]]','a',NULL,'Adminkonto','2026-10-21 10:14:00','CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(10,1,2,'T7001:M2102','1',2,0,10,11,'Platz 6','2026-10-21 10:30',6,'2026-10-21 10:30','2026-10-21 10:38:00',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(11,1,2,'T7001:M2201','2',1,0,NULL,NULL,'Platz 5','2026-10-21 12:00',5,'2026-10-21 12:00',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(12,1,2,'T7001:M2202','2',2,1,NULL,NULL,'Platz 6','2026-10-21 12:00',6,'2026-10-21 12:00',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(13,1,3,'T7002:M9101','1',1,0,13,16,'Platz 1','2026-10-22 10:00',1,'2026-10-22 10:00',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(14,1,3,'T7002:M9102','1',2,0,14,15,'Platz 2','2026-10-22 11:00',2,'2026-10-22 11:00',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
INSERT INTO "tu_lkmatch"(id, day_id, event_id, ext, round, no, grp, a, b, plan_court, plan_time, court_id, time, started_at, ended_at, result, sets, winner, retired, entered_by, entered_at, scoring, gone) VALUES(15,1,3,'T7002:M9201','2',1,0,NULL,NULL,'Platz 1','2026-10-22 13:00',1,'2026-10-22 13:00',NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'CT_2S6G_MTB10',0);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tu_person_token ON tu_person(token);
CREATE INDEX IF NOT EXISTS ix_tu_person ON tu_person(day_id, ext);
CREATE INDEX IF NOT EXISTS ix_tu_lkmatch ON tu_lkmatch(day_id, event_id);
COMMIT;
