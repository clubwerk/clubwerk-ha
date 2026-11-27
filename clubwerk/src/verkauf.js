'use strict';
/* Verkauf (Modul „Verkauf“, Kern): Artikel, Lieferungen und Belege, Bestand, Buchungen, Abrechnung, Abtippliste, Gäste-Deckel,
   Veranstaltungen, Bestellung und Excel-Export – Adressen der Verwaltung. Aus server.js ausgelagert: die Helfer kommen von dort (h),
   der Aufruf steht an derselben Stelle, die Reihenfolge der Adressen bleibt. */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const { db, isPerson, splitPersonName, nameKey, lastFirst, customArticleId, DATA_DIR, getSetting, getJsonSetting, setSetting, stockList, lastSettlement, audit, clubColor, once } = require('./db');
const { euro, today, nowTs, isDate, deD, imageType, readSheet } = require('./util');
const artIcons = require('./articleicons');
const konfigio = require('./konfigio');
const mail = require('./mail');
const plugins = require('./plugins');
const invoices = require('./invoices');
const { buildWorkbook } = require('./export');
const i18n = require('./i18n');
module.exports = function verkaufRouten(h) {
  const {
    addGuest, admin, asyncRoute, bad, cleanName, closeTab, CUT, defaultRange, eventOpenAll, guestOpen, int, isTs, maxBookingId, need, nurAnschreiben, NUR_ANSCHREIBEN_MSG, OPEN_GUEST,
    OPEN_KONTO, orderSettings, topDays, topN
  } = h;
  /* ---------- Artikel ---------- */
  function articleFromBody(b, base = {}) {
    const a = {
      name: b.name !== undefined ? cleanName(b.name) : base.name,
      category: b.category !== undefined ? String(b.category).trim().slice(0, 40) || 'Sonstiges' : base.category,
      price_cents: b.price_cents !== undefined ? int(b.price_cents, -1) : base.price_cents,
      crate_size: b.crate_size !== undefined ? int(b.crate_size, 1) : base.crate_size,
      min_stock: b.min_stock !== undefined ? int(b.min_stock, 0) : base.min_stock,
      target_stock: b.target_stock !== undefined ? int(b.target_stock, 0) : (base.target_stock || 0),
      track_stock: b.track_stock !== undefined ? (b.track_stock ? 1 : 0) : base.track_stock,
      active: b.active !== undefined ? (b.active ? 1 : 0) : base.active,
      sort: b.sort !== undefined ? int(b.sort, 100) : base.sort,
      icon: b.icon !== undefined ? (b.icon && artIcons.has(String(b.icon)) ? String(b.icon) : null) : (base.icon === undefined ? null : base.icon),
    };
    if (!a.name) throw new Error('Name fehlt.');
    if (!(a.price_cents >= 0)) throw new Error('Preis ungültig.');
    if (!(a.crate_size >= 1 && a.crate_size <= 100)) throw new Error('Gebindegröße bitte zwischen 1 und 100.');
    if (a.price_cents > 100000) throw new Error('Preis ungültig.');
    return a;
  }

  admin.get('/articles', (req, res) => res.json(stockList()));

  /* Artikelliste als Excel: herunterladen, bearbeiten, wieder einspielen (auch zum Übernehmen von einem anderen Verein) */
  const ART_COLS = ['ID', 'Artikel', 'Kategorie', 'Preis', 'Gebinde', 'Bestand führen', 'Mindestbestand', 'Bestellen bis', 'Aktiv'];
  admin.get('/articles/export.xlsx', need('artikel'), asyncRoute(async (req, res) => {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Artikel');
    ws.columns = ART_COLS.map((h, i) => ({ header: h, width: [8, 34, 16, 10, 8, 15, 15, 14, 8][i] }));
    ws.getRow(1).font = { bold: true };
    for (const a of db.prepare('SELECT * FROM articles WHERE custom = 0 AND deleted = 0 ORDER BY cat_rank(category), de_key(category), de_key(name)').all()) {
      ws.addRow([a.id, a.name, a.category, a.price_cents / 100, a.crate_size, a.track_stock ? 'ja' : 'nein', a.min_stock, a.target_stock, a.active ? 'ja' : 'nein']);
    }
    ws.getColumn(4).numFmt = '#,##0.00 "€"';
    ws.getColumn(1).font = { color: { argb: 'FF8B958F' } };
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="Artikel.xlsx"' });
    await wb.xlsx.write(res); res.end();
  }));
  admin.post('/articles/import-excel', need('artikel'), express.raw({ type: () => true, limit: '5mb' }), asyncRoute(async (req, res) => {
    const norm = v => String(v || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
    const want = { id: ['id', 'artikelid'], name: ['artikel', 'name', 'bezeichnung', 'produkt'], cat: ['spalte', 'kategorie', 'gruppe'], price: ['preis', 'vkpreis', 'verkaufspreis'],
      crate: ['gebinde', 'gebindegröße', 'kiste', 'kistengröße', 'flaschenjekiste'], track: ['bestandführen', 'bestand'], min: ['mindestbestand', 'mindest'],
      target: ['bestellenbis'], active: ['aktiv'] };
    for (const k of Object.keys(want)) want[k] = i18n.aliases(want[k], norm);
    let found;
    try { found = await readSheet(req.body, { want, norm, rows: 10, ok: c => c.name && c.price, notXlsx: 'Bitte eine Excel-Datei (.xlsx) hochladen.' }); } catch (e) { return bad(res, e.message); }
    if (!found) return bad(res, 'Keine Überschriften „Artikel“ und „Preis“ gefunden. Am einfachsten die Artikelliste als Excel herunterladen und als Vorlage nehmen.');
    const { ws, cols, head } = found;
    const txt = (row, k) => (cols[k] ? String(row.getCell(cols[k]).text || '').trim() : '');
    const num = s => { if (String(s).trim() === '') return NaN; const n = Number(String(s).replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
    const NO = new Set(['nein', 'n', '0', 'false', 'no', ...i18n.aliases(['nein'], v => String(v).toLowerCase().trim())]);
    const yes = (s, d) => (s === '' ? d : !NO.has(String(s).toLowerCase().trim()));
    // Abgleich: zuerst über die ID (nur Artikel, die es hier gibt), sonst über den Namen. Gelöschte Artikel werden nie wiederbelebt –
    // ein gleichnamiger neuer Artikel bekommt eine neue ID. IDs aus der Datei, die es hier nicht gibt, werden nie übernommen.
    const live = db.prepare('SELECT * FROM articles WHERE custom = 0 AND deleted = 0').all();
    const byId = new Map(live.map(a => [a.id, a])), byName = new Map(live.map(a => [a.name.toLowerCase(), a]));
    const FIELDS = ['name', 'category', 'price_cents', 'crate_size', 'track_stock', 'min_stock', 'target_stock', 'active'];
    const rows = []; const seenName = new Set(), seenId = new Set();
    for (let i = head + 1; i <= ws.rowCount && rows.length < 500; i++) {
      const row = ws.getRow(i); const name = cleanName(txt(row, 'name'), 60);
      if (!name) continue;
      const price = num(txt(row, 'price'));
      const fileId = /^\d{1,9}$/.test(txt(row, 'id')) ? Number(txt(row, 'id')) : null;
      const a = { name, category: (txt(row, 'cat') || 'Sonstiges').slice(0, 40), price_cents: Math.round(price * 100),
        crate_size: Math.max(1, Math.min(100, int(txt(row, 'crate'), 1))), track_stock: yes(txt(row, 'track'), true) ? 1 : 0,
        min_stock: Math.max(0, int(txt(row, 'min'), 0)), target_stock: Math.max(0, int(txt(row, 'target'), 0)), active: yes(txt(row, 'active'), true) ? 1 : 0 };
      const e = (fileId && byId.get(fileId)) || byName.get(name.toLowerCase()) || null;
      let status = 'neu', match = null;
      if (!Number.isFinite(price) || price < 0 || price > 1000) status = 'Preis ungültig';
      else if ((e && seenId.has(e.id)) || seenName.has(name.toLowerCase())) status = 'doppelt';
      else if (e) {
        // Name gleich, aber andere ID in der Datei → trotzdem derselbe Artikel (Name ist hier eindeutig)
        const diff = FIELDS.filter(k => e[k] !== a[k]);
        status = diff.length ? 'ändern' : 'unverändert';
        match = fileId === e.id ? 'id' : 'name';
        a.id = e.id;
        if (diff.length) a.current = Object.fromEntries(FIELDS.map(k => [k, e[k]]));
        a.diff = diff;
        // Umbenennen auf einen Namen, den schon ein anderer Artikel trägt, geht nicht
        if (diff.includes('name')) { const o = byName.get(name.toLowerCase()); if (o && o.id !== e.id) { status = 'Name schon vergeben'; } }
        seenId.add(e.id);
      }
      seenName.add(name.toLowerCase());
      rows.push({ line: i, status, match, fileId, ...a });
    }
    const inFile = new Set(rows.filter(r => r.id).map(r => r.id));
    const others = live.filter(a => a.active && !inFile.has(a.id));
    // Entscheidung je Artikel: „take“ = IDs, bei denen die Werte aus der Datei übernommen werden; alle anderen behalten den Bestand
    const take = new Set(String(req.query.take || '').split(',').filter(x => /^\d+$/.test(x)).map(Number));
    if (req.query.commit === '1') {
      if (req.query.hideOthers === '1') { const h = db.prepare('UPDATE articles SET active = 0 WHERE id = ?'); db.transaction(() => others.forEach(a => h.run(a.id)))(); }
      const ins = db.prepare('INSERT INTO articles(name, category, price_cents, crate_size, track_stock, min_stock, target_stock, active, sort, icon) VALUES (?,?,?,?,?,?,?,?,?,?)');
      const upd = db.prepare('UPDATE articles SET name = ?, category = ?, price_cents = ?, crate_size = ?, track_stock = ?, min_stock = ?, target_stock = ?, active = ? WHERE id = ?');
      const setSort = db.prepare('UPDATE articles SET sort = ? WHERE id = ?');
      // Reihenfolge der Datei = Reihenfolge am Tablet
      db.transaction(() => rows.forEach((r, i) => {
        const sort = (i + 1) * 10;
        if (r.status === 'neu') ins.run(r.name, r.category, r.price_cents, r.crate_size, r.track_stock, r.min_stock, r.target_stock, r.active, sort, artIcons.guess(r.name, r.category));
        if (r.status === 'ändern' && take.has(r.id)) upd.run(r.name, r.category, r.price_cents, r.crate_size, r.track_stock, r.min_stock, r.target_stock, r.active, r.id);
        if (r.id && ((r.status === 'ändern' && take.has(r.id)) || r.status === 'unverändert')) setSort.run(sort, r.id);
      }))();
      const taken = rows.filter(r => r.status === 'ändern' && take.has(r.id));
      audit(req.user, 'Artikel aus Excel importiert', `${rows.filter(r => r.status === 'neu').length} neu, ${taken.length} aus der Datei übernommen, ${rows.filter(r => r.status === 'ändern').length - taken.length} unverändert gelassen`);
    }
    res.json({ rows, newCount: rows.filter(r => r.status === 'neu').length, changeCount: rows.filter(r => r.status === 'ändern').length,
      takenCount: req.query.commit === '1' ? rows.filter(r => r.status === 'ändern' && take.has(r.id)).length : undefined, others: others.map(a => a.name) });
  }));

  admin.post('/articles', need('artikel'), (req, res) => {
    let a;
    try { a = articleFromBody(req.body || {}, { category: 'Sonstiges', price_cents: 0, crate_size: 1, min_stock: 0, track_stock: 1, active: 1, sort: 100 }); }
    catch (e) { return bad(res, e.message); }
    if ((req.body || {}).icon === undefined) a.icon = artIcons.guess(a.name, a.category);
    const r = db.prepare(`INSERT INTO articles(name, category, price_cents, crate_size, min_stock, target_stock, track_stock, active, sort, icon)
    VALUES (@name,@category,@price_cents,@crate_size,@min_stock,@target_stock,@track_stock,@active,@sort,@icon)`).run(a);
    audit(req.user, 'Artikel angelegt', `${a.name} ${euro(a.price_cents)}`);
    res.json({ id: Number(r.lastInsertRowid) });
  });

  admin.put('/articles/:id', need('artikel'), (req, res) => {
    const base = db.prepare('SELECT * FROM articles WHERE id = ? AND deleted = 0').get(int(req.params.id));   // gelöschte Artikel bleiben gelöscht
    if (!base || base.custom) return bad(res, 'Nicht gefunden.', 404);
    let a;
    try { a = articleFromBody(req.body || {}, base); } catch (e) { return bad(res, e.message); }
    db.prepare(`UPDATE articles SET name=@name, category=@category, price_cents=@price_cents, crate_size=@crate_size,
    min_stock=@min_stock, target_stock=@target_stock, track_stock=@track_stock, active=@active, sort=@sort, icon=@icon WHERE id=@id`).run({ ...a, id: base.id });
    if (base.price_cents !== a.price_cents || base.name !== a.name || base.active !== a.active) {
      audit(req.user, 'Artikel geändert', `${base.name}: ${euro(base.price_cents)} → ${euro(a.price_cents)}${a.active ? '' : ', ausgeblendet'}`);
    }
    res.json({ ok: true });
  });

  /* Eigenes Artikelbild: kommt im Browser bereits verkleinert (quadratisch, 384 px) als WebP/PNG/JPG an */
  admin.put('/articles/:id/image', need('artikel'), express.raw({ type: () => true, limit: artIcons.MAX_BYTES + 1024 }), (req, res) => {
    const a = db.prepare('SELECT * FROM articles WHERE id = ? AND custom = 0 AND deleted = 0').get(int(req.params.id));
    if (!a) return bad(res, 'Nicht gefunden.', 404);
    let file;
    try { file = artIcons.saveImage(DATA_DIR, a.id, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)); } catch (e) { return bad(res, e.message); }
    if (a.image && a.image !== file) artIcons.removeImage(DATA_DIR, a.image);
    db.prepare('UPDATE articles SET image = ? WHERE id = ?').run(file, a.id);
    audit(req.user, 'Artikelbild geändert', a.name);
    res.json({ ok: true, image: file });
  });
  admin.delete('/articles/:id/image', need('artikel'), (req, res) => {
    const a = db.prepare('SELECT * FROM articles WHERE id = ? AND custom = 0').get(int(req.params.id));
    if (!a) return bad(res, 'Nicht gefunden.', 404);
    if (a.image) { artIcons.removeImage(DATA_DIR, a.image); db.prepare('UPDATE articles SET image = NULL WHERE id = ?').run(a.id); audit(req.user, 'Artikelbild entfernt', a.name); }
    res.json({ ok: true });
  });

  /* Artikel löschen: nie verkauft/geliefert → endgültig; sonst aus allen Listen und vom Tablet entfernt,
     alte Buchungen und Lieferungen bleiben (Bestand und Abrechnung stimmen weiter). */
  admin.delete('/articles/:id', need('artikel'), (req, res) => {
    const a = db.prepare('SELECT * FROM articles WHERE id = ? AND deleted = 0').get(int(req.params.id));
    if (!a) return res.json({ ok: true });
    if (a.custom) return bad(res, 'Dieser Systemartikel kann nicht gelöscht werden.');
    const n = db.prepare('SELECT COUNT(*) n FROM bookings WHERE article_id = ?').get(a.id).n
      + db.prepare('SELECT COUNT(*) n FROM delivery_items WHERE article_id = ?').get(a.id).n
      + db.prepare('SELECT COUNT(*) n FROM stock_moves WHERE article_id = ?').get(a.id).n;
    db.transaction(() => {
      db.prepare('DELETE FROM event_articles WHERE article_id = ?').run(a.id);
      db.prepare('DELETE FROM supplier_map WHERE article_id = ?').run(a.id);
      if (n) db.prepare('UPDATE articles SET deleted = 1, active = 0 WHERE id = ?').run(a.id);
      else db.prepare('DELETE FROM articles WHERE id = ?').run(a.id);
    })();
    if (!n && a.image) artIcons.removeImage(DATA_DIR, a.image);
    audit(req.user, 'Artikel gelöscht', a.name + (n ? ' (frühere Buchungen/Lieferungen bleiben erhalten)' : ''));
    res.json({ ok: true, kept: Boolean(n) });
  });

  /* Reihenfolge der Kategorien (Tablet, Listen, Exporte); innerhalb einer Kategorie alphabetisch */
  const categoryList = () => db.prepare(`SELECT category, COUNT(*) n, SUM(active) act FROM articles WHERE custom = 0 AND deleted = 0
  GROUP BY category ORDER BY cat_rank(category), de_key(category)`).all();
  admin.get('/categories', (req, res) => res.json(categoryList()));
  admin.put('/categories/order', need('artikel'), (req, res) => {
    const order = Array.isArray((req.body || {}).order) ? req.body.order.map(c => String(c).trim().slice(0, 40)).filter(Boolean) : null;
    if (!order) return bad(res, 'Ungültige Reihenfolge.');
    setSetting('category_order', JSON.stringify([...new Set(order)].slice(0, 100)));
    audit(req.user, 'Reihenfolge der Kategorien geändert', order.join(' · '));
    res.json({ ok: true, categories: categoryList() });
  });
  /* „Einstellungen übertragen“ des Verkaufs (Verkauf › Einstellungen): Artikel (mit Bild), Kategorie-Reihenfolge, „Gerade oft hier“ und Lieferanten-Zuordnungen.
     Nie dabei: Bestand, Buchungen, Lieferungen, Konten, Veranstaltungen. Import: gleicher Artikelname → aktualisieren, sonst neu, nichts wird gelöscht. */
  const EXPORT_BILD_MAX = 400 * 1024, EXPORT_BILDER_GESAMT = 12 * 1024 * 1024, IMPORT_ARTIKEL_MAX = 1000;
  plugins.get('getraenke').hooks.exportConfig = () => {
    let bilder = 0;
    const arts = db.prepare('SELECT * FROM articles WHERE custom = 0 AND deleted = 0 ORDER BY sort, id').all().map(a => {
      const o = { name: a.name, category: a.category, price_cents: a.price_cents, crate_size: a.crate_size, min_stock: a.min_stock, target_stock: a.target_stock, track_stock: a.track_stock, active: a.active, sort: a.sort, icon: a.icon || null };
      const f = a.image && artIcons.imagePath(DATA_DIR, a.image);
      if (f) { const buf = fs.readFileSync(f); if (buf.length <= EXPORT_BILD_MAX && bilder + buf.length <= EXPORT_BILDER_GESAMT) { bilder += buf.length; o.image = { type: artIcons.mimeOf(a.image), data: buf.toString('base64') }; } }
      return o;
    });
    const name = db.prepare('SELECT name FROM articles WHERE id = ?');
    const suppliers = db.prepare('SELECT supplier, art_no, article_id, pack_size, text FROM supplier_map ORDER BY supplier, art_no').all()
      .map(m => ({ supplier: m.supplier, art_no: m.art_no, article: m.article_id ? (name.get(m.article_id) || {}).name || null : null, pack_size: m.pack_size, text: m.text || null }));
    return { settings: { top_n: String(topN()), top_days: String(topDays()), category_order: getSetting('category_order', '[]') }, articles: arts, suppliers };
  };
  plugins.get('getraenke').hooks.importConfig = (d, opts = {}) => {
    const x = (d && d.settings) || null;
    let n = 0, days = 0, order = null;
    if (x) {
      n = int(x.top_n, -1); days = int(x.top_days, 0);
      if (n < 0 || n > 60 || days < 1 || days > 365) throw new Error('Die Datei enthält ungültige Werte für „Gerade oft hier“.');
      try { order = JSON.parse(x.category_order || '[]'); } catch (e) { order = null; }
      if (!Array.isArray(order)) throw new Error('Die Datei enthält keine gültige Reihenfolge der Kategorien.');
    }
    const z = konfigio.zaehler();
    let ungueltig = 0;
    db.transaction(() => {
      const live = new Map(db.prepare('SELECT * FROM articles WHERE custom = 0 AND deleted = 0').all().map(a => [a.name.toLowerCase(), a]));
      for (const e of konfigio.liste(d && d.articles, IMPORT_ARTIKEL_MAX)) {
        const key = String(e.name || '').trim().toLowerCase(), old = live.get(key);
        let a;
        try { a = articleFromBody({ ...e, icon: e.icon || undefined }, old || { category: 'Sonstiges', price_cents: 0, crate_size: 1, min_stock: 0, track_stock: 1, active: 1, sort: 100 }); }
        catch (err) { ungueltig++; continue; }
        if (!old && e.icon === undefined) a.icon = artIcons.guess(a.name, a.category);
        let id;
        if (old) { db.prepare('UPDATE articles SET name=@name, category=@category, price_cents=@price_cents, crate_size=@crate_size, min_stock=@min_stock, target_stock=@target_stock, track_stock=@track_stock, active=@active, sort=@sort, icon=@icon WHERE id=@id').run({ ...a, id: old.id }); id = old.id; z('Artikel', 'aktualisiert'); }
        else { id = Number(db.prepare('INSERT INTO articles(name, category, price_cents, crate_size, min_stock, target_stock, track_stock, active, sort, icon) VALUES (@name,@category,@price_cents,@crate_size,@min_stock,@target_stock,@track_stock,@active,@sort,@icon)').run(a).lastInsertRowid); z('Artikel', 'neu'); }
        live.set(key, { ...(old || {}), ...a, id });
        const img = e.image && typeof e.image.data === 'string' ? Buffer.from(e.image.data, 'base64') : null;
        if (img) {
          try {
            const prev = old && old.image;
            if (opts.dry) { artIcons.checkImage(img); z('Bilder', prev ? 'aktualisiert' : 'neu'); }   // Vorschau: keine Dateien schreiben
            else {
              const file = artIcons.saveImage(DATA_DIR, id, img);
              if (prev && prev !== file) artIcons.removeImage(DATA_DIR, prev);
              db.prepare('UPDATE articles SET image = ? WHERE id = ?').run(file, id); z('Bilder', prev ? 'aktualisiert' : 'neu');
            }
          } catch (err) { ungueltig++; }
        }
      }
      const cats = new Set(db.prepare('SELECT DISTINCT category FROM articles WHERE custom = 0 AND deleted = 0').all().map(r => r.category));
      if (x) {
        const before = new Set(getJsonSetting('category_order', [], Array.isArray));
        const list = [...new Set(order.map(c => String(c).trim().slice(0, 40)).filter(Boolean))].slice(0, 100);
        setSetting('top_n', String(n)); setSetting('top_days', String(days));
        setSetting('category_order', JSON.stringify(list));
        for (const c of list) if (cats.has(c) && !before.has(c)) z('Kategorien', 'neu');
      }
      const upd = db.prepare(`INSERT INTO supplier_map(supplier, art_no, article_id, pack_size, text) VALUES (?,?,?,?,?)
      ON CONFLICT(supplier, art_no) DO UPDATE SET article_id = excluded.article_id, pack_size = excluded.pack_size, text = excluded.text`);
      const had = db.prepare('SELECT 1 FROM supplier_map WHERE supplier = ? AND art_no = ?');
      for (const m of konfigio.liste(d && d.suppliers, 5000)) {
        const sup = String(m.supplier || '').trim().slice(0, 80), no = String(m.art_no || '').trim().slice(0, 20);
        if (!sup || !no) { ungueltig++; continue; }
        const art = m.article ? live.get(String(m.article).trim().toLowerCase()) : null;
        if (m.article && !art) { ungueltig++; continue; }
        const existed = Boolean(had.get(sup, no));
        upd.run(sup, no, art ? art.id : null, Math.max(1, Math.min(10000, int(m.pack_size, 1))), m.text ? String(m.text).slice(0, 80) : null);
        z('Lieferanten-Zuordnungen', existed ? 'aktualisiert' : 'neu');
      }
    })();
    if (ungueltig) z.hinweis(`${ungueltig} ungültige Einträge übersprungen`);
    return z.text();
  };

  /* ---------- Lieferungen ---------- */
  admin.get('/deliveries', need('lieferungen'), (req, res) => {
    const list = db.prepare('SELECT * FROM deliveries ORDER BY date DESC, id DESC LIMIT 300').all();
    const items = db.prepare(`SELECT di.*, a.name, a.crate_size FROM delivery_items di JOIN articles a ON a.id = di.article_id
    WHERE di.delivery_id = ?`);
    res.json(list.map(d => {
      const its = items.all(d.id).map(i => ({ ...i, total: i.crates * i.crate_size + i.bottles }));
      return { ...d, items: its, total: its.reduce((s, i) => s + i.total, 0) };
    }));
  });

  /* Beleg hochladen (PDF, Foto) → wird gespeichert und, falls möglich, ausgelesen. */
  const BELEG_DIR = path.join(DATA_DIR, 'belege');
  const TRASH_DIR = path.join(BELEG_DIR, 'papierkorb');
  fs.mkdirSync(BELEG_DIR, { recursive: true });
  const ALLOWED = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/heic': '.heic', 'image/webp': '.webp' };
  const fileOk = f => typeof f === 'string' && /^[\w-]+\.(pdf|jpg|png|heic|webp)$/.test(f) && fs.existsSync(path.join(BELEG_DIR, f));
  /** Echte Dateisignatur statt nur Dateiendung prüfen. */
  function signatureOk(buf, ext) {
    if (ext === '.pdf') return buf.subarray(0, 1024).includes('%PDF-');   // manche Scanner schreiben vor %PDF- noch Bytes
    if (ext === '.heic') return buf.subarray(4, 8).toString() === 'ftyp';
    return ['.jpg', '.png', '.webp'].includes(ext) && '.' + imageType(buf) === ext;
  }
  /* Abgebrochene Uploads (älter als 1 Tag, keiner Lieferung zugeordnet) aufräumen */
  /** Belegdateien (ohne Unterordner wie den Papierkorb) */
  const belegFiles = () => fs.readdirSync(BELEG_DIR, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name);
  function cleanupUploads() {
    const used = new Set(db.prepare('SELECT file FROM deliveries WHERE file IS NOT NULL').all().map(r => r.file));
    for (const f of belegFiles()) {
      const st = fs.statSync(path.join(BELEG_DIR, f));
      if (!used.has(f) && Date.now() - st.mtimeMs > 24 * 3600 * 1000) invoices.removeFile(path.join(BELEG_DIR, f));
    }
  }

  admin.post('/upload', need('lieferungen'), express.raw({ type: () => true, limit: '25mb' }), asyncRoute(async (req, res) => {
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    let orig = String(req.headers['x-filename'] || 'beleg');
    try { orig = decodeURIComponent(orig); } catch (e) { /* kaputt kodierter Name: so übernehmen */ }
    const ext = ALLOWED[mime] || (/\.pdf$/i.test(orig) ? '.pdf' : null);
    if (!ext) return bad(res, 'Bitte eine PDF-Datei oder ein Foto (JPG, PNG) hochladen.');
    if (!req.body || !req.body.length) return bad(res, 'Die Datei ist leer.');
    if (!signatureOk(req.body, ext)) return bad(res, 'Die Datei passt nicht zu ihrem Typ. Bitte das Original-PDF oder Foto hochladen.');
    const name = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;
    const file = path.join(BELEG_DIR, name);
    fs.writeFileSync(file, req.body);
    let parsed;
    try { parsed = await invoices.readUpload(db, file, ext === '.pdf' ? 'application/pdf' : mime); }
    catch (e) { console.error('Beleg lesen:', e); parsed = { supplier: '', docNo: null, docKind: 'lieferung', lines: [], hasText: false }; }
    res.json({ fileId: name, originalName: cleanName(orig, 120), ...parsed });
  }));

  admin.delete('/upload/:file', need('lieferungen'), (req, res) => {
    const f = req.params.file;
    const used = db.prepare('SELECT 1 FROM deliveries WHERE file = ?').get(f);
    if (fileOk(f) && !used) invoices.removeFile(path.join(BELEG_DIR, f));
    res.json({ ok: true });
  });

  admin.get('/beleg/:file', need('lieferungen'), (req, res) => {
    if (!fileOk(req.params.file)) return bad(res, 'Beleg nicht gefunden.', 404);
    res.sendFile(path.join(BELEG_DIR, req.params.file));
  });

  admin.get('/supplier-map', need('lieferungen','bestellung'), (req, res) => {
    res.json(db.prepare(`SELECT sm.*, a.name AS article FROM supplier_map sm LEFT JOIN articles a ON a.id = sm.article_id
    ORDER BY sm.supplier, sm.art_no`).all());
  });
  admin.delete('/supplier-map', need('lieferungen'), (req, res) => {
    const { supplier, artNo } = req.body || {};
    db.prepare('DELETE FROM supplier_map WHERE supplier = ? AND art_no = ?').run(String(supplier || ''), String(artNo || ''));
    res.json({ ok: true });
  });

  /**
   * Lieferung speichern – von Hand oder aus einem ausgelesenen Beleg.
   * items: [{ articleId, crates, bottles, artNo?, text?, ignore?, packSize?, cost_cents? }]
   */
  admin.post('/deliveries', need('lieferungen'), (req, res) => {
    const { date, supplier, note, items, fileId, docNo, docKind, total_cents: totalCents, remember } = req.body || {};
    if (!isDate(date)) return bad(res, 'Datum fehlt.');
    const sup = String(supplier || '').trim().slice(0, 80);
    if (!sup) return bad(res, 'Lieferant fehlt.');
    if (fileId && !fileOk(fileId)) return bad(res, 'Der hochgeladene Beleg wurde nicht gefunden. Bitte erneut hochladen.');
    const doc = docNo ? String(docNo).trim().slice(0, 40) : null;
    if (doc && db.prepare('SELECT 1 FROM deliveries WHERE supplier = ? AND doc_no = ?').get(sup, doc)) {
      return bad(res, `Beleg ${doc} von ${sup} ist schon gespeichert. Doppelte Belege würden den Bestand verfälschen.`, 409);
    }
    const all = Array.isArray(items) ? items : [];
    const clean = all
      .filter(i => !i.ignore)
      .map(i => ({ articleId: int(i.articleId), crates: int(i.crates), bottles: int(i.bottles),
        artNo: i.artNo ? String(i.artNo).slice(0, 20) : null, text: i.text ? String(i.text).slice(0, 80) : null,
        cost: i.cost_cents === undefined || i.cost_cents === null ? null : int(i.cost_cents) }));
    if (clean.some(i => !i.articleId && (i.crates || i.bottles))) {
      return bad(res, 'Bitte jeder Position einen Artikel zuordnen oder sie auf „ignorieren“ stellen.');
    }
    const rows = clean.filter(i => i.articleId && (i.crates || i.bottles));
    if (!rows.length) return bad(res, 'Keine Positionen eingetragen.');
    const kind = ['rechnung', 'gutschrift', 'lieferung', 'kassenbon'].includes(docKind) ? docKind : 'lieferung';

    let id;
    try { db.transaction(() => {
      id = Number(db.prepare(`INSERT INTO deliveries(date, supplier, note, doc_no, doc_kind, file, total_cents)
      VALUES (?,?,?,?,?,?,?)`).run(date, sup, note ? String(note).slice(0, 300) : null, doc, kind,
        fileId || null, totalCents === undefined || totalCents === null || totalCents === '' ? null : int(totalCents)).lastInsertRowid);
      const ins = db.prepare(`INSERT INTO delivery_items(delivery_id, article_id, crates, bottles, supplier_art_no, supplier_text, cost_cents)
      VALUES (?,?,?,?,?,?,?)`);
      const artOk = db.prepare('SELECT 1 FROM articles WHERE id = ?');
      rows.forEach(i => {
        if (!artOk.get(i.articleId)) throw new Error('Unbekannter Artikel.');
        if (Math.abs(i.crates) > 1000 || Math.abs(i.bottles) > 10000) throw new Error('Menge unplausibel.');
        ins.run(id, i.articleId, i.crates, i.bottles, i.artNo, i.text, i.cost);
      });
      if (remember !== false) {
        const up = db.prepare(`INSERT INTO supplier_map(supplier, art_no, article_id, pack_size, text) VALUES (?,?,?,?,?)
        ON CONFLICT(supplier, art_no) DO UPDATE SET article_id = excluded.article_id, pack_size = excluded.pack_size, text = excluded.text`);
        for (const i of all) {
          if (!i.artNo || i.single) continue;
          up.run(sup, String(i.artNo).slice(0, 20), i.ignore ? null : int(i.articleId) || null, Math.max(1, int(i.packSize, 1)),
            i.text ? String(i.text).slice(0, 80) : null);
        }
      }
    })(); } catch (e) {
      if (/UNIQUE/.test(e.message)) return bad(res, `Den Beleg ${doc} von ${sup} gibt es schon.`);
      if (/Unbekannter Artikel|unplausibel/.test(e.message)) return bad(res, e.message === 'Unbekannter Artikel.' ? 'Eine Position ist keinem gültigen Artikel zugeordnet. Bitte prüfen.' : 'Eine Menge ist unplausibel (über 1000 Gebinde bzw. 10.000 Stück).');
      throw e;
    }
    audit(req.user, 'Lieferung gespeichert', `${sup} ${date}${doc ? ' Beleg ' + doc : ''} (${rows.length} Positionen)`);
    res.json({ id });
  });

  admin.delete('/deliveries/:id', need('lieferungen'), (req, res) => {
    const d = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(int(req.params.id));
    if (!d) return res.json({ ok: true });
    db.prepare('DELETE FROM deliveries WHERE id = ?').run(d.id);
    // Beleg nicht vernichten: bleibt für die Aufbewahrungsfrist im Papierkorb (TRASH_DAYS, steckt auch in der Komplettsicherung); die Zeile steht im Änderungsjournal
    if (d.file && fileOk(d.file)) {
      try { fs.mkdirSync(TRASH_DIR, { recursive: true }); fs.renameSync(path.join(BELEG_DIR, d.file), path.join(TRASH_DIR, d.file)); }
      catch (e) { /* Datei schon weg */ }
    }
    audit(req.user, 'Lieferung gelöscht', `${d.supplier} ${d.date}${d.doc_no ? ' Beleg ' + d.doc_no : ''}`);
    res.json({ ok: true });
  });

  /* ---------- Bestand ---------- */
  admin.get('/stock', (req, res) => res.json(stockList()));

  admin.get('/stock/moves', need('bestand'), (req, res) => {
    res.json(db.prepare(`SELECT sm.*, a.name FROM stock_moves sm JOIN articles a ON a.id = sm.article_id
    ORDER BY sm.date DESC, sm.id DESC LIMIT 200`).all());
  });

  admin.post('/stock/move', need('bestand'), (req, res) => {
    const { articleId, qty, reason, date, note } = req.body || {};
    if (!['bruch', 'korrektur'].includes(reason)) return bad(res, 'Grund ungültig.');
    let q = int(qty);
    if (!q || Math.abs(q) > 10000) return bad(res, 'Menge fehlt oder ist unplausibel.');
    const art = db.prepare('SELECT name FROM articles WHERE id = ?').get(int(articleId));
    if (!art) return bad(res, 'Bitte einen Artikel wählen.');
    if (reason === 'bruch') q = -Math.abs(q);
    audit(req.user, reason === 'bruch' ? 'Bruch gebucht' : 'Bestand korrigiert', `${art.name}: ${q}`);
    db.prepare('INSERT INTO stock_moves(article_id, qty, reason, date, note) VALUES (?,?,?,?,?)')
      .run(int(articleId), q, reason, isDate(date) ? date : today(), note ? String(note).slice(0, 200) : null);
    res.json({ ok: true });
  });

  admin.post('/stock/inventory', need('bestand'), (req, res) => {
    const { date, counts, force } = req.body || {};
    const d = isDate(date) ? date : today();
    if (d > today()) return bad(res, 'Das Inventurdatum darf nicht in der Zukunft liegen.');
    const current = new Map(stockList().map(s => [s.id, s.stock]));
    // Plausibilität: Tippfehler wie 2400 statt 24 abfangen
    const names = new Map(stockList().map(s => [s.id, s.name]));
    const odd = [];
    for (const c of Array.isArray(counts) ? counts : []) {
      if (c.counted === '' || c.counted === null || c.counted === undefined) continue;
      const id = int(c.articleId), n = Number(c.counted);
      if (!current.has(id)) continue;
      if (!Number.isInteger(n) || n < 0 || n > 20000) return bad(res, `${names.get(id)}: gezählte Menge ungültig (0 bis 20.000 Stück).`);
      const soll = Math.max(0, current.get(id));
      if (Math.abs(n - soll) > Math.max(48, soll * 2)) odd.push(`${names.get(id)}: gezählt ${n}, Soll ${soll}`);
    }
    if (odd.length && !force) return res.status(409).json({ error: 'Ungewöhnlich große Abweichung', confirm: true, odd });
    const ins = db.prepare(`INSERT INTO stock_moves(article_id, qty, reason, date, note) VALUES (?,?, 'inventur', ?, ?)`);
    const result = [];
    db.transaction(() => {
      for (const c of Array.isArray(counts) ? counts : []) {
        if (c.counted === '' || c.counted === null || c.counted === undefined) continue;
        const id = int(c.articleId);
        if (!current.has(id)) continue;
        const diff = int(c.counted) - current.get(id);
        if (diff !== 0) {
          ins.run(id, diff, d, `Inventur: gezählt ${int(c.counted)}, Soll ${current.get(id)}`);
          result.push({ articleId: id, diff });
        }
      }
    })();
    audit(req.user, 'Inventur', `${result.length} Abweichungen`);
    res.json({ ok: true, changes: result });
  });

  /** Schwundauswertung: Zugänge, Abgänge, Differenzen je Artikel im Zeitraum. */
  function shrinkage(from, to) {
    const arts = db.prepare('SELECT id, name, category, price_cents, crate_size, sort FROM articles WHERE custom = 0 ORDER BY cat_rank(category), de_key(category), de_key(name)').all();
    const deliv = db.prepare(`SELECT COALESCE(SUM(di.crates * a.crate_size + di.bottles),0) n FROM delivery_items di
    JOIN deliveries d ON d.id = di.delivery_id JOIN articles a ON a.id = di.article_id
    WHERE di.article_id = ? AND d.date BETWEEN ? AND ?`);
    const book = db.prepare(`SELECT kind, COALESCE(SUM(qty),0) n FROM bookings WHERE article_id = ? AND cancelled_at IS NULL
    AND date(created_at) BETWEEN ? AND ? GROUP BY kind`);
    const moves = db.prepare(`SELECT reason, COALESCE(SUM(qty),0) n FROM stock_moves WHERE article_id = ? AND date BETWEEN ? AND ?
    GROUP BY reason`);
    return arts.map(a => {
      const k = { konto: 0, verein: 0, gast: 0, event: 0 };
      book.all(a.id, from, to).forEach(r => { k[r.kind] = r.n; });
      const m = { bruch: 0, inventur: 0, korrektur: 0 };
      moves.all(a.id, from, to).forEach(r => { m[r.reason] = r.n; });
      const delivered = deliv.get(a.id, from, to).n;
      const booked = k.konto + k.verein + k.gast + k.event;
      return {
        id: a.id, name: a.name, category: a.category, price_cents: a.price_cents,
        delivered, booked, ...k, bruch: m.bruch, inventur: m.inventur, korrektur: m.korrektur,
        open: delivered + m.bruch + m.korrektur - booked,
        shrink_cents: -Math.min(0, m.inventur) * a.price_cents,
      };
    }).filter(r => r.delivered || r.booked || r.bruch || r.inventur || r.korrektur);
  }

  admin.get('/shrinkage', need('bestand', 'abrechnung', 'export'), (req, res) => {
    const { from, to } = defaultRange(req.query);
    res.json({ from, to, rows: shrinkage(from, to) });
  });

  /* ---------- Buchungen ---------- */
  admin.get('/bookings', need('buchungen'), (req, res) => {
    const { from, to } = defaultRange(req.query);
    const params = [from, to];
    let where = '';
    if (req.query.memberId) { where += ' AND b.member_id = ?'; params.push(int(req.query.memberId)); }
    if (req.query.eventId) { where += ' AND b.event_id = ?'; params.push(int(req.query.eventId)); }
    // seitenweise: ?limit=&offset= (ohne Angabe wie bisher bis 1000 Zeilen); total = alle Treffer im Zeitraum
    const lim = Math.max(1, Math.min(1000, int(req.query.limit) || 1000)), off = Math.max(0, int(req.query.offset) || 0);
    const total = db.prepare(`SELECT COUNT(*) n FROM bookings b WHERE b.created_at >= ? AND b.created_at < date(?, '+1 day') ${where}`).get(...params).n;
    const rows = db.prepare(`SELECT b.*, ${ARTICLE_LABEL} AS article, COALESCE(m.name, g.name, 'Deckel: ' || t.name) AS member, m.kind AS member_kind, g.name AS guest,
      g.member_id IS NULL AND g.id IS NOT NULL AS manual_guest, e.name AS event, p.method AS pay_method, t.status AS tab_status, t.method AS tab_method
    FROM bookings b JOIN articles a ON a.id = b.article_id
    LEFT JOIN members m ON m.id = b.member_id LEFT JOIN events e ON e.id = b.event_id
    LEFT JOIN event_guests g ON g.id = b.event_guest_id LEFT JOIN event_payments p ON p.id = b.payment_id
    LEFT JOIN guest_tabs t ON t.id = b.tab_id
    WHERE b.created_at >= ? AND b.created_at < date(?, '+1 day') ${where}   -- wie date(created_at) BETWEEN, aber über den Index (planung/n-plus-1.md)
    ORDER BY b.created_at DESC, b.id DESC LIMIT ? OFFSET ?`).all(...params, lim, off);
    res.json({ from, to, rows, total });
  });

  admin.post('/bookings', need('buchungen'), (req, res) => {
    const { memberId, articleId, qty, date, amount_cents, note } = req.body || {};
    const m = db.prepare('SELECT * FROM members WHERE id = ? AND deleted = 0').get(int(memberId));
    if (m && !m.active) return bad(res, `„${m.name}“ ist ausgeblendet – zum Nachtragen das Konto zuerst wieder einblenden.`);
    const custom = amount_cents !== undefined && amount_cents !== null && amount_cents !== '';
    const a = custom ? db.prepare('SELECT * FROM articles WHERE id = ?').get(customArticleId()) : db.prepare('SELECT * FROM articles WHERE id = ? AND custom = 0').get(int(articleId));
    const q = custom ? 1 : int(qty);
    const unit = custom ? int(amount_cents) : (a ? a.price_cents : 0);
    if (!custom && !Number.isInteger(Number(qty))) return bad(res, 'Konto, Artikel und Menge (1–999) angeben.');   // ganze Stückzahlen
    if (custom && !Number.isInteger(Number(amount_cents))) return bad(res, 'Betrag bitte in ganzen Cent angeben.');
    if (!m || !a || q < 1 || q > 999) return bad(res, 'Konto, Artikel und Menge (1–999) angeben.');
    if (custom && (unit < 10 || unit > 100000)) return bad(res, 'Betrag bitte zwischen 0,10 € und 1.000 €.');
    if (date && !isDate(date)) return bad(res, 'Datum ungültig.');
    if (isDate(date) && date > today()) return bad(res, 'Das Datum darf nicht in der Zukunft liegen.');
    const kind = { mitglied: 'konto', nichtmitglied: 'konto', mannschaft: 'konto', verein: 'verein', gast: 'gast' }[m.kind];
    const total = kind === 'verein' ? 0 : unit * q;
    const ts = isDate(date) ? `${date} 12:00:00` : nowTs();
    const txt = custom ? (cleanName(note, 60) || null) : null;
    const r = db.prepare(`INSERT INTO bookings(member_id, article_id, kind, qty, unit_cents, total_cents, created_at, note)
    VALUES (?,?,?,?,?,?,?,?)`).run(m.id, a.id, kind, q, unit, total, ts, txt);
    audit(req.user, 'Buchung nachgetragen', `${m.name}: ${custom ? 'Betrag ' + euro(unit) + (txt ? ' (' + txt + ')' : '') : q + ' × ' + a.name}${isDate(date) ? ' am ' + date : ''}`);
    res.json({ id: Number(r.lastInsertRowid) });
  });

  /* Storno einer abgerechneten Buchung: vorher sagen, wo sie abgerechnet ist – und ob sich ein Verkaufs-Einzug der
     Mitgliederverwaltung noch zurücknehmen lässt (dann normales Storno statt Gutschrift) */
  const settlementOf = id => {
    const b = db.prepare('SELECT b.id, b.member_id, b.settled_id, s.batch, s.created_at, s.by_user FROM bookings b LEFT JOIN member_settlements s ON s.id = b.settled_id WHERE b.id = ?').get(int(id));
    if (!b || !b.settled_id) return { b, mod: null };
    let mod = null;
    for (const p of plugins.withHook('drinksSettlementInfo')) { try { mod = p.hooks.drinksSettlementInfo({ batch: b.batch, memberId: b.member_id }) || mod; } catch (e) { console.error(`Modul ${p.meta.id}: Abrechnungsangaben nicht lesbar (wie ohne Modul):`, e.message); } }
    return { b, mod };
  };
  admin.get('/bookings/:id/settlement', need('buchungen'), (req, res) => {
    const { b, mod } = settlementOf(req.params.id);
    if (!b) return bad(res, 'Nicht gefunden.', 404);
    if (!b.settled_id) return res.json({ settled: false });
    res.json({ settled: true, where: mod ? mod.text : `Verkauf › Abrechnung vom ${deD(b.created_at.slice(0, 10))}${b.by_user ? ` (${b.by_user})` : ''}`,
      credit: !mod || mod.billed !== false, undo: mod && mod.undo && req.user.perms.includes('mitglieder_finanzen') ? mod.undo : null });
  });
  admin.post('/bookings/:id/undo-run', need('buchungen'), (req, res) => {
    if (!req.user.perms.includes('mitglieder_finanzen')) return bad(res, 'Dafür fehlt dir das Recht „Beiträge & Einzug“ (Modul Mitglieder).', 403);
    const { b, mod } = settlementOf(req.params.id);
    if (!b || !mod || !mod.undo) return bad(res, 'Diese Abrechnung lässt sich hier nicht zurücknehmen.');
    for (const p of plugins.withHook('drinksSettlementUndo')) {
      try { p.hooks.drinksSettlementUndo({ batch: b.batch, user: req.user }); } catch (e) { return bad(res, e.message); }
    }
    res.json({ ok: true });
  });

  admin.post('/bookings/:id/cancel', need('buchungen'), (req, res) => {
    const b = db.prepare(`SELECT b.*, COALESCE(b.article_name, a.name) AS article, a.custom, m.name AS member, m.kind AS member_kind, m.deleted AS member_deleted FROM bookings b JOIN articles a ON a.id = b.article_id
    LEFT JOIN members m ON m.id = b.member_id WHERE b.id = ?`).get(int(req.params.id));
    if (!b) return bad(res, 'Nicht gefunden.', 404);
    if (b.cancelled_at) return bad(res, 'Diese Buchung ist bereits storniert.', 409);
    if (b.payment_id) return bad(res, 'Diese Buchung ist schon bezahlt. Bitte zuerst unter „Veranstaltungen“ die Zahlung zurücknehmen, sonst stimmt die Kasse nicht mehr.');
    if (b.tab_id && b.kind !== 'konto') {
      const t = db.prepare('SELECT status FROM guest_tabs WHERE id = ?').get(b.tab_id);
      if (t && t.status !== 'offen') return bad(res, 'Dieser Gäste-Deckel ist schon geschlossen. Bitte zuerst unter „Gäste-Deckel“ wieder öffnen, sonst stimmt die Kasse nicht mehr.');
    }
    // Gutschrift auf ein gelöschtes Konto würde nie verrechnet – lieber bar erstatten
    if (b.settled_id && b.member_deleted) return bad(res, `${lastFirst(b.member, b.member_kind)} wurde gelöscht – eine Gutschrift ist nicht mehr möglich. Den Betrag bitte bar erstatten; den Bestand bei Bedarf unter Lager korrigieren.`);
    const what = `${b.member || 'Barverkauf'}: ${b.custom ? 'Betrag ' + euro(b.total_cents) : b.qty + ' × ' + b.article} vom ${b.created_at.slice(0, 10)}`;
    if (b.settled_id) {
      // Abgerechnet über ein Modul (z. B. Verkaufs-Einzug der Mitgliederverwaltung), dessen Posten dort schon storniert ist?
      // Dann wurde nichts berechnet: Abrechnung wieder öffnen und normal stornieren statt eine Gutschrift zu buchen.
      const st = db.prepare('SELECT batch, member_id FROM member_settlements WHERE id = ?').get(b.settled_id);
      const notBilled = st && st.batch && plugins.withHook('drinksSettlementBilled').some(p => { try { return p.hooks.drinksSettlementBilled({ batch: st.batch, memberId: st.member_id }) === false; } catch (e) { return false; } });
      const hasCredit = db.prepare('SELECT 1 FROM bookings WHERE credit_for = ? AND cancelled_at IS NULL').get(b.id);
      if (notBilled && hasCredit) return bad(res, 'Der Verkaufs-Posten dazu ist in der Mitgliederverwaltung schon storniert. Bitte zuerst die Gutschrift stornieren – danach lässt sich die Buchung normal stornieren.');
      if (notBilled) { const r = drinks.reopen(st.batch, st.member_id); if (!r.ok) return bad(res, r.error); b.settled_id = null; }
    }
    if (b.settled_id) {
      if (db.prepare('SELECT 1 FROM bookings WHERE credit_for = ? AND cancelled_at IS NULL').get(b.id)) return bad(res, 'Dafür wurde schon eine Gutschrift gebucht.');
      // Schon abgerechnet (in der Vereinsverwaltung abgebucht): nicht mehr ändern, sondern Gutschrift auf die nächste Abrechnung
      if (b.total_cents <= 0) return bad(res, 'Diese Buchung ist schon abgerechnet und kann nicht mehr storniert werden.');
      const note = ('Storno ' + (b.custom ? (b.note || 'Betrag') : b.qty + ' × ' + b.article) + ' vom ' + b.created_at.slice(0, 10)).slice(0, 80);
      db.transaction(() => {
        db.prepare(`INSERT INTO bookings(member_id, article_id, kind, qty, unit_cents, total_cents, note, credit_for) VALUES (?,?,'konto',1,?,?,?,?)`)
          .run(b.member_id, customArticleId(), -b.total_cents, -b.total_cents, note, b.id);
        if (!b.custom) db.prepare(`INSERT INTO stock_moves(article_id, qty, reason, date, note) VALUES (?,?,'korrektur',?,?)`)
          .run(b.article_id, b.qty, today(), 'Storno aus abgerechnetem Zeitraum');
      })();
      audit(req.user, 'Gutschrift (Storno abgerechnet)', `${what}, ${euro(b.total_cents)} für die nächste Abrechnung gutgeschrieben`);
      return res.json({ ok: true, credit: true, message: `Die Buchung ist schon abgerechnet. Deshalb wurde eine Gutschrift über ${euro(b.total_cents)} gebucht – sie wird bei der nächsten Abrechnung abgezogen.` });
    }
    const r = db.prepare(`UPDATE bookings SET cancelled_at = datetime('now','localtime'), cancelled_by = ?
    WHERE id = ? AND cancelled_at IS NULL`).run(req.user.username, b.id);
    if (!r.changes) return bad(res, 'Diese Buchung ist bereits storniert.', 409);   // zwischenzeitlich von jemand anderem
    if (b.credit_for) reverseCreditStock(b.id);
    audit(req.user, 'Buchung storniert', what);
    res.json({ ok: true });
  });

  /* ---------- Abrechnung / Salden ---------- */
  /* Name wie beim Buchen (Spalte article_name); ältere Buchungen ohne Eintrag zeigen den aktuellen Namen */
  const ARTICLE_LABEL = `CASE WHEN a.custom = 1 THEN a.name || COALESCE(': ' || b.note, '') ELSE COALESCE(b.article_name, a.name) END`;
  /** Offene Beträge je Konto (Stand asOf): alle noch nicht abgerechneten Konto-Buchungen */
  function balances(asOf = nowTs(), upTo = maxBookingId()) {
    const rows = db.prepare(`SELECT m.id, m.name, m.kind, a.category, SUM(b.qty) AS qty, SUM(b.total_cents) AS cents, MIN(b.created_at) AS first_at
    FROM bookings b JOIN members m ON m.id = b.member_id JOIN articles a ON a.id = b.article_id
    WHERE b.${OPEN_KONTO.replace(/ AND /g, ' AND b.')} AND ${CUT('b.')}
    GROUP BY m.id, a.category ORDER BY m.kind, name_key(m.name, m.kind)`).all(upTo, asOf, asOf);
    const lastAt = new Map(db.prepare('SELECT member_id, MAX(until_at) t FROM member_settlements WHERE member_id IN (SELECT value FROM json_each(?)) GROUP BY member_id').all(JSON.stringify([...new Set(rows.map(r => r.id))])).map(r => [r.member_id, r.t]));   // eine Abfrage statt einer je Konto
    const evOpen = eventOpenAll();
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.id)) map.set(r.id, { id: r.id, name: r.name, kind: r.kind, total_cents: 0, items: 0, byCategory: {}, since: r.first_at });
      const e = map.get(r.id);
      e.byCategory[r.category] = (e.byCategory[r.category] || 0) + r.qty;
      e.total_cents += r.cents; e.items += r.qty;
      if (r.first_at < e.since) e.since = r.first_at;
    }
    return [...map.values()].map(e => ({ ...e, lastSettled: lastAt.has(e.id) ? lastAt.get(e.id) : null, eventOpen_cents: evOpen(e.id) }));
  }

  /* Auswertung Verkauf (Dashboard): Umsatz, Artikel, Verlauf, Anteile, beliebte Zeiten – Vergleich mit dem Vorjahr */
  admin.get('/sales-stats', need('abrechnung', 'export'), (req, res) => {
    const t0 = new Date(); const pad2 = n => String(n).padStart(2, '0');
    const today0 = `${t0.getFullYear()}-${pad2(t0.getMonth() + 1)}-${pad2(t0.getDate())}`;
    // Jahr = Geschäftsjahr des Vereins (src/geschaeftsjahr.js; Beginn Januar = Kalenderjahr), Monate in der Reihenfolge des Geschäftsjahres
    const gj = require('./geschaeftsjahr'), fm = gj.month();
    const y = Math.max(2000, Math.min(2100, parseInt(req.query.year, 10) || gj.yearOf(today0, fm)));
    const cat = String(req.query.cat || '');
    const load = yy => { const r = gj.range(yy, fm); return db.prepare(`SELECT b.*, a.name AS aname, a.category FROM bookings b JOIN articles a ON a.id = b.article_id WHERE b.created_at >= ? AND b.created_at < ? ${cat ? 'AND a.category = ?' : ''}`)
      .all(r.from, gj.range(yy + 1, fm).from, ...(cat ? [cat] : [])); };
    const mi = b => (+b.created_at.slice(5, 7) - fm + 12) % 12;   // 0 = erster Monat des Geschäftsjahres
    const calc = yy => {
      const all = load(yy), act = all.filter(b => !b.cancelled_at), can = all.filter(b => b.cancelled_at);
      const rev = b => (b.kind === 'verein' ? 0 : b.total_cents);
      const m = (list, f) => { const out = Array(12).fill(0); for (const b of list) out[mi(b)] += f(b); return out; };
      return { act, can, revenue: act.reduce((x, b) => x + rev(b), 0), units: act.reduce((x, b) => x + b.qty, 0), count: act.length, cancelled: can.length,
        month: m(act, rev), monthUnits: m(act, b => b.qty), monthCount: m(act, () => 1), monthCan: m(can, () => 1), rev };
    };
    const c = calc(y), p = calc(y - 1);
    const group = (key, nameOf) => { const mp = new Map(); for (const b of c.act) { const k = key(b); const v = mp.get(k) || { name: nameOf(b), units: 0, cents: 0, count: 0 }; v.units += b.qty; v.cents += c.rev(b); v.count++; mp.set(k, v); } return [...mp.values()]; };
    const prevUnits = new Map(); for (const b of p.act) prevUnits.set(b.article_id, (prevUnits.get(b.article_id) || 0) + b.qty);
    const freeId = require('./db').customArticleId();   // „Freier Betrag“ zählt zum Umsatz, aber nicht als Bestseller
    const arts = group(b => b.article_id, b => b.aname).filter(a => a.name);
    const artIds = new Map(); for (const b of c.act) artIds.set(b.aname, b.article_id);
    const top = arts.filter(a => artIds.get(a.name) !== freeId).sort((a, b) => b.units - a.units).slice(0, 10).map(a => ({ ...a, prev: prevUnits.get(artIds.get(a.name)) || 0 }));
    const cats = group(b => b.category || 'Sonstiges', b => b.category || 'Sonstiges').sort((a, b) => b.cents - a.cents || b.units - a.units);
    const KIND = { konto: 'Auf Konto', gast: 'Gast (bar/Karte)', event: 'Veranstaltung', verein: 'Verein (frei)' };
    const kinds = group(b => b.kind, b => KIND[b.kind] || b.kind).sort((a, b) => b.units - a.units);
    const days = {}; for (const b of c.act) { const d = b.created_at.slice(0, 10); days[d] = (days[d] || 0) + b.qty; }
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const b of c.act) { const dt = new Date(b.created_at.replace(' ', 'T')); grid[(dt.getDay() + 6) % 7][dt.getHours()] += b.qty; }
    const usedH = grid.reduce((a, row) => { row.forEach((v, h) => { if (v) { a[0] = Math.min(a[0], h); a[1] = Math.max(a[1], h + 1); } }); return a; }, [24, 0]);
    const pick = x => ({ revenue: x.revenue, units: x.units, count: x.count, cancelled: x.cancelled, month: x.month, monthUnits: x.monthUnits, monthCount: x.monthCount, monthCan: x.monthCan });
    const rg = gj.range(y, fm), years = gj.yearsOf(db.prepare("SELECT DISTINCT substr(created_at,1,7) m FROM bookings").all().map(r => r.m), today0, fm);
    res.json({ year: y, cat, until: today0 <= rg.to && today0 >= rg.from ? today0 : rg.to, from: rg.from, to: rg.to, fiscal: fm,
      label: gj.label(y, fm), prevLabel: gj.label(y - 1, fm), current: gj.yearOf(today0, fm), years, labels: Object.fromEntries(years.map(v => [v, gj.label(v, fm)])),
      categories: db.prepare('SELECT DISTINCT category FROM articles ORDER BY category').all().map(r => r.category),
      cur: pick(c), prev: pick(p), top, cats, kinds, days, grid, hours: usedH[0] < usedH[1] ? usedH : [16, 23] });
  });

  admin.get('/balances', need('abrechnung', 'export'), (req, res) => {
    const asOf = nowTs(), upTo = maxBookingId();
    const list = balances(asOf, upTo);
    const { from, to } = defaultRange(req.query);
    const sums = db.prepare(`SELECT kind, COALESCE(SUM(total_cents),0) cents, COALESCE(SUM(qty),0) qty,
      COALESCE(SUM(unit_cents * qty),0) list_cents
    FROM bookings WHERE cancelled_at IS NULL AND created_at >= ? AND created_at < date(?, '+1 day') GROUP BY kind`).all(from, to);   // wie date(created_at) BETWEEN, aber über den Index
    // Hinweis: Was Mitglieder auf Veranstaltungslisten noch offen haben, kommt erst nach der Übernahme auf die Getränkeliste
    const evOpen = db.prepare(`SELECT e.name, SUM(b.total_cents) c FROM bookings b JOIN events e ON e.id = b.event_id
    JOIN event_guests g ON g.id = b.event_guest_id WHERE g.member_id IS NOT NULL AND b.${OPEN_GUEST.replace(/ AND /g, ' AND b.')}
    GROUP BY e.id ORDER BY e.date`).all();
    const categories = db.prepare('SELECT category FROM articles WHERE deleted = 0 OR id IN (SELECT article_id FROM bookings) GROUP BY category ORDER BY cat_rank(category), de_key(category)').all().map(r => r.category);
    // Offene Verkaufs-Posten der Mitgliederverwaltung (z. B. von Hand angelegt oder nach verworfenem Einzug) – damit nichts übersehen wird
    const mvOpen = plugins.withHook('drinksOpenCharges').flatMap(p => { try { return p.hooks.drinksOpenCharges() || []; } catch (e) { return []; } });
    res.json({ asOf, upTo, from, to, categories, rows: list, sums, total_cents: list.reduce((s, r) => s + r.total_cents, 0), eventOpen: evOpen, mvOpen });
  });

  /* ---------- Abtippliste für die Vereinsverwaltung (ohne Importfunktion) ----------
     Gleicher Stand wie Liste/Export (asOf/upTo), sortiert nach Nachname, mit fertigem Buchungstext. */
  /** Vor-/Nachname: eingetragene Felder, wenn sie zum Anzeigenamen passen – sonst Zerlegung wie überall (db.splitPersonName) */
  function splitName(m) {
    if (m.first_name && m.last_name && `${m.first_name} ${m.last_name}`.toLowerCase() === String(m.name).toLowerCase())
      return { first: m.first_name, last: m.last_name };
    return splitPersonName(m.name);
  }
  const BT_DEFAULT = 'Verkauf {von} – {bis}';
  function abtippliste(asOf, upTo) {
    const list = balances(asOf, upTo);
    const extra = new Map(db.prepare('SELECT id, first_name, last_name FROM members WHERE id IN (SELECT value FROM json_each(?))').all(JSON.stringify(list.map(r => r.id))).map(m => [m.id, { first_name: m.first_name, last_name: m.last_name }]));
    const rows = list.map(r => {
      const person = isPerson(r.kind);
      const nm = person ? splitName({ ...r, ...extra.get(r.id) }) : { first: '', last: r.name };
      return { id: r.id, name: r.name, kind: r.kind, first: nm.first, last: nm.last, cents: r.total_cents, items: r.items, since: r.since };
    });
    rows.sort((a, b) => (isPerson(a.kind) ? 0 : 1) - (isPerson(b.kind) ? 0 : 1) || (nameKey(a.name, a.kind) < nameKey(b.name, b.kind) ? -1 : nameKey(a.name, a.kind) > nameKey(b.name, b.kind) ? 1 : 0));
    const last = lastSettlement();
    const firstOpen = rows.reduce((m, r) => (!m || r.since < m ? r.since : m), '');
    const von = last && last !== '2000-01-01' ? last : firstOpen;
    const tpl = getSetting('buchungstext', BT_DEFAULT) || BT_DEFAULT;
    const text = tpl.replace(/\{von\}/g, deD(von)).replace(/\{bis\}/g, deD(asOf)).replace(/\{verein\}/g, getSetting('club_name', 'Unser Verein'))
      .replace(/\{jahr\}/g, asOf.slice(0, 4));
    return { asOf, upTo, von: von ? von.slice(0, 10) : null, bis: asOf.slice(0, 10), template: tpl, text, rows,
      total_cents: rows.reduce((s, r) => s + r.cents, 0), clubName: getSetting('club_name', 'Unser Verein') };
  }
  admin.get('/abtippliste', need('abrechnung', 'export'), (req, res) => {
    const fixed = isTs(req.query.asOf) && req.query.asOf <= nowTs() && req.query.upTo !== undefined;
    res.json(abtippliste(fixed ? req.query.asOf : nowTs(), fixed ? Math.min(int(req.query.upTo), maxBookingId()) : maxBookingId()));
  });
  admin.put('/abtippliste/text', need('abrechnung'), (req, res) => {
    const t = String((req.body || {}).template || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 140);
    setSetting('buchungstext', t || BT_DEFAULT);
    res.json({ ok: true, template: t || BT_DEFAULT });
  });

  /* Kassierer: nach dem Abbuchen in der Vereinsverwaltung einzelne oder alle Konten als abgerechnet markieren.
     Erfasst werden nur Buchungen bis zum Stand der angezeigten Liste bzw. des Exports (asOf) –
     was danach am Tablet gebucht wurde, bleibt offen für die nächste Abrechnung. */
  admin.post('/settle', need('abrechnung'), (req, res) => {
    if (!require('./uhr').ok()) return bad(res, require('./uhr').MSG, 409);   // falsche Uhrzeit nach dem Start (src/uhr.js): kein Geldlauf mit falschem Datum
    const b = req.body || {};
    const asOf = isTs(b.asOf) ? b.asOf : null;
    if (!asOf) return bad(res, 'Stand der Liste fehlt – bitte die Seite neu laden.');
    const upTo = int(b.upTo);
    if (asOf > nowTs() || upTo < 0 || upTo > maxBookingId()) return bad(res, 'Ungültiger Stand.');
    const all = !Array.isArray(b.memberIds);
    const ids = all ? null : [...new Set(b.memberIds.map(int))].filter(Boolean);
    if (!all && !ids.length) return bad(res, 'Kein Konto gewählt.');
    const r = drinks.settle(ids, asOf, upTo, req.user.username, b.note ? cleanName(b.note, 100) : null, all ? 'alle-' : 'einzeln-');
    if (!r.batch) return bad(res, 'Es gibt nichts Offenes abzurechnen.');
    const mids = Object.keys(r.perMember).map(Number);
    const names = all ? `${r.members} Konten` : db.prepare(`SELECT group_concat(name, ', ') n FROM members WHERE id IN (${mids.map(() => '?').join(',')})`).get(...mids).n;
    audit(req.user, all ? 'Alle Konten abgerechnet' : 'Konto abgerechnet', `${names}: ${euro(r.cents)} (Stand ${asOf.slice(0, 16)})`);
    res.json({ ok: true, members: r.members, bookings: r.bookings, cents: r.cents, batch: r.batch });
  });

  /** Abrechnung aus Verkauf › Abrechnung selbst (alle/einzeln) – nicht aus einem Modul oder der alten Stichtags-Abrechnung */
  const ownSettle = batch => /^(alle|einzeln)-/.test(batch);
  admin.get('/settle-history', need('abrechnung'), (req, res) => {
    const rows = db.prepare(`SELECT s.batch, MIN(s.created_at) created_at, MAX(s.until_at) until_at, MAX(s.by_user) by_user,
      COUNT(*) members, SUM(s.cents) cents, group_concat(m.name, char(31)) names, group_concat(m.kind, char(31)) kinds, MAX(m.deleted) gone
    FROM member_settlements s JOIN members m ON m.id = s.member_id
    GROUP BY s.batch ORDER BY MIN(s.id) DESC LIMIT 30`).all();
    const newest = rows.length ? rows[0].batch : null;
    res.json(rows.map(({ kinds, gone, ...r }) => ({ ...r, names: r.members <= 3 ? r.names.split('\x1f').map((n, i) => lastFirst(n, kinds.split('\x1f')[i])).join('; ') : null, undo: r.batch === newest && ownSettle(r.batch) && !gone })));
  });

  /* Getränke für andere Module (Mitgliederverwaltung: Einzug per Lastschrift) – gleiche Regeln wie die Abrechnung oben */
  /** Eine Gutschrift auf eine abgerechnete Buchung hat den Bestand zurückgebucht – wird die Gutschrift storniert, gilt die Ware wieder als verkauft */
  const CREDIT_STOCK_NOTE = id => `Gutschrift #${id} storniert`;
  function reverseCreditStock(creditId) {
    const o = db.prepare('SELECT o.article_id, o.qty, a.custom FROM bookings c JOIN bookings o ON o.id = c.credit_for JOIN articles a ON a.id = o.article_id WHERE c.id = ?').get(creditId);
    if (!o || o.custom || db.prepare("SELECT 1 FROM stock_moves WHERE note = ?").get(CREDIT_STOCK_NOTE(creditId))) return;
    db.prepare("INSERT INTO stock_moves(article_id, qty, reason, date, note) VALUES (?,?,'korrektur',?,?)").run(o.article_id, -o.qty, today(), CREDIT_STOCK_NOTE(creditId));
  }
  // Einmalig nachholen für Gutschriften, die vor 3.39.4 storniert wurden (damals blieb die Bestandskorrektur stehen)
  once('mig_credit_stock', () => { for (const c of db.prepare('SELECT id FROM bookings WHERE credit_for IS NOT NULL AND cancelled_at IS NOT NULL').all()) reverseCreditStock(c.id); });

  /** Abrechnung wieder öffnen geht nicht, wenn ein Konto darin inzwischen gelöscht ist – der Betrag stünde sonst offen auf einem Konto,
   *  das niemand mehr sieht (gelöscht wird ja nur ohne offenen Betrag). → Fehlertext oder null */
  function goneIn(settlementIds) {
    const names = db.prepare(`SELECT m.name, m.kind FROM member_settlements s JOIN members m ON m.id = s.member_id WHERE m.deleted = 1 AND s.id IN (${settlementIds.map(() => '?').join(',')})`)
      .all(...settlementIds).map(m => lastFirst(m.name, m.kind));
    return names.length ? `${names.join('; ')} wurde inzwischen gelöscht – die Abrechnung lässt sich nicht mehr zurücknehmen, sonst stünde der Betrag offen auf einem gelöschten Konto.` : null;
  }
  const drinks = {
    active: () => plugins.isActive('getraenke'),
    /** Veranstaltung im Verkauf anlegen (z. B. aus einem Dienstplan) – Artikelliste mit allen aktiven Artikeln zum Normalpreis → id */
    createEvent(name, date, user) {
      const n = cleanName(name, 80); if (!n) throw new Error('Name fehlt.');
      const id = Number(db.prepare('INSERT INTO events(name, date) VALUES (?,?)').run(n, isDate(date) ? date : today()).lastInsertRowid);
      saveEventArticles(id, db.prepare(`SELECT id AS articleId, price_cents FROM articles WHERE active = 1 AND custom = 0 AND deleted = 0 ORDER BY cat_rank(category), de_key(category), de_key(name)`).all());
      audit(user, 'Veranstaltung angelegt', `${n} (aus Dienstplan)`);
      return id;
    },
    event: id => db.prepare('SELECT id, name, date, active, closed_at FROM events WHERE id = ?').get(int(id)) || null,
    /** Verkauf eines Mitglieds je Monat (Datenauskunft) – auch bei ausgeschaltetem Verkauf, die Daten sind ja gespeichert */
    byMonth: id => db.prepare("SELECT substr(created_at,1,7) monat, SUM(qty) anzahl, SUM(total_cents) cents FROM bookings WHERE member_id = ? AND cancelled_at IS NULL GROUP BY monat ORDER BY monat").all(int(id)),
    /** offene Beträge je Konto zum jetzigen Stand → { asOf, upTo, rows: [{ id, name, kind, total_cents, items, since }] } */
    open() { const asOf = nowTs(), upTo = maxBookingId(); return { asOf, upTo, rows: balances(asOf, upTo) }; },
    /** Konten als abgerechnet markieren (nur Buchungen bis asOf/upTo) → { batch, cents, perMember: { id: cents } } */
    /** Konten abrechnen bis zum Stand asOf/upTo – memberIds = null: alle Konten mit offenem Betrag */
    settle(memberIds, asOf, upTo, username, note, prefix = 'modul-') {
      const ids = memberIds === null ? null : [...new Set((memberIds || []).map(int))].filter(Boolean);
      if ((ids && !ids.length) || !isTs(asOf)) return { batch: null, cents: 0, perMember: {}, members: 0, bookings: 0 };
      const batch = prefix + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'), up = Math.min(int(upTo), maxBookingId());
      const open = db.prepare(`SELECT member_id, SUM(total_cents) c, SUM(qty) n FROM bookings
      WHERE ${OPEN_KONTO} AND member_id IS NOT NULL AND ${CUT('')} GROUP BY member_id`).all(up, asOf, asOf).filter(r => !ids || ids.includes(r.member_id));
      const perMember = {}; let cents = 0, bookings = 0;
      db.transaction(() => {
        for (const r of open) {
          const id = Number(db.prepare(`INSERT INTO member_settlements(member_id, cents, items, until_at, batch, by_user, note) VALUES (?,?,?,?,?,?,?)`)
            .run(r.member_id, r.c, r.n, asOf, batch, username || null, note ? String(note).slice(0, 100) : null).lastInsertRowid);
          bookings += db.prepare(`UPDATE bookings SET settled_id = ? WHERE member_id = ? AND ${OPEN_KONTO} AND ${CUT('')}`).run(id, r.member_id, up, asOf, asOf).changes;
          perMember[r.member_id] = r.c; cents += r.c;
        }
      })();
      return { batch: open.length ? batch : null, cents, perMember, members: open.length, bookings };
    },
    /** Abrechnung eines Moduls zurücknehmen (z. B. wenn ein Einzug verworfen wird) – nur solange daraus nichts storniert wurde */
    /** Betrag aufs Verkaufskonto buchen (z. B. Platzgebühr eines Trainers) – bezahlt wird mit dem Verkauf unter Abrechnung → Buchungs-ID */
    charge(memberId, cents, note, user) {
      const m = db.prepare("SELECT * FROM members WHERE id = ? AND deleted = 0 AND active = 1 AND kind IN ('mitglied','nichtmitglied','mannschaft')").get(int(memberId));
      if (!m) throw new Error('Konto nicht gefunden (oder ausgeblendet).');
      const c = int(cents); if (!(c >= 10 && c <= 100000)) throw new Error('Betrag bitte zwischen 0,10 € und 1.000 €.');
      const t = cleanName(note, 60) || null;
      const id = Number(db.prepare("INSERT INTO bookings(member_id, article_id, kind, qty, unit_cents, total_cents, note) VALUES (?,?,'konto',1,?,?,?)").run(m.id, customArticleId(), c, c, t).lastInsertRowid);
      audit(user, 'Buchung nachgetragen', `${m.name}: Betrag ${euro(c)}${t ? ' (' + t + ')' : ''}`);
      return id;
    },
    /** Stand solcher Buchungen → { id: 'offen' | 'abgerechnet' | 'storniert' } */
    chargeStatus: ids => Object.fromEntries((ids || []).length ? db.prepare(`SELECT id, cancelled_at, settled_id FROM bookings WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids.map(int))
      .map(b => [b.id, b.cancelled_at ? 'storniert' : b.settled_id ? 'abgerechnet' : 'offen']) : []),
    /** noch nicht abgerechnete Buchung stornieren → true, sonst Fehler */
    cancelCharge(id, user) {
      const b = db.prepare('SELECT b.*, m.name FROM bookings b LEFT JOIN members m ON m.id = b.member_id WHERE b.id = ?').get(int(id));
      if (!b || b.cancelled_at) return true;
      if (b.settled_id) throw new Error('Schon abgerechnet – bitte unter Verkauf › Buchungen stornieren (das bucht eine Gutschrift).');
      db.prepare("UPDATE bookings SET cancelled_at = datetime('now','localtime'), cancelled_by = ? WHERE id = ?").run(user || 'Modul', b.id);
      audit(user, 'Buchung storniert', `${b.name || ''}: Betrag ${euro(b.total_cents)}${b.note ? ' (' + b.note + ')' : ''}`);
      return true;
    },
    /** Abrechnung eines einzelnen Kontos aus einem Modul-Lauf zurücknehmen (z. B. Verkaufs-Posten in der Mitgliederverwaltung storniert)
     *  → { ok, n } – die Buchungen sind danach wieder offen und lassen sich normal stornieren */
    reopen(batch, memberId) {
      const st = db.prepare('SELECT id FROM member_settlements WHERE batch = ? AND member_id = ?').get(String(batch || ''), int(memberId));
      if (!st) return { ok: true, n: 0 };
      const gone = goneIn([st.id]); if (gone) return { ok: false, error: gone };
      if (db.prepare('SELECT 1 FROM bookings c JOIN bookings o ON o.id = c.credit_for WHERE c.cancelled_at IS NULL AND o.settled_id = ?').get(st.id))
        return { ok: false, error: 'Für diese Verkaufsbuchungen gibt es schon eine Gutschrift unter Verkauf › Buchungen. Bitte die Gutschrift dort zuerst stornieren.' };
      let n = 0;
      db.transaction(() => { n = db.prepare('UPDATE bookings SET settled_id = NULL WHERE settled_id = ?').run(st.id).changes; db.prepare('DELETE FROM member_settlements WHERE id = ?').run(st.id); })();
      return { ok: true, n };
    },
    unsettle(batch) {
      const ids = db.prepare('SELECT id FROM member_settlements WHERE batch = ?').all(String(batch || '')).map(r => r.id);
      if (!ids.length) return { ok: true, n: 0 };
      const gone = goneIn(ids); if (gone) return { ok: false, error: gone, gone: true };
      const q = ids.map(() => '?').join(',');
      const credited = db.prepare(`SELECT COUNT(*) n FROM bookings c JOIN bookings o ON o.id = c.credit_for WHERE c.cancelled_at IS NULL AND o.settled_id IN (${q})`).get(...ids).n;
      if (credited) return { ok: false, error: 'Aus diesem Einzug wurde schon etwas storniert (Gutschrift) – die Buchungen können nicht wieder geöffnet werden.' };
      db.transaction(() => { db.prepare(`UPDATE bookings SET settled_id = NULL WHERE settled_id IN (${q})`).run(...ids); db.prepare(`DELETE FROM member_settlements WHERE id IN (${q})`).run(...ids); })();
      return { ok: true, n: ids.length };
    },
  };

  /* Fehlklick: nur die jüngste Abrechnung lässt sich zurücknehmen */
  admin.delete('/settle/:batch', need('abrechnung'), (req, res) => {
    const batch = String(req.params.batch);
    // Abrechnungen eines Moduls (z. B. Verkaufs-Einzug der Mitgliederverwaltung) nur dort zurücknehmen – sonst blieben dessen Posten
    // bestehen und dieselben Verkäufe würden beim nächsten Lauf noch einmal abgebucht
    if (!ownSettle(batch) && !batch.startsWith('stichtag-')) return bad(res, 'Diese Abrechnung gehört zu einem Verkaufs-Einzug der Mitgliederverwaltung. Bitte dort zurücknehmen (Lauf zurücknehmen) – hier würden die Verkäufe sonst doppelt abgebucht.');
    const newest = db.prepare('SELECT batch FROM member_settlements ORDER BY id DESC LIMIT 1').get();
    if (!newest || newest.batch !== batch || batch.startsWith('stichtag-')) return bad(res, 'Nur die letzte Abrechnung kann zurückgenommen werden.');
    const sum = db.prepare('SELECT SUM(cents) c, COUNT(*) n FROM member_settlements WHERE batch = ?').get(batch);
    const u = drinks.unsettle(batch);
    if (!u.ok) return bad(res, u.gone ? u.error : 'Seit dieser Abrechnung wurde daraus schon etwas storniert (Gutschrift) – Zurücknehmen ist nicht mehr möglich.');
    audit(req.user, 'Abrechnung zurückgenommen', `${sum.n} Konten, ${euro(sum.c || 0)}`);
    res.json({ ok: true });
  });

  /* ---------- Gäste-Deckel (Verwaltung) ---------- */
  const TAB_VIEW = need('veranstaltungen', 'uebernahme', 'abrechnung', 'export');
  function tabRows(where, ...params) {
    const items = db.prepare(`SELECT b.id, b.created_at, b.qty, b.total_cents, b.unit_cents, ${ARTICLE_LABEL} AS article
    FROM bookings b JOIN articles a ON a.id = b.article_id WHERE b.tab_id = ? AND b.cancelled_at IS NULL ORDER BY b.created_at`);
    return db.prepare(`SELECT t.*, m.name AS member, m.kind AS member_kind FROM guest_tabs t LEFT JOIN members m ON m.id = t.member_id WHERE ${where}`).all(...params)
      .map(t => {
        const it = items.all(t.id);
        return { ...t, items: it, open_cents: t.status === 'offen' ? it.reduce((s, x) => s + x.total_cents, 0) : 0,
          sum_cents: t.status === 'offen' || t.status === 'abgeschrieben' ? it.reduce((s, x) => s + x.unit_cents * x.qty, 0) : (t.cents || 0),
          last_at: it.length ? it[it.length - 1].created_at : t.created_at };
      });
  }
  admin.get('/tabs', TAB_VIEW, (req, res) => {
    const days = Math.min(365, Math.max(1, int(req.query.days, 30)));
    const open = tabRows("t.status = 'offen' ORDER BY t.created_at");
    const closed = tabRows("t.status <> 'offen' AND date(t.closed_at) >= date('now','localtime', ?) ORDER BY t.closed_at DESC", `-${days} days`);
    const today = db.prepare(`SELECT method, COALESCE(SUM(cents),0) c, COUNT(*) n FROM guest_tabs
    WHERE status = 'bezahlt' AND date(closed_at) = date('now','localtime') GROUP BY method`).all();
    res.json({ open, closed, days, nurAnschreiben: nurAnschreiben(), today: Object.fromEntries(today.map(r => [r.method, r])) });
  });
  const getTab = id => db.prepare('SELECT * FROM guest_tabs WHERE id = ?').get(int(id));
  admin.post('/tabs/:id/pay', need('veranstaltungen', 'uebernahme'), (req, res) => {
    const t = getTab(req.params.id);
    if (!t || t.status !== 'offen') return bad(res, 'Der Deckel ist nicht mehr offen.');
    const method = (req.body || {}).method;
    if (!['bar', 'karte'].includes(method)) return bad(res, 'Bitte bar oder Karte wählen.');
    if (nurAnschreiben()) return bad(res, NUR_ANSCHREIBEN_MSG, 403);
    res.json({ ok: true, cents: closeTab(t, { status: 'bezahlt', method, by: req.user.username }) });
  });
  admin.post('/tabs/:id/transfer', need('uebernahme'), (req, res) => {
    const t = getTab(req.params.id);
    if (!t || t.status !== 'offen') return bad(res, 'Der Deckel ist nicht mehr offen.');
    const m = db.prepare("SELECT * FROM members WHERE id = ? AND active = 1 AND kind IN ('mitglied','nichtmitglied','mannschaft')").get(int((req.body || {}).memberId));
    if (!m) return bad(res, 'Bitte ein Mitglied oder eine Mannschaft wählen.');
    res.json({ ok: true, cents: closeTab(t, { status: 'uebernommen', memberId: m.id, by: req.user.username, note: 'auf ' + m.name }) });
  });
  admin.post('/tabs/:id/writeoff', need('uebernahme'), (req, res) => {
    const t = getTab(req.params.id);
    if (!t || t.status !== 'offen') return bad(res, 'Der Deckel ist nicht mehr offen.');
    const note = cleanName((req.body || {}).note, 120);
    if (note.length < 3) return bad(res, 'Bitte kurz begründen, warum abgeschrieben wird.');
    res.json({ ok: true, cents: closeTab(t, { status: 'abgeschrieben', by: req.user.username, note }) });
  });
  /* Fehlklick am Tablet: „bezahlt“ zurücknehmen → Deckel wieder offen */
  admin.post('/tabs/:id/reopen', need('veranstaltungen', 'uebernahme'), (req, res) => {
    const t = getTab(req.params.id);
    if (!t || t.status !== 'bezahlt') return bad(res, 'Nur bezahlte Deckel lassen sich wieder öffnen.');
    db.transaction(() => {
      db.prepare("UPDATE guest_tabs SET status = 'offen', method = NULL, cents = NULL, closed_at = NULL, closed_by = NULL WHERE id = ?").run(t.id);
      db.prepare('UPDATE bookings SET paid_cash = 0 WHERE tab_id = ? AND cancelled_at IS NULL').run(t.id);
    })();
    audit(req.user, 'Gäste-Deckel wieder geöffnet', `${t.name}: ${euro(t.cents || 0)} ${t.method || ''} zurückgenommen`);
    res.json({ ok: true });
  });

  /* ---------- Veranstaltungen: eigene Getränkeliste + eigene Abrechnungsliste ---------- */
  function eventSummary(id) {
    const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!ev) return null;
    ev.articles = db.prepare(`SELECT ea.article_id AS id, a.name, a.category, ea.price_cents
    FROM event_articles ea JOIN articles a ON a.id = ea.article_id WHERE ea.event_id = ? AND a.custom = 0 ORDER BY cat_rank(a.category), de_key(a.category), de_key(a.name)`).all(id);
    ev.items = db.prepare(`SELECT a.name, a.category, a.custom, SUM(b.qty) qty, SUM(b.total_cents) total_cents,
      SUM(CASE WHEN b.kind = 'verein' THEN b.qty ELSE 0 END) free_qty
    FROM bookings b JOIN articles a ON a.id = b.article_id
    WHERE b.event_id = ? AND b.cancelled_at IS NULL GROUP BY a.id ORDER BY cat_rank(a.category), de_key(a.category), de_key(a.name)`).all(id);
    ev.guests = db.prepare(`SELECT g.id, g.name, g.member_id, m.name AS member_name, m.kind AS member_kind, g.created_by, g.created_at,
      COALESCE(SUM(b.qty),0) qty, COALESCE(SUM(b.total_cents),0) total_cents,
      COALESCE(SUM(CASE WHEN b.kind = 'event' AND b.payment_id IS NULL AND b.transferred_at IS NULL THEN b.total_cents END),0) open_cents,
      COALESCE(SUM(CASE WHEN p.method = 'bar' THEN b.total_cents END),0) bar_cents,
      COALESCE(SUM(CASE WHEN p.method = 'karte' THEN b.total_cents END),0) karte_cents,
      COALESCE(SUM(CASE WHEN b.transferred_at IS NOT NULL THEN b.total_cents END),0) transferred_cents,
      COUNT(b.id) n
    FROM event_guests g LEFT JOIN members m ON m.id = g.member_id
    LEFT JOIN bookings b ON b.event_guest_id = g.id AND b.cancelled_at IS NULL
    LEFT JOIN event_payments p ON p.id = b.payment_id
    WHERE g.event_id = ? GROUP BY g.id ORDER BY name_key(g.name, 'mitglied')`).all(id);
    ev.payments = db.prepare(`SELECT p.*, g.name, m.kind AS member_kind FROM event_payments p JOIN event_guests g ON g.id = p.guest_id LEFT JOIN members m ON m.id = g.member_id
    WHERE p.event_id = ? ORDER BY p.at DESC, p.id DESC`).all(id);
    const sale = db.prepare(`SELECT COALESCE(SUM(total_cents),0) c FROM bookings WHERE event_id = ? AND cancelled_at IS NULL
    AND event_guest_id IS NULL AND (kind = 'gast' OR (kind = 'event' AND paid_cash = 1))`).get(id).c;
    const sumG = k => ev.guests.reduce((t, g) => t + g[k], 0);
    ev.sale_cents = sale;                                   // sofort bar (Barverkauf ohne Namen, Gastkonto)
    ev.bar_cents = sale + sumG('bar_cents');                // gehört in die Kasse
    ev.karte_cents = sumG('karte_cents');
    ev.transferred_cents = sumG('transferred_cents');
    ev.open_cents = sumG('open_cents');
    ev.open_member_cents = ev.guests.filter(g => g.member_id).reduce((t, g) => t + g.open_cents, 0);
    ev.open_manual = ev.guests.filter(g => !g.member_id && g.open_cents > 0).map(g => ({ id: g.id, name: g.name, open_cents: g.open_cents }));
    ev.total_cents = ev.items.reduce((t, i) => t + i.total_cents, 0);
    ev.expected_cents = ev.bar_cents;
    return ev;
  }
  const getEvent = id => db.prepare('SELECT * FROM events WHERE id = ?').get(int(id));
  const getGuest = (evId, gid) => db.prepare('SELECT * FROM event_guests WHERE id = ? AND event_id = ?').get(int(gid), int(evId));

  admin.get('/events', need('veranstaltungen', 'uebernahme'), (req, res) => {
    const ids = db.prepare('SELECT id FROM events WHERE deleted = 0 ORDER BY date DESC, id DESC LIMIT 100').all();
    res.json(ids.map(r => eventSummary(r.id)));
  });

  /* Veranstaltung löschen: geht, wenn noch nichts gebucht wurde – oder wenn sie beendet ist und nichts mehr offen ist.
     Mit Buchungen verschwindet sie aus der Liste; Umsatz und Bestand bleiben in den Auswertungen erhalten. */
  admin.delete('/events/:id', need('veranstaltungen'), (req, res) => {
    const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted = 0').get(int(req.params.id));
    if (!ev) return res.json({ ok: true });
    if (ev.active) return bad(res, 'Die Veranstaltung ist noch aktiv – bitte zuerst deaktivieren.');
    const booked = db.prepare('SELECT COUNT(*) n FROM bookings WHERE event_id = ? AND cancelled_at IS NULL').get(ev.id).n;
    if (booked) {
      const open = db.prepare(`SELECT COALESCE(SUM(total_cents),0) c FROM bookings WHERE event_id = ? AND event_guest_id IS NOT NULL AND ${OPEN_GUEST}`).get(ev.id).c;
      if (open) return bad(res, `Auf der Liste sind noch ${euro(open)} offen – erst bezahlen lassen oder auf die Konten übernehmen.`);
    }
    db.transaction(() => {
      if (booked) db.prepare('UPDATE events SET deleted = 1 WHERE id = ?').run(ev.id);
      else {
        db.prepare('DELETE FROM bookings WHERE event_id = ?').run(ev.id);   // nur stornierte
        db.prepare('DELETE FROM event_payments WHERE event_id = ?').run(ev.id);
        db.prepare('DELETE FROM event_guests WHERE event_id = ?').run(ev.id);
        db.prepare('DELETE FROM event_articles WHERE event_id = ?').run(ev.id);
        db.prepare('DELETE FROM events WHERE id = ?').run(ev.id);
      }
    })();
    audit(req.user, 'Veranstaltung gelöscht', `${ev.name} (${ev.date})${booked ? ' – Umsätze bleiben in den Auswertungen' : ''}`);
    res.json({ ok: true, kept: Boolean(booked) });
  });

  /* Namensvorschläge für die Abrechnungsliste (auch ohne Recht „Mitglieder“) */
  admin.get('/event-members', need('veranstaltungen', 'uebernahme'), (req, res) => {
    res.json(db.prepare("SELECT id, name, kind FROM members WHERE active = 1 AND kind IN ('mitglied','nichtmitglied','mannschaft') ORDER BY name_key(name, kind)").all());
  });

  function saveEventArticles(eventId, list) {
    const clean = (Array.isArray(list) ? list : [])
      .map(a => ({ id: int(a.articleId), price: int(a.price_cents, -1) }))
      .filter(a => a.id && a.price >= 0 && a.price <= 100000 && db.prepare('SELECT 1 FROM articles WHERE id = ? AND custom = 0').get(a.id));
    db.transaction(() => {
      db.prepare('DELETE FROM event_articles WHERE event_id = ?').run(eventId);
      const ins = db.prepare('INSERT INTO event_articles(event_id, article_id, price_cents) VALUES (?,?,?)');
      clean.forEach(a => ins.run(eventId, a.id, a.price));
    })();
    return clean.length;
  }

  admin.post('/events', need('veranstaltungen'), (req, res) => {
    const { name, date, copyFrom } = req.body || {};
    const n = cleanName(name, 80);
    if (!n) return bad(res, 'Name fehlt.');
    const id = Number(db.prepare('INSERT INTO events(name, date) VALUES (?,?)').run(n, isDate(date) ? date : today()).lastInsertRowid);
    // Getränkeliste vorbelegen: von einer früheren Veranstaltung oder alle aktiven Artikel (inkl. Snacks, Bälle) zum Normalpreis
    const src = copyFrom ? db.prepare('SELECT article_id AS articleId, price_cents FROM event_articles WHERE event_id = ?').all(int(copyFrom)) : [];
    saveEventArticles(id, src.length ? src : db.prepare(`SELECT id AS articleId, price_cents FROM articles
    WHERE active = 1 AND custom = 0 AND deleted = 0 ORDER BY cat_rank(category), de_key(category), de_key(name)`).all());
    audit(req.user, 'Veranstaltung angelegt', n);
    res.json({ id });
  });

  admin.put('/events/:id/articles', need('veranstaltungen'), (req, res) => {
    const ev = getEvent(req.params.id);
    if (!ev) return bad(res, 'Nicht gefunden.', 404);
    if (ev.closed_at) return bad(res, 'Die Veranstaltung ist abgeschlossen.');
    res.json({ ok: true, count: saveEventArticles(ev.id, (req.body || {}).articles) });
  });

  admin.post('/events/:id/activate', need('veranstaltungen'), (req, res) => {
    const ev = getEvent(req.params.id);
    if (!ev) return bad(res, 'Nicht gefunden.', 404);
    if (ev.closed_at) return bad(res, 'Die Veranstaltung ist bereits abgeschlossen.');
    if (!db.prepare('SELECT COUNT(*) n FROM event_articles WHERE event_id = ?').get(ev.id).n) {
      return bad(res, 'Bitte zuerst festlegen, welche Artikel es gibt.');
    }
    db.transaction(() => {
      db.prepare('UPDATE events SET active = 0').run();
      db.prepare('UPDATE events SET active = 1 WHERE id = ?').run(ev.id);
    })();
    audit(req.user, 'Veranstaltung aktiviert', ev.name);
    res.json({ ok: true });
  });

  admin.post('/events/:id/deactivate', need('veranstaltungen'), (req, res) => {
    const ev = getEvent(req.params.id);
    if (!ev) return bad(res, 'Nicht gefunden.', 404);
    db.prepare('UPDATE events SET active = 0 WHERE id = ?').run(ev.id);
    audit(req.user, 'Veranstaltung deaktiviert', ev.name);
    res.json({ ok: true });
  });

  /* Abrechnungsliste: Namen hinzufügen (Mitglied oder frei), umbenennen / Mitglied zuordnen, entfernen */
  admin.post('/events/:id/guests', need('veranstaltungen'), (req, res) => {
    const ev = getEvent(req.params.id);
    if (!ev) return bad(res, 'Nicht gefunden.', 404);
    if (ev.closed_at) return bad(res, 'Die Veranstaltung ist abgeschlossen.');
    try {
      const g = addGuest(ev, req.body || {}, req.user.username);
      res.json({ id: g.id });
    } catch (e) { bad(res, e.message); }
  });

  admin.put('/events/:id/guests/:gid', need('veranstaltungen', 'uebernahme'), (req, res) => {
    const g = getGuest(req.params.id, req.params.gid);
    if (!g) return bad(res, 'Nicht gefunden.', 404);
    const b = req.body || {};
    let memberId = g.member_id, name = g.name;
    if (b.memberId !== undefined) {
      if (b.memberId === null || b.memberId === '') memberId = null;
      else {
        const m = db.prepare("SELECT * FROM members WHERE id = ? AND active = 1 AND kind IN ('mitglied','nichtmitglied','mannschaft')").get(int(b.memberId));
        if (!m) return bad(res, 'Mitglied nicht gefunden.');
        const dup = db.prepare('SELECT * FROM event_guests WHERE event_id = ? AND member_id = ? AND id <> ?').get(g.event_id, m.id, g.id);
        if (dup) {
          // steht schon auf der Liste (z. B. doppelt eingetragen): Einträge zusammenführen
          db.transaction(() => {
            db.prepare('UPDATE bookings SET event_guest_id = ?, member_id = CASE WHEN transferred_at IS NULL THEN ? ELSE member_id END WHERE event_guest_id = ?').run(dup.id, m.id, g.id);
            db.prepare('UPDATE event_payments SET guest_id = ? WHERE guest_id = ?').run(dup.id, g.id);
            db.prepare('DELETE FROM event_guests WHERE id = ?').run(g.id);
          })();
          audit(req.user, 'Veranstaltungsliste zusammengeführt', `${g.name} → ${dup.name}`);
          return res.json({ ok: true, merged: dup.name });
        }
        memberId = m.id;
        if (b.name === undefined) name = m.name;
      }
    }
    if (b.name !== undefined) { name = cleanName(b.name, 60); if (name.length < 2) return bad(res, 'Bitte einen Namen eingeben.'); }
    db.transaction(() => {
      db.prepare('UPDATE event_guests SET name = ?, member_id = ? WHERE id = ?').run(name, memberId, g.id);
      // offene Buchungen gehören dann zum zugeordneten Mitglied
      db.prepare(`UPDATE bookings SET member_id = ? WHERE event_guest_id = ? AND transferred_at IS NULL`).run(memberId, g.id);
    })();
    audit(req.user, 'Veranstaltungsliste geändert', `${g.name} → ${name}${memberId ? ' (Mitglied)' : ''}`);
    res.json({ ok: true });
  });

  admin.delete('/events/:id/guests/:gid', need('veranstaltungen'), (req, res) => {
    const g = getGuest(req.params.id, req.params.gid);
    if (!g) return bad(res, 'Nicht gefunden.', 404);
    if (db.prepare('SELECT COUNT(*) n FROM bookings WHERE event_guest_id = ? AND cancelled_at IS NULL').get(g.id).n) {
      return bad(res, 'Auf diesem Namen gibt es Buchungen – erst stornieren (unter „Buchungen“), dann entfernen.');
    }
    db.transaction(() => {
      db.prepare('UPDATE bookings SET event_guest_id = NULL WHERE event_guest_id = ?').run(g.id);
      db.prepare('DELETE FROM event_guests WHERE id = ?').run(g.id);
    })();
    res.json({ ok: true });
  });

  /* „Hat bezahlt“ (bar oder Karte): deckt alle offenen Buchungen dieses Namens */
  admin.post('/events/:id/guests/:gid/pay', need('veranstaltungen'), (req, res) => {
    const g = getGuest(req.params.id, req.params.gid);
    if (!g) return bad(res, 'Nicht gefunden.', 404);
    const method = (req.body || {}).method;
    if (!['bar', 'karte'].includes(method)) return bad(res, 'Bitte bar oder Karte wählen.');
    if (nurAnschreiben()) return bad(res, NUR_ANSCHREIBEN_MSG, 403);
    let cents = 0;
    db.transaction(() => {
      cents = guestOpen(g.id);
      if (!cents) return;
      const pid = Number(db.prepare('INSERT INTO event_payments(event_id, guest_id, method, cents, by_user) VALUES (?,?,?,?,?)')
        .run(g.event_id, g.id, method, cents, req.user.username).lastInsertRowid);
      db.prepare(`UPDATE bookings SET payment_id = ? WHERE event_guest_id = ? AND ${OPEN_GUEST}`).run(pid, g.id);
    })();
    if (!cents) return bad(res, 'Bei diesem Namen ist nichts offen.');
    audit(req.user, 'Veranstaltung: hat bezahlt', `${g.name}: ${euro(cents)} ${method === 'bar' ? 'bar' : 'mit Karte'}`);
    res.json({ ok: true, cents });
  });

  admin.delete('/events/:id/payments/:pid', need('veranstaltungen'), (req, res) => {
    const p = db.prepare('SELECT p.*, g.name FROM event_payments p JOIN event_guests g ON g.id = p.guest_id WHERE p.id = ? AND p.event_id = ?')
      .get(int(req.params.pid), int(req.params.id));
    if (!p) return bad(res, 'Nicht gefunden.', 404);
    db.transaction(() => {
      db.prepare('UPDATE bookings SET payment_id = NULL WHERE payment_id = ?').run(p.id);
      db.prepare('DELETE FROM event_payments WHERE id = ?').run(p.id);
    })();
    audit(req.user, 'Veranstaltung: Zahlung zurückgenommen', `${p.name}: ${euro(p.cents)} ${p.method}`);
    res.json({ ok: true });
  });

  /* Kassierer: was nicht bezahlt wurde, auf die normale Getränkeliste (Mitgliederkonten) übernehmen */
  admin.post('/events/:id/transfer', need('uebernahme'), (req, res) => {
    const ev = getEvent(req.params.id);
    if (!ev) return bad(res, 'Nicht gefunden.', 404);
    const only = Array.isArray((req.body || {}).guestIds) ? req.body.guestIds.map(int) : null;
    let n = 0, cents = 0, people = 0;
    const skipped = [];
    db.transaction(() => {
      const guests = db.prepare('SELECT * FROM event_guests WHERE event_id = ?').all(ev.id).filter(g => !only || only.includes(g.id));
      for (const g of guests) {
        const open = guestOpen(g.id);
        if (!open) continue;
        if (!g.member_id) { skipped.push(g.name); continue; }
        // created_at bleibt der echte Buchungszeitpunkt. Abgerechnet wird die Übernahme trotzdem im nächsten Lauf: die
        // Abrechnung nimmt alle offenen Konto-Buchungen (settled_id IS NULL) und grenzt über transferred_at ab, nicht über created_at.
        const r = db.prepare(`UPDATE bookings SET kind = 'konto', member_id = ?, transferred_at = datetime('now','localtime'), transferred_by = ?
        WHERE event_guest_id = ? AND ${OPEN_GUEST}`).run(g.member_id, req.user.username, g.id);
        n += r.changes; cents += open; people++;
      }
    })();
    audit(req.user, 'Veranstaltung übernommen', `${ev.name}: ${people} Personen, ${euro(cents)} auf die Konten`);
    res.json({ ok: true, transferred: n, people, cents, skipped });
  });

  admin.post('/events/:id/close', need('veranstaltungen'), (req, res) => {
    const cash = (req.body || {}).cash_cents;
    const ev = getEvent(req.params.id);
    if (!ev) return bad(res, 'Nicht gefunden.', 404);
    const c = cash === '' || cash === undefined || cash === null ? null : int(cash);
    db.prepare(`UPDATE events SET active = 0, closed_at = datetime('now','localtime'), cash_cents = ?, note = ? WHERE id = ?`)
      .run(c, (req.body || {}).note ? String(req.body.note).slice(0, 300) : null, ev.id);
    audit(req.user, 'Veranstaltung abgeschlossen', `${ev.name}${c === null ? '' : ', Kasse ' + euro(c)}`);
    res.json({ ok: true });
  });

  /* ---------- Bestellung beim Getränkehändler ---------- */
  admin.get('/order', need('bestellung'), (req, res) => {
    const settings = orderSettings();
    const artNo = db.prepare(`SELECT art_no, text, pack_size FROM supplier_map WHERE supplier = ? AND article_id = ?
    ORDER BY rowid DESC LIMIT 1`);
    const rows = stockList().filter(s => s.active && s.track_stock).map(s => {
      const target = s.target_stock || s.min_stock * 2;
      const low = s.min_stock > 0 && s.delivered > 0 && s.stock <= s.min_stock;   // nur Artikel, die schon geliefert wurden
      const crates = low ? Math.max(1, Math.ceil((target - s.stock) / s.crate_size)) : 0;
      const map = artNo.get(settings.order_supplier, s.id);
      return { id: s.id, name: s.name, category: s.category, stock: s.stock, min_stock: s.min_stock, target_stock: target,
        crate_size: s.crate_size, low, suggest: crates, art_no: map ? map.art_no : '',
        supplier_text: map && map.text ? map.text.replace(/-?€/g, '').replace(/\s+/g, ' ').trim() : '' };
    });
    res.json({ settings, clubName: getSetting('club_name', process.env.CLUB_NAME || 'Unser Verein'), rows, mailReady: mail.ready(), mayMailSetup: req.user.perms.includes('einstellungen'), lastSent: getSetting('order_last_sent', '') });
  });

  /* ---------- Export & Sicherung ---------- */
  async function buildExport(from, to, asOf = nowTs(), upTo = maxBookingId()) {
    const bookings = db.prepare(`SELECT b.*, ${ARTICLE_LABEL} AS article, COALESCE(b.article_category, a.category) AS category, COALESCE(m.name, g.name, 'Deckel: ' || t.name) AS member, e.name AS event,
      p.method AS pay_method, t.status AS tab_status, t.method AS tab_method
    FROM bookings b JOIN articles a ON a.id = b.article_id
    LEFT JOIN members m ON m.id = b.member_id LEFT JOIN events e ON e.id = b.event_id
    LEFT JOIN event_guests g ON g.id = b.event_guest_id LEFT JOIN event_payments p ON p.id = b.payment_id
    LEFT JOIN guest_tabs t ON t.id = b.tab_id
    WHERE b.cancelled_at IS NULL AND b.created_at >= ? AND b.created_at < date(?, '+1 day') ORDER BY b.created_at`).all(from, to);   // wie date(created_at) BETWEEN, aber über den Index
    const events = db.prepare('SELECT id FROM events WHERE date BETWEEN ? AND ? ORDER BY date').all(from, to).map(r => eventSummary(r.id));
    const tabs = tabRows("date(t.created_at) BETWEEN ? AND ? ORDER BY t.created_at", from, to);
    const categories = db.prepare('SELECT category FROM articles WHERE deleted = 0 OR id IN (SELECT article_id FROM bookings) GROUP BY category ORDER BY cat_rank(category), de_key(category)').all().map(r => r.category);
    const wb = await buildWorkbook({
      clubName: getSetting('club_name', process.env.CLUB_NAME || 'Unser Verein'), from, to, color: clubColor(),
      balances: balances(asOf, upTo), asOf, openBookings: openBookings(asOf, upTo), categories, bookings, shrink: shrinkage(from, to), stock: stockList(), events, tabs,
    });
    return wb;
  }

  function openBookings(asOf, upTo) {
    return db.prepare(`SELECT b.created_at, b.qty, b.unit_cents, b.total_cents, b.transferred_at, ${ARTICLE_LABEL} AS article, m.name AS member
    FROM bookings b JOIN articles a ON a.id = b.article_id JOIN members m ON m.id = b.member_id
    WHERE b.${OPEN_KONTO.replace(/ AND /g, ' AND b.')} AND ${CUT('b.')} ORDER BY name_key(m.name, m.kind), b.created_at`).all(upTo, asOf, asOf);
  }

  admin.get('/export.xlsx', need('abrechnung', 'export'), asyncRoute(async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const fixed = isTs(req.query.asOf) && req.query.asOf <= nowTs() && req.query.upTo !== undefined;
    const wb = await buildExport(from, to, fixed ? req.query.asOf : nowTs(), fixed ? Math.min(int(req.query.upTo), maxBookingId()) : maxBookingId());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Getraenke_${from}_bis_${to}.xlsx"`);
    audit(req.user, 'Excel exportiert', `${from} bis ${to}`);
    await wb.xlsx.write(res);
    res.end();
  }));
  return { belegFiles, buildExport, cleanupUploads, drinks, TRASH_DIR };
};
