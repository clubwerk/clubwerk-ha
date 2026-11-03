'use strict';
/* Sicherheitswarnungen („Sicherheit & Betrieb“, planung/sicherheitswarnungen.md):
   Aufruf mit Art, Text und { key, member } – die Art steht im Katalog (Kern unten, Module über hooks.securityEvents)
   und bestimmt die Stufe:
     r = sofort: Push (Anlass app.sicherheit) und E-Mail an alle mit dem Recht „Sicherheitswarnungen“, höchstens 1× je Stunde
         und Eintrag, höchstens 10 am Tag (danach ein letzter Hinweis) – auch nachts (Entscheidung Thorsten 03.11.2026)
     a = Tagesmail um 7 Uhr (nur an Tagen mit neuen Warnungen)
     i = nur Liste und Protokoll
   Gleiche Art + Schlüssel bündelt (Zähler, auch über Neustarts) in sec_alerts, bis jemand „Erledigt“ drückt.
   Immer zusätzlich ein Protokolleintrag. Push enthält nur den festen Satz der Art – nie Namen, IP oder Gerät. */
const { db, getSetting, setSetting, audit } = require('./db');

db.exec(`CREATE TABLE IF NOT EXISTS sec_alerts (
  id        INTEGER PRIMARY KEY,
  kind      TEXT NOT NULL,                 -- Art aus dem Katalog (z. B. login.viele, zugang.tueren)
  level     TEXT NOT NULL,                 -- r | a | i
  key       TEXT NOT NULL,                 -- Bündelung: Art + Schlüssel
  text      TEXT NOT NULL,
  n         INTEGER NOT NULL DEFAULT 1,
  member_id INTEGER,                       -- betroffenes Mitglied (Datenauskunft), falls bekannt
  first_at  TEXT NOT NULL,
  last_at   TEXT NOT NULL,
  sent_at   TEXT,                          -- letzte Sofortmeldung
  done_at   TEXT,
  done_by   TEXT
);
CREATE INDEX IF NOT EXISTS ix_sec_open ON sec_alerts(key, done_at);`);

