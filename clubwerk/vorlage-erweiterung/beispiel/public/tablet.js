'use strict';
fetch('../../api/tablet/x/beispiel/notizen').then(r => r.json()).then(rows => {
  document.getElementById('list').innerHTML = rows.map(r => `<li>${r.text.replace(/[<>&]/g, '')}</li>`).join('') || '<li>Noch keine Notizen.</li>';
});
