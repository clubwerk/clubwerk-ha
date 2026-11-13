'use strict';
/* Betrachter der Mitglieder-App für PDFs und Bilder: ein Vollbild-Blatt, alles bleibt in der App (nie ein neues Fenster, nie Safari).
   Wird erst beim ersten Öffnen einer Datei geladen (ctx.view in app.js); PDF.js (lokal, public/app/pdfjs/) erst beim ersten PDF.
   Seiten und Bilder füllen die Breite, Zoom per Zwei-Finger-Geste, Doppeltippen, +/– und Strg+Mausrad (alle über denselben weichen Weg). PDF-Seiten werden
   erst beim Heranscrollen gezeichnet. Links und Skripte in PDFs bleiben wirkungslos (keine Anmerkungsebene, kein Scripting). */
(() => {
  const VA = window.VA;
  if (!VA || VA.view) return;
  const VER = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || ''; } catch (e) { return ''; } })();
  const asset = f => new URL(f + (VER ? '?v=' + encodeURIComponent(VER) : ''), document.baseURI).href;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const tx = (t, v) => window.CWI18N && window.CWI18N.T ? window.CWI18N.T(t, v) : (v || []).reduce((a, x, i) => a.replace('{' + i + '}', x), t);

  if (!document.getElementById('vvStyle')) {
    const s = document.createElement('style'); s.id = 'vvStyle';
    s.textContent = `
      .vh-sheet.vh-viewer { padding: 0; align-items: stretch; background: var(--card); }
      .vh-sheet.vh-viewer .vh-box, body.embedded .vh-sheet.vh-viewer .vh-box { display: flex; flex-direction: column; max-width: none; width: 100%; height: 100dvh; max-height: none; padding: 0; border: 0; border-radius: 0; box-shadow: none; text-align: left; overflow: hidden; background: var(--card); }
      .vv-bar { flex: none; touch-action: none; padding: calc(10px + env(safe-area-inset-top)) calc(14px + env(safe-area-inset-right)) 10px calc(14px + env(safe-area-inset-left)); border-bottom: 1px solid var(--line); background: var(--card); }
      .vv-bar h2 { margin: 0; font-size: 16px; line-height: 1.3; min-width: 0; flex: 1; overflow-wrap: anywhere; }
      .vv-row { display: flex; align-items: center; gap: 8px; }
      .vv-row + .vv-row { margin-top: 8px; }
      .vv-bar button { flex: none; min-height: 44px; min-width: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
      .vv-bar button.ok { background: var(--brand); border-color: var(--brand); color: var(--on-brand, #fff); }
      .vv-bar button:disabled { opacity: .45; }
      .vv-bar button.vv-z { font-size: 22px; line-height: 1; padding: 0; width: 44px; }
      .vv-pg { flex: 1; min-width: 0; font-size: 14px; color: var(--muted); font-variant-numeric: tabular-nums; }
      .vv-scroll { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y; position: relative; background: var(--hover); padding-bottom: env(safe-area-inset-bottom); }
      .vv-scroll:focus-visible { outline: 3px solid var(--brand); outline-offset: -3px; }
      .vv-pages { margin: 0; }
      .vv-pz { display: flex; flex-direction: column; gap: 6px; transform-origin: 0 0; }
      .vv-page { position: relative; width: 100%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
      .vv-page canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      .vv-page canvas.vv-det { inset: auto; }
      .vv-img { width: max-content; min-width: 100%; min-height: 100%; display: flex; }
      .vv-img img { margin: auto; display: block; transform-origin: 0 0; flex: none; max-width: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      .vv-msg { margin: 0; padding: 28px 20px; text-align: center; font-size: 15px; line-height: 1.5; color: var(--muted); overflow-wrap: anywhere; }
      .vv-msg b { display: block; color: var(--ink); margin-bottom: 6px; font-size: 16px; }`;
    document.head.appendChild(s);
  }

  /* ---------- PDF.js erst beim ersten PDF ---------- */
  let pdfjsP = null;
  const loadPdfjs = () => pdfjsP || (pdfjsP = import(asset('pdfjs/pdf.min.mjs')).then(m => { m.GlobalWorkerOptions.workerSrc = asset('pdfjs/pdf.worker.min.mjs'); return m; }).catch(e => { pdfjsP = null; throw e; }));

  /* Zoom wie in Foto- und PDF-Apps: Während einer Geste wird nur die schon gezeichnete Ebene per CSS-Transform verschoben und skaliert (kein Layout, kein
     Neuzeichnen, keine Zwischenstände). Nach dem Loslassen geht die neue Größe ins Layout, ohne dass sich das Bild bewegt; Grenzen federn weich zurück.
     Erst in der Ruhe danach wird scharf neu gezeichnet – die alte Zeichenfläche bleibt sichtbar, bis die neue fertig ist. */
  const MAXZ = 4, BASEPX = 5e6, DETPX = 6e6, RUHE = 120, FEDER = 220;
  // BASEPX: größte Zeichenfläche je ganze Seite; DETPX: scharfe Ausschnitte bei starkem Zoom, alle zusammen. iPhone-Safari zeichnet zu große oder zu viele Flächen still leer.
  const zap = c => { if (c) { c.width = c.height = 0; c.remove(); } };   // Speicher sofort freigeben (Safari hält ihn sonst bis zur Speicherbereinigung)
  let st = null;   // der gerade offene Betrachter

  function close() {
    if (!st) return;
    const s = st; st = null;
    document.removeEventListener('keydown', s.onKey, true);
    window.removeEventListener('resize', s.onResize);
    cancelAnimationFrame(s.anim); clearTimeout(s.ruhe); clearTimeout(s.wz);
    s.io && s.io.disconnect();
    if (s.rt) { try { s.rt.cancel(); } catch (e) { /* egal */ } }
    s.pages.forEach(p => { zap(p.cv); zap(p.det); });
    if (s.task) s.task.destroy().catch(() => {});
    if (s.url) URL.revokeObjectURL(s.url);
    s.sheet.classList.remove('show');
    s.sheet.innerHTML = '';
    if (s.back && s.back.focus && document.contains(s.back)) { try { s.back.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
  }

  /** Datei sichern: Teilen-Menü des Handys (mit Datei), sonst Download – ohne neues Fenster */
  async function save(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
  VA.save = save;

  function view(blob, name, kind) {
    close();
    kind = kind || (/^image\//.test(blob.type) ? 'image' : 'pdf');
    let sheet = document.getElementById('cwViewer');
    if (!sheet) {
      sheet = document.createElement('div'); sheet.id = 'cwViewer'; sheet.className = 'vh-sheet vh-viewer';
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(n => sheet.addEventListener(n, e => e.preventDefault(), { passive: false }));   // Safari: kein Seiten-Zoom über dem Betrachter
    }
    document.body.appendChild(sheet);   // immer zuoberst
    sheet.innerHTML = `<div class="vh-box"><div class="vv-bar">
        <div class="vv-row"><h2 translate="no">${esc(name)}</h2><button type="button" class="ok" id="vvX">Schließen</button></div>
        <div class="vv-row"><span class="vv-pg" id="vvPg" role="status" aria-live="polite"></span>
          <button type="button" class="vv-z" id="vvMin" aria-label="Verkleinern">−</button><button type="button" class="vv-z" id="vvPlus" aria-label="Vergrößern">+</button>
          <button type="button" id="vvSave">Teilen/Sichern</button></div></div>
      <div class="vv-scroll" id="vvScroll" tabindex="0" role="region" aria-label="Dokument"><p class="vv-msg" role="status">Wird geladen …</p></div></div>`;
    const $ = id => sheet.querySelector('#' + id);
    const sc = $('vvScroll');
    // z: Zoom im Layout; t: Transform der Ebene darüber (sichtbarer Zoom = z · t.k); g: laufende Geste; lay: Element mit der Layoutbreite; tf: transformierte Ebene
    const s = st = { sheet, sc, z: 1, t: { x: 0, y: 0, k: 1 }, g: null, anim: 0, doc: null, task: null, rt: null, url: '', io: null, pages: [], back: document.activeElement, img: null, lay: null, tf: null, lw: 0, ratio: 1 };
    const mine = () => st === s;
    sheet.classList.add('show');
    $('vvX').onclick = close;
    $('vvSave').onclick = () => save(blob, name);
    $('vvMin').onclick = () => zoomBy(1 / 1.5); $('vvPlus').onclick = () => zoomBy(1.5);
    $('vvX').focus({ preventScroll: true });

    const msg = (title, text) => { sc.innerHTML = `<p class="vv-msg" role="alert"><b>${esc(title)}</b>${esc(text)}</p>`; $('vvMin').disabled = $('vvPlus').disabled = true; };

    /* ----- Layout und Transform ----- */
    const base = () => {   // Breite bei Zoom 1: PDF = Anzeigebreite, Bild = so groß wie möglich ohne Abschneiden
      if (!s.img) return sc.clientWidth;
      return Math.max(1, Math.min(sc.clientWidth, sc.clientHeight * s.ratio));
    };
    const layout = () => { if (s.lay) { s.lw = base() * s.z; s.lay.style.width = s.lw + 'px'; } };
    const apply = () => {
      const t = s.t, el = s.tf; if (!el) return;
      if (Math.abs(t.x) < 0.01 && Math.abs(t.y) < 0.01 && Math.abs(t.k - 1) < 1e-4) { s.t = { x: 0, y: 0, k: 1 }; el.style.transform = ''; el.style.willChange = ''; }
      else { el.style.willChange = 'transform'; el.style.transform = `translate(${t.x}px,${t.y}px) scale(${t.k})`; }
    };
    const box = () => s.tf.getBoundingClientRect();   // sichtbare Lage samt Transform (Ursprung oben links)
    const busy = () => !!(s.g || s.anim);
    const stopAnim = () => { if (s.anim) { cancelAnimationFrame(s.anim); s.anim = 0; } };
    const stopDraw = () => { clearTimeout(s.ruhe); if (s.rt) { try { s.rt.cancel(); } catch (e) { /* egal */ } } };
    const settle = () => { clearTimeout(s.ruhe); s.ruhe = setTimeout(() => { if (mine() && !busy()) sync(); }, RUHE); };

    /* ----- Geste: Anker (Stelle im Inhalt, bei Zoom 1 gemessen) bleibt unter dem Mittelpunkt der Finger; nur der Transform ändert sich ----- */
    const soft = v => v > MAXZ ? MAXZ * (v / MAXZ) ** 0.3 : v < 1 ? v ** 0.3 : v;   // über die Grenzen hinaus nur gedämpft, danach federt es zurück
    function gBegin(x, y) {
      stopAnim(); stopDraw();
      const b = box(), vz = s.z * s.t.k;
      // ox/oy: Lage des Inhalts ohne Transform plus Scrollstand – bleibt gleich, auch wenn der Browser während der Geste nachschiebt
      s.g = { ax: (x - b.left) / vz, ay: (y - b.top) / vz, z0: vz, raw: vz, vz, x, y, ox: b.left - s.t.x + sc.scrollLeft, oy: b.top - s.t.y + sc.scrollTop };
    }
    function gPlace() {
      const g = s.g;
      s.t = { x: g.x - g.ax * g.vz - (g.ox - sc.scrollLeft), y: g.y - g.ay * g.vz - (g.oy - sc.scrollTop), k: g.vz / s.z };
      apply();
    }
    function gMove(x, y, raw) { const g = s.g; g.x = x; g.y = y; g.raw = raw; g.vz = soft(raw); gPlace(); }
    function gEnd() { const g = s.g; if (!g) return; s.g = null; s.gEnd = Date.now(); commit(g.vz, g.x, g.y); }

    /* Zoom z übernehmen, (x, y) bleibt stehen: Layout und Scrollstand setzen, mit einem Transform genau so aussehen lassen wie vorher und dann weich zum Ziel
       gleiten (auch beim Zurückfedern an Grenzen und Rändern). Ohne Ausweg über die Grenzen ist der Transform danach null – nichts bewegt sich. */
    function commit(z, x, y) {
      if (!s.tf) return;
      stopAnim();
      z = Math.max(1, Math.min(MAXZ, z));
      if (x == null) { const r = sc.getBoundingClientRect(); x = r.left + sc.clientWidth / 2; y = r.top + sc.clientHeight / 2; }   // „+“/„–“: um die Mitte des Ausschnitts
      const b = box(), vz = s.z * s.t.k, f = z / vz;
      const tx = x - (x - b.left) * f, ty = y - (y - b.top) * f;   // Ziel der linken oberen Ecke
      s.z = z; s.t = { x: 0, y: 0, k: 1 }; apply(); layout();
      let q = box(); sc.scrollLeft += q.left - tx; sc.scrollTop += q.top - ty;   // der Browser begrenzt auf den gültigen Bereich
      q = box();
      s.t = { x: b.left - q.left, y: b.top - q.top, k: vz / z }; apply();
      $('vvMin').disabled = z <= 1.001; $('vvPlus').disabled = z >= MAXZ - 0.001;
      const t0 = s.t;
      if (t0.k === 1 && !t0.x && !t0.y) return settle();
      const start = performance.now();
      const step = now => {
        const p = Math.min(1, (now - start) / FEDER), e = 1 - (1 - p) ** 3;
        s.t = { x: t0.x * (1 - e), y: t0.y * (1 - e), k: t0.k + (1 - t0.k) * e }; apply();
        if (p < 1) s.anim = requestAnimationFrame(step); else { s.anim = 0; s.t = { x: 0, y: 0, k: 1 }; apply(); settle(); }
      };
      s.anim = requestAnimationFrame(step);
    }
    const zoomBy = f => commit(s.z * f);
    s.onResize = () => { if (mine() && !s.g) { layout(); settle(); } };
    window.addEventListener('resize', s.onResize);

    /* ----- Eingaben ----- */
    let tap = null; const ptr = new Set();
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = t => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    sc.addEventListener('touchstart', e => {
      if (e.touches.length === 2 && s.tf) { s.multi = true; tap = null; if (s.g) s.g = null; const m = mid(e.touches); gBegin(m.x, m.y); s.g.d0 = Math.max(1, dist(e.touches)); }
      else if (e.touches.length > 2) gEnd();
    }, { passive: true });
    sc.addEventListener('touchmove', e => {
      if (!s.g || !s.g.d0 || e.touches.length !== 2) return;
      if (e.cancelable) e.preventDefault();
      const m = mid(e.touches); gMove(m.x, m.y, s.g.z0 * dist(e.touches) / s.g.d0);
    }, { passive: false });
    const tEnd = e => { if (s.g && s.g.d0 && e.touches.length < 2) gEnd(); };
    sc.addEventListener('touchend', tEnd, { passive: true }); sc.addEventListener('touchcancel', tEnd, { passive: true });
    sc.addEventListener('wheel', e => {   // Strg+Mausrad bzw. Zwei-Finger-Zoom am Trackpad: wie eine Geste, Ende nach kurzer Ruhe
      if (!e.ctrlKey || !s.tf) return;
      e.preventDefault();
      if (s.g && !s.g.wheel) return;
      if (!s.g) { gBegin(e.clientX, e.clientY); s.g.wheel = true; }
      gMove(e.clientX, e.clientY, s.g.raw * Math.exp(-e.deltaY / 200));
      clearTimeout(s.wz); s.wz = setTimeout(() => { if (s.g && s.g.wheel) gEnd(); }, 150);
    }, { passive: false });
    // Doppeltippen / Doppelklick: auf 2,5-fach, noch einmal: zurück. Nur echte Einzel-Tipps zählen – nie das Loslassen nach einer Zwei-Finger-Geste.
    sc.addEventListener('pointerdown', e => { if (e.isPrimary) { ptr.clear(); s.multi = false; s.down = { x: e.clientX, y: e.clientY }; } ptr.add(e.pointerId); if (ptr.size > 1) { s.multi = true; tap = null; } });
    sc.addEventListener('pointercancel', e => { ptr.delete(e.pointerId); s.down = null; tap = null; });
    sc.addEventListener('pointerup', e => {
      ptr.delete(e.pointerId);
      const d = s.down; if (!ptr.size) s.down = null;
      if (s.multi || !d || s.g || Date.now() - (s.gEnd || 0) < 350 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) { if (s.multi) tap = null; return; }
      const now = Date.now();
      if (tap && now - tap.t < 320 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 30) { tap = null; commit(s.z > 1.2 ? 1 : 2.5, e.clientX, e.clientY); } else tap = { t: now, x: e.clientX, y: e.clientY };
    });
    s.onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') {   // Fokus bleibt im Betrachter
        const f = [...sheet.querySelectorAll('button:not(:disabled), [tabindex="0"]')]; if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        return;
      }
      if (document.activeElement && document.activeElement.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1.5); } else if (e.key === '-') { e.preventDefault(); zoomBy(1 / 1.5); }
    };
    document.addEventListener('keydown', s.onKey, true);

    /* ----- Bild ----- */
    function showImage() {
      s.url = URL.createObjectURL(blob);
      const img = new Image(); img.alt = name; img.draggable = false;
      img.onload = () => { if (!mine()) return; s.ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1); const w = document.createElement('div'); w.className = 'vv-img'; w.appendChild(img); sc.innerHTML = ''; sc.appendChild(w); s.img = s.lay = s.tf = img; layout(); };
      img.onerror = () => { if (mine()) msg('Das Bild lässt sich nicht anzeigen.', 'Du kannst es mit „Teilen/Sichern“ speichern.'); };
      img.src = s.url;
    }

    /* ----- PDF: je Seite eine Zeichenfläche in Bildschirmauflösung (gedeckelt), bei starkem Zoom zusätzlich der sichtbare Ausschnitt in voller Schärfe ----- */
    let queue = Promise.resolve();
    const run = job => { queue = queue.then(job).catch(() => {}); };
    const dpr = () => Math.min(window.devicePixelRatio || 1, 3);
    const free = p => { zap(p.cv); zap(p.det); p.cv = p.det = p.dr = null; p.have = 0; };
    async function paint(p, vp, cv, transform) {   // abbrechbar: beginnt eine Geste, hört das Zeichnen sofort auf
      const task = p.page.render({ canvas: cv, canvasContext: cv.getContext('2d'), viewport: vp, transform, background: '#ffffff' });
      s.rt = task;
      try { await task.promise; return mine() && !busy() && p.vis; } catch (e) { return false; } finally { if (s.rt === task) s.rt = null; }
    }
    function draw(p) {
      const v1 = p.v1; let scale = s.lw * dpr() / v1.width;
      const px = v1.width * v1.height * scale * scale; if (px > BASEPX) scale *= Math.sqrt(BASEPX / px);
      const key = Math.floor(v1.width * scale);
      if (p.have === key || p.pend === key) return;
      p.pend = key;
      run(async () => {
        if (p.pend !== key) return;
        p.pend = 0;
        if (!mine() || busy() || !p.vis) return;   // nach Geste oder Federn zeichnet settle() erneut
        const vp = p.page.getViewport({ scale }), cv = document.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        if (!(await paint(p, vp, cv, null))) { zap(cv); return; }
        const old = p.cv; p.el.insertBefore(cv, p.el.firstChild); p.cv = cv; p.have = key; zap(old);   // tauschen erst, wenn die neue fertig ist
      });
    }
    async function details() {   // nur wo die ganze Seite gedeckelt ist: sichtbarer Bereich plus Rand, alle Ausschnitte zusammen höchstens DETPX
      const R = sc.getBoundingClientRect(), d = dpr(), z = s.z, want = [];
      s.pages.forEach(p => {
        const full = s.lw * d / p.v1.width, b = p.el.getBoundingClientRect();
        const seen = p.vis && b.bottom > R.top && b.top < R.bottom && b.right > R.left && b.left < R.right;
        if (!seen || p.v1.width * p.v1.height * full * full <= BASEPX * 1.05) { zap(p.det); p.det = p.dr = null; return; }
        const cut = m => { const x0 = Math.max(b.left, R.left - R.width * m), x1 = Math.min(b.right, R.right + R.width * m), y0 = Math.max(b.top, R.top - R.height * m), y1 = Math.min(b.bottom, R.bottom + R.height * m); return { x: (x0 - b.left) / b.width, y: (y0 - b.top) / b.height, w: (x1 - x0) / b.width, h: (y1 - y0) / b.height, a: (x1 - x0) * (y1 - y0) }; };
        want.push({ p, full, need: cut(0), reg: cut(0.2) });
      });
      const area = want.reduce((a, w) => a + w.reg.a, 0) * d * d, q = area > DETPX ? Math.sqrt(DETPX / area) : 1;
      for (const { p, full, need, reg } of want) {
        const r = p.dr;
        if (r && r.z === z && r.x <= need.x + 1e-3 && r.y <= need.y + 1e-3 && r.x + r.w >= need.x + need.w - 1e-3 && r.y + r.h >= need.y + need.h - 1e-3) continue;   // deckt den Ausschnitt schon
        if (!mine() || busy() || s.z !== z) return;
        const vp = p.page.getViewport({ scale: full * q }), W = vp.width, H = vp.height;
        const rx = Math.floor(reg.x * W), ry = Math.floor(reg.y * H), rw = Math.min(Math.ceil((reg.x + reg.w) * W), Math.floor(W)) - rx, rh = Math.min(Math.ceil((reg.y + reg.h) * H), Math.floor(H)) - ry;
        if (rw < 1 || rh < 1) continue;
        const cv = document.createElement('canvas'); cv.className = 'vv-det'; cv.width = rw; cv.height = rh;
        Object.assign(cv.style, { left: rx / W * 100 + '%', top: ry / H * 100 + '%', width: rw / W * 100 + '%', height: rh / H * 100 + '%' });
        if (!(await paint(p, vp, cv, [1, 0, 0, 1, -rx, -ry])) || s.z !== z) { zap(cv); return; }
        const old = p.det; p.el.appendChild(cv); p.det = cv; p.dr = { z, x: rx / W, y: ry / H, w: rw / W, h: rh / H }; zap(old);
      }
    }
    function sync() {   // sichtbare Seiten (mit Vorlauf) zeichnen, entfernte freigeben, dann scharfe Ausschnitte
      if (!s.pages.length) return;
      s.pages.forEach(p => { if (!p.page) return; if (p.vis) draw(p); else free(p); });
      if (!s.dq) { s.dq = true; run(async () => { s.dq = false; if (mine() && !busy()) await details(); }); }
    }
    const pageNo = () => {
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) return s.pages.length;   // ganz unten: letzte Seite
      const lim = sc.getBoundingClientRect().top + sc.clientHeight / 3; let n = 1;
      s.pages.forEach((p, i) => { if (p.el.getBoundingClientRect().top <= lim) n = i + 1; });
      return n;
    };
    const counter = () => { if (s.pages.length) $('vvPg').textContent = tx('Seite {0} von {1}', [pageNo(), s.pages.length]); };
    sc.addEventListener('scroll', () => {
      if (s.g) { gPlace(); return; }   // schiebt der Browser während der Geste nach (iOS), bleibt der Anker unter den Fingern
      if (!s.pages.length) return;
      if (!s.anim) settle();
      if (!s.raf) s.raf = requestAnimationFrame(() => { s.raf = 0; if (mine()) counter(); });
    }, { passive: true });

    async function showPdf() {
      let pdfjs, buf;
      try { [pdfjs, buf] = await Promise.all([loadPdfjs(), blob.arrayBuffer()]); } catch (e) { if (mine()) msg('Die Vorschau konnte nicht geladen werden.', 'Du kannst die Datei mit „Teilen/Sichern“ öffnen.'); return; }
      if (!mine()) return;
      let doc;
      try { s.task = pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useWorkerFetch: false, disableAutoFetch: true }); doc = await s.task.promise; } catch (e) {
        if (!mine()) return;
        if (e && e.name === 'PasswordException') msg('Dieses PDF ist passwortgeschützt.', 'Du kannst es mit „Teilen/Sichern“ in einer anderen App öffnen.');
        else msg('Dieses PDF lässt sich nicht anzeigen.', 'Es ist vielleicht beschädigt. Du kannst es mit „Teilen/Sichern“ in einer anderen App öffnen.');
        return;
      }
      if (!mine()) return;
      s.doc = doc;
      // Seitengrößen vorab: so ändert sich die Höhe einer Seite nie nachträglich (sonst springt der Ausschnitt, z. B. bei Querformatseiten)
      const all = await Promise.all(Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1).catch(() => null)));
      if (!mine()) return;
      const v0 = (all.find(Boolean) || { getViewport: () => ({ width: 595, height: 842 }) }).getViewport({ scale: 1 });
      const wrap = document.createElement('div'); wrap.className = 'vv-pages';
      const pz = document.createElement('div'); pz.className = 'vv-pz'; wrap.appendChild(pz);
      s.io = new IntersectionObserver(es => {
        es.forEach(en => { en.target.__p.vis = en.isIntersecting; });
        if (!busy()) sync();   // während Geste/Federn nichts zeichnen oder freigeben – das holt settle() nach
      }, { root: sc, rootMargin: '100% 50%' });
      all.forEach((page, i) => {
        const v1 = page ? page.getViewport({ scale: 1 }) : v0;
        const el = document.createElement('div'); el.className = 'vv-page'; el.style.aspectRatio = v1.width + ' / ' + v1.height;
        const p = { el, n: i + 1, page, v1, vis: false, have: 0, pend: 0, cv: null, det: null, dr: null }; el.__p = p;
        s.pages.push(p); pz.appendChild(el);
      });
      sc.innerHTML = ''; sc.appendChild(wrap); s.lay = wrap; s.tf = pz; layout();
      s.pages.forEach(p => { s.io.observe(p.el); });
      counter();
    }

    if (kind === 'image') showImage(); else showPdf();
  }

  VA.view = view; VA.closeView = close;
})();
