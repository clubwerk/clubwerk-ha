'use strict';
/**
 * Mehrsprachigkeit (ab 3.0)
 *  - Quelle ist Deutsch. Der Katalog (sprachen/katalog.json) listet alle Texte der Oberfläche, der Server-Meldungen,
 *    E-Mails und Exporte – auch die der mitgelieferten Module. Erweiterungen bringen eigene Kataloge/Sprachen mit
 *    (Ordner „sprachen“ in der Erweiterung).
 *  - Mitgelieferte Sprachen liegen in sprachen/<code>.json, importierte und angepasste in der Datenbank (Tabelle languages)
 *    und sind damit in jeder Sicherung enthalten. Auch Deutsch lässt sich anpassen (z. B. „Spieler“ statt „Mitglieder“).
 *  - Die Vereinssprache gilt für Tablet, E-Mails und als Vorgabe; jede Person kann im eigenen Browser eine andere wählen.
 */
const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const Core = require('../public/i18n-core');

const ROOT = path.join(__dirname, '..');
const LANG_DIR = path.join(ROOT, 'sprachen');
const CODE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
const MAX_IMPORT = 8 * 1024 * 1024, MAX_VALUE = 4000;
const als = new AsyncLocalStorage();
let env = { db: null, getSetting: () => null, setSetting: () => {}, pluginDirs: () => [] };
let cache = { builtin: null, catalog: null, dicts: new Map() };

const DE = { code: 'de', name: 'Deutsch', locale: 'de-DE', dir: 'ltr' };

function normCode(c) {
  const s = String(c || '').trim().replace('_', '-');
  if (!CODE_RE.test(s.toLowerCase())) return null;
  const [a, b] = s.split('-');
  return b ? `${a.toLowerCase()}-${b.length === 2 ? b.toUpperCase() : b}` : a.toLowerCase();
}

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

/** Mitgelieferte Sprachdateien (Kern + Erweiterungen) */
function builtin() {
  if (cache.builtin) return cache.builtin;
  const out = new Map();
  const add = (dir, own) => {
    let files = []; try { files = fs.readdirSync(dir).filter(f => /\.json$/.test(f) && f !== 'katalog.json'); } catch (e) { return; }
    for (const f of files) {
      const j = readJson(path.join(dir, f)); const code = normCode(f.replace(/\.json$/, ''));
      if (!j || !code || !j.strings || typeof j.strings !== 'object') continue;
      const cur = out.get(code) || { meta: { ...DE, code, name: code, locale: code }, strings: {}, own: false };
      if (j._meta && own) cur.meta = { ...cur.meta, ...pickMeta(j._meta, code) };
      else if (j._meta && !out.has(code)) cur.meta = { ...cur.meta, ...pickMeta(j._meta, code) };
      Object.assign(cur.strings, j.strings);
      cur.own = cur.own || own;
      out.set(code, cur);
    }
  };
  add(LANG_DIR, true);
  for (const d of env.pluginDirs()) add(path.join(d, 'sprachen'), false);
  cache.builtin = out;
  return out;
}

function pickMeta(m, code) {
  const s = v => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim();
  return { code, name: s(m.name).slice(0, 40) || code, locale: normCode(m.locale) || code, dir: m.dir === 'rtl' ? 'rtl' : 'ltr' };
}

/** Alle deutschen Originaltexte (Kern + Erweiterungen) */
function catalog() {
  if (cache.catalog) return cache.catalog;
  const set = new Set();
  const add = f => { const j = readJson(f); const arr = j && (Array.isArray(j) ? j : j.strings); if (Array.isArray(arr)) for (const k of arr) if (typeof k === 'string' && k.trim()) set.add(Core.norm(k)); };
  add(path.join(LANG_DIR, 'katalog.json'));
  for (const d of env.pluginDirs()) add(path.join(d, 'sprachen', 'katalog.json'));
  cache.catalog = [...set];
  return cache.catalog;
}

function customRow(code) { return env.db ? env.db.prepare('SELECT * FROM languages WHERE code = ?').get(code) : null; }
function customRows() { return env.db ? env.db.prepare('SELECT code, name, locale, dir, updated_at, length(strings) AS size FROM languages ORDER BY code').all() : []; }

function strings(code) {
  const b = builtin().get(code);
  const c = customRow(code);
  const out = { ...(b ? b.strings : {}) };
  if (c) { try { Object.assign(out, JSON.parse(c.strings)); } catch (e) { /* beschädigt – ignorieren */ } }
  return out;
}
function meta(code) {
  if (code === 'de') { const c = customRow('de'); return c ? { ...DE } : DE; }
  const c = customRow(code); const b = builtin().get(code);
  if (c) return { code, name: c.name, locale: c.locale || code, dir: c.dir === 'rtl' ? 'rtl' : 'ltr' };
  return b ? b.meta : null;
}
function exists(code) { return code === 'de' || builtin().has(code) || Boolean(customRow(code)); }

