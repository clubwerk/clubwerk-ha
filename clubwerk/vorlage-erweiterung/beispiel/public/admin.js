'use strict';
/* Verwaltungsseite: window.GK stellt die Hilfen der Verwaltung bereit (api, dialog, toast, esc, euro, deTime, …). */
(() => {
  const GK = window.GK;
  const api = (url, method, body) => GK.api('x/beispiel/' + url, method, body);
  GK.registerPage({
    key: 'beispiel', title: 'Beispiel', perm: 'beispiel',
    render: async () => {
      const rows = await api('notizen');
      GK.$('main').innerHTML = `<h2 class="page">Beispiel</h2>
        <div class="card"><div class="row"><label class="f" style="flex:1">Neue Notiz<input id="bxT" maxlength="200"></label><button class="btn primary" id="bxAdd">Speichern</button></div></div>
        <div class="card"><table class="tbl"><tr><th>Notiz</th><th>angelegt</th></tr>
          ${rows.map(r => `<tr><td>${GK.esc(r.text)}</td><td>${GK.deTime(r.created_at)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Noch keine.</td></tr>'}</table></div>`;
      GK.$('bxAdd').onclick = async () => {
        try { await api('notizen', 'POST', { text: GK.$('bxT').value }); GK.toast('Gespeichert.'); GK.RENDER.beispiel(); } catch (e) { GK.fail(e); }
      };
    },
  });
})();
