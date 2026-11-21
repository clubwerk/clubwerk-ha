'use strict';
/* ---------- Sonderdesigns der Mitglieder-App (planung/sonderdesign.md) ----------
   Ein Eintrag gilt für einen Zeitraum von höchstens 8 Wochen (nie dauerhaft), auf Wunsch jedes Jahr (dann zählen nur Tag und Monat,
   auch über den Jahreswechsel). Bausteine: Hintergrundbild „für hell“ und „für dunkel“ (je optional) und ein Gruß oben in „Für mich“.
   Überschneiden sich Einträge, gilt der kürzere ganz; bei gleicher Länge der später angelegte.
   Die Bilder liegen wie das Vereinslogo in der Datenbank (stecken in jeder Sicherung) und sind unter einer versionierten Adresse
   öffentlich abrufbar (kein Geheimnis, wie das Logo). Die Verwaltung verkleinert und misst sie im Browser; der Server prüft Format am
   Inhalt, Größe, Maße und den Kontrast der mitgeschickten Farbe am oberen Rand gegen die Schrift. */
const crypto = require('crypto');
const { db, audit, auditDiff } = require('./db');
const { today, imageType } = require('./util');

db.exec(`
CREATE TABLE IF NOT EXISTS app_sonder (   -- Sonderdesigns der Mitglieder-App
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,               -- nur intern („Advent“)
  von        TEXT NOT NULL,               -- JJJJ-MM-TT
  bis        TEXT NOT NULL,               -- JJJJ-MM-TT einschließlich
  jaehrlich  INTEGER NOT NULL DEFAULT 0,  -- 1 = jedes Jahr (nur Tag und Monat zählen)
  bausteine  TEXT NOT NULL DEFAULT '{}',  -- JSON: { gruss: { titel, text } } – weitere Bausteine ohne Umbau
  bild_hell BLOB, typ_hell TEXT, top_hell TEXT,
  bild_dunkel BLOB, typ_dunkel TEXT, top_dunkel TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`);

const MAX_TAGE = 56;                      // höchstens 8 Wochen
const MAX_BYTES = 1024 * 1024;            // je Bild höchstens 1 MB (die Verwaltung zielt auf unter 400 KB)
const MAX_W = 1290, MAX_H = 2796;         // Hochformat wie ein großes iPhone
const MIN_W = 600;                        // darunter ist das Bild am Handy nicht mehr brauchbar (unter 1170 px warnt die Verwaltung nur)
const TYPEN = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };
const ARTEN = ['hell', 'dunkel'];
/* Schrift direkt auf dem Bild (Kopf der App: Vereinsname in --muted, Seitentitel in --ink) – Werte aus public/style.css (hell / dunkel) */
const SCHRIFT = { hell: { ink: '#141a16', muted: '#56625a' }, dunkel: { ink: '#e8eee9', muted: '#a7b2aa' } };

/* ---------- Farben und Kontrast (WCAG) ---------- */
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Reicht die Farbe am oberen Bildrand für die Schrift dieser Darstellung? (schwächere Schrift = --muted) */
const obenLesbar = (art, top) => Math.min(kontrast(SCHRIFT[art].ink, top), kontrast(SCHRIFT[art].muted, top)) >= 4.5;

