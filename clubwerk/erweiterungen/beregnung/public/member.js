'use strict';
/* Bereich „Beregnung“ in der Mitglieder-App */
(() => {
  window.VA.registerSection({
    id: 'beregnung',
    render(el, ctx) {
      const { esc } = ctx;
      el.innerHTML = `<div class="vh-status"><span class="vh-dot busy" id="bgDot"></span><span id="bgSt">Verbinde …</span></div>
        <div id="bgTiles" class="vh-tiles zones"></div>
        <button class="vh-stop hidden" id="bgStop">■ Alle Zonen ausschalten</button>`;
      let pl = [], timer = null, alive = true;
      const T = window.BeregnungTiles;   // plaetze.js lädt die App vor member.js (erweiterung.json „skripte“)
      const draw = () => {
        document.getElementById('bgTiles').innerHTML = T.html(pl, esc);
        el.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => run(+b.dataset.p); });
        el.querySelectorAll('[data-stop]').forEach(b => { b.onclick = e => { e.stopPropagation(); stopOne(+b.dataset.stop); }; });
      };
      async function refresh() {
        clearTimeout(timer);
        try {
          const v = await ctx.api('status');
          pl = v.plaetze; T.prime(pl); draw();
          document.getElementById('bgStop').classList.toggle('hidden', !pl.length);   // ohne Plätze kein Not-Aus
          document.getElementById('bgTiles').classList.toggle('offline', !v.online); document.getElementById('bgStop').disabled = !v.online && !v.throttle;
          const L = T.line(v); document.getElementById('bgDot').className = 'vh-dot ' + L.cls; document.getElementById('bgSt').textContent = L.text;
          if (alive) timer = setTimeout(refresh, pl.some(p => p.state !== 'idle') || v.throttle ? 5000 : 20000);
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
          if (r) ctx.toast(`${p.name} ${r.waitSec > 0 ? 'eingeplant – startet in ' + T.fmt(r.waitSec) : 'gestartet'} · ${Math.round(r.totalSec / 60)} Min.`);
        } catch (e) { ctx.toast(e.message, true, 5000); }
        refresh();
      }
      async function stopOne(id) {
        const p = pl.find(x => x.id === id);
        try { const r = await ctx.api('stop', 'POST', { platz: id }); ctx.toast(T.stopped(r, p ? p.name : 'Platz'), false, r && r.pendingSec ? 6000 : undefined); } catch (e) { ctx.toast(e.message, true, 5000); }
        refresh();
      }
      document.getElementById('bgStop').onclick = async () => {
        try {
          const r = await ctx.api('stop', 'POST', {});
          if (r) ctx.toast(r.pendingSec ? T.stopped(r) : 'Alle Zonen ausgeschaltet', false, r.pendingSec ? 6000 : undefined);
        } catch (e) { ctx.toast(e.message, true, 5000); }
        refresh();
      };
      const iv = setInterval(() => { if (T.tick(pl)) draw(); }, 1000);
      ctx.onLeave(() => { alive = false; clearTimeout(timer); clearInterval(iv); });
      refresh();
    },
  });
})();
