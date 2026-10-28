'use strict';
/* ---------- Mitglieder-App: EIN QR-Code, EINE PIN, alle freigeschalteten Bereiche ----------
   Läuft auf einem eigenen Port (Standard 5001). Ein Mitglied wird einmal per QR-Code eingeladen, legt seine
   App-PIN fest – damit ist genau dieses Handy gekoppelt (src/invites.js, Bereich „app“).
   Welche Bereiche es nutzen darf (Zugang, Beregnung …), hakt der Admin je Mitglied an (Tabelle member_access).
   Module hängen sich mit einem eigenen Router (ctx.member) und einer Seite public/member.js ein.
   Die Getränke-PIN am Tablet ist davon unabhängig. */
const fs = require('fs');
const path = require('path');
const express = require('express');
const { db, getSetting, setSetting, audit } = require('./db');
const { normIp } = require('./security');
const invites = require('./invites');
const tls = require('./tls');
const INTERNAL = () => tls.internalBase();
const SCOPE = 'app';
/* Externer Zugang über einen Cloudflare Tunnel (nur die Mitglieder-App): */
const tunnelOn = () => getSetting('ext_tunnel', '0') === '1';
const tunnelUrl = () => getSetting('ext_tunnel_url', '');
/** Rechnername der öffentlichen Tunnel-Adresse (leer ohne Tunnel) */
const tunnelHost = () => { try { return tunnelUrl() ? new URL(tunnelUrl()).host.toLowerCase() : ''; } catch (e) { return ''; } };
/** Bereich „von unterwegs“ (über den Tunnel) nutzbar? Einstellung je Bereich, sonst Vorgabe des Moduls (Beregnung, Türen: nein) */
const extCfg = () => { try { const x = JSON.parse(getSetting('app_ext_modules', '{}')); return x && typeof x === 'object' ? x : {}; } catch (e) { return {}; } };
function extAllowed(id) { const c = extCfg(); if (c[id] !== undefined) return Boolean(c[id]); const m = modules.get(id); return m ? m.away !== false : false; }
/* Vereins-WLAN = Anfrage kommt direkt aus dem privaten Netz bei Home Assistant an (nicht über den Tunnel). Die App erreicht
   im Vereinsheim die lokale HTTPS-Adresse (Einstellung „Adresse im Vereins-WLAN“) und nutzt sie dann für alle Aufrufe. */
/** von außen? Über den Tunnel und nicht aus dem Vereinsnetz – oder direkt von einer öffentlichen Adresse (versehentliche Portfreigabe am Router:
 *  dann kommt keine cf-Kopfzeile, die Anfrage darf trotzdem nicht als „im WLAN“ gelten) */
const awayReq = req => Boolean(req.viaTunnel) || !isClubNet(String(req.socket.remoteAddress || ''));
/** lokale HTTPS-Adresse der App (nur https ist von der öffentlichen Seite aus erreichbar – Browser blocken http als „Mixed Content“) */
const lanUrl = () => { const u = getSetting('app_url', '').replace(/\/+$/, ''); return /^https:\/\//i.test(u) ? u : ''; };
const originOf = u => { try { return new URL(u).origin; } catch (e) { return ''; } };
/** darf dieses Mitglied den Bereich bei dieser Anfrage nutzen? (im WLAN immer; unterwegs, wenn der Bereich oder das Mitglied dafür freigegeben ist) */
const awayOk = (req, id, row) => !awayReq(req) || extAllowed(id) || Boolean(row && row.away);
const WLAN_ONLY = 'Nur im Vereins-WLAN nutzbar – bitte im Vereinsheim öffnen.';
/** Vereinsfarbe (Verwaltung → Einstellungen) – die App übernimmt sie beim Start und, solange sie offen ist, ohne Neuladen */
const appColor = () => require('./db').clubColor();
const STAGED = 'Aus Sicherheitsgründen erst nach dem ersten Öffnen der App im Vereins-WLAN – oder nach Freigabe durch den Vorstand.';
const sms = require('./sms');
/** Kontaktdaten aus der Mitgliederverwaltung (falls aktiv) → { email, mobile }; hooked: Module mit memberAddress, wenn schon ermittelt (bei vielen Mitgliedern) */
function contactOf(memberId, hooked = null) {
  try { for (const p of hooked || require('./plugins').withHook('memberAddress')) { const a = p.hooks.memberAddress(memberId); if (a) return a; } } catch (e) { /* Modul-Fehler: keine Kontaktdaten */ }
  return null;
}
const mailOf = (id, hooked = null) => { const a = contactOf(id, hooked); const m = require('./mail'); return a && a.email && m.mailOk(a.email) && !/@clubwerk\.invalid$/i.test(a.email) ? a.email : null; };
/** Handynummer für den SMS-Code – nur, wenn SMS eingerichtet ist */
const smsPhone = id => { if (!sms.ready()) return null; const a = contactOf(id); return a ? (sms.normPhone(a.mobile) || sms.normPhone(a.phone)) : null; };
/** hat das Mitglied einen Bereich, der im Verein etwas schaltet (Türen, Beregnung)? */
const deTs = ms => new Date(ms).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: process.env.TZ || 'Europe/Berlin' });
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
/** Einladung per E-Mail verschicken (Link mit Knopf, kurze Anleitung) */
async function inviteMail(memberId, inv, by) {
  const to = mailOf(memberId); if (!to) throw new Error('Keine E-Mail-Adresse hinterlegt.');
  const mail = require('./mail'); if (!mail.ready()) throw new Error('Kein Postfach eingerichtet (Einstellungen → Postfach).');
  const club = getSetting('club_name', 'Verein'), url = `${qrUrl().replace(/\/+$/, '')}/#i=${inv.token}`;
  const until = deTs(inv.expiresAt), phone = smsPhone(memberId);
  const steps = ['Den Knopf unten auf deinem Handy antippen (nicht am PC).', ...(phone ? [`Den Code eingeben, den du per SMS an ${sms.maskPhone(phone)} bekommst.`] : []), 'Eine eigene PIN für die App festlegen (4 bis 6 Ziffern).', 'Die Seite auf den Home-Bildschirm legen – fertig.'];
  await mail.send({ to, subject: `Deine Mitglieder-App – ${club}`,
    text: `Hallo ${firstName(inv.member)},\n\ndu kannst die Mitglieder-App von ${club} jetzt auf deinem Handy freischalten:\n\n${steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n${url}\n\nDer Link gilt einmal und bis ${until} Uhr. Bitte nicht weiterleiten – wer ihn zuerst öffnet, bekommt den Zugang.\n\nViele Grüße\n${club}`,
    card: { heading: 'Mitglieder-App freischalten', before: `Hallo ${firstName(inv.member)},\n\ndu kannst die Mitglieder-App von ${club} jetzt auf deinem Handy freischalten:`, title: 'So geht es', rows: steps.map((x, i) => [`${i + 1}.`, x]),
      after: `Der Link gilt einmal und bis ${until} Uhr. Bitte nicht weiterleiten – wer ihn zuerst öffnet, bekommt den Zugang.\n\nViele Grüße\n${club}`, button: { label: 'App freischalten', url } } });
  audit(by || null, 'Mitglieder-App: Einladung per E-Mail', `${inv.member} · gültig bis ${until}`);
  return { to };
}
/** Bestätigung an das Mitglied nach jeder Kopplung – fällt so sofort auf, wenn jemand anderes die Einladung benutzt hat */
function pairedMail(memberId, { device, remote, verified }) {
  const to = mailOf(memberId); if (!to) return;
  const mail = require('./mail'); if (!mail.ready()) return;
  const m = db.prepare('SELECT name FROM members WHERE id = ?').get(memberId); if (!m) return;
  const club = getSetting('club_name', 'Verein');
  const dl = String(device || '');
  const label = /iPhone/.test(dl) ? 'iPhone' : /iPad/.test(dl) ? 'iPad' : /Android/.test(dl) ? 'Android-Handy' : 'Gerät';
  const note = remote && hasSensitive(memberId) ? 'Türen und Beregnung schalten sich frei, sobald du die App einmal im Vereins-WLAN öffnest.' : verified ? 'Bestätigt mit dem Code per SMS.' : '';
  const warn = 'Warst du das nicht? Dann melde dich bitte sofort beim Vorstand – das Handy wird dann gesperrt.';
  mail.send({ to, subject: `Mitglieder-App freigeschaltet – ${club}`,
    text: `Hallo ${firstName(m.name)},\n\nauf einem ${label} wurde gerade die Mitglieder-App für dich freigeschaltet (${deTs(Date.now())} Uhr).${note ? '\n' + note : ''}\n\n${warn}\n\nViele Grüße\n${club}`,
    card: { heading: 'Mitglieder-App freigeschaltet', before: `Hallo ${firstName(m.name)},`, title: 'Neues Gerät', rows: [['Gerät', label], ['Zeit', deTs(Date.now()) + ' Uhr'], ...(note ? [['Hinweis', note]] : [])], after: `${warn}\n\nViele Grüße\n${club}` } })
    .catch(e => console.error('Bestätigungs-Mail:', e.message));
}
const hasSensitive = memberId => activeModules().some(([id, m]) => m.sensitive && accessFor(memberId, id).ok);
const qrUrl = () => (tunnelOn() && tunnelUrl() ? tunnelUrl() : getSetting('app_url', ''));
/** private Absenderadresse (WLAN, Add-on-Netz, derselbe Rechner, link-local)? */
const PRIVATE_IP = ip => /^(::ffff:)?(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) || ip === '::1' || /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip);
/* ---------- Was gilt als Vereins-WLAN? ----------
   Nie: das interne Home-Assistant-Netz 172.30.32.0/23 (Supervisor, andere Add-ons – über diese Adressen kommen auch Proxy- und Tunnel-Anfragen).
   Sind unter Mitglieder-App → „Von unterwegs erreichbar“ Vereinsnetze eingetragen (z. B. 192.168.10.0/24), zählen nur diese;
   sonst jede private Adresse. Derselbe Rechner (127.0.0.1/::1) zählt immer (nur Prozesse im Add-on selbst). */
const HA_INTERNAL = ip => /^172\.30\.3[23]\./.test(ip);
function ipv4Int(ip) { const p = ip.split('.').map(Number); return p.length === 4 && p.every(n => n >= 0 && n <= 255) ? ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3] : null; }
function ipv6Big(ip) {
  let [h, t] = ip.toLowerCase().split('::'); const a = h ? h.split(':') : [], b = t !== undefined ? (t ? t.split(':') : []) : null;
  const parts = b ? [...a, ...Array(8 - a.length - b.length).fill('0'), ...b] : a; if (parts.length !== 8 || parts.some(x => !/^[0-9a-f]{1,4}$/.test(x))) return null;
  return parts.reduce((acc, x) => (acc << 16n) + BigInt(parseInt(x, 16)), 0n);
}
/** „192.168.10.0/24, fd00::/8“ → Prüffunktion; ungültige Einträge werden übergangen */
function cidrList(text) {
  return String(text || '').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean).map(c => {
    const [net, bitsS] = c.split('/'); const v6 = net.includes(':');
    const bits = bitsS === undefined ? (v6 ? 128 : 32) : Number(bitsS);
    if (v6) { const n = ipv6Big(net); if (n == null || !(bits >= 0 && bits <= 128)) return null; const mask = bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(128 - bits); return ip => { const x = ipv6Big(ip); return x != null && (x & mask) === (n & mask); }; }
    const n = ipv4Int(net); if (n == null || !(bits >= 0 && bits <= 32)) return null; const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ip => { const x = ipv4Int(ip); return x != null && ((x & mask) >>> 0) === ((n & mask) >>> 0); };
  }).filter(Boolean);
}
const validNets = text => String(text || '').split(/[\s,;]+/).filter(Boolean).every(c => cidrList(c).length === 1);
let netCache = { raw: null, list: [] };
function isClubNet(ipRaw) {
  const ip = normIp(ipRaw);
  if (!ip || HA_INTERNAL(ip)) return false;
  if (/^127\./.test(ip) || ip === '::1') return true;
  const raw = getSetting('app_wlan_nets', '');
  if (netCache.raw !== raw) netCache = { raw, list: cidrList(raw) };
  return netCache.list.length ? netCache.list.some(f => f(ip)) : PRIVATE_IP(ip);
}
/** sind Vereinsnetze eingetragen? */
function hasClubNets() { const raw = getSetting('app_wlan_nets', ''); if (netCache.raw !== raw) netCache = { raw, list: cidrList(raw) }; return netCache.list.length > 0; }
/** steht die Adresse in den eingetragenen Vereinsnetzen? (ohne Liste: nein) */
function inClubNets(ipRaw) {
  const ip = normIp(ipRaw);
  const raw = getSetting('app_wlan_nets', '');
  if (netCache.raw !== raw) netCache = { raw, list: cidrList(raw) };
  return Boolean(ip) && netCache.list.some(f => f(ip));
}
/* Der Kopfzeile cf-connecting-ip (echte Absenderadresse hinter Cloudflare) wird nur geglaubt, wenn die Anfrage tatsächlich vom Tunnel kommt.
   Sonst könnte jedes Handy im Vereins-WLAN mit wechselnden Adressen alle Bremsen (Kopplung, Übernahme, Online-Antrag …) aushebeln.
   Vertraute Quellen: das in der Add-on-Konfiguration eingetragene Proxy-Add-on („proxy_addon_ip“, über TRUSTED_PROXY – ohne den Supervisor),
   das Add-on-Netz 172.30.32.0/23 samt Gateway 172.30.32.1/172.30.33.1 (das Cloudflared-Add-on läuft mit host_network und erscheint über
   das Docker-NAT als Gateway-Adresse) und derselbe Rechner (127.0.0.1/::1, Tests). */