/* ---------- Maße am Inhalt (PNG, JPEG, WebP) ---------- */
function masse(b, typ) {
  try {
    if (typ === 'png') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (typ === 'jpg') {
      for (let i = 2; i + 9 < b.length;) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        i += 2 + b.readUInt16BE(i + 2);
      }
      return null;
    }
    if (typ === 'webp') {
      const f = b.subarray(12, 16).toString('latin1');
      if (f === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (f === 'VP8L') { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
      if (f === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
    }
  } catch (e) { return null; }   // abgeschnittene Datei: keine Maße
  return null;
}

/* ---------- Zeitraum ---------- */
const DAY = 864e5;
const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const isDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && new Date(utc(d)).toISOString().slice(0, 10) === d;
const md = d => d.slice(5, 10);
/** Länge in Tagen (einschließlich). Jedes Jahr: nur Tag und Monat, „bis“ vor „von“ = über den Jahreswechsel */
function laenge(e) {
  if (!e.jaehrlich) return Math.round((utc(e.bis) - utc(e.von)) / DAY) + 1;
  const a = utc('2004-' + md(e.von)), b = utc((md(e.bis) < md(e.von) ? '2005-' : '2004-') + md(e.bis));   // 2004: Schaltjahr (29.02.)
  return Math.round((b - a) / DAY) + 1;
}
/** Gilt der Eintrag am Tag t (JJJJ-MM-TT)? */
function gilt(e, t) {
  if (!e.jaehrlich) return e.von <= t && t <= e.bis;
  const a = md(e.von), b = md(e.bis), x = md(t);
  return a <= b ? a <= x && x <= b : x >= a || x <= b;
}
/** Nächster Beginn ab dem Tag t (für „als Nächstes“), sonst null (abgelaufen) */
function beginn(e, t) {
  if (!e.jaehrlich) return e.von > t ? e.von : null;
  const y = +t.slice(0, 4), d = `${y}-${md(e.von)}`;
  return d > t ? d : `${y + 1}-${md(e.von)}`;
}
const alle = () => db.prepare('SELECT id, name, von, bis, jaehrlich, bausteine, typ_hell, typ_dunkel, top_hell, top_dunkel, created_at, length(bild_hell) AS n_hell, length(bild_dunkel) AS n_dunkel FROM app_sonder ORDER BY id').all()
  .map(r => { let b = {}; try { b = JSON.parse(r.bausteine || '{}') || {}; } catch (e) { b = {}; } return { ...r, jaehrlich: Boolean(r.jaehrlich), gruss: b.gruss && b.gruss.titel ? b.gruss : null }; });
/** Heute geltender Eintrag: der kürzere Zeitraum gewinnt ganz, bei gleicher Länge der später angelegte */
function geltend(t = today(), liste = alle()) {
  return liste.filter(e => gilt(e, t)).sort((a, b) => laenge(a) - laenge(b) || b.id - a.id)[0] || null;
}
/** Version eines Bildes (Teil der Adresse): ändert sich mit jedem neuen Bild */
const bildVer = (id, art) => { const r = db.prepare(`SELECT bild_${art} AS b FROM app_sonder WHERE id = ?`).get(id); return r && r.b ? crypto.createHash('sha256').update(r.b).digest('hex').slice(0, 12) : ''; };
const grussVer = g => crypto.createHash('sha256').update(`${g.titel}\n${g.text}`).digest('hex').slice(0, 10);

/** Für die Mitglieder-App (/api/me): nur der heute geltende Eintrag, ohne Namen */
function fuerApp() {
  const e = geltend(); if (!e) return null;
  const v = { hell: e.n_hell ? bildVer(e.id, 'hell') : '', dunkel: e.n_dunkel ? bildVer(e.id, 'dunkel') : '' };
  return { id: e.id, hell: v.hell || undefined, dunkel: v.dunkel || undefined, top_hell: v.hell ? e.top_hell : undefined, top_dunkel: v.dunkel ? e.top_dunkel : undefined,
    gruss: e.gruss ? { titel: e.gruss.titel, text: e.gruss.text || '', ver: grussVer(e.gruss) } : undefined };
}

/* ---------- Eingaben prüfen ---------- */
const EMOJI = /\p{Extended_Pictographic}|️/u;
const LINK = /https?:|www\.|\b[a-z0-9-]+\.(de|com|org|net|eu|info)\b/i;
const sauber = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max + 1);
function pruefeText(b) {
  const name = sauber(b.name, 40);
  if (!name) return { error: 'Bitte einen Namen eintragen.' };
  if (name.length > 40) return { error: 'Der Name ist zu lang (höchstens 40 Zeichen).' };   // längere Namen stünden am Handy allein in der Zeile (k-lang)
  const von = String(b.von || ''), bis = String(b.bis || ''), jaehrlich = Boolean(b.jaehrlich);
  if (!isDay(von)) return { error: 'Bitte das Datum „Von“ eintragen.' };
  if (!isDay(bis)) return { error: 'Bitte das Datum „Bis“ eintragen – ein Sonderdesign gilt nie dauerhaft.' };
  if (!jaehrlich && bis < von) return { error: '„Bis“ liegt vor „Von“.' };
  if (laenge({ von, bis, jaehrlich }) > MAX_TAGE) return { error: `Ein Sonderdesign gilt höchstens 8 Wochen (${MAX_TAGE} Tage).` };
  let gruss = null;
  const g = b.gruss && typeof b.gruss === 'object' ? b.gruss : {};
  const titel = sauber(g.titel, 40), text = sauber(g.text, 200);
  if (titel.length > 40) return { error: 'Die Überschrift des Grußes ist zu lang (höchstens 40 Zeichen).' };
  if (text.length > 200) return { error: 'Der Text des Grußes ist zu lang (höchstens 200 Zeichen).' };
  if (text && !titel) return { error: 'Bitte eine Überschrift für den Gruß eintragen.' };
  if (EMOJI.test(titel + text)) return { error: 'Der Gruß ist reiner Text – bitte ohne Emojis.' };
  if (LINK.test(titel + ' ' + text)) return { error: 'Der Gruß ist reiner Text – bitte ohne Links oder Adressen.' };
  if (titel) gruss = { titel, text };
  return { name, von, bis, jaehrlich, gruss };
}
/** Bild aus der Verwaltung: { data: base64, top: '#rrggbb' } → { buf, typ, top } oder { error } */
function pruefeBild(art, x) {
  const T = art === 'hell' ? 'für hell' : 'für dunkel';
  const buf = Buffer.from(String((x && x.data) || ''), 'base64');
  if (buf.length < 100) return { error: `Bild ${T}: keine Bilddatei.` };
  if (buf.length > MAX_BYTES) return { error: `Bild ${T}: zu groß (höchstens 1 MB).` };
  const typ = imageType(buf);
  if (!TYPEN[typ]) return { error: `Bild ${T}: bitte ein Foto als WebP, JPEG oder PNG.` };
  const m = masse(buf, typ);
  if (!m || !m.w || !m.h) return { error: `Bild ${T}: Die Datei lässt sich nicht lesen.` };
  if (m.w >= m.h) return { error: `Bild ${T}: bitte ein Bild im Hochformat.` };
  if (m.w > MAX_W || m.h > MAX_H) return { error: `Bild ${T}: höchstens ${MAX_W} × ${MAX_H} Pixel.` };
  if (m.w < MIN_W) return { error: `Bild ${T}: zu klein (mindestens ${MIN_W} Pixel breit).` };
  const top = String((x && x.top) || '').toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(top)) return { error: `Bild ${T}: Farbe am oberen Rand fehlt.` };
  if (!obenLesbar(art, top)) return { error: art === 'hell' ? 'Oben ist das Bild zu dunkel für die Schrift im hellen Design.' : 'Oben ist das Bild zu hell für die Schrift im dunklen Design.' };
  return { buf, typ, top };
}

