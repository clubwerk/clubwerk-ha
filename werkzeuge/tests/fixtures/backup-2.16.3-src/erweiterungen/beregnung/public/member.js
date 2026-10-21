'use strict';
/* Bereich „Beregnung“ in der Mitglieder-App */
(() => {
  window.VA.registerSection({
    id: 'beregnung',
    render(el, ctx) {
      const { esc } = ctx;
      el.innerHTML = `<div class="vh-status"><span class="vh-dot busy" id="bgDot"></span><span id="bgSt">Verbinde …</span></div>
        <p class="vh-note hidden" id="bgNext"></p><div id="bgTiles" style="display:flex;flex-direction:column;gap:12px"></div>
        <button class="vh-stop" id="bgStop">■ Alle Zonen ausschalten</button>`;
      let pl = [], timer = null, alive = true, stopFree = false;
      const T = () => window.BeregnungTiles;
      const draw = () => {
        document.getElementById('bgTiles').innerHTML = T().html(pl, esc);
        el.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => run(+b.dataset.p); });
      };
      async function refresh() {
        clearTimeout(timer);
        try {
          const v = await ctx.api('status');
          pl = v.plaetze; stopFree = v.stopFree; T().prime(pl); draw();
          document.getElementById('bgDot').className = 'vh-dot ' + (v.online ? 'ok' : 'err');
          document.getElementById('bgSt').textContent = v.online ? 'Verbunden mit der Bewässerungsanlage' : 'Keine Verbindung zur Bewässerungsanlage';
          const n = document.getElementById('bgNext'); n.textContent = v.next ? `Nächste automatische Beregnung: ${v.next}` : ''; n.classList.toggle('hidden', !v.next);
          if (alive) timer = setTimeout(refresh, pl.some(p => p.state !== 'idle') ? 5000 : 20000);
        } catch (e) { if (alive) timer = setTimeout(refresh, 15000); }
      }
      async function run(id) {
        const p = pl.find(x => x.id === id);
        if (p.state !== 'idle') return ctx.toast(`${p.name} wird schon beregnet.`);
        if (p.blockedUntil) return ctx.toast(`${p.name} wurde gerade beregnet – wieder ab ${p.blockedUntil} Uhr.`);
        try {
          const r = await ctx.withPin(`${p.name} beregnen`, pin => ctx.api('run', 'POST', { platz: id, pin }));
          if (r) ctx.toast(`${p.name} ${r.waitSec > 0 ? 'eingeplant – startet in ' + T().fmt(r.waitSec) : 'gestartet'} · ${Math.round(r.totalSec / 60)} Min.`);
        } catch (e) { ctx.toast(e.message, true, 5000); }
        refresh();
      }
      document.getElementById('bgStop').onclick = async () => {
        try {
          const r = stopFree ? await ctx.api('stop', 'POST', {}) : await ctx.withPin('Alle Zonen ausschalten', pin => ctx.api('stop', 'POST', { pin }));
          if (r) ctx.toast('Alle Zonen ausgeschaltet');
        } catch (e) { ctx.toast(e.message, true, 5000); }
        refresh();
      };
      const iv = setInterval(() => { if (T() && T().tick(pl)) draw(); }, 1000);
      ctx.onLeave(() => { alive = false; clearTimeout(timer); clearInterval(iv); });
      if (window.BeregnungTiles) refresh(); else { const s = document.createElement('script'); s.src = 'm/beregnung/plaetze.js'; s.onload = refresh; document.body.appendChild(s); }
    },
  });
})();
