-- Buchungsseite für Gäste: Datenbank (Cloudflare D1). Kennt nur freie Zeiten, Preise und Gastbuchungen – keine Mitgliederdaten.
CREATE TABLE IF NOT EXISTS einstellung (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
-- Plätze, die der Verein für Gäste freigibt (kommt bei jedem Abgleich von Clubwerk)
CREATE TABLE IF NOT EXISTS platz (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  minuten INTEGER NOT NULL,
  preis INTEGER NOT NULL           -- Cent je Buchung (Preis je Stunde × Dauer, rechnet Clubwerk)
);
-- freie Zeiten (ersetzt bei jedem Abgleich)
CREATE TABLE IF NOT EXISTS zeit (
  platz INTEGER NOT NULL,
  datum TEXT NOT NULL,             -- JJJJ-MM-TT (Ortszeit des Vereins)
  beginn TEXT NOT NULL,            -- HH:MM
  ende TEXT NOT NULL,
  ab INTEGER NOT NULL,             -- Beginn in ms seit 1970 (rechnet Clubwerk in Ortszeit)
  PRIMARY KEY (platz, datum, beginn)
);
CREATE TABLE IF NOT EXISTS buchung (
  ref TEXT PRIMARY KEY,            -- Buchungsnummer, zugleich custom_id und invoice_id bei PayPal
  platz INTEGER NOT NULL,
  platz_name TEXT NOT NULL,
  datum TEXT NOT NULL,
  beginn TEXT NOT NULL,
  ende TEXT NOT NULL,
  ab INTEGER NOT NULL,
  betrag INTEGER NOT NULL,         -- Cent
  waehrung TEXT NOT NULL DEFAULT 'EUR',
  vorname TEXT NOT NULL DEFAULT '',
  nachname TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefon TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,            -- reserviert | bezahlt | vorlaeufig | abgelehnt | abgelaufen | storno_angefragt | erstattet | erstattung_laeuft | erstattung_fehler
  halten_bis INTEGER NOT NULL,     -- ms: so lange ist die Zeit während der Zahlung reserviert
  order_id TEXT,
  capture_id TEXT,
  refund_id TEXT,
  weg TEXT NOT NULL DEFAULT 'sdk', -- sdk (Knöpfe auf der Seite) | weiterleitung (Handy: Weiterleitung zu PayPal)
  verein TEXT,                     -- Rückmeldung von Clubwerk: eingetragen | belegt | abweichung | storniert | erledigt
  verein_grund TEXT,               -- Grund einer Stornierung durch den Verein
  version INTEGER NOT NULL DEFAULT 1,      -- zählt bei jeder Änderung hoch
  gemeldet INTEGER NOT NULL DEFAULT 0,     -- höchste Version, die Clubwerk bestätigt hat
  fehler TEXT,
  erstellt INTEGER NOT NULL,
  bezahlt_am INTEGER,
  storno_am INTEGER
);
CREATE INDEX IF NOT EXISTS ix_buchung_zeit ON buchung(platz, datum, beginn, status);
CREATE INDEX IF NOT EXISTS ix_buchung_offen ON buchung(gemeldet, version);
CREATE INDEX IF NOT EXISTS ix_buchung_order ON buchung(order_id);
-- Schutz gegen wiederholte Anfragen (Replay): jede Nonce von Clubwerk nur einmal
CREATE TABLE IF NOT EXISTS nonce (
  n TEXT PRIMARY KEY,
  bis INTEGER NOT NULL
);
-- Webhooks von PayPal nur einmal verarbeiten
CREATE TABLE IF NOT EXISTS ereignis (
  id TEXT PRIMARY KEY,
  bis INTEGER NOT NULL
);
-- Bremse je Absenderadresse (Reservieren, Storno)
CREATE TABLE IF NOT EXISTS bremse (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  bis INTEGER NOT NULL
);
