'use strict';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
fetch('../../api/tablet/x/beispiel/notizen').then(r => r.json()).then(rows => {
  // Kacheln aus dem Tablet-Kit: .tk-tile mit Symbol, Text und optionaler Marke
  document.getElementById('list').innerHTML = rows.map(r => `<div class="tk-tile"><span class="tk-ico">✎</span><span class="tk-txt"><b>${esc(r.text)}</b><span>Notiz</span></span></div>`).join('')
    || '<p class="tk-empty" style="grid-column:1/-1;margin:0">Noch keine Notizen.</p>';
});
