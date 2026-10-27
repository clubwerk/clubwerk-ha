'use strict';
/* Bereich „Türen“ in der Mitglieder-App */
(() => {
  window.VA.registerSection({
    id: 'zugang',
    render(el, ctx) {
      const { esc } = ctx;
      el.innerHTML = `<div class="vh-status"><span class="vh-dot busy" id="zgDot"></span><span id="zgSt">Verbinde …</span></div>
        <div id="zgDoors" class="vh-tiles doors"></div><p class="vh-note" id="zgInfo"></p>`;
      let doors = [], timer = null, alive = true;
      async function refresh() {
        clearTimeout(timer);
        try {
          const v = await ctx.api('status');
          doors = v.doors;
          document.getElementById('zgDot').className = 'vh-dot ' + (v.online ? 'ok' : 'err');
          document.getElementById('zgSt').textContent = v.online ? 'Verbunden' : 'Keine Verbindung zu den Schlössern';
          document.getElementById('zgDoors').innerHTML = window.ZugangDoors.html(doors, esc, true);
          document.getElementById('zgInfo').innerHTML = v.profile ? `Zeitprofil „${esc(v.profile.name)}“: ${esc(v.profile.text)}${v.validUntil ? `<br>gültig bis ${esc(v.validUntil)}` : ''}` : '';
          el.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => go(b.dataset.d, b.dataset.a); });
        } catch (e) { if (!e.device) { document.getElementById('zgDot').className = 'vh-dot err'; document.getElementById('zgSt').textContent = e.message; } }
        if (alive) timer = setTimeout(refresh, 8000);
      }
      async function go(id, action) {
        const d = doors.find(x => x.id === id);
        try {
          const r = await ctx.withPin(`${d.name}: ${window.ZugangDoors.label(d, action)}`, pin => ctx.api('door', 'POST', { door: id, action, pin }));
          if (r) ctx.toast(`${d.name}: ${action === 'zu' ? (d.type === 'cover' ? 'wird geschlossen' : 'wird abgeschlossen') : 'wird geöffnet'}`);
        } catch (e) { ctx.toast(e.message, true, 5000); }
        setTimeout(refresh, 1200);
      }
      ctx.onLeave(() => { alive = false; clearTimeout(timer); });
      refresh();   // doors.js lädt die App vor member.js (erweiterung.json „skripte“)
    },
  });
})();
