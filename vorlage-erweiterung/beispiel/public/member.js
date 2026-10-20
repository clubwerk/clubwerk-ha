'use strict';
/* Bereich „Beispiel“ in der Mitglieder-App – nur Bausteine aus kit.css (Styleguide in ERWEITERUNGEN.md), kein eigenes CSS nötig.
   ctx.api(pfad) ruft /api/m/beispiel/<pfad>, ctx.esc maskiert Text, ctx.toast(text) zeigt kurz eine Meldung. */
(() => {
  window.VA.registerSection({
    id: 'beispiel',
    render(el, ctx) {
      const { esc } = ctx;
      const deD = s => { const d = new Date(s.replace(' ', 'T')); return { day: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`, wd: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()] }; };
      async function load() {
        let rows;
        try { rows = await ctx.api('notizen'); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        el.innerHTML = `<div class="vh-card"><h3>Notizen <small>${rows.length}</small></h3>
          ${rows.length ? `<div class="vh-rows">${rows.map(r => { const d = deD(r.created_at); return `<div><span class="vh-date"><b>${d.day}</b><span>${d.wd}</span></span>
            <span class="vh-tx"><strong>${esc(r.text)}</strong><small>Notiz Nr. ${r.id}</small></span><span class="vh-chip g">neu</span></div>`; }).join('')}</div>`
            : '<p class="vh-none">Noch keine Notizen.</p>'}</div>`;
      }
      el.innerHTML = '<div class="vh-empty">Lade …</div>';
      load();
    },
  });
})();