const LABELS = { name: 'Name', zeitraum: 'Zeitraum', jaehrlich: ['jedes Jahr', 'bool'], bild_hell: ['Bild für hell', 'text'], bild_dunkel: ['Bild für dunkel', 'text'], gruss_titel: 'Gruß', gruss_text: ['Text des Grußes', 'text'] };
const deD = d => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const zeitraum = e => (e.jaehrlich ? `${deD(e.von).slice(0, 6)}–${deD(e.bis).slice(0, 6)}` : `${deD(e.von)}–${deD(e.bis)}`);
const stand = id => { const e = alle().find(x => x.id === id); return e ? { name: e.name, zeitraum: zeitraum(e), jaehrlich: e.jaehrlich, bild_hell: bildVer(id, 'hell'), bild_dunkel: bildVer(id, 'dunkel'), gruss_titel: e.gruss ? e.gruss.titel : '', gruss_text: e.gruss ? e.gruss.text : '' } : {}; };

/* ---------- Verwaltung (Mitglieder-App › Einstellungen › Sonderdesigns) ---------- */
function adminRouten(admin, { bad, need, express }) {
  const recht = need('app', 'einstellungen');
  const gross = express.json({ limit: '3mb' });   // zwei Bilder (je höchstens 1 MB) als base64
  admin.get('/app/sonder', recht, (req, res) => {
    const t = today(), liste = alle(), jetzt = geltend(t, liste);
    const kommend = liste.filter(e => e !== jetzt).map(e => ({ e, b: beginn(e, t) })).filter(x => x.b).sort((a, b) => a.b.localeCompare(b.b))[0];
    res.json({ heute: t, maxTage: MAX_TAGE, rows: liste.map(e => ({ id: e.id, name: e.name, von: e.von, bis: e.bis, jaehrlich: e.jaehrlich, gruss: e.gruss, tage: laenge(e),
      hell: e.n_hell ? bildVer(e.id, 'hell') : '', dunkel: e.n_dunkel ? bildVer(e.id, 'dunkel') : '', top_hell: e.top_hell || '', top_dunkel: e.top_dunkel || '',
      status: e === jetzt ? 'jetzt' : kommend && kommend.e === e ? 'naechstes' : gilt(e, t) ? 'ueberdeckt' : beginn(e, t) ? '' : 'abgelaufen' })) });
  });
  const speichern = (req, res, id) => {
    const b = req.body || {};
    const t = pruefeText(b); if (t.error) return bad(res, t.error);
    const alt = id ? db.prepare('SELECT id, length(bild_hell) AS h, length(bild_dunkel) AS d FROM app_sonder WHERE id = ?').get(id) : null;
    if (id && !alt) return bad(res, 'Dieses Sonderdesign gibt es nicht mehr.', 404);
    const bilder = {};
    for (const art of ARTEN) {
      if (b[art] === undefined) continue;   // unverändert
      if (b[art] === null) { bilder[art] = null; continue; }   // entfernen
      const r = pruefeBild(art, b[art]); if (r.error) return bad(res, r.error);
      bilder[art] = r;
    }
    const hat = art => (bilder[art] !== undefined ? Boolean(bilder[art]) : Boolean(alt && alt[art === 'hell' ? 'h' : 'd']));
    if (!t.gruss && !hat('hell') && !hat('dunkel')) return bad(res, 'Bitte mindestens ein Bild oder einen Gruß eintragen.');
    const vorher = id ? stand(id) : {};
    db.transaction(() => {
      const bs = JSON.stringify(t.gruss ? { gruss: t.gruss } : {});
      if (id) db.prepare('UPDATE app_sonder SET name = ?, von = ?, bis = ?, jaehrlich = ?, bausteine = ? WHERE id = ?').run(t.name, t.von, t.bis, t.jaehrlich ? 1 : 0, bs, id);
      else id = Number(db.prepare('INSERT INTO app_sonder(name, von, bis, jaehrlich, bausteine) VALUES (?,?,?,?,?)').run(t.name, t.von, t.bis, t.jaehrlich ? 1 : 0, bs).lastInsertRowid);
      for (const [art, r] of Object.entries(bilder))
        db.prepare(`UPDATE app_sonder SET bild_${art} = ?, typ_${art} = ?, top_${art} = ? WHERE id = ?`).run(r ? r.buf : null, r ? r.typ : null, r ? r.top : null, id);
    })();
    const nachher = stand(id);
    audit(req.user, alt ? 'Mitglieder-App: Sonderdesign geändert' : 'Mitglieder-App: Sonderdesign angelegt', alt ? `${t.name}: ${auditDiff(LABELS, vorher, nachher) || 'unverändert'}` : `${t.name}, ${nachher.zeitraum}${t.jaehrlich ? ', jedes Jahr' : ''}`);
    res.json({ ok: true, id });
  };
  admin.post('/app/sonder', recht, gross, (req, res) => speichern(req, res, 0));
  admin.put('/app/sonder/:id', recht, gross, (req, res) => speichern(req, res, Number(req.params.id) || -1));
  admin.delete('/app/sonder/:id', recht, (req, res) => {
    const e = alle().find(x => x.id === Number(req.params.id));
    if (!e) return bad(res, 'Dieses Sonderdesign gibt es nicht mehr.', 404);
    db.prepare('DELETE FROM app_sonder WHERE id = ?').run(e.id);
    audit(req.user, 'Mitglieder-App: Sonderdesign gelöscht', `${e.name}, ${zeitraum(e)}`);
    res.json({ ok: true });
  });
  // Vorschau im Fenster der Verwaltung
  admin.get('/app/sonder/:id/bild/:art', recht, (req, res) => senden(req, res));
}

