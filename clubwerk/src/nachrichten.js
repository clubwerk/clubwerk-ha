'use strict';
/**
 * Nachrichten in der Mitglieder-App (Postfach des Mitglieds)
 * Die Nachrichten schreibt die Verwaltung (Verein → Nachrichten, src/mailer.js); hier liest ein Mitglied nur seine eigenen:
 * Liste, einzelne Nachricht (wird dabei als gelesen markiert) und Anhänge. Der Bereich erscheint in der App wie ein Modul
 * (memberapp.register) – ohne eigene Freischaltung, für jedes gekoppelte Handy eines Mitglieds, sobald der Verein ihn nutzt.
 * Datenschutz: Der Gelesen-Stand ist nur für das Mitglied selbst sichtbar (fett/normal); die Verwaltung bekommt höchstens eine Zahl.
 */
const path = require('path');
const express = require('express');
const { db } = require('./db');
const { today, esc } = require('./util');
const M = require('./mailer');

const J = M.J;
/** Wer? Name und Anredefelder für Platzhalter wie {vorname} – ohne Mitgliederverwaltung nur der Name */
function personOf(id) {
  const base = db.prepare('SELECT id, name, kind FROM members WHERE id = ?').get(id);
  if (!base) return null;
  try { return { ...base, ...(db.prepare('SELECT first_name, last_name, salutation, letter_salutation, member_no FROM mv_person WHERE member_id = ?').get(id) || {}) }; } catch (e) { return base; }
}
const varsOf = id => M.vars({ name: '', email: '', person: personOf(id) });
/** Links werden in der App nie geöffnet (kein neues Fenster, kein Safari): Text bleibt, die Adresse steht daneben zum Abschreiben */
function appHtml(html) {
  return String(html || '')
    .replace(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, t) => {
      const url = href.replace(/&amp;/g, '&').replace(/^mailto:/i, '');
      const label = t.replace(/<[^>]+>/g, '').trim();
      const shown = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
      return !label || label === url || label === shown ? `<span class="vh-url" translate="no">${esc(shown)}</span>` : `${t} <span class="vh-url" translate="no">(${esc(shown)})</span>`;
    })
    .replace(/<\/?a>/gi, '');
}
const plainOf = html => M.toText(html).replace(/\s+/g, ' ').trim();

/** sichtbare Nachrichten dieses Mitglieds: angeheftet zuerst, dann neueste oben */
function listOf(memberId) {
  const day = today();
  return db.prepare(`SELECT m.id, m.subject, m.html, m.files, m.from_name, m.user_name, m.sent_at, m.pinned, m.expires_at, i.read_at
    FROM msg_inbox i JOIN mail_message m ON m.id = i.message_id
    WHERE i.member_id = ? AND m.status != 'entwurf' AND (m.pinned = 1 OR m.expires_at IS NULL OR m.expires_at >= ?)
    ORDER BY m.pinned DESC, m.sent_at DESC, m.id DESC LIMIT 200`).all(memberId, day);
}
const unread = memberId => listOf(memberId).filter(m => !m.read_at).sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)) || b.id - a.id);   // die neueste zuerst, angeheftet zählt hier nicht
/** Der Bereich erscheint, sobald der Verein App-Nachrichten verschickt hat (oder dieses Mitglied eine hat) – vorher bleibt die Leiste unverändert */
function visibleFor(memberId) {
  if (db.prepare('SELECT 1 FROM msg_inbox WHERE member_id = ? LIMIT 1').get(memberId)) return true;
  return Boolean(db.prepare(`SELECT 1 FROM mail_message WHERE status != 'entwurf' AND channels LIKE '%"app"%' LIMIT 1`).get());
}

const SAFE = { 'image/jpeg': [0xff, 0xd8], 'image/png': [0x89, 0x50], 'image/gif': [0x47, 0x49], 'image/webp': [0x52, 0x49], 'application/pdf': [0x25, 0x50] };
/** Nur Bilder und PDF werden in der App gezeigt, wenn der Anfang der Datei zum Typ passt – alles andere bleibt ein Download */
const safeType = (f, buf) => (SAFE[f.type] && buf.length > 4 && SAFE[f.type].every((b, i) => buf[i] === b) ? f.type : 'application/octet-stream');
const kindOf = f => (/^image\/(jpeg|png|gif|webp)$/.test(f.type || '') ? 'image' : f.type === 'application/pdf' ? 'pdf' : 'other');

