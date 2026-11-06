/* Unterschriftsfeld (Finger/Stift) für Verwaltung und Tablet – gleiches Aussehen und Verhalten wie im Beitrittsformular.
   CWSign.field({ id, label, hint }) → HTML (Titelzeile mit „Löschen“, Feld mit Linie und „✕“)
   CWSign.mount(box) → { ok(), png(), clear() } für das Feld .sg-pad in box; Prüfung am Server: ctx.util.sigOk */
(() => {
  if (window.CWSign) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = document.createElement('style');
  css.textContent = `
.sg { display: flex; flex-direction: column; gap: 8px; }
.sg + .sg { margin-top: 14px; }
.sg-h { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-weight: 700; }
.sg-h .sg-clr { height: 40px; padding: 0 14px; border-radius: var(--r-ctl, 10px); border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; font-weight: 600; cursor: pointer; }
.sg-pad { --pad-ink: #5b6660; position: relative; height: 170px; border: 2px dashed var(--line); border-radius: 16px; background: #fff; touch-action: none; overflow: hidden; }
.sg-pad canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.sg-pad .sg-line { position: absolute; left: 24px; right: 24px; bottom: 44px; border-bottom: 1px solid var(--pad-ink); pointer-events: none; }
.sg-pad .sg-x { position: absolute; left: 24px; bottom: 50px; color: var(--pad-ink); font-size: 22px; pointer-events: none; }
.sg-pad .sg-ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--pad-ink); font-size: 16px; pointer-events: none; }
.sg-pad.signed .sg-ph { display: none; }
.sg-pad, .sg-pad * { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
html.sg-zeichnet, html.sg-zeichnet * { user-select: none !important; -webkit-user-select: none !important; -webkit-touch-callout: none !important; cursor: crosshair; }`;
  document.head.appendChild(css);

  const field = ({ id, label, hint }) => `<div class="sg"><div class="sg-h"><span>${esc(label)}</span><button type="button" class="sg-clr" data-sg-clr="${esc(id)}">Löschen</button></div>
    <div class="sg-pad" id="${esc(id)}"><canvas></canvas><span class="sg-line"></span><span class="sg-x">✕</span><span class="sg-ph">${esc(hint || 'Hier unterschreiben')}</span></div></div>`;

  function mount(box) {
    const cv = box.querySelector('canvas');
    const ctx = cv.getContext('2d');
    let drawing = false, strokes = 0, last = null, len = 0;
    const size = () => { const r = box.getBoundingClientRect(); const d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; };
    size();
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const html = document.documentElement;
    // Beim Zeichnen darf nirgends Text markiert werden (Maus am Rechner, Stift, Finger): Auswahl leeren und für die Dauer sperren
    ['mousedown', 'selectstart', 'dragstart', 'contextmenu'].forEach(ev => cv.addEventListener(ev, e => e.preventDefault()));
    cv.addEventListener('pointerdown', e => { e.preventDefault(); html.classList.add('sg-zeichnet'); try { window.getSelection().removeAllRanges(); } catch (x) { /* ohne Auswahl */ } cv.setPointerCapture(e.pointerId); drawing = true; last = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); });
    cv.addEventListener('pointermove', e => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); len += Math.hypot(p.x - last.x, p.y - last.y); last = p; if (len > 40) box.classList.add('signed'); });
    const end = () => { html.classList.remove('sg-zeichnet'); if (drawing) { drawing = false; strokes++; } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('pointerleave', end);
    const pad = {
      clear() { ctx.clearRect(0, 0, cv.width, cv.height); strokes = 0; len = 0; box.classList.remove('signed'); },
      ok: () => strokes > 0 && len > 60,
      /** als PNG (weißer Hintergrund, auf 600 px Breite verkleinert) */
      png() {
        const w = 600, h = Math.round(600 * cv.height / cv.width);
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        const c = o.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(cv, 0, 0, w, h);
        return o.toDataURL('image/png');
      },
    };
    const root = box.closest('.sg');
    const clr = root && root.querySelector('[data-sg-clr]');
    if (clr) clr.onclick = () => pad.clear();
    return pad;
  }
  window.CWSign = { field, mount };
})();
