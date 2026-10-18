'use strict';
/* Verwaltung „Buchhaltung“: Rechnungen · Firmen & Sponsoren · Spendenquittungen · Einstellungen */
(() => {
  const GK = window.GK;
  const { $, esc, euro, toast, fail, dialog, closeDialog, ask, askText, deDate, toCents, centsToInput } = GK;
  const api = (url, method, body) => GK.api('x/buchhaltung/' + url, method, body);
  const BASE = 'api/admin/x/buchhaltung/';
  const st = { meta: null, inv: { status: 'offen', year: '' }, don: { year: '' } };
  const ISTAT = { offen: ['a', 'offen'], bezahlt: ['g', 'bezahlt'], storniert: ['', 'storniert'] };
  const DKIND = { geld: 'Geldspende', sach: 'Sachspende', verzicht: 'Verzicht auf Aufwandserstattung' };
  const VIA = { ueberweisung: 'Überweisung', bar: 'bar', lastschrift: 'Lastschrift', verrechnet: 'verrechnet', Mitgliederverwaltung: 'über die Mitgliederverwaltung' };
  const opt = (v, l, sel) => `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
  const val = id => ($(id) ? $(id).value.trim() : undefined);
  const pill = ([c, t]) => `<span class="pill ${c}">${esc(t)}</span>`;

  if (!document.getElementById('bhStyle')) {
    const s = document.createElement('style'); s.id = 'bhStyle';
    s.textContent = `
      .bh-grid { display: grid; grid-template-columns: repeat(var(--c, 3), minmax(0, 1fr)); gap: 14px 16px; }
      .bh-grid .w2 { grid-column: span 2; } .bh-grid .wall { grid-column: 1 / -1; }
      @media (max-width: 900px) { .bh-grid { grid-template-columns: 1fr 1fr; } .bh-grid .w2 { grid-column: 1 / -1; } }
      @media (max-width: 560px) { .bh-grid { grid-template-columns: 1fr; } }
      #dialog .seg { width: fit-content; max-width: 100%; margin: 0 0 14px; }
      .bh-items { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 8px; }
      .bh-item { display: grid; grid-template-columns: minmax(0, 1fr) 76px 116px 92px 40px; gap: 8px; align-items: center; }
      .bh-item.h { font-size: 12px; letter-spacing: .05em; text-transform: uppercase; color: var(--faint); font-weight: 700; }
      .bh-item input, .bh-item select { width: 100%; min-width: 0; box-sizing: border-box; height: 40px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--field); font: inherit; font-size: 14px; font-weight: 500; color: var(--ink); }
      .bh-item input:focus, .bh-item select:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
      .bh-item > span { padding: 0 2px; }
      label.f.bh-yr { flex-direction: row; align-items: center; gap: 8px; } label.f.bh-yr select { width: auto; min-width: 96px; }
      #biHint:empty { display: none; }
      .bh-item .n { text-align: right; }
      @media (max-width: 640px) { .bh-item { grid-template-columns: 1fr 1fr 40px; } .bh-item .t { grid-column: 1 / -1; } .bh-item.h { display: none; } .bh-item .q { grid-column: 1; } .bh-item .u { grid-column: 2; } .bh-item .v { grid-column: 1 / span 2; } }
      .bh-sum { display: grid; grid-template-columns: auto auto; justify-content: end; gap: 4px 24px; font-variant-numeric: tabular-nums; margin: 8px 0 4px; }
      .bh-sum span:nth-child(even) { text-align: right; } .bh-sum .tot { font-weight: 800; font-size: 16px; }
      .bh-acts { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
      .bh-sub { display: block; font-size: 12.5px; color: var(--muted); margin-top: 2px; }
      .bh-tbl td { height: 52px; }
      @media (max-width: 760px) { .bh-tbl .hm { display: none; } }`;
    document.head.appendChild(s);
  }

  const PAGE = {
    'bh-rechnungen': ['Rechnungen', 'Rechnungen an Firmen, Sponsoren und Mitglieder – mit fortlaufender Nummer, Umsatzsteuer je Position und Zahlungserinnerung.'],
    'bh-firmen': ['Firmen & Sponsoren', 'Einmal anlegen, jedes Jahr wiederverwenden: Anschrift, Ansprechperson und die jährlichen Positionen (z. B. Bandenwerbung).'],
    'bh-spenden': ['Spendenquittungen', 'Zuwendungsbestätigungen nach amtlichem Muster – Geldspende, Sachspende oder Verzicht auf Aufwandserstattung.'],
    'bh-einstellungen': ['Einstellungen', 'Absender, Steuerangaben, Bankkonten und die Angaben zum Freistellungsbescheid.'],
  };
  const loadMeta = async () => { st.meta = await api('meta'); return st.meta; };
  function pageRender(key, fn) {
    return async () => {
      const m = await loadMeta(), [title, lead] = PAGE[key];
      const s = m.settings;
      const noBank = key === 'bh-rechnungen' && !m.accounts.length;
      const noFa = key === 'bh-spenden' && !m.donationReady;
      $('main').innerHTML = `<h2 class="page">${esc(title)}</h2><p class="lead">${esc(lead)}</p>
        ${noBank ? '<div class="banner a"><span>Für Rechnungen fehlt noch ein Bankkonto des Vereins.</span><a href="#einstellungen" data-bank>Anlegen →</a></div>' : ''}
        ${noFa ? '<div class="banner a"><span>Für Spendenquittungen fehlen noch die Angaben zum Freistellungsbescheid.</span><a href="#bh-einstellungen">Eintragen →</a></div>' : ''}
        <div id="bhBody"></div>`;
      $('main').querySelectorAll('[data-bank]').forEach(a => { a.onclick = e => { e.preventDefault(); GK.openSettings ? GK.openSettings('bank') : GK.go('einstellungen'); }; });
      await fn($('bhBody'));
    };
  }
  const nameOf = (list, id) => (list.find(x => x.id === id) || {}).name || '';

  /* ---------------- Positionen-Editor (Rechnungen und Jahrespositionen) ---------------- */
  function itemsEditor(box, items, { onChange } = {}) {
    const vatDef = st.meta.settings.vat_default;
    const sb = st.meta.settings.small_business;
    let rows = (items && items.length ? items : [{ text: '', qty: 1, unit_cents: 0, vat: vatDef }]).map(x => ({ ...x }));
    const read = () => { box.querySelectorAll('.bh-item[data-i]').forEach(r => { const i = +r.dataset.i; rows[i] = { text: r.querySelector('.t').value, qty: Number(String(r.querySelector('.q').value).replace(',', '.')) || 0, unit_cents: toCents(r.querySelector('.u').value || '0'), vat: sb ? 0 : +r.querySelector('.v').value }; }); };
    const sums = () => {
      let net = 0; const by = {};
      for (const r of rows) { if (!r.text.trim()) continue; const l = Math.round(r.qty * r.unit_cents); net += l; by[r.vat] = (by[r.vat] || 0) + l; }
      const vats = Object.entries(by).filter(([v]) => +v > 0).map(([v, n]) => [v, Math.round(n * v / 100)]);
      const vat = vats.reduce((s, x) => s + x[1], 0);
      return { net, vats, gross: net + vat };
    };
    const paint = () => {
      const t = sums();
      box.innerHTML = `<div class="bh-items"><div class="bh-item h"><span>Leistung</span><span class="n">Menge</span><span class="n">${sb ? 'Preis' : 'Preis netto'}</span><span>${sb ? '' : 'USt'}</span><span></span></div>
        ${rows.map((r, i) => `<div class="bh-item" data-i="${i}"><input class="t" value="${esc(r.text)}" placeholder="z. B. Bandenwerbung Sportplatz 3 × 1 m" aria-label="Leistung">
          <input class="q n" value="${esc(String(r.qty).replace('.', ','))}" inputmode="decimal" aria-label="Menge">
          <input class="u n" value="${r.unit_cents ? centsToInput(r.unit_cents) : ''}" inputmode="decimal" placeholder="0,00" aria-label="Einzelpreis">
          ${sb ? '<span class="v"></span>' : `<select class="v" aria-label="Umsatzsteuer">${[19, 7, 0].map(v => opt(v, v ? v + ' %' : 'ohne', r.vat)).join('')}</select>`}
          <button class="btn small ghost" data-rm="${i}" aria-label="Position entfernen" ${rows.length < 2 ? 'disabled' : ''}>✕</button></div>`).join('')}</div>
        <div class="row" style="justify-content:space-between;align-items:flex-start"><button class="btn small" data-add>+ Position</button>
          <div class="bh-sum"><span>Netto</span><span>${euro(t.net)}</span>${t.vats.map(([v, c]) => `<span>USt ${v} %</span><span>${euro(c)}</span>`).join('')}<span class="tot">Gesamt</span><span class="tot">${euro(t.gross)}</span></div></div>
        ${sb ? '<p class="muted s" style="margin:0">Kleinunternehmer: keine Umsatzsteuer (§ 19 UStG) – der Hinweis steht auf der Rechnung.</p>' : ''}`;
      box.querySelector('[data-add]').onclick = () => { read(); rows.push({ text: '', qty: 1, unit_cents: 0, vat: vatDef }); paint(); box.querySelector(`.bh-item[data-i="${rows.length - 1}"] .t`).focus(); };
      box.querySelectorAll('[data-rm]').forEach(b => { b.onclick = () => { read(); rows.splice(+b.dataset.rm, 1); paint(); }; });
      box.querySelectorAll('input, select').forEach(x => { x.onchange = () => { read(); paint(); if (onChange) onChange(); }; });
    };
    paint();
    return { get: () => { read(); return rows.filter(r => r.text.trim()); } };
  }

  /* ---------------- Rechnungen ---------------- */
  async function showInvoices(el) {
    const m = st.meta, f = st.inv, k = m.kpis;
    const q = new URLSearchParams({ status: f.status, ...(f.year ? { year: f.year } : {}) });
    const rows = await api('invoices?' + q);
    const years = []; for (let y = m.year; y >= m.year - 5; y--) years.push(y);
    el.innerHTML = `<div class="kpis"><div class="kpi"><div class="l">Offen</div><div class="v">${euro(k.open.c)}</div><div class="s muted">${k.open.n} Rechnung(en)</div></div>
        <div class="kpi"><div class="l">Überfällig</div><div class="v ${k.overdue.n ? 'neg' : ''}">${euro(k.overdue.c)}</div><div class="s muted">${k.overdue.n} Rechnung(en)</div></div>
        <div class="kpi"><div class="l">Bezahlt ${m.year}</div><div class="v">${euro(k.paidYear.c)}</div><div class="s muted">${k.paidYear.n} Rechnung(en)</div></div></div>
      <div class="filterbar"><div class="seg" id="biS">${[['offen', 'Offen'], ['ueber', 'Überfällig'], ['bezahlt', 'Bezahlt'], ['storniert', 'Storniert'], ['alle', 'Alle']].map(([k, l]) => `<button type="button" data-f="${k}" class="${f.status === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <label class="f bh-yr">Jahr<select id="biY" data-nodirty>${opt('', 'alle', f.year)}${years.map(y => opt(y, y, f.year)).join('')}</select></label>
        <span style="flex:1"></span><button class="btn" id="biYear">Jahresrechnungen …</button><button class="btn primary" id="biNew">+ Neue Rechnung</button></div>
      <div class="card" style="padding:0;overflow:auto">${rows.length ? `<table class="tbl bh-tbl"><tr><th>Nr.</th><th>Empfänger</th><th class="hm">Datum</th><th class="hm">Fällig</th><th class="r">Betrag</th><th>Status</th><th></th></tr>
        ${rows.map(r => `<tr class="${r.status === 'storniert' ? 'off' : ''}"><td class="nw"><b>${esc(r.no)}</b></td>
          <td><b>${esc(r.recipient.name)}</b><span class="bh-sub">${r.kind === 'member' ? 'Mitglied' : 'Firma'}${r.period ? ' · ' + esc(r.period) : ''}${r.sent_at ? ' · verschickt' : ''}${r.reminders ? ` · ${r.reminders}× erinnert` : ''}</span></td>
          <td class="hm nw">${deDate(r.date)}</td><td class="hm nw ${r.overdue ? 'neg' : ''}">${deDate(r.due_date)}</td><td class="r"><b>${euro(r.gross)}</b></td>
          <td>${pill(r.overdue ? ['r', 'überfällig'] : ISTAT[r.status])}${r.status === 'bezahlt' && r.paid_at ? `<span class="bh-sub">${deDate(r.paid_at)}</span>` : ''}</td>
          <td><div class="bh-acts"><a class="btn small" href="${BASE}invoices/${r.id}/pdf" target="_blank" rel="noopener">PDF</a><button class="btn small" data-inv="${r.id}">…</button></div></td></tr>`).join('')}</table>`
        : `<p class="muted" style="padding:24px;margin:0;text-align:center">Keine Rechnungen${f.status !== 'alle' ? ' mit diesem Status' : ''}.</p>`}</div>`;
    $('biS').querySelectorAll('button').forEach(b => { b.onclick = () => { f.status = b.dataset.f; showInvoices(el).catch(fail); }; });
    $('biY').onchange = () => { f.year = val('biY'); showInvoices(el).catch(fail); };
    const reload = async () => { await loadMeta(); await showInvoices(el); if (GK.refreshBadges) GK.refreshBadges(); };
    $('biNew').onclick = () => invoiceDialog({}, reload);
    $('biYear').onclick = () => yearlyDialog(reload).catch(fail);
    el.querySelectorAll('[data-inv]').forEach(b => { b.onclick = () => invoiceActions(rows.find(r => r.id === +b.dataset.inv), reload); });
  }

  function invoiceDialog(pre, after) {
    const m = st.meta;
    let kind = pre.kind || 'partner';
    const due = d => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + m.settings.due_days); return x.toISOString().slice(0, 10); };
    const activePartners = m.partners.filter(p => p.active);
    dialog(`<h2>Neue Rechnung</h2>
      <div class="seg" role="tablist"><button data-k="partner">an Firma / Sponsor</button><button data-k="member">an Mitglied</button></div>
      <div class="bh-grid" style="--c:3">
        <label class="f wall" id="biRecL">Empfänger<select id="biRec"></select><span class="muted s" id="biHint" style="font-weight:500"></span></label>
        <label class="f">Rechnungsdatum<input id="biD" type="date" value="${m.today}"></label>
        <label class="f">Zahlbar bis<input id="biDue" type="date" value="${due(m.today)}"></label>
        <label class="f">Leistungszeitraum<input id="biPer" placeholder="z. B. Saison ${m.year}/${String(m.year + 1).slice(2)}"></label>
        ${m.departments.length ? `<label class="f">Abteilung (optional)<select id="biDep">${opt('', '– Verein –')}${m.departments.map(d => opt(d.id, d.name)).join('')}</select></label>` : ''}
        <label class="f ${m.departments.length ? 'w2' : 'wall'}">Konto auf der Rechnung<select id="biAcc"></select></label>
      </div>
      <h3 style="margin:18px 0 6px">Positionen</h3><div id="biItems"></div>
      <label class="f" style="margin-top:10px">Hinweis auf der Rechnung (optional)<textarea id="biNote" rows="2" placeholder="z. B. Vielen Dank für die Unterstützung unserer Jugendabteilung!"></textarea></label>
      <label class="chk" style="margin-top:10px"><input type="checkbox" id="biSend" ${m.mail ? '' : 'disabled'}> gleich per E-Mail an den Empfänger senden${m.mail ? '' : ' <span class="muted s">(kein Postfach eingerichtet)</span>'}</label>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="biOk">Rechnung erstellen</button></div>`, true);
    let ed = null;
    const fillRec = () => {
      el('[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === kind));
      const list = kind === 'partner' ? activePartners : m.members;
      $('biRec').innerHTML = `<option value="">– bitte wählen –</option>${list.map(x => opt(x.id, kind === 'member' ? `${GK.lastFirst(x.name, 'mitglied')}${x.member_no ? ' (' + x.member_no + ')' : ''}${x.active ? '' : ' – inaktiv'}` : x.name, kind === 'partner' ? pre.partner_id : pre.member_id)).join('')}`;
      $('biHint').textContent = kind === 'member' ? (m.mv ? 'wird zusätzlich offener Posten beim Mitglied' : '') : (activePartners.length ? '' : 'noch keine Firma angelegt');
      if (kind === 'partner' && !activePartners.length) $('biHint').innerHTML = '<a href="#bh-firmen" id="biToP">Firma anlegen →</a>';
      if ($('biToP')) $('biToP').onclick = closeDialog;
    };
    function el(sel) { return $('dialog').querySelectorAll(sel); }
    el('[data-k]').forEach(b => { b.onclick = () => { kind = b.dataset.k; fillRec(); if (typeof fillAcc === 'function') fillAcc(); }; });
    $('biRec').onchange = () => {   // Firma gewählt: Jahrespositionen vorschlagen, wenn noch nichts eingetragen ist
      if (kind !== 'partner') return;
      const cur = ed.get();
      if (cur.length && cur.some(x => x.unit_cents)) return;
      api('partners').then(ps => { const p = ps.find(x => x.id === +val('biRec')); if (p && p.items.length) ed = itemsEditor($('biItems'), p.items); }).catch(() => {});
    };
    $('biD').onchange = () => { if (val('biD')) $('biDue').value = due(val('biD')); };
    // Konto: Abteilung (gewählt oder von der Firma) → zugeordnetes Konto, sonst Standardkonto
    let accTouched = false;
    const accFor = dep => (dep && m.accounts.find(a => a.departments.includes(+dep))) || m.accounts.find(a => a.is_default) || m.accounts[0];
    const fillAcc = () => {
      if (accTouched) return;
      const pDep = kind === 'partner' ? (m.partners.find(x => x.id === +val('biRec')) || {}).department_id : null;
      if ($('biDep') && pDep && !val('biDep')) $('biDep').value = String(pDep);
      const a = accFor($('biDep') ? val('biDep') : pDep);
      $('biAcc').innerHTML = m.accounts.length ? m.accounts.map(x => opt(x.id, `${x.name} · ${x.iban.slice(0, 4)} … ${x.iban.slice(-4)}`, a && a.id)).join('') : '<option value="">kein Bankkonto angelegt</option>';
    };
    $('biAcc').onchange = () => { accTouched = true; };
    if ($('biDep')) $('biDep').onchange = fillAcc;
    const recChange = $('biRec').onchange; $('biRec').onchange = () => { recChange(); fillAcc(); };
    fillRec(); fillAcc();
    ed = itemsEditor($('biItems'), pre.items);
    $('c').onclick = closeDialog;
    $('biOk').onclick = async () => {
      const body = { kind, partner_id: kind === 'partner' ? +val('biRec') || null : null, member_id: kind === 'member' ? +val('biRec') || null : null, period: val('biPer'), department_id: $('biDep') ? +val('biDep') || null : null, account_id: +val('biAcc') || null, date: val('biD'), due_date: val('biDue'), items: ed.get(), note: $('biNote').value, send: $('biSend').checked };
      if (!val('biRec')) return toast('Bitte den Empfänger wählen.', true);
      $('biOk').disabled = true;
      try {
        const r = await api('invoices', 'POST', body);
        closeDialog();
        toast(`Rechnung ${r.no} erstellt${r.sent ? ` und an ${r.to} geschickt` : ''}.`);
        after();
      } catch (e) { fail(e); $('biOk').disabled = false; }
    };
  }

  function invoiceActions(r, after) {
    const open = r.status === 'offen';
    const remindN = r.reminders + 1;
    dialog(`<h2>Rechnung ${esc(r.no)}</h2>
      <p class="muted" style="margin-top:0">${esc(r.recipient.name)} · ${euro(r.gross)} · vom ${deDate(r.date)}${r.due_date ? `, fällig ${deDate(r.due_date)}` : ''}</p>
      <table class="tbl" style="margin-bottom:12px">${r.items.map(i => `<tr><td>${esc(i.text)}</td><td class="r">${String(i.qty).replace('.', ',')} × ${euro(i.unit_cents)}</td><td class="r">${r.small_business ? '' : i.vat + ' %'}</td></tr>`).join('')}</table>
      <p class="s" style="margin:0 0 4px">Status: ${pill(r.overdue ? ['r', 'überfällig'] : ISTAT[r.status])}${r.status === 'bezahlt' ? ` am ${deDate(r.paid_at)}${r.paid_via ? ' (' + esc(VIA[r.paid_via] || r.paid_via) + ')' : ''}` : ''}${r.status === 'storniert' && r.cancel_reason ? ` – ${esc(r.cancel_reason)}` : ''}</p>
      <p class="muted s" style="margin:0">${r.sent_at ? `Verschickt am ${deDate(r.sent_at.slice(0, 10))}` : 'Noch nicht verschickt'}${r.recipient.email ? ` · ${esc(r.recipient.email)}` : ' · keine E-Mail-Adresse'}${r.reminders ? ` · ${r.reminders}. Erinnerung am ${deDate(String(r.reminded_at).slice(0, 10))}` : ''}</p>
      ${r.kind === 'member' && r.charge_id ? '<p class="muted s">Steht als offener Posten in der Mitgliederverwaltung und kann dort per Lastschrift eingezogen werden.</p>' : ''}
      <div class="btns" style="flex-wrap:wrap">
        ${r.status !== 'storniert' ? '<button class="btn ghost danger" id="iaX">Stornieren</button>' : ''}
        <span style="flex:1"></span>
        <a class="btn" href="${BASE}invoices/${r.id}/pdf" target="_blank" rel="noopener">PDF</a>
        ${r.status !== 'storniert' ? `<button class="btn" id="iaSend">${r.sent_at ? 'Erneut senden' : 'Per E-Mail senden'}</button>` : ''}
        ${open && r.due_date && r.due_date < st.meta.today ? `<button class="btn" id="iaRem">${remindN > 1 ? remindN + '. ' : ''}Erinnerung senden</button>` : ''}
        ${open && r.kind !== 'member' ? '<button class="btn primary" id="iaPaid">Als bezahlt buchen</button>' : ''}
        ${open && r.kind === 'member' && !r.charge_id ? '<button class="btn primary" id="iaPaid">Als bezahlt buchen</button>' : ''}
        ${r.status === 'bezahlt' && r.kind !== 'member' ? '<button class="btn" id="iaUn">Wieder offen</button>' : ''}
        <button class="btn ghost" id="c">Schließen</button></div>`, true);
    $('c').onclick = closeDialog;
    const run = async (p, msg) => { try { const x = await p; closeDialog(); toast(typeof msg === 'function' ? msg(x) : msg); after(); } catch (e) { fail(e); } };
    if ($('iaSend')) $('iaSend').onclick = () => run(api(`invoices/${r.id}/send`, 'POST'), x => `An ${x.to} verschickt.`);
    if ($('iaRem')) $('iaRem').onclick = async () => { if (await ask(`Zahlungserinnerung an ${r.recipient.name} senden?\n\nRechnung ${r.no} über ${euro(r.gross)}, fällig seit ${deDate(r.due_date)}.`, { ok: 'Senden', danger: false })) run(api(`invoices/${r.id}/remind`, 'POST'), x => `Erinnerung an ${x.to} verschickt.`); };
    if ($('iaUn')) $('iaUn').onclick = () => run(api(`invoices/${r.id}/unpaid`, 'POST'), 'Wieder offen.');
    if ($('iaPaid')) $('iaPaid').onclick = () => {
      dialog(`<h2>Zahlung buchen</h2><p class="muted" style="margin-top:0">${esc(r.no)} · ${esc(r.recipient.name)} · ${euro(r.gross)}</p>
        <div class="bh-grid" style="--c:2"><label class="f">Eingegangen am<input id="ipD" type="date" value="${st.meta.today}"></label>
        <label class="f">Zahlungsweg<select id="ipV">${['ueberweisung', 'bar', 'lastschrift', 'verrechnet'].map(v => opt(v, VIA[v], 'ueberweisung')).join('')}</select></label></div>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="ipOk">Bezahlt</button></div>`);
      $('c').onclick = closeDialog;
      $('ipOk').onclick = () => run(api(`invoices/${r.id}/paid`, 'POST', { date: val('ipD'), via: val('ipV') }), 'Als bezahlt gebucht.');
    };
    if ($('iaX')) $('iaX').onclick = async () => {
      const why = await askText(`Rechnung ${r.no} stornieren?\nDie Nummer bleibt vergeben, die Rechnung zählt nicht mehr als offen. Bitte kurz begründen:`, '', { ok: 'Stornieren' });
      if (why == null) return;
      run(api(`invoices/${r.id}/cancel`, 'POST', { reason: why }), 'Storniert.');
    };
  }

  async function yearlyDialog(after) {
    const m = st.meta;
    let year = m.year;
    const paint = async () => {
      const y = await api('yearly?year=' + year);
      const todo = y.rows.filter(r => !r.done);
      dialog(`<h2>Jahresrechnungen</h2>
        <p class="muted" style="margin-top:0">Für jede Firma mit hinterlegten Jahrespositionen eine Rechnung – je Jahr nur einmal. Positionen pflegst du unter „Firmen &amp; Sponsoren“.</p>
        <div class="bh-grid" style="--c:3"><label class="f">Jahr<select id="yrY">${[m.year + 1, m.year, m.year - 1].map(v => opt(v, v, year)).join('')}</select></label>
          <label class="f">Rechnungsdatum<input id="yrD" type="date" value="${m.today}"></label>
          <label class="f">Leistungszeitraum<input id="yrP" value="${year}"></label></div>
        ${y.rows.length ? `<table class="tbl" style="margin-top:12px"><tr><th style="width:36px"><input type="checkbox" id="yrAll" ${todo.length ? 'checked' : 'disabled'} aria-label="alle"></th><th>Firma</th><th class="r">Betrag</th><th></th></tr>
          ${y.rows.map(r => `<tr class="${r.done ? 'off' : ''}"><td><input type="checkbox" data-yr="${r.id}" ${r.done ? 'disabled' : 'checked'} aria-label="${esc(r.name)}"></td><td><b>${esc(r.name)}</b><span class="bh-sub">${esc(r.items.map(i => i.text).join(', '))}</span></td>
            <td class="r">${euro(r.gross)}</td><td class="r">${r.done ? `<span class="pill g">${esc(r.done)}</span>` : r.email ? '' : '<span class="muted s">ohne E-Mail</span>'}</td></tr>`).join('')}</table>`
          : '<p class="muted">Noch keine Firma mit Jahrespositionen angelegt.</p>'}
        <label class="chk" style="margin-top:12px"><input type="checkbox" id="yrSend" ${m.mail ? '' : 'disabled'}> gleich per E-Mail verschicken (wo eine Adresse hinterlegt ist)</label>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="yrOk" ${todo.length ? '' : 'disabled'}>${todo.length} Rechnung(en) erstellen</button></div>`, true);
      $('c').onclick = closeDialog;
      $('yrY').onchange = () => { year = +val('yrY'); paint().catch(fail); };
      const boxes = () => [...$('dialog').querySelectorAll('[data-yr]:not(:disabled)')];
      const count = () => { const n = boxes().filter(b => b.checked).length; $('yrOk').textContent = `${n} Rechnung(en) erstellen`; $('yrOk').disabled = !n; };
      if ($('yrAll')) $('yrAll').onchange = () => { boxes().forEach(b => { b.checked = $('yrAll').checked; }); count(); };
      boxes().forEach(b => { b.onchange = count; });
      $('yrOk').onclick = async () => {
        const ids = boxes().filter(b => b.checked).map(b => +b.dataset.yr);
        $('yrOk').disabled = true;
        try {
          const r = await api('yearly', 'POST', { year, date: val('yrD'), period: val('yrP'), partner_ids: ids, send: $('yrSend').checked });
          closeDialog();
          const sent = r.created.filter(x => x.sent).length;
          toast(`${r.created.length} Rechnung(en) erstellt${sent ? `, ${sent} verschickt` : ''}${r.skipped.length ? ` – übersprungen: ${r.skipped.join(', ')}` : ''}.`, r.skipped.length > 0);
          after();
        } catch (e) { fail(e); $('yrOk').disabled = false; }
      };
    };
    await paint();
  }

  /* ---------------- Firmen & Sponsoren ---------------- */
  async function showPartners(el) {
    const rows = await api('partners');
    const sb = st.meta.settings.small_business;
    const yearSum = p => p.items.reduce((s, i) => { const l = Math.round(i.qty * i.unit_cents); return s + l + (sb ? 0 : Math.round(l * i.vat / 100)); }, 0);
    el.innerHTML = `<div class="filterbar"><label class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="bpQ" placeholder="Firma suchen" data-nodirty></label>
        <span style="flex:1"></span><button class="btn primary" id="bpNew">+ Firma anlegen</button></div>
      <div class="card" style="padding:0;overflow:auto">${rows.length ? `<table class="tbl bh-tbl" id="bpT"><tr><th>Firma</th><th class="hm">Ansprechperson</th><th class="r">Jahresbetrag</th><th class="r hm">Offen</th><th class="hm">Zuletzt</th><th></th></tr>
        ${rows.map(p => `<tr class="${p.active ? '' : 'off'}" data-q="${esc((p.name + ' ' + (p.city || '') + ' ' + (p.contact || '')).toLowerCase())}"><td><b>${esc(p.name)}</b><span class="bh-sub">${esc([p.zip, p.city].filter(Boolean).join(' ') || '–')}${p.active ? '' : ' · inaktiv'}</span></td>
          <td class="hm">${esc(p.contact || '–')}${p.email ? `<span class="bh-sub">${esc(p.email)}</span>` : ''}</td>
          <td class="r">${p.items.length ? euro(yearSum(p)) : '<span class="muted s">–</span>'}</td><td class="r hm">${p.open ? euro(p.open) : '<span class="muted s">–</span>'}</td>
          <td class="hm">${p.lastYearly ? `Jahresrechnung ${p.lastYearly}` : p.invoices ? `${p.invoices} Rechnung(en)` : '<span class="muted s">–</span>'}</td>
          <td><div class="bh-acts"><button class="btn small" data-bill="${p.id}" ${p.active ? '' : 'disabled'}>Rechnung</button><button class="btn small" data-ed="${p.id}">Bearbeiten</button></div></td></tr>`).join('')}</table>`
        : '<p class="muted" style="padding:24px;margin:0;text-align:center">Noch keine Firmen angelegt. Lege deine Sponsoren einmal an – mit den jährlichen Positionen, dann sind die Rechnungen jedes Jahr mit zwei Klicks erstellt.</p>'}</div>`;
    const reload = async () => { await loadMeta(); await showPartners(el); };
    $('bpNew').onclick = () => partnerDialog(null, reload);
    $('bpQ').oninput = () => { const q = val('bpQ').toLowerCase(); el.querySelectorAll('#bpT tr[data-q]').forEach(tr => { tr.style.display = tr.dataset.q.includes(q) ? '' : 'none'; }); };
    el.querySelectorAll('[data-ed]').forEach(b => { b.onclick = () => partnerDialog(rows.find(p => p.id === +b.dataset.ed), reload); });
    el.querySelectorAll('[data-bill]').forEach(b => { b.onclick = () => { const p = rows.find(x => x.id === +b.dataset.bill); invoiceDialog({ kind: 'partner', partner_id: p.id, items: p.items }, () => GK.go('bh-rechnungen')); }; });
  }

  function partnerDialog(p, after) {
    const v = k => esc((p && p[k]) || '');
    dialog(`<h2>${p ? esc(p.name) : 'Firma anlegen'}</h2>
      <div class="bh-grid" style="--c:4">
        <label class="f w2">Firma / Name<input id="pN" value="${v('name')}" placeholder="z. B. Autohaus Beispiel GmbH"></label>
        <label class="f">Kundennummer<input id="pK" value="${v('customer_no')}" placeholder="optional"></label>
        <label class="f">Abteilung<select id="pD">${opt('', '– Verein –', p && p.department_id)}${st.meta.departments.map(d => opt(d.id, d.name, p && p.department_id)).join('')}</select></label>
        <label class="f">Ansprechperson<input id="pC" value="${v('contact')}" placeholder="z. B. Frau Muster"></label>
        <label class="f">E-Mail (Rechnungsversand)<input id="pE" type="email" value="${v('email')}"></label>
        <label class="f">Telefon<input id="pT" value="${v('phone')}"></label>
        <label class="f">USt-IdNr.<input id="pV" value="${v('vat_id')}" placeholder="optional"></label>
        <label class="f">Straße und Hausnummer<input id="pS" value="${v('street')}"></label>
        <label class="f">PLZ<input id="pZ" value="${v('zip')}" inputmode="numeric"></label>
        <label class="f">Ort<input id="pO" value="${v('city')}"></label>
        <label class="f">Land<input id="pL" value="${v('country')}" placeholder="leer = Deutschland"></label>
      </div>
      <h3 style="margin:18px 0 2px">Jahrespositionen</h3><p class="muted s" style="margin:0 0 6px">Was diese Firma jedes Jahr bekommt – z. B. Bandenwerbung, Trikotwerbung, Anzeige im Vereinsheft. Leer lassen, wenn nur einzeln abgerechnet wird.</p>
      <div id="pItems"></div>
      <label class="f" style="margin-top:10px">Notiz (intern)<textarea id="pNo" rows="2">${v('note')}</textarea></label>
      ${p ? `<label class="chk" style="margin-top:10px"><input type="checkbox" id="pA" ${p.active ? 'checked' : ''}> aktiv (inaktive Firmen bekommen keine Jahresrechnung)</label>` : ''}
      <div class="btns">${p ? '<button class="btn ghost danger" id="pDel">Löschen</button><span style="flex:1"></span>' : ''}<button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="pOk">Speichern</button></div>`, true);
    const ed = itemsEditor($('pItems'), p ? p.items : [], {});
    if (!(p && p.items.length)) { /* leerer Editor: eine leere Zeile, wird beim Speichern ignoriert */ }
    $('c').onclick = closeDialog;
    $('pOk').onclick = async () => {
      const body = { name: val('pN'), customer_no: val('pK'), contact: val('pC'), email: val('pE'), phone: val('pT'), street: val('pS'), vat_id: val('pV'), zip: val('pZ'), city: val('pO'), country: val('pL'), department_id: +val('pD') || null, note: $('pNo').value, items: ed.get(), ...(p ? { active: $('pA').checked } : {}) };
      try { if (p) await api('partners/' + p.id, 'PUT', body); else await api('partners', 'POST', body); closeDialog(); toast('Gespeichert.'); after(); } catch (e) { fail(e); }
    };
    if ($('pDel')) $('pDel').onclick = async () => {
      if (!await ask(`„${p.name}“ löschen?\n\nGeht nur, solange es keine Rechnungen oder Spendenquittungen für diese Firma gibt.`)) return;
      try { await api('partners/' + p.id, 'DELETE'); closeDialog(); toast('Gelöscht.'); after(); } catch (e) { fail(e); }
    };
  }

  /* ---------------- Spendenquittungen ---------------- */
  async function showDonations(el) {
    const m = st.meta, f = st.don;
    const rows = await api('donations?' + new URLSearchParams(f.year ? { year: f.year } : {}));
    const years = []; for (let y = m.year; y >= m.year - 5; y--) years.push(y);
    const act = rows.filter(r => r.status === 'aktiv');
    el.innerHTML = `<div class="kpis"><div class="kpi"><div class="l">Bestätigt ${m.year}</div><div class="v">${euro(m.kpis.donations.c)}</div><div class="s muted">${m.kpis.donations.n} Quittung(en)</div></div>
        <div class="kpi"><div class="l">Geldspenden${f.year ? ' ' + f.year : ''}</div><div class="v">${euro(act.filter(r => r.kind === 'geld').reduce((s, r) => s + r.cents, 0))}</div></div>
        <div class="kpi"><div class="l">Sachspenden &amp; Verzicht${f.year ? ' ' + f.year : ''}</div><div class="v">${euro(act.filter(r => r.kind !== 'geld').reduce((s, r) => s + r.cents, 0))}</div></div></div>
      <div class="filterbar"><label class="f bh-yr">Jahr<select id="bdY" data-nodirty>${opt('', 'alle', f.year)}${years.map(y => opt(y, y, f.year)).join('')}</select></label>
        <span style="flex:1"></span><button class="btn primary" id="bdNew" ${m.donationReady ? '' : 'disabled title="Erst die Angaben zum Freistellungsbescheid eintragen"'}>+ Neue Spendenquittung</button></div>
      <div class="card" style="padding:0;overflow:auto">${rows.length ? `<table class="tbl bh-tbl"><tr><th>Nr.</th><th>Spender</th><th class="hm">Art</th><th class="hm">Tag der Zuwendung</th><th class="r">Betrag</th><th></th></tr>
        ${rows.map(r => `<tr class="${r.status !== 'aktiv' ? 'off' : ''}"><td class="nw"><b>${esc(r.no)}</b></td>
          <td><b>${esc(r.donor.name)}</b><span class="bh-sub">${{ member: 'Mitglied', partner: 'Firma', einmalig: 'einmaliger Spender' }[r.donor_type]}${r.sent_at ? ' · verschickt' : ''}${r.status !== 'aktiv' ? ' · storniert' : ''}</span></td>
          <td class="hm">${esc(DKIND[r.kind])}</td><td class="hm nw">${deDate(r.date)}</td><td class="r"><b>${euro(r.cents)}</b></td>
          <td><div class="bh-acts"><a class="btn small" href="${BASE}donations/${r.id}/pdf" target="_blank" rel="noopener">PDF</a>${r.status === 'aktiv' ? `<button class="btn small" data-dsend="${r.id}" ${r.donor.email && m.mail ? '' : 'disabled'}>Senden</button><button class="btn small ghost" data-dx="${r.id}">Storno</button>` : ''}</div></td></tr>`).join('')}</table>`
        : '<p class="muted" style="padding:24px;margin:0;text-align:center">Noch keine Spendenquittungen.</p>'}</div>`;
    const reload = async () => { await loadMeta(); await showDonations(el); };
    $('bdY').onchange = () => { f.year = val('bdY'); showDonations(el).catch(fail); };
    $('bdNew').onclick = () => donationDialog(reload);
    el.querySelectorAll('[data-dsend]').forEach(b => { b.onclick = async () => { const r = rows.find(x => x.id === +b.dataset.dsend); if (!await ask(`Spendenquittung ${r.no} an ${r.donor.email} senden?`, { ok: 'Senden', danger: false })) return; try { const x = await api(`donations/${r.id}/send`, 'POST'); toast(`An ${x.to} verschickt.`); reload(); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-dx]').forEach(b => { b.onclick = async () => { const r = rows.find(x => x.id === +b.dataset.dx); const why = await askText(`Spendenquittung ${r.no} stornieren?\nNur, wenn sie falsch ausgestellt wurde. Die Nummer bleibt vergeben. Bitte kurz begründen:`, '', { ok: 'Stornieren' }); if (why == null) return; try { await api(`donations/${r.id}/cancel`, 'POST', { reason: why }); toast('Storniert.'); reload(); } catch (e) { fail(e); } }; });
  }

  function donationDialog(after) {
    const m = st.meta;
    let who = 'member', kind = 'geld';
    dialog(`<h2>Neue Spendenquittung</h2>
      <div class="seg" id="dWho"><button data-w="member">Mitglied</button><button data-w="partner">Firma</button><button data-w="einmalig">einmaliger Spender</button></div>
      <div id="dDonor"></div>
      <div class="seg" id="dKind" style="margin-top:16px"><button data-k="geld">Geldspende</button><button data-k="sach">Sachspende</button><button data-k="verzicht">Verzicht auf Erstattung</button></div>
      <div class="bh-grid" style="--c:2">
        <label class="f"><span id="dCL">Betrag in €</span><input id="dC" inputmode="decimal" placeholder="0,00"></label>
        <label class="f">Tag der Zuwendung<input id="dD" type="date" value="${m.today}" max="${m.today}"></label>
        <label class="f wall" id="dIL">Beschreibung<textarea id="dI" rows="3"></textarea></label>
        <div class="wall" id="dSach"></div>
      </div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="dOk">Spendenquittung erstellen</button></div>`, true);
    const seg = (id, attr, cur) => $(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset[attr] === cur));
    const donor = () => {
      seg('dWho', 'w', who);
      $('dDonor').innerHTML = who === 'member' ? `<label class="f">Mitglied<select id="dM"><option value="">– bitte wählen –</option>${m.members.map(x => opt(x.id, `${GK.lastFirst(x.name, 'mitglied')}${x.member_no ? ' (' + x.member_no + ')' : ''}`)).join('')}</select></label>`
        : who === 'partner' ? `<label class="f">Firma<select id="dP"><option value="">– bitte wählen –</option>${m.partners.map(x => opt(x.id, x.name)).join('')}</select></label>`
        : `<div class="bh-grid" style="--c:3"><label class="f w2">Name<input id="dN" placeholder="Vor- und Nachname bzw. Firma"></label><label class="f">E-Mail (optional)<input id="dE" type="email"></label>
            <label class="f w2">Straße und Hausnummer<input id="dS"></label><label class="f">PLZ und Ort<input id="dO" placeholder="12345 Musterstadt"></label></div>`;
    };
    const art = () => {
      seg('dKind', 'k', kind);
      $('dCL').textContent = kind === 'geld' ? 'Betrag in €' : kind === 'sach' ? 'Wert der Sachspende in €' : 'Verzichteter Betrag in €';
      $('dIL').style.display = kind === 'geld' ? 'none' : '';
      $('dI').placeholder = kind === 'sach' ? 'Genaue Bezeichnung: was, Alter, Zustand, ursprünglicher Kaufpreis – z. B. 10 Trainingsbälle Größe 5, neu, Rechnung liegt vor' : 'Welche Aufwendungen? z. B. Fahrtkosten zum Turnier in Musterstadt am 12.09., 240 km × 0,30 €';
      $('dSach').innerHTML = kind === 'sach' ? `<div class="bh-grid" style="--c:2"><label class="f">Herkunft<select id="dSo">${opt('privat', 'aus dem Privatvermögen')}${opt('betrieb', 'aus dem Betriebsvermögen')}${opt('unbekannt', 'keine Angabe des Spenders')}</select></label>
          <label class="chk" style="align-self:end;min-height:40px"><input type="checkbox" id="dSd"> Unterlagen zur Wertermittlung liegen vor</label></div>`
        : kind === 'verzicht' ? '<p class="muted s" style="margin:0">Voraussetzung: Der Anspruch auf Erstattung wurde vorher vertraglich oder per Satzung/Vorstandsbeschluss eingeräumt, und der Verein hätte zahlen können.</p>' : '';
    };
    $('dWho').querySelectorAll('button').forEach(b => { b.onclick = () => { who = b.dataset.w; donor(); }; });
    $('dKind').querySelectorAll('button').forEach(b => { b.onclick = () => { kind = b.dataset.k; art(); }; });
    donor(); art();
    $('c').onclick = closeDialog;
    $('dOk').onclick = async () => {
      const zc = (val('dO') || '').match(/^(\d{4,5})\s+(.+)$/);
      const body = { donor_type: who, kind, cents: toCents(val('dC') || '0'), date: val('dD'), item: kind === 'geld' ? '' : $('dI').value,
        member_id: who === 'member' ? +val('dM') || null : null, partner_id: who === 'partner' ? +val('dP') || null : null,
        donor: who === 'einmalig' ? { name: val('dN'), email: val('dE'), street: val('dS'), zip: zc ? zc[1] : '', city: zc ? zc[2] : val('dO') } : undefined,
        sach_origin: kind === 'sach' ? val('dSo') : undefined, sach_docs: kind === 'sach' ? $('dSd').checked : undefined };
      $('dOk').disabled = true;
      try {
        const r = await api('donations', 'POST', body);
        closeDialog(); toast(`Spendenquittung ${r.no} erstellt.`); window.open(`${BASE}donations/${r.id}/pdf`, '_blank', 'noopener'); after();
      } catch (e) { fail(e); $('dOk').disabled = false; }
    };
  }

  /* ---------------- Einstellungen ---------------- */
  async function showSettings(el) {
    const s = await api('settings'), fb = s.fallback;
    const inp = (k, l, o = {}) => `<label class="f ${o.cls || ''}">${esc(l)}<input id="bs_${k}" value="${esc(s[k] ?? '')}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.type ? `type="${o.type}"` : ''}></label>`;
    el.innerHTML = `
      <div class="card"><h3>Absender</h3><p class="muted s" style="margin-top:0">Steht im Briefkopf. Leer gelassene Felder übernehmen die Angaben aus der Mitgliederverwaltung.</p>
        <div class="bh-grid">${inp('street', 'Straße und Hausnummer', { ph: fb.street })}${inp('city', 'PLZ und Ort', { ph: fb.city })}${inp('email', 'E-Mail', { type: 'email' })}${inp('phone', 'Telefon')}
          <label class="f w2">Fußzeile (optional)<input id="bs_footer" value="${esc(s.footer)}" placeholder="z. B. Vorstand: … · Amtsgericht … VR 1234"></label></div></div>
      <div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">Bankkonten</h3><button class="btn" id="bsBank">Bankkonten verwalten …</button></div>
        <p class="muted s" style="margin-top:0">Die Konten werden zentral unter Einstellungen → Bankkonten gepflegt. Auf der Rechnung steht das Konto der Abteilung, sonst das Standardkonto – im Rechnungsdialog änderbar.</p>
        ${st.meta.accounts.length ? `<table class="tbl">${st.meta.accounts.map(a => `<tr><td><b>${esc(a.name)}</b>${a.is_default ? ' <span class="pill g">Standard</span>' : ''}</td><td class="nw">${esc(a.iban.replace(/(.{4})/g, '$1 ').trim())}</td><td>${a.departments.length ? esc(a.departments.map(id => (st.meta.departments.find(d => d.id === id) || {}).name || '?').join(', ')) : '<span class="muted s">alle</span>'}</td></tr>`).join('')}</table>` : '<p class="muted" style="margin:0">Noch kein Bankkonto angelegt.</p>'}</div>
      <div class="card"><h3>Rechnungen</h3>
        <div class="bh-grid">${inp('tax_no', 'Steuernummer')}${inp('vat_id', 'USt-IdNr.', { ph: 'optional' })}
          <label class="f">Umsatzsteuer (Vorgabe)<select id="bs_vat_default">${[19, 7, 0].map(v => opt(v, v ? v + ' %' : 'ohne', s.vat_default)).join('')}</select></label>
          ${inp('inv_prefix', 'Nummernkreis', { ph: 'R-' })}<label class="f">Zahlungsziel (Tage)<input id="bs_due_days" type="number" min="0" max="120" value="${s.due_days}"></label>
          <label class="chk" style="align-self:end;min-height:40px"><input type="checkbox" id="bs_small_business" ${s.small_business ? 'checked' : ''}> Kleinunternehmer (§ 19 UStG, keine USt)</label>
          <label class="f wall">Einleitungstext<textarea id="bs_intro" rows="2" placeholder="z. B. Vielen Dank für Ihre Unterstützung! Wir berechnen Ihnen folgende Leistungen:">${esc(s.intro)}</textarea></label></div>
        <p class="muted s">Nummern laufen je Jahr: ${esc(s.inv_prefix)}${new Date().getFullYear()}-0001, -0002 … Werbeleistungen sind beim Verein in der Regel umsatzsteuerpflichtig (wirtschaftlicher Geschäftsbetrieb) – im Zweifel die Steuerberatung fragen.</p></div>
      <div class="card"><h3>Spendenquittungen</h3><p class="muted s" style="margin-top:0">Angaben aus dem Freistellungsbescheid bzw. der Anlage zum Körperschaftsteuerbescheid – stehen so auf jeder Zuwendungsbestätigung.</p>
        <div class="bh-grid">${inp('finanzamt', 'Finanzamt', { ph: 'z. B. Finanzamt Musterstadt' })}${inp('fa_tax_no', 'Steuernummer (beim Finanzamt)')}
          <label class="f">Art des Bescheids<select id="bs_bescheid_type">${opt('freistellung', 'Freistellungsbescheid', s.bescheid_type)}${opt('feststellung', 'Feststellungsbescheid (§ 60a AO)', s.bescheid_type)}</select></label>
          <label class="f">Datum des Bescheids<input id="bs_bescheid_date" type="date" value="${esc(s.bescheid_date)}"></label>
          ${inp('veranlagungszeitraum', 'Veranlagungszeitraum', { ph: 'z. B. 2022 bis 2024' })}${inp('don_prefix', 'Nummernkreis', { ph: 'SQ-' })}
          <label class="f wall">Begünstigte Zwecke<input id="bs_zwecke" value="${esc(s.zwecke)}"></label>
          ${inp('signer', 'Unterschrift (Name)')}${inp('signer_role', 'Funktion')}${inp('place', 'Ort der Ausstellung', { ph: 'leer = Ort des Vereins' })}</div>
        <p class="muted s">Die Bestätigung ist nur gültig, solange der Bescheid nicht älter als 5 Jahre ist (Feststellungsbescheid: 3 Jahre).</p></div>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" id="bsOk">Speichern</button></div>
      <div id="bhFunc"></div>`;
    GK.watch(el);
    $('bsBank').onclick = () => (GK.openSettings ? GK.openSettings('bank') : GK.go('einstellungen'));
    $('bsOk').onclick = async () => {
      const b = {};
      for (const x of el.querySelectorAll('[id^="bs_"]')) { const k = x.id.slice(3); b[k] = x.type === 'checkbox' ? x.checked : x.value.trim(); }
      try { await api('settings', 'PUT', b); GK.clean(); toast('Gespeichert.'); await loadMeta(); } catch (e) { fail(e); }
    };
    if (GK.funcBox) GK.funcBox($('bhFunc'), 'buchhaltung', 'Buchhaltung', () => showSettings(el).catch(fail));
  }

  const G = { key: 'buchhaltung', label: 'Buchhaltung', icon: 'buchhaltung', order: 7 };
  GK.registerPage({ key: 'bh-rechnungen', title: 'Rechnungen', perm: 'buchhaltung', render: pageRender('bh-rechnungen', showInvoices), group: G });
  GK.registerPage({ key: 'bh-firmen', title: 'Firmen & Sponsoren', perm: 'buchhaltung', render: pageRender('bh-firmen', showPartners), group: G, tab: 'Firmen' });
  GK.registerPage({ key: 'bh-spenden', title: 'Spendenquittungen', perm: 'buchhaltung', render: pageRender('bh-spenden', showDonations), group: G, tab: 'Spenden' });
  GK.registerPage({ key: 'bh-einstellungen', title: 'Einstellungen', perm: 'buchhaltung', render: pageRender('bh-einstellungen', showSettings), group: G });
  if (GK.badges) GK.badges(async () => { if (!GK.can('buchhaltung')) return {}; const m = await api('meta'); return { 'bh-rechnungen': m.kpis.overdue.n }; });
})();