/* Katalog des Kerns: id → [Bezeichnung, Stufe, fester Satz für den Push] */
const CORE = {
  'login.viele': ['Viele falsche Passwörter (Verwaltung)', 'r', 'Viele falsche Passwörter bei der Anmeldung zur Verwaltung.'],
  'login.geraet': ['Anmeldung von einem neuen Gerät', 'a', 'Anmeldung zur Verwaltung von einem neuen Gerät.'],
  'tablet.passwort': ['Viele falsche Tablet-Passwörter', 'r', 'Viele falsche Passwörter am Tablet.'],
  'tablet.pins': ['Viele falsche PINs am Tablet', 'r', 'Viele falsche Mitglieder-PINs am Tablet.'],
  'app.gesperrt': ['Handy wegen falscher PINs gesperrt', 'r', 'Ein Handy wurde wegen falscher PINs gesperrt.'],
  'app.einladung': ['Einladung doppelt geöffnet', 'r', 'Eine schon eingelöste Einladung wurde erneut geöffnet.'],
  'netz.oeffentlich': ['Anfrage aus dem Internet abgewiesen', 'r', 'Eine Anfrage aus dem Internet wurde abgewiesen – ist ein Port am Router offen?'],
  'netz.tunnel': ['Viele abgewiesene Tunnel-Anfragen', 'a', 'Viele Anfragen über den Tunnel wurden abgewiesen.'],
  'benutzer.rechte': ['Benutzer oder Rechte geändert', 'a', 'Benutzer oder Rechte der Verwaltung wurden geändert.'],
  'benutzer.alle': ['„Alle Rechte“ vergeben', 'r', 'Ein Benutzer hat „alle Rechte“ bekommen.'],
  'benutzer.passwort': ['Passwort geändert', 'a', 'Ein Passwort der Verwaltung wurde geändert.'],
  'notfall': ['Notfall-Passwort gesetzt', 'r', 'Das Notfall-Passwort wurde gesetzt.'],
  'tresor.aus': ['Tresor ausgeschaltet', 'r', 'Die Verschlüsselung der persönlichen Daten wurde ausgeschaltet.'],
  'tresor.code': ['Tresor mit Wiederherstellungscode', 'r', 'Der Tresor wurde mit dem Wiederherstellungscode geöffnet oder ein falscher Code eingegeben.'],
  'tresor.neu': ['Neuer Wiederherstellungscode', 'i', 'Ein neuer Wiederherstellungscode wurde erzeugt.'],
  'sicherung.ziel': ['Sicherungsziel geändert', 'r', 'Ein Ziel der Datensicherung wurde geändert.'],
  'sicherung.passwort': ['Sicherungspasswort geändert', 'a', 'Das Sicherungspasswort wurde geändert.'],
  'sicherung.dropbox': ['Dropbox verbunden oder pausiert', 'i', 'Die Dropbox-Sicherung wurde geändert.'],
  'sicherung.fehler': ['Datensicherung fehlgeschlagen', 'r', 'Die Datensicherung ist fehlgeschlagen.'],
  'sicherung.alt': ['Keine Sicherung seit 48 Stunden', 'a', 'Seit über 48 Stunden gibt es keine erfolgreiche Datensicherung.'],
  'sicherung.probe': ['Probe-Wiederherstellung mit Befund', 'r', 'Die Probe-Wiederherstellung der Datensicherung hat etwas gefunden.'],
  'datenqualitaet': ['Fehler in den Daten', 'a', 'Die Prüfung der Daten hat Fehler gefunden.'],
  'speicher': ['Speicher fast voll', 'r', 'Der Speicher von Clubwerk ist fast voll.'],
  'speicher.knapp': ['Speicher wird knapp', 'a', 'Der Speicher von Clubwerk wird knapp.'],
  'update': ['Update eingespielt', 'i', 'Clubwerk wird aktualisiert.'],
  'erweiterung': ['Erweiterung hochgeladen oder freigegeben', 'r', 'Eine Erweiterung wurde hochgeladen oder freigegeben.'],
  'erweiterung.entfernt': ['Erweiterung entfernt', 'i', 'Eine Erweiterung wurde entfernt.'],
  'konto.verein': ['Konto kostenfrei gestellt', 'a', 'Ein Konto wurde auf „Verein (kostenfrei)“ umgestellt.'],
  'empfaenger': ['Empfänger der Warnungen geändert', 'a', 'Die zusätzlichen Adressen für Sicherheitswarnungen wurden geändert.'],
  'test': ['Testwarnung', 'r', 'Testwarnung – so sieht eine Sicherheitswarnung aus.'],
};
let modulesRef = () => [];   // vom Kern gesetzt (plugins.js): () => [[id, { name, hooks, isActive }]]
/** Alle Arten → [{ kind, label, level, push, module }] */
function catalog() {
  const out = Object.entries(CORE).map(([kind, [label, level, push]]) => ({ kind, label, level, push, module: '' }));
  for (const [id, m] of modulesRef()) {
    let ev = []; try { ev = m.hooks && typeof m.hooks.securityEvents === 'function' ? m.hooks.securityEvents() : []; } catch (e) { ev = []; }
    for (const e of ev || []) if (e && /^[a-z0-9_]{1,30}$/.test(String(e.id))) out.push({ kind: `${id}.${e.id}`, label: String(e.label || e.id), level: ['r', 'a', 'i'].includes(e.level) ? e.level : 'a', push: String(e.push || e.label || ''), module: id });
  }
  return out;
}
const kindOf = k => catalog().find(c => c.kind === k);

/** Keine Geheimnisse in Warnungen: Zugangsdaten in Adressen weg, lange Token-artige Zeichenfolgen gekürzt (die Request-Id eines Dienstes bleibt – sie braucht der Support) */
const clean = t => String(t == null ? '' : t)
  .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]*@/gi, '$1')
  .replace(/(?<!Request-Id )\b(?=[A-Za-z0-9+/_=-]*\d)(?=[A-Za-z0-9+/_=-]*[A-Za-z])([A-Za-z0-9+/_=-]{4})[A-Za-z0-9+/_=-]{20,}/g, '$1…')
  .slice(0, 400);

const stamp = (d = new Date()) => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const DAY_MAX = 10;

