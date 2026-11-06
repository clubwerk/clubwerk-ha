'use strict';
/* Verwaltungsseite „Schlüssel“: Reiter Ausgegeben · Bestand · Protokolle · Einstellungen */
(() => {
  const GK = window.GK;
  const { $, esc, toast, fail } = GK;
  const api = (url, method, body) => GK.api('x/schluessel/' + url, method, body);
  const BASE = 'api/admin/x/schluessel/';
  const st = { meta: null, filter: 'alle', tabs: null, types: [] };
  const KEY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M16 7l3 3M14 9l2 2"/></svg>';
  const CHIP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="3"/><circle cx="12" cy="9" r="1.5"/><path d="M9 15h6"/></svg>';
  const EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const fillTerms = t => String(t || '').replace(/\{Verein\}/g, st.meta.club).replace(/\{Höchstbetrag\}/g, st.meta.max).replace(/\{Frist\}/g, st.meta.frist);
  const num = t => `<span class="num">${esc(t)}</span>`;
  const eur = c => GK.euro(c);
  const dt = s => (s ? GK.deDate(s.slice(0, 10)) : '');
  const ico = t => (t.kind === 'transponder' || t.kind === 'karte' ? CHIP : KEY);

  if (!document.getElementById('slAdminStyle')) {
    const s = document.createElement('style'); s.id = 'slAdminStyle';
    s.textContent = `
      .sl-plus { display: none; }
      .tbl.sl-t .pill { white-space: nowrap; }
      .sl-k { display: flex; align-items: center; gap: 10px; min-width: 0; margin: 2px 0; }
      .sl-ico { width: 34px; height: 34px; border-radius: 10px; background: var(--brand-soft); color: var(--brand-ink); display: inline-flex; align-items: center; justify-content: center; flex: none; }
      .sl-k > span:last-child { min-width: 0; overflow-wrap: break-word; white-space: normal; }
      @media (max-width: 700px) {
        .tbl.kompakt td.sl-keys, .tbl.kompakt td.sl-keys.k-lang:not(:first-child) { overflow: visible; text-overflow: clip; flex: 1 1 150px; line-height: 18px; }
        .tbl.kompakt.sl-t tr { padding-top: 4px; padding-bottom: 4px; }
        .tbl.kompakt.sl-t td:first-child .sl-ico { display: none; }
        .tbl.kompakt td.sl-keys .sl-ico { display: none; }
        .tbl.kompakt td.sl-keys .sl-k { display: inline; margin: 0; }
        .tbl.kompakt td.sl-keys .sl-k + .sl-k::before { content: ' · '; }
        .tbl.kompakt td.sl-keys .sl-k > span { display: inline; }
        .tbl.kompakt td.sl-keys .sl-more { display: none; }
        .tbl.kompakt td.sl-keys .sl-plus { display: inline; margin-left: 6px; color: var(--muted); }
      }
      .sl-pick { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; border: 1px solid var(--line); border-radius: var(--r-ctl, 12px); padding: 10px 12px; margin: 0 0 8px; cursor: pointer; background: var(--card); }
      .sl-pick.on { border-color: var(--brand); background: var(--brand-soft); }
      .sl-pick input { flex: none; }
      .sl-pick .sl-t { flex: 1 1 140px; min-width: 0; overflow-wrap: break-word; }
      .sl-pick .sl-c { flex: none; color: var(--muted); font-size: 13px; }
      .frm [hidden], .sl-hide[hidden] { display: none !important; }
      .sl-terms { font-family: inherit; max-height: 190px; overflow: auto; background: var(--hover); border-radius: 12px; padding: 12px 14px; white-space: pre-line; overflow-wrap: anywhere; font-size: 14px; line-height: 1.5; margin: 0; }
      .sl-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0 0 12px; }
      .sl-opt { display: flex; align-items: flex-start; gap: 10px; border: 1px solid var(--line); border-radius: var(--r-ctl, 12px); padding: 12px; cursor: pointer; background: var(--card); }
      .sl-opt.on { border-color: var(--brand); background: var(--brand-soft); }
      .sl-opt small { display: block; color: var(--muted); }
      .sl-code { font: 600 56px/1 var(--num, ui-monospace, monospace); letter-spacing: .22em; text-align: center; padding: 18px 0; background: var(--hover); border-radius: 16px; margin: 12px 0; font-variant-numeric: tabular-nums; }
      .sl-hits { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
      .sl-hits button { text-align: left; min-height: 44px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); color: var(--ink); font: inherit; padding: 0 14px; cursor: pointer; }
      .sl-who { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--brand); background: var(--brand-soft); border-radius: 12px; padding: 10px 14px; min-height: 44px; }
      .sl-sum { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0 0 14px; }
      .sl-sum dt { color: var(--muted); } .sl-sum dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
      @media (max-width: 700px) { .sl-opts { grid-template-columns: 1fr; } .sl-code { font-size: 44px; } }`;
    document.head.appendChild(s);
  }
  const PILLS = { ausgegeben: ['g', 'Ausgegeben'], wartet: ['b', 'Wartet auf Unterschrift'], zurueck: ['', 'Zurückgegeben'], storniert: ['', 'Storniert'] };
  const statusPill = r => {
    if (r.reclaim) return `<span class="pill ${r.reason === 'ausgetreten' ? 'r' : 'a'}">${r.reason === 'ausgetreten' ? 'Ausgetreten' : 'Überfällig'}</span>`;
    if (r.legacy) return '<span class="pill b">Ohne Protokoll</span>';
    if (r.status === 'ausgegeben' && r.due) return '<span class="pill b">Befristet</span>';
    const p = PILLS[r.status] || ['', r.status]; return `<span class="pill ${p[0]}">${esc(p[1])}</span>`;
  };
  async function meta() { st.meta = await api('meta'); return st.meta; }

  /* ================================================================ Ausgegeben */
  function itemsHtml(r) {
    const open = r.pieces.filter(p => ['ausgegeben', 'reserviert'].includes(p.state));
    return open.map((p, i) => `<div class="sl-k${i ? ' sl-more' : ''}"><span class="sl-ico">${p.name && /transponder|chip|karte/i.test(p.name) ? CHIP : KEY}</span><span><b class="num">${esc(p.ident)}</b> <span translate="no">${esc(p.name)}</span></span></div>`).join('') + (open.length > 1 ? `<span class="sl-plus">+${open.length - 1}</span>` : '')
      || r.pieces.map(p => `<div class="sl-k"><span class="sl-ico">${KEY}</span><span><b class="num">${esc(p.ident)}</b> <span translate="no">${esc(p.name)}</span></span></div>`).join('');
  }
  async function showIssues(el) {
    const d = await api('issues?filter=' + st.filter), m = st.meta;
    const all = d.counts;
    const chip = (k, l, n) => `<button type="button" class="${st.filter === k ? 'on' : ''}" data-f="${k}" aria-pressed="${st.filter === k}">${l}<span class="cnt">${n || ''}</span></button>`;
    const rec = d.list.filter(r => r.reclaim);
    const banner = st.filter === 'alle' && all.reclaim ? `<div class="banner a"><span><b>${all.reclaim} ${GK.T(all.reclaim === 1 ? 'Person muss' : 'Personen müssen')} Schlüssel zurückgeben:</b> ${rec.slice(0, 4).map(r => `<span translate="no">${esc(r.person)}</span> (${esc(r.reclaim_text)})`).join(' · ')}${rec.length > 4 ? ' …' : ''}</span></div>` : '';
    const adopt = m.adoptable ? `<div class="banner b"><span><b>${m.adoptable} ${GK.T(m.adoptable === 1 ? 'Mitglied hat' : 'Mitglieder haben')} eine Schlüsselnummer</b> in der Mitgliederverwaltung.</span><button class="btn small" id="slAdopt">Als Ausgabe übernehmen …</button></div>` : '';
    el.innerHTML = `<div class="toolbar"><button class="btn primary" id="slNew">Schlüssel ausgeben</button><a class="btn" href="${BASE}export.xlsx">Excel</a></div>${adopt}${banner}<div class="chips" role="group" aria-label="Filter">${chip('alle', 'Alle', all.alle)}${chip('reclaim', 'Zurückfordern', all.reclaim)}${chip('befristet', 'Befristet', all.befristet)}${chip('pfand', 'Mit Pfand', all.pfand)}</div>
      <div class="card">${d.list.length ? `<table class="tbl kompakt k-name-voll sl-t"><tr><th>Person</th><th>Schlüssel</th><th class="hide-md">Seit</th><th class="r hide-md">Pfand</th><th>Status</th><th></th></tr>
        ${d.list.map(r => `<tr data-id="${r.id}"><td><b translate="no">${esc(r.person)}</b>${r.ext ? '<div class="muted s k-weg">Kein Konto</div>' : ''}</td><td class="k-1z sl-keys">${itemsHtml(r)}</td>
          <td class="nw k-weg hide-md" data-label="Seit">${r.issued_at ? num(dt(r.issued_at)) : '–'}${r.due ? `<div class="muted s">bis ${num(dt(r.due))}</div>` : ''}</td><td class="r k-weg hide-md" data-label="Pfand">${r.deposit_cents ? `<span class="num">${esc(eur(r.deposit_cents))}</span>` : '–'}</td>
          <td data-label="Status">${statusPill(r)}</td>
          <td class="r"><span class="acts">${r.status === 'ausgegeben' ? `<button class="btn small k-weg" data-ret="${r.id}">Rücknahme</button>` : ''}<button class="btn ico" data-det="${r.id}" title="Einzelheiten" aria-label="Einzelheiten">${EDIT}</button></span></td></tr>`).join('')}</table>`
        : `<p class="empty">${st.filter === 'alle' ? 'Noch nichts ausgegeben – mit „Schlüssel ausgeben“ legst du die erste Übergabe an.' : 'Hier ist gerade nichts.'}</p>`}</div>`;
    el.querySelectorAll('[data-f]').forEach(b => { b.onclick = () => { st.filter = b.dataset.f; showIssues(el); }; });
    $('slNew').onclick = () => issueDialog();
    if ($('slAdopt')) $('slAdopt').onclick = adoptDialog;
    el.querySelectorAll('[data-ret]').forEach(b => { b.onclick = () => returnDialog(+b.dataset.ret); });
    el.querySelectorAll('[data-det]').forEach(b => { b.onclick = () => detail(+b.dataset.det); });
  }
  const reload = async () => { await meta(); if (st.tabs) st.tabs.reload ? st.tabs.reload() : render(); };

  /* ---------- Unterschriftsfelder in einem Fenster ---------- */
  function pads(specs) {   // specs: [[id, label]] → { html, pads: [ ... ] nach dem Einfügen mit mount() }
    return { html: specs.map(([id, label]) => window.CWSign.field({ id, label })).join(''), mount: () => specs.map(([id]) => window.CWSign.mount($(id))) };
  }
  const sigErr = (ps, names) => { const i = ps.findIndex((p, k) => names[k] && !p.ok()); return i; };

  /* ---------- Schlüssel ausgeben ---------- */
  async function issueDialog(pre = {}) {
    let types, tpls, who = null;
    try { [types, tpls] = await Promise.all([api('types'), api('templates')]); } catch (e) { return fail(e); }
    const free = types.list.filter(t => t.free > 0 || (pre.type && pre.type === t.id));
    if (!types.list.length) return toast('Bitte zuerst im Reiter „Bestand“ Schlüssel anlegen.', true);
    const m = st.meta, picked = new Set(pre.type ? [pre.type] : []);
    GK.dialog(`<h2>Schlüssel ausgeben</h2><p class="muted" style="margin-top:-4px">Person und Schlüssel wählen, Bedingungen prüfen – danach unterschreiben beide Seiten.</p>
      <div class="frm"><div class="w2"><label class="f" style="margin:0" id="slWhoBox">Empfänger/in<input id="slWhoQ" placeholder="Name suchen (mind. 2 Buchstaben)" autocomplete="off"></label><div id="slWho"></div></div>
        <label class="f w2">Ausgegeben von<input id="slBy" value="${esc(m.user)}" maxlength="60"></label></div>
      <p style="margin:8px 0 12px"><button type="button" class="btn small" id="slExt">Person ohne Clubwerk-Konto …</button></p>
      <div id="slExtBox" hidden><div class="frm"><label class="f">Vorname<input id="slEf" maxlength="60"></label><label class="f">Nachname<input id="slEl" maxlength="60"></label><label class="f">Kontakt (Telefon oder E-Mail)<input id="slEc" maxlength="120"></label><label class="f">Geburtsdatum (optional)<input id="slEb" type="date"></label></div></div>
      <div class="muted s" style="margin:14px 0 6px">Schlüssel (vorrätig)</div>
      <div id="slPick">${free.map(t => `<label class="sl-pick ${picked.has(t.id) ? 'on' : ''}"><input type="checkbox" data-t="${t.id}" ${picked.has(t.id) ? 'checked' : ''} ${t.free ? '' : 'disabled'}><span class="sl-ico">${ico(t)}</span><span class="sl-t"><b class="num">${esc(t.ident)}</b> <span translate="no">${esc(t.name)}</span></span><span class="sl-c">${t.free} von ${t.total} vorrätig</span></label>`).join('') || '<p class="empty">Es ist nichts vorrätig.</p>'}</div>
      <div class="frm"><label class="f">Rückgabe bis (optional)<input id="slDue" type="date" min="${m.today}"></label>
        <label class="f">Pfand (€, bar erhalten)<input id="slDep" inputmode="decimal" placeholder="0,00" value="${pre.dep ? String(pre.dep).replace('.', ',') : ''}"></label>
        <label class="f w2">Bedingungen<select id="slTpl">${tpls.list.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label></div>
      <pre class="sl-terms" id="slTerms" translate="no"></pre>
      <div class="muted s" style="margin:12px 0 6px">Wo wird unterschrieben?</div>
      <div class="sl-opts"><label class="sl-opt on"><input type="radio" name="slHow" value="hier" checked><span>Hier auf diesem Gerät<small>Gerät der Empfängerin / dem Empfänger reichen</small></span></label>
        <label class="sl-opt"><input type="radio" name="slHow" value="tablet"><span>Am Vereinstablet mit Code<small>6-stelliger Code, 3 Stunden gültig</small></span></label></div>
      <div class="btns"><button class="btn ghost" id="slX">Abbrechen</button><button class="btn primary" id="slGo">Weiter zur Unterschrift</button></div>`, true);
    const terms = () => { const t = tpls.list.find(x => x.id === +$('slTpl').value); $('slTerms').textContent = t ? fillTerms(t.text) : ''; };
    terms(); $('slTpl').onchange = terms;
    $('slX').onclick = GK.closeDialog;
    const showWho = () => { $('slWho').innerHTML = who ? `<div class="muted s" style="margin:0 0 4px">Empfänger/in</div><div class="sl-who"><b translate="no">${esc(who.name)}</b><button type="button" class="btn small ghost" id="slWhoX">ändern</button></div>` : ''; $('slWhoQ').parentElement.style.display = who ? 'none' : ''; if (who) $('slWhoX').onclick = () => { who = null; showWho(); }; };
    let qt = null;
    $('slWhoQ').oninput = () => { clearTimeout(qt); const q = $('slWhoQ').value.trim(); if (q.length < 2) { $('slWho').innerHTML = ''; return; }
      qt = setTimeout(async () => { try { const r = await api('people?q=' + encodeURIComponent(q)); $('slWho').innerHTML = `<div class="sl-hits">${r.list.map(p => `<button type="button" data-p="${p.id}" translate="no">${esc(p.name)}${p.kind === 'nichtmitglied' ? ' · Kein Mitglied' : ''}</button>`).join('') || '<div class="muted s">Niemand gefunden.</div>'}</div>`;
        $('slWho').querySelectorAll('[data-p]').forEach(b => { b.onclick = () => { who = r.list.find(p => p.id === +b.dataset.p); $('slExtBox').hidden = true; showWho(); }; }); } catch (e) { fail(e); } }, 250); };
    $('slExt').onclick = () => { $('slExtBox').hidden = !$('slExtBox').hidden; if (!$('slExtBox').hidden) { who = null; showWho(); $('slEf').focus(); } };
    const depSum = () => { let c = 0; $('slPick').querySelectorAll('[data-t]:checked').forEach(b => { c += (types.list.find(t => t.id === +b.dataset.t) || {}).deposit_cents || 0; }); return c; };
    $('slPick').querySelectorAll('[data-t]').forEach(b => { b.onchange = () => { b.closest('.sl-pick').classList.toggle('on', b.checked); if (!$('slDep').dataset.touched) { const c = depSum(); $('slDep').value = c ? (c / 100).toFixed(2).replace('.', ',') : ''; } }; });
    $('slDep').oninput = () => { $('slDep').dataset.touched = '1'; };
    $('dialog').querySelectorAll('[name=slHow]').forEach(r => { r.onchange = () => $('dialog').querySelectorAll('.sl-opt').forEach(o => o.classList.toggle('on', o.querySelector('input').checked)); });
    if (!$('slDep').value) { const c = depSum(); if (c) $('slDep').value = (c / 100).toFixed(2).replace('.', ','); }
    $('slGo').onclick = async () => {
      const pickedTypes = [...$('slPick').querySelectorAll('[data-t]:checked')].map(b => +b.dataset.t);
      if (!pickedTypes.length) return toast('Bitte mindestens einen Schlüssel wählen.', true);
      const body = { template_id: +$('slTpl').value, issued_by: $('slBy').value, due: $('slDue').value || undefined, deposit_cents: Math.round((parseFloat(String($('slDep').value).replace(',', '.')) || 0) * 100), how: document.querySelector('[name=slHow]:checked').value };
      let minor = false;
      if (!$('slExtBox').hidden) { body.person = { first_name: $('slEf').value, last_name: $('slEl').value, contact: $('slEc').value, birth_date: $('slEb').value || undefined }; if (body.person.birth_date) minor = ageOf(body.person.birth_date) < 18; }
      else if (who) { body.member_id = who.id; minor = who.minor; } else return toast('Bitte eine Person wählen.', true);
      try {   // freie Stücke je Sorte holen
        body.pieces = [];
        for (const t of pickedTypes) { const r = await api('pieces?type=' + t); const p = r.list.find(x => x.status === 'vorraetig'); if (!p) return toast('Von einer gewählten Sorte ist nichts mehr vorrätig.', true); body.pieces.push(p.id); }
      } catch (e) { return fail(e); }
      if (body.how === 'tablet') return GK.busy($('slGo'), async () => { try { const r = await api('issues', 'POST', body); codeDialog(r.code, who ? who.name : `${body.person.last_name}, ${body.person.first_name}`); } catch (e) { fail(e); } });
      signDialog({ body, minor, who: who ? who.name : `${body.person.last_name}, ${body.person.first_name}`, tpl: tpls.list.find(t => t.id === body.template_id), types: pickedTypes.map(id => types.list.find(t => t.id === id)), url: 'issues', after: 'Übergabe' });
    };
  }
  const ageOf = b => { const d = new Date(b), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--; return a; };
  function codeDialog(code, name) {
    GK.dialog(`<h2>Am Vereinstablet unterschreiben</h2><p class="muted" style="margin-top:-4px">Übergabe für <b translate="no">${esc(name)}</b> wartet auf die Unterschrift.</p>
      <p style="margin:0">Am Vereinstablet den Reiter <b>Schlüssel</b> öffnen und diesen Code eingeben:</p><div class="sl-code num" translate="no">${esc(code)}</div>
      <p class="muted s" style="margin:0 0 4px">Der Code gilt 3 Stunden. Danach in der Liste unter „Wartet auf Unterschrift“ einen neuen Code erzeugen.</p>
      <div class="btns"><button class="btn primary" id="slOk">Fertig</button></div>`);
    $('slOk').onclick = () => { GK.closeDialog(); reload(); };
  }
  /** Zusammenfassung, Haken und Unterschriften (Ausgabe in der Verwaltung und „Protokoll nachholen“) */
  function signDialog({ body, minor, who, tpl, types, url, after }) {
    const specs = [['slS1', `Empfänger/in – ${who}`], ['slS2', `Ausgegeben von – ${body.issued_by}`], ...(minor ? [['slS3', 'Erziehungsberechtigte/r']] : [])];
    const P = pads(specs);
    GK.dialog(`<h2>Bedingungen und Unterschrift</h2><p class="muted" style="margin-top:-4px">Bitte das Gerät jetzt <b translate="no">${esc(who)}</b> reichen.</p>
      <dl class="sl-sum"><dt>Schlüssel</dt><dd translate="no">${types.map(t => `Nr. ${esc(t.ident)} ${esc(t.name)}`).join(', ')}</dd><dt>Rückgabe</dt><dd>${body.due ? dt(body.due) : 'unbefristet, spätestens beim Austritt'}</dd><dt>Pfand</dt><dd>${body.deposit_cents ? eur(body.deposit_cents) + ' bar erhalten' : 'kein Pfand'}</dd></dl>
      <pre class="sl-terms" translate="no">${esc(tpl ? fillTerms(tpl.text) : '')}</pre>
      ${minor ? '<label class="f" style="margin-top:12px">Name der erziehungsberechtigten Person<input id="slGn" maxlength="70"></label>' : ''}
      <label class="chk" style="margin:14px 0"><input type="checkbox" id="slAg"> Gelesen und einverstanden</label>${P.html}
      <div class="btns"><button class="btn ghost" id="slBk">Zurück</button><button class="btn primary" id="slSg">Verbindlich abschließen</button></div>`, true);
    const ps = P.mount();
    $('slBk').onclick = () => (after === 'nachholen' ? GK.closeDialog() : issueDialog());
    $('slSg').onclick = () => {
      if (!$('slAg').checked) return toast('Bitte „Gelesen und einverstanden“ ankreuzen.', true);
      const bad = sigErr(ps, specs); if (bad >= 0) return toast('Bitte alle Felder unterschreiben.', true);
      if (minor && ($('slGn').value || '').trim().length < 3) return toast('Bitte den Namen der erziehungsberechtigten Person eintragen.', true);
      GK.busy($('slSg'), async () => {
        try { const r = await api(url, 'POST', { ...body, agreed: true, sig_receiver: ps[0].png(), sig_giver: ps[1].png(), ...(minor ? { sig_guardian: ps[2].png(), guardian_name: $('slGn').value } : {}) }); doneDialog(r.no, r.protocol); }
        catch (e) { fail(e); }
      });
    };
  }
  function doneDialog(no, protocol) {
    GK.dialog(`<h2>Protokoll ${esc(no)} erstellt</h2><p>Das PDF liegt im Tresor. Wenn eine E-Mail-Adresse bekannt ist, geht es der Person automatisch zu.</p>
      <div class="btns"><a class="btn" href="${BASE}protocols/${protocol}/pdf" target="_blank" rel="noopener">PDF öffnen</a><button class="btn primary" id="slOk">Fertig</button></div>`);
    $('slOk').onclick = () => { GK.closeDialog(); reload(); };
  }

  /* ---------- Rücknahme ---------- */
  async function returnDialog(id) {
    let r; try { r = await api('issues/' + id); } catch (e) { return fail(e); }
    const open = r.pieces.filter(p => p.state === 'ausgegeben'), P = pads([['slR1', 'Angenommen von – Unterschrift'], ['slR2', 'Rückgeber/in – Unterschrift (freiwillig)']]);
    GK.dialog(`<h2>Rücknahme von <span translate="no">${esc(r.person)}</span></h2><p class="muted" style="margin-top:-4px">Das Rückgabeprotokoll ist die Quittung für die Person.</p>
      <div id="slRp">${open.map(p => `<label class="sl-pick on"><input type="checkbox" data-p="${p.id}" checked><span class="sl-ico">${KEY}</span><span class="sl-t"><b class="num">${esc(p.ident)}</b> <span translate="no">${esc(p.name)}</span></span></label>`).join('')}</div>
      <div class="frm" style="margin-bottom:14px"><label class="f">Zustand<select id="slCo"><option value="ok">in Ordnung</option><option value="beschaedigt">beschädigt</option></select></label>
        <label class="f w2" id="slNoteBox" hidden>Was ist beschädigt?<input id="slNote" maxlength="200"></label>
        ${r.deposit_cents ? `<label class="f">Pfand ${esc(eur(r.deposit_cents))}<select id="slDb"><option value="">noch nicht erstattet</option><option value="zurueck">bar zurückgezahlt</option><option value="einbehalten">einbehalten</option></select></label><label class="f w2" id="slDnBox" hidden>Warum einbehalten?<input id="slDn" maxlength="200"></label>` : ''}</div>
      ${P.html}<div class="btns"><button class="btn ghost" id="slX">Abbrechen</button><button class="btn primary" id="slOk">Rücknahme bestätigen</button></div>
      <div class="dz"><button class="btn ghost danger" id="slLost">Verlust melden …</button></div>`, true);
    const ps = P.mount();
    $('slX').onclick = GK.closeDialog; $('slLost').onclick = () => lostDialog(id);
    $('slCo').onchange = () => { $('slNoteBox').hidden = $('slCo').value !== 'beschaedigt'; };
    if ($('slDb')) $('slDb').onchange = () => { $('slDnBox').hidden = $('slDb').value !== 'einbehalten'; };
    $('slOk').onclick = () => {
      const ids = [...$('slRp').querySelectorAll('[data-p]:checked')].map(b => +b.dataset.p); if (!ids.length) return toast('Bitte Stücke wählen.', true);
      if (!ps[0].ok()) return toast('Bitte als annehmende Person unterschreiben.', true);
      GK.busy($('slOk'), async () => {
        try { const x = await api(`issues/${id}/return`, 'POST', { piece_ids: ids, condition: $('slCo').value, note: $('slNote').value, deposit_back: $('slDb') ? $('slDb').value : '', deposit_note: $('slDn') ? $('slDn').value : '', sig_taker: ps[0].png(), ...(ps[1].ok() ? { sig_giver: ps[1].png() } : {}) }); doneDialog(x.no, x.protocol); }
        catch (e) { fail(e); }
      });
    };
  }
  function lostDialog(id) {
    const P = pads([['slL1', 'Angenommen von – Unterschrift'], ['slL2', 'Person – Unterschrift (freiwillig)']]);
    api('issues/' + id).then(r => {
      const open = r.pieces.filter(p => p.state === 'ausgegeben');
      GK.dialog(`<h2>Verlust melden</h2><p class="muted" style="margin-top:-4px"><span translate="no">${esc(r.person)}</span> – ${open.some(p => p.sensitive) ? 'Ein Stück ist <b>sicherheitsrelevant</b>: der Vorstand bekommt eine Sicherheitswarnung.' : 'Das Stück gilt danach als verloren.'}</p>
        <div id="slLp">${open.map(p => `<label class="sl-pick"><input type="checkbox" data-p="${p.id}" ${open.length === 1 ? 'checked' : ''}><span class="sl-ico">${KEY}</span><span class="sl-t"><b class="num">${esc(p.ident)}</b> <span translate="no">${esc(p.name)}</span></span></label>`).join('')}</div>
        <div class="frm" style="margin-bottom:14px"><label class="f">Datum des Verlusts<input id="slLd" type="date" value="${st.meta.today}" max="${st.meta.today}"></label>
          <label class="f">Kosten (€)<input id="slLc" inputmode="decimal" placeholder="0,00"></label>
          <label class="f">Kosten sind<select id="slLs"><option value="keine">keine</option><option value="bar">bar erhalten</option><option value="offen">noch offen</option></select></label>
          <label class="f wall">Umstände<textarea id="slLu" maxlength="500"></textarea></label></div>
        ${P.html}<div class="btns"><button class="btn ghost" id="slX">Zurück</button><button class="btn primary" id="slOk">Verlust bestätigen</button></div>`, true);
      const ps = P.mount();
      $('slX').onclick = () => returnDialog(id);
      $('slOk').onclick = () => {
        const ids = [...$('slLp').querySelectorAll('[data-p]:checked')].map(b => +b.dataset.p); if (!ids.length) return toast('Bitte Stücke wählen.', true);
        if (!ps[0].ok()) return toast('Bitte als annehmende Person unterschreiben.', true);
        GK.busy($('slOk'), async () => {
          try { const x = await api(`issues/${id}/lost`, 'POST', { piece_ids: ids, date: $('slLd').value, circumstances: $('slLu').value, cost_cents: Math.round((parseFloat(String($('slLc').value).replace(',', '.')) || 0) * 100), cost_state: $('slLs').value, sig_taker: ps[0].png(), ...(ps[1].ok() ? { sig_person: ps[1].png() } : {}) }); doneDialog(x.no, x.protocol); }
          catch (e) { fail(e); }
        });
      };
    }).catch(fail);
  }

  /* ---------- Einzelheiten ---------- */
  async function detail(id) {
    let r; try { r = await api('issues/' + id); } catch (e) { return fail(e); }
    const act = (k, l, cls = 'btn') => `<button class="${cls}" id="${k}">${l}</button>`;
    GK.dialog(`<h2 translate="no">${esc(r.person)}</h2><p class="muted" style="margin-top:-4px">${statusPill(r)} ${r.reclaim ? esc(r.reclaim_text) : ''}</p>
      <dl class="sl-sum"><dt>Schlüssel</dt><dd translate="no">${r.pieces.map(p => `Nr. ${esc(p.ident)} ${esc(p.name)}${p.state !== 'ausgegeben' && p.state !== 'reserviert' ? ` (${{ zurueck: 'zurück', verloren: 'verloren', storniert: 'storniert' }[p.state] || p.state})` : ''}`).join('<br>')}</dd>
        <dt>Seit</dt><dd>${r.issued_at ? dt(r.issued_at) : '–'}${r.due ? ` · bis ${dt(r.due)}` : ''}</dd><dt>Pfand</dt><dd>${r.deposit_cents ? `${esc(eur(r.deposit_cents))} (${{ gehalten: 'gehalten', zurueck: 'zurückgezahlt', einbehalten: 'einbehalten' }[r.deposit_state] || ''})` : 'kein Pfand'}</dd>
        <dt>Ausgegeben von</dt><dd translate="no">${esc(r.issued_by || '–')}</dd></dl>
      ${r.protocols.length ? `<div class="card flush" style="margin:0 0 14px"><table class="tbl kompakt"><tr><th>Protokoll</th><th>Art</th><th>Datum</th><th></th></tr>${r.protocols.map(p => `<tr><td><b class="num">${esc(p.no)}</b></td><td>${{ ausgabe: 'Ausgabe', rueckgabe: 'Rückgabe', verlust: 'Verlust', storno: 'Stornierung' }[p.kind]}${p.status === 'storniert' ? ' (storniert)' : ''}</td><td class="nw">${num(dt(p.at))}</td><td class="r"><a class="btn small" href="${BASE}protocols/${p.id}/pdf" target="_blank" rel="noopener">PDF</a></td></tr>`).join('')}</table></div>` : ''}
      <div class="btns">${r.status === 'ausgegeben' ? act('slRet', 'Rücknahme', 'btn primary') : ''}${r.status === 'ausgegeben' && !r.legacy ? act('slRemind', 'Erinnerung schicken') : ''}${r.legacy ? act('slCatch', 'Protokoll nachholen', 'btn primary') : ''}${r.status === 'wartet' ? act('slCode', 'Neuen Code erzeugen', 'btn primary') : ''}<button class="btn" id="slC">Schließen</button></div>
      ${r.status === 'ausgegeben' && !r.legacy ? `<div class="dz">${act('slCancel', 'Ausgabe stornieren …', 'btn ghost danger')}</div>` : ''}${r.status === 'wartet' ? `<div class="dz">${act('slDrop', 'Übergabe verwerfen', 'btn ghost danger')}</div>` : ''}`);
    $('slC').onclick = GK.closeDialog;
    const x = (k, fn) => { if ($(k)) $(k).onclick = fn; };
    x('slRet', () => returnDialog(id));
    x('slRemind', () => GK.busy($('slRemind'), async () => { try { await api(`issues/${id}/remind`, 'POST', {}); toast('Erinnerung verschickt.'); GK.closeDialog(); } catch (e) { fail(e); } }));
    x('slCode', () => GK.busy($('slCode'), async () => { try { const c = await api(`issues/${id}/code`, 'POST', {}); codeDialog(c.code, r.person); } catch (e) { fail(e); } }));
    x('slDrop', async () => { if (!await GK.ask('Übergabe verwerfen?\n\nDie reservierten Schlüssel sind danach wieder vorrätig.')) return; try { await api('issues/' + id, 'DELETE'); GK.closeDialog(); reload(); } catch (e) { fail(e); } });
    x('slCancel', () => cancelDialog(id, r));
    x('slCatch', async () => {
      const tpls = await api('templates'); const types = r.pieces.map(p => ({ ident: p.ident, name: p.name }));
      signDialog({ body: { template_id: tpls.list[0].id, issued_by: st.meta.user }, minor: false, who: r.person, tpl: tpls.list[0], types, url: `issues/${id}/catchup`, after: 'nachholen' });
    });
  }
  function cancelDialog(id, r) {
    const P = pads([['slC1', 'Storniert von – Unterschrift (freiwillig)']]);
    GK.dialog(`<h2>Ausgabe stornieren</h2><p class="muted" style="margin-top:-4px">Die Schlüssel sind danach wieder vorrätig. Das Protokoll bleibt sichtbar, durchgestrichen – bei einem Fehler danach neu ausgeben.</p>
      <label class="f">Grund<input id="slCr" maxlength="200" placeholder="z. B. falsche Person erfasst"></label>${P.html}<div class="btns"><button class="btn ghost" id="slX">Zurück</button><button class="btn primary" id="slOk">Stornieren</button></div>`);
    const ps = P.mount(); $('slX').onclick = () => detail(id);
    $('slOk').onclick = () => GK.busy($('slOk'), async () => { try { const x = await api(`issues/${id}/cancel`, 'POST', { reason: $('slCr').value, ...(ps[0].ok() ? { sig_taker: ps[0].png() } : {}) }); doneDialog(x.no, x.protocol); } catch (e) { fail(e); } });
  }

  /* ---------- alte Nummern übernehmen ---------- */
  async function adoptDialog() {
    let a, t; try { [a, t] = await Promise.all([api('adopt'), api('types')]); } catch (e) { return fail(e); }
    if (!t.list.length) return toast('Bitte zuerst im Reiter „Bestand“ die Sorten anlegen.', true);
    GK.dialog(`<h2>Schlüsselnummern übernehmen</h2><p class="muted" style="margin-top:-4px">Diese Mitglieder haben in der Mitgliederverwaltung eine Schlüsselnummer. Sie werden als „übernommen, ohne Protokoll“ geführt – das Protokoll holst du später mit einem Klick nach.</p>
      <div class="card flush" style="margin:0 0 14px"><table class="tbl kompakt"><tr><th>Mitglied</th><th>Nummer</th><th>Sorte</th></tr>${a.list.map((x, i) => `<tr><td><b translate="no">${esc(x.name)}</b></td><td class="num">${esc(x.no)}</td>
        <td><select data-i="${i}"><option value="">– nicht übernehmen –</option>${t.list.map(y => `<option value="${y.id}" ${y.id === x.type_id ? 'selected' : ''}>${esc(y.ident)} ${esc(y.name)}</option>`).join('')}</select></td></tr>`).join('')}</table></div>
      <div class="btns"><button class="btn ghost" id="slX">Abbrechen</button><button class="btn primary" id="slOk">Übernehmen</button></div>`, true);
    $('slX').onclick = GK.closeDialog;
    $('slOk').onclick = () => GK.busy($('slOk'), async () => {
      const items = [...$('dialog').querySelectorAll('[data-i]')].filter(s => s.value).map(s => ({ member_id: a.list[+s.dataset.i].member_id, no: a.list[+s.dataset.i].no, type_id: +s.value }));
      if (!items.length) return toast('Bitte mindestens eine Sorte zuordnen.', true);
      try { const r = await api('adopt', 'POST', { items }); GK.closeDialog(); toast(`${r.count} übernommen.`); reload(); } catch (e) { fail(e); }
    });
  }

  /* ================================================================ Bestand */
  async function showStock(el) {
    const d = await api('types');
    el.innerHTML = `<div class="toolbar"><button class="btn primary" id="slAddT">+ Sorte</button></div><div class="card">${d.list.length ? `<table class="tbl kompakt k-name-voll sel sl-t"><tr><th>Sorte</th><th>Schließt</th><th class="r">Vorrätig</th><th class="r">Ausgegeben</th><th class="r">Verloren</th><th></th></tr>
      ${d.list.map(t => `<tr data-t="${t.id}"><td><div class="sl-k"><span class="sl-ico">${ico(t)}</span><span><b class="num">${esc(t.ident)}</b> <span translate="no">${esc(t.name)}</span>${t.sensitive ? ' <span class="pill r k-weg">sicherheitsrelevant</span>' : ''}<div class="muted s k-weg">${esc(t.kind_label)}${t.deposit_cents ? ` · Pfand ${esc(eur(t.deposit_cents))}` : ''}</div></span></div></td>
        <td class="k-weg" translate="no">${esc(t.opens)}</td><td class="r" data-label="Vorrätig"><b class="num">${t.free}</b> <span class="muted s">von ${t.total}</span></td><td class="r" data-label="Ausgegeben">${t.out ? num(t.out) : '–'}</td><td class="r" data-label="Verloren">${t.lost ? num(t.lost) : '–'}</td>
        <td class="r"><span class="acts"><button class="btn ico" data-te="${t.id}" title="Bearbeiten" aria-label="Bearbeiten">${EDIT}</button></span></td></tr>`).join('')}</table>`
      : '<p class="empty">Noch keine Schlüssel – mit „+ Sorte“ legst du die erste Sorte an (z. B. „Clubhaus Haupteingang“, 10 Stück).</p>'}</div>`;
    st.types = d.list;
    $('slAddT').onclick = () => typeDialog(null, el);
    el.querySelectorAll('[data-t]').forEach(tr => { tr.onclick = e => { if (e.target.closest('button')) return; typeDialog(d.list.find(t => t.id === +tr.dataset.t), el); }; });
    el.querySelectorAll('[data-te]').forEach(b => { b.onclick = () => typeDialog(d.list.find(t => t.id === +b.dataset.te), el); });
  }
  async function typeDialog(t, el) {
    const pcs = t ? (await api('pieces?type=' + t.id)).list : [];
    const kinds = st.meta.kinds;
    GK.dialog(`<h2>${t ? `Nr. ${esc(t.ident)} – bearbeiten` : 'Neue Sorte'}</h2>
      <div class="frm"><label class="f">Kennung<input id="stId" maxlength="20" value="${esc(t ? t.ident : '')}" placeholder="z. B. 08 oder T-14"></label><label class="f w2">Bezeichnung<input id="stNm" maxlength="80" value="${esc(t ? t.name : '')}" placeholder="z. B. Clubhaus Haupteingang"></label>
        <label class="f">Art<select id="stKd">${Object.entries(kinds).map(([k, l]) => `<option value="${k}" ${t && t.kind === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="f wall">Schließt<textarea id="stOp" data-grow rows="1" maxlength="200" placeholder="z. B. Haupteingang, Umkleiden">${esc(t ? t.opens : '')}</textarea></label>
        <label class="f">Pfand (€)<input id="stDp" inputmode="decimal" value="${t && t.deposit_cents ? (t.deposit_cents / 100).toFixed(2).replace('.', ',') : ''}" placeholder="0,00"></label>
        ${t ? '' : '<label class="f">Anzahl Stück<input id="stCt" inputmode="numeric" value="1"></label>'}<label class="f wall">Notiz<input id="stNo" maxlength="500" value="${esc(t ? t.note : '')}"></label></div>
      <label class="chk"><input type="checkbox" id="stSe" ${t && t.sensitive ? 'checked' : ''}> Sicherheitsrelevant (z. B. Generalschlüssel) – ein Verlust löst eine rote Sicherheitswarnung aus</label>
      ${t ? `<h3 style="margin:18px 0 8px">Stück (${pcs.length})</h3><div class="card flush" style="margin:0 0 12px"><table class="tbl kompakt"><tr><th>Nummer</th><th>Status</th><th></th></tr>${pcs.map(p => `<tr><td><b class="num">${esc(p.label)}</b>${p.note ? `<div class="muted s">${esc(p.note)}</div>` : ''}</td>
          <td><span class="pill ${p.status === 'vorraetig' ? 'g' : p.status === 'verloren' ? 'r' : p.status === 'gesperrt' ? 'a' : ''}">${{ vorraetig: 'vorrätig', reserviert: 'reserviert', ausgegeben: 'ausgegeben', verloren: 'verloren', gesperrt: 'gesperrt', ausgemustert: 'ausgemustert' }[p.status]}</span></td>
          <td class="r">${['vorraetig', 'gesperrt', 'ausgemustert', 'verloren'].includes(p.status) ? `<select data-ps="${p.id}" aria-label="Status ändern"><option value="">ändern …</option>${['vorraetig', 'gesperrt', 'ausgemustert'].filter(s => s !== p.status).map(s => `<option value="${s}">${{ vorraetig: 'vorrätig', gesperrt: 'gesperrt (in fremdem System)', ausgemustert: 'ausmustern' }[s]}</option>`).join('')}</select>` : ''}</td></tr>`).join('')}</table></div>
        <div class="row" style="align-items:flex-end"><label class="f" style="flex:0 1 160px">Stück ergänzen<input id="stAdd" inputmode="numeric" placeholder="Anzahl"></label><button class="btn" id="stAddGo">Ergänzen</button></div>` : ''}
      <div class="btns"><button class="btn ghost" id="stX">Abbrechen</button><button class="btn primary" id="stOk">Speichern</button></div>
      ${t ? '<div class="dz"><button class="btn ghost danger" id="stDel">Sorte löschen …</button></div>' : ''}`, true);
    $('stX').onclick = GK.closeDialog;
    const body = () => ({ ident: $('stId').value, name: $('stNm').value, kind: $('stKd').value, opens: $('stOp').value, deposit_cents: Math.round((parseFloat(String($('stDp').value).replace(',', '.')) || 0) * 100), note: $('stNo').value, sensitive: $('stSe').checked, ...(t ? {} : { count: parseInt($('stCt').value, 10) || 1 }) });
    $('stOk').onclick = () => GK.busy($('stOk'), async () => { try { await (t ? api('types/' + t.id, 'PUT', body()) : api('types', 'POST', body())); GK.closeDialog(); toast('Gespeichert.'); showStock(el); } catch (e) { fail(e); } });
    if (t) {
      $('dialog').querySelectorAll('[data-ps]').forEach(s => { s.onchange = async () => { if (!s.value) return; try { await api('pieces/' + s.dataset.ps, 'PUT', { status: s.value }); typeDialog(t, el); showStock(el); } catch (e) { fail(e); } }; });
      $('stAddGo').onclick = async () => { try { await api(`types/${t.id}/pieces`, 'POST', { count: parseInt($('stAdd').value, 10) }); toast('Ergänzt.'); const d = await api('types'); typeDialog(d.list.find(x => x.id === t.id), el); showStock(el); } catch (e) { fail(e); } };
      $('stDel').onclick = async () => { if (!await GK.ask(`Sorte „${t.name}“ löschen?\n\nDas geht nur, solange es dazu kein Protokoll gibt.`)) return; try { await api('types/' + t.id, 'DELETE'); GK.closeDialog(); showStock(el); } catch (e) { fail(e); } };
    }
  }

  /* ================================================================ Protokolle */
  async function showProtocols(el) {
    const d = await api('protocols');
    el.innerHTML = `<div class="card">${d.list.length ? `<table class="tbl kompakt"><tr><th>Nr.</th><th>Art</th><th>Person</th><th>Datum</th><th></th></tr>
      ${d.list.map(p => `<tr class="${p.cancelled ? 'off' : ''}"><td><b class="num">${esc(p.no)}</b></td><td data-label="Art">${{ ausgabe: 'Ausgabe', rueckgabe: 'Rückgabe', verlust: 'Verlust', storno: 'Stornierung' }[p.kind]}${p.cancelled ? ' <span class="pill">storniert</span>' : ''}</td><td translate="no">${esc(p.person)}</td>
        <td class="nw" data-label="Datum">${num(dt(p.at))}</td><td class="r">${p.pdf ? `<a class="btn small" href="${BASE}protocols/${p.id}/pdf" target="_blank" rel="noopener">PDF</a>` : ''}</td></tr>`).join('')}</table>`
      : '<p class="empty">Noch keine Protokolle – sie entstehen bei jeder Ausgabe, Rücknahme und Verlustmeldung.</p>'}</div>`;
  }

  /* ================================================================ Einstellungen */
  async function showSettings(el) {
    const [s, tp] = await Promise.all([api('settings'), api('templates')]), c = s.cfg;
    el.innerHTML = `<div class="card" data-card="bedingungen"><h3>Bedingungen</h3>
        <p class="muted s" style="margin-top:0">Der Text steht im Protokoll. Er wird beim Unterschreiben eingefroren – spätere Änderungen betreffen nur neue Ausgaben. Platzhalter: <code>{Verein}</code>, <code>{Höchstbetrag}</code>, <code>{Frist}</code>.</p>
        ${tp.list.map(t => `<div class="row" style="align-items:center;margin-bottom:8px"><b style="flex:1 1 auto" translate="no">${esc(t.name)}</b><button class="btn small" data-te="${t.id}">Bearbeiten</button></div>`).join('')}
        <div class="btns"><button class="btn" id="slTplNew">+ Vorlage</button></div></div>
      <div class="card" data-card="verlust"><h3>Verlust und Aufbewahrung</h3><div class="frm">
        <label class="f">Höchstbetrag bei Verlust (€)<input id="seMax" inputmode="decimal" value="${(c.max_cost_cents / 100).toFixed(2).replace('.', ',')}"></label>
        <label class="f">Protokolle ohne Pfand aufbewahren (Monate)<input id="seK1" inputmode="numeric" value="${c.keep_ohnepfand}"></label>
        <label class="f">Protokolle mit Pfand oder Kosten (Monate)<input id="seK2" inputmode="numeric" value="${c.keep_mitpfand}"></label></div>
        <p class="muted s">Laufende Ausgaben bleiben immer gespeichert. Nach der Frist werden Protokoll, Unterschriften und PDF zusammen gelöscht (Einstellungen › Datenschutz).</p></div>
      <div class="card" data-card="e-mail"><h3>E-Mail</h3>
        <label class="chk"><input type="checkbox" id="seMail" ${c.mail_on ? 'checked' : ''}> Protokoll als PDF an die Person schicken (wenn eine Adresse bekannt ist)</label>
        <label class="f" style="margin-top:12px">Kopie an (optional)<input id="seCc" value="${esc(c.cc)}" placeholder="z. B. vorstand@dein-verein.de"></label>
        ${s.mailReady ? '' : '<p class="muted s">Es ist noch kein Postfach eingerichtet (Einstellungen › Postfach).</p>'}
        <div class="btns"><button class="btn primary" id="seSave">Speichern</button></div></div>
      <div id="slFunc"></div>`;
    el.querySelectorAll('[data-te]').forEach(b => { b.onclick = () => tplDialog(tp.list.find(t => t.id === +b.dataset.te), el); });
    $('slTplNew').onclick = () => tplDialog(null, el);
    $('seSave').onclick = () => GK.busy($('seSave'), async () => {
      try { await api('settings', 'PUT', { max_cost_cents: Math.round((parseFloat(String($('seMax').value).replace(',', '.')) || 0) * 100), keep_ohnepfand: $('seK1').value, keep_mitpfand: $('seK2').value, mail_on: $('seMail').checked, cc: $('seCc').value }); toast('Gespeichert.'); showSettings(el); }
      catch (e) { fail(e); }
    });
    if (GK.funcBox) GK.funcBox($('slFunc'), 'schluessel', 'Schlüssel', () => showSettings(el));
  }
  function tplDialog(t, el) {
    GK.dialog(`<h2>${t ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h2><label class="f">Name<input id="tpNm" maxlength="60" value="${esc(t ? t.name : '')}" placeholder="z. B. Trainer"></label>
      <label class="f" style="margin-top:12px">Text der Bedingungen<textarea id="tpTx" style="min-height:220px" maxlength="6000">${esc(t ? t.text : '')}</textarea></label>
      <p class="muted s">Platzhalter: {Verein}, {Höchstbetrag}, {Frist}. Keine Rechtsberatung – den Text bitte mit dem Vorstand abstimmen.</p>
      <div class="btns"><button class="btn ghost" id="tpX">Abbrechen</button><button class="btn primary" id="tpOk">Speichern</button></div>${t ? '<div class="dz"><button class="btn ghost danger" id="tpDel">Vorlage löschen …</button></div>' : ''}`, true);
    $('tpX').onclick = GK.closeDialog;
    $('tpOk').onclick = () => GK.busy($('tpOk'), async () => { try { const b = { name: $('tpNm').value, text: $('tpTx').value }; await (t ? api('templates/' + t.id, 'PUT', b) : api('templates', 'POST', b)); GK.closeDialog(); toast('Gespeichert.'); showSettings(el); } catch (e) { fail(e); } });
    if (t) $('tpDel').onclick = async () => { if (!await GK.ask(`Vorlage „${t.name}“ löschen?`)) return; try { await api('templates/' + t.id, 'DELETE'); GK.closeDialog(); showSettings(el); } catch (e) { fail(e); } };
  }

  /* ================================================================ Seite */
  async function render() {
    await meta();
    $('main').innerHTML = `<h2 class="page">Schlüssel</h2><p class="lead">Wer hat welchen Schlüssel? Hier gibst du Schlüssel mit Protokoll aus, nimmst sie zurück und siehst, was fehlt.</p><div id="slTabs"></div>`;
    st.tabs = GK.tabs($('slTabs'), 'schluessel', [['ausgegeben', 'Ausgegeben'], ['bestand', 'Bestand'], ['protokolle', 'Protokolle'], ['einstellungen', 'Einstellungen']], async (k, el) => {
      if (k === 'bestand') return showStock(el);
      if (k === 'protokolle') return showProtocols(el);
      if (k === 'einstellungen') return showSettings(el);
      return showIssues(el);
    });
  }
  GK.registerPage({ key: 'schluessel', title: 'Schlüssel', perm: 'schluessel', render, icon: 'schluessel', order: 6.6, bereich: 'anlage' });
  if (GK.registerSearch) GK.registerSearch([
    { label: 'Wer hat welchen Schlüssel?', page: 'schluessel', tab: ['schluessel', 'ausgegeben'], kind: 'reiter', in: 'Ausgegeben', words: 'Ausgabe Schlüssel Transponder Person zurückfordern' },
    { label: 'Schlüssel ausgeben', page: 'schluessel', tab: ['schluessel', 'ausgegeben'], btn: 'Schlüssel ausgeben', kind: 'aktion', in: 'Ausgegeben', words: 'Übergabe Protokoll Unterschrift Transponder', boost: 1 },
    { label: 'Schlüsselbestand', page: 'schluessel', tab: ['schluessel', 'bestand'], kind: 'reiter', in: 'Bestand', words: 'Sorte Stück Transponder Karte vorrätig' },
    { label: 'Sorte anlegen', page: 'schluessel', tab: ['schluessel', 'bestand'], btn: '+ Sorte', kind: 'aktion', in: 'Bestand', words: 'Schlüssel neu Transponder' },
    { label: 'Schlüsselprotokolle', page: 'schluessel', tab: ['schluessel', 'protokolle'], kind: 'reiter', in: 'Protokolle', words: 'PDF Rückgabe Verlust Storno Übergabe' },
    { label: 'Bedingungen der Schlüsselübergabe', page: 'schluessel', tab: ['schluessel', 'einstellungen'], card: 'Bedingungen', in: 'Einstellungen', words: 'Vorlage Text Haftung Pfand' },
    { label: 'Aufbewahrung der Schlüsselprotokolle', page: 'schluessel', tab: ['schluessel', 'einstellungen'], card: 'Verlust und Aufbewahrung', in: 'Einstellungen', words: 'Höchstbetrag löschen Frist' },
    { label: 'Schlüssel: E-Mail mit PDF', page: 'schluessel', tab: ['schluessel', 'einstellungen'], card: 'E-Mail', in: 'Einstellungen', words: 'Kopie Protokoll' },
  ]);
})();
