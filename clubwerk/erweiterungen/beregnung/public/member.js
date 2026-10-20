'use strict';
/* Bereich „Beregnung“ in der Mitglieder-App */
(() => {
  window.VA.registerSection({
    id: 'beregnung',
    render(el, ctx) {
      const { esc } = ctx;
      el.innerHTML = `<div class="vh-status"><span class="vh-dot busy" id="bgDot"></span><span id="bgSt">Verbinde …</span></div>
        <div id="bgTiles" style="display:flex;flex-direction:column;gap:12px"></div>
        <button class="vh-stop" id="bgStop">■ Alle Zonen ausschalten</button>`;
      let pl = [], timer = null, alive = true;
      const T = () => window.BeregnungTiles;
      const draw = () => {
        document.getElementById('bgTiles').innerHTML = T().html(pl, esc);
        el.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => run(+b.dataset.p); });
        el.querySelectorAll('[data-stop]').forEach(b => { b.onclick = e => { e.stopPropagation(); stopOne(+b.dataset.stop); }; });
      };
      async function refresh() {
        clearTimeout(timer);
        try {
          const v = await ctx.api('status');
          pl = v.plaetze; T().prime(pl); draw();
          document.getElementById('bgDot').className = 'vh-dot ' + (v.online ? 'ok' : 'err');
          document.getElementById('bgSt').textContent = v.online ? 'Verbunden mit der Bewässerungsanlage' : 'Keine Verbindung zur Bewässerungsanlage';
          if (alive) timer = setTimeout(refresh, pl.some(p => p.state !== 'idle') ? 5000 : 20000);
        } catch (e) { if (alive) timer = setTimeout(refresh, 15000); }
      }
      async function run(id) {
        const p = pl.find(x => x.id === id);
        if (p.state !== 'idle') return ctx.toast(`${p.name} wird schon beregnet.`);
        if (p.blockedUntil) return ctx.toast(`${p.name} wurde gerade beregnet – wieder ab ${p.blockedUntil} Uhr.`);
        try {
          let r;
          try { r = await ctx.api('run', 'POST', { platz: id }); }
          catch (e) { if (e.status !== 428 || !ctx.withPin) throw e; r = await ctx.withPin(`${p.name} starten`, pin => ctx.api('run', 'POST', { platz: id, pin })); }   // unterwegs: mit PIN
          if (r) ctx.toast(`${p.name} ${r.waitSec > 0 ? 'eingeplant – startet in ' + T().fmt(r.waitSec) : 'gestartet'} · ${Math.round(r.totalSec / 60)} Min.`);
        } catch (e) { ctx.toast(e.message, true, 5000); }
        refresh();
      }
      async function stopOne(id) {
        const p = pl.find(x => x.id === id);
        try { await ctx.api('stop', 'POST', { platz: id }); ctx.toast(`${p ? p.name : 'Platz'} gestoppt`); } catch (e) { ctx.toast(e.message, true, 5000); }
        refresh();
      }
      document.getElementById('bgStop').onclick = async () => {
        try {
          const r = await ctx.api('stop', 'POST', {});
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