/** Bild ausliefern: GET …/<id>-<hell|dunkel>?v=<Version> (Mitglieder-App) bzw. …/<id>/bild/<art> (Verwaltung) */
function senden(req, res) {
  const m = /^(\d{1,9})-(hell|dunkel)$/.exec(req.params.datei || '') || [];
  const id = Number(req.params.id || m[1]), art = req.params.art || m[2];
  if (!ARTEN.includes(art) || !id) return res.status(404).end();
  const r = db.prepare(`SELECT bild_${art} AS b, typ_${art} AS t FROM app_sonder WHERE id = ?`).get(id);
  if (!r || !r.b || !TYPEN[r.t]) return res.status(404).end();
  const fest = typeof req.query.v === 'string' && req.query.v === bildVer(id, art);
  res.set({ 'Content-Type': TYPEN[r.t], 'Cache-Control': fest ? 'public, max-age=31536000, immutable' : 'no-cache', 'Content-Security-Policy': "default-src 'none'", 'Content-Disposition': 'inline' });
  res.send(r.b);
}
/** Mitglieder-App: Bildadresse sonder/<id>-<hell|dunkel> (öffentlich wie das Vereinslogo) */
function appRouten(app) {
  app.get('/sonder/:datei', senden);
}

module.exports = { adminRouten, appRouten, fuerApp, geltend, gilt, laenge, beginn, masse, kontrast, obenLesbar, MAX_TAGE };
