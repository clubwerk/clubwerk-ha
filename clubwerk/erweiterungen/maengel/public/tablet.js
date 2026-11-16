'use strict';
/* Tablet: Mangel melden – Namen wählen, Mitglieder-PIN (wie beim Verkauf), dann das Meldeformular aus member.js */
(() => {
  const $ = id => document.getElementById(id);
  const esc = CW.esc;
  const BASE = '../../api/tablet/';
  let state = { people: [] };
  const toast = GKTab.toast(5000);
  const call = (p, body) => GKTab.api(BASE + p, body);
  async function load() { try { state = await call('x/maengel/state'); } catch (e) { if (!e.gate) toast('Keine Verbindung zum Server.', true); } }

  const { dlg, closeDlg } = GKTab;
  $('overlay').addEventListener('mousedown', e => { if (e.target === $('overlay')) closeDlg(); });

  function pickName() {
    dlg(`<h2>Wer bist du?</h2><div class="sub">Mangel melden</div><input class="q" id="q" placeholder="Namen eingeben" autocomplete="off"><div class="vh-names" id="nm"></div><div class="dlg-btns"><button id="x">Abbrechen</button></div>`);
    const draw = () => {   // im Vereinsheim keine Namen vorschlagen – erst nach Eingabe (mind. 2 Buchstaben)
      const q = $('q').value.trim().toLowerCase();
      const hits = q.length < 2 ? [] : state.people.filter(p => p.name.toLowerCase().includes(q) || (p.ln || '').toLowerCase().includes(q)).slice(0, 30);
      $('nm').innerHTML = q.length < 2 ? '<div class="vh-names-hint">Bitte die ersten Buchstaben des Vor- oder Nachnamens eingeben.</div>' : hits.length ? hits.map(p => `<button data-p="${p.id}" translate="no"><span>${esc(p.ln || p.name)}</span></button>`).join('') : '<div class="vh-names-hint">Niemand gefunden – melden geht am Tablet nur mit PIN.</div>';
      $('nm').querySelectorAll('[data-p]').forEach(b => { b.onclick = () => unlock(state.people.find(p => p.id === +b.dataset.p)); });
    };
    draw(); $('q').oninput = draw; $('x').onclick = closeDlg; setTimeout(() => $('q').focus(), 50);
  }
  /** PIN wie beim Verkauf – ohne PIN geht Melden am Tablet nicht (die Liste enthält nur Konten mit PIN) */
  function unlock(p) {
    const go = async pin => {
      try { const r = await call('unlock', { memberId: p.id, pin }); closeDlg(); report(r.token); }
      catch (e) { if (e.gate) return closeDlg(); return e.message; }
    };
    GKPin.ask({ show: dlg, close: closeDlg, title: esc(p.ln || p.name), sub: 'Bitte deine PIN eingeben – Mangel melden', auto: true }, go);
  }
  /* Während das Formular offen ist, nicht nach 30 Sekunden zum Start-Reiter springen (Kamera, Tippen der Beschreibung) –
     höchstens 3 Minuten nach der letzten Eingabe, dann schließt es sich und das Tablet kehrt wie gewohnt zurück */
  let alive = null;
  function report(token) {
    const io = {
      places: () => Promise.resolve({ places: state.places || [] }),
      similar: b => call('x/maengel/aehnlich', { token, ...b }),
      create: b => call('x/maengel/melden', { token, ...b }),
      photo: (id, ph) => call('x/maengel/foto', { token, report_id: id, ...ph }),
      confirm: id => call('x/maengel/auch', { token, report_id: id }),
      thumbSrc: pid => `src="../../api/tablet/x/maengel/foto/${pid}"`,
    };
    let last = Date.now();
    clearInterval(alive);
    const close = window.MaengelForm.open(io, { sheetId: 'mgSheet', toast, keepAlive: () => { last = Date.now(); }, done: () => clearInterval(alive) });
    alive = setInterval(() => {
      const open = $('mgSheet') && $('mgSheet').classList.contains('show');
      if (!open) return clearInterval(alive);
      if (Date.now() - last > 3 * 60000) { clearInterval(alive); close(); return; }
      window.dispatchEvent(new Event('scroll'));   // gilt für nav.js als Eingabe
    }, 5000);
  }
  $('startBtn').onclick = pickName;

  GKTab.gate(load, closeDlg);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && $('overlay').classList.contains('hidden')) load(); });
  load();
})();