/** Empfänger: aktive Benutzer mit dem Recht „Sicherheitswarnungen“ (bei „alle Rechte“ automatisch) */
function recipients() {
  const auth = require('./auth');
  const hasMv = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'mv_person'").get());
  const locked = (() => { try { return require('./vault').locked(); } catch (e) { return false; } })();
  return db.prepare('SELECT * FROM admin_users WHERE active = 1').all().filter(u => auth.permInfo(u).perms.includes('sicherheit')).map(u => {
    let mail = '';
    if (u.member_id && hasMv && !locked) { const r = db.prepare('SELECT email FROM mv_person WHERE member_id = ?').get(u.member_id); mail = r && r.email && !/@clubwerk\.invalid$/i.test(r.email) ? r.email : ''; }
    let push = false; try { push = Boolean(u.member_id && db.prepare('SELECT 1 FROM push_subs WHERE member_id = ?').get(u.member_id)); } catch (e) { /* Push noch nicht eingerichtet */ }
    return { id: u.id, name: u.name || u.username, username: u.username, member_id: u.member_id || null, mail, push };
  });
}
const extraAddresses = () => String(getSetting('security_mail_to', '') || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
function mailTargets() {
  const mail = require('./mail');
  return [...new Set([...recipients().map(r => r.mail), ...extraAddresses()].filter(a => a && mail.mailOk(a)).map(a => a.toLowerCase()))];
}
function sendMail(subject, text) {
  try {
    const mail = require('./mail');
    if (!mail.ready() || !require('./vereinsname').isSet()) return 0;
    const to = mailTargets();
    for (const a of to) mail.send({ to: a, subject, text }).catch(e => console.error('Sicherheits-Mail:', e.message));
    return to.length;
  } catch (e) { console.error('Sicherheits-Mail:', e.message); return 0; }
}
function sendPush(body) {
  try {
    const ids = recipients().map(r => r.member_id).filter(Boolean);
    if (!ids.length) return;
    require('./push').send(ids, 'app.sicherheit', { title: `${getSetting('club_name', 'Verein')}: Sicherheitswarnung`, body, url: './', tag: 'sicherheit' }).catch(e => console.error('Sicherheits-Push:', e.message));
  } catch (e) { console.error('Sicherheits-Push:', e.message); }
}
/** Sofortmeldung mit Tagesgrenze: true, wenn gemeldet */
function immediate(c, text) {
  const today = stamp().slice(0, 10);
  const [d, n0] = String(getSetting('sec_sent_day', '') || '').split('|'); const n = d === today ? Number(n0) || 0 : 0;
  if (n > DAY_MAX) return false;
  setSetting('sec_sent_day', `${today}|${n + 1}`);
  const club = getSetting('club_name', 'Verein');
  if (n === DAY_MAX) {
    sendMail(`Sicherheitshinweis – Clubwerk (${club})`, `Hallo,\n\nheute gab es schon ${DAY_MAX} Sicherheitswarnungen. Weitere kommen heute nicht mehr einzeln – bitte in der Verwaltung unter Einstellungen › Sicherheit ansehen.\n\nAutomatisch versendet von Clubwerk.`);
    sendPush('Weitere Warnungen – bitte in der Verwaltung ansehen.');
    return true;
  }
  sendMail(`Sicherheitshinweis – Clubwerk (${club})`, `Hallo,\n\n${text}\n\nArt: ${c.label}\nZeit: ${new Date().toLocaleString('de-DE')}\n\nAlle Warnungen stehen in der Verwaltung unter Einstellungen › Sicherheit.\n\nAutomatisch versendet von Clubwerk.`);
  sendPush(c.push || c.label);
  return true;
}

/** Warnung melden. kind: Art aus dem Katalog; opts.key bündelt (gleiche Art + key = ein Eintrag mit Zähler), opts.member: betroffenes Mitglied */
function securityAlert(kind, text, opts = {}) {
  const t = clean(text);
  try { audit(null, 'Sicherheitswarnung', t); } catch (e) { /* Protokoll nicht verfügbar */ }
  try {
    const c = kindOf(kind) || { kind: String(kind).slice(0, 60), label: 'Sicherheitswarnung', level: 'a', push: 'Sicherheitswarnung – bitte in der Verwaltung ansehen.' };
    const key = `${c.kind}:${String(opts.key == null ? '' : opts.key).slice(0, 120)}`, now = stamp();
    const member = Number.isInteger(opts.member) ? opts.member : null;
    let row = db.prepare('SELECT * FROM sec_alerts WHERE key = ? AND done_at IS NULL ORDER BY id DESC LIMIT 1').get(key);
    if (row) db.prepare('UPDATE sec_alerts SET n = n + 1, last_at = ?, text = ?, level = ?, member_id = COALESCE(?, member_id) WHERE id = ?').run(now, t, c.level, member, row.id);
    else row = { id: Number(db.prepare('INSERT INTO sec_alerts(kind, level, key, text, member_id, first_at, last_at) VALUES (?,?,?,?,?,?,?)').run(c.kind, c.level, key, t, member, now, now).lastInsertRowid), sent_at: null };
    if (c.level === 'r' && (!row.sent_at || Date.now() - Date.parse(row.sent_at.replace(' ', 'T')) >= 3600000)) {
      if (immediate(c, t)) db.prepare('UPDATE sec_alerts SET sent_at = ? WHERE id = ?').run(now, row.id);
    }
    return row.id;
  } catch (e) { console.error('Sicherheitswarnung:', e.message); return null; }
}

/** Tagesmail (7 Uhr): neue gelbe und rote Einträge seit der letzten Tagesmail – nichts, wenn es keine gibt */
function digest() {
  const since = getSetting('sec_digest_at', '') || stamp(new Date(Date.now() - 86400000));
  const rows = db.prepare("SELECT * FROM sec_alerts WHERE level IN ('r','a') AND last_at > ? ORDER BY level DESC, last_at DESC").all(since);
  setSetting('sec_digest_at', stamp());
  if (!rows.length) return 0;
  const cat = new Map(catalog().map(c => [c.kind, c.label]));
  const lines = rows.map(r => `• ${r.last_at.slice(8, 10)}.${r.last_at.slice(5, 7)}. ${r.last_at.slice(11, 16)} – ${cat.get(r.kind) || 'Sicherheitswarnung'}${r.n > 1 ? ` (${r.n}×)` : ''}${r.level === 'r' ? ' [schon gemeldet]' : ''}${r.done_at ? ' [erledigt]' : ''}\n  ${r.text}`);
  return sendMail(`Sicherheit & Betrieb – Clubwerk (${getSetting('club_name', 'Verein')}): ${rows.length} ${rows.length === 1 ? 'Warnung' : 'Warnungen'}`,
    `Hallo,\n\nseit der letzten Zusammenfassung hat Clubwerk das bemerkt:\n\n${lines.join('\n\n')}\n\nAnsehen und als erledigt markieren: Verwaltung › Einstellungen › Sicherheit.\n\nAutomatisch versendet von Clubwerk.`);
}

/* ---------- Abfragen für Verwaltung, Löschlauf und Auskunft ---------- */
function listAlerts({ open = true, limit = 200 } = {}) {
  const cat = new Map(catalog().map(c => [c.kind, c.label]));
  return db.prepare(`SELECT id, kind, level, text, n, first_at, last_at, done_at, done_by FROM sec_alerts ${open ? 'WHERE done_at IS NULL' : ''} ORDER BY (done_at IS NULL) DESC, CASE level WHEN 'r' THEN 0 WHEN 'a' THEN 1 ELSE 2 END, last_at DESC LIMIT ?`).all(limit)
    .map(r => ({ ...r, label: cat.get(r.kind) || 'Sicherheitswarnung' }));
}
function done(id, user) {
  const who = (user && (user.name || user.username)) || '';
  const rows = id === 'alle' ? db.prepare('SELECT * FROM sec_alerts WHERE done_at IS NULL').all() : [db.prepare('SELECT * FROM sec_alerts WHERE id = ? AND done_at IS NULL').get(Number(id))].filter(Boolean);
  const st = db.prepare('UPDATE sec_alerts SET done_at = ?, done_by = ? WHERE id = ?');
  for (const r of rows) st.run(stamp(), who.slice(0, 60), r.id);
  if (rows.length) { const cat = new Map(catalog().map(c => [c.kind, c.label])); audit(user, 'Sicherheitswarnung erledigt', rows.length === 1 ? cat.get(rows[0].kind) || '' : `${rows.length} Warnungen`); }
  return rows.length;
}
const openCounts = () => db.prepare("SELECT SUM(level = 'r') r, SUM(level = 'a') a FROM sec_alerts WHERE done_at IS NULL").get();
const purgeCount = cut => db.prepare('SELECT COUNT(*) n FROM sec_alerts WHERE last_at < ?').get(cut).n;
const purge = cut => db.prepare('DELETE FROM sec_alerts WHERE last_at < ?').run(cut).changes;
const ofMember = id => db.prepare('SELECT last_at, text FROM sec_alerts WHERE member_id = ? ORDER BY last_at DESC').all(id);
const forgetMember = id => db.prepare('DELETE FROM sec_alerts WHERE member_id = ?').run(id).changes;

/** Fehlversuche mit wachsender Sperre: je 5 Fehler eine Pause, die sich jedes Mal verdoppelt (5 Min., 10, 20 … höchstens 24 Std.).
 *  Begrenzte Größe (älteste Einträge fallen heraus), damit niemand den Speicher füllen kann. */
function limiter({ per = 5, baseMs = 5 * 60000, maxMs = 24 * 3600000, size = 2000 } = {}) {
  const m = new Map();
  return {
    blocked(key) { const f = m.get(key); return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 60000) : 0; },
    fail(key) {
      const now = Date.now(); const f = m.get(key) || { n: 0, strikes: 0, until: 0 };
      f.n++; let locked = false;
      if (f.n >= per) { f.until = now + Math.min(baseMs * 2 ** f.strikes, maxMs); f.strikes++; f.n = 0; locked = true; }
      if (!m.has(key) && m.size >= size) {
        // laufende Sperren nie verdrängen – sonst hebt eine Flut erfundener Schlüssel jede Sperre auf
        let drop = null; for (const [k, v] of m) if (!(v.until > now)) { drop = k; break; }
        if (drop === null) return { locked: false, strikes: 0, minutes: 0 };   // voll mit Sperren: diesen Schlüssel nicht mitzählen
        m.delete(drop);
      }
      m.set(key, f);
      return { locked, strikes: f.strikes, minutes: locked ? Math.ceil((f.until - now) / 60000) : 0 };
    },
    ok(key) { m.delete(key); },
    /** Erfolg, aber die Sperrstufe bleibt: Fehlversuche fangen von vorn an, die nächste Sperre dauert trotzdem länger
     *  (sonst setzte jede richtige Eingabe des echten Nutzers die Bremse für jemanden zurück, der seine PIN durchprobiert) */
    soft(key) { const f = m.get(key); if (f) f.n = 0; },
  };
}
/** Kontingent je Schlüssel und Zeitfenster (z. B. 20 E-Mails je Mitglied und Stunde): take(key, n) → true, wenn n noch ins Fenster passt.
 *  Anders als limiter() ohne Sperr-Eskalation – nach Ablauf des Fensters zählt es einfach von vorn. Begrenzte Größe wie limiter(). */
