'use strict';
/* Datensicherung, Sicherungsziele (Dropbox, WebDAV/SFTP/FTPS, Google Drive), Update per ZIP und Wiederherstellung – Adressen der Verwaltung.
   Aus server.js ausgelagert: die Helfer kommen von dort (h), der Aufruf steht an derselben Stelle, die Reihenfolge der Adressen bleibt. */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const backup = require('./backup');
const { db, DATA_DIR, getSetting, getJsonSetting, isObj, setSetting, audit } = require('./db');
const { nowTs } = require('./util');
const { securityAlert } = require('./security');
const plugins = require('./plugins');
const dropbox = require('./dropbox');
const fullbackup = require('./fullbackup');
const targets = require('./targets');
const geheim = require('./geheim');
const selfupdate = require('./selfupdate');
const APP_VERSION = require('../package.json').version;
module.exports = function sicherungRouten(h) {
  const {
    admin, asyncRoute, bad, belegFiles, buildExport, defaultRange, DEMO_KOPIE, int, need, owner, ownPwOk, pwBad, rateLimit, restoredMsg, updMsg,
    viaIngress
  } = h;
  /* ---------- Dropbox: täglicher Export (alle Rechte) ---------- */
  /* App secret und Verbindung (Refresh-Token) liegen im Tresor (src/geheim.js) – „eingerichtet“ gilt auch, solange er gesperrt ist */
  const dbxCfg = () => ({ appKey: getSetting('dropbox_app_key', ''), appSecret: geheim.get('dropbox_app_secret', ''),
    refresh: geheim.get('dropbox_refresh', ''), folder: getSetting('dropbox_folder', '/Clubwerk'),
    enabled: getSetting('dropbox_enabled', '1') === '1', hasSecret: geheim.has('dropbox_app_secret'), hasRefresh: geheim.has('dropbox_refresh') });
  const dbxReady = c => Boolean(c.appKey && c.hasSecret && c.hasRefresh);
  /* ---------- Datensicherung (Kern, unabhängig von den Modulen) ----------
     Jede Nacht: verschlüsselte Komplettsicherung (Datenbank aller Module, Belege, Bilder, Erweiterungen) – lokal die
     letzten 3, in Dropbox nach Generationen (täglich/wöchentlich/monatlich). Optional lesbare Auszüge der Module (Excel).
     Monatlich eine Probe-Wiederherstellung, die prüft, ob sich die letzte Sicherung vollständig entschlüsseln lässt. */
  const KOMPLETT_DIR = path.join(backup.BACKUP_DIR, 'komplett');
  const INCOMING_DIR = path.join(DATA_DIR, '.sicherung-eingang');
  /* Schlüssel der Komplettsicherung im Tresor: nach einem Neustart wartet die Sicherung, bis er entsperrt ist (bkWartet) */
  const bkKey = () => ({ key: geheim.get('backup_enc_key', ''), kdf: getJsonSetting('backup_kdf', null) });
  const bkHasKey = () => Boolean(geheim.has('backup_enc_key') && bkKey().kdf);
  const bkWartet = () => bkHasKey() && geheim.locked('backup_enc_key');
  const ZUGANG_ZU = 'Der Tresor ist seit dem Neustart gesperrt – die gespeicherten Zugangsdaten sind verschlossen, bis sich ein Admin mit Schlüssel anmeldet (oder der Wiederherstellungscode eingegeben wird).';
  const WARTET_MSG = 'Der Tresor ist seit dem Neustart gesperrt – die Datensicherung wartet, bis sich ein Admin anmeldet (oder der Wiederherstellungscode eingegeben wird).';
  const bkCfg = () => ({ hour: Math.max(0, Math.min(23, int(getSetting('backup_hour', '3'), 3))), daily: Math.max(1, Math.min(60, int(getSetting('backup_daily', '7'), 7))),
    weekly: Math.max(0, Math.min(52, int(getSetting('backup_weekly', '4'), 4))), monthly: Math.max(0, Math.min(120, int(getSetting('backup_monthly', '12'), 12))),
    readable: getSetting('backup_readable', '0') === '1' });   // Standard aus: die Auszüge (Namen, Beträge, Türprotokoll) liegen unverschlüsselt im Ziel
  let bkRunning = false;

  /** Lesbare Auszüge der aktiven Module: [{ name, buffer }] – jedes Modul liefert seinen eigenen Teil */
  async function readableExports() {
    const out = [];
    if (plugins.isActive('getraenke')) {
      const { from, to } = defaultRange({});
      const wb = await buildExport(from, to);
      out.push({ name: 'Getraenke-Stand.xlsx', buffer: Buffer.from(await wb.xlsx.writeBuffer()) });
    }
    for (const p of plugins.withHook('backupExports')) {
      try { for (const f of (await p.hooks.backupExports()) || []) if (f && f.name && f.buffer) out.push({ name: String(f.name).replace(/[^\w.-]/g, '_').slice(0, 80), buffer: Buffer.from(f.buffer) }); }
      catch (e) { console.error(`Sicherung – Auszug ${p.meta.id}:`, e.message); }
    }
    return out;
  }

  /* ---------- Sicherungsziele: Dropbox + beliebig viele WebDAV/SFTP/FTPS-Ziele ---------- */
  const MAX_TARGETS = 6;
  const tgList = () => getJsonSetting('backup_targets', [], Array.isArray);
  const tgSave = l => setSetting('backup_targets', JSON.stringify(l));
  const tgSecretKey = id => `backup_target_${id}_secret`;
  const tgStatus = id => getJsonSetting(`backup_target_${id}_status`, {});
  const tgSetStatus = (id, o) => setSetting(`backup_target_${id}_status`, JSON.stringify({ ...tgStatus(id), ...o, last_try: new Date().toISOString() }));
  /** Alle eingeschalteten Ziele (Dropbox zuerst) mit Adapter */
  function activeTargets() {
    const out = [];
    const c = dbxCfg();
    if (dbxReady(c) && c.enabled) out.push({ id: 'dropbox', name: 'Dropbox', type: 'dropbox', retention: null, adapter: () => targets.dropboxTarget(c) });
    for (const t of tgList()) if (t.enabled) out.push({ ...t, adapter: () => targets.open(t, geheim.get(tgSecretKey(t.id), '')) });
    return out;
  }
  function targetById(id) {
    if (id === 'dropbox') { const c = dbxCfg(); return dbxReady(c) ? { id, name: 'Dropbox', type: 'dropbox', adapter: () => targets.dropboxTarget(c) } : null; }
    const t = tgList().find(x => x.id === id);
    return t ? { ...t, adapter: () => targets.open(t, geheim.get(tgSecretKey(t.id), '')) } : null;
  }
  /** Übersicht für die Verwaltung – nie mit Zugangsdaten */
  function targetsView() {
    const c = dbxCfg();
    const rows = [];
    if (dbxReady(c)) rows.push({ id: 'dropbox', name: 'Dropbox', type: 'dropbox', typeLabel: 'Dropbox', enabled: c.enabled, where: `Apps/…${c.folder}`, account: getSetting('dropbox_account', ''), ...tgStatus('dropbox') });
    for (const t of tgList()) rows.push({ ...targets.publicView(t, geheim.has(tgSecretKey(t.id))), where: targets.where(t), ...tgStatus(t.id) });
    return rows;
  }

  async function runBackup(by = 'automatisch') {
    if (!bkHasKey()) throw new Error('Noch kein Sicherungspasswort festgelegt (Datensicherung → Sicherungspasswort).');
    if (bkWartet()) throw Object.assign(new Error(WARTET_MSG), { vaultLocked: true, status: 423 });
    if (bkRunning) throw new Error('Die Sicherung läuft gerade schon.');
    bkRunning = true;
    const day = backup.stamp().slice(0, 10);
    try {
      const k = bkKey();
      const r = await fullbackup.create({ db, dataDir: DATA_DIR, outDir: KOMPLETT_DIR, key: k.key, kdf: k.kdf, appVersion: APP_VERSION, club: getSetting('club_name', ''), standalone: backup.standalone });
      // lokal nur die letzten 3 (alles Weitere steckt im Home-Assistant-Backup bzw. in Dropbox)
      for (const old of fullbackup.list(KOMPLETT_DIR).slice(3)) { try { fs.unlinkSync(path.join(KOMPLETT_DIR, old.file)); } catch (e) { /* schon gelöscht */ } }
      const parts = [`Komplettsicherung ${r.size >= 1048576 ? (r.size / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(r.size / 1024)) + ' KB'}`];
      const g = bkCfg();
      const list = activeTargets();
      let lesbarFiles = null; const failed = [];
      for (const tg of list) {
        const a = tg.adapter();
        try {
          await a.put('Komplett', `${day}_Clubwerk${fullbackup.EXT}`, { path: r.path });
          // nachprüfen: liegt die Datei vollständig am Ziel? (ein voller Speicher oder ein abgebrochener Upload fiele sonst erst beim Zurückspielen auf)
          const da = (await a.list('Komplett')).find(e => String(e.name).toLowerCase() === `${day}_Clubwerk${fullbackup.EXT}`.toLowerCase());   // Dropbox unterscheidet keine Groß-/Kleinschreibung
          if (!da) throw new Error('Die Datei ist nach dem Hochladen am Ziel nicht zu finden.');
          if (da.size != null && da.size !== r.size) throw new Error(`Die Datei kam am Ziel unvollständig an (${da.size} statt ${r.size} Bytes).`);
          let lesbar = 0;
          if (g.readable) { if (!lesbarFiles) lesbarFiles = await readableExports(); for (const f of lesbarFiles) { await a.put('Lesbar', `${day}_${f.name}`, { buffer: f.buffer }); lesbar++; } }
          let removed = 0;
          const ret = tg.retention || g;
          for (const sub of ['Komplett', 'Lesbar']) {
            const files = await a.list(sub);
            const del = new Set(fullbackup.generations(files.map(e => e.name), ret));
            for (const e of files) if (del.has(e.name)) { await a.remove(sub, e.name); removed++; }
          }
          tgSetStatus(tg.id, { last_ok: new Date().toISOString(), last_error: '', reconnect: false, msg: `${lesbar ? lesbar + ' lesbare Auszüge, ' : ''}${removed} ältere aufgeräumt` });
          parts.push(`${tg.name} ✓` + (lesbar ? ` (+${lesbar} lesbar)` : ''));
        } catch (e) {
          tgSetStatus(tg.id, { last_error: `${new Date().toISOString()} ${e.message}`, reconnect: Boolean(e.reconnect) });
          failed.push(`${tg.name}: ${e.message}`);
          parts.push(`${tg.name} ✗`);
          securityAlert('sicherung.fehler', `Die Datensicherung konnte nicht nach „${tg.name}“ übertragen werden: ${e.message}`, { key: 'ziel-' + tg.id });
        } finally { await a.close(); }
      }
      if (!list.length) parts.push('nur lokal (kein Sicherungsziel eingerichtet)');
      const msg = `${day}: ${parts.join(', ')}`;
      setSetting('backup_last_ok', new Date().toISOString()); setSetting('backup_last_msg', msg); setSetting('backup_last_error', failed.length ? `${new Date().toISOString()} ${failed.join(' · ')}` : ''); setSetting('backup_last_day', day);
      audit(by, 'Datensicherung', msg);
      return msg;
    } catch (e) {
      setSetting('backup_last_error', `${new Date().toISOString()} ${e.message}`);
      securityAlert('sicherung.fehler', `Die Datensicherung ist fehlgeschlagen: ${e.message}`);
      throw e;
    } finally { bkRunning = false; }
  }

  /** Probe-Wiederherstellung (wöchentlich, sonntags nach der Sicherung; „Jetzt prüfen“): die neueste Sicherung reihum von einem Ziel
   *  außer Haus zurückladen (ohne Ziel: die lokale Datei), in der abgeschotteten Lesekopie mit Clubwerk starten (src/teilsicherung.js)
   *  und die Zählerstände mit dieser Installation vergleichen. Nichts wird überschrieben. */
  async function probeBackup(by = 'automatisch') {
    if (!bkHasKey()) throw new Error('Noch kein Sicherungspasswort festgelegt.');
    if (bkWartet()) throw Object.assign(new Error(WARTET_MSG), { vaultLocked: true, status: 423 });
    const tsich = require('./teilsicherung');
    const list = activeTargets();
    let tg = null;
    if (list.length) { const i = (parseInt(getSetting('backup_probe_idx', '0'), 10) || 0) % list.length; tg = list[i]; setSetting('backup_probe_idx', String(i + 1)); }
    const quelleName = tg ? tg.name : 'hier auf dem Gerät';
    const prev = { at: getSetting('backup_probe_at', ''), ok: getSetting('backup_probe_ok', '') === '1', quelle: probeInfo().quelle || '' };
    const laden = async ziel => {
      if (!tg) {
        const last = fullbackup.list(KOMPLETT_DIR)[0];
        if (!last) throw new Error('Noch keine Komplettsicherung vorhanden.');
        fs.copyFileSync(path.join(KOMPLETT_DIR, last.file), ziel);
        return { datei: last.file };
      }
      const a = tg.adapter();
      try {
        const files = (await a.list('Komplett')).filter(e => fullbackup.validName(String(e.name).replace(/_clubwerk\./i, '_Clubwerk.'))).sort((x, y) => (x.name < y.name ? 1 : -1));
        if (!files.length) throw new Error(`Am Ziel „${tg.name}“ liegt keine Komplettsicherung.`);
        await a.get('Komplett', files[0].name, ziel);
        const size = fs.statSync(ziel).size;
        if (files[0].size != null && files[0].size !== size) throw new Error(`Die Sicherung vom Ziel „${tg.name}“ kam unvollständig an (${size} statt ${files[0].size} Bytes).`);
        // dieselbe Datei liegt meist noch hier: Prüfsumme vergleichen (die Uploads heißen <Tag>_Clubwerk, lokal mit Uhrzeit)
        const day = files[0].name.slice(0, 10);
        const lokal = fullbackup.list(KOMPLETT_DIR).filter(l => l.file.startsWith(day + '_') && l.size === size);
        let pruefsumme = false;
        if (lokal.length) {
          const h = await fullbackup.sha256File(ziel);
          for (const l of lokal) if (await fullbackup.sha256File(path.join(KOMPLETT_DIR, l.file)) === h) pruefsumme = true;
          if (!pruefsumme) throw new Error(`Die Sicherung am Ziel „${tg.name}“ weicht von der Datei hier ab (Prüfsumme).`);
        }
        return { datei: files[0].name, alt: Math.floor((Date.now() - Date.parse(day + 'T12:00:00')) / 86400000), pruefsumme };
      } finally { await a.close(); }
    };
    const at = new Date().toISOString();
    try {
      const r = await tsich.probe({ laden, key: bkKey().key, fullbackup, backup });
      // Ergebnis der Lesekopie nicht blind übernehmen: nur Zahlen und kurze Texte
      r.zahlen = (Array.isArray(r.zahlen) ? r.zahlen : []).slice(0, 200).map(z => ({ modul: String(z.modul || '').slice(0, 40), label: String(z.label || '').slice(0, 60), n: Number.isFinite(Number(z.n)) ? Number(z.n) : 0, fehler: z.fehler ? String(z.fehler).slice(0, 120) : '' }));
      r.module = (Array.isArray(r.module) ? r.module : []).slice(0, 100);
      // Plausibilität: fällt eine Zahl auf weniger als die Hälfte, wirkt die Sicherung unvollständig (Hinweis, kein Fehler – Löschen ist erlaubt)
      const jetzt = new Map((await tsich.zaehlen({ plugins, db })).map(z => [z.modul + '|' + z.label, z.n]));
      const hinweise = [];
      for (const z of r.zahlen) { const n = jetzt.get(z.modul + '|' + z.label); z.jetzt = n; if (n >= 10 && z.n < n / 2) hinweise.push(`${z.label}: ${z.n} statt ${n}`); }
      if (r.zahlen.some(z => z.fehler)) hinweise.push(...r.zahlen.filter(z => z.fehler).map(z => `${z.label}: Zählen fehlgeschlagen`));
      if (r.alt > 3) hinweise.push(`Die neueste Sicherung am Ziel ist ${r.alt} Tage alt`);
      const msg = `${quelleName}: ${r.datei} – Clubwerk startet mit der Sicherung (${r.module.length} Module)${r.pruefsumme ? ', Prüfsumme stimmt' : ''}`;
      setSetting('backup_probe_at', at); setSetting('backup_probe_ok', '1'); setSetting('backup_probe_msg', msg);
      setSetting('backup_probe_info', JSON.stringify({ quelle: quelleName, datei: r.datei, zahlen: r.zahlen.filter(z => !z.fehler).map(({ label, n, jetzt: j }) => ({ label, n, jetzt: j })), hinweis: hinweise.join(' · '), prev }));
      audit(by, 'Probe-Wiederherstellung', msg + (hinweise.length ? ` – Hinweis: ${hinweise.join(' · ')}` : ''));
      if (hinweise.length) securityAlert('sicherung.probe', `Die Probe-Wiederherstellung hat etwas gefunden (${quelleName}): ${hinweise.join(' · ')}. Bitte unter Datensicherung ansehen.`);
      return msg + (hinweise.length ? ` – Hinweis: ${hinweise.join(' · ')}` : '');
    } catch (e) {
      setSetting('backup_probe_at', at); setSetting('backup_probe_ok', '0'); setSetting('backup_probe_msg', `${quelleName}: ${e.message}`);
      setSetting('backup_probe_info', JSON.stringify({ quelle: quelleName, zahlen: [], hinweis: '', prev }));
      audit(by, 'Probe-Wiederherstellung fehlgeschlagen', `${quelleName}: ${e.message}`);
      securityAlert('sicherung.probe', `Die Probe-Wiederherstellung der Datensicherung ist fehlgeschlagen (${quelleName}): ${e.message}`);
      throw e;
    }
  }

  const probeInfo = () => getJsonSetting('backup_probe_info', {}, isObj);
  /** Zustand für Übersicht und Seite „Datensicherung“ */
  function backupStatus() {
    const lastOk = getSetting('backup_last_ok', '');
    const age = lastOk ? (Date.now() - Date.parse(lastOk)) / 3600000 : Infinity;
    const tv = targetsView();
    const on = tv.filter(t => t.enabled);
    // Ziel gilt als gestört, wenn der letzte Versuch fehlschlug und es seit zwei Tagen (oder noch nie) geklappt hat
    // abgelaufene oder widerrufene Anmeldung (Google Drive): sofort rot – von selbst wird das nicht wieder gut
    const broken = on.filter(t => t.reconnect || (t.last_error && (!t.last_ok || Date.now() - Date.parse(t.last_ok) > 48 * 3600000)));
    const relog = on.filter(t => t.reconnect);
    const warn = !bkHasKey() ? 'Noch kein Sicherungspasswort festgelegt – es wird nichts gesichert.'
      : bkWartet() ? WARTET_MSG
      : relog.length ? `Die Anmeldung bei ${relog.map(t => `„${t.name}“`).join(', ')} gilt nicht mehr – dorthin wird nicht gesichert. Bitte unter Datensicherung › Sicherungsziele „Neu verbinden …“.`
      : age > 48 ? (lastOk ? 'Seit mehr als zwei Tagen keine erfolgreiche Sicherung.' : 'Noch keine Komplettsicherung erstellt.')
      : broken.length ? `Sicherungsziel ${broken.map(t => `„${t.name}“`).join(', ')} ${broken.length > 1 ? 'sind' : 'ist'} nicht erreichbar – die Sicherung kommt dort nicht an.`
      : getSetting('backup_probe_ok', '') === '0' ? 'Die letzte Probe-Wiederherstellung ist fehlgeschlagen.'
      : probeInfo().hinweis ? `Die letzte Probe-Wiederherstellung hat etwas gefunden: ${probeInfo().hinweis}.`
      : !on.length ? 'Kein Sicherungsziel eingerichtet – die Sicherung liegt nur hier auf dem Gerät. Bitte Dropbox, ein NAS oder eine Cloud als Ziel einrichten.' : '';
    return { hasKey: bkHasKey(), wartet: bkWartet(), pwAt: getSetting('backup_pw_at', ''), ...bkCfg(), dropbox: on.some(t => t.id === 'dropbox'),
      targets: tv, targetsOk: on.length - broken.length, targetsOn: on.length,
      last_ok: lastOk, last_msg: getSetting('backup_last_msg', ''), last_error: getSetting('backup_last_error', ''),
      probe_at: getSetting('backup_probe_at', ''), probe_ok: getSetting('backup_probe_ok', '') === '1', probe_msg: getSetting('backup_probe_msg', ''), probe: probeInfo(),
      pwCheckDue: bkHasKey() && Date.now() - Math.max(Date.parse(getSetting('backup_pw_at', '')) || 0, Date.parse(getSetting('backup_pw_checked_at', '')) || 0) > 182 * 86400000,
      local: fullbackup.list(KOMPLETT_DIR), warn, warnLevel: !warn ? '' : (!bkHasKey() || (age <= 48 && !broken.length && getSetting('backup_probe_ok', '') !== '0')) ? 'a' : 'r' };
  }

  /** Nur das Adminkonto/„alle Rechte“ und mit eigenem Passwort bestätigt */
  async function ownerConfirm(req, res) {
    if (req.user.role !== 'oberadmin') { bad(res, 'Das darf nur ein Benutzer mit allen Rechten.', 403); return false; }
    // bei Datei-Uploads (Rohdaten) kommt das Passwort in der Kopfzeile X-Mein-Passwort (URL-kodiert)
    let pw = (req.body && !Buffer.isBuffer(req.body) && req.body.myPassword) || '';
    if (!pw && req.get('X-Mein-Passwort')) { try { pw = decodeURIComponent(req.get('X-Mein-Passwort')); } catch (e) { pw = ''; } }
    if (!await ownPwOk(req, pw)) { pwBad(res, 'Dein Passwort stimmt nicht.'); return false; }
    return true;
  }

  admin.get('/backups/status', need('einstellungen'), (req, res) => res.json(backupStatus()));
  admin.put('/backups/settings', need('einstellungen'), async (req, res) => {
    const b = req.body || {};
    const num = (v, lo, hi) => { const n = parseInt(v, 10); if (!(n >= lo && n <= hi)) throw new Error('Ungültiger Wert.'); return String(n); };
    try {
      if (b.hour !== undefined) setSetting('backup_hour', num(b.hour, 0, 23));
      if (b.daily !== undefined) setSetting('backup_daily', num(b.daily, 1, 60));
      if (b.weekly !== undefined) setSetting('backup_weekly', num(b.weekly, 0, 52));
      if (b.monthly !== undefined) setSetting('backup_monthly', num(b.monthly, 0, 120));
    } catch (e) { return bad(res, 'Bitte gültige Zahlen eintragen (Uhrzeit 0–23, Tage 1–60, Wochen 0–52, Monate 0–120).'); }
    if (b.readable !== undefined) {
      // lesbare (unverschlüsselte) Auszüge einschalten: Namen, Beträge und Protokolle gingen dann im Klartext zu den Sicherungszielen – nur mit Passwort
      if (b.readable && getSetting('backup_readable', '0') !== '1') { if (!await ownerConfirm(req, res)) return; securityAlert('sicherung.ziel', `Lesbare (unverschlüsselte) Auszüge der Datensicherung wurden von ${req.user.name || req.user.username} eingeschaltet.`, { key: 'lesbar' }); }
      setSetting('backup_readable', b.readable ? '1' : '0');
    }
    audit(req.user, 'Datensicherung eingestellt', JSON.stringify(bkCfg()));
    res.json({ ok: true, ...backupStatus() });
  });
  admin.post('/backups/password', need('einstellungen'), rateLimit('bkpw', 10, 10 * 60000), asyncRoute(async (req, res) => {
    if (!(await ownerConfirm(req, res))) return;
    let k; try { k = await fullbackup.newKey((req.body || {}).password); } catch (e) { return bad(res, e.message); }
    const had = bkHasKey();
    setSetting('backup_kdf', JSON.stringify(k.kdf)); geheim.set('backup_enc_key', k.key); setSetting('backup_pw_at', nowTs());
    audit(req.user, had ? 'Sicherungspasswort geändert' : 'Sicherungspasswort festgelegt', k.kid.slice(0, 8));
    if (had) securityAlert('sicherung.passwort', `Das Sicherungspasswort wurde von ${req.user.name || req.user.username} geändert.`);
    res.json({ ok: true, changed: had });
  }));
  /* Sicherungspasswort prüfen (für das Notfallblatt) – nur „alle Rechte“, gebremst */
  admin.post('/backups/password/check', need('einstellungen'), owner, rateLimit('bkcheck', 10, 10 * 60000), asyncRoute(async (req, res) => {
    const k = bkKey(); if (!bkHasKey()) return bad(res, 'Noch kein Sicherungspasswort festgelegt.');
    if (bkWartet()) return bad(res, WARTET_MSG, 423);
    let ok = false; try { ok = crypto.timingSafeEqual(Buffer.from(fullbackup.keyId(await fullbackup.deriveKey(String((req.body || {}).password || ''), k.kdf))), Buffer.from(fullbackup.keyId(Buffer.from(k.key, 'hex')))); } catch (e) { ok = false; }
    if (!ok) return pwBad(res, 'Das Sicherungspasswort stimmt nicht.');
    setSetting('backup_pw_checked_at', nowTs());   // Passwort-Probe (alle 6 Monate) erledigt
    res.json({ ok: true });
  }));
  admin.post('/backups/run', need('einstellungen'), asyncRoute(async (req, res) => {
    try { res.json({ ok: true, msg: await runBackup(req.user.username) }); } catch (e) { bad(res, e.message); }
  }));
  admin.post('/backups/probe', need('einstellungen'), rateLimit('bkprobe', 12, 10 * 60000), asyncRoute(async (req, res) => {
    try { res.json({ ok: true, msg: await probeBackup(req.user.username) }); } catch (e) { bad(res, e.message); }
  }));
  admin.get('/backups/komplett/file/:file', need('einstellungen'), (req, res) => {
    if (!fullbackup.validName(req.params.file) || !fs.existsSync(path.join(KOMPLETT_DIR, req.params.file))) return bad(res, 'Sicherung nicht gefunden.', 404);
    audit(req.user, 'Komplettsicherung heruntergeladen', req.params.file);
    res.download(path.join(KOMPLETT_DIR, req.params.file), req.params.file);
  });
  /* Sicherungen in Dropbox (für „Wiederherstellen aus Dropbox“) und alte, unverschlüsselte Dateien aus früheren Versionen */
  admin.get('/backups/remote', need('einstellungen'), asyncRoute(async (req, res) => {
    const c = dbxCfg();
    if (!dbxReady(c)) return res.json({ connected: false, files: [], legacy: 0 });
    try {
      const files = (await dropbox.listFolder(c, `${c.folder}/Komplett`)).filter(e => e['.tag'] === 'file' && fullbackup.validName(e.name))
        .map(e => ({ file: e.name, size: e.size, mtime: e.server_modified })).sort((a, b) => (a.file < b.file ? 1 : -1));
      let legacy = 0;
      for (const sub of ['Datenbank', 'Excel']) legacy += (await dropbox.listFolder(c, `${c.folder}/${sub}`)).filter(e => e['.tag'] === 'file').length;
      res.json({ connected: true, files, legacy });
    } catch (e) { bad(res, e.message, 502); }
  }));
  admin.post('/backups/remote/cleanup-legacy', need('einstellungen'), asyncRoute(async (req, res) => {
    if (!await ownerConfirm(req, res)) return;
    const c = dbxCfg(); if (!dbxReady(c)) return bad(res, 'Dropbox ist nicht verbunden.');
    let n = 0;
    for (const sub of ['Datenbank', 'Excel']) for (const e of await dropbox.listFolder(c, `${c.folder}/${sub}`)) if (e['.tag'] === 'file') { await dropbox.remove(c, e.path_lower); n++; }
    audit(req.user, 'Alte unverschlüsselte Dropbox-Sicherungen gelöscht', `${n} Dateien`);
    res.json({ ok: true, removed: n });
  }));
  /* ---------- Sicherungsziele verwalten ----------
     Ansehen und Testen: „Einstellungen“. Anlegen, ändern, ein-/ausschalten, löschen: nur „alle Rechte“ mit eigenem Passwort –
     ein Ziel bekommt jede Nacht die (verschlüsselte) Sicherung, und Abschalten nähme dem Verein die Sicherung außer Haus. */
  admin.get('/backups/targets', need('einstellungen'), (req, res) => res.json({ targets: targetsView(), types: targets.TYPES, max: MAX_TARGETS }));
  /** Verbindung prüfen – mit gespeicherten oder (beim Anlegen/Bearbeiten) eingegebenen Daten */
  admin.post('/backups/targets/test', need('einstellungen'), owner, rateLimit('tgtest', 20, 10 * 60000), asyncRoute(async (req, res) => {
    const b = req.body || {};
    const old = b.id ? tgList().find(x => x.id === b.id) : null;
    let t; try { t = targets.clean({ ...(b.target || {}), allowInsecure: true }, old); } catch (e) { return bad(res, e.message); }
    // Das gespeicherte Passwort nur für denselben Server verwenden – sonst ließe es sich mit einer geänderten Adresse an einen fremden Server schicken
    const same = old && ['type', 'url', 'host', 'port', 'user', 'mode', 'insecure', 'hostKey', 'certFp'].every(k => (t[k] ?? '') === (old[k] ?? ''));
    if (old && !same && !b.secret && t.auth !== 'key') return bad(res, 'Die Adresse oder der Server hat sich geändert – bitte das Passwort für den Test noch einmal eingeben.');
    if (same && !b.secret && geheim.locked(tgSecretKey(old.id))) return bad(res, ZUGANG_ZU, 423);
    const secret = b.secret ? String(b.secret) : same ? geheim.get(tgSecretKey(old.id), '') : '';
    const a = targets.open(t, secret);
    try { const r = await a.test(); res.json({ ok: true, fingerprint: r.fingerprint || null }); }
    catch (e) { if (e.needConfirm || e.changed) return res.json({ ok: false, needConfirm: true, changed: Boolean(e.changed), fingerprint: e.fingerprint, error: e.message }); bad(res, e.message); }
    finally { await a.close(); }
  }));
  admin.post('/backups/targets/:id/test', need('einstellungen'), rateLimit('tgtest', 20, 10 * 60000), asyncRoute(async (req, res) => {
    const tg = targetById(String(req.params.id)); if (!tg) return bad(res, 'Sicherungsziel nicht gefunden.', 404);
    if (geheim.locked(tg.id === 'dropbox' ? 'dropbox_refresh' : tgSecretKey(tg.id))) return bad(res, ZUGANG_ZU, 423);
    const a = tg.adapter();
    try { await a.test(); tgSetStatus(tg.id, { tested: new Date().toISOString(), test_error: '', reconnect: false }); res.json({ ok: true }); }
    catch (e) { tgSetStatus(tg.id, { test_error: e.message, ...(e.reconnect ? { reconnect: true } : {}) }); bad(res, e.message); }
    finally { await a.close(); }
  }));
  /** Anlegen/Bearbeiten: wird nur gespeichert, wenn die Verbindung klappt (inkl. bestätigtem Fingerabdruck) */
  async function saveTarget(req, res, old) {
    if (!await ownerConfirm(req, res)) return;
    const b = req.body || {};
    if (!old && tgList().length >= MAX_TARGETS) return bad(res, `Höchstens ${MAX_TARGETS} Sicherungsziele.`);
    if (!old && (b.target || {}).type === 'gdrive') return bad(res, 'Google Drive wird über „Bei Google anmelden“ verbunden.');
    let t; try { t = targets.clean(b.target || {}, old); } catch (e) { return res.status(400).json({ error: e.message, needInsecure: Boolean(e.needInsecure) }); }
    if (old && !b.secret && geheim.locked(tgSecretKey(old.id))) return bad(res, ZUGANG_ZU, 423);
    const secret = b.secret ? String(b.secret).slice(0, 20000) : old ? geheim.get(tgSecretKey(old.id), '') : '';
    if (!secret) return bad(res, t.type === 'sftp' && t.auth === 'key' ? 'Bitte den privaten Schlüssel einfügen.' : t.type === 'gdrive' ? 'Bitte zuerst bei Google anmelden.' : 'Bitte das Passwort eintragen.');
    if (t.type === 'gdrive' && b.secret) return bad(res, 'Die Zugangsdaten für Google Drive kommen nur über „Bei Google anmelden“.');
    if (t.enabled) {
      const a = targets.open(t, secret);
      try { await a.test(); }
      catch (e) { return res.status(400).json({ error: e.message, needConfirm: Boolean(e.needConfirm || e.changed), fingerprint: e.fingerprint || null }); }
      finally { await a.close(); }
    }
    const list = tgList().filter(x => x.id !== t.id); list.push(t); tgSave(list);
    geheim.set(tgSecretKey(t.id), secret);
    audit(req.user, old ? 'Sicherungsziel geändert' : 'Sicherungsziel angelegt', `${t.name} (${targets.TYPES[t.type]}${t.enabled ? '' : ', aus'})`);
    if (old && old.enabled && !t.enabled) securityAlert('sicherung.ziel', `Das Sicherungsziel „${t.name}“ wurde von ${req.user.name || req.user.username} ausgeschaltet.`, { key: 'aus-' + t.id });
    res.json({ ok: true, targets: targetsView() });
  }
  admin.post('/backups/targets', need('einstellungen'), rateLimit('tgsave', 20, 10 * 60000), asyncRoute(async (req, res) => saveTarget(req, res, null)));
  admin.put('/backups/targets/:id', need('einstellungen'), rateLimit('tgsave', 20, 10 * 60000), asyncRoute(async (req, res) => {
    const old = tgList().find(x => x.id === String(req.params.id)); if (!old) return bad(res, 'Sicherungsziel nicht gefunden.', 404);
    return saveTarget(req, res, old);
  }));
  admin.delete('/backups/targets/:id', need('einstellungen'), async (req, res) => {
    if (!await ownerConfirm(req, res)) return;
    const old = tgList().find(x => x.id === String(req.params.id)); if (!old) return bad(res, 'Sicherungsziel nicht gefunden.', 404);
    tgSave(tgList().filter(x => x.id !== old.id));
    // Google: Anmeldung zurückgeben (Dateien in Drive bleiben). Der Widerruf gilt fürs ganze Google-Projekt – nur, wenn kein anderes Google-Ziel es noch braucht
    if (old.type === 'gdrive' && !tgList().some(x => x.type === 'gdrive')) { const g = require('./gdrive').parseSecret(geheim.get(tgSecretKey(old.id), '')); if (g.refresh) require('./gdrive').revoke(g); }
    geheim.drop(tgSecretKey(old.id)); db.prepare('DELETE FROM settings WHERE key = ?').run(`backup_target_${old.id}_status`);
    audit(req.user, 'Sicherungsziel entfernt', old.name);
    securityAlert('sicherung.ziel', `Das Sicherungsziel „${old.name}“ wurde von ${req.user.name || req.user.username} entfernt. Die Dateien dort bleiben erhalten.`, { key: 'weg-' + old.id });
    res.json({ ok: true, targets: targetsView() });
  });
  /* ---------- Google Drive verbinden (Geräte-Ablauf, src/gdrive.js) ----------
     Nur „alle Rechte“ mit eigenem Passwort (wie jedes Ziel). Clubwerk holt einen Code bei Google, die Verwaltung zeigt ihn an,
     der Vorstand bestätigt unter google.com/device, und Clubwerk fragt im Hintergrund nach. Erst wenn eine Testdatei geschrieben,
     gelesen und gelöscht ist, wird das Ziel gespeichert. Gerätecode, Secret und Token bleiben im Server; die Verwaltung sieht nur
     den kurzen Code für google.com/device und den Stand. */
  const gdrive = require('./gdrive');
  const gdFlows = new Map();   // Kennung → Ablauf (nur im Speicher, höchstens 15 Minuten nach dem Ende)
  const gdView = f => ({ id: f.id, state: f.state, userCode: f.state === 'wartet' ? f.userCode : '', url: f.url, expiresAt: f.expiresAt, error: f.error || '', account: f.account || '', targetId: f.targetId || '' });
  function gdStep(f) {
    if (f.state !== 'wartet') return;
    if (Date.now() > f.expiresAt) { f.state = 'abgelaufen'; f.error = 'Der Code ist abgelaufen, ohne dass die Anmeldung bestätigt wurde. Bitte noch einmal „Bei Google anmelden“.'; return; }
    f.timer = setTimeout(async () => {
      if (f.state !== 'wartet') return;
      try {
        const r = await gdrive.devicePoll(f.clientId, f.clientSecret, f.deviceCode);
        if (r.slow) f.interval = Math.min(60, f.interval + gdrive.MIN_INTERVAL);   // Google: bei slow_down 5 s länger warten
        if (!r.refresh) return gdStep(f);
        f.state = 'prueft';
        const cfg = { clientId: f.clientId, clientSecret: f.clientSecret, refresh: r.refresh, connectedAt: new Date().toISOString() };
        const old = f.oldId ? tgList().find(x => x.id === f.oldId) : null;
        if (f.oldId && !old) throw new Error('Das Sicherungsziel gibt es nicht mehr.');
        if (!old && tgList().length >= MAX_TARGETS) throw new Error(`Höchstens ${MAX_TARGETS} Sicherungsziele.`);
        const t = targets.clean({ ...f.target, type: 'gdrive' }, old);
        try { await gdrive.probe(cfg, t.folder); }
        catch (e) { await gdrive.revoke(cfg).catch(() => {}); throw new Error(`Google hat den Zugriff erlaubt, aber das Speichern einer Testdatei ist fehlgeschlagen – die Verbindung wurde deshalb nicht übernommen. ${e.message}`); }
        t.account = await gdrive.account(cfg);
        const list = tgList().filter(x => x.id !== t.id); list.push(t); tgSave(list);
        geheim.set(tgSecretKey(t.id), gdrive.makeSecret(cfg));
        tgSetStatus(t.id, { tested: new Date().toISOString(), test_error: '', last_error: '', reconnect: false });
        f.state = 'fertig'; f.account = t.account; f.targetId = t.id;
        audit(f.by, old ? 'Google Drive neu verbunden' : 'Sicherungsziel angelegt', `${t.name} (Google Drive${t.account ? ', ' + t.account : ''})`);
        securityAlert('sicherung.ziel', `Die Datensicherung wurde von ${f.byName} mit Google Drive verbunden${t.account ? ` (${t.account})` : ''} – Ziel „${t.name}“.`, { key: 'gdrive-' + t.id });
      } catch (e) { f.state = 'fehler'; f.error = gdrive.scrub(e.message); }
      finally { if (f.state !== 'wartet') gdEnd(f); }
    }, f.interval * 1000);
  }
  function gdEnd(f) {
    clearTimeout(f.timer); f.clientSecret = ''; f.deviceCode = '';   // Geheimnisse sofort vergessen, nur der Stand bleibt kurz sichtbar
    setTimeout(() => gdFlows.delete(f.id), 15 * 60000).unref();
  }
  admin.post('/backups/gdrive/start', need('einstellungen'), rateLimit('gdstart', 10, 10 * 60000), asyncRoute(async (req, res) => {
    if (!await ownerConfirm(req, res)) return;   // neues Google-Konto = Sicherungen gehen woandershin
    const b = req.body || {};
    const old = b.id ? tgList().find(x => x.id === String(b.id) && x.type === 'gdrive') : null;
    if (b.id && !old) return bad(res, 'Sicherungsziel nicht gefunden.', 404);
    if (!old && tgList().length >= MAX_TARGETS) return bad(res, `Höchstens ${MAX_TARGETS} Sicherungsziele.`);
    if (old && geheim.locked(tgSecretKey(old.id)) && !String(b.clientSecret || '').trim()) return bad(res, ZUGANG_ZU, 423);
    const prev = old ? gdrive.parseSecret(geheim.get(tgSecretKey(old.id), '')) : {};
    const clientId = String(b.clientId || '').trim() || prev.clientId || '';
    // gespeichertes Secret nur zusammen mit derselben Client-ID (sonst ginge es an einen fremden Client)
    const clientSecret = String(b.clientSecret || '').trim() || (clientId === prev.clientId ? prev.clientSecret : '') || '';
    let target; try { target = targets.clean({ ...(b.target || {}), type: 'gdrive' }, old); } catch (e) { return bad(res, e.message); }
    let d; try { gdrive.checkClient(clientId, clientSecret); d = await gdrive.deviceStart(clientId, clientSecret); } catch (e) { return bad(res, gdrive.scrub(e.message)); }
    for (const f of gdFlows.values()) if (f.userId === req.user.id && f.state === 'wartet') { f.state = 'abgebrochen'; gdEnd(f); }   // je Benutzer ein Ablauf
    const f = { id: crypto.randomBytes(12).toString('hex'), userId: req.user.id, by: req.user, byName: req.user.name || req.user.username, oldId: old ? old.id : '',
      clientId, clientSecret, deviceCode: d.deviceCode, userCode: d.userCode, url: d.url, interval: d.interval, expiresAt: Date.now() + d.expiresIn * 1000, state: 'wartet',
      target: { name: target.name, folder: target.folder, enabled: target.enabled, retention: target.retention } };
    gdFlows.set(f.id, f); gdStep(f);
    res.json({ ok: true, ...gdView(f) });
  }));
  const gdFlowOf = (req, res) => { const f = gdFlows.get(String(req.params.id)); if (!f || f.userId !== req.user.id) { bad(res, 'Diese Anmeldung gibt es nicht (mehr).', 404); return null; } return f; };
  admin.get('/backups/gdrive/flow/:id', need('einstellungen'), owner, (req, res) => { const f = gdFlowOf(req, res); if (f) res.json(gdView(f)); });
  admin.post('/backups/gdrive/flow/:id/cancel', need('einstellungen'), owner, (req, res) => { const f = gdFlowOf(req, res); if (!f) return; if (f.state === 'wartet') { f.state = 'abgebrochen'; gdEnd(f); } res.json(gdView(f)); });
  admin.get('/backups/gdrive/:id', need('einstellungen'), owner, (req, res) => {
    const t = tgList().find(x => x.id === String(req.params.id) && x.type === 'gdrive'); if (!t) return bad(res, 'Sicherungsziel nicht gefunden.', 404);
    if (geheim.locked(tgSecretKey(t.id))) return bad(res, ZUGANG_ZU, 423);
    const g = gdrive.parseSecret(geheim.get(tgSecretKey(t.id), ''));
    // Client-ID nur gekürzt (zum Wiedererkennen), Secret und Token nie
    res.json({ clientIdHint: g.clientId ? g.clientId.slice(0, 8) + '…' : '', hasSecret: Boolean(g.clientSecret), connectedAt: g.connectedAt || '' });
  });

  /** Komplettsicherungen auf einem Ziel (für „Wiederherstellen“) */
  admin.get('/backups/targets/:id/files', need('einstellungen'), asyncRoute(async (req, res) => {
    const tg = targetById(String(req.params.id)); if (!tg) return bad(res, 'Sicherungsziel nicht gefunden.', 404);
    if (geheim.locked(tg.id === 'dropbox' ? 'dropbox_refresh' : tgSecretKey(tg.id))) return bad(res, ZUGANG_ZU, 423);
    const a = tg.adapter();
    try { res.json({ files: (await a.list('Komplett')).filter(f => fullbackup.validName(f.name)).map(f => ({ file: f.name, size: f.size, mtime: f.mtime })).sort((x, y) => (x.file < y.file ? 1 : -1)) }); }
    catch (e) { bad(res, e.message, 502); }
    finally { await a.close(); }
  }));

  /* ---------- Große Uploads (Datenbank, Update-Paket, Modul-Sicherung): gestreamt auf die Platte ----------
     express.raw() würde die ganze Datei (bis 200 MB) im Speicher puffern – auf einem Raspberry Pi mit knapp 1 GB zu viel.
     Hier fließt der Anfragekörper mit Größenwächter direkt in eine Datei (INCOMING_DIR); die Route verarbeitet dann die Datei. */
  /** Anfragekörper nach dest streamen → Bytes. Bei Überschreitung von max oder Abbruch wird die Datei entfernt und ein Fehler geworfen. */
  async function receiveToFile(req, dest, max) {
    fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
    let n = 0;
    const guard = new (require('stream').Transform)({ transform(c, e, cb) { n += c.length; if (n > max) cb(Object.assign(new Error('Die Datei ist zu groß.'), { tooLarge: true })); else cb(null, c); } });
    try { await require('stream/promises').pipeline(req, guard, fs.createWriteStream(dest, { mode: 0o600 })); }
    catch (e) { try { fs.unlinkSync(dest); } catch (x) { /* schon gelöscht */ } throw e; }
    return n;
  }
  /** Middleware: Datei-Upload (alles außer JSON) nach INCOMING_DIR streamen → req.uploadFile, req.uploadSize; JSON-Anfragen laufen wie gewohnt weiter */
  const streamUpload = (max, ext = '.bin') => (req, res, next) => {
    if (/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return express.json({ limit: '1mb' })(req, res, next);
    const dest = path.join(INCOMING_DIR, `up_${crypto.randomBytes(12).toString('hex')}${ext}`);
    receiveToFile(req, dest, max).then(n => { req.uploadFile = dest; req.uploadSize = n; next(); })
      .catch(e => bad(res, e.tooLarge ? 'Die Datei ist zu groß.' : 'Hochladen fehlgeschlagen: ' + e.message, e.tooLarge ? 413 : 400));
  };
  const dropUpload = req => { if (req.uploadFile) { try { fs.unlinkSync(req.uploadFile); } catch (e) { /* schon weg */ } } };
  const MB = 1024 * 1024;

  /* ---------- Update per ZIP-Upload (nur Seitenleiste von Home Assistant, nur „alle Rechte“, mit Passwort) ---------- */
  const UPDATE_DIR = path.join(DATA_DIR, '.update');
  const RESERVE_DIR = path.join(DATA_DIR, 'update-reserve');
  let staged = null;   // geprüftes, noch nicht übernommenes Paket
  let updating = false;
  const updGuard = (req, res) => {
    if (req.user.role !== 'oberadmin') { bad(res, 'Updates einspielen darf nur ein Benutzer mit allen Rechten.', 403); return false; }
    if (!viaIngress(req) && process.env.CW_TEST_UPDATE_ANYWHERE !== '1') { bad(res, 'Updates gehen aus Sicherheitsgründen nur über die Home-Assistant-Seitenleiste.', 403); return false; }
    return true;
  };
  admin.get('/update/status', need('einstellungen'), asyncRoute(async (req, res) => {
    const o = await selfupdate.origin();
    res.json({ current: APP_VERSION, node: process.version, nodeOld: require('./security').nodeOutdated(), addonDir: Boolean(o.dir), origin: o.kind, mounted: o.mounted, supervisorError: o.supervisorError || '', supervisor: Boolean(process.env.SUPERVISOR_TOKEN),
      viaIngress: viaIngress(req) || process.env.CW_TEST_UPDATE_ANYWHERE === '1', owner: req.user.role === 'oberadmin', updating,
      staged: staged ? { version: staged.version, files: staged.files, size: staged.size, depsChanged: staged.depsChanged, changelog: staged.changelog } : null,
      reserves: selfupdate.reserves(RESERVE_DIR), lastError: getSetting('update_last_error', ''), lastOk: getSetting('update_last_ok', '') });
  }));
  admin.post('/update/upload', need('einstellungen'), rateLimit('updup', 10, 10 * 60000), streamUpload(200 * MB, '.zip'), asyncRoute(async (req, res) => {
    try {
      if (!updGuard(req, res)) return;
      if (!selfupdate.findAddonDir()) return bad(res, 'Diese Installation kommt nicht aus dem Ordner „addons“ (z. B. über GitHub) – Updates bitte über Home Assistant → Einstellungen → Add-ons.');
      if (!req.uploadFile || req.uploadSize < 100) return bad(res, 'Die Datei ist leer.');
      try {
        const info = await selfupdate.inspect(req.uploadFile, path.join(UPDATE_DIR, 'neu'), { currentVersion: APP_VERSION, currentDir: selfupdate.findAddonDir() });
        if (!info.newer) { staged = null; return bad(res, info.same ? `Version ${info.version} ist bereits installiert.` : `Das Paket (${info.version}) ist älter als die installierte Version ${APP_VERSION}. Zurück zu einer früheren Version geht über „Vorherige Version“.`); }
        staged = info;
        audit(req.user, 'Update hochgeladen und geprüft', `${APP_VERSION} → ${info.version} · Prüfsumme ${info.shaShort}`);
        res.json({ ok: true, current: APP_VERSION, ...info });
      } catch (e) { staged = null; bad(res, e.message); }
    } finally { dropUpload(req); }
  }));
  /** Übernehmen: Sicherung, Ordner tauschen, Home Assistant aktualisieren lassen (im Hintergrund) */
  async function applyFolder(req, res, newDir, label) {
    const dir = selfupdate.findAddonDir();
    if (!dir) return bad(res, 'Der Add-on-Ordner wurde nicht gefunden.');
    updating = true;
    try {
      // vorher sichern: Komplettsicherung (falls Sicherungspasswort festgelegt), sonst Datenbank-Schnappschuss
      try { if (bkHasKey()) await runBackup(req.user.username); else await backup.snapshot(db, 'vor-update'); }
      catch (e) { updating = false; return bad(res, 'Die Sicherung vor dem Update ist fehlgeschlagen – Update abgebrochen: ' + e.message); }
      const reserve = selfupdate.swap(dir, newDir, RESERVE_DIR, APP_VERSION);
      setSetting('update_last_error', '');
      audit(req.user, label, `${APP_VERSION} → ${selfupdate.yamlField(fs.readFileSync(path.join(dir, 'config.yaml'), 'utf8'), 'version')} (Reserve ${reserve})`);
      securityAlert('update', `Clubwerk wird von ${req.user.name || req.user.username} aktualisiert (${label}).`, { key: label });
      res.json({ ok: true, reserve, supervisor: Boolean(process.env.SUPERVISOR_TOKEN) });
    } catch (e) { updating = false; return bad(res, 'Update fehlgeschlagen: ' + e.message); }
    // Antwort ist raus – jetzt Home Assistant bitten, neu zu bauen (dabei wird diese Version beendet)
    setTimeout(async () => {
      try { const r = await selfupdate.triggerUpdate(); console.log('Update ausgelöst:', r); setSetting('update_last_ok', new Date().toISOString()); }
      catch (e) { console.error('Update auslösen:', e.message); setSetting('update_last_error', e.message); updating = false; }
    }, 500);
  }
  admin.post('/update/apply', need('einstellungen'), rateLimit('updapply', 5, 10 * 60000), asyncRoute(async (req, res) => {
    if (!updGuard(req, res) || !await ownerConfirm(req, res)) return;
    if (!staged) return bad(res, 'Bitte zuerst das Update-Paket hochladen.');
    if (updating) return bad(res, 'Das Update läuft bereits.');
    staged = null;
    return applyFolder(req, res, path.join(UPDATE_DIR, 'neu'), 'Update eingespielt');
  }));
  admin.post('/update/rollback', need('einstellungen'), rateLimit('updapply', 5, 10 * 60000), asyncRoute(async (req, res) => {
    if (!updGuard(req, res) || !await ownerConfirm(req, res)) return;
    const name = String((req.body || {}).name || '');
    const r = selfupdate.reserves(RESERVE_DIR).find(x => x.name === name);
    if (!r) return bad(res, 'Diese frühere Version gibt es nicht (mehr).');
    // Reserve erst kopieren – beim Tausch wird die aktuelle Version selbst zur Reserve
    const tmp = path.join(UPDATE_DIR, 'zurueck'); fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(path.join(RESERVE_DIR, name), tmp, { recursive: true });
    return applyFolder(req, res, tmp, `Zurück auf Version ${r.version}`);
  }));
  /* Reste eines abgebrochenen Ordnertauschs (Stromausfall mitten im Update) und nicht übernommene Pakete aufräumen */
  if (!DEMO_KOPIE && process.env.CW_LESEKOPIE !== '1') {
    for (const t of selfupdate.tauschReste()) console.log('Update-Reste:', t);
    try { fs.rmSync(UPDATE_DIR, { recursive: true, force: true }); } catch (e) { /* schon gelöscht */ }
  }
  /* Version gewechselt: Schnappschuss „vor-update“ (oben vor dem Öffnen der Datenbank). Läuft jetzt eine ältere Version als zuletzt, klar warnen. */
  if (updMsg) {
    if (updMsg.datei) { console.log(`Version ${updMsg.von || '?'} → ${updMsg.nach}: Sicherung ${updMsg.datei}`); audit('system', 'Sicherung vor Versionswechsel', `${updMsg.von || '?'} → ${updMsg.nach}: ${updMsg.datei}`); }
    if (updMsg.fehler) securityAlert('sicherung.fehler', `Vor dem Wechsel auf Version ${updMsg.nach || APP_VERSION} konnte keine Sicherung der Datenbank angelegt werden: ${updMsg.fehler}`, { key: 'vor-update' });
    if (updMsg.neuer) {
      const t = `Die Datenbank ist neuer: Sie wurde zuletzt von Clubwerk ${updMsg.neuer} benutzt, hier läuft die ältere Version ${updMsg.nach}. Ältere Versionen kennen nicht alles, was neuere angelegt haben. Wenn etwas fehlt oder Fehler auftreten: wieder auf ${updMsg.neuer} aktualisieren oder unter Einstellungen › Datensicherung die Sicherung „vor-update“ aus der Zeit vor ${updMsg.neuer} zurückspielen.`;
      console.error(t); securityAlert('update.aelter', t, { key: updMsg.neuer });
    }
  }
  /* Fehler beim Auslösen nach Neustart zurücksetzen, sobald die neue Version läuft */
  if (getSetting('update_running_version', '') !== APP_VERSION) { setSetting('update_running_version', APP_VERSION); setSetting('update_last_error', ''); }
  /* Komplettsicherung von einem anderen Gerät hochladen (gestreamt, ohne alles in den Speicher zu laden) */
  admin.post('/backups/komplett/upload', need('einstellungen'), owner, asyncRoute(async (req, res) => {
    fs.mkdirSync(INCOMING_DIR, { recursive: true, mode: 0o700 });
    for (const f of fs.readdirSync(INCOMING_DIR)) { try { if (Date.now() - fs.statSync(path.join(INCOMING_DIR, f)).mtimeMs > 6 * 3600000) fs.unlinkSync(path.join(INCOMING_DIR, f)); } catch (e) { /* schon gelöscht */ } }
    const id = crypto.randomBytes(12).toString('hex');
    const dest = path.join(INCOMING_DIR, `up_${id}${fullbackup.EXT}`);
    let n;
    try { n = await receiveToFile(req, dest, 4 * 1024 * MB); }
    catch (e) { return bad(res, 'Hochladen fehlgeschlagen: ' + e.message, e.tooLarge ? 413 : 400); }
    let h; try { h = fullbackup.readHeader(dest).head; } catch (e) { fs.unlinkSync(dest); return bad(res, e.message); }
    res.json({ ok: true, id, created: h.created, app: h.app, size: n, sameKey: h.kid === (bkHasKey() ? fullbackup.keyId(Buffer.from(bkKey().key, 'hex')) : '') });
  }));
  /** Quelle einer Komplettsicherung (lokal, hochgeladen oder von einem Sicherungsziel geholt) → { src, temp } bzw. null. temp: Datei danach löschen */
  async function komplettQuelle(b) {
    if (b.source === 'local') return fullbackup.validName(b.file) && fs.existsSync(path.join(KOMPLETT_DIR, b.file)) ? { src: path.join(KOMPLETT_DIR, b.file), temp: false } : null;
    if (b.source === 'upload') { const src = /^[a-f0-9]{24}$/.test(String(b.file || '')) && path.join(INCOMING_DIR, `up_${b.file}${fullbackup.EXT}`); return src && fs.existsSync(src) ? { src, temp: true } : null; }
    if (b.source === 'dropbox' || b.source === 'target') {
      const tg = targetById(b.source === 'dropbox' ? 'dropbox' : String(b.target || ''));
      if (!tg) throw Object.assign(new Error('Sicherungsziel nicht gefunden.'), { status: 404 });
      if (!fullbackup.validName(b.file)) return null;
      fs.mkdirSync(INCOMING_DIR, { recursive: true, mode: 0o700 });
      const src = path.join(INCOMING_DIR, `dl_${crypto.randomBytes(8).toString('hex')}${fullbackup.EXT}`);
      const a = tg.adapter();
      try { await a.get('Komplett', b.file, src); } catch (e) { try { fs.unlinkSync(src); } catch (x) { /* schon gelöscht */ } throw e; } finally { await a.close(); }
      return { src, temp: true };
    }
    return null;
  }
  /* Wiederherstellen aus einer Komplettsicherung (lokal, aus Dropbox oder hochgeladen) – wirksam beim nächsten Neustart */
  admin.post('/backups/komplett/restore', need('einstellungen'), rateLimit('bkrestore', 6, 10 * 60000), asyncRoute(async (req, res) => {
    if (!await ownerConfirm(req, res)) return;
    const b = req.body || {};
    let src = null, temp = false;
    try {
      const q = await komplettQuelle(b);
      if (q) ({ src, temp } = q);
      if (!src) return bad(res, 'Sicherung nicht gefunden.', 404);
      // Sicherung aus einer neueren Version: deren Datenbank kennt dieser Code nicht (wie bei der Teil-Wiederherstellung) – erst aktualisieren
      let head = {}; try { head = fullbackup.readHeader(src).head || {}; } catch (e) { /* kein lesbarer Kopf: extract() meldet den Fehler */ }
      if (head.app && require('./teilsicherung').neuer(head.app, APP_VERSION)) return bad(res, `Diese Sicherung stammt aus Clubwerk ${head.app} – hier läuft ${APP_VERSION}. Bitte zuerst Clubwerk aktualisieren.`);
      const tmp = fs.mkdtempSync(path.join(DATA_DIR, '.wiederherstellung-'));
      try {
        const pw = String(b.password || '');
        const man = await fullbackup.extract(src, pw ? { password: pw, outDir: tmp } : { key: bkHasKey() ? bkKey().key : null, outDir: tmp });
        if (man.app && require('./teilsicherung').neuer(man.app, APP_VERSION)) throw new Error(`Diese Sicherung stammt aus Clubwerk ${man.app} – hier läuft ${APP_VERSION}. Bitte zuerst Clubwerk aktualisieren.`);   // geprüfte Angabe
        const err = backup.validate(path.join(tmp, fullbackup.DB_NAME));
        if (err) throw new Error(err);
        const name = backup.fileName('komplett');
        fs.renameSync(path.join(tmp, fullbackup.DB_NAME), path.join(backup.BACKUP_DIR, name));
        backup.markRestore(name);
        backup.stageDirs(tmp, name, fullbackup.DIRS);
        audit(req.user, 'Wiederherstellung aus Komplettsicherung vorgemerkt', `${b.source}: ${b.file} (Stand ${man.created})`);
        res.json({ ok: true, restart: true, created: man.created, club: man.club, dirs: man.dirs });
      } catch (e) {
        if (e.needPassword) { if (b.source === 'upload') temp = false; return res.status(400).json({ error: e.message, needPassword: true }); }
        throw e;
      } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    } catch (e) { bad(res, e.message, e.status || 400); }
    finally { if (temp && src) { try { fs.unlinkSync(src); } catch (e) { /* schon gelöscht */ } } }
  }));
  /* Teil-Wiederherstellung: einzelne Module und Teile aus einer Komplettsicherung übernehmen (src/teilsicherung.js) */
  require('./teilsicherung').routes(admin, { db, plugins, need, owner, bad, asyncRoute, rateLimit, ownerConfirm, audit, quelle: komplettQuelle, fullbackup, backup,
    bkKey: () => (bkHasKey() ? bkKey() : null), appVersion: APP_VERSION, getSetting, setSetting });

  admin.get('/dropbox', need('einstellungen'), (req, res) => {
    const c = dbxCfg();
    res.json({ appKey: c.appKey, hasSecret: c.hasSecret, connected: dbxReady(c), locked: c.hasSecret && !c.appSecret, folder: c.folder, enabled: c.enabled,
      account: getSetting('dropbox_account', ''), authUrl: c.appKey ? dropbox.authUrl(c.appKey) : null });
  });
  admin.put('/dropbox', need('einstellungen'), async (req, res) => {
    const b = req.body || {};
    // andere Dropbox-App = Sicherungen gehen woandershin: wie bei allen Sicherungszielen nur mit dem eigenen Passwort
    const keyChange = (b.appKey !== undefined && String(b.appKey).trim() !== getSetting('dropbox_app_key', '')) || Boolean(b.appSecret);
    if (keyChange && !await ownerConfirm(req, res)) return;
    if (b.appKey !== undefined) {
      const k = String(b.appKey).trim();
      if (k && !/^[a-z0-9]{8,40}$/i.test(k)) return bad(res, 'Der App key sieht nicht richtig aus.');
      if (k !== getSetting('dropbox_app_key', '')) geheim.drop('dropbox_refresh');   // andere App → neu verbinden
      setSetting('dropbox_app_key', k);
    }
    if (b.appSecret) {
      const sec = String(b.appSecret).trim();
      if (!/^[a-z0-9]{8,40}$/i.test(sec)) return bad(res, 'Das App secret sieht nicht richtig aus.');
      geheim.set('dropbox_app_secret', sec);
    }
    if (b.folder !== undefined) setSetting('dropbox_folder', dropbox.cleanFolder(b.folder));
    if (b.enabled !== undefined) {
      if (!b.enabled && getSetting('dropbox_enabled', '1') === '1') securityAlert('sicherung.dropbox', `Die nächtliche Sicherung nach Dropbox wurde von ${req.user.name || req.user.username} pausiert.`, { key: 'aus' });
      setSetting('dropbox_enabled', b.enabled ? '1' : '0');
    }
    audit(req.user, 'Dropbox-Einstellungen geändert');
    if (keyChange) securityAlert('sicherung.ziel', `Die Dropbox-App für die Datensicherung wurde von ${req.user.name || req.user.username} geändert.`, { key: 'dropbox-app' });
    res.json({ ok: true });
  });
  admin.post('/dropbox/connect', need('einstellungen'), rateLimit('bkpw', 10, 10 * 60000), asyncRoute(async (req, res) => {
    if (!await ownerConfirm(req, res)) return;   // neues Dropbox-Konto = Sicherungen gehen woandershin
    const c = dbxCfg();
    if (geheim.locked('dropbox_app_secret')) return bad(res, ZUGANG_ZU, 423);
    if (!c.appKey || !c.appSecret) return bad(res, 'Bitte zuerst App key und App secret speichern.');
    const code = String((req.body || {}).code || '').trim();
    if (!/^[\w-]{10,200}$/.test(code)) return bad(res, 'Bitte den Code aus dem Dropbox-Fenster einfügen.');
    try {
      const refresh = await dropbox.exchangeCode(c.appKey, c.appSecret, code);
      // erst verbunden, wenn Schreiben wirklich klappt (Testdatei hochladen, wiederfinden, löschen) – sonst fiele es erst nachts auf
      try { await dropbox.probe({ ...c, refresh }, c.folder); }
      catch (e) {
        await dropbox.revoke({ ...c, refresh });
        tgSetStatus('dropbox', { test_error: e.message });
        return bad(res, `Dropbox hat den Zugriff erlaubt, aber das Speichern einer Testdatei ist fehlgeschlagen – die Verbindung wurde deshalb nicht übernommen. ${e.message}`);
      }
      geheim.set('dropbox_refresh', refresh);
      tgSetStatus('dropbox', { tested: new Date().toISOString(), test_error: '' });
      let who = '';
      try { who = await dropbox.account({ ...c, refresh }); } catch (e) { /* App ohne Kontoberechtigung – egal */ }
      setSetting('dropbox_account', who);
      audit(req.user, 'Dropbox verbunden', who);
      securityAlert('sicherung.dropbox', `Die Datensicherung wurde von ${req.user.name || req.user.username} mit Dropbox verbunden${who ? ` (${who})` : ''}.`, { key: 'verbunden' });
      res.json({ ok: true, account: who });
    } catch (e) { bad(res, e.message); }
  }));
  admin.post('/dropbox/disconnect', need('einstellungen'), asyncRoute(async (req, res) => {
    const c = dbxCfg();
    if (dbxReady(c)) await dropbox.revoke(c);
    geheim.drop('dropbox_refresh'); setSetting('dropbox_account', '');
    audit(req.user, 'Dropbox getrennt');
    res.json({ ok: true });
  }));

  /* ---------- Datensicherung (alle Rechte) ---------- */
  admin.get('/backups', need('einstellungen'), (req, res) => {
    res.json({ list: backup.list(), pending: backup.pendingRestore(), restored: restoredMsg,
      beleg_count: belegFiles().length });
  });

  admin.post('/backups', need('einstellungen'), asyncRoute(async (req, res) => {
    const file = await backup.snapshot(db, 'manuell');
    audit(req.user, 'Sicherung erstellt', file);
    res.json({ file });
  }));

  /* Schnappschuss herunterladen: Er enthält auch Schlüssel (z. B. den der Komplettsicherungen) – nur mit dem eigenen Passwort (POST) */
  admin.post('/backups/file/:file', need('einstellungen'), rateLimit('bkpw', 10, 10 * 60000), async (req, res) => {
    if (!await ownerConfirm(req, res)) return;
    const f = req.params.file;
    if (!backup.safeName(f) || !fs.existsSync(path.join(backup.BACKUP_DIR, f))) return bad(res, 'Nicht gefunden.', 404);
    audit(req.user, 'Sicherung heruntergeladen', f);
    res.download(path.join(backup.BACKUP_DIR, f), f);
  });

  /* Komplettsicherung: frischer Datenbank-Schnappschuss + alle Belege und Artikelbilder als .tar.gz */
  /* (die frühere unverschlüsselte Komplettsicherung als .tar.gz entfällt – ersetzt durch die verschlüsselte Komplettsicherung) */

  admin.post('/backups/upload', need('einstellungen'), streamUpload(200 * MB, '.db'), asyncRoute(async (req, res) => {
    try {
      if (!req.uploadFile || req.uploadSize < 100) return bad(res, 'Die Datei ist leer.');
      const err = backup.validate(req.uploadFile);
      if (err) return bad(res, err);
      const name = backup.fileName('hochgeladen');
      fs.mkdirSync(backup.BACKUP_DIR, { recursive: true });
      fs.renameSync(req.uploadFile, path.join(backup.BACKUP_DIR, name));   // gleiche Platte (DATA_DIR) → nur umbenennen
      req.uploadFile = null;
      audit(req.user, 'Sicherung hochgeladen', name);
      res.json({ file: name });
    } finally { dropUpload(req); }
  }));

  admin.post('/backups/restore', need('einstellungen'), asyncRoute(async (req, res) => {
    if (!await ownerConfirm(req, res)) return;   // ersetzt die ganze Datenbank (auch Benutzer und Rechte) – nur mit Passwort
    const f = String((req.body || {}).file || '');
    try { backup.markRestore(f); } catch (e) { return bad(res, e.message); }
    audit(req.user, 'Wiederherstellung vorgemerkt', f);
    res.json({ ok: true });
  }));

  admin.delete('/backups/restore', need('einstellungen'), (req, res) => {
    backup.cancelRestore();
    audit(req.user, 'Wiederherstellung abgebrochen');
    res.json({ ok: true });
  });
  return { bkCfg, bkHasKey, bkRunning: () => bkRunning, bkWartet, dropUpload, MB, ownerConfirm, probeBackup, runBackup, streamUpload };
};
