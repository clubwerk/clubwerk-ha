'use strict';
/* Betrachter der Mitglieder-App für PDFs und Bilder: ein Vollbild-Blatt, alles bleibt in der App (nie ein neues Fenster, nie Safari).
   Wird erst beim ersten Öffnen einer Datei geladen (ctx.view in app.js); PDF.js (lokal, public/app/pdfjs/) erst beim ersten PDF.
   Seiten und Bilder füllen die Breite, Zoom per Zwei-Finger-Geste, Doppeltippen, +/– und Strg+Mausrad. PDF-Seiten werden erst beim
   Heranscrollen gezeichnet. Links und Skripte in PDFs bleiben wirkungslos (keine Anmerkungsebene, kein Scripting). */
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
      .vv-bar { flex: none; padding: calc(10px + env(safe-area-inset-top)) calc(14px + env(safe-area-inset-right)) 10px calc(14px + env(safe-area-inset-left)); border-bottom: 1px solid var(--line); background: var(--card); }
      .vv-bar h2 { margin: 0; font-size: 16px; line-height: 1.3; min-width: 0; flex: 1; overflow-wrap: anywhere; }
      .vv-row { display: flex; align-items: center; gap: 8px; }
      .vv-row + .vv-row { margin-top: 8px; }
      .vv-bar button { flex: none; min-height: 44px; min-width: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
      .vv-bar button.ok { background: var(--brand); border-color: var(--brand); color: var(--on-brand, #fff); }
      .vv-bar button:disabled { opacity: .45; }
      .vv-bar button.vv-z { font-size: 22px; line-height: 1; padding: 0; width: 44px; }
      .vv-pg { flex: 1; min-width: 0; font-size: 14px; color: var(--muted); font-variant-numeric: tabular-nums; }
      .vv-scroll { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y; background: var(--hover); padding-bottom: env(safe-area-inset-bottom); }
      .vv-scroll:focus-visible { outline: 3px solid var(--brand); outline-offset: -3px; }
      .vv-pages { display: flex; flex-direction: column; gap: 6px; margin: 0; }
      .vv-page { position: relative; width: 100%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
      .vv-page canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      .vv-img { min-width: 100%; min-height: 100%; display: flex; }
      .vv-img img { margin: auto; display: block; flex: none; max-width: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      .vv-msg { margin: 0; padding: 28px 20px; text-align: center; font-size: 15px; line-height: 1.5; color: var(--muted); overflow-wrap: anywhere; }
      .vv-msg b { display: block; color: var(--ink); margin-bottom: 6px; font-size: 16px; }`;
    document.head.appendChild(s);
  }

  /* ---------- PDF.js erst beim ersten PDF ---------- */
  let pdfjsP = null;
  const loadPdfjs = () => pdfjsP || (pdfjsP = import(asset('pdfjs/pdf.min.mjs')).then(m => { m.GlobalWorkerOptions.workerSrc = asset('pdfjs/pdf.worker.min.mjs'); return m; }).catch(e => { pdfjsP = null; throw e; }));

  const MAXZ = 4, MAXPX = 12e6;   // MAXPX: größte Zeichenfläche je Seite (iPhone-Safari bricht bei sehr großen Flächen ab)
  let st = null;   // der gerade offene Betrachter

  function close() {
    if (!st) return;
    const s = st; st = null;
    document.removeEventListener('keydown', s.onKey, true);
    window.removeEventListener('resize', s.onResize);
    s.io && s.io.disconnect();
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
    if (!sheet) { sheet = document.createElement('div'); sheet.id = 'cwViewer'; sheet.className = 'vh-sheet vh-viewer'; }
    document.body.appendChild(sheet);   // immer zuoberst
    sheet.innerHTML = `<div class="vh-box"><div class="vv-bar">
        <div class="vv-row"><h2 translate="no">${esc(name)}</h2><button type="button" class="ok" id="vvX">Schließen</button></div>
        <div class="vv-row"><span class="vv-pg" id="vvPg" role="status" aria-live="polite"></span>
          <button type="button" class="vv-z" id="vvMin" aria-label="Verkleinern">−</button><button type="button" class="vv-z" id="vvPlus" aria-label="Vergrößern">+</button>
          <button type="button" id="vvSave">Teilen/Sichern</button></div></div>
      <div class="vv-scroll" id="vvScroll" tabindex="0" role="region" aria-label="Dokument"><p class="vv-msg" role="status">Wird geladen …</p></div></div>`;
    const $ = id => sheet.querySelector('#' + id);
    const sc = $('vvScroll');
    const s = st = { sheet, sc, z: 1, doc: null, task: null, url: '', io: null, pages: [], back: document.activeElement, img: null, ratio: 1 };
    const mine = () => st === s;
    sheet.classList.add('show');
    $('vvX').onclick = close;
    $('vvSave').onclick = () => save(blob, name);
    $('vvMin').onclick = () => zoomBy(1 / 1.5); $('vvPlus').onclick = () => zoomBy(1.5);
    $('vvX').focus({ preventScroll: true });

    const msg = (title, text) => { sc.innerHTML = `<p class="vv-msg" role="alert"><b>${esc(title)}</b>${esc(text)}</p>`; $('vvMin').disabled = $('vvPlus').disabled = true; };

    /* ----- Zoom: die Inhaltsbreite wächst, der Blickpunkt (cx, cy in Anzeigekoordinaten) bleibt stehen ----- */
    const content = () => (s.img ? s.img : s.wrap);
    const base = () => {   // Breite bei Zoom 1: PDF = Anzeigebreite, Bild = so groß wie möglich ohne Abschneiden
      if (!s.img) return sc.clientWidth;
      return Math.max(1, Math.min(sc.clientWidth, sc.clientHeight * s.ratio));
    };
    const layout = () => { const w = base() * s.z; if (s.img) { s.img.style.width = w + 'px'; } else if (s.wrap) { s.wrap.style.width = w + 'px'; } };
    /* Ankerpunkt = Stelle im Inhalt (Anteil von Breite/Höhe des Bildes bzw. der Seitenfolge) unter (cx, cy); nach dem Vergrößern wird so gescrollt, dass er wieder dort liegt.
       Gemessen wird am sichtbaren Inhalt selbst (nicht an dessen Umgebung): das Bild steht im Querformat mittig mit Leerraum darüber und darunter. */
    const part = v => Math.max(0, Math.min(1, v));
    const anchorAt = (cx, cy) => { const b = content().getBoundingClientRect(); return { fx: part((cx - b.left) / Math.max(1, b.width)), fy: part((cy - b.top) / Math.max(1, b.height)) }; };
    const place = (a, cx, cy) => { const b = content().getBoundingClientRect(); sc.scrollLeft += b.left + a.fx * b.width - cx; sc.scrollTop += b.top + a.fy * b.height - cy; };
    function setZoom(z, cx, cy, a) {
      z = Math.max(1, Math.min(MAXZ, z)); if (!content() || Math.abs(z - s.z) < 0.001) return;
      if (cx == null) { const r = sc.getBoundingClientRect(); cx = r.left + sc.clientWidth / 2; cy = r.top + sc.clientHeight / 2; }   // „+“/„–“: um die Mitte des Ausschnitts
      a = a || anchorAt(cx, cy);
      s.z = z; layout(); place(a, cx, cy);
      $('vvMin').disabled = z <= 1.001; $('vvPlus').disabled = z >= MAXZ - 0.001;
      clearTimeout(s.rz); s.rz = setTimeout(() => { if (mine()) redraw(); }, 160);   // erst nach der Geste scharf nachzeichnen
    }
    const zoomBy = f => setZoom(s.z * f);
    s.onResize = () => { if (mine()) { layout(); redraw(); } };
    window.addEventListener('resize', s.onResize);

    /* ----- Eingaben ----- */
    let pinch = null, tap = null;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = t => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    sc.addEventListener('touchstart', e => { if (e.touches.length === 2 && content()) { const m = mid(e.touches); pinch = { d: dist(e.touches), z: s.z, a: anchorAt(m.x, m.y), x: m.x, y: m.y }; tap = null; } }, { passive: true });
    sc.addEventListener('touchmove', e => {
      if (!pinch || e.touches.length !== 2) return;
      if (e.cancelable) e.preventDefault();
      const m = mid(e.touches); pinch.x = m.x; pinch.y = m.y;
      const z = Math.max(1, Math.min(MAXZ, pinch.z * dist(e.touches) / pinch.d));
      if (Math.abs(z - s.z) < 0.001) place(pinch.a, m.x, m.y); else setZoom(z, m.x, m.y, pinch.a);   // Anker bleibt unter den Fingern, auch beim Verkleinern und Verschieben
    }, { passive: false });
    sc.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; }, { passive: true });
    sc.addEventListener('scroll', () => { if (pinch && content()) place(pinch.a, pinch.x, pinch.y); }, { passive: true });   // iOS schiebt mitunter nativ nach: Anker wieder unter die Finger
    sc.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); setZoom(s.z * Math.exp(-e.deltaY / 200), e.clientX, e.clientY); } }, { passive: false });
    // Doppeltippen / Doppelklick: auf 2,5-fach, noch einmal: zurück
    sc.addEventListener('pointerdown', e => { s.down = { x: e.clientX, y: e.clientY }; });
    sc.addEventListener('pointerup', e => {
      if (!s.down || Math.hypot(e.clientX - s.down.x, e.clientY - s.down.y) > 10 || pinch) { s.down = null; return; }
      const now = Date.now();
      if (tap && now - tap.t < 320 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 30) { tap = null; setZoom(s.z > 1.2 ? 1 : 2.5, e.clientX, e.clientY); } else tap = { t: now, x: e.clientX, y: e.clientY };
      s.down = null;
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
      img.onload = () => { if (!mine()) return; s.ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1); const w = document.createElement('div'); w.className = 'vv-img'; w.appendChild(img); sc.innerHTML = ''; sc.appendChild(w); s.img = img; layout(); };
      img.onerror = () => { if (mine()) msg('Das Bild lässt sich nicht anzeigen.', 'Du kannst es mit „Teilen/Sichern“ speichern.'); };
      img.src = s.url;
    }

    /* ----- PDF ----- */
    let queue = Promise.resolve();
    const ratioOf = pg => { const v = pg.getViewport({ scale: 1 }); return v.width / v.height; };
    const redraw = () => { if (s.pages.length) s.pages.forEach(p => { if (p.vis) draw(p); }); };
    function draw(p) {
      const k = Math.round(p.el.clientWidth);   // gezeichnet wird je Breite einmal
      if (!k || p.drawn === k) return;
      p.drawn = k;
      queue = queue.then(async () => {
        if (!mine() || !p.vis || p.drawn !== k) return;
        if (!p.page) { try { p.page = await s.doc.getPage(p.n); } catch (e) { p.drawn = 0; return; } p.el.style.aspectRatio = String(ratioOf(p.page)); if (!mine()) return; }
        const vp1 = p.page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        let scale = k * dpr / vp1.width;
        const px = vp1.width * vp1.height * scale * scale; if (px > MAXPX) scale *= Math.sqrt(MAXPX / px);
        const vp = p.page.getViewport({ scale });
        const cv = document.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        try { await p.page.render({ canvas: cv, canvasContext: cv.getContext('2d'), viewport: vp, background: '#ffffff' }).promise; } catch (e) { if (p.drawn === k) p.drawn = 0; return; }
        if (!mine()) return;
        if (p.cv) p.cv.remove(); p.cv = cv; p.el.appendChild(cv);
      }).catch(() => {});
    }
    const pageNo = () => {
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) return s.pages.length;   // ganz unten: letzte Seite
      const mid = sc.scrollTop + sc.clientHeight / 3; let n = 1;
      s.pages.forEach((p, i) => { if (p.el.offsetTop <= mid) n = i + 1; });
      return n;
    };
    const counter = () => { if (s.pages.length) $('vvPg').textContent = tx('Seite {0} von {1}', [pageNo(), s.pages.length]); };
    sc.addEventListener('scroll', () => { if (!s.pages.length || s.raf) return; s.raf = requestAnimationFrame(() => { s.raf = 0; if (mine()) counter(); }); }, { passive: true });

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
      const wrap = document.createElement('div'); wrap.className = 'vv-pages'; s.wrap = wrap;
      const first = await doc.getPage(1); if (!mine()) return;
      const r1 = ratioOf(first);
      s.io = new IntersectionObserver(es => {
        es.forEach(en => {
          const p = en.target.__p; p.vis = en.isIntersecting;
          if (p.vis) draw(p); else { p.drawn = 0; if (p.cv) { p.cv.width = p.cv.height = 0; p.cv.remove(); p.cv = null; } }   // weit weg: Speicher freigeben
        });
      }, { root: sc, rootMargin: '120% 0px' });
      for (let i = 1; i <= doc.numPages; i++) {
        const el = document.createElement('div'); el.className = 'vv-page'; el.style.aspectRatio = String(r1);
        const p = { el, n: i, page: i === 1 ? first : null, vis: false, drawn: 0, cv: null }; el.__p = p;
        s.pages.push(p); wrap.appendChild(el);
      }
      sc.innerHTML = ''; sc.appendChild(wrap); layout();
      s.pages.forEach(p => { s.io.observe(p.el); });
      counter();
    }

    if (kind === 'image') showImage(); else showPdf();
  }

  VA.view = view; VA.closeView = close;
})();