function budget({ max = 20, windowMs = 3600000, size = 2000 } = {}) {
  const m = new Map();
  return {
    take(key, n = 1) {
      const now = Date.now(); let b = m.get(key);
      if (!b || b.reset < now) { m.delete(key); if (m.size >= size) m.delete(m.keys().next().value); b = { n: 0, reset: now + windowMs }; m.set(key, b); }
      if (b.n + n > max) return false;
      b.n += n; return true;
    },
    left(key) { const b = m.get(key); return !b || b.reset < Date.now() ? max : Math.max(0, max - b.n); },
  };
}
/** Gemeinsame Sicherheits-Header für alle Ports (Verwaltung/Tablet, Mitglieder-App, Beregnung) */
function hardenHeaders({ frame = 'SAMEORIGIN', camera = '' } = {}) {
  return (req, res, next) => {
    res.setHeader('X-Frame-Options', frame);   // Schutz gegen Einbetten in fremde Seiten (Klick-Fallen) – zusätzlich zu frame-ancestors
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', `camera=(${camera}), microphone=(), geolocation=(), payment=(), usb=()`);
    // HTTPS: Browser merken sich einen Tag lang, nur noch verschlüsselt zu verbinden (ohne Subdomains – Home Assistant selbst bleibt unberührt)
    if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=86400');
    // Antworten der Schnittstellen (Konten, Beträge, Namen) nie im Browser- oder Proxy-Zwischenspeicher ablegen
    if (/^\/api\//i.test(req.path)) res.setHeader('Cache-Control', 'no-store');
    next();
  };
}
/* Schutz gegen „DNS-Rebinding“: Eine fremde Webseite könnte ihren Namen auf die Adresse von Clubwerk im
   WLAN umbiegen und so aus dem Browser eines Mitglieds heraus Anfragen stellen. Deshalb werden nur Anfragen an bekannte
   Adressen beantwortet: IP-Adressen, Namen ohne Punkt (homeassistant), lokale Endungen (.local, .fritz.box …), die Namen
   aus dem HTTPS-Zertifikat, die eingetragenen App-Adressen und „Weitere Adressen“ (Einstellungen → Sicherheit). */
const LOCAL_SUFFIX = /\.(local|lan|home|internal|intern|localdomain|home\.arpa|fritz\.box|box|speedport\.ip|localhost)$/;
let hostCache = { at: 0, set: new Set() };
function certNames() {
  try {
    const f = process.env.SSL_CERT; if (!f) return [];
    const x = new (require('crypto').X509Certificate)(require('fs').readFileSync(f));
    return String(x.subjectAltName || '').split(',').map(t => t.trim()).filter(t => t.startsWith('DNS:')).map(t => t.slice(4).toLowerCase());
  } catch (e) { return []; }
}
const hostOf = u => { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ''; } };
function knownHosts() {
  if (Date.now() - hostCache.at < 30000) return hostCache.set;
  const set = new Set(certNames());
  for (const h of String(process.env.ALLOWED_HOSTS || '').split(/[\s,]+/)) if (h) set.add(h.toLowerCase());
  for (const h of String(getSetting('allowed_hosts', '')).split(/[\s,]+/)) if (h) set.add(h.toLowerCase());
  const a = hostOf(getSetting('app_url', '')); if (a) set.add(a);
  if (getSetting('ext_tunnel', '0') === '1') { const t = hostOf(getSetting('ext_tunnel_url', '')); if (t) set.add(t); }
  try { const b = hostOf(JSON.parse(getSetting('ext_beregnung_cfg', '{}')).webappUrl || ''); if (b) set.add(b); } catch (e) { /* */ }
  hostCache = { at: Date.now(), set };
  return set;
}
function hostAllowed(hostHeader) {
  let h = String(hostHeader || '').trim().toLowerCase();
  if (!h) return false;
  if (h.startsWith('[')) { const m = /^\[([0-9a-f:.]+)\](:\d+)?$/.exec(h); return Boolean(m) && require('net').isIPv6(m[1]); }   // gültige IPv6-Adresse
  h = h.replace(/:\d+$/, '').replace(/\.$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h.split('.').every(x => Number(x) <= 255 && !/^0\d/.test(x));   // gültige IPv4-Adresse (keine 999.…, keine führenden Nullen)
  if (!/^[a-z0-9.-]+$/.test(h)) return false;
  if (!h.includes('.') || h === 'localhost' || LOCAL_SUFFIX.test(h)) return true;
  if (/^[0-9a-f]{8}-[a-z0-9_-]+$/.test(h)) return true;              // interner Add-on-Name im Home-Assistant-Netz
  return knownHosts().has(h);
}
function hostGuard({ bypass } = {}) {
  return (req, res, next) => {
    if (hostAllowed(req.headers.host) || (bypass && bypass(req))) return next();
    const h = String(req.headers.host || '').slice(0, 100);
    const msg = `Unbekannte Adresse „${h}“.`;
    if (String(req.path || '').startsWith('/api/')) return res.status(421).json({ error: msg });   // Schnittstelle: immer JSON { error }
    res.status(421).type('text/plain; charset=utf-8').send(`${msg}\n\nAus Sicherheitsgründen antwortet Clubwerk nur unter bekannten Adressen. ` +
      'Bitte über die IP-Adresse oder die Home-Assistant-Seitenleiste öffnen und den Namen unter Einstellungen → Sicherheit → „Weitere Adressen“ eintragen.');
  };
}
const resetHostCache = () => { hostCache.at = 0; };

/* ---------- Nur aus dem eigenen Netz (Verwaltung/Tablet 3100, Beregnungs-Webapp 5000) ----------
   Diese Ports sind nie fürs Internet gedacht. Leitet ein Router sie versehentlich weiter, kommt die Anfrage mit einer
   öffentlichen Absenderadresse an – die wird hier abgewiesen, egal was in den Kopfzeilen steht (geprüft wird die echte
   Socket-Adresse). Erlaubt: Loopback, private IPv4-Netze (10/8, 172.16/12, 192.168/16), CGNAT/VPN (100.64/10, z. B. Tailscale),
   Link-Local, IPv6 ULA (fc00::/7) und Link-Local (fe80::/10). Öffentliche IPv6-Adressen (2000::/3) gelten als „eigenes Netz“
   nur, wenn sie in den eingetragenen Vereinsnetzen stehen – sonst nur aus dem gleichen /64-Präfix wie eine eigene Adresse. */
function v4Int(ip) { const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip); return m && m.slice(1).every(x => +x < 256) ? ((+m[1] << 24) >>> 0) + (+m[2] << 16) + (+m[3] << 8) + +m[4] : null; }
function inV4(ip, cidr) { const [n, b] = cidr.split('/'); const a = v4Int(ip), c = v4Int(n); if (a == null || c == null) return false; const bits = +b; return bits === 0 || (a >>> (32 - bits)) === (c >>> (32 - bits)); }
const normIp = ip => String(ip || '').trim().replace(/^::ffff:(?=\d+\.)/i, '').replace(/%.*$/, '').toLowerCase();
function privateSource(raw) {
  const ip = normIp(raw);
  if (!ip) return false;
  if (v4Int(ip) != null) return ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10', '169.254.0.0/16'].some(c => inV4(ip, c));
  if (ip === '::1') return true;
  return /^f[cd][0-9a-f]{2}:/.test(ip) || /^fe[89ab][0-9a-f]:/.test(ip);
}
function v6Prefix64(ip) {   // die ersten vier Blöcke einer (ggf. verkürzten) IPv6-Adresse
  const [h, t] = ip.split('::'); const a = h ? h.split(':') : [], b = t != null && t ? t.split(':') : [];
  const full = t != null ? [...a, ...Array(8 - a.length - b.length).fill('0'), ...b] : a;
  return full.length === 8 ? full.slice(0, 4).map(x => parseInt(x || '0', 16)).join(':') : null;
}
function ownV6Prefixes() {
  const out = new Set();
  try { for (const l of Object.values(require('os').networkInterfaces())) for (const a of l || []) if (a.family === 'IPv6' && /^[23]/.test(a.address)) { const p = v6Prefix64(a.address.toLowerCase()); if (p) out.add(p); } } catch (e) { /* */ }
  return out;
}
function lanSource(raw, { extra } = {}) {
  const ip = normIp(raw);
  if (!ip) return false;
  if (extra && extra(ip)) return true;
  if (/^127\./.test(ip) || ip === '::1') return true;
  // Sind Vereinsnetze eingetragen, gelten nur diese (plus Seitenleiste/Proxy über „extra“) – nicht mehr jedes private Netz
  let clubList = false;
  try { const ma = require('./memberapp'); clubList = ma.hasClubNets(); if (clubList) return ma.inClubNets(ip); } catch (e) { /* */ }
  if (privateSource(ip)) return true;
  if (/^[23][0-9a-f]{3}:/.test(ip)) {
    try { if (require('./memberapp').inClubNets(ip)) return true; } catch (e) { /* */ }
    const p = v6Prefix64(ip); if (p && ownV6Prefixes().has(p)) return true;
  }
  return false;
}
/** nicht aus dem Internet: private Adresse (auch Gast-WLAN, VPN) oder eine IPv6-Adresse aus dem eigenen Netz dieses Rechners */
function notPublic(raw) {
  const ip = normIp(raw);
  if (!ip) return false;
  if (privateSource(ip)) return true;
  if (/^[23][0-9a-f]{3}:/.test(ip)) { const p = v6Prefix64(ip); if (p && ownV6Prefixes().has(p)) return true; }
  return false;
}
/** Nie über den Cloudflare Tunnel: Anfragen mit cf-Kopfzeilen oder an die öffentliche Tunnel-Adresse abweisen (bypass: z. B. echte Seitenleiste) */
function noTunnel({ label = 'Clubwerk', msg = `${label} ist von außen nicht erreichbar.`, bypass } = {}) {
  return (req, res, next) => {
    const ext = getSetting('ext_tunnel', '0') === '1' ? (() => { try { return new URL(getSetting('ext_tunnel_url', '')).hostname; } catch (e) { return ''; } })() : '';
    const host = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
    if (!(req.get('cf-connecting-ip') || req.get('cf-ray') || (ext && host === ext)) || (bypass && bypass(req))) return next();
    if (String(req.path || '').startsWith('/api/')) return res.status(403).json({ error: msg });
    res.status(403).type('text/plain; charset=utf-8').send(msg + '\n\nÜber den Tunnel nur die Mitglieder-App freigeben (Port der Mitglieder-App).');
  };
}
function lanOnly({ label = 'Clubwerk', extra } = {}) {
  return (req, res, next) => {
    const ip = req.socket && req.socket.remoteAddress;
    if (lanSource(ip, { extra })) return next();
    securityAlert('netz.oeffentlich', `${label}: Anfrage von öffentlicher Adresse ${normIp(ip)} abgewiesen (${String(req.method)} ${String(req.path || '').slice(0, 80)}). Ist der Port am Router freigegeben? Bitte die Freigabe entfernen.`, { key: label });
    const msg = `${label} ist nur im Vereinsnetz erreichbar.`;
    if (String(req.path || '').startsWith('/api/')) return res.status(403).json({ error: msg });
    res.status(403).type('text/plain; charset=utf-8').send(msg + '\n\nVon unterwegs ist nur die Mitglieder-App über den Cloudflare Tunnel vorgesehen.');
  };
}
/** Antworten komprimieren (gzip/brotli je nach Browser) – Skripte, Stile, JSON, SVG; Bilder/Archive bleiben unverändert */
const compression = require('compression');
const compress = () => compression({ threshold: 1024, level: 6, filter: (req, res) => { const t = String(res.getHeader('Content-Type') || ''); return /^(text\/|application\/(json|javascript|manifest\+json|xml)|image\/svg)/.test(t) || compression.filter(req, res); } });
// Anfragen mit komprimiertem Inhalt (gzip, br, deflate) braucht keine Clubwerk-Oberfläche. Der Brotli-Entpacker von
// Node.js hatte eine kritische Lücke (Oktober 2026), deshalb erreicht so ein Inhalt den Entpacker gar nicht erst.
const noEncodedBody = () => (req, res, next) => {
  const enc = String(req.headers['content-encoding'] || '').trim();
  if (!enc || /^identity$/i.test(enc)) return next();
  res.status(415).json({ error: 'Komprimierte Anfragen werden nicht angenommen.' });
};
// Node.js-Versionen mit den Sicherheitskorrekturen vom 21.10.2026 (je Hauptversion)
const NODE_FIXED = { 22: [22, 23, 4], 24: [24, 22, 1], 26: [26, 12, 1] };
const nodeOutdated = (v = process.version) => {
  const n = String(v).replace(/^v/, '').split('.').map(Number), f = NODE_FIXED[n[0]];
  if (!f) return n[0] < 26;
  for (let i = 1; i < 3; i++) if (n[i] !== f[i]) return n[i] < f[i];
  return false;
};
module.exports = { setModules: fn => { modulesRef = fn; }, catalog, clean, recipients, extraAddresses, digest, listAlerts, done, openCounts, purgeCount, purge, ofMember, forgetMember,
  noEncodedBody, nodeOutdated, normIp, notPublic, privateSource, lanSource, lanOnly, noTunnel, compress, securityAlert, limiter, budget, hardenHeaders, hostGuard, hostAllowed, resetHostCache };
