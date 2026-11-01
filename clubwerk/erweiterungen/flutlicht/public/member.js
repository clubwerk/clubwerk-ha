'use strict';
/* Bereich „Licht“ in der Mitglieder-App: nur im Vereins-WLAN, nur für freigeschaltete Mitglieder (prüft der Kern bzw. der Server) */
(() => {
  window.VA.registerSection({
    id: 'flutlicht',
    render(el, ctx) {
      const { esc } = ctx;
      const F = window.FlutlichtTiles;   // licht.js lädt die App vor member.js (erweiterung.json „skripte“)
      const euro = F.euro;
      const deD = d => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
      el.innerHTML = `<div class="vh-status"><span class="vh-dot busy" id="flDot"></span><span id="flSt">Verbinde …</span></div>
        <div id="flTiles" class="vh-tiles lights"></div><div id="flFee"></div><p class="vh-note">Schalten geht nur im WLAN des Vereinsheims. Das Licht geht von selbst wieder aus.</p>`;
      let v = null, timer = null, alive = true;
      const sheet = () => { let sh = document.getElementById('flSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'flSheet'; sh.className = 'vh-sheet vh-form'; document.body.appendChild(sh); } return sh; };
      const close = () => { const s = document.getElementById('flSheet'); if (s) s.classList.remove('show'); };
      async function refresh() {
        clearTimeout(timer);
        try {
          v = await ctx.api('status');
          const ok = v.online && v.wlan && v.app;
          document.getElementById('flDot').className = 'vh-dot ' + (ok ? 'ok' : 'err');
          document.getElementById('flSt').textContent = !v.online ? 'Keine Verbindung zum Flutlicht' : !v.wlan ? 'Schalten nur im WLAN des Vereinsheims'
            : !v.app ? 'Schalten in der App ist ausgeschaltet' : v.block ? `Im Vereins-WLAN · ${v.block}` : v.darkFrom ? `Im Vereins-WLAN · Licht ab ${v.darkFrom} Uhr, spätestens bis ${v.quiet} Uhr` : 'Im Vereins-WLAN';
          if (!ok) v.lights.forEach(l => { l.can = { on: false, extend: false, off: false }; });
          document.getElementById('flTiles').innerHTML = F.html(v.lights, esc, v.extendMin);
          document.getElementById('flFee').innerHTML = v.fee ? `<div class="vh-card"><h3>Lichtgeld</h3><p class="vh-lead">${euro(v.fee.cents)} je angefangene Viertelstunde ab ${v.fee.from} Uhr – kommt auf dein Konto.</p>
            ${v.mine.length ? `<div class="vh-rows">${v.mine.map(x => `<div><span class="vh-tx"><strong translate="no">${esc(deD(x.day))} ${esc(x.light)}</strong><small>${esc(x.from)}–${esc(x.to)} Uhr · ${x.auto ? 'deine Buchung' : 'eingeschaltet'}${x.status === 'storniert' ? ' · storniert' : ''}</small></span><b class="num">${euro(x.cents)}</b></div>`).join('')}</div>` : '<p class="vh-none">Noch kein Lichtgeld.</p>'}</div>` : '';
          el.querySelectorAll('[data-l]').forEach(b => { b.onclick = () => act(b.dataset.l, b.dataset.a); });
        } catch (e) { if (!e.device) { document.getElementById('flDot').className = 'vh-dot err'; document.getElementById('flSt').textContent = e.message; } }
        if (alive) timer = setTimeout(refresh, 15000);
      }
      async function send(id, action, minutes) {
        const l = v.lights.find(x => x.id === id);
        try {
          const r = await ctx.api('act', 'POST', { light: id, action, minutes });
          ctx.toast(action === 'off' ? (r.still ? `${l.name}: bleibt an bis ${r.still.slice(11, 16)} Uhr – noch gebucht.` : `${l.name}: ausgeschaltet`) : `${l.name}: an bis ${r.until.slice(11, 16)} Uhr`);
        } catch (e) { ctx.toast(e.message, true, 5000); }
        refresh();
      }
      function act(id, action) {
        if (action !== 'on') return send(id, action);
        const l = v.lights.find(x => x.id === id), list = F.durations(v.maxMin);
        let min = list.includes(60) ? 60 : list[list.length - 1];
        const sh = sheet();
        const draw = () => {
          const fee = F.estimate(v.fee, min);
          sh.innerHTML = `<div class="vh-box"><h2><span translate="no">${esc(l.name)}</span> einschalten</h2><p>Wie lange soll das Licht brennen?</p>
            <div class="vh-seg">${list.map(m => `<button type="button" data-m="${m}" class="${m === min ? 'on' : ''}">${m} Min.</button>`).join('')}</div>
            <p class="vh-small">Geht um ${F.hhmmIn(min)} Uhr von selbst aus.${v.fee ? (fee ? ` Lichtgeld: voraussichtlich ${euro(fee)} – abgerechnet wird, wie lange es wirklich brennt.` : ` Kein Lichtgeld vor ${v.fee.from} Uhr.`) : ''}</p>
            <div class="vh-row"><button class="no" id="flNo">Abbrechen</button><button class="ok" id="flOk">Einschalten</button></div></div>`;
          sh.querySelectorAll('[data-m]').forEach(b => { b.onclick = () => { min = +b.dataset.m; draw(); }; });
          document.getElementById('flNo').onclick = close;
          document.getElementById('flOk').onclick = () => { close(); send(id, 'on', min); };
        };
        draw(); sh.classList.add('show');
      }
      ctx.onLeave(() => { alive = false; clearTimeout(timer); close(); });
      refresh();
    },
  });
})();