function list() {
  const cat = catalog(); const total = cat.length;
  const codes = new Set(['de', ...builtin().keys(), ...customRows().map(r => r.code)]);
  return [...codes].map(code => {
    const m = meta(code); const b = builtin().get(code); const c = customRow(code);
    let done = total;
    if (code !== 'de') { const s = strings(code); const norm = new Set(Object.keys(s).filter(k => s[k]).map(Core.norm)); done = cat.filter(k => norm.has(k)).length; }
    let customCount = 0; if (c) { try { customCount = Object.keys(JSON.parse(c.strings)).length; } catch (e) { /* egal */ } }
    return { code, name: m ? m.name : code, locale: m ? m.locale : code, dir: m ? m.dir : 'ltr', builtin: code === 'de' || Boolean(b && b.own), plugin: Boolean(b && !b.own),
      custom: Boolean(c), customCount, updatedAt: c ? c.updated_at : null, total, done, coverage: total ? Math.round(done / total * 1000) / 10 : 100 };
  }).sort((a, b) => (a.code === 'de' ? -1 : b.code === 'de' ? 1 : a.name.localeCompare(b.name)));
}

function dict(code) {
  if (!code) return null;
  if (cache.dicts.has(code)) return cache.dicts.get(code);
  const s = strings(code);
  const d = Object.keys(s).length ? Core.compile(s) : null;
  cache.dicts.set(code, d);
  return d;
}
function invalidate() { cache.dicts.clear(); }
function reload() { cache = { builtin: null, catalog: null, dicts: new Map() }; }

function clubLang() { const l = normCode(env.getSetting('language', 'de')); return l && exists(l) ? l : 'de'; }
/** Sprache wählen: ausdrücklich gewählt → Browser/Handy (falls vorhanden) → Vereinssprache */
function resolve(l, browser) {
  const want = normCode(l);
  if (want && exists(want)) return want;
  if (browser) {
    for (const raw of String(browser).split(',').slice(0, 8)) {
      const c = normCode(raw.split(';')[0]); if (!c) continue;
      if (exists(c)) return c;
      const primary = c.split('-')[0]; if (exists(primary)) return primary;
    }
  }
  return clubLang();
}

/* ---------- Übersetzen im Server ---------- */
function current() { const s = als.getStore(); return (s && s.lang) || clubLang(); }
function run(lang, fn) { return als.run({ lang: lang || clubLang() }, fn); }
function tr(text, lang = current()) { const d = dict(lang); return d ? Core.translate(d, text) : text; }
function T(text, vars, lang = current()) {
  if (Array.isArray(vars)) vars = Object.fromEntries(vars.map((v, i) => [i, v]));
  const d = dict(lang); const hit = d ? d.exact.get(Core.norm(text)) : undefined;
  return Core.fill(hit !== undefined ? hit : text, vars);
}
function trHtml(html, lang = current()) { const d = dict(lang); return d ? Core.translateHtml(d, html) : html; }
function locale(lang = current()) { const m = meta(lang); return (m && m.locale) || 'de-DE'; }

