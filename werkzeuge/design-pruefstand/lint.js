(opts) => {
  /* Design-Prüfstand: misst eine Ansicht und meldet Verstöße gegen die Clubwerk-Regeln.
     opts: { mark: bool, phone: bool } */
  const mark = opts && opts.mark, phone = opts && opts.phone;
  const out = [], vw = document.documentElement.clientWidth, vh = innerHeight;
  const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const visDeep = e => { const d = e.closest('details:not([open])'); if (d && !e.closest('summary')) return false; for (let q = e; q && q !== document.documentElement; q = q.parentElement) { const s = getComputedStyle(q); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity <= 0.05) return false; } return true; };
  const layer = e => { for (let q = e; q && q !== document.body; q = q.parentElement) { if (q.matches('dialog,.overlay,#overlay,[role=dialog],.vh-sheet')) return q; const p = getComputedStyle(q).position; if (p === 'fixed' || p === 'sticky') return q; } return null; };
  const desc = e => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; if (e.className && typeof e.className === 'string') s += '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.'); const p = e.parentElement; if (p && !e.id) { let ps = p.tagName.toLowerCase(); if (p.id) ps += '#' + p.id; else if (p.className && typeof p.className === 'string' && p.className.trim()) ps += '.' + p.className.trim().split(/\s+/)[0]; s = ps + ' > ' + s; } return s; };
  const txt = e => (e.innerText || e.value || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const ownText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
  const lines = e => { const s = getComputedStyle(e); const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3; return Math.round((e.getBoundingClientRect().height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom)) / lh); };
  const add = (rule, e, extra) => { if (out.length > 80) return; out.push({ rule, el: desc(e), text: txt(e), ...extra }); if (mark) { e.style.outline = '3px solid #e00'; e.style.outlineOffset = '1px'; } };
  const clipped = e => { let q = e.parentElement; while (q && q !== document.body) { if (/auto|scroll|hidden|clip/.test(getComputedStyle(q).overflowX)) return true; q = q.parentElement; } return false; };
  /* sichtbarer Ausschnitt: in scrollbaren/abgeschnittenen Bereichen zählt nur, was dort gerade zu sehen ist */
  const shown = e => { const r = e.getBoundingClientRect(); let L = r.left, T = r.top, R = r.right, B = r.bottom; for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) { const s = getComputedStyle(q); if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { const c = q.getBoundingClientRect(); if (s.overflowX !== 'visible') { L = Math.max(L, c.left); R = Math.min(R, c.right); } if (s.overflowY !== 'visible') { T = Math.max(T, c.top); B = Math.min(B, c.bottom); } } if (s.position === 'fixed') break; } return { left: L, top: T, right: R, bottom: B, width: R - L, height: B - T }; };
  const all = [...document.querySelectorAll('body *')].filter(e => !['SCRIPT', 'STYLE', 'OPTION', 'BR', 'TEMPLATE'].includes(e.tagName) && !(e instanceof SVGElement) && vis(e) && visDeep(e));
  const inLayer = e => e.closest('dialog,.modal,.sheet,.ov,.overlay,#overlay,.vh-ov,.pop,.menu-pop,[role=dialog]');

  /* 1) Seite breiter als der Bildschirm */
  if (document.documentElement.scrollWidth > vw + 1) out.push({ rule: 'ueberbreite', el: 'html', text: document.documentElement.scrollWidth + ' px statt ' + vw + ' px' });

  /* Farben für den Kontrast */
  const rgba = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = e => { let stack = []; for (let q = e; q; q = q.parentElement) { const s = getComputedStyle(q); if (s.backgroundImage && s.backgroundImage !== 'none') return null; const c = rgba(s.backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] >= 0.99) break; } } let base = stack.length && stack[stack.length - 1][3] >= 0.99 ? stack.pop() : [255, 255, 255, 1]; while (stack.length) { const c = stack.pop(); base = [0, 1, 2].map(i => c[i] * c[3] + base[i] * (1 - c[3])).concat(1); } return base; };

  for (const e of all) {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e), p = e.parentElement; if (!p) continue;
    const pr = p.getBoundingClientRect(), ps = getComputedStyle(p);
    /* 2) einzelner Text in mehrspaltigem Raster → enger Umbruch */
    if (!['BUTTON', 'A', 'LABEL'].includes(e.tagName) && ps.display.includes('grid') && ps.gridTemplateColumns.split(' ').length > 1 && ownText(e) && r.width < pr.width * 0.6 && lines(e) >= 2 && s.gridColumnEnd === 'auto' && [...p.children].filter(vis).length === 1) add('enger-umbruch', e, { w: Math.round(r.width), pw: Math.round(pr.width) });
    /* 3) Fließtext in sehr schmaler Spalte */
    else if (ownText(e) && !['TD', 'TH', 'BUTTON', 'LABEL', 'A'].includes(e.tagName) && !e.closest('td,th,button,.pill,.chip,.tk-tile,.vh-tile,.kpi') && lines(e) >= 3 && r.width < 300 && r.width < pr.width * 0.45 && pr.width > 400) add('schmale-spalte', e, { w: Math.round(r.width), pw: Math.round(pr.width) });
    /* 4) Text abgeschnitten, ohne dass das gewollt ist (… oder Zeilenbegrenzung) */
    if (ownText(e) && s.textOverflow !== 'ellipsis' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName) && s.webkitLineClamp === 'none' && !/auto|scroll/.test(s.overflowX)) {
      if (s.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 2) add('abgeschnitten', e, { sw: e.scrollWidth, cw: e.clientWidth });
      else if (s.overflowY === 'hidden' && e.scrollHeight > e.clientHeight + 3 && s.webkitLineClamp === 'none') add('abgeschnitten', e, { sh: e.scrollHeight, ch: e.clientHeight });
    }
    /* 4b) Text mit … gekürzt, obwohl es Platz gäbe? (nur melden, wenn sehr kurz sichtbar) */
    if (ownText(e) && s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 2 && e.clientWidth < 48) add('fast-leer-gekuerzt', e, { cw: e.clientWidth });
    /* 5) ragt aus dem Fenster */
    if (r.right > vw + 1 && s.position !== 'fixed' && !clipped(e)) add('ausserhalb', e, { right: Math.round(r.right), vw });
    /* 6) Kontrast: Text muss lesbar sein (WCAG AA 4,5:1, große Schrift 3:1) */
    if (ownText(e) && !e.closest('[disabled],.disabled,[aria-disabled=true]') && !e.matches(':disabled') && !['OPTION'].includes(e.tagName)) {
      const fg = rgba(s.color), bg = bgOf(e);
      if (fg && bg && fg[3] > 0.2) {
        const f = [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
        const L1 = lum(f), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const big = parseFloat(s.fontSize) >= 18.5 || (parseFloat(s.fontSize) >= 14 && +s.fontWeight >= 700);
        if (cr < (big ? 3 : 4.5)) add('kontrast', e, { cr: Math.round(cr * 100) / 100, fg: s.color, bg: 'rgb(' + bg.slice(0, 3).map(Math.round).join(',') + ')' });
      }
    }
    if (phone) {
      /* 7) iPhone zoomt beim Antippen in Felder unter 16 px hinein */
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName) && !['checkbox', 'radio', 'range', 'color', 'file', 'hidden', 'submit', 'button'].includes(e.type) && parseFloat(s.fontSize) < 16) add('ios-zoom', e, { fs: s.fontSize });
      /* 8) Tippflächen am Handy mindestens 32 px */
      const tap = e.tagName === 'BUTTON' || e.getAttribute('role') === 'button' || e.getAttribute('role') === 'switch' || (e.tagName === 'A' && s.display !== 'inline') || (['INPUT', 'SELECT'].includes(e.tagName) && !['checkbox', 'radio', 'hidden'].includes(e.type));
      if (tap && !e.closest('.tbl td')) {
        let R = r; const lab = e.closest('label'); if (['INPUT', 'SELECT'].includes(e.tagName) && lab && lab.querySelectorAll('input,select,textarea').length === 1) { const lr = lab.getBoundingClientRect(); if (lr.height < 80) R = lr; }
        if (['INPUT'].includes(e.tagName) && R === r && p.querySelectorAll('input,select,textarea').length === 1 && pr.height >= 32 && pr.height < 70 && /text/.test(getComputedStyle(p).cursor + s.cursor)) R = pr;
        const min = (e.classList.contains('switch') || e.getAttribute('role') === 'switch') ? 24 : 32;
        if (R.height < min || R.width < min) add('tippflaeche', e, { w: Math.round(R.width), h: Math.round(R.height) });
      }
    }
  }
  /* 9) Überlappungen zwischen Bedien-/Textelementen */
  const leaf = all.filter(e => shown(e).width > 2 && shown(e).height > 2 && (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'IMG', 'H1', 'H2', 'H3', 'H4', 'LABEL'].includes(e.tagName) || (ownText(e) && !e.querySelector('*'))) && getComputedStyle(e).position !== 'fixed' && !e.closest('.toast,.tip,[role=tooltip]'));
  const rs = leaf.map(e => shown(e));
  for (let i = 0; i < leaf.length; i++) for (let j = i + 1; j < leaf.length; j++) {
    const a = leaf[i], b = leaf[j]; if (a.contains(b) || b.contains(a)) continue;
    const A = rs[i], B = rs[j]; const w = Math.min(A.right, B.right) - Math.max(A.left, B.left), h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    /* Fließtext über mehrere Zeilen: Zeile für Zeile vergleichen, nicht das umschließende Rechteck */
    const inl = x => getComputedStyle(x).display === 'inline';
    if (w > 3 && h > 3 && (inl(a) || inl(b))) { const ra = [...a.getClientRects()], rb = [...b.getClientRects()]; if (!ra.some(p => rb.some(q => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 3 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 3))) continue; }
    if (w > 3 && h > 3 && w * h > 30) { if (layer(a) !== layer(b)) continue; add('ueberlappung', a, { mit: desc(b) + ' „' + txt(b).slice(0, 30) + '“' }); }
  }
  return out;
}