const TUNNEL_IPS = (process.env.TRUSTED_PROXY || '').split(',').map(x => x.trim()).filter(x => x && x !== '172.30.32.2');
function fromTunnel(sock) {
  const ip = normIp(sock);
  if (!ip) return false;
  // In der Verwaltung festgelegte Tunnel-Quelle (Mitglieder-App → „Tunnel-Quelle“): dann gilt NUR diese eine Adresse –
  // auch nicht mehr das Proxy-Add-on (proxy_addon_ip) oder derselbe Rechner
  const pin = getSetting('tunnel_src', '');
  if (pin) return ip === pin;
  if (TUNNEL_IPS.includes(ip)) return true;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  return /^172\.30\.3[23]\.\d{1,3}$/.test(ip);
}
/* Netze des Home-Assistant-Rechners (Supervisor → network/info) – Vorschlag fürs Vereinsnetz, wenn die Verwaltung über die Seitenleiste läuft.
   Einmal beim ersten Aufruf geholt, danach höchstens alle 6 Stunden (kein unnötiger Verkehr). */
let hostNetC = { at: 0, nets: [] };
function hostNetsCached() {
  if (process.env.SUPERVISOR_TOKEN && Date.now() - hostNetC.at > 6 * 3600000) {
    hostNetC.at = Date.now();
    fetch((process.env.SUPERVISOR_URL || 'http://supervisor').replace(/\/$/, '') + '/network/info', { headers: { Authorization: 'Bearer ' + process.env.SUPERVISOR_TOKEN }, signal: AbortSignal.timeout(5000) })
      .then(r => r.json()).then(d => { hostNetC.nets = netsFromInfo(d && d.data); }).catch(() => { /* kein Vorschlag */ });
  }
  return hostNetC.nets;
}
/** „192.168.10.188/24“ → „192.168.10.0/24“ (nur private IPv4-Netze, keine Docker-/Add-on-Netze) */
function netsFromInfo(info) {
  const out = new Set();
  for (const itf of (info && info.interfaces) || []) for (const a of (itf.ipv4 && itf.ipv4.address) || []) {
    const [ip, bitsS] = String(a).split('/'); const bits = Number(bitsS); const n = ipv4Int(ip);
    if (n == null || !(bits >= 8 && bits <= 30) || !PRIVATE_IP(ip) || HA_INTERNAL(ip) || /^127\./.test(ip)) continue;
    const mask = (0xffffffff << (32 - bits)) >>> 0, net = (n & mask) >>> 0;
    out.add(`${net >>> 24}.${(net >>> 16) & 255}.${(net >>> 8) & 255}.${net & 255}/${bits}`);
  }
  return [...out].slice(0, 4);
}
/** direkte Verbindungen von öffentlichen Adressen (ohne Tunnel) erlauben? Standard: nein */
const directOk = () => getSetting('app_direct_public', '0') === '1';
let lastTunnelOk = null;   // zuletzt angenommene Tunnel-Quelle (nur im Speicher) – zum Festlegen in der Verwaltung
/** zuletzt abgelehnte Tunnel-Anfrage (nur im Speicher) – damit der Vorstand in der Verwaltung sieht, wenn das Cloudflared-Add-on
 *  von einer anderen Adresse kommt als erwartet, statt dass sich Mitglieder draußen über eine „kaputte“ App wundern */
let lastTunnelReject = null;
const noteTunnelReject = (sock, req, why) => { lastTunnelReject = { ip: normIp(sock).slice(0, 45), at: new Date().toISOString(), host: String(req.headers.host || '').slice(0, 100), why }; };

db.exec(`
CREATE TABLE IF NOT EXISTS member_access (
  member_id   INTEGER NOT NULL REFERENCES members(id),
  module      TEXT NOT NULL,
  profile     TEXT,                    -- z. B. Zeitprofil beim Zugang
  valid_until TEXT,                    -- JJJJ-MM-TT einschließlich, NULL = unbegrenzt
  blocked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (member_id, module)
);
CREATE TABLE IF NOT EXISTS app_forme_seen (   -- „Für mich“: quittierte Neuigkeiten (Bereich:Kennung) je Mitglied
  member_id INTEGER NOT NULL REFERENCES members(id),
  key       TEXT NOT NULL,
  at        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (member_id, key)
);
`);

