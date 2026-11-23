'use strict';
/* „Ausweise prüfen“ in der Mitglieder-App („Meine Daten“ › „Prüfen“, nur mit dem Schalter „Ausweise prüfen“ – Entscheidung 22.11.2026).
   Lesen: Kamera (nur über https oder localhost) mit BarcodeDetector, sonst jsQR (jsqr.min.js, lädt erst, wenn die Kamera startet).
   Bewusst keine Eingabe der Mitgliedsnummer – sonst ließen sich Foto und Name beliebiger Mitglieder abrufen. Die Kamera geht von selbst aus,
   sobald die Ansicht weg ist.
   Das Ergebnis steht groß mit Symbol und Text da (nie nur Farbe) und wird angesagt (aria-live). Gespeichert wird keine Prüfung.
   AusweisPruefen.mount(el, { post(body) → Promise<Ergebnis>, base: Adresse des Modulordners, box: Klasse der Kästen, btn: Klasse der Hauptknöpfe }) → stop() */
(() => {
  if (!document.getElementById('awpStyle')) {
    const s = document.createElement('style'); s.id = 'awpStyle';
    s.textContent = `
      .awp { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
      .awp > * { margin: 0; min-width: 0; }
      .awp h3 { margin: 0 0 12px; font-size: 18px; line-height: 24px; font-weight: 800; }
      .awp-cam { position: relative; aspect-ratio: 4 / 3; border-radius: 16px; overflow: hidden; background: var(--hover); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; }
      .awp-cam video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .awp-cam .awp-frame { position: absolute; width: 46%; aspect-ratio: 1; border: 3px solid #fff; border-radius: 18px; box-shadow: 0 0 0 2px rgba(0,0,0,.35); pointer-events: none; }
      .awp-cam .awp-camtxt { position: relative; padding: 16px; text-align: center; color: var(--muted); font-size: 15px; line-height: 22px; max-width: 420px; }
      .awp-note { margin: 12px 0 0; color: var(--muted); font-size: 14.5px; line-height: 21px; }
      .awp-btns { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0 0; }
      .awp-res { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-radius: 16px; font-size: 24px; line-height: 30px; font-weight: 800; margin: 0 0 16px; }
      .awp-res svg { width: 34px; height: 34px; flex: none; }
      .awp-res small { display: block; font-size: 14.5px; line-height: 20px; font-weight: 600; }
      .awp-res.g { background: var(--brand-soft); color: var(--brand-ink); } .awp-res.a { background: var(--amber-soft); color: var(--amber); } .awp-res.r { background: var(--red-soft); color: var(--red); }
      .awp-res.n { background: var(--hover); color: var(--muted); font-size: 17px; line-height: 24px; font-weight: 700; }
      .awp-who { display: flex; gap: 16px; align-items: center; margin: 0 0 14px; }
      .awp-who img, .awp-who .awp-ini { width: 112px; height: 112px; border-radius: 20px; object-fit: cover; flex: none; background: var(--brand-soft); }
      .awp-ini { display: flex; align-items: center; justify-content: center; color: var(--brand-ink); font-size: 34px; font-weight: 800; }
      .awp-who > div > b { display: block; font-size: 24px; line-height: 30px; font-weight: 800; color: var(--ink); overflow-wrap: anywhere; }
      .awp-who > div > span { display: block; color: var(--muted); font-size: 15px; line-height: 22px; margin-top: 4px; }
      .awp-rows > div { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 15.5px; }
      .awp-rows > div:first-child { border-top: 0; }
      .awp-rows > div > span { color: var(--muted); } .awp-rows > div > b { text-align: right; overflow-wrap: anywhere; }
`;
    document.head.appendChild(s);
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const deD = s => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '');
  const SVG = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const OK = SVG('<circle cx="12" cy="12" r="9.5"/><path d="m7.5 12.5 3 3 6-6.5"/>'), NO = SVG('<circle cx="12" cy="12" r="9.5"/><path d="m8.5 8.5 7 7M15.5 8.5l-7 7"/>'), WARN = SVG('<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4.5M12 17.5v.01"/>');
  const ini = n => { const p = String(n || '').split(','); const w = `${p[1] || ''} ${p[0] || ''}`.trim().split(/\s+/); return ((w[0] || '?')[0] + ((w.length > 1 && w[w.length - 1][0]) || '')).toUpperCase(); };

  /** Ergebnis als HTML (nur angezeigte Felder kommen vom Server) */
  function result(r) {
    const row = (k, v) => (v ? `<div><span>${k}</span><b>${v}</b></div>` : '');
    const who = (photo, sub) => `<div class="awp-who">${photo ? `<img src="${esc(photo)}" alt="Foto">` : `<span class="awp-ini" aria-hidden="true">${esc(ini(r.name))}</span>`}<div><b translate="no">${esc(r.name)}</b>${sub ? `<span>${sub}</span>` : ''}</div></div>`;
    if (r.result === 'ok') {
      const sub = [r.no ? `Nr. ${esc(r.no)}` : '', r.since ? esc(T('Mitglied seit {0}', [r.since])) : ''].filter(Boolean).join(' · ');
      return `<div class="awp-res g">${OK}<span>Gültig</span></div>${who(r.photo, sub)}
        <div class="awp-rows">${row('Status', esc(T(r.status)) + (r.age ? ` · <span translate="no">${esc(r.age)}</span>` : ''))}${row('Abteilungen', r.depts && r.depts.length ? `<span translate="no">${r.depts.map(esc).join(', ')}</span>` : '')}${row('Gültig bis', deD(r.valid_until))}${row('Ausweis ausgestellt', deD(r.issued_at))}</div>
        <p class="awp-note">${r.photo ? 'Stimmt das Foto mit der Person überein? Erst dann gilt der Ausweis.' : 'Kein Foto auf dem Ausweis – bei Bedarf einen Lichtbildausweis zeigen lassen.'}</p>`;
    }
    if (r.result === 'abgelaufen') return `<div class="awp-res a">${WARN}<span>Abgelaufen<small>${esc(T('Gültig bis {0}', [deD(r.valid_until)]))}</small></span></div>${r.name ? who(null, '') : ''}<p class="awp-note">Der Code ist älter als 30 Tage oder das Beitragsjahr ist vorbei. Das Mitglied öffnet die App einmal mit Netz, dann gibt es einen neuen Code.</p>`;
    if (r.result === 'beendet') return `<div class="awp-res r">${NO}<span>Nicht mehr Mitglied${r.exit_date ? `<small>${esc(T('Mitgliedschaft beendet am {0}', [deD(r.exit_date)]))}</small>` : ''}</span></div>${r.name ? who(null, '') : ''}`;
    if (r.result === 'gesperrt') return `<div class="awp-res r">${NO}<span>Ausweis gesperrt</span></div><p class="awp-note">Dieser Ausweis wurde in der Verwaltung gesperrt, etwa nach einem verlorenen Handy. Das Mitglied öffnet die App mit Netz, dann bekommt es einen neuen.</p>`;
    return `<div class="awp-res r">${NO}<span>Ungültiger Code</span></div><p class="awp-note">Das ist kein Mitgliedsausweis dieses Vereins, oder der Code ist beschädigt.</p>`;
  }

  function mount(el, { post, base, box = 'card', btn = 'btn primary' }) {
    const secure = window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    el.innerHTML = `<div class="awp"><div class="${box}"><h3>QR-Code vor die Kamera halten</h3>
        <div class="awp-cam" id="awpCam"><p class="awp-camtxt" id="awpCamTxt">${secure ? 'Die Kamera startet mit dem Knopf darunter.' : 'Die Kamera geht nur, wenn die App über https geöffnet ist. Bitte die App über die Adresse des Vereins öffnen.'}</p></div>
        <div class="awp-btns">${secure ? `<button type="button" class="${btn}" id="awpStart">Kamera starten</button>` : ''}</div>
        <p class="awp-note">Gültig ist nur der Code aus der App des Mitglieds – mit laufender Uhr. Eine Mitgliedsnummer lässt sich hier bewusst nicht eintippen.</p></div>
      <div class="${box}" id="awpOut" aria-live="polite"><div class="awp-res n">Noch kein Ausweis geprüft.</div></div></div>`;
    const $ = id => el.querySelector('#' + id);
    let stream = null, timer = null, busy = false, detector = null, alive = true;
    const stopCam = () => { clearTimeout(timer); timer = null; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; const v = el.querySelector('video'); if (v) v.remove(); const f = el.querySelector('.awp-frame'); if (f) f.remove(); };
    const show = async body => {
      if (busy) return; busy = true;
      const out = $('awpOut');
      try { const r = await post(body); stopCam(); out.innerHTML = result(r) + `<div class="awp-btns"><button type="button" class="${btn}" id="awpNext">Nächsten Ausweis prüfen</button></div>`; if (out.scrollIntoView) out.scrollIntoView({ block: 'nearest' }); out.querySelector('#awpNext').onclick = () => { out.innerHTML = '<div class="awp-res n">Noch kein Ausweis geprüft.</div>'; if (secure) start(); }; }
      catch (e) { out.innerHTML = `<div class="awp-res r">${NO}<span>${esc(e.message)}</span></div>`; }
      finally { busy = false; }
    };
    const loadJsQR = () => (window.jsQR ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = base + 'jsqr.min.js'; s.onload = res; s.onerror = () => rej(new Error('Der QR-Leser konnte nicht geladen werden.')); document.head.appendChild(s); }));
    async function start() {
      if (!alive || stream) return;
      const txt = $('awpCamTxt');
      try {
        if ('BarcodeDetector' in window) { try { const f = await window.BarcodeDetector.getSupportedFormats(); if (f.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detector = null; } }
        if (!detector) await loadJsQR();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!alive) { stopCam(); return; }
        const v = document.createElement('video'); v.setAttribute('playsinline', ''); v.muted = true; v.srcObject = stream;
        const cam = $('awpCam'); cam.prepend(v); cam.insertAdjacentHTML('beforeend', '<span class="awp-frame" aria-hidden="true"></span>');
        if (txt) txt.textContent = '';
        await v.play();
        const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
        const scan = async () => {
          if (!el.isConnected) { stop(); return; }   // Seite gewechselt: Kamera aus
          if (!stream || !alive) return;
          try {
            let code = null;
            if (detector) { const r = await detector.detect(v); code = r[0] && r[0].rawValue; }
            else if (v.videoWidth) { const w = Math.min(640, v.videoWidth), h = Math.round(v.videoHeight * w / v.videoWidth); cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h); const r = window.jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' }); code = r && r.data; }
            if (code) { show({ code }); return; }
          } catch (e) { /* ein Bild ging nicht – nächstes */ }
          timer = setTimeout(scan, 200);
        };
        scan();
      } catch (e) {
        stopCam();
        if (txt) txt.textContent = e && e.name === 'NotAllowedError' ? 'Die Kamera ist für diese Seite nicht erlaubt. Bitte in den Einstellungen des Browsers erlauben.' : (e && e.message) || 'Die Kamera lässt sich nicht starten.';
      }
    }
    if ($('awpStart')) $('awpStart').onclick = start;
    function stop() { alive = false; stopCam(); }
    return stop;
  }
  window.AusweisPruefen = { mount, result };
})();