/** Server-weite Einbindung: Zahlen/Datum, Excel- und PDF-Dateien in der jeweiligen Sprache */
let patched = false;
function patchGlobals() {
  if (patched) return; patched = true;
  const swap = l => ((l === 'de-DE' || l === 'de') && current() !== 'de' ? locale() : l);
  for (const fn of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']) {
    const o = Date.prototype[fn]; Date.prototype[fn] = function (l, opt) { return o.call(this, swap(l), opt); }; // eslint-disable-line no-extend-native
  }
  const on = Number.prototype.toLocaleString; Number.prototype.toLocaleString = function (l, opt) { return on.call(this, swap(l), opt); }; // eslint-disable-line no-extend-native
  // Excel: Texte aller Blätter beim Schreiben übersetzen (Spaltenköpfe, Beschriftungen, Status)
  try {
    const XLSX = require('exceljs/lib/xlsx/xlsx');
    const tWb = wb => {
      const d = dict(current()); if (!d) return;
      wb.eachSheet(ws => {
        const n = Core.translate(d, ws.name); if (n !== ws.name) { try { ws.name = n.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31); } catch (e) { /* Name bleibt */ } }
        ws.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, cell => {
          if (typeof cell.value === 'string') { const t = Core.translate(d, cell.value); if (t !== cell.value) cell.value = t; }
          else if (cell.value && cell.value.richText) cell.value = { richText: cell.value.richText.map(r => ({ ...r, text: Core.translate(d, r.text) })) };
        }));
        ws.headerFooter && ['oddHeader', 'oddFooter'].forEach(k => { if (ws.headerFooter[k]) ws.headerFooter[k] = Core.translate(d, ws.headerFooter[k]); });
      });
    };
    for (const fn of ['writeBuffer', 'write', 'writeFile']) {
      const o = XLSX.prototype[fn]; if (!o) continue;
      XLSX.prototype[fn] = function (...a) { try { if (!this.__cwSkip) tWb(this.workbook); } catch (e) { /* unübersetzt schreiben */ } return o.apply(this, a); };
    }
  } catch (e) { console.error('Sprachen: Excel-Übersetzung nicht verfügbar –', e.message); }
  // PDF: jeder Text, der geschrieben wird
  try {
    const PDF = require('pdfkit');
    const o = PDF.prototype.text;
    PDF.prototype.text = function (t, ...a) { if (typeof t === 'string' && !this.__cwSkip) { const d = dict(current()); if (d) t = Core.translate(d, t); } return o.call(this, t, ...a); };
  } catch (e) { /* pdfkit nicht installiert */ }
}

/** Express-Middleware: Sprache der Anfrage bestimmen, Fehlermeldungen übersetzen */
function middleware(req, res, next) {
  const cookie = (/(?:^|;\s*)cw_lang=([^;]+)/.exec(req.headers.cookie || '') || [])[1];
  let want = req.get('X-Lang') || req.query.lang || (cookie ? decodeURIComponent(cookie) : '');
  const lang = resolve(typeof want === 'string' ? want : '', null);
  req.lang = lang;
  if (lang !== 'de' || customRow('de')) {
    const oj = res.json.bind(res);
    res.json = body => {
      try {
        if (body && typeof body === 'object' && !Array.isArray(body)) {
          for (const k of ['error', 'message', 'hint', 'warn']) if (typeof body[k] === 'string') body = { ...body, [k]: tr(body[k], lang) };
        }
      } catch (e) { /* unverändert senden */ }
      return oj(body);
    };
  }
  als.run({ lang }, () => next());
}

/** Spaltenköpfe beim Excel-Import in allen Sprachen erkennen: deutsche Varianten + deren Übersetzungen */
function aliases(words, normFn) {
  const set = new Set(words);
  const codes = new Set([...builtin().keys(), ...customRows().map(r => r.code)]);
  const dicts = [...codes].map(c => dict(c)).filter(Boolean);
  for (const k of catalog()) {
    if (!set.has(normFn(k))) continue;
    for (const d of dicts) { const v = d.exact.get(k); if (v) set.add(normFn(v)); }
  }
  return [...set].filter(Boolean);
}

/* ---------- Herunterladen ---------- */
const AI_HINT = 'Anleitung: Übersetze jeden Wert in „strings“ in die Zielsprache. Der Schlüssel (links) ist der deutsche Originaltext und darf nicht verändert werden. ' +
  'Leere Werte sind noch nicht übersetzt. Platzhalter wie {0}, {1} oder {name} müssen unverändert in der Übersetzung vorkommen. ' +
  'Zeichen wie →, „…“, · und Emojis beibehalten, kurze Oberflächentexte kurz halten. In „_meta“ Sprachcode (ISO 639-1, z. B. fr), Namen der Sprache ' +
  'in der Sprache selbst (z. B. Français), Gebietsschema (z. B. fr-FR) und Schreibrichtung (ltr oder rtl) eintragen. Antworte mit der vollständigen JSON-Datei.';

function exportJson(code, { template = false, appVersion = '' } = {}) {
  const cat = catalog();
  const m = template ? { code: '', name: '', locale: '', dir: 'ltr' } : (meta(code) || { code, name: code, locale: code, dir: 'ltr' });
  const s = template || code === 'de' ? {} : strings(code);
  const sn = new Map(Object.entries(s).map(([k, v]) => [Core.norm(k), v]));
  const out = {};
  for (const k of cat) out[k] = code === 'de' && !template ? (sn.get(k) || k) : (sn.get(k) || '');
  if (code === 'de' && !template) { const c = customRow('de'); if (c) { try { for (const [k, v] of Object.entries(JSON.parse(c.strings))) out[Core.norm(k)] = v; } catch (e) { /* egal */ } } }
  return { _anleitung: code === 'de' && !template ? 'Deutsch ist die Ausgangssprache. Werte ändern, um Begriffe anzupassen (z. B. „Spieler“ statt „Mitglieder“), und wieder importieren. ' + AI_HINT.replace('Anleitung: ', '') : AI_HINT,
    _meta: { code: m.code, name: m.name, locale: m.locale, dir: m.dir, basis: 'de', app: 'Clubwerk ' + appVersion, texte: cat.length }, strings: out };
}