const { today, deD } = require('./util');
// 3.14.2: Ausnahme je Mitglied – Bereich auch von unterwegs nutzbar, obwohl er sonst nur im Vereins-WLAN gilt (Platzwart, Privat-Relay)
try { db.exec('ALTER TABLE member_access ADD COLUMN away INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* gibt es schon */ }
// 3.17: zusätzliche Haken je Mitglied und Bereich, die das Modul anbietet (Hook accessOptions().flags), z. B. Buchen → „Gebühren zeigen“ – JSON { fees: true }
try { db.exec('ALTER TABLE member_access ADD COLUMN flags TEXT'); } catch (e) { /* gibt es schon */ }
const parseFlags = v => { try { const x = JSON.parse(v || '{}'); return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; } catch (e) { return {}; } };
const hasFlags = row => Boolean(row && Object.values(parseFlags(row.flags)).some(Boolean));

/* Module, die in der App erscheinen: id -> { name, label, order, dir, router, hooks, isActive } */
const modules = new Map();
function register(id, info) { modules.set(id, info); }
/* Öffentliche Teile von Modulen (ohne Anmeldung, z. B. Online-Mitgliedsantrag) */
const publics = new Map();
function registerPublic(id, info) { publics.set(id, info); }
/** Bereiche, die der Verein in der App ausgeschaltet hat (Reiter weg für alle, Freischaltungen bleiben erhalten) */
const appOff = () => { try { return new Set(JSON.parse(getSetting('app_off', '[]')) || []); } catch (e) { return new Set(); } };
const appVisible = (m, memberId) => { try { return !(m.hooks && typeof m.hooks.appVisible === 'function') || Boolean(m.hooks.appVisible(memberId)); } catch (e) { return false; } };
/** Konto „Kein Mitglied“ (z. B. Trainer)? Es bekommt nur Bereiche mit keinMitglied (Buchen, Türen, Beregnung) – und nur mit eigener Freischaltung */
const isNonMember = id => (db.prepare('SELECT kind FROM members WHERE id = ?').get(id) || {}).kind === 'nichtmitglied';
const ONLY_MEMBERS = 'Dieser Bereich ist nur für Mitglieder.';
/** Freischaltung für ein Modul: Module mit „alle“ gelten für jedes gekoppelte Handy (außer ausdrücklich gesperrt) */
function accessFor(memberId, id) {
  const m = modules.get(id);
  if (appOff().has(id)) return { ok: false, row: null, reason: 'Dieser Bereich ist in der App gerade ausgeschaltet.' };
  if (isNonMember(memberId)) return m && m.nonMembers ? access.check(memberId, id) : { ok: false, row: null, reason: ONLY_MEMBERS };
  if (m && m.open) {
    const r = access.get(memberId, id);
    if (r && r.blocked) return { ok: false, row: r, reason: 'Dieser Bereich ist für dich gesperrt – bitte beim Vorstand melden.' };
    // Modul entscheidet selbst, für wen es da ist (z. B. Spielbetrieb: nur Spieler und Mannschaftsführer)
    if (!appVisible(m, memberId)) return { ok: false, row: r, reason: 'Dieser Bereich ist für dich nicht vorgesehen.' };
    return { ok: true, row: r };
  }
  return access.check(memberId, id);
}
/* Reihenfolge der Bereiche in der App (Reiter) und in der Freischaltungstabelle: Einstellung app_module_order (JSON-Liste von IDs),
   nicht gelistete Bereiche dahinter in der zentralen Reihenfolge der Module (MODULE_ORDER in plugins.js, Tablet und App gleich) */
const moduleOrder = () => { try { const x = JSON.parse(getSetting('app_module_order', '[]')); return Array.isArray(x) ? x.map(String) : []; } catch (e) { return []; } };
const push = require('./push');
const activeModules = () => {
  const ord = moduleOrder(), pos = id => { const i = ord.indexOf(id); return i < 0 ? 1e6 : i; };
  return [...modules.entries()].filter(([, m]) => m.isActive()).sort((a, b) => pos(a[0]) - pos(b[0]) || require('./plugins').orderPos(a[0]) - require('./plugins').orderPos(b[0]) || (a[1].order || 50) - (b[1].order || 50));
};
push.setModules(activeModules);

/* ---------- Freischaltungen ---------- */
const access = {
  get: (memberId, module) => db.prepare('SELECT * FROM member_access WHERE member_id = ? AND module = ?').get(memberId, module) || null,
  /** gültig = vorhanden, nicht gesperrt, nicht abgelaufen → { ok, row, reason } */
  check(memberId, module) {
    const r = access.get(memberId, module);
    if (!r) return { ok: false, reason: 'Dieser Bereich ist für dich nicht freigeschaltet.' };
    if (r.blocked) return { ok: false, row: r, reason: 'Dieser Bereich ist für dich gesperrt – bitte beim Vorstand melden.' };
    if (r.valid_until && r.valid_until < today()) return { ok: false, row: r, reason: `Deine Freischaltung war bis ${deD(r.valid_until)} gültig.` };
    return { ok: true, row: r };
  },
  list: module => db.prepare(`SELECT a.*, m.name FROM member_access a JOIN members m ON m.id = a.member_id WHERE a.module = ? AND m.deleted = 0 ORDER BY name_key(m.name, m.kind)`).all(module),
  set(memberId, module, fields = {}) {
    const cur = access.get(memberId, module);
    const f = { profile: cur ? cur.profile : null, valid_until: cur ? cur.valid_until : null, blocked: cur ? cur.blocked : 0, away: cur ? cur.away : 0, flags: cur ? cur.flags : null, ...fields };
    db.prepare(`INSERT INTO member_access(member_id, module, profile, valid_until, blocked, away, flags) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(member_id, module) DO UPDATE SET profile = excluded.profile, valid_until = excluded.valid_until, blocked = excluded.blocked, away = excluded.away, flags = excluded.flags`)
      .run(memberId, module, f.profile ?? null, f.valid_until || null, f.blocked ? 1 : 0, f.away ? 1 : 0, f.flags || null);
  },
  remove: (memberId, module) => db.prepare('DELETE FROM member_access WHERE member_id = ? AND module = ?').run(memberId, module).changes > 0,
};

const DEV_COLS = 'device, paired_at, last_used, invite_expires, blocked_at, paired_host, remote, verified, invite_kind, invite_hash IS NOT NULL AS invited, token_hash IS NOT NULL AS paired';
const ACC_COLS = 'module, profile, valid_until, blocked, away, flags';
/** für memberState() bei vielen Mitgliedern: Handys, Freischaltungen, Tunnel und Bereiche einmal laden statt je Mitglied */
function statesPre() {
  const dev = new Map();
  for (const d of db.prepare(`SELECT member_id, ${DEV_COLS} FROM member_devices WHERE scope = ? ORDER BY member_id, id`).all(SCOPE)) if (!dev.has(d.member_id)) dev.set(d.member_id, d);
  const acc = new Map();
  for (const a of db.prepare(`SELECT member_id, ${ACC_COLS} FROM member_access ORDER BY member_id, module`).all()) { if (!acc.has(a.member_id)) acc.set(a.member_id, []); acc.get(a.member_id).push(a); }
  return { dev, acc, th: tunnelOn() ? tunnelHost() : '', mods: activeModules(), nm: new Set(db.prepare("SELECT id FROM members WHERE kind = 'nichtmitglied'").all().map(r => r.id)) };
}
/** Zustand eines Mitglieds für die Verwaltung (pre: aus statesPre()) */
function memberState(memberId, pre = null) {
  const dev = pre ? pre.dev.get(memberId) : db.prepare(`SELECT ${DEV_COLS} FROM member_devices WHERE scope = ? AND member_id = ?`).get(SCOPE, memberId);
  // gekoppelt unter einer anderen Adresse als der öffentlichen? Dann braucht das Handy einen neuen QR-Code, um auch unterwegs zu funktionieren
  const th = pre ? pre.th : tunnelOn() ? tunnelHost() : '';
  const oldAddress = Boolean(dev && dev.paired && th && (dev.paired_host || '') !== th);
  const acc = pre ? pre.acc.get(memberId) || [] : db.prepare(`SELECT ${ACC_COLS} FROM member_access WHERE member_id = ?`).all(memberId);
  const nm = pre ? pre.nm.has(memberId) : isNonMember(memberId);
  return {
    device: dev ? { status: dev.paired ? 'gekoppelt' : dev.blocked_at && !dev.invited ? 'gesperrt' : dev.invite_expires >= Date.now() ? 'eingeladen' : 'abgelaufen', label: dev.device, remote: Boolean(dev.paired && dev.remote), verified: dev.verified || null, kind: dev.invite_kind || 'qr', expires: dev.invited ? dev.invite_expires : null, paired_at: dev.paired_at, last_used: dev.last_used, blocked_at: dev.blocked_at, host: dev.paired_host || null, oldAddress } : null,
    access: Object.fromEntries(acc.map(a => [a.module, { profile: a.profile, valid_until: a.valid_until, blocked: Boolean(a.blocked), away: Boolean(a.away), flags: parseFlags(a.flags) }])),
    // je Bereich angehakt? „für alle“-Bereiche gelten, bis sie für dieses Mitglied abgeschaltet werden
    granted: Object.fromEntries((pre ? pre.mods : activeModules()).map(([id, m]) => { const a = acc.find(x => x.module === id); return [id, nm ? Boolean(m.nonMembers && a) : m.open ? !(a && a.blocked) : Boolean(a)]; })),
  };
}
/** Beim Freischalten vorausgewählt? Bereiche, die im Verein etwas schalten (Türen, Beregnung), standardmäßig nicht – nur für ausgewählte Mitglieder */
const preselect = id => { const m = modules.get(id); let o = {}; try { o = JSON.parse(getSetting('app_preselect', '{}')) || {}; } catch (e) { o = {}; } return id in o ? Boolean(o[id]) : !(m && m.sensitive && !m.open); };
const moduleInfo = () => activeModules().map(([id, m]) => {
  let options = null;
  try { options = m.hooks.accessOptions ? m.hooks.accessOptions() : null; } catch (e) { options = null; }
  // Profile nur für eigens freizuschaltende Bereiche; zusätzliche Haken (flags) auch für „für alle“-Bereiche
  return { id, name: m.name, label: m.label, perm: m.perm, open: Boolean(m.open), nonMembers: Boolean(m.nonMembers), away: extAllowed(id), on: !appOff().has(id), preselect: preselect(id), count: m.open ? null : access.list(id).filter(r => !r.blocked).length, options: options ? (m.open ? { flags: options.flags || null } : options) : null };
});

/* ---------- Port der Mitglieder-App ---------- */
/* „Für mich“: Zeitgrenze je Modul (die Übersicht der Verwaltung hat 6 s – am Handy kürzer), Vorschau in Tagen, höchstens so viele Zeilen */
const FORME_TIMEOUT_MS = 1500, FORME_DAYS = 60, FORME_NEXT = 4, FORME_TODO = 4, FORME_NEWS = 3;
/** offenes Thekenkonto eines Mitglieds (memberBalance aus server.js, über startPort) */
let kontoOf = null;
function startPort({ rateLimit, rateLimitKey, memberBalance }) {
  kontoOf = memberBalance || null;
  const port = parseInt(process.env.MEMBER_PORT || '5001', 10);
  if (!port) return;
  const app = express();
  app.disable('x-powered-by');
  app.use(require('./security').noEncodedBody());   // komprimierte Anfragen nie entpacken
  app.use(require('./security').hostGuard());
  app.use(require('./security').hardenHeaders({ frame: 'DENY' }));
  app.use(require('./security').compress());
  // Anfragen über den Tunnel: echte Absender-IP für die Sperren bei Fehlversuchen (sonst teilten sich alle Handys draußen eine IP)
  app.use((req, res, next) => {
    const cf = req.get('cf-connecting-ip');
    const sock = String(req.socket.remoteAddress || '');
    if (!cf) {
      // Direkt (ohne Tunnel) von einer öffentlichen Adresse – meist eine Portfreigabe am Router: ablehnen, außer bewusst erlaubt
      if (directOk() || require('./security').notPublic(sock)) return next();
      noteTunnelReject(sock, req, 'direkt');
      require('./security').securityAlert(`Mitglieder-App: direkte Anfrage von öffentlicher Adresse ${normIp(sock).slice(0, 45)} abgewiesen. Ist Port ${process.env.MEMBER_PORT || '5001'} am Router freigegeben? Von unterwegs ist nur der Cloudflare Tunnel vorgesehen – bitte die Freigabe entfernen.`, 'app-direct');
      return res.status(403).json({ error: 'Die Mitglieder-App ist von unterwegs nur über die öffentliche Adresse des Vereins erreichbar.' });
    }
    if (!tunnelOn()) { noteTunnelReject(sock, req, 'aus'); return res.status(403).json({ error: 'Externer Zugang ist ausgeschaltet.' }); }
    // cf-Kopfzeile von einem Gerät, das nicht der Tunnel ist (z. B. aus dem Vereins-WLAN): nicht glauben, Anfrage ablehnen
    if (!fromTunnel(sock)) { noteTunnelReject(sock, req, 'quelle'); return res.status(403).json({ error: 'Externer Zugang ist ausgeschaltet.' }); }
    const ip = String(cf).trim();
    if (!require('net').isIP(ip)) { noteTunnelReject(sock, req, 'kopf'); return res.status(400).json({ error: 'Ungültige Anfrage.' }); }
    Object.defineProperty(req, 'ip', { value: ip, configurable: true });
    lastTunnelOk = { ip: normIp(sock).slice(0, 45), at: new Date().toISOString() };
    req.viaTunnel = true;
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // Die App darf zusätzlich die lokale Adresse (im Vereinsheim) bzw. die öffentliche Adresse ansprechen
    const own = [originOf(lanUrl()), tunnelOn() ? originOf(tunnelUrl()) : ''].filter(Boolean);
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${own.join(' ')}; frame-src 'self' ${own.join(' ')}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' ${own.join(' ')}`);
    // Die öffentliche App bettet im Vereinsheim die lokale Adresse ein (Inlay) – nur die eigenen Adressen dürfen einbetten
    if (own.length) res.removeHeader('X-Frame-Options');
    // CORS nur zwischen den beiden eigenen Adressen (öffentlich ↔ lokal): die App von app.verein.de ruft im WLAN https://lan…:5001 auf
    const o = req.get('origin');
    if (o && own.includes(o)) {
      res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Geraet, X-Clubwerk'); res.setHeader('Access-Control-Max-Age', '600');
      if (req.method === 'OPTIONS') return res.status(204).end();
    }
    next();
  });
  // Unterschriften (Online-Antrag, neue Bankverbindung) und Fotos (Profilbild, Mängelmelder) brauchen mehr Platz als die übrigen Anfragen
  app.use(['/api/p', '/api/m/mitglieder', '/api/photo', '/api/m/maengel'], express.json({ limit: '600kb' }));
  app.use(express.json({ limit: '10kb' }));
  /** Vorschau einer anderen Vereinsfarbe (Design-Prüfstand) an den Hauptserver weiterreichen – nur Hex-Werte */
  const themePreview = req => { const q = new URLSearchParams(); for (const k of ['vorschau', 'vorschau2']) if (typeof req.query[k] === 'string' && /^[0-9a-f]{6}$/i.test(req.query[k])) q.set(k, req.query[k]); return q.toString() ? '?' + q : ''; };
  const relay = (p, t) => async (req, res) => {
    try {
      const r = await fetch(`${INTERNAL()}${p}`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return res.status(404).end();
      const ct = r.headers.get('content-type') || t;
      if (/^image\//.test(ct)) res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");   // Bilder (auch SVG-Logo) nie als Seite mit Skripten
      res.set({ 'Content-Type': ct, 'Cache-Control': /\.(woff2|png)$/.test(p) ? 'public, max-age=604800' : 'no-cache' }).send(Buffer.from(await r.arrayBuffer()));   // Schriften/Icons eine Woche, Rest per ETag
    } catch (e) { res.status(404).end(); }
  };
  for (const [p, t] of [['/style.css', 'text/css'], ['/kit.css', 'text/css'], ['/icon-192.png', 'image/png'], ['/icon-512.png', 'image/png'], ['/fonts/jakarta-latin.woff2', 'font/woff2'], ['/fonts/jakarta-latin-ext.woff2', 'font/woff2'], ['/fonts/barlow-condensed-600.woff2', 'font/woff2'], ['/theme-init.js', 'application/javascript']]) app.get(p, relay(p, t));
  app.get('/theme.css', (req, res) => relay('/theme.css' + themePreview(req), 'text/css')(req, res));
  // Sprache: Anfrage samt Wahl (l) und Handy-Sprache (b) an den Hauptserver weiterreichen
  app.get('/i18n.js', (req, res) => relay('/i18n.js?' + new URLSearchParams({ l: String(req.query.l || 'auto').slice(0, 20), b: String(req.query.b || '').slice(0, 200) }), 'application/javascript')(req, res));
  app.get('/logo', relay('/vereinslogo', 'image/png'));
  app.get('/icon.png', relay('/vereinsicon.png', 'image/png'));
  app.get('/manifest.json', (req, res) => {
    const name = getSetting('app_name', 'Verein');
    // mit Übernahme-Code: die Home-Bildschirm-App startet mit #k=…, damit sie die Freischaltung übernehmen kann (iPhone)
    const k = /^[A-Z2-9]{10}$/.test(String(req.query.k || '')) ? String(req.query.k) : '';
    res.set('Cache-Control', 'no-store');
    res.json({ name: `${getSetting('club_name', 'Verein')} – ${name}`, short_name: name, start_url: k ? `./#k=${k}` : './', scope: './', display: 'standalone', background_color: '#f6f5f1', theme_color: appColor(),
      icons: [{ src: 'icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' }] });
  });
  // Seiten der Module (public/member.js)
  app.get('/m/:id/:file', (req, res) => {
    const m = modules.get(req.params.id);
    if (!m || !m.isActive() || !m.dir || !/^[a-z0-9_-]+\.js$/.test(req.params.file) || ['admin.js'].includes(req.params.file)) return res.status(404).end();
    const f = path.join(m.dir, 'public', req.params.file);
    if (!fs.existsSync(f)) return res.status(404).end();
    res.type('application/javascript').set('Cache-Control', 'no-cache').sendFile(f);
  });

  const api = express.Router();
  const dev = req => req.get('X-Geraet') || '';
  // Diagnose: ip = so sieht Clubwerk den Absender; wlan = Anfrage kam direkt aus dem Vereinsnetz (nicht über den Tunnel)
  api.get('/ping', (req, res) => res.json({ ok: true, app: 'clubwerk', color: appColor(), club: getSetting('club_name', ''), tunnel: Boolean(req.viaTunnel), wlan: !awayReq(req), ip: normIp(req.ip) }));
  /** Bereiche dieses Handys bei dieser Anfrage: freigeschaltet, „Nur im Vereins-WLAN“ (unterwegs) oder „wartet aufs WLAN“ (vertraulich nach Kopplung von unterwegs) */
  const sectionsFor = (req, w) => {
    const off = appOff(), nm = isNonMember(w.memberId);
    return activeModules().filter(([id, m]) => !off.has(id)).filter(([id, m]) => { const a = access.get(w.memberId, id); if (nm) return m.nonMembers && a; return m.open ? !(a && a.blocked) && appVisible(m, w.memberId) : a; }).map(([id, m]) => {
      const c = accessFor(w.memberId, id);
      if (c.ok && !awayOk(req, id, c.row)) return { id, title: m.label || m.name, ok: false, reason: WLAN_ONLY, wlanOnly: true };
      if (c.ok && w.remote && m.sensitive) return { id, title: m.label || m.name, ok: false, reason: STAGED, staged: true };
      return { id, title: m.label || m.name, ok: c.ok, reason: c.ok ? null : c.reason, scripts: c.ok && m.scripts.length ? m.scripts : undefined };
    });
  };
  api.get('/me', (req, res) => {
    const w = invites.whoIs(SCOPE, dev(req));
    if (w && w.remote && !awayReq(req) && invites.trust(w.deviceId)) { w.remote = false; audit(null, 'Mitglieder-App: Handy im Vereins-WLAN bestätigt', w.name); }
    const sections = w ? sectionsFor(req, w) : [];
    res.json({ version: require('../package.json').version, start: getSetting('app_start', ''), color: appColor(), lanUrl: w ? lanUrl() : '', wlan: !awayReq(req), club: getSetting('club_name', 'Unser Verein'), demo: getSetting('demo_mode', '') === '1' || undefined, appName: getSetting('app_name', 'Verein'), member: w ? w.name : null,
      pinTablet: Boolean(w) && require('./plugins').isActive('getraenke'), sections, privacyAt: getSetting('app_privacy_at', '') || undefined });   // „Mein Konto › PIN ändern“: gilt die PIN auch im Verkauf am Tablet?
  });
  /* „Für mich“: Zeilen der freigeschalteten Bereiche (Hook forMe) – alle gleichzeitig, je Modul höchstens FORME_TIMEOUT_MS; nur eigene Daten des gekoppelten Mitglieds.
     Vier Karten: news (einmalige Hinweise, bis zum Quittieren), next (meine Termine), todo (was ich selbst tun muss, optional mit Knöpfen), money (Mein Konto) */
  api.get('/forme', async (req, res) => {
    const w = invites.whoIs(SCOPE, dev(req));
    if (!w) return res.status(403).json({ error: 'Dieses Handy ist nicht (mehr) freigeschaltet. Bitte beim Vorstand einen neuen QR-Code holen.', device: true });
    res.set('Cache-Control', 'no-store');
    const { addDays, euro } = require('./util');
    const away = awayReq(req), until = addDays(today(), FORME_DAYS);
    const ok = sectionsFor(req, w).filter(s => s.ok && typeof (modules.get(s.id).hooks || {}).forMe === 'function');
    const got = (await Promise.all(ok.map(async s => {
      let timer = null;
      try {
        const r = await Promise.race([Promise.resolve().then(() => modules.get(s.id).hooks.forMe(w.memberId, { away, until })), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('Zeitüberschreitung')), FORME_TIMEOUT_MS); })]);
        return { id: s.id, r: r || {} };
      } catch (e) { console.error(`Für mich: ${s.id}:`, e.message); return null; }   // Fehler oder zu langsam: nur diese Zeilen fehlen
      finally { clearTimeout(timer); }
    }))).filter(Boolean);
    const list = (r, k) => (Array.isArray(r[k]) ? r[k] : []).filter(x => x && x.title);
    // Knöpfe in der Zeile (z. B. Zusage): nur Wege im eigenen Bereich (/api/m/<bereich>/…) – dort gelten Rechte, Fristen und Protokoll wie im Bereich
    const act = a => ({ label: String(a.label || ''), aria: String(a.aria || ''), post: a.post, body: a.body && typeof a.body === 'object' ? a.body : {}, on: Boolean(a.on), kind: a.kind === 'n' ? 'n' : 'y' });
    const pick = (x, id) => ({ section: id, title: String(x.title), sub: x.sub ? String(x.sub) : '', chip: x.chip ? String(x.chip) : '', focus: x.focus != null ? String(x.focus) : '',
      ...(x.at ? { at: x.at, start: x.start || '', end: x.end || '' } : {}), ...(x.value ? { value: String(x.value) } : {}),
      ...(Array.isArray(x.actions) ? { actions: x.actions.filter(a => a && /^[a-z0-9/_-]{1,60}$/.test(a.post || '')).slice(0, 3).map(act) } : {}) });
    const time = x => x.at + (x.start || '');
    /* je Bereich zuerst seine erste Zeile, danach auffüllen – vier Buchungen verdrängen nie den nächsten Dienst („immer die nächste zeigen“) */
    const fair = (lists, max, sort) => { const s = a => (sort ? a.sort(sort) : a); return [...s(lists.map(l => l[0]).filter(Boolean)), ...s(lists.flatMap(l => l.slice(1)))].slice(0, max); };
    const byTime = (a, b) => time(a).localeCompare(time(b));
    const next = fair(got.map(g => list(g.r, 'next').filter(x => x.at && x.at <= until).map(x => pick(x, g.id)).sort(byTime)), FORME_NEXT, byTime).sort(byTime);
    const todo = fair(got.map(g => list(g.r, g.r.todo ? 'todo' : 'open').map(x => pick(x, g.id))), FORME_TODO);   // „open“: Module von vor 3.84
    const seen = new Set(db.prepare('SELECT key FROM app_forme_seen WHERE member_id = ?').all(w.memberId).map(r => r.key));
    const news = fair(got.map(g => list(g.r, 'news').filter(x => /^[A-Za-z0-9:_.-]{1,120}$/.test(String(x.key || ''))).map(x => ({ ...pick(x, g.id), key: `${g.id}:${x.key}` })).filter(x => !seen.has(x.key))), FORME_NEWS);
    const money = got.flatMap(g => list(g.r, 'money').slice(0, 2).map(x => pick(x, g.id)));
    // Thekenkonto (Verkauf im Kern): nur, wenn der Verein es eingeschaltet hat – noch nicht abgerechnete Buchungen (wie memberBalance am Tablet)
    const k = getSetting('app_forme_konto', '0') === '1' && kontoOf && require('./plugins').isActive('getraenke') ? kontoOf(w.memberId) : null;
    if (k && k.cents > 0) money.unshift({ section: '', title: 'Thekenkonto', sub: 'noch nicht abgerechnet', chip: '', focus: '', value: euro(k.cents) });
    res.json({ news, next, todo, money });
  });
  /** Neuigkeit quittiert (angetippt): erscheint nicht wieder – nur für das eigene Mitglied, ohne Protokoll; alte Einträge räumen sich nach 180 Tagen auf */
  api.post('/forme/seen', rateLimit('appfms', 60, 60000), (req, res) => {
    const w = invites.whoIs(SCOPE, dev(req));
    if (!w) return res.status(403).json({ error: 'Dieses Handy ist nicht (mehr) freigeschaltet. Bitte beim Vorstand einen neuen QR-Code holen.', device: true });
    const key = String((req.body || {}).key || '');
    if (!/^[a-z0-9_-]{1,40}:[A-Za-z0-9:_.-]{1,120}$/.test(key)) return res.status(400).json({ error: 'Ungültige Kennung.' });
    db.prepare("DELETE FROM app_forme_seen WHERE member_id = ? AND at < datetime('now','localtime','-180 days')").run(w.memberId);
    db.prepare('INSERT OR IGNORE INTO app_forme_seen(member_id, key) VALUES (?,?)').run(w.memberId, key);
    res.json({ ok: true });
  });
  /** Einladung schon eingelöst und erneut geöffnet: Vorstand warnen (einmal je Einladung) */
  const usedAlert = p => {
    if (!invites.markAlerted(p.deviceId)) return;
    require('./security').securityAlert(`Mitglieder-App: Die Einladung für ${p.member} wurde geöffnet, war aber schon auf einem Gerät (${p.usedDevice || 'unbekannt'}) eingelöst. Hat das Mitglied sie nicht selbst benutzt, bitte das Handy unter „Mitglieder-App“ entfernen und eine neue Einladung schicken.`, 'used:' + p.deviceId);
  };
  api.get('/invite', rateLimit('appinv', 30, 60000), (req, res) => {
    const p = invites.peek(SCOPE, String(req.query.t || ''));
    if (p.used) { usedAlert(p); return res.status(410).json({ error: p.error, used: true }); }
    if (p.error) return res.status(410).json({ error: p.error });
    const away = awayReq(req), phone = away ? smsPhone(p.memberId) : null;
    res.json({ member: p.member, hasPin: p.hasPin, away, sms: Boolean(phone), phone: sms.maskPhone(phone), staged: away && !phone && hasSensitive(p.memberId) });
  });
  /** zweiter Faktor: Code per SMS an die hinterlegte Handynummer (nie an eine eingegebene) */
  api.post('/invite/sms', rateLimit('appsms', 6, 600000), async (req, res) => {
    const t = String((req.body || {}).t || '');
    const p = invites.peek(SCOPE, t);
    if (p.error) return res.status(410).json({ error: p.error });
    if (!awayReq(req)) return res.status(400).json({ error: 'Im Vereins-WLAN ist kein SMS-Code nötig.' });
    const phone = smsPhone(p.memberId);
    if (!phone) return res.status(400).json({ error: 'Für dich ist keine Handynummer hinterlegt.' });
    const o = invites.otpCreate(SCOPE, t);
    if (o.error) return res.status(o.status).json({ error: o.error });
    try {
      await sms.send(phone, `${getSetting('club_name', 'Verein')}: Dein Code fuer die Mitglieder-App: ${o.code}. Gilt ${o.minutes} Minuten. Niemandem weitergeben.`);
      audit(null, 'Mitglieder-App: SMS-Code verschickt', `${p.member} · ${sms.maskPhone(phone)}`);
      res.json({ ok: true, phone: sms.maskPhone(phone), minutes: o.minutes });
    } catch (e) {
      audit(null, 'Mitglieder-App: SMS-Code nicht verschickt', `${p.member} · ${e.message}`);
      res.status(502).json({ error: 'Die SMS konnte gerade nicht verschickt werden. Du kannst ohne Code weitermachen – Türen und Beregnung schalten sich dann beim ersten Öffnen im Vereins-WLAN frei.', smsFailed: true });
    }
  });
  api.post('/pair', rateLimit('apppair', 10, 60000), (req, res) => {
    const b = req.body || {}, t = String(b.t || '');
    try {
      const p = invites.peek(SCOPE, t);
      if (p.used) { usedAlert(p); return res.status(410).json({ error: p.error, used: true }); }
      if (p.error) return res.status(400).json({ error: p.error });
      const away = awayReq(req);
      let remote = false, verified = null;
      if (away) {
        const phone = smsPhone(p.memberId);
        if (phone && String(b.otp || '').trim()) {
          const c = invites.otpCheck(SCOPE, t, b.otp);
          if (!c.ok) return res.status(c.status).json({ error: c.error, otp: true });
          verified = 'sms';
        } else if (phone && !b.skipSms) return res.status(400).json({ error: 'Bitte zuerst den Code aus der SMS eingeben.', otp: true });
        else remote = true;   // ohne zweiten Faktor von unterwegs: gestufte Freischaltung
      }
      const out = invites.redeem(SCOPE, t, b.pin, req.get('user-agent'), req.get('host'), { remote, verified });
      audit(null, 'Mitglieder-App: Handy freigeschaltet', `${out.member}${verified ? ' · mit SMS-Code' : remote ? ' · von unterwegs (Türen/Beregnung erst im Vereins-WLAN)' : ''}`);
      pairedMail(out.memberId, { device: req.get('user-agent'), remote, verified });
      res.json({ ok: true, device: out.device, member: out.member, staged: remote && hasSensitive(out.memberId) });
    } catch (e) { res.status(400).json({ error: e.message, ...(e.pin ? { pinWrong: true } : {}) }); }
  });
  /* Übernahme in die Home-Bildschirm-App (siehe invites.js) */
  api.post('/transfer', rateLimit('apptrc', 20, 60000), (req, res) => {
    const code = invites.createTransfer(SCOPE, dev(req));
    if (!code) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    res.json({ code });
  });
  const trFails = require('./security').limiter({ per: 10, baseMs: 15 * 60000 });
  api.post('/transfer/redeem', rateLimit('apptrr', 10, 60000), (req, res) => {
    const ip = req.ip || '';
    const wait = trFails.blocked(ip);
    if (wait) return res.status(429).json({ error: `Zu viele Versuche – bitte in ${wait} Min. erneut versuchen.` });
    const b = req.body || {};
    const r = invites.redeemTransfer(SCOPE, b.code, b.pin, req.get('user-agent'), req.get('host'));
    if (!r.ok) { if (r.badCode) trFails.fail(ip); return res.status(r.status || 400).json({ error: r.error, pin: r.pin, badCode: r.badCode }); }
    trFails.ok(ip);
    audit(null, 'Mitglieder-App: Freischaltung in Home-Bildschirm-App übernommen', r.member);
    res.json({ ok: true, device: r.device, member: r.member });
  });
  /* Lokale Route per Seitenaufruf (Vereinsheim, auch mit iCloud Privat-Relay): Code holen → Seite wechselt auf https://lan… → dort einlösen */
  api.post('/handover', rateLimit('apphoc', 20, 60000), (req, res) => {
    const url = lanUrl();
    if (!url) return res.status(400).json({ error: 'Es ist keine lokale Adresse mit https eingerichtet.' });
    const code = invites.createHandover(SCOPE, dev(req));
    if (!code) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    res.json({ code, url });
  });
  api.post('/handover/redeem', rateLimit('apphor', 10, 60000), (req, res) => {
    if (awayReq(req)) return res.status(403).json({ error: 'Die lokale Adresse lässt sich nur im Vereins-WLAN einlösen.' });
    const ip = req.ip || '';
    const wait = trFails.blocked(ip);
    if (wait) return res.status(429).json({ error: `Zu viele Versuche – bitte in ${wait} Min. erneut versuchen.` });
    const b = req.body || {};
    const r = invites.redeemHandover(SCOPE, b.code, b.pin, req.get('host'));
    if (!r.ok) { if (r.badCode) trFails.fail(ip); return res.status(r.status || 400).json({ error: r.error, pin: r.pin, badCode: r.badCode }); }
    trFails.ok(ip);
    audit(null, 'Mitglieder-App: lokale Route im Vereinsheim übernommen', r.member);
    res.json({ ok: true, device: r.device, member: r.member });
  });
  /* Push-Benachrichtigungen je Handy (Abo im Browser; Anlässe gibt der Vorstand frei) */
  const whoDev = req => { const w = invites.whoIs(SCOPE, dev(req)); return w; };
  const devLabel = req => { const d = db.prepare('SELECT device FROM member_devices WHERE id = ?').get((whoDev(req) || {}).deviceId); return d ? d.device : null; };
  api.post('/push/state', rateLimit('apppst', 60, 60000), (req, res) => {
    const w = whoDev(req); if (!w) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    res.json(push.state(w.memberId, String((req.body || {}).endpoint || '')));
  });
  api.post('/push/subscribe', rateLimit('apppsu', 20, 60000), (req, res) => {
    const w = whoDev(req); if (!w) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    try {
      const st = push.subscribe({ memberId: w.memberId, deviceId: w.deviceId, label: devLabel(req) }, (req.body || {}).subscription);
      audit(null, 'Mitglieder-App: Push eingeschaltet', w.name);
      res.json(st);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  api.post('/push/unsubscribe', rateLimit('apppsu', 20, 60000), (req, res) => {
    const w = whoDev(req); if (!w) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    if (push.unsubscribe(w.memberId, (req.body || {}).endpoint)) audit(null, 'Mitglieder-App: Push ausgeschaltet', w.name);
    res.json(push.state(w.memberId, ''));
  });
  api.put('/push/events', rateLimit('apppev', 60, 60000), (req, res) => {
    const w = whoDev(req); if (!w) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    try { res.json(push.setEvents(w.memberId, (req.body || {}).endpoint, (req.body || {}).events)); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  api.post('/push/test', rateLimit('apppte', 5, 60000), async (req, res) => {
    const w = whoDev(req); if (!w) return res.status(403).json({ error: 'Dieses Gerät ist nicht freigeschaltet.', device: true });
    const r = await push.send(w.memberId, 'app.test', { title: `${getSetting('club_name', 'Verein')}: Testnachricht`, body: 'Push-Benachrichtigungen funktionieren auf diesem Handy.' }, { endpoint: String((req.body || {}).endpoint || '') });
    res.json({ ok: r.sent > 0, sent: r.sent, skipped: r.skipped || null });
  });
  api.post('/verify-pin', rateLimit('apppin', 20, 60000), (req, res) => {
    const c = invites.check(SCOPE, dev(req), (req.body || {}).pin);
    if (!c.ok) return res.status(c.status).json({ error: c.error, pin: c.pin, device: c.device });
    res.json({ ok: true });
  });
  /* Mein Konto: PIN ändern (gilt auch am Tablet) und Abmelden. Die alte PIN zählt in dieselbe Sperre wie jede PIN-Eingabe
     am Handy (5 falsch → Pause, 15 → Handy gesperrt) – von unterwegs genauso wie im Vereins-WLAN. */
  const pinLimit = rateLimitKey('apppinc', 20, 60000, req => require('crypto').createHash('sha256').update(dev(req)).digest('hex').slice(0, 32));   // je Gerät, wie writeLimit
  api.post('/pin', rateLimit('apppinip', 60, 60000), pinLimit, (req, res) => {
    const b = req.body || {};
    const r = invites.changePin(SCOPE, dev(req), b.pin, typeof b.newPin === 'string' ? b.newPin : '');
    if (!r.ok) return res.status(r.status).json({ error: r.error, pin: r.pin, device: r.device });
    audit(null, 'Mitglieder-App: PIN geändert', r.name);
    // andere Abos des Mitglieds (z. B. die App im Vereins-WLAN) bekommen einen Hinweis – nicht das Handy, auf dem es gerade passiert ist
    push.send(r.memberId, 'app.pin', { title: `${getSetting('club_name', 'Verein')}: PIN geändert`, body: 'Deine PIN wurde geändert. Warst du das nicht, melde dich bitte beim Vorstand.' }, { except: String(b.endpoint || '') }).catch(() => {});
    res.json({ ok: true });
  });
  api.post('/unpair', rateLimit('appunp', 10, 60000), (req, res) => {
    const w = invites.unpair(SCOPE, dev(req));
    if (!w) return res.status(403).json({ error: 'Dieses Handy ist nicht (mehr) freigeschaltet.', device: true });
    audit(null, 'Mitglieder-App: Handy abgemeldet (vom Mitglied)', w.name);
    res.json({ ok: true });
  });
  /* Profilbild: das Mitglied lädt es selbst hoch und bestimmt, wo es erscheint */
  const photos = require('./photos');
  const meOr403 = (req, res) => { const w = invites.whoIs(SCOPE, dev(req)); if (!w) res.status(403).json({ error: 'Dieses Handy ist nicht (mehr) freigeschaltet.', device: true }); return w; };
  const modOn = id => { try { return require('./plugins').isActive(id); } catch (e) { return false; } };
  api.get('/privacy', (req, res) => { if (meOr403(req, res)) res.json(require('./datenschutz').notice()); });   // Datenschutzhinweis des Vereins
  api.get('/photo', (req, res) => { const w = meOr403(req, res); if (w) res.json(photos.info(w.memberId, modOn)); });
  api.put('/photo', rateLimit('appphoto', 20, 3600000), (req, res) => {
    const w = meOr403(req, res); if (!w) return;
    const b = req.body || {};
    try { if (b.data) photos.save(w.memberId, b.data, b.use, { username: 'app', name: w.name }); else photos.setUse(w.memberId, b.use); res.json(photos.info(w.memberId, modOn)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  api.delete('/photo', (req, res) => { const w = meOr403(req, res); if (!w) return; photos.remove(w.memberId, { username: 'app', name: w.name }); res.json({ ok: true }); });
  api.get('/photo/img', (req, res) => { const w = meOr403(req, res); if (w) photos.send(res, w.memberId, null); });
  api.get('/photo/of/:id', (req, res) => {   // Bilder anderer (Platzbuchung, Helferdienste) – nur gekoppelte Handys, nur mit Freigabe
    const w = meOr403(req, res); if (!w) return;
    // … und nur, wer den Bereich selbst nutzen darf (Modul aktiv, Freischaltung gültig) – der Kreis der Betrachter bleibt so, wie es die App zeigt
    const u = String(req.query.u || ''); const mod = { buchung: 'buchung', helfer: 'arbeitseinsatz' }[u];
    if (!mod || !modOn(mod) || !accessFor(w.memberId, mod).ok) return res.status(404).end();
    photos.send(res, parseInt(req.params.id, 10), u);
  });
  // Schreibende Aufrufe je Gerät bremsen (Schlüssel: Hash des Gerätetokens, nicht die Adresse – draußen teilen sich viele Handys eine Adresse,
  // drinnen könnte ein Gerät die Adresse wechseln). Schützt vor Dauerfeuer auf PIN-prüfende Routen (scrypt kostet Rechenzeit) und Türimpulse.
  const crypto = require('crypto');
  const writeLimit = rateLimitKey('mwrite', 60, 60000, req => crypto.createHash('sha256').update(dev(req)).digest('hex').slice(0, 32));
  // Module: /api/m/<id>/… – nur gekoppeltes Gerät mit Freischaltung für dieses Modul
  api.use('/m/:id', (req, res, next) => {
    const m = modules.get(req.params.id);
    if (!m || !m.isActive()) return res.status(404).json({ error: 'Dieser Bereich ist nicht aktiv.' });
    const w = invites.whoIs(SCOPE, dev(req));
    if (!w) return res.status(403).json({ error: 'Dieses Handy ist nicht (mehr) freigeschaltet. Bitte beim Vorstand einen neuen QR-Code holen.', device: true });
    const c = accessFor(w.memberId, req.params.id);
    if (!c.ok) return res.status(403).json({ error: c.reason, denied: true });
    if (!awayOk(req, req.params.id, c.row)) return res.status(403).json({ error: WLAN_ONLY, denied: true, wlanOnly: true });
    if (w.remote && m.sensitive) {
      if (awayReq(req)) return res.status(403).json({ error: STAGED, denied: true, staged: true });
      if (invites.trust(w.deviceId)) audit(null, 'Mitglieder-App: Handy im Vereins-WLAN bestätigt', w.name);
    }
    const go = () => {
      req.member = { id: w.memberId, name: w.name, access: c.row ? { ...c.row, flags: parseFlags(c.row.flags) } : null };
      /** PIN prüfen (bei jeder schaltenden Aktion) → true oder Antwort gesendet */
      req.away = awayReq(req);   // unterwegs (Tunnel oder fremdes Netz) – Module können dann strenger sein (z. B. PIN vor dem Starten der Beregnung)
      req.pinOk = () => {
        const r = invites.check(SCOPE, dev(req), (req.body || {}).pin);
        if (r.ok) return true;
        res.status(r.status).json({ error: r.error, pin: r.pin, device: r.device });
        return false;
      };
      m.router(req, res, next);
    };
    if (req.method === 'GET' || req.method === 'HEAD') return go();
    writeLimit(req, res, go);
  });
  // Öffentliche Teile der Module (ohne Anmeldung): API unter /api/p/<id>/…, Seiten unter /p/<id>/ (Ordner public/online des Moduls)
  api.use('/p/:id', rateLimit('apppub', 120, 60000), (req, res, next) => {
    const m = publics.get(req.params.id);
    if (!m || !m.isActive()) return res.status(404).json({ error: 'Dieser Bereich ist nicht aktiv.' });
    m.router(req, res, next);
  });
  app.use('/p/:id', (req, res, next) => {
    const m = publics.get(req.params.id);
    const dir = m && m.isActive() ? path.join(m.dir, 'public', 'online') : null;
    if (!dir || !fs.existsSync(dir)) return res.status(404).end();
    express.static(dir, { index: 'index.html', setHeaders: r => r.setHeader('Cache-Control', 'no-cache') })(req, res, next);
  });
  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Unbekannte Adresse.' }));
  /* Startseite der App: Skript und Stile mit Versionsnummer verknüpft (app.js?v=…) und nie zwischengespeichert –
     Home-Bildschirm-Apps auf dem iPhone halten sonst nach einem Update noch tagelang das alte Skript fest */
  const APP_DIR = path.join(__dirname, '..', 'public', 'app');
  const appIndex = (req, res) => {
    const v = encodeURIComponent(require('../package.json').version);
    let html = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8');
    const col = appColor();
    html = html.replace(/(href|src)="(app\.js|style\.css|theme\.css|kit\.css)"/g, (m, a, f) => `${a}="${f}?v=${v}${f === 'theme.css' ? '-' + col.slice(1) : ''}"`)
      .replace(/<meta name="theme-color" content="#[0-9a-fA-F]{6}">/, `<meta name="theme-color" content="${col}">`);   // Statusleiste am Handy in Vereinsfarbe
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).send(html);
  };
  app.get(['/', '/index.html'], appIndex);
  app.use(express.static(APP_DIR, { index: false, setHeaders: (r, p) => r.setHeader('Cache-Control', /\.(js|html)$/.test(p) ? 'no-store' : 'no-cache') }));
  /* Fehler immer als JSON, ohne interne Details – echte Programmfehler landen im Protokoll statt als „Ungültige Anfrage“ unterzugehen */
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Die Datei ist zu groß.' });
    if (err && (err.type === 'entity.parse.failed' || (err.status >= 400 && err.status < 500))) return res.status(400).json({ error: 'Ungültige Anfrage.' });
    console.error('Mitglieder-App:', err);
    res.status(500).json({ error: 'Interner Fehler.' });
  });
  const srv = tls.listen(app, port, process.env.HOST || '0.0.0.0', 'Mitglieder-App');
  srv.on('error', e => console.error(`Mitglieder-App: Port ${port} nicht nutzbar (${e.code || e.message}).`));
}

/* ---------- Verwaltung ---------- */
function adminRoutes(admin, { bad, need, auth }) {
  // Profilbild in der Verwaltung ansehen und bei Bedarf entfernen
  /* Push-Benachrichtigungen: welche Anlässe es im Verein gibt (Recht „Einstellungen“), Überblick und Test */
  admin.get('/push', need('app', 'konten', 'einstellungen', 'mitglieder'), (req, res) => res.json(push.adminState()));
  admin.put('/push', need('app', 'einstellungen'), (req, res) => { push.saveAdmin((req.body || {}).events, req.user); res.json(push.adminState()); });
  admin.post('/push/test', need('app', 'einstellungen'), async (req, res) => {
    const id = parseInt((req.body || {}).memberId, 10);
    const m = db.prepare('SELECT name FROM members WHERE id = ?').get(id);
    if (!m) return bad(res, 'Mitglied nicht gefunden.', 404);
    const r = await push.send(id, 'app.test', { title: `${getSetting('club_name', 'Verein')}: Testnachricht`, body: `Vom Vorstand ausgelöst (${req.user.name || req.user.username || 'Verwaltung'}).` });
    audit(req.user, 'Push-Benachrichtigungen: Testnachricht', `${m.name} – ${r.sent} gesendet${r.skipped ? ' (' + r.skipped + ')' : ''}`);
    res.json({ ok: r.sent > 0, sent: r.sent, skipped: r.skipped || null });
  });
  admin.get('/photo/:id', need('konten', 'mitglieder'), (req, res) => require('./photos').send(res, parseInt(req.params.id, 10), null));
  admin.delete('/photo/:id', need('konten', 'mitglieder'), (req, res) => { require('./photos').remove(parseInt(req.params.id, 10), req.user); res.json({ ok: true }); });
  // Wer darf? „Mitglieder“ (konten) oder das Recht des jeweiligen Moduls
  const permsAll = () => ['konten', ...moduleInfo().filter(m => !m.open).map(m => m.perm).filter(Boolean)];
  // Freischalten für einen Bereich nur mit dem Recht DIESES Bereichs (z. B. Türen nur mit dem Recht „Zugang“) –
  // „Mitglieder“ allein reicht nur für Bereiche ohne eigenes Recht.
  const mayModule = (req, module) => {
    const m = modules.get(module);
    return m && m.perm ? req.user.perms.includes(m.perm) : req.user.perms.includes('konten');
  };
  /* Einladung/QR-Code koppelt ein Handy als dieses Mitglied (Meine Daten, Buchen, Dienste) – das darf nur, wer das Mitglied
     verwalten darf („Mitglieder anlegen“ bzw. „Mitglieder“, bei Abteilungsadmins nur in der eigenen Abteilung). Modulrechte allein reichen nicht. */
  const NO_INVITE = 'Einen QR-Code oder eine Einladung für die Mitglieder-App erzeugt nur, wer das Mitglied verwalten darf (Recht „Mitglieder“) – bitte einen Admin mit diesem Recht fragen.';
  // QR-Code/Handy eines Mitglieds: nur, wer alle Bereiche verwalten darf, die das Mitglied hat
  // (sonst könnte jemand mit nur „Beregnung“ das Handy eines Mitglieds mit Türzugang übernehmen)
  /** Bereiche des Mitglieds, für die dem Admin das Recht fehlt (leer = darf).
   *  Zählen nur aktive, eigens freigeschaltete Bereiche: „für alle“-Bereiche, gesperrte Freischaltungen und
   *  Einträge abgeschalteter/entfernter Module geben keinen Zugang und blockieren deshalb nichts. */
  const missingFor = (req, memberId) => db.prepare('SELECT module, blocked FROM member_access WHERE member_id = ?').all(memberId)
    .filter(r => { const m = modules.get(r.module); return m && m.isActive() && !m.open && !r.blocked; })
    .filter(r => !mayModule(req, r.module)).map(r => modules.get(r.module).label || modules.get(r.module).name);
  admin.get('/app', (req, res, next) => need(...permsAll(), 'app')(req, res, next), (req, res) => {
    const mayMembers = permsAll().some(p => req.user.perms.includes(p));   // nur „Mitglieder-App einrichten“: keine Mitgliederliste
    const ids = db.prepare(`SELECT DISTINCT member_id FROM (SELECT member_id FROM member_devices WHERE scope = ? UNION SELECT member_id FROM member_access)`).all(SCOPE).map(r => r.member_id);
    const ms = new Map(db.prepare(`SELECT id, name, kind, active, deleted FROM members WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids).map(m => [m.id, m])), pre = statesPre();
    const rows = ids.map(id => { const m = ms.get(id); return m && !m.deleted ? { member_id: id, name: m.name, kind: m.kind, ...memberState(id, pre) } : null; })
      .filter(Boolean).sort((a, b) => require('./db').nameKey(a.name, a.kind).localeCompare(require('./db').nameKey(b.name, b.kind), 'de'));
    const have = new Set(rows.map(r => r.member_id));
    const members = db.prepare("SELECT id, name, kind FROM members WHERE kind IN ('mitglied','nichtmitglied') AND active = 1 AND deleted = 0 AND pending = 0 ORDER BY name_key(name, kind)").all().filter(m => !have.has(m.id));
    const hooked = require('./plugins').withHook('memberAddress'), canMail = Boolean(hooked.length);   // einmal statt je Mitglied
    const mailIds = canMail ? [...rows.map(x => x.member_id), ...members.map(x => x.id)].filter(id => mailOf(id, hooked)) : [];
    res.json({ startSection: getSetting('app_start', ''), formeKonto: getSetting('app_forme_konto', '0') === '1', kontoOn: require('./plugins').isActive('getraenke'), mailIds: mayMembers ? mailIds : [], mayMembers, url: qrUrl(), lanUrl: getSetting('app_url', ''), tunnel: { on: tunnelOn(), url: tunnelUrl(), lanHttps: Boolean(lanUrl()), lastReject: lastTunnelReject, lastOk: lastTunnelOk, src: getSetting('tunnel_src', ''), proxyIps: TUNNEL_IPS, directPublic: directOk(), hostNets: hostNetsCached(), wlanNets: getSetting('app_wlan_nets', ''), myIp: normIp(req.ip || req.socket.remoteAddress) }, mayExt: req.user.perms.includes('einstellungen'), name: getSetting('app_name', 'Verein'), port: parseInt(process.env.MEMBER_PORT || '5001', 10) || null, https: tls.enabled(), modules: moduleInfo(), rows: mayMembers ? rows : [], members: mayMembers ? members : [],
      security: { inviteHours: invites.inviteHours(), inviteMailDays: invites.mailDays(), mailInvites: canMail, sms: smsInfo(), allowLink: getSetting('app_invite_link', '0') === '1', mailTo: getSetting('security_mail_to', ''), blockAfter: invites.BLOCK_AFTER, mailReady: require('./mail').ready() } });
  });
  // Vereinsnetz (Einstellungen › Erreichbarkeit): nur, was die Karte braucht – ohne Mitgliederliste
  admin.get('/app/network', need('einstellungen'), (req, res) => res.json({ wlanNets: getSetting('app_wlan_nets', ''), directPublic: directOk(), hostNets: hostNetsCached(), myIp: normIp(req.ip || req.socket.remoteAddress), tunnelOn: tunnelOn() }));
  admin.get('/app/member/:id', (req, res, next) => need(...permsAll())(req, res, next), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const m = db.prepare('SELECT id, name, kind FROM members WHERE id = ? AND deleted = 0').get(id);
    if (!m) return bad(res, 'Mitglied nicht gefunden.', 404);
    const em = mailOf(id);
    res.json({ invite: { mail: Boolean(em && require('./mail').ready()), email: em, mailReady: require('./mail').ready(), sms: Boolean(smsPhone(id)), days: invites.mailDays(), localOnly: !(tunnelOn() && tunnelUrl()) }, member_id: id, name: m.name, kind: m.kind, url: qrUrl(), port: parseInt(process.env.MEMBER_PORT || '5001', 10) || null, https: tls.enabled(), modules: moduleInfo(), ...memberState(id) });
  });
  admin.post('/app/member/:id/invite', (req, res, next) => need(...permsAll())(req, res, next), (req, res) => {
    if (!auth.memberAllowed(req.user, parseInt(req.params.id, 10))) return bad(res, NO_INVITE, 403);
    { const miss = missingFor(req, parseInt(req.params.id, 10)); if (miss.length) return bad(res, `Für einen neuen QR-Code fehlt dir das Recht für: ${miss.join(', ')} – bitte einen Admin mit diesem Recht fragen.`, 403); }
    try {
      const out = invites.create(SCOPE, parseInt(req.params.id, 10), req.user.name || req.user.username, req.user.role === 'oberadmin' ? '*' : req.user.perms);
      audit(req.user, 'Mitglieder-App: QR-Einladung erzeugt', out.member);
      res.json(out);
    } catch (e) { bad(res, e.message); }
  });
  /* ----- Einladung per E-Mail (einzeln) und Sammelversand / Briefe ----- */
  const inviteOne = async (req, id, kind) => {
    if (!auth.memberAllowed(req.user, id)) return { error: 'fehlendes Recht „Mitglieder“' };
    const miss = missingFor(req, id); if (miss.length) return { error: `fehlendes Recht für ${miss.join(', ')}` };
    if (kind === 'mail' && !mailOf(id)) return { error: 'keine E-Mail-Adresse' };
    const inv = invites.create(SCOPE, id, req.user.name || req.user.username, req.user.role === 'oberadmin' ? '*' : req.user.perms, { kind });
    if (kind === 'mail') { try { await inviteMail(id, inv, req.user); } catch (e) { invites.revoke(SCOPE, id); return { error: e.message }; } return { ok: true, member: inv.member }; }
    audit(req.user, 'Mitglieder-App: Einladungsbrief', `${inv.member} · gültig bis ${deTs(inv.expiresAt)}`);
    return { ok: true, member: inv.member, url: `${qrUrl().replace(/\/+$/, '')}/#i=${inv.token}`, expiresAt: inv.expiresAt, svg: await invites.qrSvg(`${qrUrl().replace(/\/+$/, '')}/#i=${inv.token}`) };
  };
  admin.post('/app/member/:id/invite-mail', (req, res, next) => need(...permsAll())(req, res, next), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!db.prepare("SELECT 1 FROM members WHERE id = ? AND active = 1 AND deleted = 0 AND kind IN ('mitglied','nichtmitglied')").get(id)) return bad(res, 'Mitglied nicht gefunden.', 404);
    const r = await inviteOne(req, id, 'mail');
    if (r.error) return bad(res, r.error[0].toUpperCase() + r.error.slice(1) + '.');
    res.json({ ok: true, to: mailOf(id), days: invites.mailDays(), localOnly: !(tunnelOn() && tunnelUrl()), ...memberState(id) });
  });
  /** viele auf einmal: kind 'mail' (E-Mail) oder 'brief' (QR-Codes zum Ausdrucken). Gekoppelte Handys bleiben, außer force. */
  admin.post('/app/invites', (req, res, next) => need(...permsAll())(req, res, next), async (req, res) => {
    const b = req.body || {}, kind = b.kind === 'brief' ? 'brief' : 'mail';
    const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(x => parseInt(x, 10)).filter(Boolean))].slice(0, 500);
    if (!ids.length) return bad(res, 'Bitte Mitglieder auswählen.');
    if (kind === 'mail' && !require('./mail').ready()) return bad(res, 'Kein Postfach eingerichtet (Einstellungen → Postfach).');
    const done = [], skipped = [], letters = [];
    for (const id of ids) {
      const m = db.prepare("SELECT id, name FROM members WHERE id = ? AND active = 1 AND deleted = 0 AND kind IN ('mitglied','nichtmitglied')").get(id);
      if (!m) continue;
      const st = memberState(id);
      if (st.device && st.device.status === 'gekoppelt' && !b.force) { skipped.push({ name: m.name, reason: 'Handy schon gekoppelt' }); continue; }
      const r = await inviteOne(req, id, kind);
      if (r.error) skipped.push({ name: m.name, reason: r.error }); else { done.push(m.name); if (kind === 'brief') letters.push({ name: r.member, url: r.url, expiresAt: r.expiresAt, svg: r.svg }); }
    }
    if (kind === 'mail') audit(req.user, 'Mitglieder-App: Einladungen per E-Mail', `${done.length} verschickt${skipped.length ? `, ${skipped.length} übersprungen` : ''}`);
    res.json({ ok: true, kind, done, skipped, letters, days: invites.mailDays(), localOnly: !(tunnelOn() && tunnelUrl()) });
  });
  /** von unterwegs gekoppeltes Handy: Türen/Beregnung freigeben (wie nach dem ersten Besuch im Vereins-WLAN) */
  admin.post('/app/member/:id/trust', (req, res, next) => need(...permsAll())(req, res, next), (req, res) => {
    const id = parseInt(req.params.id, 10);
    { const miss = missingFor(req, id); if (miss.length) return bad(res, `Dafür fehlt dir das Recht für: ${miss.join(', ')}.`, 403); }
    const d = db.prepare('SELECT id FROM member_devices WHERE scope = ? AND member_id = ? AND token_hash IS NOT NULL').get(SCOPE, id);
    if (!d || !invites.trust(d.id)) return bad(res, 'Kein Handy, das auf die Freigabe wartet.');
    const m = db.prepare('SELECT name FROM members WHERE id = ?').get(id);
    audit(req.user, 'Mitglieder-App: Handy freigegeben (Türen/Beregnung)', m ? m.name : String(id));
    res.json({ ok: true, ...memberState(id) });
  });
  /* ----- SMS-Modem (zweiter Faktor) ----- */
  const smsLimit = new Map();
  const smsInfo = () => ({ on: sms.on(), device: sms.device(), ready: sms.ready(), candidates: sms.candidates() });
  admin.get('/app/sms', need('einstellungen'), async (req, res) => res.json({ ...smsInfo(), status: sms.device() ? await sms.status() : null }));
  admin.post('/app/sms/detect', need('einstellungen'), async (req, res) => res.json({ ports: await sms.detect() }));
  admin.put('/app/sms', need('einstellungen'), (req, res) => {
    const b = req.body || {};
    if (b.device !== undefined) { const d = String(b.device || ''); if (d && !sms.validDevice(d)) return bad(res, 'Ungültiger Anschluss.'); setSetting('sms_device', d); }
    if (b.on !== undefined) { if (b.on && !sms.device()) return bad(res, 'Bitte zuerst den Anschluss des Sticks wählen.'); setSetting('sms_on', b.on ? '1' : '0'); }
    audit(req.user, 'Mitglieder-App: SMS-Bestätigung', `${sms.on() ? 'an' : 'aus'}${sms.device() ? ' · ' + sms.device() : ''}`);
    res.json(smsInfo());
  });
  admin.post('/app/sms/test', need('einstellungen'), async (req, res) => {
    const k = req.user.id || req.user.username, last = smsLimit.get(k) || [];
    const recent = last.filter(t => Date.now() - t < 3600000); if (recent.length >= 5) return bad(res, 'Höchstens 5 Test-SMS pro Stunde.', 429);
    const to = sms.normPhone((req.body || {}).number); if (!to) return bad(res, 'Bitte eine Handynummer eingeben (z. B. 0170 1234567).');
    smsLimit.set(k, [...recent, Date.now()]);
    try { await sms.send(to, `${getSetting('club_name', 'Verein')}: Test-SMS aus Clubwerk. Der Versand funktioniert.`); audit(req.user, 'Mitglieder-App: Test-SMS', sms.maskPhone(to)); res.json({ ok: true, to: sms.maskPhone(to) }); }
    catch (e) { bad(res, e.message, 502); }
  });
  admin.delete('/app/member/:id/device', (req, res, next) => need(...permsAll())(req, res, next), (req, res) => {
    const id = parseInt(req.params.id, 10);
    { const miss = missingFor(req, id); if (miss.length) return bad(res, `Zum Entfernen des Handys fehlt dir das Recht für: ${miss.join(', ')} – bitte einen Admin mit diesem Recht fragen.`, 403); }
    const m = db.prepare('SELECT name FROM members WHERE id = ?').get(id);
    invites.revoke(SCOPE, id); push.removeMember(id);
    audit(req.user, 'Mitglieder-App: Handy entfernt', m ? m.name : String(id));
    res.json({ ok: true });
  });
  /** Ganz aus der App entfernen: Handy und alle Freischaltungen weg – das Mitglied steht danach wieder unter „Mitglied freischalten“ */
  admin.delete('/app/member/:id', (req, res, next) => need(...permsAll())(req, res, next), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const m = db.prepare('SELECT name FROM members WHERE id = ?').get(id);
    if (!m) return bad(res, 'Mitglied nicht gefunden.', 404);
    const miss = missingFor(req, id);
    if (miss.length) return bad(res, `Zum Entfernen aus der App fehlt dir das Recht für: ${miss.join(', ')} – bitte einen Admin mit diesem Recht fragen.`, 403);
    invites.revoke(SCOPE, id); push.removeMember(id);
    const n = db.prepare('DELETE FROM member_access WHERE member_id = ?').run(id).changes;
    audit(req.user, 'Mitglieder-App: aus der App entfernt', `${m.name} (Handy und ${n} ${n === 1 ? 'Freischaltung' : 'Freischaltungen'})`);
    res.json({ ok: true });
  });
  /** Bereich (Türen, Beregnung …) allen Mitgliedern auf einmal entziehen – z. B. wenn er nur noch für Platzwart und Vorstand da sein soll */
  admin.post('/app/module/:id/revoke-all', need('einstellungen'), (req, res) => {
    const mod = modules.get(req.params.id);
    if (!mod || mod.open) return bad(res, 'Diesen Bereich gibt es nicht oder er gilt für alle.');
    const keep = new Set((Array.isArray((req.body || {}).keep) ? req.body.keep : []).map(Number));
    const rows = access.list(req.params.id).filter(r => !keep.has(r.member_id));
    db.transaction(() => rows.forEach(r => access.remove(r.member_id, req.params.id)))();
    audit(req.user, 'Mitglieder-App: Bereich allen entzogen', `${mod.label || mod.name}: ${rows.length} Mitglieder${keep.size ? `, ${keep.size} behalten` : ''}`);
    res.json({ ok: true, removed: rows.length });
  });
  admin.put('/app/member/:id/access', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const mod = modules.get(String(b.module || ''));
    if (!mod || !mod.isActive()) return bad(res, 'Unbekannter Bereich.');
    if (!mayModule(req, b.module)) return bad(res, 'Dafür fehlt dir die Berechtigung.', 403);
    const m = db.prepare("SELECT name, kind FROM members WHERE id = ? AND deleted = 0 AND kind IN ('mitglied','nichtmitglied')").get(id);
    if (!m) return bad(res, 'Mitglied nicht gefunden.', 404);
    const nm = m.kind === 'nichtmitglied';
    if (nm && !mod.nonMembers) return bad(res, ONLY_MEMBERS);
    const open = mod.open && !nm;   // „für alle“ gilt nur für Mitglieder – „Kein Mitglied“ braucht immer eine eigene Freischaltung
    if (b.flags !== undefined && b.grant === undefined) {   // zusätzliche Haken des Moduls (z. B. Buchen → „Gebühren zeigen“)
      const cur = access.get(id, b.module);
      if (!open && !cur) return bad(res, 'Zuerst den Bereich freischalten.');
      let opts = null; try { opts = mod.hooks.accessOptions ? mod.hooks.accessOptions() : null; } catch (e) { opts = null; }
      const known = ((opts && opts.flags) || []).map(f => f.id);
      const next = { ...(cur ? parseFlags(cur.flags) : {}) };
      const changed = [];
      for (const [k, v] of Object.entries(b.flags && typeof b.flags === 'object' ? b.flags : {})) { if (!known.includes(k)) return bad(res, 'Unbekannte Einstellung.'); if (v) next[k] = true; else delete next[k]; changed.push(`${((opts.flags.find(f => f.id === k) || {}).label) || k}: ${v ? 'an' : 'aus'}`); }
      const keep = Object.keys(next).length ? JSON.stringify(next) : null;
      if (open && cur && !cur.blocked && !cur.away && !keep) access.remove(id, b.module); else access.set(id, b.module, { flags: keep, blocked: cur ? cur.blocked : 0 });
      audit(req.user, `${mod.name}: ${changed.join(', ') || 'Einstellung geändert'}`, m.name);
      return res.json({ ok: true, ...memberState(id) });
    }
    if (b.away !== undefined && b.grant === undefined) {   // Ausnahme „auch unterwegs“ (nur sinnvoll für Bereiche, die sonst nur im WLAN gelten)
      const cur = access.get(id, b.module);
      if (!open && !cur) return bad(res, 'Zuerst den Bereich freischalten.');
      if (b.away) access.set(id, b.module, { away: 1, blocked: cur ? cur.blocked : 0 });
      else if (open && cur && !cur.blocked && !hasFlags(cur)) access.remove(id, b.module); else access.set(id, b.module, { away: 0 });
      audit(req.user, `${mod.name}: ${b.away ? 'auch von unterwegs nutzbar' : 'nur noch im Vereins-WLAN'}`, m.name);
      return res.json({ ok: true, ...memberState(id) });
    }
    if (open && (b.grant === false || b.grant === true)) {
      // Bereich „für alle“: Haken weg = für dieses Mitglied abgeschaltet, Haken dran = wieder wie alle (eine Ausnahme „unterwegs“ bleibt erhalten)
      if (b.grant) { const cur = access.get(id, b.module); if (cur && (cur.away || hasFlags(cur))) access.set(id, b.module, { blocked: 0 }); else access.remove(id, b.module); } else access.set(id, b.module, { blocked: 1 });
      audit(req.user, `${mod.name}: ${b.grant ? 'in der App freigeschaltet' : 'in der App abgeschaltet'}`, m.name);
      return res.json({ ok: true, reinvite: false, ...memberState(id) });
    }
    if (b.grant === false) {
      access.remove(id, b.module);
      audit(req.user, `${mod.name}: Freischaltung entzogen`, m.name);
      return res.json({ ok: true });
    }
    const fields = {};
    if (b.valid_until !== undefined) { if (b.valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(b.valid_until)) return bad(res, 'Ungültiges Datum.'); fields.valid_until = b.valid_until || null; }
    if (b.blocked !== undefined) fields.blocked = b.blocked ? 1 : 0;
    const opts = mod.hooks.accessOptions ? mod.hooks.accessOptions() : null;
    if (b.profile !== undefined) {
      if (opts && opts.profiles && !opts.profiles.some(p => p.id === b.profile)) return bad(res, 'Unbekanntes Profil.');
      fields.profile = b.profile;
    }
    const isNew = !access.get(id, b.module);
    if (isNew && fields.profile === undefined && opts && opts.defaultProfile) fields.profile = opts.defaultProfile;
    // Handy/Einladung wurde von jemandem erzeugt, der diesen Bereich nicht verwalten darf → entkoppeln, neuer QR-Code nötig
    let reinvite = false;
    if (isNew && mod.perm && !invites.issuerCovers(SCOPE, id, mod.perm)) {
      invites.revoke(SCOPE, id); reinvite = true;
      audit(req.user, 'Mitglieder-App: Handy entkoppelt (neuer Bereich, Einladung von Admin ohne dieses Recht)', m.name);
    }
    access.set(id, b.module, fields);
    audit(req.user, `${mod.name}: ${isNew ? 'freigeschaltet' : 'Freischaltung geändert'}`, m.name);
    res.json({ ok: true, reinvite, ...memberState(id) });
  });
  admin.put('/settings/app', need('app', 'einstellungen'), (req, res) => {
    const mayCfg = req.user.perms.includes('app') || req.user.perms.includes('einstellungen');
    const b = req.body || {};
    // Adresse im QR-Code und Sicherheitseinstellungen nur mit „Einstellungen“ – sonst könnte jemand mit „Mitglieder“
    // alle späteren QR-Codes auf eine fremde Seite umleiten und Einladungen abgreifen
    if ((b.url !== undefined || b.inviteHours !== undefined || b.inviteMailDays !== undefined || b.allowLink !== undefined || b.mailTo !== undefined) && !req.user.perms.includes('einstellungen'))
      return bad(res, 'Adresse und Sicherheit der Mitglieder-App darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
    if (b.url !== undefined) { const u = String(b.url || '').trim().replace(/\/+$/, ''); if (u && !/^https?:\/\/[A-Za-z0-9.\-[\]:]+$/.test(u)) return bad(res, 'Bitte eine Adresse wie http://homeassistant.local:5001 eintragen.'); setSetting('app_url', u); }
    if ((b.tunnel !== undefined || b.tunnelUrl !== undefined) && !req.user.perms.includes('einstellungen')) return bad(res, 'Den externen Zugang darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
    if (b.tunnelSrc !== undefined) {   // Tunnel-Quelle festlegen (leer = jede Adresse im Add-on-Netz)
      if (!req.user.perms.includes('einstellungen')) return bad(res, 'Den externen Zugang darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
      const t = String(b.tunnelSrc || '').trim();
      if (t && !/^172\.30\.3[23]\.\d{1,3}$/.test(t) && !require('net').isIP(t)) return bad(res, 'Bitte eine IP-Adresse eintragen.');
      setSetting('tunnel_src', t);
      audit(req.user, 'Mitglieder-App: Tunnel-Quelle', t || 'jede Adresse im Add-on-Netz');
    }
    if (b.sectionsOn !== undefined) {   // { modul: true|false } – Bereich in der App zeigen (aus: Reiter für alle weg, Freischaltungen bleiben)
      if (!mayCfg) return bad(res, 'Nur mit dem Recht „Mitglieder-App einrichten“.', 403);
      const off = appOff();
      for (const [k, v] of Object.entries(b.sectionsOn || {})) if (modules.has(k)) { if (v) off.delete(k); else off.add(k); }
      setSetting('app_off', JSON.stringify([...off]));
      audit(req.user, 'Mitglieder-App: Bereiche ein-/ausgeschaltet', Object.entries(b.sectionsOn || {}).filter(([k]) => modules.has(k)).map(([k, v]) => `${(modules.get(k) || {}).label || k}: ${v ? 'an' : 'aus'}`).join(', '));
    }
    if (b.preselect !== undefined) {   // { modul: true|false } – beim Freischalten vorausgewählt
      if (!mayCfg) return bad(res, 'Nur mit dem Recht „Mitglieder-App einrichten“.', 403);
      const o = {}; for (const [k, v] of Object.entries(b.preselect || {})) if (modules.has(k)) o[k] = Boolean(v);
      setSetting('app_preselect', JSON.stringify(o));
      audit(req.user, 'Mitglieder-App: Vorauswahl beim Freischalten', Object.entries(o).map(([k, v]) => `${(modules.get(k) || {}).label || k}: ${v ? 'ja' : 'nein'}`).join(', '));
    }
    if (b.directPublic !== undefined) {
      if (!req.user.perms.includes('einstellungen')) return bad(res, 'Den externen Zugang darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
      setSetting('app_direct_public', b.directPublic ? '1' : '0');
      audit(req.user, 'Mitglieder-App: direkter Zugang ohne Tunnel', b.directPublic ? 'erlaubt' : 'gesperrt');
    }
    if (b.wlanNets !== undefined) {   // Vereinsnetze (CIDR) – leer = jede private Adresse
      if (!req.user.perms.includes('einstellungen')) return bad(res, 'Die Vereinsnetze darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
      const v = String(b.wlanNets || '').trim().slice(0, 300);
      if (v && !validNets(v)) return bad(res, 'Bitte Netze wie 192.168.10.0/24 eintragen (mehrere mit Komma).');
      // nicht selbst aussperren: Wer direkt (nicht über die Seitenleiste) verwaltet, muss im neuen Netz liegen
      const me = normIp(req.socket.remoteAddress);
      const direct = !(req.get('X-Ingress-Path') && me === '172.30.32.2') && !/^127\./.test(me) && me !== '::1';
      if (v && direct && !cidrList(v).some(f => f(me))) return bad(res, `Dein Gerät (${me}) läge nicht in diesen Netzen – du würdest dich aus Verwaltung und Tablet aussperren. Bitte dein Netz mit eintragen.`);
      setSetting('app_wlan_nets', v.split(/[\s,;]+/).filter(Boolean).join(', '));
      audit(req.user, 'Mitglieder-App: Vereinsnetze geändert', v || 'alle privaten Adressen');
    }
    if (b.tunnelUrl !== undefined) {
      const u = String(b.tunnelUrl || '').trim().replace(/\/+$/, '');
      if (u && !/^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(u)) return bad(res, 'Bitte die öffentliche Adresse wie https://app.meinverein.de eintragen (mit https, ohne Port).');
      setSetting('ext_tunnel_url', u.toLowerCase());
    }
    if (b.tunnel !== undefined) {
      if (b.tunnel && !tunnelUrl()) return bad(res, 'Bitte zuerst die öffentliche Adresse eintragen.');
      setSetting('ext_tunnel', b.tunnel ? '1' : '0');
      audit(req.user, b.tunnel ? 'Mitglieder-App: externer Zugang eingeschaltet' : 'Mitglieder-App: externer Zugang ausgeschaltet', tunnelUrl());
    }
    require('./security').resetHostCache();
    if (b.name !== undefined) setSetting('app_name', String(b.name || '').trim().slice(0, 20) || 'Verein');
    if (b.extModules !== undefined) {
      if (!req.user.perms.includes('einstellungen')) return bad(res, 'Was von unterwegs nutzbar ist, darf nur ändern, wer das Recht „Einstellungen“ hat.', 403);
      const cur = extCfg(), next = { ...cur };
      for (const [k, v] of Object.entries(b.extModules && typeof b.extModules === 'object' ? b.extModules : {})) if (modules.has(k)) next[k] = Boolean(v);
      setSetting('app_ext_modules', JSON.stringify(next));
      audit(req.user, 'Mitglieder-App: von unterwegs nutzbar', activeModules().map(([k, m]) => `${m.label || m.name}: ${extAllowed(k) ? 'ja' : 'nein'}`).join(', '));
    }
    if (b.startSection !== undefined) {   // Startseite der App: fester Bereich oder '' = „Für mich“
      const s = String(b.startSection || '');
      if (s && !modules.has(s)) return bad(res, 'Diesen Bereich gibt es nicht.');
      setSetting('app_start', s);
      audit(req.user, 'Mitglieder-App: Startseite', s ? modules.get(s).label || modules.get(s).name || s : 'Für mich');
    }
    if (b.formeKonto !== undefined) {   // „Für mich“ zeigt das offene Thekenkonto
      if (!mayCfg) return bad(res, 'Nur mit dem Recht „Mitglieder-App einrichten“.', 403);
      const v = b.formeKonto ? '1' : '0';
      if (v !== getSetting('app_forme_konto', '0')) audit(req.user, 'Mitglieder-App: Thekenkonto in „Für mich“', v === '1' ? 'an' : 'aus');
      setSetting('app_forme_konto', v);
    }
    if (b.moduleOrder !== undefined) {   // Reihenfolge der Bereiche in der App
      if (!mayCfg) return bad(res, 'Nur mit dem Recht „Mitglieder-App einrichten“.', 403);
      const order = [...new Set((Array.isArray(b.moduleOrder) ? b.moduleOrder : []).map(String).filter(k => modules.has(k)))].slice(0, 40);
      setSetting('app_module_order', JSON.stringify(order));
      audit(req.user, 'Mitglieder-App: Reihenfolge der Bereiche geändert', activeModules().map(([, m]) => m.label || m.name).join(', '));
    }
    if (b.inviteHours !== undefined) { const h = parseInt(b.inviteHours, 10); if (!invites.INVITE_HOURS.includes(h)) return bad(res, 'Ungültige Gültigkeit.'); setSetting('app_invite_hours', String(h)); }
    if (b.inviteMailDays !== undefined) { const d = parseInt(b.inviteMailDays, 10); if (!invites.MAIL_DAYS.includes(d)) return bad(res, 'Ungültige Gültigkeit.'); setSetting('app_invite_mail_days', String(d)); }
    if (b.allowLink !== undefined) setSetting('app_invite_link', b.allowLink ? '1' : '0');
    if (b.mailTo !== undefined) { const t = String(b.mailTo || '').trim(); if (t && !require('./mail').mailOk(t)) return bad(res, 'Bitte eine gültige E-Mail-Adresse eintragen (mehrere mit Komma).'); setSetting('security_mail_to', t); }
    if (b.inviteHours !== undefined || b.allowLink !== undefined || b.mailTo !== undefined) audit(req.user, 'Mitglieder-App: Sicherheit geändert', `QR ${getSetting('app_invite_hours', '24')} Std., Link ${getSetting('app_invite_link', '0') === '1' ? 'erlaubt' : 'aus'}`);
    res.json({ ok: true });
  });
  /* Externer Zugang prüfen: die öffentliche Adresse von hier aus aufrufen */
  admin.post('/app/tunnel-check', need('einstellungen'), async (req, res) => {
    const u = tunnelUrl(); if (!u) return bad(res, 'Noch keine öffentliche Adresse eingetragen.');
    try {
      const r = await fetch(u + '/api/ping', { signal: AbortSignal.timeout(8000), redirect: 'manual' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.app === 'clubwerk') return res.json({ ok: true, tunnel: Boolean(d.tunnel), on: tunnelOn(), cf: Boolean(r.headers.get('cf-ray')) });
      // 403 bei eingeschaltetem Zugang: Die Anfrage kam an, wurde aber abgelehnt – meist, weil das Cloudflared-Add-on von einer unerwarteten Adresse kommt
      const rj = lastTunnelReject && Date.now() - Date.parse(lastTunnelReject.at) < 60000 ? lastTunnelReject : null;
      const src = rj && rj.why === 'quelle' ? `Die Anfrage kam von der Adresse ${rj.ip}, der Clubwerk nicht traut – kommt sie vom Cloudflared-Add-on, diese Adresse in der Add-on-Konfiguration von Clubwerk unter „proxy_addon_ip“ eintragen.` : '';
      res.json({ ok: false, error: r.status === 403 ? (tunnelOn() ? ['Erreicht, aber die Anfrage wurde abgelehnt.', src].filter(Boolean).join(' ') : 'Erreicht, aber der externe Zugang ist hier noch ausgeschaltet.') : `Die Adresse antwortet, aber nicht mit der Mitglieder-App (HTTP ${r.status}). Zeigt der Tunnel auf den Port der Mitglieder-App?`, lastReject: rj });
    } catch (e) { res.json({ ok: false, error: 'Keine Antwort von außen – Tunnel läuft nicht oder der Name ist bei Cloudflare noch nicht eingerichtet.' }); }
  });
  admin.post('/qr', async (req, res) => {
    const u = String((req.body || {}).url || '');
    if (!/^https?:\/\/[^\s]+$/.test(u) || u.length > 500) return bad(res, 'Ungültige Adresse.');
    res.json({ svg: await invites.qrSvg(u) });
  });
}

/** Adresse der Mitglieder-App für Links in E-Mails (von unterwegs, sonst im Vereins-WLAN) – nur https, sonst leer */
const appUrl = () => { const u = String(qrUrl() || '').replace(/\/+$/, ''); return /^https:\/\//i.test(u) ? u : ''; };
module.exports = { appUrl, netsFromInfo, register, registerPublic, accessFor, access, startPort, adminRoutes, SCOPE, memberState, moduleInfo, activeModules, fromTunnel, awayReq, PRIVATE_IP, isClubNet, inClubNets, hasClubNets, validNets, cidrList };