function router() {
  const r = express.Router();
  const own = (req, id) => db.prepare(`SELECT m.*, i.read_at FROM msg_inbox i JOIN mail_message m ON m.id = i.message_id WHERE i.message_id = ? AND i.member_id = ? AND m.status != 'entwurf'`).get(id, req.member.id);
  const gone = res => res.status(404).json({ error: 'Diese Nachricht gibt es nicht (mehr).' });

  r.get('/list', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const v = varsOf(req.member.id), rows = listOf(req.member.id);
    res.json({ items: rows.map(m => ({ id: m.id, subject: M.fillText(m.subject, v), preview: plainOf(M.fillHtml(m.html, v)).slice(0, 110), from: m.from_name || m.user_name || '', at: m.sent_at, pinned: Boolean(m.pinned), read: Boolean(m.read_at), files: J(m.files, []).length })),
      unread: rows.filter(m => !m.read_at).length });
  });
  r.get('/msg/:id', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const m = own(req, parseInt(req.params.id, 10));
    if (!m || !M.inApp(m)) return gone(res);
    db.prepare("UPDATE msg_inbox SET read_at = datetime('now','localtime') WHERE message_id = ? AND member_id = ? AND read_at IS NULL").run(m.id, req.member.id);
    const v = varsOf(req.member.id);
    res.json({ id: m.id, subject: M.fillText(m.subject, v), html: appHtml(M.fillHtml(m.html, v) + M.sigBlock(m.signature_html)), from: m.from_name || m.user_name || '', at: m.sent_at, pinned: Boolean(m.pinned),
      files: J(m.files, []).map(f => ({ id: f.id, name: f.name, size: f.size, kind: kindOf(f) })) });
  });
  r.get('/file/:id/:fid', (req, res) => {
    const m = own(req, parseInt(req.params.id, 10));
    if (!m || !M.inApp(m)) return res.status(404).end();
    const f = J(m.files, []).find(x => x.id === req.params.fid);
    if (!f || !require('fs').existsSync(M.filePath(m.id, f))) return res.status(404).end();
    let buf; try { buf = require('./vault').readFile(M.filePath(m.id, f)); } catch (e) { return res.status(e.vaultLocked ? 423 : 404).end(); }
    const type = safeType(f, buf);
    res.set({ 'Content-Type': type, 'Content-Disposition': `${type === 'application/octet-stream' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" });
    res.end(buf);
  });
  return r;
}

/** Für die Datenauskunft (Art. 15): die an dieses Mitglied gerichteten Nachrichten samt Gelesen-Stand */
function dataOf(memberId) {
  const v = varsOf(memberId);
  return db.prepare(`SELECT m.subject, m.html, m.sent_at, m.pinned, m.expires_at, m.files, m.from_name, i.read_at, i.push FROM msg_inbox i JOIN mail_message m ON m.id = i.message_id
    WHERE i.member_id = ? AND m.status != 'entwurf' ORDER BY m.sent_at DESC`).all(memberId)
    .map(m => ({ betreff: M.fillText(m.subject, v), text: M.toText(M.fillHtml(m.html, v)), gesendet: m.sent_at, absender: m.from_name || '', geoeffnet: m.read_at || null, push_gesendet: m.push === 'ja', angeheftet: Boolean(m.pinned),
      sichtbar_bis: m.pinned ? null : m.expires_at || null, anhaenge: J(m.files, []).map(f => f.name) }));
}

/** Eintrag für memberapp.register */
function info() {
  const dir = path.join(__dirname, '..', 'public', 'app', 'nachrichten');
  return {
    name: 'Nachrichten', label: 'Nachrichten', order: 6, dir, publicDir: dir, router: router(), isActive: () => true, perm: 'email', scripts: [], open: true, away: true, nonMembers: false, sensitive: false,
    hooks: {
      appVisible: visibleFor,
      pushEvents: () => [{ id: 'nachricht', label: 'Nachrichten vom Verein', desc: 'Der Vorstand hat dir eine Nachricht geschickt – du bekommst nur den Hinweis, gelesen wird sie in der App.', default: true }],
      /** „Für mich › Neu für dich“: die neueste ungelesene Nachricht (verschwindet, sobald sie geöffnet wurde) */
      forMe: memberId => {
        const m = unread(memberId)[0];
        return m ? { news: [{ key: 'n' + m.id, title: M.fillText(m.subject, varsOf(memberId)), sub: 'Neue Nachricht vom Verein', focus: String(m.id) }] } : {};
      },
    },
  };
}

module.exports = { info, unread, visibleFor, appHtml, personOf, dataOf };