async function exportXlsx(code, { template = false, appVersion = '' } = {}) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const j = exportJson(code, { template, appVersion });
  const en = code !== 'en' && exists('en') ? strings('en') : null;
  const enN = en ? new Map(Object.entries(en).map(([k, v]) => [Core.norm(k), v])) : null;
  const info = wb.addWorksheet('Info');
  info.columns = [{ width: 26 }, { width: 70 }];
  info.addRows([['Clubwerk – Sprachdatei', j._meta.app], [], ['Sprachcode (z. B. fr)', j._meta.code], ['Name der Sprache (z. B. Français)', j._meta.name],
    ['Gebietsschema (z. B. fr-FR)', j._meta.locale], ['Schreibrichtung (ltr/rtl)', j._meta.dir], [],
    ['So geht es', 'Im Blatt „Texte“ die Spalte D ausfüllen. Spalte B (Deutsch) nicht verändern. Platzhalter wie {0} oder {name} unverändert übernehmen. Danach die Datei in der Verwaltung unter Einstellungen → Sprachen importieren.']]);
  info.getCell('A1').font = { bold: true, size: 14 }; info.getCell('B8').alignment = { wrapText: true, vertical: 'top' };
  for (const r of [3, 4, 5, 6]) { info.getCell('B' + r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4CC' } }; info.getCell('A' + r).font = { bold: true }; }
  const ws = wb.addWorksheet('Texte', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [{ header: 'Nr.', width: 7 }, { header: 'Deutsch (Original – nicht ändern)', width: 60 }, { header: 'English (Hilfe)', width: 50 }, { header: 'Übersetzung', width: 60 }];
  let i = 0;
  for (const [k, v] of Object.entries(j.strings)) ws.addRow([++i, k, enN ? (enN.get(k) || '') : '', v]);
  ws.getRow(1).font = { bold: true };
  ws.getColumn(2).alignment = ws.getColumn(3).alignment = ws.getColumn(4).alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn(4).eachCell((c, n) => { if (n > 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEA' } }; });
  if (!enN) ws.getColumn(3).hidden = true;
  const x = wb.xlsx; x.__cwSkip = true;   // die Sprachdatei selbst nie übersetzen
  return x.writeBuffer();
}

/* ---------- Importieren ---------- */
async function parseUpload(buf, filename) {
  if (!buf || !buf.length) throw new Error('Keine Datei empfangen.');
  if (buf.length > MAX_IMPORT) throw new Error('Die Datei ist zu groß (max. 8 MB).');
  if (buf[0] === 0x50 && buf[1] === 0x4b) {   // ZIP → Excel
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(buf); } catch (e) { throw new Error('Die Excel-Datei lässt sich nicht lesen.'); }
    const info = wb.getWorksheet('Info'), ws = wb.getWorksheet('Texte') || wb.worksheets.find(w => w.name !== 'Info');
    if (!ws) throw new Error('In der Excel-Datei fehlt das Blatt „Texte“.');
    const cell = (r) => { const v = info ? info.getCell('B' + r).value : ''; return v && typeof v === 'object' ? (v.text || (v.richText ? v.richText.map(x => x.text).join('') : '')) : String(v == null ? '' : v); };
    const txt = v => (v == null ? '' : typeof v === 'object' ? (v.text || (v.richText ? v.richText.map(x => x.text).join('') : (v.result != null ? String(v.result) : ''))) : String(v));
    const strings = {};
    ws.eachRow((row, n) => { if (n === 1) return; const k = txt(row.getCell(2).value); const v = txt(row.getCell(4).value); if (k) strings[k] = v; });
    return { _meta: { code: cell(3), name: cell(4), locale: cell(5), dir: cell(6) }, strings };
  }
  let s = buf.toString('utf8').replace(/^﻿/, '').trim();
  // KI-Antworten kommen oft als Codeblock
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) s = fence[1].trim();
  try { return JSON.parse(s); } catch (e) { throw new Error(`Die Datei ${filename ? '„' + String(filename).slice(0, 60) + '“ ' : ''}ist weder gültiges JSON noch eine Excel-Datei.`); }
}

/**
 * Sprachdatei übernehmen. Vorhandene Übersetzungen derselben Sprache werden ergänzt bzw. überschrieben –
 * man kann also auch in Teilen übersetzen. Gibt einen Bericht zurück.
 */
function importData(data, { override = {} } = {}) {
  if (!data || typeof data !== 'object' || !data.strings || typeof data.strings !== 'object' || Array.isArray(data.strings)) throw new Error('In der Datei fehlt der Abschnitt „strings“.');
  const m = { ...(data._meta || {}), ...Object.fromEntries(Object.entries(override).filter(([, v]) => v)) };
  const code = normCode(m.code);
  if (!code) throw new Error('Bitte einen gültigen Sprachcode angeben (z. B. „fr“ oder „pt-BR“).');
  const name = String(m.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) || (meta(code) || {}).name;
  if (!name) throw new Error('Bitte den Namen der Sprache angeben (z. B. „Français“).');
  const cat = new Set(catalog());
  const report = { code, name, taken: 0, empty: 0, unknown: 0, rejected: [], same: 0 };
  const clean = {};
  for (const [k0, v0] of Object.entries(data.strings)) {
    const k = Core.norm(k0);
    if (!cat.has(k)) { report.unknown++; continue; }
    if (typeof v0 !== 'string' || !v0.trim()) { report.empty++; continue; }
    const v = v0.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, MAX_VALUE);
    if (Core.placeholders(k) !== Core.placeholders(v)) { report.rejected.push({ text: k.slice(0, 120), reason: 'Platzhalter fehlen oder sind verändert' }); continue; }
    if (code !== 'de' && v === k) report.same++;
    clean[k] = v;
    report.taken++;
  }
  if (!report.taken) throw new Error('Die Datei enthält keine verwendbaren Übersetzungen.' + (report.unknown ? ` (${report.unknown} Texte gehören nicht zu dieser Version.)` : ''));
  const old = customRow(code);
  let merged = clean;
  if (old) { try { merged = { ...JSON.parse(old.strings), ...clean }; } catch (e) { merged = clean; } }
  const locale = normCode(m.locale) || (old && old.locale) || (meta(code) || {}).locale || code;
  const dir = m.dir === 'rtl' ? 'rtl' : m.dir === 'ltr' ? 'ltr' : (old && old.dir) || 'ltr';
  env.db.prepare(`INSERT INTO languages (code, name, locale, dir, strings, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(code) DO UPDATE SET name = excluded.name, locale = excluded.locale, dir = excluded.dir, strings = excluded.strings, updated_at = excluded.updated_at`)
    .run(code, code === 'de' ? 'Deutsch' : name, locale, dir, JSON.stringify(merged));
  invalidate();
  report.rejected = report.rejected.slice(0, 50);
  return report;
}

function remove(code) {
  const c = normCode(code);
  if (!c || !customRow(c)) throw new Error('Diese Sprache hat keine importierten Texte.');
  env.db.prepare('DELETE FROM languages WHERE code = ?').run(c);
  invalidate();
  if (clubLang() !== env.getSetting('language', 'de') && !exists(env.getSetting('language', 'de'))) env.setSetting('language', 'de');
  return { code: c, builtinRemains: c === 'de' || builtin().has(c) };
}

/** Skript für die Seiten: Kern + Browser-Teil + Daten der gewählten Sprache */
let pageCode = null;
function pageScript(lang) {
  if (!pageCode) pageCode = fs.readFileSync(path.join(ROOT, 'public', 'i18n-core.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'public', 'i18n-dom.js'), 'utf8');
  const m = meta(lang) || DE;
  const cfg = { lang, locale: m.locale, dir: m.dir, club: clubLang(), strings: lang === 'de' && !customRow('de') ? {} : strings(lang),
    langs: list().map(l => ({ code: l.code, name: l.name, coverage: l.coverage })) };
  return pageCode + '\nCWI18N.start(' + JSON.stringify(cfg).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16)) + ');\n';
}

function init(o) {
  env = { ...env, ...o };
  env.db.exec(`CREATE TABLE IF NOT EXISTS languages (
    code TEXT PRIMARY KEY, name TEXT NOT NULL, locale TEXT, dir TEXT NOT NULL DEFAULT 'ltr', strings TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')))`);
  patchGlobals();
}

module.exports = { aliases, init, reload, invalidate, list, catalog, strings, meta, exists, resolve, clubLang, normCode, dict, tr, T, trHtml, current, run, locale,
  middleware, exportJson, exportXlsx, parseUpload, importData, remove, pageScript, LANG_DIR };
