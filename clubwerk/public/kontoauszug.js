/* Kontoauszug einlesen und abgleichen (Kern: src/kontoauszug.js). Die Seite gehört zu „Beiträge & Zahlungen“ (Mitglieder) bzw.
   ohne Mitgliederverwaltung zur Buchhaltung – das Modul meldet sie mit GK.kontoauszugRegister(gruppe) an.
   Wird vor admin.js geladen und meldet sich über CW_PAGES an, sobald GK bereitsteht. */
(window.CW_PAGES = window.CW_PAGES || []).push(GK => {
  'use strict';
  const { $, esc, euro, deDate, deTime, api, toast, fail, dialog, closeDialog, ask } = GK;
  let filter = 'pruefen';
  const LEVEL = { sicher: ['g', 'sicher'], wahrscheinlich: ['a', 'wahrscheinlich'], vielleicht: ['', 'vielleicht'] };
  const pill = ([c, t]) => `<span class="pill ${c}">${esc(t)}</span>`;
  const sign = c => `<td class="r num nw ${c < 0 ? 'neg' : ''}">${euro(c)}</td>`;

  async function upload(file, q = '') {
    const r = await fetch(`api/admin/kontoauszug/upload?name=${encodeURIComponent(file.name)}${q}`, { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'application/octet-stream' }, body: await file.arrayBuffer() });
    const d = await r.json().catch(() => ({}));
    if (r.status === 413) throw new Error('Die Datei ist zu groß (höchstens 5 MB).');
    if (!r.ok) throw Object.assign(new Error(d.error || 'Fehler beim Einlesen.'), { status: r.status });
    return d;
  }
  /** allgemeines CSV: Spalten zuordnen (wird je Aufbau der Kopfzeile gemerkt) */
  function mapDialog(file, d) {
    return new Promise(resolve => {
      const L = d.layout, F = [['date', 'Datum *'], ['amount', 'Betrag *'], ['name', 'Name (Zahler)'], ['iban', 'IBAN'], ['purpose', 'Verwendungszweck'], ['sh', 'Soll/Haben-Kennzeichen']];
      const sel = (k, v) => `<select id="kaM_${k}"><option value="-1">– keine –</option>${L.header.map((h, i) => `<option value="${i}" ${i === v ? 'selected' : ''}>${esc(h || `Spalte ${i + 1}`)}</option>`).join('')}</select>`;
      dialog(`<h2>Spalten zuordnen</h2>
        <p class="muted" style="margin-top:0">Diese CSV-Datei kennt Clubwerk noch nicht. Bitte einmal sagen, welche Spalte was enthält – beim nächsten Mal geht es von selbst.</p>
        <div class="frm"><label class="f wall">Vereinskonto<select id="kaAcc">${d.accounts.map(a => `<option value="${a.id}">${esc(a.name)} · ${esc(a.iban)}</option>`).join('')}</select></label>
          ${F.map(([k, l]) => `<label class="f">${esc(l)}${sel(k, L.guess[k])}</label>`).join('')}</div>
        <h3 style="margin:16px 0 8px">Beispiel aus der Datei</h3>
        <div class="scroll" style="max-height:30vh"><table class="tbl"><tr>${L.header.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${L.sample.map(r => `<tr>${r.map(c => `<td class="s" translate="no">${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>
        <div class="err" id="kaMErr"></div>
        <div class="btns"><button class="btn ghost" id="kaMNo">Abbrechen</button><button class="btn primary" id="kaMOk">Einlesen</button></div>`);
      $('kaMNo').onclick = () => { closeDialog(); resolve(null); };
      $('kaMOk').onclick = () => GK.busy($('kaMOk'), async () => {
        const map = Object.fromEntries(F.map(([k]) => [k, Number($('kaM_' + k).value)]));
        try { const r = await upload(file, `&account=${$('kaAcc').value}&map=${encodeURIComponent(JSON.stringify(map))}`); closeDialog(); resolve(r); }
        catch (e) { $('kaMErr').textContent = e.message; }
      });
    });
  }
  async function handle(files, again) {
    for (const f of files) {
      try {
        let r = await upload(f);
        if (r.needMapping) { r = await mapDialog(f, r); if (!r) continue; }
        const parts = [`${r.added} ${r.added === 1 ? 'Buchung' : 'Buchungen'} neu`];
        if (r.dup) parts.push(`${r.dup} schon eingelesen`);
        if (r.debits) parts.push(`${r.debits} Abbuchungen übersprungen`);
        toast(`${f.name}: ${parts.join(', ')}.`);
      } catch (e) { fail(e); }
    }
    filter = 'pruefen'; again();
  }

  /* ---------- Zuordnen ---------- */
  async function assign(e, c, opts, again) {
    try { const r = await api(`kontoauszug/entries/${e.id}/assign`, 'POST', { module: c.module, key: c.key, opts }); closeDialog(); toast(`Zugeordnet: ${r.label}`); again(); } catch (err) { fail(err); }
  }
  /** Buchung prüfen: alle Vorschläge, bei Rücklastschriften Gebühr und Mandat, von Hand zuordnen oder „gehört nicht zu Clubwerk“ */
  async function checkDialog(e, again) {
    const ret = e.kind === 'ruecklastschrift';
    const all = await api('kontoauszug/targets');
    const targets = all.filter(t => (t.kind || 'zahlung') === (ret ? 'ruecklastschrift' : 'zahlung'));
    const c0 = e.cands[0];
    dialog(`<h2>${ret ? 'Rücklastschrift' : 'Zahlungseingang'} zuordnen</h2>
      <p style="margin:0 0 4px"><b class="num">${deDate(e.date)}</b> · <b class="num ${e.cents < 0 ? 'neg' : ''}">${euro(e.cents)}</b>${ret && e.fee_cents ? ` <span class="muted s">(davon Gebühr der Bank ${euro(e.fee_cents)})</span>` : ''}</p>
      <p style="margin:0 0 4px" translate="no">${esc(e.name || '–')}${e.iban ? ` <span class="muted s">${esc(e.iban)}</span>` : ''}</p>
      <p class="muted s" style="margin:0" translate="no">${esc(e.purpose || '–')}</p>
      ${e.cands.length ? `<h3 style="margin:16px 0 8px">Vorschläge</h3><div class="ka-c">${e.cands.map((c, i) => `<label class="chk ucard"><input type="radio" name="kaC" value="${i}" ${i === 0 ? 'checked' : ''}> <span><b translate="no">${esc(c.label)}</b> ${pill(LEVEL[c.level])}${c.note ? `<br><span class="muted s">${esc(c.note)}</span>` : ''}</span></label>`).join('')}</div>` : ''}
      ${ret ? `<div class="frm" style="margin-top:12px"><label class="f">Gebühr für den Zahler (€)<input id="kaFee" inputmode="decimal" value="${GK.centsToInput(c0 && c0.opts.fee != null ? c0.opts.fee : e.fee_cents || 0)}"></label>
        <label class="chk w2" style="align-self:end"><input type="checkbox" id="kaRev" ${c0 && c0.opts.revoke ? 'checked' : ''}> Mandat sperren</label></div>` : ''}
      <h3 style="margin:16px 0 8px">${e.cands.length ? 'Oder von Hand zuordnen' : 'Von Hand zuordnen'}</h3>
      <div class="filterbar" style="margin-bottom:8px"><label class="search"><input id="kaQ" placeholder="${ret ? 'Zahler suchen' : 'Zahler oder Rechnung suchen'}" aria-label="Suchen"></label></div>
      <div class="scroll" style="max-height:32vh" id="kaT"></div>
      <div class="btns">${e.status === 'offen' ? '<button class="btn ghost" id="kaIgn" style="margin-right:auto">Gehört nicht zu Clubwerk</button>' : ''}<button class="btn ghost" id="kaNo">Abbrechen</button>${e.cands.length ? '<button class="btn primary" id="kaOk">Übernehmen</button>' : ''}</div>`);
    const opts = () => (ret ? { fee: GK.toCents($('kaFee').value) || 0, revoke: $('kaRev').checked } : undefined);
    const showT = () => {
      const q = String($('kaQ').value || '').toLowerCase();
      const list = targets.filter(t => !q || `${t.label} ${t.sub}`.toLowerCase().includes(q)).slice(0, 60);
      $('kaT').innerHTML = list.length ? `<table class="tbl kompakt">${list.map((t, i) => `<tr><td><b translate="no">${esc(t.label)}</b><div class="muted s">${esc(t.moduleName)} · ${esc(t.sub)}</div></td>${sign(t.cents)}<td class="r"><button class="btn small" data-kt="${targets.indexOf(t)}">Zuordnen</button></td></tr>`).join('')}</table>`
        : `<p class="empty">${targets.length ? 'Nichts gefunden.' : ret ? 'Keine Lastschriften der letzten 13 Monate.' : 'Nichts offen.'}</p>`;
      $('kaT').querySelectorAll('[data-kt]').forEach(b => { b.onclick = () => GK.busy(b, () => assign(e, targets[+b.dataset.kt], opts(), again)); });
    };
    $('kaQ').oninput = showT; showT();
    $('kaNo').onclick = closeDialog;
    if ($('kaOk')) $('kaOk').onclick = () => GK.busy($('kaOk'), () => assign(e, e.cands[Number((document.querySelector('[name="kaC"]:checked') || {}).value || 0)], opts(), again));
    if ($('kaIgn')) $('kaIgn').onclick = async () => { try { await api(`kontoauszug/entries/${e.id}/ignore`, 'POST', {}); closeDialog(); toast('Als „gehört nicht zu Clubwerk“ markiert.'); again(); } catch (err) { fail(err); } };
    if (ret && $('kaFee')) document.querySelectorAll('[name="kaC"]').forEach(r => { r.onchange = () => { const c = e.cands[+r.value]; if (c && c.opts) { if (c.opts.fee != null) $('kaFee').value = GK.centsToInput(c.opts.fee); $('kaRev').checked = Boolean(c.opts.revoke); } }; });
  }

  /* ---------- Seite ---------- */
  async function render() {
    const again = () => render().catch(fail);
    const [st, open] = await Promise.all([api('kontoauszug'), api('kontoauszug/entries?tab=offen')]);
    const rows = filter === 'zugeordnet' ? await api('kontoauszug/entries?tab=zugeordnet') : filter === 'nicht' ? [...open.filter(e => !e.cands.length), ...await api('kontoauszug/entries?tab=fremd')] : open.filter(e => e.cands.length);
    const nCheck = open.filter(e => e.cands.length).length, nNone = open.length - nCheck;
    const safe = open.filter(e => e.cands.filter(c => c.level === 'sicher').length === 1);
    $('main').innerHTML = `<h2 class="page">Kontoauszug</h2><p class="lead">Kontoauszug aus dem Online-Banking einlesen – Clubwerk ordnet Zahlungen und Rücklastschriften den offenen Posten zu.</p>
      <div class="drop card" id="kaDrop">
        <div class="big">Kontoauszug hier ablegen</div>
        <div class="muted">CAMT-Datei (XML oder ZIP), Sparkassen-„CSV-CAMT“ oder CSV-Export der Bank · mehrere Dateien auf einmal möglich</div>
        <div class="row"><label class="btn">Dateien wählen<input type="file" id="kaFile" accept=".xml,.zip,.csv,.txt,text/csv,application/xml,application/zip" multiple hidden></label></div>
        <p class="muted s" style="margin:12px 0 0">${st.last ? `Zuletzt eingelesen: Auszug bis <b>${deDate(st.last.to)}</b> (am ${deTime(st.last.at)})` : 'Noch kein Kontoauszug eingelesen.'}</p>
      </div>
      <div class="chips" id="kaF" role="group" aria-label="Filter" style="margin-bottom:12px">${[['pruefen', 'Zu prüfen', nCheck], ['nicht', 'Nicht zugeordnet', nNone + st.counts.fremd], ['zugeordnet', 'Zugeordnet', st.counts.zugeordnet]]
        .map(([k, l, n]) => `<button type="button" data-f="${k}" class="${filter === k ? 'on' : ''}" aria-pressed="${filter === k}">${l}<span class="cnt">${n || ''}</span></button>`).join('')}</div>
      <div class="card" id="kaList">${table(rows)}</div>
      ${st.modules.length ? '' : '<div class="banner a"><span>Zum Zuordnen fehlt dir das Recht „Einzug“ bzw. „Buchhaltung“ – du siehst die Buchungen nur.</span></div>'}`;
    GK.tabTools(filter === 'pruefen' && safe.length ? `<button class="btn primary" id="kaSafe">Alle sicheren übernehmen (${safe.length})</button>` : '', $('kaList'));
    const drop = $('kaDrop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, x => { x.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, x => { x.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', x => handle([...x.dataTransfer.files], again));
    $('kaFile').onchange = x => handle([...x.target.files], again);
    $('kaF').onclick = x => { const b = x.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; again(); };
    if ($('kaSafe')) $('kaSafe').onclick = () => GK.busy($('kaSafe'), async () => {
      if (!await ask(`${safe.length} sichere Zuordnungen übernehmen?\n\nGebucht wird genau wie von Hand: Zahlung erfassen, Lastschrift „Zahlung erfolgt“ bzw. Rücklastschrift. Jede Zuordnung lässt sich danach wieder aufheben.`, { ok: 'Übernehmen' })) return;
      try { const r = await api('kontoauszug/assign-safe', 'POST', {}); toast(`${r.count} ${r.count === 1 ? 'Buchung' : 'Buchungen'} zugeordnet${r.errors.length ? ` – ${r.errors.length} nicht: ${r.errors[0]}` : ''}.`, Boolean(r.errors.length)); again(); } catch (e) { fail(e); }
    });
    const byId = id => rows.find(e => e.id === id);
    $('main').querySelectorAll('[data-kok]').forEach(b => { b.onclick = () => GK.busy(b, () => assign(byId(+b.dataset.kok), byId(+b.dataset.kok).cands[0], undefined, again)); });
    $('main').querySelectorAll('[data-kchk]').forEach(b => { b.onclick = () => checkDialog(byId(+b.dataset.kchk), again).catch(fail); });
    $('main').querySelectorAll('[data-kre]').forEach(b => { b.onclick = async () => { try { await api(`kontoauszug/entries/${b.dataset.kre}/reopen`, 'POST', {}); again(); } catch (e) { fail(e); } }; });
    $('main').querySelectorAll('[data-kun]').forEach(b => { b.onclick = async () => {
      const e = byId(+b.dataset.kun);
      if (!await ask(`Zuordnung aufheben?\n\n${e.matches.map(m => m.label).join('\n')}\n\nDie Buchung wird wieder „zu prüfen“; Posten, Einzug bzw. Rechnung stehen wieder wie vorher.`, { ok: 'Aufheben', danger: true })) return;
      try { await api(`kontoauszug/entries/${e.id}/undo`, 'POST', {}); toast('Zuordnung aufgehoben.'); again(); } catch (err) { fail(err); }
    }; });
  }
  function table(rows) {
    if (!rows.length) return `<p class="empty">${filter === 'pruefen' ? 'Nichts zu prüfen. Neue Kontoauszüge oben ablegen.' : filter === 'nicht' ? 'Alle Buchungen sind zugeordnet.' : 'Noch nichts zugeordnet.'}</p>`;
    const who = e => `<b translate="no">${esc(e.name || (e.kind === 'ruecklastschrift' ? 'Rücklastschrift' : 'Gutschrift'))}</b>${e.kind === 'ruecklastschrift' ? ' <span class="pill r">Rücklastschrift</span>' : ''}`;
    const head = `<tr><th>${filter === 'zugeordnet' ? 'Von · zugeordnet zu' : filter === 'pruefen' ? 'Von · Vorschlag' : 'Von'}</th><th>Datum</th><th>Verwendungszweck</th><th class="r">Betrag</th><th></th></tr>`;
    return `<div class="scroll"><table class="tbl kompakt">${head}${rows.map(e => {
      let mid = '', act = '';
      if (filter === 'zugeordnet') {
        mid = e.matches.map(m => `<span translate="no">${esc(m.label)}</span>`).join('<br>') + `<div class="muted s">${esc(e.done_by || '')}${e.done_at ? ` · ${deTime(e.done_at)}` : ''}</div>`;
        act = `<button class="btn small" data-kun="${e.id}">Aufheben</button>`;
      } else if (e.status === 'fremd') {
        mid = `<span class="pill">gehört nicht zu Clubwerk</span><div class="muted s">wird nach der Löschfrist gelöscht (Einstellungen › Datenschutz)</div>`;
        act = `<button class="btn small" data-kre="${e.id}">Wieder prüfen</button>`;
      } else if (e.cands.length) {
        const c = e.cands[0];
        mid = `<span translate="no">${esc(c.label)}</span> ${pill(LEVEL[c.level])}${c.note ? `<div class="muted s">${esc(c.note)}</div>` : ''}${e.cands.length > 1 ? `<div class="muted s">${e.cands.length === 2 ? '1 weiterer Vorschlag' : `${e.cands.length - 1} weitere Vorschläge`}</div>` : ''}`;
        act = `${e.cands.length === 1 ? `<button class="btn small" data-kok="${e.id}">Übernehmen</button> ` : ''}<button class="btn small" data-kchk="${e.id}">Prüfen …</button>`;
      } else act = `<button class="btn small" data-kchk="${e.id}">Zuordnen …</button>`;
      return `<tr class="${e.status === 'fremd' ? 'off' : ''}"><td>${who(e)}${mid ? `<div class="s ka-v">${mid}</div>` : ''}</td><td class="num nw">${deDate(e.date)}</td><td class="s k-weg" translate="no">${esc(e.purpose)}</td>${sign(e.cents)}<td class="r nw">${act}</td></tr>`;
    }).join('')}</table></div>`;
  }

  /** Seite anmelden (aus dem Modul Mitglieder bzw. Buchhaltung): in dessen Menügruppe, vor „before“ */
  GK.kontoauszugRegister = (group, before) => {
    GK.registerPage({ key: 'kontoauszug', title: 'Kontoauszug', perm: 'kontoauszug', render: () => render().catch(e => (e.vaultLocked ? GK.go('kontoauszug') : fail(e))), group, before });
    GK.registerSearch([{ label: 'Kontoauszug einlesen und abgleichen', page: 'kontoauszug', kind: 'aktion', perm: 'kontoauszug', boost: 1, words: 'CAMT Bank Umsätze Kontoauszug Abgleich Zahlungseingang Überweisung Sparkasse CSV Rücklastschrift Sammler' }]);
  };
  /** „Kontoauszug zuletzt eingelesen am …“ für Offene Posten und Mahnungen (leer, wenn nie eingelesen) */
  GK.kontoauszugHint = async () => {
    try { const s = await api('kontoauszug/status'); return s.last ? `Kontoauszug zuletzt eingelesen: bis ${deDate(s.last.to)} (am ${deDate(s.last.at.slice(0, 10))})${s.counts.offen ? ` · ${s.counts.offen} Buchungen noch nicht zugeordnet` : ''}` : ''; } catch (e) { return ''; }
  };
});
