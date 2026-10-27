'use strict';
/* Verwaltung „Mitglieder“: Mitglieder (Liste und Detailansicht) · Anträge · Beiträge & Abteilungen · Auswertung · Einstellungen
   und zweiter Menüpunkt „Beiträge & Zahlungen“: Beitragslauf · Lastschriften · Offene Posten · Rechnungen & Mahnungen · Einstellungen */
(() => {
  const GK = window.GK;
  const { $, esc, euro, toast, fail, dialog, closeDialog, ask, askText, deDate, deTime, toCents, centsToInput, icon } = GK;
  const api = (url, method, body) => GK.api('x/mitglieder/' + url, method, body);
  const BASE = 'api/admin/x/mitglieder/';
  const st = { meta: null, rows: [], f: { status: 'aktuell', q: '', dept: '', fee: '' }, app: 'offen' };
  const STATUS = { aktiv: ['g', 'aktiv'], passiv: ['b', 'passiv'], ehren: ['b', 'Ehrenmitglied'], ruhend: ['', 'ruhend'], ausgetreten: ['', 'ausgetreten'], anonym: ['', 'anonymisiert'] };
  const PAY = { lastschrift: 'Lastschrift', rechnung: 'Rechnung', bar: 'bar' };
  const GENDER = { m: 'männlich', w: 'weiblich' };
  const INTERVAL = { jahr: 'jährlich', halbjahr: 'halbjährlich', quartal: 'vierteljährlich', monat: 'monatlich', einmalig: 'einmalig' };
  const PRS = { anteilig: 'anteilig', voll: 'voller Betrag', frei: 'Eintrittsjahr frei' };
  const PRORATE = { anteilig: 'anteilig (volle Monate)', voll: 'voller Betrag', frei: 'Eintrittsjahr frei' };
  const KIND = { beitrag: 'Beitrag', getraenke: 'Verkauf', arbeitsstunden: 'Arbeitsstunden', aufnahme: 'Aufnahme', ruecklastschrift: 'Rücklastschrift', mahngebuehr: 'Mahngebühr', sonstiges: 'Sonstiges' };
  const CSTAT = { offen: ['a', 'offen'], eingezogen: ['b', 'im Einzug'], bezahlt: ['g', 'bezahlt'], storniert: ['', 'storniert'] };
  const DOCK = { antrag: 'Beitrittserklärung', mandat: 'SEPA-Mandat', kuendigung: 'Kündigung', nachweis: 'Nachweis', schriftverkehr: 'Schriftverkehr', sonstiges: 'Sonstiges' };
  const FIELD = { street: 'Straße', zip: 'PLZ', city: 'Ort', address_extra: 'Adresszusatz', phone: 'Telefon', mobile: 'Mobil', email: 'E-Mail', holder: 'Kontoinhaber', iban: 'IBAN', bic: 'BIC', bank: 'Kreditinstitut' };
  const can = p => GK.can(p);
  const SC = () => Boolean(st.meta && st.meta.scope);   // Abteilungsadmin: nur eigene Abteilung(en)
  const CONF = () => SC() && st.meta.settings.scope_confirm;   // Ein-/Austritte der Abteilungsleitung bestätigt die Vereinsverwaltung
  const PENDING = 'Zur Bestätigung an die Vereinsverwaltung geschickt.';
  const pill = ([c, t]) => `<span class="pill ${c}">${esc(t)}</span>`;
  const opt = (v, l, sel) => `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
  const val = id => ($(id) ? $(id).value.trim() : undefined);
  const ini = n => esc(String(n || '?').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase());
  const fmtIban = v => String(v || '').replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
  const money = c => (c ? euro(c) : '<span class="muted s">–</span>');

  /* eigene Bausteine (gleiche Raster, gleiche Höhen) */
  if (!document.getElementById('mvStyle')) {
    const s = document.createElement('style'); s.id = 'mvStyle';
    s.textContent = `
      .mv-grid { display: grid; grid-template-columns: repeat(var(--c, 3), minmax(0, 1fr)); gap: 14px 16px; }
      .mv-grid .w2 { grid-column: span 2; } .mv-grid .wall { grid-column: 1 / -1; }
      .imp-sim { margin: 12px 0; } .imp-simrow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line-soft); }
      .imp-simrow > div { display: flex; flex-direction: column; min-width: 0; } .imp-simrow select { height: 40px; border: 1px solid var(--line); border-radius: 10px; background: var(--field); padding: 0 10px; font: inherit; font-size: 14px; color: var(--ink); min-width: 0; width: 100%; }
      .imp-fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px 16px; }
      .imp-field { display: flex; flex-direction: column; min-width: 0; } .imp-field b { font-weight: 600; overflow-wrap: anywhere; } .imp-field.leer b { color: var(--muted); font-weight: 500; }
      @media (max-width: 700px) { .imp-simrow { grid-template-columns: 1fr; gap: 6px; } }
      .mv-up { display: flex; align-items: center; gap: 10px; height: 40px; box-sizing: border-box; padding: 0 4px 0 12px; border: 1px dashed var(--line); border-radius: 10px; background: var(--field); cursor: pointer; font-size: 14px; font-weight: 500; color: var(--faint); }
      .mv-up span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mv-up b { flex: none; height: 30px; padding: 0 12px; border-radius: 8px; background: var(--card); border: 1px solid var(--line); display: inline-flex; align-items: center; font-size: 13px; font-weight: 600; color: var(--ink); }
      .mv-up.ok { border-style: solid; border-color: var(--green-line, var(--line)); background: var(--brand-soft); color: var(--brand-ink); }
      .mv-up.drag { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
      @media (max-width: 900px) { .mv-grid { grid-template-columns: 1fr 1fr; } .mv-grid .w2 { grid-column: 1 / -1; } }
      @media (max-width: 560px) { .mv-grid { grid-template-columns: 1fr; } }
      .mv-cons { display: flex; flex-direction: column; gap: 10px; }
      .mv-cons label.chk { align-items: flex-start; line-height: 1.4; } .mv-cons input { margin-top: 2px; flex: none; }
      .mv-code { font: 800 44px/1 ui-monospace, Menlo, Consolas, monospace; letter-spacing: .18em; text-align: center; padding: 18px; border: 2px dashed var(--green-line); border-radius: 16px; background: var(--brand-soft); color: var(--brand-ink); margin: 6px 0 12px; }
      .mv-pers { padding: 12px 0; border-top: 1px solid var(--line-soft); } .mv-pers:first-of-type { border-top: 0; padding-top: 0; }
      .mv-fees { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
      .mv-fees label { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; min-height: 44px; box-sizing: border-box; cursor: pointer; }
      .mv-fees label:has(input:checked) { border-color: var(--brand); background: var(--brand-soft); }
      .mv-fees label b { margin-left: auto; font-variant-numeric: tabular-nums; }
      .mv-sum { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 0 0; border-top: 1px solid var(--line-soft); margin-top: 14px; }
      .mv-sum b { font-size: 18px; font-variant-numeric: tabular-nums; }
      .mv-sig { max-width: 220px; max-height: 70px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
      .mv-diff td:nth-child(2) { color: var(--muted); text-decoration: line-through; }
      .mv-lsb { table-layout: fixed; } .mv-lsb th, .mv-lsb td { text-align: right; font-variant-numeric: tabular-nums; } .mv-lsb th:first-child, .mv-lsb td:first-child { text-align: left; width: 22%; }   /* Zahlenspalten gleich breit */
      .mv-cols { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px 16px; margin: 4px 0 12px; }
      .tbl td.nw, .tbl th.nw { white-space: nowrap; }
      .mv-sub { margin: 14px 0 6px; font-size: 13px; font-weight: 600; color: var(--muted, #667); text-transform: uppercase; letter-spacing: .04em; }
      .mv-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; } .mv-two > .card { margin-bottom: 16px; display: flex; flex-direction: column; } .mv-two > .card > .row:last-child { margin-top: auto; padding-top: 12px; }
      @media (max-width: 1000px) { .mv-two { grid-template-columns: 1fr; } }
      .mv-lockinfo { margin-bottom: 16px; } .mv-locked { opacity: .5; } .mv-locked input, .mv-locked select, .mv-locked textarea { background: var(--hover); }
      .mv-depchk { display: flex; flex-wrap: wrap; gap: 4px 14px; } .mv-depchk label.chk { font-size: 13.5px; white-space: nowrap; }
      .mv-sub { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin: 0 0 10px; }
      .mv-cons-ed { display: grid; grid-template-columns: 200px minmax(0, 1fr) auto auto; gap: 12px; align-items: start; padding: 10px 0; border-top: 1px solid var(--line-soft); } .mv-cons-ed .f { margin: 0; } .mv-cons-ed textarea { width: 100%; min-height: 58px; resize: vertical; } .mv-cons-ed .chk { min-height: 40px; }
      @media (max-width: 700px) { .mv-cons-ed { grid-template-columns: minmax(0, 1fr); } }
      .mv-cg-ed { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) auto; gap: 12px; align-items: end; padding: 10px 0; border-top: 1px solid var(--line-soft); } .mv-cg-ed .f { margin: 0; } .mv-cg-ed .btn { height: 40px; }
      @media (max-width: 700px) { .mv-cg-ed { grid-template-columns: minmax(0, 1fr); } .mv-cg-ed .btn { justify-self: end; } }
      .mv-addr { min-height: 40px; display: flex; align-items: center; font-size: 14px; }
      .mv-pic { overflow: hidden; } .mv-pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
      td.num, .mv-sum b { font-size: 1.15em; }   /* Anzeigetafel-Ziffern sind schmaler: etwas größer, damit sie neben der Textschrift gleich hoch wirken */
      .mv-sum b { font-family: var(--num); font-weight: 600; }
      .mv-code { font-family: var(--num); font-weight: 600; }
      .mv-fsel { width: 170px; } @media (max-width: 640px) { .mv-fsel { width: 100%; } }`;
    document.head.appendChild(s);
  }

  async function upload(url, file) {
    const r = await fetch(BASE + url, { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) }, body: file });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Fehler beim Hochladen');
    return d;
  }
  const pickFile = accept => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });
  /** Rückfrage im selben Fenster (kein zweites Fenster): Titel, Text und Knopf; „Abbrechen“ führt zurück.
   *  o.safe: harmloser Schritt (grüner Knopf statt rot), o.html: Felder unter dem Text (z. B. ein Datum) */
  function confirmIn(title, text, okLabel, onOk, back, o = {}) {
    $('dialog').innerHTML = `<h2>${esc(title)}</h2><p class="muted" style="white-space:pre-line">${esc(text)}</p>${o.html || ''}
      <div class="btns"><button class="btn ghost" id="cfX">Abbrechen</button><button class="btn ${o.safe ? 'primary' : 'danger'}" id="cfOk">${esc(okLabel)}</button></div>`;
    $('cfX').onclick = back;
    $('cfOk').onclick = () => GK.busy($('cfOk'), onOk);
  }
  const memberOptions = (sel, skip) => st.rows.filter(r => r.id !== skip && r.status !== 'ausgetreten' && r.status !== 'anonym').map(r => opt(r.id, `${GK.lastFirst(r.name)}${r.member_no ? ' (' + r.member_no + ')' : ''}`, sel)).join('');
  const feeLabel = f => `${f.name} · ${euro(f.cents)} ${INTERVAL[f.interval] || ''}`;

  async function loadMeta() { st.meta = await api('meta'); return st.meta; }
  async function loadRows() { st.rows = await api('list?status=alle'); return st.rows; }

  /* ================================================================= Seite */
  /* ---------------------------------------------------------------- Seiten des Moduls (Menü „Mitglieder“ und „Beiträge & Zahlungen“, die Seiten als Reiter) */
  const PAGE = {
    mitglieder: ['Mitglieder', 'Stammdaten, Abteilungen und Familien – Verkauf, Zugang und Mitglieder-App nutzen dieselbe Person.'],
    'mv-antraege': ['Anträge & Änderungen', 'Beitrittserklärungen, Änderungswünsche aus der Mitglieder-App und Meldungen der Abteilungsleitungen.'],
    'mv-stamm': ['Beiträge & Abteilungen', 'Beitragsarten, Zusatzbeiträge, Abteilungen und Altersstufen.'],
    'mv-auswertung': ['Auswertung', 'Mitgliederzahlen, Bestandserhebung für den Landessportbund und Listen.'],
    'mv-einstellungen': ['Einstellungen', 'Mitgliedschaft, Beitrittserklärung, „Meine Daten“ in der App, Benachrichtigungen und Datenschutz.'],
    'mv-beitraege': ['Beitragslauf', 'Erzeugt die Beiträge aller Mitglieder als offene Posten, danach geht es weiter zum Einzug.'],
    'mv-einzug': ['Lastschriften', 'SEPA-Lastschriften für Beiträge und Verkauf: Einzug erstellen, SEPA-Datei, Vorabinformation und Rücklastschriften.'],
    'mv-posten': ['Offene Posten', 'Alle Forderungen und Gutschriften der Mitglieder mit ihrem Stand.'],
    'mv-mahnung': ['Rechnungen & Mahnungen', 'Rechnungen für Zahler ohne Lastschrift und Mahnungen für überfällige Posten.'],
    'mv-zeinst': ['Einstellungen', 'Lastschrift (SEPA), Rechnungen und Mahnungen.'],
  };
  let current = 'mitglieder';
  const pageEl = () => $('mvBody');
  function pageRender(key, fn) {
    return async () => {
      current = key;
      await loadMeta();
      const m = st.meta, [title, lead] = PAGE[key];
      const needSepa = ['mv-beitraege', 'mv-einzug'].includes(key) && (!m.settings.creditor_id || !m.settings.club_iban);
      $('main').innerHTML = `<h2 class="page">${esc(title)}</h2><p class="lead">${esc(lead)}</p>
        ${needSepa ? '<div class="banner a"><span>Für Lastschriften fehlen noch Gläubiger-ID oder Vereinskonto.</span><a href="#mv-zeinst" data-mvgo="mv-zeinst">Eintragen →</a></div>' : ''}
        <div id="mvBody"><p class="muted">Lade …</p></div>`;
      $('main').querySelectorAll('[data-mvgo]').forEach(a => { a.onclick = e => { e.preventDefault(); GK.go(a.dataset.mvgo); }; });
      await fn(pageEl());
    };
  }
  /* Klick auf den Reiter „Mitglieder“ zeigt immer die ganze Liste (Suche und Filter leer). Nur der Weg zurück aus einem Mitglied behält sie. */
  const list = pageRender('mitglieder', el => {
    if (!st.fromDetail) st.f = { status: 'aktuell', q: '', dept: '', fee: '' };
    st.fromDetail = false;
    return showList(el);
  });
  const render = () => {
    let to = null; try { to = sessionStorage.getItem('tab_mitglieder'); sessionStorage.removeItem('tab_mitglieder'); } catch (e) { /* ohne Speicher */ }
    return to === 'gratulationen' && GK.can('gratulationen') ? GK.go('mv-gratulationen') : list();
  };
  const reloadTab = () => GK.go(current);
  const openMember = id => GK.openDetail('mitglied', id);
  /** Filterchips (Baustein `.chips`): [[schlüssel, Beschriftung]], Zahlen setzt die Seite in `.cnt` */
  const chipBar = (id, list, cur) => `<div class="chips" id="${id}" role="group" aria-label="Filter">${list.map(([k, l]) => `<button type="button" data-f="${k}" class="${cur === k ? 'on' : ''}" aria-pressed="${cur === k}">${esc(l)}<span class="cnt" data-cnt="${k}"></span></button>`).join('')}</div>`;

  /* ================================================================= Liste */
  async function showList(el) {
    await loadRows();
    const m = st.meta;
    const cur = st.rows.filter(r => r.status !== 'ausgetreten' && r.status !== 'anonym');
    const y = m.today.slice(0, 4);
    // Knöpfe rechts in der Reiterzeile (Beitrittserklärungen am Tablet: Reiter „Anträge“)
    const tools = `${SC() ? '' : '<button class="btn" id="mvImp">Import …</button><button class="btn" id="mvXls">Excel</button>'}<button class="btn primary" id="mvNew">+ Neues Mitglied</button>`;
    // Pflichtangaben (Mitgliedsdaten, Beitrag, Zahlungsdaten): wer sie nicht hat, fehlt im Beitragslauf – deutlich melden
    const PFLICHT = /^(ohne Mitgliedsdaten|kein Beitrag|Zahlart nicht Lastschrift|keine Bankverbindung|IBAN ungültig|kein SEPA-Mandat|Mandat widerrufen|Mandat verfallen)/;
    const lack = cur.filter(r => r.status !== 'ausgetreten' && r.status !== 'anonym' && r.issues.some(i => typeof i === 'string' && PFLICHT.test(i)));
    el.innerHTML = `
      ${lack.length && !SC() ? `<div class="banner r"><span><b>${lack.length === 1 ? '1 Mitglied ohne Pflichtangaben' : `${lack.length} Mitglieder ohne Pflichtangaben`}</b> (Mitgliedsdaten, Beitrag oder Zahlungsdaten) – bitte ergänzen. Wer kein Vereinsmitglied ist (z. B. Trainer), wird beim Mitglied in „Kein Mitglied“ umgewandelt.</span><button class="btn small" id="mvLack" type="button">Anzeigen</button></div>` : ''}
      <div class="kpis">
        <div class="kpi"><div class="l">Mitglieder</div><div class="v">${cur.length}</div></div>
        <div class="kpi"><div class="l">Eintritte ${y}</div><div class="v">${cur.filter(r => r.entry_date && r.entry_date.startsWith(y)).length}</div></div>
        <div class="kpi"><div class="l">Austritt angekündigt</div><div class="v">${cur.filter(r => r.leaving).length}</div></div>
        <div class="kpi ${cur.some(r => r.issues.length) ? 'warn' : ''}"><div class="l">Mit Hinweis</div><div class="v">${cur.filter(r => r.issues.length).length}</div></div>
      </div>
      <div class="filterbar"><label class="search"><span aria-hidden="true">${icon('suche', 16)}</span><input id="mvQ" placeholder="Name, Nr., Ort suchen" aria-label="Suchen" value="${esc(st.f.q)}"></label>
        ${chipBar('mvSeg', [['aktuell', 'Aktuell'], ['hinweis', 'Mit Hinweis'], ['ausgetreten', 'Ausgetreten'], ['alle', 'Alle']], st.f.status)}
        <label class="f mv-fsel"><select translate="no" id="mvDept" data-nodirty aria-label="Abteilung"><option value="">${esc(GK.T(SC() ? 'Meine Abteilungen' : 'Alle Abteilungen'))}</option>${(SC() ? m.scope : m.depts).map(d => opt(d.id, d.name, st.f.dept)).join('')}</select></label>
        <label class="f mv-fsel"><select translate="no" id="mvFee" data-nodirty aria-label="Beitrag"><option value="">${esc(GK.T('Alle Beiträge'))}</option>${m.fees.map(f => opt(f.id, f.name, st.f.fee)).join('')}</select></label>
      </div>
      <div class="scroll"><table class="tbl kompakt sel" id="mvTbl"></table></div>
      <p class="empty hidden" id="mvEmpty"></p>`;
    const F = {
      aktuell: r => r.status !== 'ausgetreten' && r.status !== 'anonym', aktiv: r => r.status === 'aktiv', passiv: r => r.status === 'passiv' || r.status === 'ehren' || r.status === 'ruhend',
      hinweis: r => r.issues.length > 0 && r.status !== 'ausgetreten' && r.status !== 'anonym', ausgetreten: r => r.status === 'ausgetreten' || r.status === 'anonym', alle: () => true,
    };
    const draw = () => {
      const q = st.f.q.toLowerCase();
      const match = r => (!q || [r.name, GK.lastFirst(r.name), r.member_no, r.email, r.city].some(v => v && String(v).toLowerCase().includes(q)))
        && (!st.f.dept || r.dept_ids.includes(+st.f.dept)) && (!st.f.fee || r.fee_ids.includes(+st.f.fee));
      Object.keys(F).forEach(k => { const c = el.querySelector(`[data-cnt="${k}"]`); if (c) c.textContent = st.rows.filter(r => F[k](r) && match(r)).length; });
      const rows = st.rows.filter(r => F[st.f.status](r) && match(r));
      $('mvTbl').innerHTML = rows.length ? `<tr><th>Name</th><th style="width:90px">Nr.</th><th class="r" style="width:70px">Alter</th><th>Abteilungen</th><th>Beitrag</th><th style="width:130px">Zahlung</th><th>Hinweise</th></tr>`
        + rows.map(r => `<tr data-sel="${r.id}" data-row tabindex="0" class="${r.status === 'ausgetreten' || r.status === 'anonym' ? 'off' : ''}">
          <td class="k-1z"><span class="who"><span class="av">${ini(r.name)}</span><span><b>${esc(GK.lastFirst(r.name))}</b>${r.leaving ? `<div class="muted s">Austritt ${deDate(r.exit_date)}</div>` : r.status !== 'aktiv' ? `<div class="muted s">${esc((STATUS[r.status] || ['', r.status])[1])}</div>` : ''}</span></span></td>
          <td class="muted nw num k-lbl" data-label="Nr.">${esc(r.member_no || '')}</td>
          <td class="r k-lbl" data-label="Alter">${r.age ?? ''}</td><td translate="no" title="${esc(r.depts)}">${esc(r.depts)}</td>
          <td>${r.family_of ? `<span class="muted s">Familie ${esc(r.family_head_name)}</span>` : `<span translate="no">${esc(r.fees)}</span>`}</td>
          <td class="nw">${r.payer_id ? `<span class="muted s">über ${esc(GK.lastFirst(r.payer_name))}</span>` : esc(PAY[r.payment] || r.payment)}${r.dependents ? ` <span class="pill">+${r.dependents}</span>` : ''}</td>
          <td class="k-weg">${r.issues.map(i => `<span class="pill a">${esc(i)}</span>`).join(' ')}</td></tr>`).join('') : '';
      $('mvTbl').classList.toggle('hidden', !rows.length);
      const em = $('mvEmpty'); em.classList.toggle('hidden', rows.length > 0);
      em.textContent = rows.length ? '' : st.rows.length ? 'Keine Treffer – Suche oder Filter ändern.' : 'Noch keine Mitglieder – oben „+ Neues Mitglied“ anlegen oder „Import …“ nutzen (S-Verein, WISO, verein.cloud).';
    };
    draw();
    $('mvQ').oninput = () => { st.f.q = $('mvQ').value.trim(); draw(); };
    if ($('mvLack')) $('mvLack').onclick = () => { st.f.status = 'hinweis'; $('mvSeg').querySelectorAll('[data-f]').forEach(x => { x.classList.toggle('on', x.dataset.f === 'hinweis'); x.setAttribute('aria-pressed', x.dataset.f === 'hinweis'); }); draw(); };
    $('mvSeg').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; st.f.status = b.dataset.f; $('mvSeg').querySelectorAll('[data-f]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); draw(); };
    $('mvDept').onchange = () => { st.f.dept = $('mvDept').value; draw(); };
    $('mvFee').onchange = () => { st.f.fee = $('mvFee').value; draw(); };
    $('mvTbl').onclick = e => { const tr = e.target.closest('tr[data-sel]'); if (tr) openMember(+tr.dataset.sel); };
    $('mvTbl').onkeydown = e => { const tr = e.target.closest('tr[data-sel]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openMember(+tr.dataset.sel); } };
    if (!GK.tabTools(tools, $('mvTbl'))) el.insertAdjacentHTML('afterbegin', `<div class="toolbar">${tools}</div>`);
    $('mvNew').onclick = () => newMember();
    if ($('mvImp')) $('mvImp').onclick = () => importDialog();
    if ($('mvXls')) $('mvXls').onclick = () => exportDialog();
  }

  function newMember() {
    const m = st.meta, full = !SC();
    const ageAt = (b, d) => { if (!b) return null; let a = +d.slice(0, 4) - +b.slice(0, 4); if (d.slice(5) < b.slice(5)) a--; return a; };
    dialog(`<h2>Neues Mitglied</h2>
      <p class="muted s" style="margin-top:0">Angelegt wird nur vollständig: Adresse, E-Mail und Handy${full ? ', Beitrag, Zahlung (bei Lastschrift Kontoinhaber, IBAN und Datum des SEPA-Mandats)' : ''} und die unterschriebene Beitrittserklärung als PDF oder Foto. Mit Unterschrift auf dem Tablet geht es über „Beitrittserklärung am Tablet“.</p>
      <div class="mv-grid" style="--c:4">
        <label class="f">Vorname<input id="nFirst" autocomplete="off"></label><label class="f">Nachname<input id="nLast" autocomplete="off"></label><label class="f">Geburtsdatum<input id="nBirth" type="date"></label><label class="f">Eintritt<input id="nEntry" type="date" value="${m.today}"></label>
        <label class="f w2">Straße und Hausnummer<input id="nStreet" autocomplete="off"></label><label class="f">PLZ<input id="nZip" inputmode="numeric" maxlength="10"></label><label class="f">Ort<input id="nCity"></label>
        <label class="f w2">E-Mail<input id="nMail" type="email"></label><label class="f">Handy<input id="nMob" type="tel" placeholder="z. B. 0170 1234567"></label><label class="f">Mitgliedsnummer<input id="nNo" placeholder="${esc(m.nextNo)} (automatisch)"></label>
        ${full ? `<label class="f w2">Beitrag<select translate="no" id="nFee"></select></label>` : ''}
        <label class="f ${full ? '' : 'w2'}">Abteilung<select translate="no" id="nDept">${SC() ? m.scope.map(d => opt(d.id, d.name)).join('') : `<option value="">–</option>${m.depts.filter(d => d.active).map(d => opt(d.id, d.name)).join('')}`}</select></label>
        ${full ? `<label class="f">Zahlart<select id="nPay">${opt('lastschrift', 'Lastschrift')}${m.settings.sepa_required ? '' : opt('rechnung', 'Rechnung') + opt('bar', 'bar')}</select></label>
        <label class="f nb">Kontoinhaber<input id="nHold" placeholder="wie auf dem Mandat"></label><label class="f w2 nb">IBAN<input id="nIban" autocomplete="off" spellcheck="false"></label><label class="f nb">SEPA-Mandat unterschrieben am<input id="nMand" type="date" value="${m.today}"></label>` : ''}
        <label class="f wall">Unterschriebene Beitrittserklärung${full ? ' mit SEPA-Mandat' : ''} (PDF oder Foto)<input id="nDocF" type="file" accept="application/pdf,image/*" hidden><div class="mv-up" id="nDoc"><span>Datei wählen oder hierher ziehen</span><b>Datei wählen …</b></div></label>
      </div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="nOk">Anlegen</button></div>`, true);
    // Kontoinhaber: vorschlagen, solange niemand etwas anderes eingetragen hat (bei Kindern meist ein Elternteil – dann überschreiben)
    let holdAuto = true;
    const holdSync = () => { if ($('nHold') && holdAuto) $('nHold').value = [val('nFirst'), val('nLast')].filter(Boolean).join(' '); };
    $('nFirst').addEventListener('input', holdSync); $('nLast').addEventListener('input', holdSync);
    if ($('nHold')) $('nHold').addEventListener('input', () => { holdAuto = !val('nHold'); });
    // Beitrittserklärung gleich hochladen, beim Anlegen wird sie dem Mitglied zugeordnet
    let doc = null;
    const upDoc = async f => {
      if (!f) return;
      const box = $('nDoc'); box.classList.remove('ok'); box.querySelector('span').textContent = `Lade hoch: ${f.name} …`;
      try {
        const r = await fetch('api/admin/x/mitglieder/member/new-document', { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(f.name) }, body: f });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Hochladen fehlgeschlagen.');
        doc = j; box.classList.add('ok'); box.querySelector('span').textContent = `✓ ${f.name} · ${f.size < 1048576 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : (f.size / 1048576).toFixed(1).replace('.', ',') + ' MB'}`; box.querySelector('b').textContent = 'Ersetzen …';
      } catch (e) { doc = null; box.querySelector('span').textContent = 'Datei wählen oder hierher ziehen'; fail(e); }
    };
    $('nDocF').onchange = () => upDoc($('nDocF').files[0]);
    const dz = $('nDoc');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); if (e.dataTransfer.files.length) upDoc(e.dataTransfer.files[0]); });
    const fees = () => {   // Beiträge passend zum Alter (bei Eintritt) – unpassende ausgegraut
      if (!$('nFee')) return;
      const age = ageAt(val('nBirth'), val('nEntry') || m.today), cur = val('nFee');
      const fits = x => age == null ? x.age_min == null && x.age_max == null : (x.age_min == null || age >= x.age_min) && (x.age_max == null || age <= x.age_max);
      const list = m.fees.filter(f => f.active && f.kind !== 'zusatz'), ok = list.filter(fits), no = list.filter(x => !fits(x));
      $('nFee').innerHTML = `<option value="">– Beitrag wählen –</option>${ok.map(f => opt(f.id, feeLabel(f), cur)).join('')}${no.length ? `<optgroup label="${esc(age == null ? 'mit Altersgrenze – erst Geburtsdatum eintragen' : `passt nicht zum Alter (${age} Jahre)`)}">${no.map(f => `<option value="${f.id}" disabled>${esc(feeLabel(f))}</option>`).join('')}</optgroup>` : ''}`;
    };
    const pay = () => { if ($('nPay')) $('dialog').querySelectorAll('.nb').forEach(x => { x.style.display = val('nPay') === 'lastschrift' ? '' : 'none'; }); };
    fees(); pay();
    $('nBirth').onchange = fees; $('nEntry').onchange = fees; if ($('nPay')) $('nPay').onchange = pay;
    $('c').onclick = closeDialog; setTimeout(() => $('nFirst').focus(), 50);
    $('nOk').onclick = () => GK.busy($('nOk'), async () => {
      try {
        const r = await api('member', 'POST', { first_name: val('nFirst'), last_name: val('nLast'), birth_date: val('nBirth') || null, email: val('nMail'), mobile: val('nMob'), street: val('nStreet'), zip: val('nZip'), city: val('nCity'),
          entry_date: val('nEntry'), member_no: val('nNo') || undefined, department_id: +val('nDept') || undefined,
          doc_id: doc ? doc.doc_id : null,
          ...(full ? { fee_id: +val('nFee') || null, payment: val('nPay'), iban: val('nIban'), holder: val('nHold'), mandate_date: val('nMand') } : {}) });
        closeDialog(); toast(r.pending ? `Mitglied angelegt. ${PENDING}` : 'Mitglied angelegt.'); openMember(r.id);
      } catch (e) { fail(e); }
    });
  }


  /* ================================================================= Mitglied (Detailansicht) */
  /** Überschrift = Name, darunter eine Reiterzeile: ← Alle Mitglieder · Stammdaten · Mitgliedschaft · Zahlung & Familie · Konto & Mandat · Dokumente · Verlauf.
   *  Aktionen stehen auf dem Reiter, zu dem sie gehören (Austritt bei „Mitgliedschaft“, Löschen unten bei „Stammdaten“). */
  GK.registerDetail({
    key: 'mitglied', page: 'mitglieder', back: 'Alle Mitglieder', perm: 'mitglieder',
    load: async id => {
      st.fromDetail = true;   // „← Alle Mitglieder“ zeigt die Liste mit den zuletzt gesetzten Filtern
      await loadMeta();
      const d = await api('member/' + id).catch(() => null);
      if (!d) return null;
      if (!st.rows.length) await loadRows();
      const p = d.person, status = p.anonymized_at ? 'anonym' : p.exited ? 'ausgetreten' : p.status;
      const tabs = [['stamm', 'Stammdaten'], ['mitgliedschaft', 'Mitgliedschaft'], ...(SC() ? [] : [['zahlung', 'Zahlung & Familie'], ['konto', 'Konto & Mandat']]), ...(d.documents ? [['dokumente', `Dokumente${d.documents.length ? ' (' + d.documents.length + ')' : ''}`]] : []), ['verlauf', 'Verlauf']];
      const lead = [p.member_no ? `${GK.T('Nr.')} ${p.member_no}` : '', p.age != null ? `${p.age} ${GK.T('Jahre')}` : '', status ? GK.T((STATUS[status] || ['', status])[1]) : '',
        p.exit_date && !p.exited ? `${GK.T('Austritt zum')} ${deDate(p.exit_date)}` : '', d.payer ? `${GK.T('zahlt über')} ${GK.lastFirst(d.payer.name)}` : '', d.familyHead ? `${GK.T('Familie von')} ${GK.lastFirst(d.familyHead.name)}` : '',
        d.changes.length ? `${d.changes.length} ${GK.T(d.changes.length === 1 ? 'Änderung aus der App' : 'Änderungen aus der App')}` : ''].filter(Boolean).join(' · ');
      return { title: GK.lastFirst(p.name), lead, tabs, d };
    },
    render: async (k, body, rec, id) => {
      const d = rec.d, again = () => GK.openDetail('mitglied', id);
      if (k === 'stamm') subStamm(body, d, again);
      else if (k === 'mitgliedschaft') subMembership(body, d, again);
      else if (k === 'zahlung') subPayment(body, d, again);
      else if (k === 'konto') subBank(body, d, again);
      else if (k === 'dokumente') subDocs(body, d, again);
      else if (k === 'verlauf') subHistory(body, d);
      missingBanner(body, d);
    },
  });
  /** Fehlende Pflichtangaben: einmal je Ansicht, oben */
  function missingBanner(el, d) {
    const p = d.person;
    if (!(d.missing || []).length) return;
    el.insertAdjacentHTML('afterbegin', `<div class="banner r"><span><b>Pflichtangaben fehlen:</b> ${d.missing.map(esc).join(' · ')}. Ohne sie fehlt das Mitglied im Beitragslauf.${!p.member_id ? ' Ist es kein Vereinsmitglied (z. B. Trainer), bitte in „Kein Mitglied“ umwandeln.' : ''}</span>${!p.member_id && !SC() ? '<button class="btn small" id="mvNoMem" type="button">In „Kein Mitglied“ umwandeln …</button>' : ''}</div>`);
    if ($('mvNoMem')) $('mvNoMem').onclick = async () => {
      if (!await GK.ask(`${GK.lastFirst(p.name)} in „Kein Mitglied“ umwandeln?\n\nDas Konto bleibt im Verkauf (PIN, offener Betrag, Buchungen) und wird unter Verkauf › Abrechnung bezahlt. In der Mitgliederliste erscheint es nicht mehr.`, { ok: 'Umwandeln' })) return;
      try { await GK.api('members/' + p.id, 'PUT', { kind: 'nichtmitglied' }); GK.toast('Umgewandelt in „Kein Mitglied“.'); GK.closeDetail(); } catch (e) { fail(e); }
    };
  }

  function subStamm(el, d, again) {
    const p = d.person, ro = Boolean(p.anonymized_at);
    const consents = st.meta.settings.consents;
    el.innerHTML = `<div class="card"><h3>Person</h3><div class="mv-grid" style="--c:4">
        <label class="f">Anrede<select id="sSal">${['', 'Frau', 'Herr', 'Divers'].map(x => opt(x, x || '–', p.salutation)).join('')}</select></label>
        <label class="f">Titel<input id="sTitle" value="${esc(p.title || '')}"></label>
        <label class="f">Vorname<input id="sFirst" value="${esc(p.first_name || '')}"></label>
        <label class="f">Nachname<input id="sLast" value="${esc(p.last_name || '')}"></label>
        <label class="f">Geburtsdatum<input id="sBirth" type="date" value="${esc(p.birth_date || '')}"></label>
        <label class="f">Geschlecht<select id="sGen">${opt('', '–', p.gender)}${Object.entries(GENDER).map(([k, l]) => opt(k, l, p.gender)).join('')}</select></label>
        <label class="f">Mitgliedsnummer<input id="sNo" value="${esc(p.member_no || '')}"></label>
        <label class="f">Status<select id="sStatus">${opt('aktiv', 'aktiv', p.status)}${opt('passiv', 'passiv / fördernd', p.status)}${opt('ehren', 'Ehrenmitglied', p.status)}${opt('ruhend', 'ruhend', p.status)}</select></label>
      </div></div>
      <div class="card"><h3>Anschrift & Kontakt</h3><div class="mv-grid" style="--c:4">
        <label class="f w2">Straße und Hausnummer<input id="sStreet" value="${esc(p.street || '')}"></label>
        <label class="f">PLZ<input id="sZip" value="${esc(p.zip || '')}" inputmode="numeric"></label>
        <label class="f">Ort<input id="sCity" value="${esc(p.city || '')}"></label>
        <label class="f w2">Adresszusatz<input id="sExtra" value="${esc(p.address_extra || '')}"></label>
        <label class="f w2">Land<input id="sCountry" value="${esc(p.country || '')}" placeholder="Deutschland"></label>
        <label class="f w2">E-Mail<input id="sMail" type="email" value="${esc(p.email || '')}"></label>
        <label class="f">Mobil<input id="sMobile" value="${esc(p.mobile || '')}"></label>
        <label class="f">Telefon<input id="sPhone" value="${esc(p.phone || '')}"></label>
        <label class="f w2">Briefanrede<input id="sLetter" value="${esc(p.letter_salutation || '')}" placeholder="z. B. Liebe Anna"></label>
        <label class="f">Eintritt<input id="sEntry" type="date" value="${esc(p.entry_date || '')}"></label>
        <label class="f">Schlüsselnummer<input id="sKey" value="${esc(p.key_no || '')}"></label>
        <label class="f wall">Notizen (nur für den Vorstand)<textarea id="sNotes" style="min-height:80px">${esc(p.notes || '')}</textarea></label>
      </div></div>
      <div class="card"><h3>Einwilligungen</h3><div class="mv-cons">${consents.map(c => `<label class="chk"><input type="checkbox" data-cons="${esc(c.key)}" ${p.consents[c.key] ? 'checked' : ''}>
          <span><b>${esc(c.short)}</b>${c.required ? ' <span class="muted s">(Pflicht)</span>' : ''}${p.consents[c.key] ? ` <span class="muted s">· seit ${deDate(p.consents[c.key])}</span>` : ''}<br><span class="muted s">${esc(c.text)}</span></span></label>`).join('')}</div></div>
      ${ro ? '' : '<div class="row" style="justify-content:flex-end;margin-bottom:16px"><button class="btn primary" id="sSave">Speichern</button></div>'}
      ${ro || p.exited ? '' : `<div class="card"><h3>Tablet-PIN</h3><div class="row">${p.has_pin ? `<span class="pill g">PIN vergeben</span>${SC() ? '' : '<button class="btn" id="mvPin">PIN zurücksetzen</button>'}` : '<span class="pill a">kein PIN</span>'}</div>
        <p class="muted s" style="margin-bottom:0">${p.has_pin ? 'Mit der PIN bucht das Mitglied am Tablet Verkauf, Plätze und Helferdienste.' : 'Ohne PIN kann am Tablet nicht gebucht oder storniert werden – das Mitglied legt sie beim ersten Mal am Tablet fest.'}</p></div>`}
      ${p.photo && !ro ? `<div class="card"><h3>Profilbild</h3><div class="row"><span class="av lg mv-pic"><img src="api/admin/photo/${p.id}?v=${esc(p.photo)}" alt=""></span><button class="btn danger" id="mvPh">Profilbild entfernen …</button></div>
        <p class="muted s" style="margin-bottom:0">Das Mitglied hat es in der App hochgeladen und kann dort jederzeit ein neues wählen.</p></div>` : ''}
      ${!SC() && !ro ? `<div class="card"><h3>Vorsicht</h3><p class="muted s" style="margin-top:0">Löschen geht nur, wenn nichts mehr am Mitglied hängt. Anonymisieren (erst nach dem Austritt) entfernt Name, Anschrift, Konto und Dokumente unwiderruflich.</p>
        <div class="row"><button class="btn danger" id="mvDel">Löschen …</button>${p.exited ? '<button class="btn danger" id="mvAnon">Anonymisieren …</button>' : ''}</div></div>` : ''}`;
    GK.watch(el);
    GK.tabTools(SC() ? '' : `<a class="btn" href="${BASE}member/${p.id}/auskunft" download>Datenauskunft</a>`, el);
    if (ro) { el.querySelectorAll('input, select, textarea').forEach(x => { x.disabled = true; }); return; }
    if ($('mvPin')) $('mvPin').onclick = async () => {
      if (!await ask(`PIN von ${p.name} zurücksetzen?\n\nDas Mitglied legt beim nächsten Mal am Tablet eine neue PIN fest. Bis dahin sind Buchen und Stornieren von Plätzen am Tablet gesperrt.`, { ok: 'Zurücksetzen', danger: true })) return;
      try { await GK.api(`members/${p.id}/reset-pin`, 'POST', {}); toast('PIN zurückgesetzt.'); again(); } catch (e) { fail(e); }
    };
    if ($('mvPh')) $('mvPh').onclick = async () => { if (!await ask(`Profilbild von ${p.name} entfernen?\n\nDas Mitglied kann in der App jederzeit ein neues hochladen.`, { ok: 'Entfernen', danger: true })) return; try { await GK.api('photo/' + p.id, 'DELETE'); toast('Profilbild entfernt.'); again(); } catch (e) { fail(e); } };
    if ($('mvDel')) $('mvDel').onclick = () => GK.deleteMember({ id: p.id, name: p.name, kind: 'mitglied' }, () => GK.closeDetail());
    if ($('mvAnon')) $('mvAnon').onclick = async () => {
      const t = await askText('Mitglied anonymisieren?\nName, Anschrift, Kontakt, Bankverbindung, Dokumente und Verlauf werden unwiderruflich gelöscht. Für die Statistik bleiben Geburtsjahr, Geschlecht, Ein-/Austritt und Abteilungen; Buchungen bleiben unter „Anonym …“. Zur Bestätigung ANONYMISIEREN eingeben:', '', { ok: 'Anonymisieren' });
      if (t == null) return;
      try { await api(`member/${p.id}/anonymize`, 'POST', { confirm: t.trim() }); toast('Anonymisiert.'); again(); } catch (e) { fail(e); }
    };
    if (st.meta.scope) {   // Abteilungsadmin: Vereinsdaten und Einwilligungen pflegt die Vereinsverwaltung
      ['sNo', 'sStatus', 'sEntry', 'sKey', 'sNotes'].forEach(i => { if ($(i)) $(i).disabled = true; });
      el.querySelectorAll('[data-cons]').forEach(x => { x.disabled = true; });
      const h = document.createElement('p'); h.className = 'muted s'; h.textContent = 'Mitgliedsnummer, Status, Eintritt, Schlüsselnummer, Notizen und Einwilligungen pflegt die Vereinsverwaltung.';
      $('sSave').parentNode.prepend(h); h.style.marginRight = 'auto';
    }
    $('sSave').onclick = async () => {
      try {
        await api('member/' + p.id, 'PUT', { salutation: val('sSal'), title: val('sTitle'), first_name: val('sFirst'), last_name: val('sLast'), birth_date: val('sBirth') || null, gender: val('sGen'), member_no: val('sNo'),
          status: val('sStatus'), street: val('sStreet'), zip: val('sZip'), city: val('sCity'), address_extra: val('sExtra'), country: val('sCountry'), email: val('sMail'), mobile: val('sMobile'), phone: val('sPhone'),
          letter_salutation: val('sLetter'), entry_date: val('sEntry') || null, key_no: val('sKey'), notes: $('sNotes').value,
          consents: Object.fromEntries([...el.querySelectorAll('[data-cons]')].map(c => [c.dataset.cons, c.checked])) });
        GK.clean(); toast('Gespeichert.'); again();
      } catch (e) { fail(e); }
    };
  }

  function subMembership(el, d, again) {
    const p = d.person, m = st.meta, id = p.id;
    const feeRows = d.fees.map(f => `<tr class="${f.end_date && f.end_date < m.today ? 'off' : ''}"><td><b translate="no">${esc(f.name)}</b>${(!f.end_date || f.end_date >= m.today) && p.age != null && ((f.age_min != null && p.age < f.age_min) || (f.age_max != null && p.age > f.age_max)) ? ` <span class="pill r">passt nicht zum Alter (${f.age_max != null ? `bis ${f.age_max}` : `ab ${f.age_min}`} J.)</span>` : ''}${f.note ? `<div class="muted s">${esc(f.note)}</div>` : ''}</td>
      <td class="r">${euro(f.eff_cents)}${f.cents != null ? ' <span class="pill">abweichend</span>' : ''}</td><td>${esc(INTERVAL[f.interval] || f.interval)}</td><td class="num nw k-weg">${deDate(f.start_date)}</td><td class="nw k-weg">${f.end_date ? deDate(f.end_date) : '–'}</td>
      <td class="nw k-weg">${f.booked_until ? deDate(f.booked_until) : '<span class="muted s">noch nichts</span>'}</td><td class="r nw">${SC() ? '' : `<button class="btn small" data-mf="${f.id}">Bearbeiten</button>`}</td></tr>`).join('');
    const myDept = depId => !SC() || m.scope.some(x => x.id === depId);
    const zText = x => '<div>' + (x.zusatz_free ? '<span class="pill">befreit</span>' : x.zusatz ? `<span translate="no">${esc(x.zusatz.name)}</span> · ${euro(x.zusatz.cents)}${x.zusatz.auto ? '' : ' <span class="pill b">fest</span>'}${x.zusatz.assumed ? '<div class="muted s">Geburtsdatum fehlt – Erwachsenenbeitrag angenommen</div>' : ''}${x.booked_until ? `<div class="muted s">abgerechnet bis ${deDate(x.booked_until)}</div>` : ''}`
      : x.zusatz_nomatch ? (x.zusatz_age != null ? `<span class="pill">beitragsfrei</span><div class="muted s">keine Altersstufe für ${x.zusatz_age} Jahre</div>` : '<span class="pill a">Geburtsdatum fehlt</span>') : '<span class="muted s">–</span>') + '</div>';
    const depRows = d.departments.map(x => `<tr class="${x.exit_date && x.exit_date < m.today ? 'off' : ''}"><td><b translate="no">${esc(x.name)}</b></td><td>${esc(x.status)}</td><td class="num nw k-weg">${deDate(x.entry_date) || '–'}</td><td class="nw k-weg">${x.exit_date ? deDate(x.exit_date) : '–'}</td><td>${zText(x)}</td>
      <td class="r nw">${myDept(x.department_id) ? `<button class="btn small" data-md="${x.id}">Bearbeiten</button>` : ''}</td></tr>`).join('');
    el.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;flex:1 1 180px;min-width:0;line-height:1.25">Beiträge</h3>${SC() || d.familyHead ? '' : '<button class="btn small" id="fAdd">+ Beitrag</button>'}</div>
        ${d.fees.length ? `<table class="tbl kompakt"><tr><th>Beitrag</th><th class="r">Betrag</th><th>Rhythmus</th><th>ab</th><th>bis</th><th>abgerechnet bis</th><th></th></tr>${feeRows}</table>`
          : `<p class="muted">${d.familyHead ? `Kein eigener Beitrag – im Familienbeitrag von ${esc(d.familyHead.name)} enthalten (Reiter „Zahlung & Familie“).` : p.payer_id ? 'Kein eigener Beitrag – der Zahler zahlt.' : 'Noch kein Beitrag zugeordnet.'}</p>`}</div>
      <div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;flex:1 1 180px;min-width:0;line-height:1.25">Abteilungen</h3>${SC() ? '' : '<button class="btn small" id="dAdd">+ Abteilung</button>'}</div>
        ${d.departments.length ? `<table class="tbl kompakt"><tr><th>Abteilung</th><th>Status</th><th>Eintritt</th><th>Austritt</th><th>Zusatzbeitrag</th><th></th></tr>${depRows}</table>
          <p class="muted s" style="margin-bottom:0">${d.familyHead ? `Der Zusatzbeitrag wird ${esc(d.familyHead.name)} (Oberhaupt) zusätzlich zum Familienbeitrag belastet.` : 'Zusatzbeiträge der Abteilungen gelten je Person nach Alter – auch in einer Familie zahlt der Hauptzahler sie nur für die Angehörigen, die der Abteilung angehören.'}</p>` : '<p class="empty">Keiner Abteilung zugeordnet.</p>'}</div>
      <div class="mv-two">
        <div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;flex:1 1 180px;min-width:0;line-height:1.25">Ehrungen</h3><button class="btn small" id="hAdd">+ Ehrung</button></div>
          ${d.honors.length ? `<table class="tbl kompakt">${d.honors.map(h => `<tr><td><b>${esc(h.name)}</b></td><td class="num nw">${deDate(h.date)}</td><td class="r"><button class="btn small danger" data-hx="${h.id}">Entfernen</button></td></tr>`).join('')}</table>` : '<p class="empty">Keine Ehrungen eingetragen.</p>'}
          ${can('gratulationen') ? `<label class="chk" style="margin-top:12px"><input type="checkbox" id="mvNoCg" ${d.no_congrats ? 'checked' : ''}> Keine Gratulation gewünscht</label>` : ''}</div>
        <div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;flex:1 1 180px;min-width:0;line-height:1.25">Ämter & Funktionen</h3><button class="btn small" id="aAdd">+ Amt</button></div>
          ${d.functions.length ? `<table class="tbl kompakt">${d.functions.map(h => `<tr class="${h.to_date && h.to_date < m.today ? 'off' : ''}"><td><b>${esc(h.name)}</b></td><td class="num nw">${deDate(h.from_date) || ''}${h.to_date ? ' – ' + deDate(h.to_date) : ''}</td><td class="r"><button class="btn small danger" data-ax="${h.id}">Entfernen</button></td></tr>`).join('')}</table>` : '<p class="empty">Keine Ämter oder Funktionen.</p>'}</div>
      </div>`;
    el.insertAdjacentHTML('afterbegin', (d.ageNotices || []).map(n => `<div class="banner a"><span><b>Altersstufe:</b> ${esc(n.label)}${n.dept ? ` (<span translate="no">${esc(n.dept)}</span>)` : ''} – ab ${deDate(n.due_date)}: ${ageFrom(n)} → ${ageTo(n)}. Bis zur Entscheidung läuft der bisherige Beitrag weiter.</span>
      <span class="nw" style="margin-left:auto"><button class="btn small" data-age="${n.id}:belassen">So belassen</button> <button class="btn small" data-age="${n.id}:umstellen" ${n.kind !== 'zusatz' && !n.to ? 'disabled' : ''}>Umstellen</button></span></div>`).join(''));
    ageBind(el, again);
    // Austritt gehört zur Mitgliedschaft: Knopf rechts in der Reiterzeile
    if (!p.anonymized_at) GK.tabTools(p.exit_date ? `<button class="btn" id="mvRe">${p.exited ? 'Wiedereintritt …' : 'Austritt zurücknehmen'}</button>` : '<button class="btn" id="mvExit">Austritt …</button>', el);
    if ($('mvExit')) $('mvExit').onclick = () => exitDialog(d, again);
    // Austritt noch nicht wirksam: zurücknehmen (Nummer bleibt). Schon ausgetreten: Wiedereintritt mit neuer Mitgliedsnummer und neuem SEPA-Mandat
    if ($('mvRe')) $('mvRe').onclick = async () => {
      const q = p.exited ? `Wiedereintritt von ${p.name}?\n\n${p.name} bekommt eine neue Mitgliedsnummer (die bisherige ${p.member_no || '–'} wird nicht wieder vergeben) und als Eintritt das heutige Datum. Bei Lastschrift ist ein neues SEPA-Mandat nötig. Beiträge und Abteilungen, die zum Austritt beendet wurden, laufen wieder – bitte danach prüfen.`
        : `Austritt von ${p.name} zurücknehmen?\n\nBeiträge und Abteilungen, die zum Austritt beendet wurden, bitte danach prüfen.`;
      if (!await ask(q, { ok: p.exited ? 'Wieder aufnehmen' : 'Zurücknehmen' })) return;
      try { const r = await api(`member/${id}/reenter`, 'POST', {}); toast(r.pending ? `Rückkehr gemeldet. ${PENDING}` : r.member_no ? `Wieder aufgenommen – neue Mitgliedsnummer ${r.member_no}.` : 'Austritt zurückgenommen.'); again(); } catch (e) { fail(e); }
    };
    const feeDialog = f => {
      dialog(`<h2>${f ? esc(f.name) : 'Beitrag zuordnen'}</h2><div class="mv-grid" style="--c:2">
        ${f ? '' : `<label class="f wall">Beitragsart<select translate="no" id="fFee">${(() => {
          const fits = x => p.age == null ? x.age_min == null && x.age_max == null : (x.age_min == null || p.age >= x.age_min) && (x.age_max == null || p.age <= x.age_max);
          const list = m.fees.filter(x => x.active && x.kind !== 'zusatz');
          const ok = list.filter(fits), no = list.filter(x => !fits(x));
          return ok.map(x => opt(x.id, feeLabel(x))).join('') + (no.length ? `<optgroup label="${esc(p.age == null ? 'mit Altersgrenze – erst Geburtsdatum eintragen' : `passt nicht zum Alter (${p.age} Jahre)`)}">${no.map(x => `<option value="${x.id}" disabled>${esc(feeLabel(x))}</option>`).join('')}</optgroup>` : '');
        })()}</select></label>`}
        <label class="f">Ab<input id="fStart" type="date" value="${esc(f ? f.start_date : (p.entry_date || m.today))}"></label><label class="f">Bis (leer = unbefristet)<input id="fEnd" type="date" value="${esc(f ? f.end_date || '' : '')}"></label>
        <label class="f">Abweichender Betrag (leer = laut Beitragsart)<input id="fCents" inputmode="decimal" value="${f && f.cents != null ? centsToInput(f.cents) : ''}" placeholder="z. B. 54,00"></label>
        <label class="f">Abgerechnet bis<input id="fBooked" type="date" value="${esc(f ? f.booked_until || '' : '')}"></label>
        <label class="f wall">Notiz<input id="fNote" value="${esc(f ? f.note || '' : '')}" placeholder="z. B. Ermäßigung bis Ausbildungsende"></label></div>
        <p class="muted s">„Abgerechnet bis“ setzt der Beitragslauf selbst. Nur ändern, wenn Beiträge außerhalb von Clubwerk abgerechnet wurden.</p>
        ${f ? '<div class="row"><button class="btn danger" id="fDel">Beitrag entfernen …</button></div>' : ''}
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="fOk">Speichern</button></div>`);
      $('c').onclick = closeDialog;
      if ($('fDel')) $('fDel').onclick = () => confirmIn(`Beitrag „${f.name}“ entfernen?`, 'Wenn er schon abgerechnet wurde, bitte stattdessen ein Ende eintragen.', 'Beitrag entfernen', async () => {
        try { await api('mf/' + f.id, 'DELETE'); closeDialog(); toast('Entfernt.'); again(); } catch (e) { fail(e); }
      }, () => feeDialog(f));
      $('fOk').onclick = () => GK.busy($('fOk'), async () => {
        const body = { start_date: val('fStart'), end_date: val('fEnd') || null, booked_until: val('fBooked') || null, cents: val('fCents') ? toCents(val('fCents')) : null, note: val('fNote') };
        try { if (f) await api('mf/' + f.id, 'PUT', body); else await api(`member/${id}/fees`, 'POST', { ...body, fee_id: +val('fFee') }); closeDialog(); toast('Gespeichert.'); again(); } catch (e) { fail(e); }
      });
    };
    if ($('fAdd')) $('fAdd').onclick = () => feeDialog(null);
    el.querySelectorAll('[data-mf]').forEach(b => { b.onclick = () => feeDialog(d.fees.find(f => f.id === +b.dataset.mf)); });
    const deptDialog = x => {
      dialog(`<h2>${x ? esc(x.name) : 'Abteilung zuordnen'}</h2><div class="mv-grid" style="--c:2">
        ${x ? '' : `<label class="f wall">Abteilung<select translate="no" id="dDep">${(SC() ? m.scope : m.depts.filter(y => y.active)).map(y => opt(y.id, y.name)).join('')}</select></label>`}
        <label class="f">Eintritt<input id="dIn" type="date" value="${esc(x ? x.entry_date || '' : m.today)}"></label><label class="f">Austritt<input id="dOut" type="date" value="${esc(x ? x.exit_date || '' : '')}"></label>
        <label class="f">Status<select id="dSt">${opt('aktiv', 'aktiv', x && x.status)}${opt('passiv', 'passiv', x && x.status)}</select></label>
        <label class="f">Status beim Verband (optional)<input id="dFed" value="${esc(x ? x.federation_status || '' : '')}" placeholder="z. B. spielberechtigt"></label>
        ${x && !SC() ? `<label class="f">Zusatzbeitrag<select id="dFee" translate="no"><option value="">${esc(GK.T('automatisch nach Alter'))}</option><option value="frei" ${x.zusatz_free ? 'selected' : ''}>${esc(GK.T('befreit (z. B. Trainer)'))}</option>
            ${m.fees.filter(f => f.kind === 'zusatz' && f.department_id === x.department_id).map(f => `<option value="${f.id}" ${!x.zusatz_free && x.fee_id === f.id ? 'selected' : ''}>${esc(f.name)} · ${esc(euro(f.cents))}</option>`).join('')}</select></label>
          <label class="f">Zusatzbeitrag abgerechnet bis<input id="dBk" type="date" value="${esc(x.booked_until || '')}"></label>` : ''}</div>
        ${x ? '<div class="row" style="margin-top:12px"><button class="btn danger" id="dDel">Abteilung entfernen …</button></div>' : ''}
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="dOk">Speichern</button></div>`);
      $('c').onclick = closeDialog;
      if ($('dDel')) $('dDel').onclick = () => confirmIn(`Abteilung „${x.name}“ entfernen?`, 'Für einen Austritt aus der Abteilung besser ein Austrittsdatum eintragen – dann stimmt die Statistik.', 'Abteilung entfernen', async () => {
        try { await api('md/' + x.id, 'DELETE'); closeDialog(); again(); } catch (e) { fail(e); }
      }, () => deptDialog(x));
      $('dOk').onclick = () => GK.busy($('dOk'), async () => {
        const body = { entry_date: val('dIn') || null, exit_date: val('dOut') || null, status: val('dSt'), federation_status: val('dFed') };
        if (x && $('dFee')) { const fv = val('dFee'); Object.assign(body, { fee_free: fv === 'frei', fee_id: fv && fv !== 'frei' ? +fv : null, booked_until: val('dBk') || null }); }
        try { if (x) await api('md/' + x.id, 'PUT', body); else await api(`member/${id}/departments`, 'POST', { ...body, department_id: +val('dDep') }); closeDialog(); toast('Gespeichert.'); again(); } catch (e) { fail(e); }
      });
    };
    if ($('dAdd')) $('dAdd').onclick = () => (m.depts.length ? deptDialog(null) : toast('Bitte zuerst unter Mitglieder › Beiträge & Abteilungen eine Abteilung anlegen.', true));
    el.querySelectorAll('[data-md]').forEach(b => { b.onclick = () => deptDialog(d.departments.find(x => x.id === +b.dataset.md)); });
    const simple = (kind, title, extra) => {
      dialog(`<h2>${title}</h2><div class="mv-grid" style="--c:2"><label class="f wall">Bezeichnung<input id="xName"></label>${extra}</div>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="xOk">Hinzufügen</button></div>`);
      $('c').onclick = closeDialog; setTimeout(() => $('xName').focus(), 50);
      $('xOk').onclick = () => GK.busy($('xOk'), async () => {
        const body = { name: val('xName') }; el.ownerDocument.querySelectorAll('#dialog [data-k]').forEach(i => { body[i.dataset.k] = i.value || null; });
        try { await api(`member/${id}/${kind}`, 'POST', body); closeDialog(); again(); } catch (e) { fail(e); }
      });
    };
    if ($('mvNoCg')) $('mvNoCg').onchange = async () => { try { await api('congrats/off/' + p.id, 'PUT', { off: $('mvNoCg').checked }); toast('Gespeichert.'); } catch (e) { fail(e); $('mvNoCg').checked = !$('mvNoCg').checked; } };
    $('hAdd').onclick = () => simple('honors', 'Ehrung', '<label class="f">Datum<input type="date" data-k="date"></label><label class="f">Notiz<input data-k="note"></label>');
    $('aAdd').onclick = () => simple('functions', 'Amt / Funktion', '<label class="f">Von<input type="date" data-k="from_date"></label><label class="f">Bis<input type="date" data-k="to_date"></label>');
    el.querySelectorAll('[data-hx]').forEach(b => { b.onclick = async () => { const h = d.honors.find(x => x.id === +b.dataset.hx); if (!await ask(`Ehrung „${h.name}“ entfernen?`, { ok: 'Entfernen' })) return; try { await api('honors/' + b.dataset.hx, 'DELETE'); again(); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-ax]').forEach(b => { b.onclick = async () => { const h = d.functions.find(x => x.id === +b.dataset.ax); if (!await ask(`Amt „${h.name}“ entfernen?`, { ok: 'Entfernen' })) return; try { await api('functions/' + b.dataset.ax, 'DELETE'); again(); } catch (e) { fail(e); } }; });
  }

  function subPayment(el, d, again) {
    const p = d.person, id = p.id, head = !p.payer_id;
    // Familienmitgliedschaft (Familienbeitrag des Oberhaupts) und Zahler (Geld) sind zwei getrennte Zuordnungen
    const ROLE = { oberhaupt: 'Oberhaupt', partner: 'Partner/in', kind: 'Kind' };
    const famFeeIds = new Set(st.meta.fees.filter(f => f.family && f.active && f.kind !== 'zusatz').map(f => f.id));
    const live = r => r.status !== 'ausgetreten' && r.status !== 'anonym';
    const heads = st.rows.filter(r => r.id !== id && live(r) && !r.family_of && (r.fee_ids.some(x => famFeeIds.has(x)) || r.id === p.family_of));
    const isHead = d.family.length > 0 && d.family[0].id === id;
    const famOpts = `<option value="">– keine –</option>${heads.map(r => opt(r.id, `${GK.lastFirst(r.name)}${r.member_no ? ' (' + r.member_no + ')' : ''}`, p.family_of)).join('')}`;
    const famTable = list => `<table class="tbl kompakt">${list.map(f => `<tr><td><b>${esc(f.name)}</b>${f.id === id ? '<div class="muted s">dieses Mitglied</div>' : ''}</td><td class="nw">${f.age != null ? f.age + ' Jahre' : '<span class="muted s">ohne Geburtsdatum</span>'}</td><td class="nw">${f.role === 'oberhaupt' ? '<span class="pill g">Oberhaupt</span>' : esc(ROLE[f.role] || f.role)}</td><td class="r nw">${f.id !== id ? `<button class="btn small" data-open="${f.id}">Öffnen</button>` : ''}${isHead && f.id !== id ? ` <button class="btn small" data-famx="${f.id}" title="Aus der Familienmitgliedschaft lösen">Lösen</button>` : ''}</td></tr>`).join('')}</table>`;
    const addable = st.rows.filter(r => r.id !== id && live(r) && !r.family_of && !d.family.some(f => f.id === r.id));
    el.innerHTML = `<div class="mv-two">
      <div class="card"><h3>Wer zahlt?</h3>
        <div class="mv-grid" style="--c:1">
          <label class="f">Zahler<select id="pPayer" ${d.familyHead ? 'disabled' : ''}><option value="">${esc(p.name)} zahlt selbst</option>${memberOptions(p.payer_id, id)}</select></label>
          <label class="f ${p.payer_id ? '' : 'hidden'}" id="pDrinksL">Verkauf am Tablet<select id="pSales">${opt('payer', 'Über den Hauptzahler (nicht in der Liste)', p.sales_mode || 'payer')}${opt('own_payer', 'Eigener Eintrag – zahlt der Hauptzahler', p.sales_mode)}${opt('own', 'Eigener Eintrag – zahlt selbst', p.sales_mode)}</select></label>
          <label class="f">Zahlungsart (des Zahlers)<select id="pPay" ${head ? '' : 'disabled'}>${Object.entries(PAY).filter(([k]) => !st.meta.settings.sepa_required || k === 'lastschrift' || k === p.payment).map(([k, l]) => opt(k, l, p.payment)).join('')}</select></label>
        </div>
        ${d.familyHead ? `<div class="banner b mv-lockinfo"><span><b>Familienmitglied von ${esc(d.familyHead.name)}</b> – gezahlt wird immer über das Oberhaupt. Einstellbar ist nur, wie am Tablet gebucht wird.</span></div>` : ''}
        <p class="muted s">Der Zahler ist eine reine Geldbeziehung: Beiträge, Zusatzbeiträge und Verkauf aller Angehörigen laufen über sein Konto und Mandat – auch für erwachsene Kinder mit eigenem Beitrag. Am Tablet bucht die Zahlergruppe standardmäßig auf den Namen des Hauptzahlers.</p>
        ${d.payerGroup.length ? `<h4 class="mv-sub">Zahlergruppe</h4><table class="tbl kompakt">${d.payerGroup.map(f => `<tr><td><b>${esc(f.name)}</b>${f.id === id ? '<div class="muted s">dieses Mitglied</div>' : ''}</td><td class="nw">${f.age != null ? f.age + ' Jahre' : '<span class="muted s">ohne Geburtsdatum</span>'}</td><td class="nw">${f.head ? '<span class="pill g">Hauptzahler</span>' : `<span class="muted s">Verkauf: ${f.sales_mode === 'payer' ? 'über Hauptzahler' : f.sales_mode === 'own' ? 'eigener Eintrag, zahlt selbst' : 'eigener Eintrag'}</span>`}</td><td class="r nw">${f.id !== id ? `<button class="btn small" data-open="${f.id}">Öffnen</button>` : ''}</td></tr>`).join('')}</table>` : ''}
        <div class="row" style="justify-content:flex-end"><button class="btn primary" id="pSave">Speichern</button></div></div>
      <div class="card"><h3>Familienmitgliedschaft</h3>
        <div class="mv-grid" style="--c:1">
          <label class="f">Familienmitgliedschaft bei<select id="pFamOf" ${isHead ? 'disabled' : ''}>${famOpts}</select></label>
        </div>
        <p class="muted s">${isHead ? `${esc(p.name)} ist Oberhaupt: der eigene Familienbeitrag deckt Partner/in und Kinder bis ${esc(String(st.meta.settings.family_child_max || 18))} Jahre ab. Ein Oberhaupt kann nicht selbst einer anderen Familie zugeordnet sein.`
          : `Wählbar sind Mitglieder mit aktivem Familienbeitrag. Wer zugeordnet ist, braucht keine eigene Beitragsart – Zusatzbeiträge der Abteilungen bleiben je Person. Erlaubt: Oberhaupt, ein/e Partner/in und Kinder bis ${esc(String(st.meta.settings.family_child_max || 18))} Jahre.${!d.familyFee && famFeeIds.size === 0 ? ' Noch keine Beitragsart mit Familienbeitrag angelegt (Mitglieder › Beiträge & Abteilungen).' : ''}`}</p>
        ${d.family.length ? `<h4 class="mv-sub">Familie</h4>${famTable(d.family)}` : d.familyFee ? '<p class="empty">Noch keine Angehörigen zugeordnet – unten hinzufügen.</p>' : ''}
        ${isHead || d.familyFee ? `<div class="row" style="margin-top:10px"><label class="f" style="flex:1"><select id="pAddFam" data-nodirty><option value="">Angehörige/n hinzufügen …</option>${addable.map(r => opt(r.id, `${GK.lastFirst(r.name)}${r.member_no ? ' (' + r.member_no + ')' : ''}`, '')).join('')}</select></label><button class="btn" id="pFamOk">Hinzufügen</button></div>` : ''}
        <div class="row" style="justify-content:flex-end"><button class="btn primary" id="pFamSave" ${isHead ? 'disabled' : ''}>Speichern</button></div></div></div>
      ${d.charges ? `<div class="card"><h3>Forderungen & Zahlungen</h3>
        ${d.charges.length ? chargeTable(d.charges, { member: true }) : '<p class="empty">Noch keine Forderungen.</p>'}
        ${d.drinksOpen ? `<p class="muted s">Dazu noch nicht abgerechneter Verkauf: <b>${euro(d.drinksOpen)}</b></p>` : ''}</div>` : ''}`;
    GK.watch(el);
    if (d.charges) GK.tabTools(`${head && d.charges.some(c => c.status === 'offen') ? `<a class="btn" href="${BASE}invoice.pdf?member=${id}" target="_blank">Rechnung (PDF)</a>` : ''}<button class="btn primary" id="pCharge">+ Forderung</button>`, el);
    $('pPayer').onchange = () => { $('pDrinksL').classList.toggle('hidden', !val('pPayer')); $('pPay').disabled = Boolean(val('pPayer')); };
    $('pSave').onclick = async () => {
      try {
        await api(`member/${id}/payer`, 'PUT', { payer_id: val('pPayer') ? +val('pPayer') : null, sales_mode: val('pSales') });
        if (!$('pPay').disabled) await api('member/' + id, 'PUT', { payment: val('pPay') });
        GK.clean(); toast('Gespeichert.'); again();
      } catch (e) { fail(e); }
    };
    $('pFamSave').onclick = () => GK.busy($('pFamSave'), async () => { try { await api(`member/${id}/family`, 'PUT', { family_of: val('pFamOf') ? +val('pFamOf') : null }); GK.clean(); toast('Gespeichert.'); again(); } catch (e) { fail(e); } });
    if ($('pFamOk')) $('pFamOk').onclick = () => GK.busy($('pFamOk'), async () => { const x = +val('pAddFam'); if (!x) return; try { await api(`member/${x}/family`, 'PUT', { family_of: id }); toast('Hinzugefügt.'); again(); } catch (e) { fail(e); } });
    el.querySelectorAll('[data-famx]').forEach(b => { b.onclick = async () => {
      const x = d.family.find(f => f.id === +b.dataset.famx);
      if (!await ask(`${x.name} aus der Familienmitgliedschaft lösen?\n\nDer Familienbeitrag deckt ${x.name} dann nicht mehr ab – bitte danach einen eigenen Beitrag zuordnen.`, { ok: 'Lösen', danger: false })) return;
      try { await api(`member/${x.id}/family`, 'PUT', { family_of: null }); toast('Gelöst.'); again(); } catch (e) { fail(e); }
    }; });
    el.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => openMember(+b.dataset.open); });
    if ($('pCharge')) $('pCharge').onclick = () => chargeDialog(null, { member_id: id }, again);
    bindCharges(el, again);
  }

  function subBank(el, d, again) {
    const p = d.person, b = d.bank || {}, id = p.id;
    // Familienmitglied oder abweichender Zahler: Konto und Mandat gehören dem Oberhaupt/Zahler – hier nur ausgegraut zur Orientierung
    const lockTo = d.familyHead || (p.payer_id ? (d.payer || { id: p.payer_id, name: 'ein anderes Mitglied' }) : null);
    const lockBanner = lockTo ? `<div class="banner b mv-lockinfo"><span><b>${d.familyHead ? `Familienmitglied von ${esc(lockTo.name)}` : `Zahler: ${esc(lockTo.name)}`}</b> – Beiträge laufen über Konto und Mandat ${d.familyHead ? 'des Oberhaupts' : 'des Zahlers'}. Hier ist nichts einzutragen.</span>${lockTo.id ? `<a href="#" data-lockopen="${lockTo.id}">${esc(lockTo.name)} öffnen →</a>` : ''}</div>` : '';
    const lockUp = () => { if (!lockTo) return; el.insertAdjacentHTML('afterbegin', lockBanner); el.querySelectorAll('.card').forEach(c => c.classList.add('mv-locked')); el.querySelectorAll('.card input, .card select, .card textarea, .card button').forEach(x => { x.disabled = true; }); const a = el.querySelector('[data-lockopen]'); if (a) a.onclick = e => { e.preventDefault(); openMember(+a.dataset.lockopen); }; };
    const stPill = b.state ? (b.state.ok ? ['g', 'Mandat gültig'] : ['r', b.state.reason]) : ['', 'keine Bankverbindung'];
    if (!st.meta.perms.bank) {
      el.innerHTML = `<div class="card"><h3>Konto & Mandat ${pill(stPill)}</h3><dl class="facts" style="margin:0">
        <p>IBAN: <b>${esc(b.masked || '–')}</b><br>Mandatsreferenz: <b>${esc(b.mandate_ref || '–')}</b>${b.mandate_date ? ` vom ${deDate(b.mandate_date)}` : ''}</p></dl>
        <p class="muted s">Vollständige Bankdaten sieht und ändert nur, wer das Recht „Bankdaten“ hat.</p></div>`; lockUp(); return;
    }
    el.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0;flex:1 1 180px;min-width:0;line-height:1.25">Bankverbindung</h3>${pill(stPill)}</div>
      <div class="mv-grid" style="--c:4">
        <label class="f w2">Kontoinhaber<input id="bHolder" value="${esc(b.holder || p.name)}"></label>
        <label class="f w2"><span>IBAN <span id="bIbanInfo" style="font-weight:600;margin-left:6px"></span></span><input id="bIban" value="${esc(fmtIban(b.iban))}" autocomplete="off" spellcheck="false"></label>
        <label class="f w2">BIC (bei deutschen Konten optional)<input id="bBic" value="${esc(b.bic || '')}"></label>
        <label class="f w2">Kreditinstitut<input id="bBank" value="${esc(b.bank || '')}"></label>
      </div></div>
      <div class="card"><h3>SEPA-Lastschriftmandat</h3>
      <div class="mv-grid" style="--c:4">
        <label class="f w2">Mandatsreferenz<input id="bRef" value="${esc(b.mandate_ref || '')}" placeholder="wird bei „Neues Mandat“ vergeben" ${b.mandate_first_used && b.mandate_ref ? 'disabled title="Schon für Lastschriften genutzt – neue Referenz nur über „Neues Mandat …“"' : ''}></label>
        <label class="f">Unterschrieben am<input id="bDate" type="date" value="${esc(b.mandate_date || '')}"></label>
        <label class="f">Zuletzt benutzt<input id="bUsed" type="date" value="${esc(b.mandate_last_used || '')}" title="leer = noch nie benutzt → nächste Lastschrift ist eine Erstlastschrift"></label>
      </div>
      <p class="muted s">${b.mandate_first_used ? `Erstmals benutzt am ${deDate(b.mandate_first_used)} – weitere Lastschriften sind Folgelastschriften.` : 'Noch nie benutzt – die nächste Lastschrift ist eine Erstlastschrift. Bei einem Mandat aus der bisherigen Vereinsverwaltung bitte „zuletzt benutzt“ eintragen.'}
        ${b.mandate_first_used && b.mandate_ref ? 'Die Mandatsreferenz kennt die Bank schon und lässt sich deshalb nicht mehr ändern – eine neue gibt es über „Neues Mandat …“. ' : ''}Ein Mandat verfällt, wenn es 36 Monate nicht benutzt wurde.${b.mandate_revoked ? ` <b>Widerrufen am ${deDate(b.mandate_revoked)}.</b>` : ''}</p>
      <div class="row" style="justify-content:space-between"><div class="row">${b.mandate_ref ? `<button class="btn ghost" id="bRevoke">${b.mandate_revoked ? 'Widerruf aufheben' : 'Mandat widerrufen'}</button>` : ''}<button class="btn ghost" id="bNew">Neues Mandat …</button></div>
        <button class="btn primary" id="bSave">Speichern</button></div></div>`;
    GK.watch(el);
    lockUp();
    let t = null;
    $('bIban').oninput = () => { clearTimeout(t); t = setTimeout(async () => { const v = val('bIban'); if (v.replace(/\s/g, '').length < 15) { $('bIbanInfo').textContent = ''; return; } const r = await api('iban-check?iban=' + encodeURIComponent(v)).catch(() => null); if (r) { $('bIbanInfo').textContent = r.ok ? '✓ gültig' : '· ' + r.error; $('bIbanInfo').style.color = r.ok ? 'var(--brand-ink)' : 'var(--red)'; } }, 350); };
    const save = async extra => {
      const used = val('bUsed');
      const body = { holder: val('bHolder'), iban: val('bIban'), bic: val('bBic'), bank: val('bBank'), mandate_ref: val('bRef'), mandate_date: val('bDate') || null, ...extra };
      if (!extra || !extra.newMandate) body.mandate_used = used || (b.mandate_last_used ? false : undefined);
      const r = await api(`member/${id}/bank`, 'PUT', body);
      GK.clean(); toast(r.warn || 'Gespeichert.', Boolean(r.warn)); again();
    };
    $('bSave').onclick = () => save().catch(fail);
    $('bNew').onclick = async () => {
      dialog(`<h2>Neues SEPA-Mandat</h2><p class="muted">Für eine neue Bankverbindung oder ein neu unterschriebenes Mandat. Die Referenz wird neu vergeben (${esc(st.meta.settings.mandate_prefix || '')}${esc(p.member_no || '')}…), die nächste Lastschrift ist eine Erstlastschrift. Das unterschriebene Formular am besten unter „Dokumente“ ablegen.</p>
        <label class="f">Datum der Unterschrift<input id="nmDate" type="date" value="${st.meta.today}"></label>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="nmOk">Mandat anlegen</button></div>`);
      $('c').onclick = closeDialog;
      $('nmOk').onclick = () => GK.busy($('nmOk'), async () => { const dt = val('nmDate'); closeDialog(); try { await save({ newMandate: true, mandate_date: dt }); } catch (e) { fail(e); } });
    };
    if ($('bRevoke')) $('bRevoke').onclick = async () => { if (!b.mandate_revoked && !await ask('Mandat widerrufen?\n\nVon diesem Konto wird dann nichts mehr eingezogen, bis ein neues Mandat vorliegt.', { ok: 'Widerrufen' })) return; try { await api(`member/${id}/bank`, 'PUT', { mandate_revoked: !b.mandate_revoked }); again(); } catch (e) { fail(e); } };
  }

  function subDocs(el, d, again) {
    const id = d.person.id, fh = d.familyHead;
    // Familienmitglied: Beitrittserklärung und SEPA-Mandat der Familie liegen beim Oberhaupt – hier nur persönliche Unterlagen
    const kinds = Object.entries(DOCK).filter(([k]) => !(fh && (k === 'antrag' || k === 'mandat')) && !(d.person.payer_id && k === 'mandat'));
    el.innerHTML = `${fh ? `<div class="banner b mv-lockinfo"><span><b>Familienmitglied von ${esc(fh.name)}</b> – Beitrittserklärung und SEPA-Mandat der Familie liegen beim Oberhaupt. Hier nur persönliche Unterlagen ablegen.</span><a href="#" data-fhopen="${fh.id}">${esc(fh.name)} öffnen →</a></div>` : ''}
      <div class="card"><h3>Dokument ablegen</h3><div class="row">
        <label class="f">Art<select id="dKind">${kinds.map(([k, l]) => opt(k, l)).join('')}</select></label>
        <label class="f" style="flex:1;min-width:220px">Bezeichnung (optional)<input id="dTitle" placeholder="${fh ? 'z. B. Schülerausweis 2026' : 'z. B. Beitrittserklärung 2019'}"></label>
        <button class="btn primary" id="dUp">Datei wählen & hochladen</button></div>
        <p class="muted s" style="margin-bottom:0">PDF, Foto (JPG, PNG, HEIC), Word oder Text, bis 15 MB. Dokumente liegen nur auf dem Vereinsrechner und sind in der Datensicherung enthalten.</p></div>
      <div class="card"><h3>Ablage</h3>${d.documents.length ? `<table class="tbl kompakt"><tr><th>Dokument</th><th>Art</th><th>Datum</th><th>von</th><th class="r">Größe</th><th></th></tr>
        ${d.documents.map(x => `<tr><td class="k-1z" title="${esc(x.title)}"><b>${esc(x.title)}</b></td><td>${esc(DOCK[x.kind] || x.kind)}</td><td class="num nw">${deTime(x.created_at)}</td><td class="k-weg">${esc(x.by_user || '')}</td><td class="r k-weg">${Math.max(1, Math.round(x.size / 1024))} KB</td>
          <td class="r nw"><button class="btn small" data-dx="${x.id}">Öffnen …</button></td></tr>`).join('')}</table>` : '<p class="empty">Noch keine Dokumente.</p>'}</div>`;
    { const a = el.querySelector('[data-fhopen]'); if (a) a.onclick = e => { e.preventDefault(); openMember(+a.dataset.fhopen); }; }
    $('dUp').onclick = async () => {
      const f = await pickFile('.pdf,.jpg,.jpeg,.png,.webp,.heic,.docx,.txt,application/pdf,image/*'); if (!f) return;
      try { await upload(`member/${id}/documents?kind=${encodeURIComponent(val('dKind'))}&title=${encodeURIComponent(val('dTitle') || f.name)}`, f); toast('Hochgeladen.'); again(); } catch (e) { fail(e); }
    };
    const docDialog = x => {
      dialog(`<h2 translate="no">${esc(x.title)}</h2><p class="muted" style="margin-top:0">${esc(DOCK[x.kind] || x.kind)} · ${deTime(x.created_at)}${x.by_user ? ' · ' + esc(x.by_user) : ''} · ${Math.max(1, Math.round(x.size / 1024))} KB</p>
        <div class="row"><a class="btn" href="${BASE}documents/${x.id}" target="_blank" rel="noopener">Datei öffnen</a></div>
        <div class="row" style="margin-top:12px"><button class="btn danger" id="xDel">Dokument löschen …</button></div>
        <div class="btns"><button class="btn primary" id="c">Schließen</button></div>`);
      $('c').onclick = closeDialog;
      $('xDel').onclick = () => confirmIn(`„${x.title}“ löschen?`, 'Die Datei wird endgültig entfernt.', 'Dokument löschen', async () => {
        try { await api('documents/' + x.id, 'DELETE'); closeDialog(); again(); } catch (e) { fail(e); }
      }, () => docDialog(x));
    };
    el.querySelectorAll('[data-dx]').forEach(b => { b.onclick = () => docDialog(d.documents.find(y => y.id === +b.dataset.dx)); });
  }

  function subHistory(el, d) {
    const app = d.app || {};
    el.innerHTML = `<div class="card"><h3>Mitglieder-App</h3><p style="margin:0">${app.device ? `Handy <b>${esc(app.device.status)}</b>${app.device.last_used ? ` · zuletzt ${deTime(app.device.last_used)}` : ''}` : 'Kein Handy freigeschaltet.'}
        <span class="muted s"> · Freischalten unter „Mitglieder-App“; „Meine Daten“ sieht jedes freigeschaltete Handy.</span></p></div>
      <div class="card"><h3>Änderungsverlauf</h3>${d.history.length ? `<table class="tbl kompakt"><tr><th>Feld</th><th style="width:150px">Zeitpunkt</th><th>vorher</th><th>nachher</th><th>von</th></tr>
        ${d.history.map(h => `<tr><td><b>${esc(h.field)}</b></td><td class="num nw">${deTime(h.at)}</td><td class="muted" title="${esc(h.old || '')}">${esc(h.old || '–')}</td><td title="${esc(h.new || '')}">${esc(h.new || '–')}</td><td class="muted s k-weg">${esc(h.by_user || '')}</td></tr>`).join('')}</table>` : '<p class="empty">Noch keine Änderungen.</p>'}</div>`;
  }

  function exitDialog(d, again) {
    const p = d.person, seen = new Set(), fam = [...(d.payerGroup || []), ...(d.family || [])].filter(f => !f.head && f.id !== p.id && !seen.has(f.id) && seen.add(f.id));   // Zahlergruppe und Familienmitgliedschaft
    const yearEnd = (() => { const ys = st.meta.settings.year_start || '01-01'; const y = +st.meta.today.slice(0, 4); for (const yy of [y, y + 1]) { const e = new Date(`${yy}-${ys}T00:00:00Z`); e.setUTCDate(e.getUTCDate() - 1); const s = e.toISOString().slice(0, 10); if (s >= st.meta.today) return s; } return st.meta.today; })();
    dialog(`<h2>Austritt von ${esc(GK.lastFirst(p.name))}</h2>
      <div class="mv-grid" style="--c:2"><label class="f">Austritt zum<input id="xDate" type="date" value="${yearEnd}"></label><label class="f">Kündigung eingegangen am<input id="xNotice" type="date" value="${st.meta.today}"></label>
      <label class="f wall">Grund (optional)<input id="xReason" placeholder="z. B. Umzug"></label>
      <label class="f wall">Kündigungsschreiben o. ä. (optional, PDF oder Foto)<input id="xDoc" type="file" accept="application/pdf,image/*"></label></div>
      <div class="mv-cons" style="margin-top:12px"><label class="chk"><input type="checkbox" id="xFees" checked> Beiträge zum Austritt beenden</label><label class="chk"><input type="checkbox" id="xDepts" checked> Abteilungen zum Austritt beenden</label>
        ${fam.length ? `<label class="chk"><input type="checkbox" id="xFam"> Angehörige mit austreten lassen (${esc(fam.map(f => f.name).join(', '))})</label>` : ''}</div>
      <p class="muted s">Bis zum Austritt bleibt alles wie bisher. Danach verschwindet das Mitglied am Tablet und in der App; Daten bleiben bis zum Anonymisieren erhalten.</p>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn danger" id="xOk">Austritt eintragen</button></div>`);
    $('c').onclick = closeDialog;
    $('xOk').onclick = () => GK.busy($('xOk'), async () => {
      const body = { exit_date: val('xDate'), notice_date: val('xNotice'), reason: val('xReason'), endFees: $('xFees').checked, endDepts: $('xDepts').checked, withDependents: $('xFam') ? $('xFam').checked : false };
      const file = $('xDoc').files[0] || null;
      if (file && !/^(application\/pdf|image\/)/.test(file.type || '') && !/\.(pdf|jpe?g|png|webp|heic)$/i.test(file.name)) return toast('Bitte ein PDF oder Foto wählen.', true);
      const doc = async () => { if (file) { try { await upload(`member/${p.id}/exit-document`, file); } catch (e) { fail(e); } } };
      try { const r = await api(`member/${p.id}/exit`, 'POST', body); await doc(); closeDialog(); toast(r.pending ? `Austritt gemeldet. ${PENDING}` : file ? 'Austritt eingetragen, Dokument abgelegt.' : 'Austritt eingetragen.'); again(); }
      catch (e) {
        if (e.status === 409) confirmIn('Trotzdem austreten lassen?', `${e.message}\n\nTrotzdem nur dieses Mitglied austreten lassen?`, 'Trotzdem austreten lassen', async () => {
          try { const r = await api(`member/${p.id}/exit`, 'POST', { ...body, force: true }); await doc(); closeDialog(); if (r.pending) toast(`Austritt gemeldet. ${PENDING}`); again(); } catch (e2) { fail(e2); }
        }, () => exitDialog(d, again));
        else fail(e);
      }
    });
  }

  /* ================================================================= Import & Export */
  function importDialog() {
    if (!document.getElementById('impStyle')) {
      const s = document.createElement('style'); s.id = 'impStyle';
      s.textContent = `
        .imp-det { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin: 4px 0 14px; }
        .imp-det .pill { height: 40px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 10px; }
        .imp-det .f { flex: 1 1 240px; margin: 0; }
        .imp-map { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
        .imp-grp { background: var(--hover); color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; padding: 8px 14px; }
        .imp-row { display: grid; grid-template-columns: minmax(150px, 1fr) minmax(0, 1.3fr) minmax(0, 1fr); gap: 12px; align-items: center; padding: 8px 14px; border-top: 1px solid var(--line); }
        .imp-grp + .imp-row { border-top: 0; }
        .imp-row > b { font-size: 14px; font-weight: 600; }
        .imp-row select { width: 100%; height: 40px; min-height: 40px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--field); font: inherit; font-size: 14px; font-weight: 500; color: var(--ink); transition: border-color .15s, box-shadow .15s; }
        .imp-row select:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
        .imp-row .ex { color: var(--muted); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .imp-row.on .ex { color: var(--ink); }
        .imp-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; margin-top: 14px; align-items: end; }
        .imp-opts .chk { min-height: 40px; display: flex; align-items: center; gap: 8px; }
        @media (max-width: 700px) {
          .imp-row { grid-template-columns: 1fr; gap: 6px; padding: 10px 14px; }
          .imp-row:not(.on) .ex { display: none; }
          .imp-opts { grid-template-columns: 1fr; }
        }`;
      document.head.appendChild(s);
    }
    dialog(`<h2>Mitglieder importieren</h2>
      <p class="muted">Export aus <b>S-Verein / SPG-Verein</b>, <b>WISO Mein Verein</b>, <b>verein.cloud</b> oder eine eigene Liste – als CSV/TXT oder Excel (.xlsx). Clubwerk erkennt das Programm an den Spaltenköpfen und schlägt die Zuordnung vor; was nicht passt, stellt ihr selbst ein. Vorhandene Personen (z. B. aus den Verkaufskonten) werden über Nummer oder Namen erkannt und ergänzt – PINs bleiben erhalten.</p>
      <label class="f">Datei<input type="file" id="iFile" accept=".csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
      <div id="iMap" style="margin-top:14px"></div>
      <div id="iPrev" style="margin-top:14px"></div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn ghost hidden" id="iBack">Zurück zur Zuordnung</button><button class="btn primary" id="iOk" disabled>Vorschau</button></div>`, true);
    $('c').onclick = closeDialog;
    let file = null, an = null, prev = null, step = 'file';
    const send = async (path, headers = {}) => {
      const r = await fetch(BASE + path, { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'application/octet-stream', ...headers }, body: file });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Fehler'); return j;
    };
    const mapping = () => { const m = {}; document.querySelectorAll('#iMap [data-fk]').forEach(s => { if (s.value) m[s.dataset.fk] = s.value; }); return m; };
    const fmt = () => (val('iFmt') || (an && an.format));
    const query = commit => {
      const q = new URLSearchParams({ format: fmt() });
      if (commit) q.set('commit', '1');
      if ($('iBooked') && $('iBooked').value && !$('iBookedRow').classList.contains('hidden')) q.set('booked', $('iBooked').value);
      if ($('iUsed') && $('iUsed').checked) q.set('used', '1');
      if (commit && prev && prev.yearHint) q.set('year_start', prev.yearHint);
      return '?' + q.toString();
    };
    let dec = {};   // ähnliche Namen: Zeile → Mitglieds-ID oder 'neu'
    let feeDec = {};   // Beitragsarten: Schlüssel → Beitrags-ID, 'neu' oder 'skip' ('' = noch nicht gewählt)
    const run = commit => send('import/run' + query(commit), { 'X-Mapping': encodeURIComponent(JSON.stringify(mapping())), ...(commit ? { 'X-Decisions': encodeURIComponent(JSON.stringify({ m: dec, f: feeDec })) } : {}) });
    const setStep = s => {
      step = s;
      $('iMap').classList.toggle('hidden', s === 'prev'); $('iPrev').classList.toggle('hidden', s !== 'prev');
      $('iBack').classList.toggle('hidden', s !== 'prev');
      $('iOk').textContent = s === 'prev' ? 'Übernehmen' : 'Vorschau';
    };
    const syncOpts = () => {
      const m = mapping();
      if ($('iBookedRow')) $('iBookedRow').classList.toggle('hidden', !m.fee_name || Boolean(m.fee_booked));
      if ($('iUsedRow')) $('iUsedRow').classList.toggle('hidden', !m.mandate_ref);
      document.querySelectorAll('#iMap .imp-row').forEach(r => { const s = r.querySelector('select'); const i = an.headers.indexOf(s.value); r.classList.toggle('on', i >= 0); r.querySelector('.ex').textContent = i >= 0 ? (an.sample.map(x => x[i]).find(Boolean) || '–') : '–'; });
    };
    function drawMap() {
      const vc = fmt() === 'vereincloud';
      const det = `<div class="imp-det"><label class="f">Erkanntes Format<select id="iFmt">${an.presets.map(p => opt(p.key, p.label, fmt())).join('')}</select></label>
        <span class="pill b">${an.count} ${an.count === 1 ? 'Person' : 'Personen'}</span><span class="pill">${an.headers.length} Spalten</span></div>`;
      {
        const fields = vc ? an.fields.filter(f => an.vcFields.includes(f.key)) : an.fields;
        const groups = [...new Set(fields.map(f => f.group))];
        const sel = f => `<select data-fk="${f.key}" aria-label="${esc(f.label)}"><option value="">— nicht übernehmen —</option>${an.headers.map(h => opt(h, h, (an.mapping || {})[f.key] || '')).join('')}</select>`;
        $('iMap').innerHTML = det + `<p class="muted s" style="margin:0 0 8px">Spalte aus eurer Datei je Feld wählen – rechts stehen die Werte einer Person aus der Datei.${an.sampleLine ? ` <span>(Zeile ${an.sampleLine})</span>` : ''}</p>
          ${vc ? '<div class="banner g"><span>verein.cloud: Abteilungen und alle Beiträge mit „gebucht bis“ liest Clubwerk aus den nummerierten Spalten; die übrigen Felder könnt ihr hier anders zuordnen.</span></div>' : ''}
          <div class="imp-map" translate="no">${groups.map(g => `<div class="imp-grp" translate="yes">${esc(g)}</div>${fields.filter(f => f.group === g).map(f => `<div class="imp-row"><b translate="yes">${esc(f.label)}${f.key === 'last_name' ? ' *' : ''}</b>${sel(f)}<span class="ex">–</span></div>`).join('')}`).join('')}</div>
          ${vc ? '' : `<div class="imp-opts">
            <label class="f" id="iBookedRow">Beiträge bisher abgerechnet bis<input type="date" id="iBooked" value="${esc(an.booked_default || '')}"></label>
            <label class="chk" id="iUsedRow"><input type="checkbox" id="iUsed" checked> SEPA-Mandate wurden schon benutzt (nächste Lastschrift ist eine Folgelastschrift)</label>
          </div>
          <p class="muted s" style="margin:8px 0 0">„Abgerechnet bis“ gilt für alle ohne eigene Angabe – so berechnet der nächste Beitragslauf nichts doppelt, was das alte Programm schon eingezogen hat.</p>`}`;
        document.querySelectorAll('#iMap [data-fk]').forEach(s => { s.onchange = syncOpts; });
        syncOpts();
      }
      $('iFmt').onchange = async () => {
        if (fmt() !== an.format) an.mapping = {};
        drawMap();
      };
      $('iOk').disabled = false; setStep('map');
    }
    function drawPrev() {
      const sim = prev.rows.filter(r => r.suggest && r.suggest.length);
      const feeRows = prev.fees || [];
      feeDec = {}; feeRows.forEach(f => { if (!f.exact) feeDec[f.key] = f.suggest.length ? '' : 'neu'; });   // bei ähnlichen vorhandenen: bewusst wählen   // bei ähnlichen vorhandenen: bewusst wählen
      const newFees = () => Object.values(feeDec).filter(v => v === 'neu').length;
      const feeOpt = x => `<option value="${x.id}">${esc(x.name)} (${euro(x.cents || 0)} ${esc(INTERVAL[x.interval] || x.interval)})${x.active === 0 ? ' · inaktiv' : ''}</option>`;
      const feeOpts = f => (f.exact ? '<option value="">vorhandene verwenden (gleicher Name)</option>' : `${f.suggest.length ? '<option value="">— bitte wählen —</option>' : ''}<option value="neu" ${feeDec[f.key] === 'neu' ? 'selected' : ''}>neu anlegen</option>`)
        + '<option value="skip">nicht übernehmen</option>'
        + (f.suggest.length ? `<optgroup label="ähnliche vorhandene">${f.suggest.map(feeOpt).join('')}</optgroup>` : '')
        + (f.others.length ? `<optgroup label="${f.suggest.length ? 'alle anderen Beitragsarten' : 'vorhandene Beitragsarten'}">${f.others.map(feeOpt).join('')}</optgroup>` : '');
      dec = {}; sim.forEach(r => { dec[r.line] = r.suggest[0].sameBirth ? r.suggest[0].id : 'neu'; });
      const merged = () => Object.values(dec).filter(v => v !== 'neu').length;
      const sugLabel = c => `zusammenführen mit ${GK.lastFirst(c.name)}${c.member_no ? ` · Nr. ${c.member_no}` : ''}${c.birth_date ? ` · ${deDate(c.birth_date)}` : ''} (${c.why})`;
      $('iPrev').innerHTML = `<div class="kpis"><div class="kpi"><div class="l">Personen</div><div class="v">${prev.count}</div></div><div class="kpi"><div class="l">neu</div><div class="v" id="iKN">${prev.new - merged()}</div></div>
          <div class="kpi"><div class="l">ergänzt</div><div class="v" id="iKU">${prev.update + merged()}</div></div><div class="kpi"><div class="l">neue Beitragsarten</div><div class="v" id="iKF">${newFees()}</div></div></div>
        ${prev.warnings.concat(prev.conflicts).map(w => `<div class="banner a"><span>${esc(w)}</span></div>`).join('')}
        ${sim.length ? `<div class="card soft imp-sim"><h3 style="margin:0 0 4px">Ähnliche Namen im Bestand <span class="muted s">(${sim.length})</span></h3>
          <p class="muted s" style="margin:0 0 10px">Spitznamen, Kurzformen oder andere Schreibweise (z. B. Benni – Benedikt, Susi – Susanne). Beim Zusammenführen überschreiben die Daten aus der Datei die vorhandenen; Getränkekonto, PIN und App bleiben erhalten. Bei gleichem Geburtsdatum ist „zusammenführen“ vorgewählt.</p>
          ${sim.map(r => `<div class="imp-simrow"><div><b translate="no">${esc(GK.lastFirst(r.name))}</b><span class="muted s">Zeile ${r.line}${r.member_no ? ` · Nr. ${esc(r.member_no)}` : ''}${r.birth_date ? ` · ${deDate(r.birth_date)}` : ''}</span></div>
            <select data-sim="${r.line}" translate="no">${r.suggest.map(c => `<option value="${c.id}" ${dec[r.line] === c.id ? 'selected' : ''}>${esc(sugLabel(c))}</option>`).join('')}<option value="neu" ${dec[r.line] === 'neu' ? 'selected' : ''}>als neues Mitglied anlegen</option></select></div>`).join('')}</div>` : ''}
        ${prev.depts.length ? `<p><b>Neue Abteilungen:</b> <span translate="no">${esc(prev.depts.join(', '))}</span></p>` : ''}
        ${prev.sample ? `<div class="card soft imp-sim"><h3 style="margin:0 0 4px">Feldabgleich am Beispiel <span class="muted s">(Zeile ${prev.sample.line})</span></h3>
          <p class="muted s" style="margin:0 0 10px">So landen die Spalten eurer Datei in Clubwerk. Stimmt etwas nicht, abbrechen und die Zuordnung bzw. die Datei prüfen.</p>
          <div class="imp-fields">${prev.sample.fields.map(f => `<div class="imp-field${f.value ? '' : ' leer'}"><span class="muted s">${esc(f.label)}</span><b translate="no">${f.value ? esc(f.value) : '– leer –'}</b></div>`).join('')}</div></div>` : ''}
        ${feeRows.length ? `<div class="card soft imp-sim"><h3 style="margin:0 0 4px">Beitragsarten aus der Datei <span class="muted s">(${feeRows.length})</span></h3>
          <p class="muted s" style="margin:0 0 10px">Je Beitragsart ein Beispielmitglied. Ihr könnt jede vorhandene Beitragsart zuordnen, eine neue anlegen oder den Beitrag nicht übernehmen – gibt es schon eine ähnliche, ist die Wahl Pflicht. „Nicht übernehmen“: Das Mitglied wird ohne diesen Beitrag importiert.</p>
          ${feeRows.map(f => `<div class="imp-simrow"><div><b translate="no">${esc(f.name)}${f.dept ? ` · ${esc(f.dept)}` : ''}</b><span class="muted s">${euro(f.cents || 0)} ${esc(INTERVAL[f.interval] || f.interval)} · ${f.count} ${f.count === 1 ? 'Mitglied' : 'Mitglieder'} · Beispiel: <span translate="no">${esc(GK.lastFirst(f.example.name))}</span>${f.example.booked ? ` · gebucht bis ${deDate(f.example.booked)}` : ''}</span></div>
            <select data-fee="${esc(f.key)}" translate="no">${feeOpts(f)}</select></div>`).join('')}</div>` : ''}
        <div class="scroll" style="max-height:44vh"><table class="tbl"><tr><th>Zeile</th><th>Nr.</th><th>Name</th><th>Aktion</th><th>Abteilungen</th><th>Beiträge</th><th>Zahler</th><th>Mandat</th></tr>
          ${prev.rows.slice(0, 500).map(r => `<tr class="${r.exit ? 'off' : ''}"><td class="muted">${r.line}</td><td>${esc(r.member_no || '')}</td><td><b translate="no">${esc(GK.lastFirst(r.name))}</b>${r.exit ? `<div class="muted s">ausgetreten ${deDate(r.exit)}</div>` : ''}</td><td data-act="${r.line}">${r.suggest && r.suggest.length ? '' : r.action === 'neu' ? '<span class="pill g">neu</span>' : `<span class="pill b">${esc(r.action)}</span>`}</td><td translate="no">${esc(r.depts)}</td><td class="s" translate="no">${esc(r.fees)}</td><td class="s">${r.payer ? `<span translate="no">${esc(GK.lastFirst(r.payer.name))}</span>${r.payer.missing ? ' <span class="pill a">nicht gefunden</span>' : r.payer.family ? ' <span class="pill b">Familie</span>' : r.payer.check ? ' <span class="pill a">prüfen</span>' : ''}` : ''}</td><td translate="no">${esc(r.mandate)}</td></tr>`).join('')}</table></div>`;
      const acts = () => sim.forEach(r => { const td = document.querySelector(`[data-act="${r.line}"]`); if (td) td.innerHTML = dec[r.line] === 'neu' ? '<span class="pill g">neu</span>' : '<span class="pill b">zusammenführen</span>'; });
      document.querySelectorAll('[data-sim]').forEach(sel => { sel.onchange = () => { dec[sel.dataset.sim] = sel.value === 'neu' ? 'neu' : Number(sel.value); $('iKN').textContent = prev.new - merged(); $('iKU').textContent = prev.update + merged(); acts(); }; });
      document.querySelectorAll('[data-fee]').forEach(sel => { sel.onchange = () => { if (sel.value === '' && prev.fees.find(f => f.key === sel.dataset.fee).exact) delete feeDec[sel.dataset.fee]; else feeDec[sel.dataset.fee] = /^\d+$/.test(sel.value) ? Number(sel.value) : sel.value; $('iKF').textContent = newFees(); }; });
      acts();
      setStep('prev');
    }
    $('iFile').onchange = async () => {
      file = $('iFile').files[0]; $('iOk').disabled = true; $('iPrev').innerHTML = ''; if (!file) return;
      $('iMap').innerHTML = '<p class="muted">Lese Datei …</p>'; setStep('map');
      try { an = await send('import/analyze'); drawMap(); }
      catch (e) { $('iMap').innerHTML = `<div class="banner r"><span>${esc(e.message)}</span></div>`; }
    };
    $('iBack').onclick = () => setStep('map');
    $('iOk').onclick = () => GK.busy($('iOk'), async () => {
      $('iOk').disabled = true;
      try {
        if (step !== 'prev') { prev = await run(false); drawPrev(); }
        else if (Object.values(feeDec).some(v => v === '')) { throw new Error('Bitte bei allen Beitragsarten mit ähnlichen vorhandenen wählen: vorhandene verwenden, neu anlegen oder nicht übernehmen.'); }
        else { const r = await run(true); closeDialog(); await ask(`Import abgeschlossen.\n\n${r.created} neu angelegt, ${r.updated} ergänzt, ${r.depts} Abteilungen und ${r.fees} Beitragsarten neu, ${r.payers} Zahler verknüpft, ${r.families || 0} Familienmitgliedschaften.`, { okOnly: true, danger: false }); reloadTab(); return; }
      } catch (e) { fail(e); }
      $('iOk').disabled = false;
    });
  }

  async function exportDialog() {
    const cols = await api('export/cols');
    const def = ['member_no', 'last_name', 'first_name', 'birth_date', 'street', 'zip', 'city', 'email', 'mobile', 'status', 'entry_date', 'depts', 'fees'];
    dialog(`<h2>Mitgliederliste als Excel</h2><p class="muted" style="margin-top:0">Spalten wählen. Die Liste folgt dem Filter der Mitgliederübersicht (${esc({ aktuell: 'aktuelle Mitglieder', alle: 'alle' }[st.f.status] || st.f.status)}).</p>
      <div class="mv-cols">${cols.map(([k, l]) => `<label class="chk"><input type="checkbox" data-col="${k}" ${def.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="eOk">Herunterladen</button></div>`);
    $('c').onclick = closeDialog;
    $('eOk').onclick = () => {
      const c = [...document.querySelectorAll('[data-col]')].filter(x => x.checked).map(x => x.dataset.col).join(',');
      const status = st.f.status === 'hinweis' ? 'aktuell' : st.f.status;
      const q = new URLSearchParams({ cols: c, status, ...(st.f.dept ? { dept: st.f.dept } : {}), ...(st.f.fee ? { fee: st.f.fee } : {}), ...(st.f.q ? { q: st.f.q } : {}) });
      location.href = BASE + 'export.xlsx?' + q; closeDialog();
    };
  }

  /* ================================================================= Anträge & Änderungen */
  async function showApplications(el) {
    const [apps, changes, all] = await Promise.all([api('applications'), api('changes'), st.app === 'alle' ? api('applications?status=alle') : null]);
    const waiting = apps.filter(a => a.status === 'eingegangen'), signing = apps.filter(a => a.status === 'unterschrift');
    const s = st.meta.settings;
    // Knöpfe rechts in der Reiterzeile; die Schritte (erfassen → unterschreiben → bestätigen) erklärt der Ablauf selbst
    const tools = `<a class="btn" href="${BASE}applications-blank.pdf" target="_blank">Formular (PDF)</a><button class="btn" id="aOnline">${s.app_online ? 'Online-Antrag: Link …' : 'Online-Antrag …'}</button>
      <button class="btn primary" id="aNew" title="Daten erfassen, dann am Tablet mit Code unterschreiben">+ Beitrittserklärung</button>`;
    el.innerHTML = `
      <div class="card" id="aWait"><h3>Warten auf Bestätigung <span class="muted s">(${waiting.length})</span></h3>${waiting.length ? appTable(waiting) : '<p class="empty">Keine neuen Beitrittserklärungen.</p>'}</div>
      <div class="card"><h3>Warten auf Unterschrift am Tablet <span class="muted s">(${signing.length})</span></h3>${signing.length ? appTable(signing) : '<p class="empty">Nichts offen.</p>'}</div>
      <div class="card"><h3>Änderungen & Meldungen <span class="muted s">(${changes.length})</span></h3><p class="muted s" style="margin-top:0">Aus der Mitglieder-App und von Abteilungsleitungen (Ein- und Austritte zur Bestätigung).</p>${changes.length ? `<table class="tbl kompakt"><tr><th>Mitglied</th><th>Art</th><th>eingegangen</th><th>Inhalt</th><th></th></tr>
        ${changes.map(c => `<tr><td><b>${esc(c.name)}</b>${c.member_no ? `<div class="muted s">Nr. ${esc(c.member_no)}</div>` : ''}</td><td>${pill(c.kind === 'kuendigung' || c.kind === 'austritt' ? ['r', c.label] : c.kind === 'bank' ? ['b', c.label] : c.kind === 'eintritt' ? ['g', c.label] : ['', c.label])}${c.created_by ? `<div class="muted s">von ${esc(c.created_by)}</div>` : ''}</td><td class="num nw">${deTime(c.created_at)}</td>
          <td class="s k-weg">${c.kind === 'kuendigung' ? `${esc((c.kuendigung.names || []).join(', '))} – frühestens zum <b>${deDate(c.kuendigung.exit_date)}</b>${c.kuendigung.reason ? `<br><span class="muted">${esc(c.kuendigung.reason)}</span>` : ''}` : c.rows.map(r => (c.scope && !r.old ? `${esc(r.field)}: <b>${esc(r.new || '–')}</b>` : `${esc(FIELD[r.field] || r.field)}: <span class="muted">${esc(r.old || '–')}</span> → <b>${esc(r.new || '–')}</b>`)).join('<br>')}</td>
          <td class="r nw">${SC() && (c.scope || (CONF() && c.kind === 'kuendigung')) ? '<span class="pill a">wartet auf Vereinsverwaltung</span>' : `<button class="btn small" data-cok="${c.id}">${c.scope ? 'Bestätigen' : 'Übernehmen'}</button> <button class="btn small" data-cno="${c.id}">Ablehnen</button>`}</td></tr>`).join('')}</table>` : '<p class="empty">Keine offenen Änderungswünsche.</p>'}</div>
      <div class="card"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0;flex:1 1 180px;min-width:0;line-height:1.25">Archiv</h3><button class="btn small" id="aArch">${st.app === 'alle' ? 'Ausblenden' : 'Alle Anträge anzeigen'}</button></div>
        ${all ? (all.filter(a => ['angenommen', 'abgelehnt'].includes(a.status)).length ? appTable(all.filter(a => ['angenommen', 'abgelehnt'].includes(a.status))) : '<p class="empty">Noch nichts im Archiv.</p>') : ''}</div>`;
    if (!GK.tabTools(tools, $('aWait'))) el.insertAdjacentHTML('afterbegin', `<div class="toolbar">${tools}</div>`);
    $('aNew').onclick = () => applicationForm();
    $('aArch').onclick = () => { st.app = st.app === 'alle' ? 'offen' : 'alle'; showApplications(el).catch(fail); };
    $('aOnline').onclick = () => onlineInfo();
    el.querySelectorAll('[data-ap]').forEach(b => { b.onclick = () => reviewApplication(+b.dataset.ap, () => showApplications(el).catch(fail)); });
    el.querySelectorAll('[data-acode]').forEach(b => { b.onclick = async () => { try { const r = await api(`applications/${b.dataset.acode}/code`, 'POST', {}); showCode(r.code); } catch (e) { fail(e); } }; });
    el.querySelectorAll('[data-cok]').forEach(b => { b.onclick = () => acceptChange(changes.find(c => c.id === +b.dataset.cok), () => { loadMeta().then(() => showApplications(el)).catch(fail); }); });
    el.querySelectorAll('[data-cno]').forEach(b => { b.onclick = async () => { const cc = changes.find(c => c.id === +b.dataset.cno); const r = await askText(cc && cc.scope ? `${cc.label} ablehnen?${cc.kind === 'eintritt' ? '\nDas angelegte Mitglied wird wieder entfernt.' : ''}\nGrund (nur intern, optional):` : 'Änderung ablehnen?\nDas Mitglied bekommt eine E-Mail mit dem Grund (optional):', ''); if (r == null) return; try { await api(`changes/${b.dataset.cno}/reject`, 'POST', { reason: r }); toast('Abgelehnt.'); showApplications(el).catch(fail); } catch (e) { fail(e); } }; });
  }
  const SRC = { verwaltung: 'Verwaltung', tablet: 'Tablet', online: 'online' };
  const ASTAT = { unterschrift: ['a', 'wartet auf Unterschrift'], eingegangen: ['b', 'unterschrieben'], angenommen: ['g', 'angenommen'], abgelehnt: ['', 'abgelehnt'] };
  function appTable(list) {
    return `<table class="tbl kompakt"><tr><th>Personen</th><th>Weg</th><th>Status</th><th>vom</th><th></th></tr>${list.map(a => `<tr><td><b>${esc(a.names)}</b>${a.data.persons.length > 1 ? ` <span class="pill">Familie · ${a.data.persons.length}</span>` : ''}${a.pre_by ? ` <span class="pill g">befürwortet von ${esc(a.pre_by)}</span>` : ''}</td>
      <td>${esc(SRC[a.source] || a.source)}</td><td>${pill(ASTAT[a.status] || ['', a.status])}${a.status === 'unterschrift' && !a.waiting ? ' <span class="pill r">Code abgelaufen</span>' : ''}</td><td class="num nw">${deTime(a.signed_at || a.created_at)}</td>
      <td class="r nw">${a.status === 'unterschrift' ? `<button class="btn small" data-acode="${a.id}">Neuer Code</button> <button class="btn small" data-ap="${a.id}">Ansehen</button>` : `<button class="btn small" data-ap="${a.id}">${a.status === 'eingegangen' ? 'Prüfen & annehmen' : 'Ansehen'}</button>`}</td></tr>`).join('')}</table>`;
  }
  function showCode(code) {
    dialog(`<h2>Bereit zur Unterschrift</h2><p class="muted" style="margin-top:0">Am Tablet <b>„Mitglied werden“ → „Ich habe einen Code“</b> antippen und diesen Code eingeben. Er gilt drei Stunden.</p>
      <div class="mv-code" translate="no">${esc(code.slice(0, 3))} ${esc(code.slice(3))}</div>
      <p class="muted s">Das neue Mitglied prüft am Tablet seine Daten, setzt die Häkchen für die Einwilligungen und unterschreibt Beitrittserklärung und SEPA-Mandat. Danach ist es sofort angelegt und bekommt die Bestätigung per E-Mail.</p>
      <div class="btns"><button class="btn primary" id="c">Fertig</button></div>`);
    $('c').onclick = () => { closeDialog(); reloadTab(); };
  }
  async function onlineInfo() {
    const s = st.meta.settings;
    if (!s.app_online) {
      if (!await ask('Online-Antrag einschalten?\n\nInteressierte können die Beitrittserklärung dann über die Adresse der Mitglieder-App ausfüllen und am Handy unterschreiben. Jeder Antrag kommt erst nach deiner Bestätigung in die Mitgliederliste.', { ok: 'Einschalten', danger: false })) return;
      try { await api('settings', 'PUT', { app_online: true }); await loadMeta(); } catch (e) { return fail(e); }
    }
    const app = await GK.api('app').catch(() => ({}));
    const url = app.url ? `${String(app.url).replace(/\/$/, '')}/p/mitglieder/` : '';
    dialog(`<h2>Online-Antrag</h2>${url ? `<p class="muted" style="margin-top:0">Diesen Link auf der Homepage oder in Nachrichten teilen:</p><div class="mv-code" style="font-size:16px;letter-spacing:0;user-select:all" translate="no">${esc(url)}</div>`
      : '<div class="banner a"><span>Die Adresse der Mitglieder-App ist noch nicht eingetragen (Mitglieder-App › Einstellungen). Der Online-Antrag liegt dort unter <code>/p/mitglieder/</code>.</span></div>'}
      <p class="muted s">Schutz gegen Missbrauch: eingebaute Falle für automatische Formulare, Mindest-Ausfüllzeit, Begrenzung je Gerät und Tag. Ausschalten unter Einstellungen.</p>
      <div class="btns">${url ? '<button class="btn ghost" id="oCopy">Link kopieren</button>' : ''}<button class="btn primary" id="c">Fertig</button></div>`);
    $('c').onclick = () => { closeDialog(); reloadTab(); };
    if ($('oCopy')) $('oCopy').onclick = () => { GK.copyText(url); toast('Link kopiert.'); };
  }

  /** Beitrittserklärung erfassen (Verwaltung) → Code fürs Tablet */
  async function applicationForm() {
    const cfg = await api('applications/config');
    if (!cfg.fees.length) return toast('Bitte zuerst unter Mitglieder › Beiträge & Abteilungen Beitragsarten anlegen (mit „auf dem Formular“).', true);
    const deps = cfg.departments || [];
    const person = (i, p = {}) => `<div class="mv-pers" data-p="${i}"><div class="mv-grid" style="--c:4">
      <label class="f">Vorname<input data-k="first_name" value="${esc(p.first_name || '')}"></label><label class="f">Nachname<input data-k="last_name" value="${esc(p.last_name || '')}"></label>
      <label class="f">Geburtsdatum<input data-k="birth_date" type="date" value="${esc(p.birth_date || '')}"></label><label class="f">Geschlecht<select data-k="gender">${opt('', '–')}${Object.entries(GENDER).map(([k, l]) => opt(k, l, p.gender)).join('')}</select></label>
      ${i === 0 ? '<div class="f"><span>Rolle</span><span class="pill g">Antragsteller/in</span></div>' : `<label class="f">Rolle<select data-k="role">${opt('partner', 'Partner/in', p.role)}${opt('kind', 'Kind', p.role || 'kind')}</select></label>`}
      ${deps.length ? `<div class="f w2"><span>Abteilungen (Zusatzbeitrag)</span><div class="mv-depchk">${deps.map(dp => `<label class="chk"><input type="checkbox" data-dep="${dp.id}"> <span translate="no">${esc(dp.name)}</span></label>`).join('')}</div></div>` : ''}
      ${i === 0 ? '' : '<div class="f"><span>&nbsp;</span><button class="btn small danger" data-px="1">Entfernen</button></div>'}</div></div>`;
    dialog(`<h2>Beitrittserklärung erfassen</h2>
      <p class="muted" style="margin-top:0">Daten hier eintragen – unterschrieben wird anschließend am Tablet mit einem Code. Für eine Familienmitgliedschaft Partner/in und Kinder (bis ${cfg.child_max || 18} Jahre) hinzufügen: der/die Antragsteller/in wird Hauptzahler.</p>
      <div class="card mv-persons" style="margin-bottom:16px;box-shadow:none"><h3>Personen</h3><div id="afP">${person(0)}</div>
        <div class="row" style="margin-top:8px"><button class="btn small" id="afAdd">+ Person (Familie)</button></div></div>
      <div class="mv-grid" style="--c:4">
        <label class="f w2">Straße und Hausnummer<input id="afStreet"></label><label class="f">PLZ<input id="afZip" inputmode="numeric"></label><label class="f">Ort<input id="afCity"></label>
        <label class="f w2">E-Mail<input id="afMail" type="email"></label><label class="f">Mobil<input id="afMobile"></label><label class="f">Eintritt<input id="afEntry" type="date" value="${cfg.today}"></label>
      </div>
      <h3 style="margin:18px 0 8px">Mitgliedschaft und Jahresbeitrag</h3>
      <div class="mv-fees" id="afFees"></div><p class="muted s" id="afFeeHint" style="margin:6px 0 0"></p>
      <h3 style="margin:18px 0 8px">SEPA-Lastschriftmandat</h3>
      <div class="mv-grid" style="--c:4"><label class="f w2">Kontoinhaber<input id="afHolder"></label><label class="f w2">IBAN<input id="afIban" spellcheck="false" autocomplete="off"></label>
        <label class="f">BIC (optional)<input id="afBic"></label><label class="f">Kreditinstitut (optional)<input id="afBank"></label><label class="f w2">Gesetzlicher Vertreter (nur bei Minderjährigen)<input id="afSigner"></label></div>
      <label class="chk" style="margin-top:14px"><input type="checkbox" id="afAuto" checked> Nach der Unterschrift sofort als Mitglied übernehmen (sonst erst nach Bestätigung unter „Anträge“)</label>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="afOk">Code fürs Tablet erzeugen</button></div>`, true);
    $('c').onclick = closeDialog;
    /* mehrere Personen → nur Familienbeitrag (falls angelegt); eine Person → ohne Familienbeitrag */
    const drawFees = () => {
      const n = document.querySelectorAll('#afP [data-p]').length, fam = cfg.fees.filter(f => f.family);
      const offer = n > 1 ? (fam.length ? fam : cfg.fees) : cfg.fees.filter(f => !f.family);
      const cur = (document.querySelector('[name=afFee]:checked') || {}).value;
      $('afFees').innerHTML = offer.map(f => `<label><input type="radio" name="afFee" value="${f.id}" ${String(f.id) === cur || offer.length === 1 ? 'checked' : ''}> <span translate="no">${esc(f.name)}</span><b>${euro(f.cents)}</b></label>`).join('');
      $('afFeeHint').textContent = n > 1 && fam.length ? 'Mehrere Personen: es gilt die Familienmitgliedschaft.' : '';
    };
    drawFees();
    const bindPx = () => document.querySelectorAll('#afP [data-px]').forEach(b => { b.onclick = () => { b.closest('[data-p]').remove(); drawFees(); }; });
    $('afAdd').onclick = () => { const n = document.querySelectorAll('#afP [data-p]').length; $('afP').insertAdjacentHTML('beforeend', person(n, { last_name: (document.querySelector('#afP [data-p="0"] [data-k="last_name"]') || {}).value || '' })); bindPx(); drawFees(); };
    $('afHolder').onfocus = () => { if (!$('afHolder').value) { const r = document.querySelector('#afP [data-p="0"]'); $('afHolder').value = `${r.querySelector('[data-k=first_name]').value} ${r.querySelector('[data-k=last_name]').value}`.trim(); } };
    $('afOk').onclick = () => GK.busy($('afOk'), async () => {
      const persons = [...document.querySelectorAll('#afP [data-p]')].map(tr => ({ ...Object.fromEntries([...tr.querySelectorAll('[data-k]')].map(i => [i.dataset.k, i.value.trim()])), departments: [...tr.querySelectorAll('[data-dep]:checked')].map(i => +i.dataset.dep) }));
      const fee = document.querySelector('[name=afFee]:checked');
      const data = { persons, street: val('afStreet'), zip: val('afZip'), city: val('afCity'), email: val('afMail'), mobile: val('afMobile'), entry_date: val('afEntry'), fee_id: fee ? +fee.value : null,
        holder: val('afHolder'), iban: val('afIban'), bic: val('afBic'), bank: val('afBank'), signer: val('afSigner') };
      try { const r = await api('applications', 'POST', { data, auto_accept: $('afAuto').checked }); showCode(r.code); } catch (e) { fail(e); }
    });
  }

  async function reviewApplication(id, after) {
    const a = await api('applications/' + id);
    const d = a.data, fees = st.meta.fees.filter(f => f.active);
    const ro = a.status !== 'eingegangen';
    dialog(`<h2>Beitrittserklärung ${esc(a.names)}</h2>
      <div class="row" style="gap:6px;margin:-4px 0 12px">${pill(ASTAT[a.status] || ['', a.status])}<span class="pill">${esc(SRC[a.source] || a.source)}</span>${a.signed_at ? `<span class="pill">unterschrieben ${deTime(a.signed_at)}</span>` : ''}${a.pre_by ? `<span class="pill g">befürwortet von ${esc(a.pre_by)}</span>` : ''}</div>
      <div class="split"><div>
        <table class="tbl"><tr><th>Person</th><th>geboren</th>${ro ? '' : '<th>Im Bestand?</th><th>Beitrag</th>'}</tr>
        ${d.persons.map((p, i) => `<tr><td><b>${esc(p.first_name)} ${esc(p.last_name)}</b><div class="muted s">${i === 0 ? 'Antragsteller/in' : p.role === 'partner' ? 'Partner/in' : 'Kind'}${(p.departments || []).length ? ` · <span translate="no">${esc(p.departments.map(id => (st.meta.depts.find(x => x.id === id) || {}).name).filter(Boolean).join(', '))}</span>` : ''}</div></td><td class="num nw">${deDate(p.birth_date)}</td>
          ${ro ? '' : `<td><select data-merge="${i}" style="width:100%"><option value="">neu anlegen</option>${(a.matches[i] || []).map(m => opt(m.id, `zusammenführen mit ${m.name}${m.member_no ? ' (' + m.member_no + ')' : ''}`, (a.matches[i] || [])[0] && (a.matches[i] || [])[0].id === m.id ? m.id : '')).join('')}</select></td>`}
          ${ro ? '' : `<td>${i === 0 || !(fees.find(f => f.id === d.fee_id) || {}).family ? `<select data-fee="${i}" style="width:100%">${fees.map(f => opt(f.id, f.name, i === 0 ? d.fee_id : (p.fee_id || a.suggest[i]))).join('')}</select>` : '<span class="muted s">im Familienbeitrag</span>'}</td>`}</tr>`).join('')}</table>
        ${ro && a.member_id ? `<p style="margin:10px 0 0"><button class="btn small" id="rvOpen">Mitglied öffnen</button></p>` : ''}
        <dl class="facts" style="margin-top:12px">
          <p style="margin:0 0 6px">${esc(d.street)}, ${esc(d.zip)} ${esc(d.city)}<br>${esc(d.email || '')}${d.mobile ? ' · ' + esc(d.mobile) : ''}</p>
          <p style="margin:0 0 6px">Konto: <b>${esc(d.holder || '')}</b> · ${esc(d.iban ? fmtIban(d.iban) : d.iban_masked || '–')}${d.bank ? ' · ' + esc(d.bank) : ''}</p>
          <p class="muted s" style="margin:0">Einwilligungen: ${esc(st.meta.settings.consents.filter(c => d.consents && d.consents[c.key]).map(c => c.short).join(', ') || '–')}${d.signer ? ` · gesetzl. Vertreter: ${esc(d.signer)}` : ''}</p>
        </dl>
        ${ro ? '' : `<label class="f" style="margin-top:12px;max-width:240px">Eintritt zum<input id="rvEntry" type="date" value="${esc(d.entry_date || st.meta.today)}"></label>`}
        ${a.sha256 ? `<p class="muted s" style="word-break:break-all">Prüfwert (SHA-256): ${esc(a.sha256)}</p>` : ''}
      </div>
      <div class="preview"><iframe src="${BASE}applications/${id}/pdf" title="Beitrittserklärung"></iframe></div></div>
      ${a.status === 'unterschrift' ? '<div class="row" style="margin-top:12px"><button class="btn danger" id="rvDel">Antrag löschen …</button></div>' : ''}
      <div class="btns">${ro ? '<button class="btn primary" id="c">Schließen</button>' : `<button class="btn ghost" id="c">Später</button><button class="btn danger" id="rvNo">Ablehnen</button><button class="btn primary" id="rvOk">${CONF() ? (a.pre_by ? 'Erneut befürworten' : 'Befürworten') : 'Annehmen & Mitglieder anlegen'}</button>`}</div>`, true);
    $('c').onclick = closeDialog;
    if ($('rvOpen')) $('rvOpen').onclick = () => { closeDialog(); openMember(a.member_id); };
    if ($('rvDel')) $('rvDel').onclick = () => confirmIn('Antrag löschen?', `Der Antrag von ${a.names} wird gelöscht, der Code am Tablet gilt dann nicht mehr.`, 'Antrag löschen', async () => {
      try { await api('applications/' + id, 'DELETE'); closeDialog(); toast('Gelöscht.'); after(); } catch (e) { fail(e); }
    }, () => reviewApplication(id, after));
    if (ro) return;
    $('rvNo').onclick = () => {
      $('dialog').innerHTML = `<h2>Antrag ablehnen?</h2><label class="f">Grund (nur intern, optional)<input id="rvWhy"></label>
        <div class="btns"><button class="btn ghost" id="cfX">Abbrechen</button><button class="btn danger" id="cfOk">Antrag ablehnen</button></div>`;
      $('cfX').onclick = () => reviewApplication(id, after);
      $('cfOk').onclick = () => GK.busy($('cfOk'), async () => { try { await api(`applications/${id}/reject`, 'POST', { reason: val('rvWhy') }); closeDialog(); toast('Abgelehnt.'); after(); } catch (e) { fail(e); } });
    };
    $('rvOk').onclick = () => GK.busy($('rvOk'), async () => {
      const persons = d.persons.map((p, i) => ({ merge_id: (document.querySelector(`[data-merge="${i}"]`) || {}).value || null, fee_id: (document.querySelector(`[data-fee="${i}"]`) || {}).value ? +(document.querySelector(`[data-fee="${i}"]`)).value : null }));
      try { const r = await api(`applications/${id}/accept`, 'POST', { persons, entry_date: val('rvEntry') }); closeDialog(); if (r.pending) { toast(`Befürwortet. ${PENDING}`); after(); return; } toast('Angenommen – Willkommens-E-Mail ist unterwegs.'); await loadMeta(); GK.refreshBadges(); openMember(r.member_id); }
      catch (e) { fail(e); }
    });
  }

  async function acceptChange(c, after) {
    if (c.scope) {
      if (c.kind === 'austritt') {
        dialog(`<h2>Austritt von ${esc(c.name)}</h2><p>Gemeldet von <b>${esc(c.created_by || '–')}</b> (Abteilungsleitung).</p>${c.rows.filter(r => r.field !== 'Austritt zum').map(r => `<p class="muted s" style="margin:0 0 6px">${esc(r.field)}: ${esc(r.new || '–')}</p>`).join('')}
          <label class="f" style="max-width:260px">Austritt zum<input id="ckDate" type="date" value="${esc(c.exit_date || '')}"></label>
          <p class="muted s">Beiträge und Abteilungen enden zum Austritt. Das Kündigungsschreiben (falls hochgeladen) liegt im Mitglied unter Dokumente.</p>
          <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn danger" id="ckOk">Austritt bestätigen</button></div>`);
        $('c').onclick = closeDialog;
        $('ckOk').onclick = () => GK.busy($('ckOk'), async () => { try { await api(`changes/${c.id}/accept`, 'POST', { exit_date: val('ckDate') }); closeDialog(); toast('Austritt bestätigt.'); after(); } catch (e) { fail(e); } });
        return;
      }
      if (!await ask(`${c.label} von ${c.name} bestätigen?\nGemeldet von ${c.created_by || '–'}.\n\n${c.rows.map(r => `${r.field}: ${r.new || '–'}`).join('\n')}`, { ok: 'Bestätigen', danger: false })) return;
      try { await api(`changes/${c.id}/accept`, 'POST', {}); toast('Bestätigt.'); after(); } catch (e) { fail(e); }
      return;
    }
    if (c.kind === 'daten') {
      if (!await ask(`Änderung von ${c.name} übernehmen?\n\n${c.rows.map(r => `${FIELD[r.field] || r.field}: ${r.old || '–'} → ${r.new || '–'}`).join('\n')}`, { ok: 'Übernehmen', danger: false })) return;
      try { await api(`changes/${c.id}/accept`, 'POST', {}); toast('Übernommen.'); after(); } catch (e) { fail(e); }
      return;
    }
    if (c.kind === 'bank') {
      dialog(`<h2>Neue Bankverbindung von ${esc(c.name)}</h2><table class="tbl mv-diff"><tr><th>Feld</th><th>bisher</th><th>neu</th></tr>${c.rows.map(r => `<tr><td>${esc(FIELD[r.field] || r.field)}</td><td>${esc(r.old || '–')}</td><td><b>${esc(r.new || '–')}</b></td></tr>`).join('')}</table>
        <p style="margin:14px 0 6px">Unterschrift (${deTime(c.signed_at)}):</p><img class="mv-sig" src="${BASE}changes/${c.id}/signature" alt="Unterschrift">
        <p class="muted s">Beim Übernehmen entsteht ein neues SEPA-Mandat mit neuer Referenz (Erstlastschrift). Das unterschriebene Mandat wird als PDF abgelegt und dem Mitglied geschickt.</p>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="cbOk">Übernehmen</button></div>`);
      $('c').onclick = closeDialog;
      $('cbOk').onclick = () => GK.busy($('cbOk'), async () => { try { await api(`changes/${c.id}/accept`, 'POST', {}); closeDialog(); toast('Neue Bankverbindung übernommen.'); after(); } catch (e) { fail(e); } });
      return;
    }
    dialog(`<h2>Kündigung von ${esc(c.name)}</h2><p>Für: <b>${esc((c.kuendigung.names || []).join(', '))}</b>${c.kuendigung.reason ? `<br><span class="muted">${esc(c.kuendigung.reason)}</span>` : ''}</p>
      <label class="f" style="max-width:260px">Austritt zum<input id="ckDate" type="date" value="${esc(c.kuendigung.exit_date)}"></label>
      <p class="muted s">Vorschlag nach Kündigungsfrist und Beitragsjahr. Beiträge und Abteilungen enden zum Austritt; das Mitglied bekommt eine Bestätigung per E-Mail.</p>
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn danger" id="ckOk">Kündigung bestätigen</button></div>`);
    $('c').onclick = closeDialog;
    $('ckOk').onclick = () => GK.busy($('ckOk'), async () => { try { await api(`changes/${c.id}/accept`, 'POST', { exit_date: val('ckDate') }); closeDialog(); toast('Kündigung bestätigt.'); after(); } catch (e) { fail(e); } });
  }

  /* ================================================================= Beiträge & Einzug */
  const finKpis = f => `<div class="kpis">
        <div class="kpi"><div class="l">Offen</div><div class="v">${euro(f.open.c)}</div></div>
        <div class="kpi ${f.overdue.c > 0 ? 'warn' : ''}"><div class="l">davon überfällig</div><div class="v">${euro(f.overdue.c)}</div></div>
        <div class="kpi"><div class="l">im Einzug</div><div class="v">${euro(f.inCollection.c)}</div></div>
        <div class="kpi"><div class="l">eingegangen ${esc(f.year)}</div><div class="v">${euro(f.paidYear.c)}</div></div></div>`;
  /** Menü „Beiträge & Zahlungen“ (Recht „Einzug“): Reiter Beitragslauf · Lastschriften · Offene Posten · Rechnungen & Mahnungen, je mit den Kennzahlen oben */
  const finPage = fn => async function show(el) {
    const f = await api('finance');
    el.innerHTML = `${finKpis(f)}<div id="fBody"></div>`;
    await fn($('fBody'), f, () => show(el).catch(fail));
  };
  const showRun = finPage(finRun);
  const showCollections = finPage(finCollections);
  const showCharges = finPage((el, f, again) => finCharges(el, again));
  const showDunning = finPage((el, f, again) => finDunning(el, again));
  /** Reiter „Beiträge & Abteilungen“ (Stammdaten): Beitragsarten, Zusatzbeiträge, Abteilungen und Altersstufen */
  async function showCatalog(el) {
    const again = () => loadMeta().then(() => { GK.refreshBadges(); return showCatalog(el); }).catch(fail);
    const rows = await api('age-notices');
    el.innerHTML = '<div id="cBody"></div><div id="cAges"></div>';
    catalogCards($('cBody'), again);
    await ageList($('cAges'), again, rows);
  }
  /* ---------------------------------------------------------------- Altersstufen */
  const ageTo = n => (n.to ? `<span translate="no">${esc(n.to.name)}</span> · ${euro(n.to.cents)}` : '<span class="muted s">kein passender Einzelbeitrag</span>');
  const ageFrom = n => (n.kind === 'family' ? 'Familienbeitrag' : n.from ? `<span translate="no">${esc(n.from.name)}</span> · ${euro(n.from.cents)}` : '–');
  function ageBind(root, after) {
    root.querySelectorAll('[data-age]').forEach(b => { b.onclick = async () => {
      const [id, action] = b.dataset.age.split(':');
      try { await api('age-notices/' + id, 'POST', { action }); toast(action === 'umstellen' ? 'Umgestellt – ab dem nächsten Zeitraum gilt der neue Beitrag.' : 'So belassen – der bisherige Beitrag läuft weiter.'); after(); } catch (e) { fail(e); }
    }; });
    root.querySelectorAll('[data-agem]').forEach(a => { a.onclick = e => { e.preventDefault(); openMember(+a.dataset.agem); }; });
  }
  async function ageList(el, after, pre) {
    const rows = pre || await api('age-notices');
    el.innerHTML = `<div class="card"><h3>Altersstufen</h3>
      <p class="muted s" style="margin-top:0">Wer älter wird und nicht mehr in seinen Beitrag passt, aus dem Familienbeitrag herauswächst oder in eine höhere Stufe des Zusatzbeitrags kommt, steht hier. Bis zur Entscheidung läuft der <b>bisherige Beitrag weiter</b>. „So belassen“ wird gemerkt – es kommt kein neuer Hinweis.</p>
      ${rows.length ? `<table class="tbl kompakt"><tr><th>Mitglied</th><th>Anlass</th><th>bisher</th><th>neu</th><th class="nw">ab</th><th></th></tr>${rows.map(n => `<tr>
          <td><a href="#" data-agem="${n.member_id}"><b>${esc(GK.lastFirst(n.name || ''))}</b></a>${n.payer_name ? `<div class="muted s">zahlt über ${esc(GK.lastFirst(n.payer_name))}</div>` : ''}</td>
          <td>${esc(n.label)}${n.dept ? ` <span class="muted s" translate="no">(${esc(n.dept)})</span>` : ''}<div class="muted s">${n.age} Jahre</div></td>
          <td>${ageFrom(n)}</td><td>${ageTo(n)}</td><td class="num nw">${deDate(n.due_date)}</td>
          <td class="r nw"><button class="btn small" data-age="${n.id}:belassen">So belassen</button> <button class="btn small" data-age="${n.id}:umstellen" ${n.kind !== 'zusatz' && !n.to ? 'disabled' : ''}>Umstellen</button></td></tr>`).join('')}</table>`
        : '<p class="empty">Gerade nichts zu entscheiden – wer in eine andere Altersstufe rutscht, erscheint hier.</p>'}</div>`;
    ageBind(el, after);
  }

  async function finRun(el, f, again) {
    const runs = await api('runs');
    const m = st.meta;
    const today = m.today;
    const done = st.runDone; st.runDone = null;
    el.innerHTML = `<div class="card"><h3>Beitragslauf</h3>
        <p class="muted s" style="margin-top:0">Erzeugt die Beiträge aller Mitglieder bis zum Stichtag als offene Posten – anteilig nach Eintritt, jeder Zeitraum nur einmal. Danach geht es weiter zum Einzug.</p>
        <div class="mv-grid" style="--c:2"><label class="f">Abrechnen bis<input id="rUntil" type="date" value="${today}"></label>
          <label class="f">Nur Zahlungsart<select id="rPay"><option value="">alle</option>${Object.entries(PAY).map(([k, l]) => opt(k, l)).join('')}</select></label></div>
        <div class="mv-cons" style="margin-top:12px">${m.drinks ? `<label class="chk"><input type="checkbox" id="rDrinks"> Verkauf mit abbuchen <span class="muted s">(offene Verkaufskonten der Mitglieder${f.drinksOpen != null ? ': ' + euro(f.drinksOpen) : ''})</span></label>` : ''}
          ${m.arbeit ? '<label class="chk"><input type="checkbox" id="rExtra" checked> Nicht geleistete Arbeitsstunden mit abrechnen</label>' : ''}</div>
        <div class="row" style="justify-content:flex-end"><button class="btn ${done ? '' : 'primary'}" id="rPrev">Vorschau</button></div></div>
      <div id="rOut">${done ? `<div class="card"><h3>Beiträge abgerechnet</h3>
        <p class="muted s" style="margin-top:0">${done.count} Positionen über ${euro(done.cents)} stehen jetzt als offene Posten bereit. Als Nächstes die Lastschriften erstellen; wer per Rechnung oder bar zahlt, bekommt seine Rechnung unter „Rechnungen & Mahnungen“.</p>
        <div class="row" style="justify-content:flex-end"><button class="btn primary" id="rNext">Weiter zum Einzug</button></div></div>` : ''}</div>
      <div class="card"><h3>Bisherige Läufe</h3>${runs.length ? `<table class="tbl kompakt"><tr><th>Lauf</th><th>Art</th><th>bis</th><th class="r">Positionen</th><th class="r">Summe</th><th>von</th><th></th></tr>
        ${runs.map(r => `<tr><td class="num nw">${deTime(r.created_at)}</td><td>${r.kind === 'getraenke' ? 'Verkauf' : 'Beiträge'}</td><td class="num nw">${deDate(r.until_date)}</td><td class="r k-lbl" data-label="Positionen">${r.count}</td><td class="r">${euro(r.cents)}</td><td class="muted s k-weg">${esc(r.by_user || '')}</td>
          <td class="r nw"><button class="btn small" data-rshow="${r.id}">Posten</button></td></tr>`).join('')}</table>` : '<p class="empty">Noch kein Lauf.</p>'}</div>`;
    const preview = async () => {
      const o = { until: val('rUntil'), payment: val('rPay') || undefined, drinks: $('rDrinks') ? $('rDrinks').checked : false, extra: $('rExtra') ? $('rExtra').checked : true };
      const pv = await api('runs/preview', 'POST', o);
      const skip = new Set();
      $('rOut').innerHTML = `<div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;flex:1 1 180px;min-width:0;line-height:1.25">Vorschau Beitragslauf bis ${deDate(pv.until)}</h3>
          <span class="muted s">${pv.totals.payers} Zahler · ${pv.totals.count} Positionen</span></div>
        ${pv.warnings.map(w => `<div class="banner a"><span>${esc(w.text)}</span></div>`).join('')}${pv.info.map(w => `<div class="banner g"><span>${esc(w)}</span></div>`).join('')}
        ${pv.positions.length ? `<label class="chk" style="margin-bottom:8px"><input type="checkbox" id="rAll" checked> Alle Positionen abrechnen</label><div class="scroll" style="max-height:52vh"><table class="tbl kompakt"><tr><th>Zahler</th><th>Position</th><th>Art</th><th>Fälligkeit</th><th>Zahlung</th><th class="r">Betrag</th></tr>
          ${pv.positions.map(p => `<tr><td><label class="chk"><input type="checkbox" data-key="${esc(p.key)}" checked aria-label="abrechnen"> <b>${esc(GK.lastFirst(p.payer_name))}</b></label></td><td translate="no">${esc(p.text)}</td><td class="k-weg">${esc(KIND[p.kind] || p.kind)}</td><td class="num nw">${deDate(p.due_date)}</td><td class="k-weg">${esc(PAY[p.payment] || p.payment)}</td><td class="r">${euro(p.cents)}</td></tr>`).join('')}</table></div>
          <div class="mv-sum"><span>${Object.entries(pv.totals.byKind).map(([k, c]) => `${esc(GK.T(KIND[k] || k))}: <b style="font-size:14px">${euro(c)}</b>`).join(' · ')}</span><span>Summe <b id="rSum">${euro(pv.totals.cents)}</b></span></div>
          <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" id="rCancel">Verwerfen</button><button class="btn primary" id="rGo">Beiträge abrechnen</button></div>`
          : '<p class="empty">Nichts abzurechnen – alles ist schon bis zu diesem Tag abgerechnet.</p>'}</div>`;
      if (!pv.positions.length) return;
      const sum = () => { $('rSum').textContent = euro(pv.positions.filter(p => !skip.has(p.key)).reduce((s, p) => s + p.cents, 0)); };
      $('rOut').querySelectorAll('[data-key]').forEach(c => { c.onchange = () => { if (c.checked) skip.delete(c.dataset.key); else skip.add(c.dataset.key); sum(); }; });
      $('rAll').onchange = () => { $('rOut').querySelectorAll('[data-key]').forEach(c => { c.checked = $('rAll').checked; if (c.checked) skip.delete(c.dataset.key); else skip.add(c.dataset.key); }); sum(); };
      $('rCancel').onclick = () => { $('rOut').innerHTML = ''; };
      $('rGo').onclick = async () => {
        if (!await ask(`Beiträge jetzt abrechnen?\n\n${pv.positions.length - skip.size} Positionen werden offene Posten${o.drinks ? ' – die Verkaufskonten werden dabei abgerechnet und stehen danach auf 0' : ''}. Solange nichts eingezogen ist, lässt sich der Lauf zurücknehmen.`, { ok: 'Abrechnen', danger: false })) return;
        try { st.runDone = await api('runs', 'POST', { ...o, skip: [...skip] }); again(); } catch (e) { fail(e); }
      };
      $('rOut').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    $('rPrev').onclick = () => preview().catch(fail);
    if ($('rNext')) { $('rNext').onclick = () => GK.go('mv-einzug'); $('rOut').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    el.querySelectorAll('[data-rshow]').forEach(b => { b.onclick = async () => {
      const run = runs.find(x => x.id === +b.dataset.rshow);
      const posten = async () => {
        const r = await api('charges?status=alle&run=' + run.id);
        dialog(`<h2>Posten des Laufs</h2>${chargeTable(r.rows, {})}${run.undo ? '<div class="row" style="margin-top:12px"><button class="btn danger" id="rUndo">Lauf zurücknehmen …</button></div>' : ''}<div class="btns"><button class="btn primary" id="c">Schließen</button></div>`, true);
        $('c').onclick = closeDialog;
        bindCharges($('dialog'), () => { closeDialog(); again(); });
        if ($('rUndo')) $('rUndo').onclick = () => confirmIn('Lauf zurücknehmen?', 'Alle Posten dieses Laufs werden gelöscht, „abgerechnet bis“ und die Verkaufskonten wieder auf den Stand davor gesetzt.', 'Lauf zurücknehmen', async () => {
          try { await api('runs/' + run.id, 'DELETE'); closeDialog(); toast('Zurückgenommen.'); again(); } catch (e) { fail(e); }
        }, () => posten().catch(fail));
      };
      posten().catch(fail);
    }; });
  }

  function chargeTable(rows, { member, select } = {}) {
    const first = c => (member ? `<b translate="no">${esc(c.text)}</b>${c.note ? `<div class="muted s">${esc(c.note)}</div>` : ''}` : `<b>${esc(GK.lastFirst(c.payer_name))}</b>${c.member_no ? `<div class="muted s">Nr. ${esc(c.member_no)}</div>` : ''}`);
    return `<div class="scroll" style="max-height:60vh"><table class="tbl kompakt"><tr>${member ? '<th>Position</th>' : '<th>Zahler</th><th>Position</th>'}<th>Fällig</th><th>Art</th><th>Status</th><th class="r">Betrag</th><th></th></tr>
      ${rows.map(c => `<tr class="${c.status === 'storniert' ? 'off' : ''}"><td>${select && c.status === 'eingezogen' ? `<label class="chk"><input type="checkbox" data-csel="${c.id}" aria-label="auswählen"> ${first(c)}</label>` : first(c)}</td>
        ${member ? '' : `<td><span translate="no">${esc(c.text)}</span>${c.note ? `<div class="muted s">${esc(c.note)}</div>` : ''}</td>`}
        <td class="num nw">${deDate(c.due_date)}</td><td class="k-weg">${esc(KIND[c.kind] || c.kind)}</td>
        <td>${pill(CSTAT[c.status] || ['', c.status])}${c.dunning_level ? ` <span class="pill r">${c.dunning_level}. Mahnstufe</span>` : ''}${c.paid_at ? `<div class="muted s">${deDate(c.paid_at)} · ${esc(c.paid_via || '')}</div>` : ''}</td>
        <td class="r ${c.cents < 0 ? 'neg' : ''}">${euro(c.cents)}</td>
        <td class="r nw">${c.status === 'offen' ? `<button class="btn small" data-cpay="${c.id}">Bezahlt</button> <button class="btn small" data-ced="${c.id}">Ändern</button>` : c.status === 'bezahlt' ? `<button class="btn small danger" data-ccx="${c.id}">Stornieren</button>` : ''}</td></tr>`).join('')}</table></div>`;
  }
  /** Posten stornieren (im selben Fenster, auch aus „Posten ändern“ heraus) */
  function cancelDialog(c, again, back) {
    dialog(`<h2>Posten stornieren</h2><p class="muted" style="margin-top:0">${esc(GK.lastFirst(c.payer_name))}: ${esc(c.text)} – ${euro(c.cents)}</p>
      <label class="f">Grund<input id="cxR" placeholder="z. B. doppelt, Ermäßigung"></label>
      ${c.kind === 'beitrag' ? '<label class="chk" style="margin-top:12px"><input type="checkbox" id="cxRe"> Zeitraum beim nächsten Beitragslauf neu abrechnen</label>' : ''}
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn danger" id="cxOk">Stornieren</button></div>`);
    $('c').onclick = back || closeDialog;
    $('cxOk').onclick = () => GK.busy($('cxOk'), async () => { try { await api(`charges/${c.id}/cancel`, 'POST', { reason: val('cxR'), rebill: $('cxRe') ? $('cxRe').checked : false }); closeDialog(); toast('Storniert.'); again(); } catch (e) { fail(e); } });
  }
  function bindCharges(el, again) {
    const get = async id => (await api('charges?status=alle')).rows.find(c => c.id === id);
    el.querySelectorAll('[data-cpay]').forEach(b => { b.onclick = async () => {
      const c = await get(+b.dataset.cpay);
      dialog(`<h2>Zahlung erfassen</h2><p class="muted" style="margin-top:0">${esc(GK.lastFirst(c.payer_name))}: ${esc(c.text)} – ${euro(c.cents)}</p>
        <div class="mv-grid" style="--c:3"><label class="f">Betrag<input id="pyC" inputmode="decimal" value="${centsToInput(c.cents)}"></label><label class="f">Datum<input id="pyD" type="date" value="${st.meta.today}"></label>
          <label class="f">Zahlungsweg<select id="pyV">${opt('ueberweisung', 'Überweisung')}${opt('bar', 'bar')}${opt('lastschrift', 'Lastschrift')}${opt('verrechnet', 'verrechnet')}</select></label></div>
        <p class="muted s">Weniger als der Betrag = Teilzahlung, der Rest bleibt offen.</p>
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="pyOk">Speichern</button></div>`);
      $('c').onclick = closeDialog;
      $('pyOk').onclick = () => GK.busy($('pyOk'), async () => { try { await api(`charges/${c.id}/pay`, 'POST', { cents: toCents(val('pyC')), date: val('pyD'), via: val('pyV') }); closeDialog(); toast('Zahlung erfasst.'); again(); } catch (e) { fail(e); } });
    }; });
    el.querySelectorAll('[data-ced]').forEach(b => { b.onclick = async () => chargeDialog(await get(+b.dataset.ced), {}, again); });
    el.querySelectorAll('[data-ccx]').forEach(b => { b.onclick = async () => cancelDialog(await get(+b.dataset.ccx), again); });
  }
  function chargeDialog(c, { member_id } = {}, again) {
    dialog(`<h2>${c ? 'Posten ändern' : 'Forderung anlegen'}</h2><div class="mv-grid" style="--c:2">
      ${c || member_id ? '' : `<label class="f wall">Mitglied<select id="chM">${memberOptions('')}</select></label>`}
      <label class="f wall">Buchungstext<input id="chT" value="${esc(c ? c.text : '')}" placeholder="z. B. Hallenmiete Wintersaison"></label>
      <label class="f">Betrag (Gutschrift mit Minus)<input id="chC" inputmode="decimal" value="${c ? centsToInput(c.cents) : ''}"></label><label class="f">Fällig am<input id="chD" type="date" value="${esc(c ? c.due_date : st.meta.today)}"></label>
      ${c ? '' : `<label class="f">Art<select id="chK">${['sonstiges', 'aufnahme', 'beitrag', 'getraenke'].map(k => opt(k, KIND[k])).join('')}</select></label>`}</div>
      ${c ? '' : `<p class="muted s">Für Angehörige landet die Forderung automatisch beim Zahler.</p>
        <div class="banner a hidden" id="chKHint"><span>Beträge für den Verkauf besser unter <b>Verkauf › Abrechnung › „+ Betrag auf Konto“</b> buchen – dann stehen sie auf dem Verkaufskonto und werden mit dem nächsten Verkaufs-Einzug abgerechnet.</span></div>`}
      ${c ? '<div class="row" style="margin-top:12px"><button class="btn danger" id="chCx">Posten stornieren …</button></div>' : ''}
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="chOk">Speichern</button></div>`);
    $('c').onclick = closeDialog;
    if ($('chCx')) $('chCx').onclick = () => cancelDialog(c, again, () => chargeDialog(c, { member_id }, again));
    if ($('chK')) $('chK').onchange = () => $('chKHint').classList.toggle('hidden', val('chK') !== 'getraenke');
    $('chOk').onclick = () => GK.busy($('chOk'), async () => {
      try {
        if (c) await api('charges/' + c.id, 'PUT', { text: val('chT'), cents: toCents(val('chC')), due_date: val('chD') });
        else await api('charges', 'POST', { member_id: member_id || +val('chM'), text: val('chT'), cents: toCents(val('chC')), due_date: val('chD'), kind: val('chK') });
        closeDialog(); toast('Gespeichert.'); again();
      } catch (e) { fail(e); }
    });
  }

  async function finCharges(el, again) {
    st.cf = st.cf || 'offen';
    const q = st.cf === 'ueber' ? 'status=offen&overdue=1' : `status=${st.cf}`;
    const r = await api('charges?' + q);
    el.innerHTML = `<div class="filterbar">${chipBar('cSeg', [['offen', 'Offen'], ['ueber', 'Überfällig'], ['eingezogen', 'Im Einzug'], ['bezahlt', 'Bezahlt'], ['alle', 'Alle']], st.cf)}
        <span class="muted s" style="margin-left:auto">${r.rows.length} Posten · ${euro(r.sum)}</span></div>
      ${st.cf === 'eingezogen' && r.rows.length ? `<div class="banner g"><span>Diese Posten stecken in einer eingereichten Lastschrift. Erst wenn keine Rücklastschrift mehr kommt (meist nach 1–2 Wochen), hier markieren und „Zahlung erfolgt“ buchen. Rücklastschriften vorher im Einzug beim Zahler erfassen.</span></div>
        <div class="toolbar"><label class="chk"><input type="checkbox" id="cAll"> Alle markieren</label><span class="muted s" id="cSel"></span><button class="btn" id="cPaid" style="margin-left:auto" disabled>Zahlung erfolgt</button></div>` : ''}
      <div class="card">${r.rows.length ? chargeTable(r.rows, { select: st.cf === 'eingezogen' }) : '<p class="empty">Keine Posten.</p>'}</div>`;
    if ($('cPaid')) {
      const sel = () => [...el.querySelectorAll('[data-csel]:checked')].map(x => +x.dataset.csel);
      const upd = () => { const s = sel(); $('cPaid').disabled = !s.length; $('cSel').textContent = s.length ? `${s.length} ausgewählt · ${euro(r.rows.filter(c => s.includes(c.id)).reduce((t, c) => t + c.cents, 0))}` : ''; $('cAll').checked = s.length === r.rows.length; };
      el.querySelectorAll('[data-csel]').forEach(x => { x.onchange = upd; });
      $('cAll').onchange = () => { el.querySelectorAll('[data-csel]').forEach(x => { x.checked = $('cAll').checked; }); upd(); };
      $('cPaid').onclick = async () => {
        const ids = sel(); const d = await askText(`Zahlung erfolgt für ${ids.length} Posten?\nDatum der Gutschrift auf dem Vereinskonto (TT.MM.JJJJ):`, deDate(st.meta.today), { ok: 'Buchen' }); if (d == null) return;
        const m2 = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(d.trim());
        try { const x = await api('charges/paid', 'POST', { ids, date: m2 ? `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}` : undefined }); toast(`${x.count} Posten als bezahlt gebucht (${euro(x.cents)}).`); finCharges(el, again).catch(fail); } catch (e) { fail(e); }
      };
    }
    $('cSeg').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; st.cf = b.dataset.f; finCharges(el, again).catch(fail); };
    GK.tabTools('<button class="btn primary" id="cNew">+ Forderung</button>', el);
    $('cNew').onclick = () => chargeDialog(null, {}, () => finCharges(el, again));
    bindCharges(el, () => finCharges(el, again));
  }

  async function finCollections(el, f, again) {
    const list = await api('collections');
    el.innerHTML = `<div class="card"><h3>Neuer Einzug</h3>
        <p class="muted s" style="margin-top:0">Je Zahler eine Lastschrift über alle bis zum Einzugstag fälligen offenen Posten. Erst- und Folgelastschriften werden automatisch getrennt. Vorgeschlagen ist der früheste Termin wegen der Vorabinformation (<b>${deDate(f.earliest)}</b>) – ein späterer Tag geht immer.</p>
        <div class="row"><label class="f">Einzugstag wählen<input id="kDate" type="date" value="${f.earliest}"></label><button class="btn" id="kPrev">Prüfen</button></div>
        <div id="kOut"></div></div>
      ${st.meta.drinks ? `<div class="card"><h3>Verkauf einziehen</h3>
        <p class="muted s" style="margin-top:0">Jederzeit, getrennt von den Beiträgen: alle offenen Verkaufskonten der Mitglieder in einem Ablauf bis zur SEPA-Datei. Denselben Weg gibt es unter Verkauf › Abrechnung.${f.drinksDue ? ` Üblicher Termin: ${esc(f.drinksDue.split('-').reverse().join('.'))}.` : ''}</p>
        <div class="row" style="justify-content:space-between;align-items:center"><span>Offen auf Verkaufskonten (Mitglieder): <b>${euro(f.drinksOpen || 0)}</b></span><button class="btn" id="rDrinkOnly">Verkauf einziehen …</button></div></div>` : ''}
      <div class="card"><h3>Einzüge</h3>${list.length ? `<table class="tbl kompakt"><tr><th>Termin</th><th>Status</th><th class="r">Lastschriften</th><th class="r">Summe</th><th>Vorabinfo</th><th></th></tr>
        ${list.map(k => `<tr class="${k.status === 'verworfen' ? 'off' : ''}"><td class="nw"><b>${deDate(k.collection_date)}</b>${k.kind === 'getraenke' ? ' <span class="pill b">Verkauf</span>' : ''}<div class="muted s">${esc(k.msg_id)}</div></td>
          <td>${pill(k.status === 'gebucht' ? ['g', 'verbucht'] : k.status === 'verworfen' ? ['', 'verworfen'] : ['a', 'erstellt'])}${k.returned ? ` <span class="pill r">${k.returned} zurück</span>` : ''}</td>
          <td class="r k-lbl" data-label="Lastschriften">${k.count}</td><td class="r">${euro(k.cents)}</td><td class="nw k-weg">${k.prenotified_at ? deTime(k.prenotified_at) : '<span class="muted s">noch nicht</span>'}</td>
          <td class="r nw">${k.status !== 'verworfen' ? `<button class="btn small" data-kopen="${k.id}">Details</button> <a class="btn small" href="${BASE}collections/${k.id}/xml" download>SEPA-Datei</a>` : ''}</td></tr>`).join('')}</table>` : '<p class="empty">Noch kein Einzug.</p>'}
        <p class="muted s" style="margin-bottom:0">Die SEPA-Datei (pain.008.001.08) im Online-Banking unter „Sammellastschrift / SEPA-Datei hochladen“ einreichen. Kam nach 1–2 Wochen nichts zurück: „Zahlung erfolgt“ buchen – im Einzug oder unter „Offene Posten → Im Einzug“.</p></div>`;
    $('kPrev').onclick = async () => {
      try {
        const p = await api('collections/preview', 'POST', { date: val('kDate') });
        const skip = new Set();
        $('kOut').innerHTML = `${!p.ready ? '<div class="banner r"><span>Gläubiger-ID oder Vereinskonto fehlen (Beiträge & Zahlungen › Einstellungen › Lastschrift).</span></div>' : ''}${!p.bankDay ? '<div class="banner r"><span>Dieser Tag ist kein Bankarbeitstag.</span></div>' : ''}
          ${p.tooEarly ? `<div class="banner a"><span>Zu früh: frühester Termin ist der ${deDate(p.earliest)}.</span></div>` : ''}
          ${p.problems.length ? `<div class="banner a"><span>${p.problems.length} Zahler bleiben offen: ${esc(p.problems.map(x => `${x.name} (${x.reason})`).join(', '))}</span></div>` : ''}
          ${p.zero && p.zero.length ? `<div class="banner g"><span>${p.zero.length} Zahler: Forderungen und Gutschriften gleichen sich aus (${esc(p.zero.map(x => x.name).join(', '))}) – werden mit dem Einzug als verrechnet gebucht.</span></div>` : ''}
          ${p.later ? `<div class="banner a"><span>${laterText(p.later)}</span></div>` : ''}${p.bicMissing ? `<div class="banner g"><span>${BIC_HINT}</span></div>` : ''}
          ${p.other.length ? `<div class="banner g"><span>${p.other.length} Zahler mit Rechnung/bar (${euro(p.other.reduce((s, x) => s + x.cents, 0))}) – unter „Rechnungen & Mahnungen“ verschicken.</span></div>` : ''}
          ${p.ok.length ? `<div class="scroll" style="max-height:48vh;margin-top:12px"><table class="tbl kompakt"><tr><th>Zahler</th><th>Konto</th><th>Mandat</th><th>Art</th><th>Posten</th><th class="r">Betrag</th></tr>
            ${p.ok.map(x => `<tr><td><label class="chk"><input type="checkbox" data-kx="${x.member_id}" checked aria-label="einziehen"> <b>${esc(GK.lastFirst(x.name))}</b></label></td><td class="nw">${esc(x.masked)}</td><td class="k-weg">${esc(x.mandate_ref)}</td><td>${x.seq === 'FRST' ? '<span class="pill b">Erst</span>' : '<span class="pill">Folge</span>'}</td><td class="s" translate="no">${esc(x.texts.join(', '))}</td><td class="r">${euro(x.cents)}</td></tr>`).join('')}</table></div>
            <div class="mv-sum"><span class="muted s">An ${esc(p.creditor.name)} · ${esc(p.creditor.iban)} · Gläubiger-ID ${esc(p.creditor.ci)}</span><span>Summe <b id="kSum">${euro(p.total)}</b></span></div>
            <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" id="kGo" ${p.ready && p.bankDay ? '' : 'disabled'}>Einzug erstellen</button></div>` : '<p class="empty">Keine fälligen Lastschriften.</p>'}`;
        $('kOut').querySelectorAll('[data-kx]').forEach(c => { c.onchange = () => { if (c.checked) skip.delete(+c.dataset.kx); else skip.add(+c.dataset.kx); $('kSum').textContent = euro(p.ok.filter(x => !skip.has(x.member_id)).reduce((s, x) => s + x.cents, 0)); }; });
        if ($('kGo')) $('kGo').onclick = async () => {
          try { const r = await api('collections', 'POST', { date: val('kDate'), skip: [...skip] }); again(); setTimeout(() => collectionDetail(r.id, again, true), 300); }
          catch (e) { if (e.status === 409 && await ask(`${e.message}\n\nTrotzdem zu diesem Termin erstellen? Nur, wenn mit den Mitgliedern eine kürzere Frist vereinbart ist.`, { ok: 'Trotzdem' })) { try { const r = await api('collections', 'POST', { date: val('kDate'), skip: [...skip], force: true }); again(); setTimeout(() => collectionDetail(r.id, again, true), 300); } catch (e2) { fail(e2); } } else fail(e); }
        };
      } catch (e) { fail(e); }
    };
    el.querySelectorAll('[data-kopen]').forEach(b => { b.onclick = () => collectionDetail(+b.dataset.kopen, again); });
    if ($('rDrinkOnly')) $('rDrinkOnly').onclick = () => drinksCollect(again).catch(fail);
  }
  const laterText = l => `${l.n === 1 ? '1 offener Posten' : `${l.n} offene Posten`} über ${euro(l.cents)} ${l.n === 1 ? 'wird' : 'werden'} erst nach dem Einzugstag fällig (ab ${deDate(l.first)}) und ${l.n === 1 ? 'bleibt' : 'bleiben'} für einen späteren Einzug. Für jetzt einen späteren Einzugstag wählen.`;
  const BIC_HINT = 'Beim Vereinskonto fehlt der BIC. Das ist erlaubt (in der SEPA-Datei steht dann „NOTPROVIDED“), manche Banken verlangen ihn aber – am besten unter Verein › Einstellungen › Bankkonten eintragen.';

  /* ---------- Verkauf per Lastschrift: ein Ablauf von der Vorschau bis zur SEPA-Datei ----------
     Offene Verkaufskonten der Mitglieder + schon offene Verkaufs-Posten, getrennt von den Beiträgen.
     Aufruf hier (Kasten „Verkauf einziehen“) und aus Verkauf › Abrechnung (GK.drinksCollect). */
  async function drinksCollect(after) {
    await loadMeta();
    const skip = new Set();
    let date = '';
    const show = async () => {
      const p = await api('drinks-collection/preview', 'POST', date ? { date } : {});
      date = p.date;
      const sel = () => p.ok.filter(x => !skip.has(x.member_id));
      const why = r => (/Guthaben/.test(r) ? 'Nichts einzuziehen – wird beim nächsten Einzug verrechnet.' : 'Mandat beim Mitglied eintragen (Bankverbindung). Bis dahin bleibt der Betrag offen.');
      const KINDS = { mannschaft: 'Mannschaft', nichtmitglied: 'Kein Mitglied' };
      const no = [...p.problems.map(x => [GK.lastFirst(x.name), x.reason, x.cents, why(x.reason)]),
        ...p.other.map(x => [GK.lastFirst(x.name), `zahlt per ${PAY[x.payment] || x.payment}`, x.cents, 'Bar kassieren oder überweisen lassen, dann unter Verkauf › Abrechnung als abgerechnet markieren.']),
        ...p.notMembers.map(x => [x.name, KINDS[x.kind] || 'ohne Mitgliedsdaten', x.cents, 'Bar kassieren, dann unter Verkauf › Abrechnung als abgerechnet markieren.'])];
      dialog(`<h2>Verkauf per Lastschrift einziehen</h2>
        <p class="muted" style="margin-top:0">Alle offenen Verkaufskonten der Mitglieder und schon offene Verkaufs-Posten – getrennt von den Beiträgen. Angehörige zahlen beim Zahler. Die Konten werden dabei als abgerechnet markiert.</p>
        <div class="row" style="align-items:flex-end"><label class="f">Einzugstag wählen<input id="dcDate" type="date" value="${esc(p.date)}"></label>
          <p class="muted s" style="flex:1 1 220px;margin:0 0 8px">Vorgeschlagen ist der früheste Termin (${deDate(p.earliest)}) – Vorabinformation ${esc(st.meta.settings.prenotify_days)} Tage vorher plus Vorlauf der Bank. Ein späterer Tag geht immer.</p></div>
        ${!p.ready ? '<div class="banner r"><span>Gläubiger-ID oder Vereinskonto fehlen (Beiträge & Zahlungen › Einstellungen › Lastschrift).</span></div>' : ''}${!p.bankDay ? '<div class="banner r"><span>Dieser Tag ist kein Bankarbeitstag – bitte einen anderen wählen.</span></div>' : ''}
        ${p.tooEarly ? `<div class="banner a"><span>Zu früh: frühester Termin ist der ${deDate(p.earliest)}.</span></div>` : ''}${p.bicMissing ? `<div class="banner g"><span>${BIC_HINT}</span></div>` : ''}
        ${p.existing ? `<div class="banner g"><span>Dabei: ${p.existing.n === 1 ? '1 schon offener Verkaufs-Posten' : `${p.existing.n} schon offene Verkaufs-Posten`} aus den Mitgliedern (${euro(p.existing.cents)}).</span></div>` : ''}
        ${p.later ? `<div class="banner a"><span>${laterText(p.later)}</span></div>` : ''}
        ${p.zero.length ? `<div class="banner g"><span>${p.zero.length} Zahler: Forderungen und Gutschriften gleichen sich aus (${esc(p.zero.map(x => GK.lastFirst(x.name)).join(', '))}) – werden als verrechnet gebucht.</span></div>` : ''}
        <h3 style="margin:16px 0 8px">Per Lastschrift <span class="muted s">${p.ok.length} Zahler</span></h3>
        ${p.ok.length ? `<div class="scroll" style="max-height:40vh"><table class="tbl"><tr><th style="width:36px"></th><th>Zahler</th><th>Art</th><th>Posten</th><th class="r">Betrag</th></tr>
          ${p.ok.map(x => `<tr><td><input type="checkbox" data-dcx="${x.member_id}" ${skip.has(x.member_id) ? '' : 'checked'} aria-label="einziehen"></td><td><b>${esc(GK.lastFirst(x.name))}</b><div class="muted s">${esc(x.masked)}</div></td>
            <td>${x.seq === 'FRST' ? '<span class="pill b">Erst</span>' : '<span class="pill">Folge</span>'}</td><td class="s" translate="no">${esc(x.texts.join(', '))}</td><td class="r">${euro(x.cents)}</td></tr>`).join('')}</table></div>
          <div class="mv-sum"><span class="muted s">An ${esc(p.creditor.name)} · ${esc(p.creditor.iban)}</span><span>Summe <b id="dcSum">${euro(sel().reduce((a, x) => a + x.cents, 0))}</b></span></div>`
          : '<p class="empty">Gerade ist nichts per Lastschrift einzuziehen.</p>'}
        ${no.length ? `<h3 style="margin:16px 0 8px">Geht nicht per Lastschrift <span class="muted s">bleibt offen</span></h3>
          <div class="scroll" style="max-height:30vh"><table class="tbl"><tr><th>Konto</th><th>Grund</th><th class="r">Betrag</th><th>Was tun?</th></tr>
          ${no.map(([n, r, c, t]) => `<tr><td><b>${esc(n)}</b></td><td>${esc(r)}</td><td class="r">${euro(c)}</td><td class="s">${esc(t)}</td></tr>`).join('')}</table></div>` : ''}
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="dcGo" ${p.ready && p.bankDay && sel().length ? '' : 'disabled'}>Einzug erstellen</button></div>`, true);
      $('c').onclick = closeDialog;
      $('dcDate').onchange = () => { date = $('dcDate').value; show().catch(fail); };
      $('dialog').querySelectorAll('[data-dcx]').forEach(c => { c.onchange = () => { if (c.checked) skip.delete(+c.dataset.dcx); else skip.add(+c.dataset.dcx); $('dcSum').textContent = euro(sel().reduce((a, x) => a + x.cents, 0)); $('dcGo').disabled = !(p.ready && p.bankDay && sel().length); }; });
      const go = force => api('drinks-collection', 'POST', { date, skip: [...skip], force });
      const done = r => { if (after) after(); collectionDetail(r.id, after || (() => {}), true).catch(fail); };
      $('dcGo').onclick = () => GK.busy($('dcGo'), async () => {
        try { done(await go(false)); }
        catch (e) {
          if (e.status !== 409) { fail(e); return; }
          confirmIn(e.message, 'Trotzdem zu diesem Termin erstellen? Nur, wenn mit den Mitgliedern eine kürzere Frist vereinbart ist.', 'Trotzdem', async () => {
            try { done(await go(true)); } catch (e2) { fail(e2); }
          }, () => show().catch(fail), { safe: true });
        }
      });
    };
    await show();
  }
  GK.drinksCollect = drinksCollect;

  async function collectionDetail(id, again, fresh) {
    await loadMeta();
    const k = await api('collections/' + id);
    const open = k.status === 'erstellt';
    dialog(`<h2>${k.kind === 'getraenke' ? 'Verkaufs-Einzug' : 'Einzug'} zum ${deDate(k.collection_date)}</h2>
      ${fresh ? `<div class="banner g"><span>Einzug erstellt${k.kind === 'getraenke' ? ', die Verkaufskonten sind abgerechnet' : ''}. Jetzt <b>1.</b> die Vorabinformation verschicken, <b>2.</b> die SEPA-Datei herunterladen und im Online-Banking hochladen. Kam nach 1–2 Wochen nichts zurück: „Zahlung erfolgt“.</span></div>` : ''}
      <div class="row" style="gap:6px;margin:-4px 0 12px">${pill(k.status === 'gebucht' ? ['g', 'verbucht'] : k.status === 'verworfen' ? ['', 'verworfen'] : ['a', 'erstellt'])}<span class="pill">${k.count} Lastschriften · ${euro(k.cents)}</span>${k.prenotified_at ? `<span class="pill g">Vorabinfo ${deTime(k.prenotified_at)}</span>` : '<span class="pill a">Vorabinfo fehlt</span>'}</div>
      <div class="toolbar"><a class="btn primary" href="${BASE}collections/${id}/xml" download>SEPA-Datei herunterladen</a><button class="btn" id="kMail">Vorabinformation per E-Mail</button><a class="btn" href="${BASE}collections/${id}/letters.pdf" target="_blank">Briefe für Mitglieder ohne E-Mail</a>
        ${open ? '<button class="btn" id="kBooked">Zahlung erfolgt (alle ohne Rücklastschrift)</button><button class="btn danger" id="kDel">Verwerfen</button>' : ''}</div>
      ${open ? '<p class="muted s" style="margin:0 0 10px">Erst buchen, wenn keine Rücklastschrift mehr kommt (meist nach 1–2 Wochen). Rückläufer vorher unten beim Zahler erfassen. Einzelne Posten lassen sich auch unter „Offene Posten → Im Einzug“ buchen.</p>' : ''}
      <div class="scroll" style="max-height:56vh"><table class="tbl"><tr><th>Zahler</th><th>E-Mail</th><th>Posten</th><th class="r">Betrag</th><th></th></tr>
        ${k.rows.map(r => `<tr class="${r.returned ? 'off' : ''}"><td><b>${esc(GK.lastFirst(r.name))}</b>${r.member_no ? `<div class="muted s">Nr. ${esc(r.member_no)}</div>` : ''}</td><td class="s">${esc(r.email || '–')}</td><td class="s" translate="no">${esc(r.texts)}</td><td class="r">${euro(r.cents)}</td>
          <td class="r">${k.status !== 'verworfen' ? `<button class="btn small danger" data-ret="${r.member_id}">Rücklastschrift</button>` : ''}</td></tr>`).join('')}
        ${k.returnedOnly.map(r => `<tr class="off"><td><b>${esc(GK.lastFirst(r.name))}</b></td><td></td><td class="s">zurückgebucht</td><td></td><td></td></tr>`).join('')}</table></div>
      <div class="btns"><button class="btn primary" id="c">Schließen</button></div>`, true);
    $('c').onclick = () => { closeDialog(); again(); };
    const back = () => collectionDetail(id, again).catch(fail);
    $('kMail').onclick = () => confirmIn(`Vorabinformation an ${k.rows.filter(r => r.email).length} Zahler schicken?`, `Jede/r bekommt Betrag, Termin, Mandatsreferenz und Gläubiger-ID.${k.rows.some(r => !r.email) ? ` ${k.rows.filter(r => !r.email).length} ohne E-Mail – für sie gibt es die Briefe als PDF.` : ''}`, 'Senden', async () => {
      try { const r = await api(`collections/${id}/prenotify`, 'POST', {}); toast(`${r.sent} E-Mails verschickt${r.missing.length ? `, ${r.missing.length} ohne E-Mail` : ''}${r.failed.length ? `, ${r.failed.length} fehlgeschlagen` : ''}.`, r.failed.length > 0); back(); } catch (e) { fail(e); }
    }, back, { safe: true });
    if ($('kBooked')) $('kBooked').onclick = () => confirmIn('Zahlung erfolgt?', 'Alle Lastschriften dieses Einzugs ohne Rücklastschrift werden als bezahlt gebucht.', 'Buchen', async () => {
      try { await api(`collections/${id}/booked`, 'POST', { date: val('kbD') || undefined }); toast('Verbucht.'); back(); } catch (e) { fail(e); }
    }, back, { safe: true, html: `<label class="f">Datum der Gutschrift auf dem Vereinskonto<input id="kbD" type="date" value="${esc(st.meta.today)}"></label>` });
    if ($('kDel')) $('kDel').onclick = () => {
      const runs = k.runs.filter(r => r.undo), drinks = runs.some(r => r.kind === 'getraenke');
      dialog(`<h2>Einzug verwerfen?</h2><p class="muted" style="margin-top:0">Nur, wenn die SEPA-Datei <b>nicht</b> bei der Bank eingereicht wurde. Alle Posten werden wieder offen.</p>
        ${runs.length ? `<label class="chk" style="margin-top:4px"><input type="checkbox" id="kdRun" checked> Auch ${runs.length === 1 ? 'den Lauf' : `die ${runs.length} Läufe`} zurücknehmen (${runs.map(r => `${r.kind === 'getraenke' ? 'Verkauf' : 'Beiträge'} vom ${deDate(r.created_at.slice(0, 10))}`).join(', ')})</label>
          <p class="muted s">${drinks ? 'Dann sind die Verkaufskonten wieder offen und die Buchungen lassen sich im Verkauf normal stornieren. ' : ''}Ohne Haken bleiben die Posten offen und kommen in den nächsten Einzug.</p>` : ''}
        <div class="btns"><button class="btn ghost" id="c2">Abbrechen</button><button class="btn danger" id="kdOk">Verwerfen</button></div>`);
      $('c2').onclick = back;
      $('kdOk').onclick = () => GK.busy($('kdOk'), async () => {
        try { const r = await api(`collections/${id}${$('kdRun') && $('kdRun').checked ? '?runs=1' : ''}`, 'DELETE'); closeDialog(); toast(r.runs ? 'Einzug verworfen und Lauf zurückgenommen.' : 'Verworfen.'); again(); } catch (e) { fail(e); }
      });
    };
    document.querySelectorAll('[data-ret]').forEach(b => { b.onclick = () => {
      const r = k.rows.find(x => x.member_id === +b.dataset.ret);
      dialog(`<h2>Rücklastschrift ${esc(GK.lastFirst(r.name))}</h2><p class="muted" style="margin-top:0">${euro(r.cents)} – die Posten werden wieder offen.</p>
        <div class="mv-grid" style="--c:2"><label class="f">Grund<select id="rtR">${['Rücklastschrift', 'Widerspruch', 'Konto erloschen', 'mangelnde Deckung', 'Mandat fehlt'].map(x => opt(x, x)).join('')}</select></label>
          <label class="f">Gebühr weiterberechnen<input id="rtF" inputmode="decimal" value="${centsToInput(st.meta.settings.return_fee_cents)}"></label></div>
        <label class="chk" style="margin-top:12px"><input type="checkbox" id="rtM"> Mandat sperren (keine weiteren Lastschriften)</label>
        <div class="btns"><button class="btn ghost" id="c2">Abbrechen</button><button class="btn danger" id="rtOk">Rücklastschrift erfassen</button></div>`);
      $('c2').onclick = back;
      $('rtOk').onclick = () => GK.busy($('rtOk'), async () => { try { await api(`collections/${id}/return`, 'POST', { member_id: r.member_id, reason: val('rtR'), fee_cents: toCents(val('rtF') || '0'), revokeMandate: $('rtM').checked }); toast('Erfasst.'); back(); } catch (e) { fail(e); } });
    }; });
  }

  async function finDunning(el, again) {
    st.dd = st.dd ?? 14;
    const rows = await api('dunning?days=' + st.dd);
    const all = await api('charges?status=offen');
    const payers = [...new Set(all.rows.map(c => c.member_id))].map(id => { const list = all.rows.filter(c => c.member_id === id); return { id, name: list[0].payer_name, payment: list[0].payment, cents: list.reduce((s, c) => s + c.cents, 0), n: list.length }; }).filter(p => p.cents > 0 && p.payment !== 'lastschrift');
    el.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;flex:1 1 180px;min-width:0;line-height:1.25">Rechnungen (Zahlungsart Rechnung/bar)</h3><button class="btn" id="iSend" ${payers.length ? '' : 'disabled'}>Ausgewählte per E-Mail senden</button></div>
        ${payers.length ? `<table class="tbl kompakt"><tr><th>Zahler</th><th class="r">Posten</th><th class="r">offen</th><th></th></tr>${payers.map(p => `<tr><td><label class="chk"><input type="checkbox" data-inv="${p.id}" checked aria-label="auswählen"> <b>${esc(GK.lastFirst(p.name))}</b></label></td><td class="r k-lbl" data-label="Posten">${p.n}</td><td class="r">${euro(p.cents)}</td>
          <td class="r"><a class="btn small" href="${BASE}invoice.pdf?member=${p.id}" target="_blank">PDF</a></td></tr>`).join('')}</table>` : '<p class="empty">Keine offenen Rechnungen.</p>'}</div>
      <div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;flex:1 1 180px;min-width:0;line-height:1.25">Mahnungen</h3>
          <div class="row"><select id="dDays" data-nodirty aria-label="Überfällig seit" style="width:auto">${[0, 7, 14, 30, 60].map(n => opt(n, n ? `Überfällig seit mehr als ${n} Tagen` : 'Alle überfälligen', st.dd)).join('')}</select><button class="btn" id="dSend" ${rows.length ? '' : 'disabled'}>Ausgewählte mahnen</button></div></div>
        ${rows.length ? `<table class="tbl kompakt"><tr><th>Zahler</th><th>älteste Fälligkeit</th><th>Mahnstufe</th><th class="r">Posten</th><th class="r">offen</th><th></th></tr>
          ${rows.map(r => `<tr><td><label class="chk"><input type="checkbox" data-dun="${r.member_id}" checked aria-label="auswählen"> <b>${esc(GK.lastFirst(r.name))}</b></label>${r.email ? '' : ' <span class="pill a">keine E-Mail</span>'}</td><td class="nw k-lbl" data-label="seit">${deDate(r.oldest)}</td><td class="k-lbl" data-label="Mahnstufe">${r.level ? `${r.level}. ${r.dunned_at ? '· ' + deDate(r.dunned_at) : ''}` : '–'}</td><td class="r k-lbl" data-label="Posten">${r.n}</td><td class="r">${euro(r.cents)}</td>
            <td class="r"><a class="btn small" href="${BASE}invoice.pdf?member=${r.member_id}&dunning=${(r.level || 0) + 1}" target="_blank">PDF</a></td></tr>`).join('')}</table>` : '<p class="empty">Nichts zu mahnen.</p>'}
        <p class="muted s" style="margin-bottom:0">Erste Stufe = freundliche Zahlungserinnerung, ab der zweiten Mahnung kommt die Mahngebühr aus den Einstellungen dazu (${euro(st.meta.settings.dunning_fee_cents)}).</p></div>`;
    $('dDays').onchange = () => { st.dd = +val('dDays'); finDunning(el, again).catch(fail); };
    const send = async (attr, dunning) => {
      const ids = [...el.querySelectorAll(`[data-${attr}]`)].filter(c => c.checked).map(c => +c.dataset[attr]);
      if (!ids.length) return;
      if (!await ask(`${dunning ? 'Mahnungen' : 'Rechnungen'} an ${ids.length} Zahler senden?\n\nJede/r bekommt eine E-Mail mit PDF.`, { ok: 'Senden', danger: false })) return;
      try { const r = await api('invoices/send', 'POST', { member_ids: ids, dunning }); toast(`${r.sent} verschickt${r.missing.length ? `, ${r.missing.length} ohne E-Mail (${r.missing.join(', ')})` : ''}.`, r.missing.length > 0 || r.failed.length > 0); finDunning(el, again).catch(fail); } catch (e) { fail(e); }
    };
    $('iSend').onclick = () => send('inv', false);
    $('dSend').onclick = () => send('dun', true);
  }

  /* ================================================================= Auswertungen */
  async function showReports(el) {
    st.day = st.day || st.meta.today;
    const s = await api('stats?day=' + st.day);
    const G = { m: 'männlich', w: 'weiblich', d: 'divers', x: 'ohne Angabe' };
    const sum = r => r.m + r.w + r.d + r.x;
    el.innerHTML = `<div class="filterbar"><label class="f" style="flex-direction:row;align-items:center;gap:8px">Stichtag<input id="rpDay" type="date" value="${s.day}" data-nodirty></label></div>
      <div class="kpis"><div class="kpi"><div class="l">Mitglieder am ${deDate(s.day)}</div><div class="v">${s.count}</div></div>
        <div class="kpi"><div class="l">Durchschnittsalter</div><div class="v">${s.avgAge != null ? String(s.avgAge).replace('.', ',') : '–'}</div></div>
        ${s.byGender.filter(g => g.g !== 'x' || g.n).slice(0, 2).map(g => `<div class="kpi"><div class="l">${G[g.g]}</div><div class="v">${g.n}</div></div>`).join('')}</div>
      <div class="mv-two">
        <div class="card"><h3>Abteilungen</h3>${s.depts.length ? `<table class="tbl kompakt">${s.depts.map(d => `<tr><td><b translate="no">${esc(d.name)}</b></td><td class="r k-lbl" data-label="Mitglieder">${d.n}</td></tr>`).join('')}</table>` : '<p class="empty">Keine Abteilungen angelegt.</p>'}</div>
        <div class="card"><h3>Ein- und Austritte</h3><table class="tbl kompakt"><tr><th>Jahr</th><th class="r">Eintritte</th><th class="r">Austritte</th><th class="r">Saldo</th></tr>
          ${s.years.slice().reverse().filter(y => y.in || y.out || y.year >= +s.day.slice(0, 4) - 2).map(y => `<tr><td>${y.year}</td><td class="r k-lbl" data-label="Eintritte">${y.in}</td><td class="r k-lbl" data-label="Austritte">${y.out}</td><td class="r k-lbl ${y.in - y.out < 0 ? 'neg' : ''}" data-label="Saldo">${y.in - y.out > 0 ? '+' : ''}${y.in - y.out}</td></tr>`).join('')}</table></div></div>
      <div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;flex:1 1 180px;min-width:0;line-height:1.25">Bestandserhebung (Landessportbund)</h3><a class="btn" href="${BASE}stats/lsb.xlsx?day=${s.day.slice(0, 4)}-01-01">Excel zum 01.01.${s.day.slice(0, 4)}</a></div>
        <table class="tbl kompakt mv-lsb"><tr><th>Altersgruppe</th><th>Männlich</th><th>Weiblich</th><th>Divers</th><th>Ohne Angabe</th><th>Gesamt</th></tr>
          ${s.lsb.groups.map((g, i) => { const t = s.lsb.total[i], c = (n, l, hide) => `<td class="k-lbl${hide && !n ? ' k-weg' : ''}" data-label="${l}">${n}</td>`; return `<tr><td>${esc(g)}</td>${c(t.m, 'Männlich')}${c(t.w, 'Weiblich')}${c(t.d, 'Divers', 1)}${c(t.x, 'Ohne Angabe', 1)}<td class="k-lbl" data-label="Gesamt"><b>${sum(t)}</b></td></tr>`; }).join('')}</table>
        ${s.lsb.noBirth ? `<p class="muted s">${s.lsb.noBirth} ${s.lsb.noBirth === 1 ? 'Mitglied ohne Geburtsdatum ist' : 'Mitglieder ohne Geburtsdatum sind'} nicht enthalten.</p>` : ''}</div>
      <div class="card"><h3>Runde Geburtstage & Jubiläen <span class="muted s">(12 Monate)</span></h3>${s.events.length ? `<table class="tbl kompakt"><tr><th>Name</th><th>Datum</th><th>Anlass</th><th class="r">Jahre</th></tr>${s.events.map(e => `<tr><td><b translate="no">${esc(GK.lastFirst(e.name))}</b></td><td class="num nw">${deDate(e.date)}</td><td>${esc(e.kind)}</td><td class="r nw">${e.n}${e.kind === 'Geburtstag' ? ' Jahre' : ' Jahre Mitglied'}</td></tr>`).join('')}</table>` : '<p class="empty">Keine runden Geburtstage oder Jubiläen.</p>'}</div>`;
    $('rpDay').onchange = () => { st.day = val('rpDay'); showReports(el).catch(fail); };
  }

  /* ================================================================= Beiträge & Abteilungen (Stammdaten) */
  function catalogCards(el, again) {
    const m = st.meta;
    const grund = m.fees.filter(f => f.kind !== 'zusatz'), zus = m.fees.filter(f => f.kind === 'zusatz');
    const ageTxt = (f, none) => (f.age_min != null && f.age_max == null ? `ab ${f.age_min}` : f.age_max != null && !f.age_min ? `bis ${f.age_max}` : f.age_min != null || f.age_max != null ? `${f.age_min}–${f.age_max}` : none);
    el.innerHTML = `<div class="card"><h3>Beiträge Hauptverein</h3>
        ${grund.length ? `<table class="tbl kompakt"><tr><th>Bezeichnung</th><th class="r">Betrag</th><th>Rhythmus</th><th>Alter</th><th>Familie</th><th>Arbeitsstunden</th><th>Formular</th><th class="r">Mitglieder</th><th></th></tr>
          ${grund.map(f => `<tr class="${f.active ? '' : 'off'}"><td><b translate="no">${esc(f.name)}</b>${f.department_id ? `<div class="muted s">${esc((m.depts.find(d => d.id === f.department_id) || {}).name || '')}</div>` : ''}</td><td class="r">${euro(f.cents)}</td><td>${esc(INTERVAL[f.interval])}${f.interval === 'einmalig' ? '' : ` <span class="muted s">${esc(PRS[f.prorate] || '')}</span>`}</td>
            <td class="nw">${ageTxt(f, '–')}</td><td class="k-weg">${f.family ? '<span class="pill g">ja</span>' : '–'}</td><td class="k-weg">${f.work_minutes === 0 ? 'keine' : f.work_minutes ? (f.work_minutes / 60).toLocaleString('de-DE') + ' h' : 'Vorgabe'}</td>
            <td class="k-weg">${f.on_form ? '✓' : '–'}</td><td class="r k-lbl" data-label="Mitglieder">${f.members == null ? '' : f.members}</td><td class="r nw"><span class="toact"><button class="btn small" data-fmv="${f.id}:-1" aria-label="nach oben" title="nach oben">↑</button><button class="btn small" data-fmv="${f.id}:1" aria-label="nach unten" title="nach unten">↓</button></span> <button class="btn small" data-fe="${f.id}">Bearbeiten</button></td></tr>`).join('')}</table><p class="muted s" style="margin:10px 0 0">Mit ↑ ↓ legst du die Reihenfolge fest – so erscheinen die Beitragsarten auch in Auswahlfeldern und auf der Beitrittserklärung.</p>`
          : '<p class="empty">Noch keine Beitragsart – oben „+ Beitragsart“, z. B. „Erwachsene ab 19 Jahre“, „Jugendliche 12–18“ oder „Familie“. Oder die Mitglieder per „Import …“ übernehmen (S-Verein, WISO Mein Verein, verein.cloud).</p>'}</div>
      <div class="card"><h3>Zusatzbeiträge der Abteilungen</h3>
        ${zus.length ? `<table class="tbl kompakt"><tr><th>Abteilung</th><th>Bezeichnung</th><th>Alter</th><th class="r">Betrag</th><th>Rhythmus</th><th class="r">Mitglieder</th><th></th></tr>
          ${zus.map(f => `<tr class="${f.active ? '' : 'off'}"><td><b translate="no">${esc((m.depts.find(d => d.id === f.department_id) || {}).name || '')}</b></td><td translate="no">${esc(f.name)}</td>
            <td class="nw">${ageTxt(f, 'alle')}</td><td class="r">${euro(f.cents)}</td><td>${esc(INTERVAL[f.interval])} <span class="muted s">${esc(PRS[f.prorate] || '')}</span></td>
            <td class="r k-lbl" data-label="Mitglieder">${f.members == null ? '' : f.members}</td><td class="r"><button class="btn small" data-fe="${f.id}">Bearbeiten</button></td></tr>`).join('')}</table>`
          : '<p class="empty">Noch kein Zusatzbeitrag – z. B. Abteilung Padel: „Padel Erwachsene“ ab 19 Jahre 60 €, „Padel Jugend“ bis 18 Jahre 30 €. Jede Person in der Abteilung zahlt den Beitrag ihres Alters zusätzlich zum Beitrag des Hauptvereins, in Familien der Hauptzahler.</p>'}</div>
      <div class="card"><h3>Abteilungen</h3>
        ${m.depts.length ? `<table class="tbl kompakt"><tr><th>Abteilung</th><th>Verband</th><th class="r">Mitglieder</th><th></th></tr>${m.depts.map(d => `<tr class="${d.active ? '' : 'off'}"><td><b translate="no">${esc(d.name)}</b></td><td>${esc(d.federation || '')}</td><td class="r k-lbl" data-label="Mitglieder">${d.members == null ? '' : d.members}</td>
          <td class="r nw"><button class="btn small" data-de="${d.id}">Bearbeiten</button></td></tr>`).join('')}</table>` : '<p class="empty">Noch keine Abteilung – oben „+ Abteilung“ anlegen.</p>'}</div>`;
    GK.tabTools(`<button class="btn" id="dNew">+ Abteilung</button><button class="btn" id="zNew" ${m.depts.length ? '' : 'disabled'}>+ Zusatzbeitrag</button><button class="btn primary" id="fNew">+ Beitragsart</button>`, el);
    $('fNew').onclick = () => feeEdit(null, again);
    $('zNew').onclick = () => feeEdit(null, again, { kind: 'zusatz' });
    el.querySelectorAll('[data-fmv]').forEach(b => { b.onclick = () => GK.busy(b, async () => {
      const [id, d] = b.dataset.fmv.split(':').map(Number), ids = m.fees.filter(f => f.kind !== 'zusatz').map(f => f.id), i = ids.indexOf(id), j = i + d;
      if (i < 0 || j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      try { await api('fees/order', 'PUT', { ids }); again(); } catch (e) { fail(e); } }); });
    el.querySelectorAll('[data-fe]').forEach(b => { b.onclick = () => feeEdit(m.fees.find(f => f.id === +b.dataset.fe), again); });
    const deptEdit = d => {
      dialog(`<h2>${d ? 'Abteilung bearbeiten' : 'Neue Abteilung'}</h2><div class="mv-grid" style="--c:2"><label class="f">Name<input id="dnN" value="${esc(d ? d.name : '')}"></label><label class="f">Fachverband (optional)<input id="dnF" value="${esc(d ? d.federation || '' : '')}" placeholder="z. B. Hessischer Tennis-Verband"></label>
        <label class="f">Reihenfolge<input id="dnS" value="${d ? d.sort : 0}" inputmode="numeric"></label>${d ? `<label class="chk" style="align-self:end;height:40px"><input type="checkbox" id="dnA" ${d.active ? 'checked' : ''}> Aktiv (zur Auswahl angeboten)</label>` : ''}</div>
        ${d && d.members === 0 ? '<div class="row" style="margin-top:12px"><button class="btn danger" id="dnDel">Abteilung löschen …</button></div>' : ''}
        <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="dnOk">Speichern</button></div>`);
      $('c').onclick = closeDialog;
      if ($('dnDel')) $('dnDel').onclick = () => confirmIn(`Abteilung „${d.name}“ löschen?`, 'Sie hat keine Mitglieder mehr und verschwindet aus allen Auswahlfeldern.', 'Abteilung löschen', async () => {
        try { await api('departments/' + d.id, 'DELETE'); closeDialog(); again(); } catch (e) { fail(e); }
      }, () => deptEdit(d));
      $('dnOk').onclick = () => GK.busy($('dnOk'), async () => { const body = { name: val('dnN'), federation: val('dnF'), sort: +val('dnS') || 0, ...(d ? { active: $('dnA').checked } : {}) };
        try { if (d) await api('departments/' + d.id, 'PUT', body); else await api('departments', 'POST', body); closeDialog(); again(); } catch (e) { fail(e); } });
    };
    $('dNew').onclick = () => deptEdit(null);
    el.querySelectorAll('[data-de]').forEach(b => { b.onclick = () => deptEdit(m.depts.find(d => d.id === +b.dataset.de)); });
  }

  /* ================================================================= Einstellungen */
  const foot = id => `<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn primary" id="${id}">Speichern</button></div>`;
  /** „Speichern“ einer Karte: schreibt nur ihre eigenen Felder, danach die Seite neu zeichnen */
  const saveCard = redraw => (btn, body) => { $(btn).onclick = () => GK.busy($(btn), async () => {
    try { await api('settings', 'PUT', body()); GK.clean(); toast('Gespeichert.'); redraw().catch(fail); } catch (e) { fail(e); }
  }); };
  /** Mitglieder › Einstellungen: Karten untereinander, je Thema ein „Speichern“ (Reihenfolge nach planung/menues.md 3.1): Mitgliedschaft · Beitrittserklärung & Online-Antrag ·
   *  „Meine Daten“ in der App · Benachrichtigungen · Datenschutz & Aufbewahrung · Einstellungen übertragen */
  async function showSettings(el) {
    await loadMeta();
    const s = st.meta.settings;
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    el.innerHTML = `<div class="card" data-set="mitgliedschaft"><h3>Mitgliedschaft</h3><div class="mv-grid" style="--c:3">
        <label class="f">Mitgliedsnummern ab<input id="eNo" value="${esc(s.member_no_start)}" inputmode="numeric"></label>
        <label class="f">Beitragsjahr beginnt am 1.<select id="eYear">${months.map((n, i) => opt(`${String(i + 1).padStart(2, '0')}-01`, n, s.year_start)).join('')}</select></label>
        <label class="f">Kündigungsfrist (Monate)<input id="eNotice" value="${s.notice_months}" inputmode="numeric"></label></div>
        <div class="mv-cons" style="margin-top:14px">
          <label class="chk" style="align-items:flex-start"><input type="checkbox" id="eSepaReq" ${s.sepa_required ? 'checked' : ''} style="margin-top:3px;flex:none"> <span><b>Lastschrift ist Pflicht</b><br><span class="muted s">Neue Mitglieder brauchen dann Bankverbindung und SEPA-Mandat, „Rechnung“ und „bar“ lassen sich nicht mehr wählen. Ausgenommen sind Familienmitglieder und wer über einen Zahler zahlt. Bestehende Mitglieder mit anderer Zahlart erscheinen unter „Mit Hinweis“.</span></span></label>
          <label class="chk" style="align-items:flex-start"><input type="checkbox" id="eScope" ${s.scope_confirm ? 'checked' : ''} style="margin-top:3px;flex:none"> <span><b>Ein- und Austritte der Abteilungsleitungen bestätigt die Vereinsverwaltung</b><br><span class="muted s">Legt eine Abteilungsleitung ein neues Mitglied an, trägt einen Austritt oder eine Rückkehr ein oder nimmt eine Beitrittserklärung an, landet das unter „Anträge“ und gilt erst nach Bestätigung durch einen Admin. Bis dahin ist ein neues Mitglied nicht am Tablet und nicht im Beitragslauf.</span></span></label></div>
        ${foot('eSaveMs')}</div>
      <div class="card" data-set="antrag"><h3>Beitrittserklärung & Online-Antrag</h3><div class="mv-cons" style="margin-bottom:14px">
          <label class="chk"><input type="checkbox" id="eTab" ${s.app_tablet ? 'checked' : ''}> Am Tablet: „Mitglied werden“ (selbst ausfüllen und unterschreiben, oder mit Code aus der Verwaltung)</label>
          <label class="chk"><input type="checkbox" id="eOnl" ${s.app_online ? 'checked' : ''}> <span>Online über die Adresse der Mitglieder-App (<code>/p/mitglieder/</code>)</span></label></div>
        <div class="mv-grid" style="--c:2">
          <label class="f wall">Begrüßung oben im Formular<textarea id="eIntro" style="min-height:70px">${esc(s.app_intro)}</textarea></label>
          <label class="f">Hinweis zu Beitrag & Fälligkeit<textarea id="eDue" style="min-height:70px" placeholder="z. B. Der Jahresbeitrag wird zum 01.05. eingezogen, die Getränkekasse zum 01.12.">${esc(s.due_text)}</textarea></label>
          <label class="f">Hinweis Arbeitseinsatz<textarea id="eWork" style="min-height:70px" placeholder="z. B. Jedes Mitglied leistet 4 Arbeitsstunden im Jahr …">${esc(s.work_text)}</textarea></label>
          <label class="f wall">Satzung (Link, optional)<input id="eSatz" value="${esc(s.satzung_url)}" placeholder="https://…"></label></div>
        <div class="mv-sub" style="margin-top:18px">Einwilligungen</div>
        <div id="eCons">${s.consents.map((c, i) => consentRow(c, i)).join('')}</div>
        <div class="row" style="justify-content:space-between;margin-top:10px"><button class="btn" id="eConsAdd">+ Einwilligung</button><button class="btn primary" id="eSave2">Speichern</button></div></div>
      <div class="card" id="eApp" data-set="meinedaten"></div>
      <div class="card" data-set="benachrichtigung"><h3>Benachrichtigungen</h3><div class="mv-grid" style="--c:2">
        <label class="f">Neue Anträge & App-Änderungen melden an<input id="eNotify" value="${esc(s.notify_to)}" placeholder="vorstand@verein.de, kasse@verein.de"></label></div>
        <p class="muted s" style="margin:8px 0 0">Mehrere Adressen mit Komma trennen.</p>${foot('eSaveNot')}</div>
      <div class="card" id="eCg" data-set="gratulationen"></div>
      <div class="card" data-set="daten"><h3>Datenschutz & Aufbewahrung</h3><p class="muted s" style="margin-top:0">Nach dem Austritt werden Mitgliedsdaten noch für Beiträge, Spendenquittungen und gesetzliche Fristen gebraucht (Kassenbelege meist 10 Jahre). Danach im Mitglied „Anonymisieren“. Jede Person kann eine Datenauskunft verlangen (Knopf im Mitglied).</p>
        <div class="mv-grid" style="--c:4"><label class="f w2">Erinnern nach … Jahren (0 = aus)<input id="eRet2" value="${s.retention_years}" inputmode="numeric"></label></div>${foot('eSaveDat')}</div>
      <div id="eFunc" data-set="uebertragen"></div>`;
    GK.watch(el);
    appDataCard($('eApp')).catch(fail);
    congratsCard($('eCg')).catch(fail);
    if (GK.funcBox) GK.funcBox($('eFunc'), 'mitglieder', 'Mitglieder', () => showSettings(el));
    const save = saveCard(() => showSettings(el));
    save('eSaveMs', () => ({ member_no_start: val('eNo'), year_start: val('eYear'), notice_months: +val('eNotice'), sepa_required: $('eSepaReq').checked, scope_confirm: $('eScope').checked }));
    const consents = () => [...document.querySelectorAll('#eCons [data-c]')].map(r => ({ key: r.dataset.c, short: r.querySelector('[data-k=short]').value, text: r.querySelector('[data-k=text]').value, required: r.querySelector('[data-k=req]').checked }));
    const bindCons = () => document.querySelectorAll('#eCons [data-cx]').forEach(b => { b.onclick = () => b.closest('[data-c]').remove(); });
    bindCons();
    $('eConsAdd').onclick = () => { $('eCons').insertAdjacentHTML('beforeend', consentRow({ key: 'e' + Date.now().toString(36).slice(-5), short: '', text: '', required: false })); bindCons(); };
    save('eSave2', () => ({ app_tablet: $('eTab').checked, app_online: $('eOnl').checked, app_intro: $('eIntro').value, due_text: $('eDue').value, work_text: $('eWork').value, satzung_url: val('eSatz'), consents: consents() }));
    save('eSaveNot', () => ({ notify_to: val('eNotify') }));
    save('eSaveDat', () => ({ retention_years: +val('eRet2') }));
  }
  /** Beiträge & Zahlungen › Einstellungen: Lastschrift (SEPA) · Rechnungen & Mahnungen · Einstellungen übertragen (dieselben Schlüssel wie bisher unter Mitglieder) */
  async function showPaySettings(el) {
    await loadMeta();
    const s = st.meta.settings, m = st.meta;
    const acc = await GK.api('bank-accounts').catch(() => ({ rows: [], manage: false }));
    const ad = m.club || {};
    const addr = [[ad.street, ad.city].filter(Boolean).join(', '), ad.email, ad.phone].filter(Boolean).map(esc).join(' · ');
    el.innerHTML = `<div class="card" data-set="sepa"><h3>Lastschrift (SEPA)</h3><div class="mv-grid" style="--c:4">
        <label class="f w2">Name als Zahlungsempfänger<input id="eName" value="${esc(s.creditor_name)}" maxlength="70"></label>
        <div class="f w2"><span>Vereinsanschrift</span><div class="mv-addr">${addr || '<span class="muted">noch nicht eingetragen</span>'}</div><span class="muted s">ändern unter <a href="#einstellungen" id="eAddrGo">Einstellungen › Verein</a></span></div>
        <label class="f">Gläubiger-ID<input id="eCi" value="${esc(s.creditor_id)}" placeholder="DE98ZZZ09999999999" spellcheck="false"></label>
        <label class="f w2">Konto für Lastschriften<select id="eAcc" ${m.perms.finance && acc.rows.length ? '' : 'disabled'}>${acc.rows.length ? `${opt('', 'Standardkonto' + (acc.rows.find(a => a.is_default) ? ` (${acc.rows.find(a => a.is_default).name})` : ''), s.sepa_account || '')}${acc.rows.filter(a => a.active !== false).map(a => opt(a.id, `${a.name} · ${fmtIban(a.iban).slice(0, 4)} … ${String(a.iban).replace(/\s/g, '').slice(-4)}`, s.sepa_account)).join('')}` : `<option>${s.club_iban && !s.account_central ? esc(fmtIban(s.club_iban)) + ' (bisher hier eingetragen)' : 'noch kein Bankkonto angelegt'}</option>`}</select></label>
        <label class="f"><span>&nbsp;</span><a class="btn" href="#einstellungen" id="eAccGo" style="justify-content:center">Bankkonten verwalten …</a></label>
        <label class="f">Mandatsreferenz = Kürzel + Nr.<input id="ePre" value="${esc(s.mandate_prefix)}" maxlength="10" placeholder="z. B. TCM"></label>
        <label class="f">Vorabinformation (Tage vorher)<input id="ePre2" value="${s.prenotify_days}" inputmode="numeric"></label>
        <label class="f">Verkaufs-Einzug üblich am (TT.MM.)<input id="eDrinks" value="${esc(s.drinks_due ? s.drinks_due.split('-').reverse().join('.') : '')}" placeholder="z. B. 01.12."></label>
        <label class="f">Gebühr Rücklastschrift<input id="eRet" value="${centsToInput(s.return_fee_cents)}" inputmode="decimal"></label></div>
        <p class="muted s" style="margin:12px 0 0">Die Gläubiger-ID bekommt der Verein von der Bundesbank. Die Mandatsreferenz jedes Mitglieds besteht aus dem Kürzel und seiner Mitgliedsnummer.</p>
        ${s.club_iban && !s.club_bic ? `<div class="banner g" style="margin-top:12px"><span>${BIC_HINT}</span></div>` : ''}${foot('eSaveSepa')}</div>
      <div class="card" data-set="rechnung"><h3>Rechnungen & Mahnungen</h3><div class="mv-grid" style="--c:4">
        <label class="f">Mahngebühr (ab 2. Mahnung)<input id="eDun" value="${centsToInput(s.dunning_fee_cents)}" inputmode="decimal"></label>
        <label class="f w2">Zusatz auf Rechnungen (optional)<input id="eInv" value="${esc(s.invoice_text)}" placeholder="z. B. Steuernummer, Vereinsregister"></label></div>${foot('eSaveInv')}</div>
      <div id="eFunc" data-set="uebertragen"></div>`;
    GK.watch(el);
    if (GK.funcBox) GK.funcBox($('eFunc'), 'mitglieder', 'Mitglieder', () => showPaySettings(el));
    const save = saveCard(() => showPaySettings(el));
    if ($('eAccGo')) $('eAccGo').onclick = e => { e.preventDefault(); if (GK.openSettings) GK.openSettings('bank'); else GK.go('einstellungen'); };
    if ($('eAddrGo')) $('eAddrGo').onclick = e => { e.preventDefault(); if (GK.openSettings) GK.openSettings('verein'); else GK.go('einstellungen'); };
    save('eSaveSepa', () => {
      const dd = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(val('eDrinks'));
      return { creditor_name: val('eName'), creditor_id: val('eCi'), ...(m.perms.finance && $('eAcc') && !$('eAcc').disabled ? { sepa_account: val('eAcc') ? +val('eAcc') : null } : {}),
        mandate_prefix: val('ePre'), prenotify_days: +val('ePre2'), drinks_due: dd ? `${dd[2].padStart(2, '0')}-${dd[1].padStart(2, '0')}` : '', return_fee_cents: toCents(val('eRet') || '0') };
    });
    save('eSaveInv', () => ({ dunning_fee_cents: toCents(val('eDun') || '0'), invoice_text: val('eInv') }));
  }
  const consentRow = (c, i) => `<div class="mv-cons-ed" data-c="${esc(c.key)}"><label class="f">Kurzname<input data-k="short" value="${esc(c.short)}" placeholder="z. B. Homepage"></label><label class="f">Text auf dem Formular<textarea data-k="text" rows="2">${esc(c.text)}</textarea></label>
    <label class="chk"><input type="checkbox" data-k="req" ${c.required ? 'checked' : ''}> Pflicht</label><button class="btn small danger" data-cx="${i}">Entfernen</button></div>`;

  function feeEdit(f, after, preset = {}) {
    const m = st.meta;
    const kind = f ? f.kind || 'grund' : preset.kind || 'grund';
    dialog(`<h2>${f ? 'Beitragsart bearbeiten' : kind === 'zusatz' ? 'Neuer Zusatzbeitrag' : 'Neue Beitragsart'}</h2><div class="mv-grid" style="--c:3">
      <label class="f">Art<select id="feK">${opt('grund', 'Beitrag Hauptverein', kind)}${opt('zusatz', 'Zusatzbeitrag einer Abteilung', kind)}</select></label>
      <label class="f w2" id="feDL">Abteilung<select translate="no" id="feD"><option value="">${esc(GK.T('Hauptverein'))}</option>${m.depts.map(d => opt(d.id, d.name, f ? f.department_id : preset.department_id)).join('')}</select></label>
      <label class="f w2">Bezeichnung (wie auf dem Formular)<input id="feN" value="${esc(f ? f.name : '')}" placeholder="z. B. Erwachsene ab 19 Jahre"></label>
      <label class="f">Betrag (€)<input id="feC" inputmode="decimal" value="${f ? centsToInput(f.cents) : ''}"></label>
      <label class="f">Rhythmus<select id="feI">${Object.entries(INTERVAL).map(([k, l]) => opt(k, l, f ? f.interval : 'jahr')).join('')}</select></label>
      <label class="f">Im Eintrittsjahr<select id="feP">${Object.entries(PRORATE).map(([k, l]) => opt(k, l, f && f.prorate)).join('')}</select></label>
      <label class="f" id="feWL">Arbeitsstunden im Jahr<input id="feW" inputmode="decimal" value="${f && f.work_minutes != null ? String(f.work_minutes / 60).replace('.', ',') : ''}" placeholder="Vorgabe des Moduls"></label>
      <label class="f">Mindestalter<input id="feA1" inputmode="numeric" value="${f && f.age_min != null ? f.age_min : ''}" placeholder="–"></label>
      <label class="f">Höchstalter<input id="feA2" inputmode="numeric" value="${f && f.age_max != null ? f.age_max : ''}" placeholder="–"></label>
      <label class="f">Hinweis (intern)<input id="feNote" value="${esc(f ? f.note || '' : '')}"></label></div>
      <div class="mv-cons" style="margin-top:12px"><label class="chk" id="feFL"><input type="checkbox" id="feF" ${f && f.family ? 'checked' : ''}> Familienbeitrag – gilt für den Hauptzahler und alle Angehörigen (Partner/in, Kinder)</label>
        <label class="chk" id="feOL"><input type="checkbox" id="feO" ${!f || f.on_form ? 'checked' : ''}> Auf der Beitrittserklärung zur Auswahl</label>
        ${f ? `<label class="chk"><input type="checkbox" id="feAct" ${f.active ? 'checked' : ''}> Aktiv</label>` : ''}</div>
      <p class="muted s" id="feHint"></p>
      ${f && f.members === 0 ? '<div class="row" style="margin-top:12px"><button class="btn danger" id="feDel">Beitragsart löschen …</button></div>' : ''}
      <div class="btns"><button class="btn ghost" id="c">Abbrechen</button><button class="btn primary" id="feOk">Speichern</button></div>`);
    $('c').onclick = closeDialog;
    const sync = () => {
      const z = val('feK') === 'zusatz';
      ['feFL', 'feOL', 'feWL'].forEach(i => $(i).classList.toggle('hidden', z));
      $('feD').options[0].disabled = z; if (z && !val('feD') && $('feD').options.length > 1) $('feD').selectedIndex = 1;
      $('feHint').textContent = z ? 'Gilt automatisch für jede Person, die der Abteilung angehört – der Beitrag richtet sich nach ihrem Alter (mehrere Zusatzbeiträge mit Altersgrenzen je Abteilung möglich). In Familien zahlt der Hauptzahler ihn zusätzlich, aber nur für die Angehörigen in dieser Abteilung.'
        : 'Altersgrenzen dienen als Hinweis im Beitragslauf (z. B. wenn ein Jugendlicher 19 wird) und für den Vorschlag bei neuen Anträgen. „Einmalig“ eignet sich für die Aufnahmegebühr. „Eintrittsjahr frei“: im Beitragsjahr des Eintritts wird nichts berechnet.';
    };
    $('feK').onchange = sync; sync();
    const n = v => (v === '' ? null : +v);
    $('feOk').onclick = () => GK.busy($('feOk'), async () => {
      const w = val('feW');
      const body = { kind: val('feK'), name: val('feN'), cents: toCents(val('feC') || '0'), interval: val('feI'), prorate: val('feP'), department_id: val('feD') ? +val('feD') : null, age_min: n(val('feA1')), age_max: n(val('feA2')),
        work_minutes: w === '' ? null : Math.round(Number(w.replace(',', '.')) * 60), family: $('feF').checked, on_form: $('feO').checked, note: val('feNote'), ...(f ? { active: $('feAct').checked } : {}) };
      try { if (f) await api('fees/' + f.id, 'PUT', body); else await api('fees', 'POST', body); closeDialog(); toast('Gespeichert.'); after(); } catch (e) { fail(e); }
    });
    if ($('feDel')) $('feDel').onclick = () => confirmIn(`Beitragsart „${f.name}“ löschen?`, 'Sie ist keinem Mitglied mehr zugeordnet und verschwindet aus allen Auswahlfeldern.', 'Beitragsart löschen', async () => {
      try { await api('fees/' + f.id, 'DELETE'); closeDialog(); after(); } catch (e) { fail(e); }
    }, () => feeEdit(f, after, preset));
  }

  /* ================================================================= Gratulationen (Recht „Gratulationen“, planung/gratulationen.md) */
  const cgDay = d => `${new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}, ${d.slice(8, 10)}.${d.slice(5, 7)}.`;
  const cgLabel = r => (r.kind === 'manuell' ? `<span translate="no">${esc(r.title)}</span>` : esc(r.kind === 'geburtstag' ? GK.T('{0}. Geburtstag', [r.n]) : r.kind === 'verein' ? GK.T('{0} Jahre im Verein', [r.n]) : GK.T('{0} Jahre Abteilung {1}', [r.n, r.dept || ''])));
  const cgText = r => (r.kind === 'manuell' ? r.title : r.kind === 'geburtstag' ? GK.T('{0}. Geburtstag', [r.n]) : r.kind === 'verein' ? GK.T('{0} Jahre im Verein', [r.n]) : GK.T('{0} Jahre Abteilung {1}', [r.n, r.dept || '']));
  async function showCongrats(el) {
    const d = await api('congrats');
    const f = st.cg === 'alle' ? 'alle' : 'offen', open = d.rows.filter(r => !r.done_at), list = f === 'offen' ? open : d.rows;
    const mark = r => (r.done_at ? pill(['g', 'erledigt']) : r.date < d.today ? pill(['a', 'vorbei']) : r.date === d.today ? pill(['b', 'heute']) : '');
    el.innerHTML = `${chipBar('cgF', [['offen', 'Offen'], ['alle', 'Alle']], f)}
      <div class="card"><h3>Anstehende Gratulationen <span class="muted s">(${esc(GK.T('{0} Tage', [d.ahead]))})</span></h3>
        ${list.length ? `<table class="tbl kompakt" id="cgTbl"><tr><th>Name</th><th>Datum</th><th>Anlass</th><th>Gratulation</th><th>Wer kümmert sich?</th><th>Stand</th><th></th></tr>
          ${list.map(r => `<tr class="${r.done_at ? 'off' : ''}"><td class="k-1z"><b translate="no">${esc(GK.lastFirst(r.name))}</b></td><td class="num nw">${cgDay(r.date)}</td><td>${cgLabel(r)}</td>
            <td translate="no">${esc(r.plan) || '<span class="muted s">–</span>'}</td><td class="k-lbl" data-label="${esc(GK.T('Wer'))}" translate="no">${esc(r.who)}</td><td>${mark(r)}</td>
            <td class="r nw"><button class="btn small" data-cg="${esc(r.key)}">Bearbeiten</button></td></tr>`).join('')}</table>`
          : `<p class="empty">${f === 'offen' && d.rows.length ? 'Alles erledigt – in den nächsten Tagen steht keine Gratulation mehr an.' : 'In den nächsten 30 Tagen steht keine Gratulation an. Die Regeln stehen unter Mitglieder › Einstellungen.'}</p>`}</div>
      <div class="card" id="cgMe"><h3>Deine Erinnerung</h3><p class="muted s" style="margin-top:0">${esc(GK.T('{0} Tage vor jedem Anlass, je Anlass einmal.', [d.days]))}</p>
        <div class="mv-cons"><label class="chk"><input type="checkbox" id="cgMail" ${d.me.mail ? 'checked' : ''}> <span>Per E-Mail <span class="muted s">${d.me.address ? `(<span translate="no">${esc(d.me.address)}</span>)` : d.me.linked ? '(beim Mitglied ist keine E-Mail-Adresse eingetragen)' : ''}</span>${d.mailReady ? '' : ' <span class="muted s">– noch kein Postfach eingerichtet</span>'}</span></label>
          <label class="chk"><input type="checkbox" id="cgPush" ${d.me.push ? 'checked' : ''}> <span>Per Push in der Mitglieder-App <span class="muted s">${d.me.paired ? '(App ist gekoppelt)' : d.me.linked ? '(nur mit gekoppelter Mitglieder-App)' : ''}</span>${d.pushOn ? '' : ' <span class="muted s">– unter Mitglieder-App › Benachrichtigungen ausgeschaltet</span>'}</span></label></div>
        ${!d.me.linked ? '<p class="muted s" style="margin:10px 0 0">Für E-Mail und Push dein Benutzerkonto unter Verein › Benutzer & Rechte mit deinem Mitglied verknüpfen.</p>' : ''}${foot('cgSaveMe')}</div>`;
    const cnt = { offen: open.length, alle: d.rows.length };
    $('cgF').querySelectorAll('[data-cnt]').forEach(c => { c.textContent = cnt[c.dataset.cnt] || ''; });
    $('cgF').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; st.cg = b.dataset.f; showCongrats(el).catch(fail); };
    GK.tabTools('<button class="btn primary" id="cgNew">+ Anlass</button>', el);
    $('cgNew').onclick = () => congratsNew(() => showCongrats(el));
    el.querySelectorAll('[data-cg]').forEach(b => { b.onclick = () => congratsEdit(d.rows.find(r => r.key === b.dataset.cg), () => showCongrats(el)); });
    $('cgSaveMe').onclick = () => GK.busy($('cgSaveMe'), async () => {
      try { await api('congrats/me', 'PUT', { mail: $('cgMail').checked, push: $('cgPush').checked }); toast('Gespeichert.'); } catch (e) { fail(e); }
    });
  }
  /** Je Anlass: wer kümmert sich, Notiz, erledigt – ein Jubiläum auf Wunsch als Ehrung beim Mitglied */
  function congratsEdit(r, after) {
    const jub = r.kind === 'verein' || r.kind === 'abteilung', honorName = [r.plan, cgText(r)].filter(Boolean).join(' – ');
    dialog(`<h2>Gratulation</h2><p class="muted" style="margin-top:0"><b translate="no">${esc(GK.lastFirst(r.name))}</b> · ${cgLabel(r)} · ${cgDay(r.date)}${r.plan ? ` · <span translate="no">${esc(r.plan)}</span>` : ''}</p>
      <div class="mv-grid" style="--c:2"><label class="f">Wer kümmert sich?<input id="cgWho" value="${esc(r.who)}" maxlength="60" placeholder="z. B. Vorsitzende/r"></label>
        <label class="f">Notiz<input id="cgNote" value="${esc(r.note)}" maxlength="300"></label></div>
      <div class="mv-cons" style="margin-top:14px"><label class="chk"><input type="checkbox" id="cgDone" ${r.done_at ? 'checked' : ''}> Erledigt${r.done_at ? ` <span class="muted s">(${esc(deDate(r.done_at.slice(0, 10)))}${r.done_by ? ', ' + esc(r.done_by) : ''})</span>` : ''}</label>
        ${jub && !r.honor_id ? `<label class="chk"><input type="checkbox" id="cgHon"> Als Ehrung beim Mitglied eintragen</label>
          <label class="f hidden" id="cgHonL">Ehrung<input id="cgHonN" value="${esc(honorName)}" maxlength="120"></label>` : ''}
        ${r.honor_id ? '<p class="muted s" style="margin:0">Als Ehrung beim Mitglied eingetragen.</p>' : ''}</div>
      <div class="row" style="margin-top:16px">${r.kind === 'manuell' ? '<button class="btn danger" id="cgDel">Anlass löschen …</button>' : '<button class="btn" id="cgOff">Keine Gratulation gewünscht …</button>'}</div>
      <div class="btns"><button class="btn ghost" id="cgX">Abbrechen</button><button class="btn primary" id="cgOk">Speichern</button></div>`);
    $('cgX').onclick = closeDialog;
    const sync = () => { if ($('cgHon')) { $('cgHon').disabled = !$('cgDone').checked; if (!$('cgDone').checked) $('cgHon').checked = false; $('cgHonL').classList.toggle('hidden', !$('cgHon').checked); } };
    $('cgDone').onchange = sync; if ($('cgHon')) $('cgHon').onchange = sync; sync();
    $('cgOk').onclick = () => GK.busy($('cgOk'), async () => {
      try {
        const x = await api('congrats', 'PUT', { key: r.key, who: val('cgWho'), note: val('cgNote'), done: $('cgDone').checked, honor: Boolean($('cgHon') && $('cgHon').checked), honor_name: val('cgHonN') });
        closeDialog(); toast(x.honor ? 'Gespeichert und als Ehrung eingetragen.' : 'Gespeichert.'); after().catch(fail);
      } catch (e) { fail(e); }
    });
    if ($('cgDel')) $('cgDel').onclick = () => confirmIn('Anlass löschen?', `${GK.lastFirst(r.name)}: ${r.title} am ${deDate(r.date)}`, 'Löschen', async () => {
      try { await api('congrats', 'DELETE', { key: r.key }); closeDialog(); after().catch(fail); } catch (e) { fail(e); }
    }, () => congratsEdit(r, after));
    if ($('cgOff')) $('cgOff').onclick = () => confirmIn('Keine Gratulation gewünscht?', `${GK.lastFirst(r.name)} erscheint dann bei keinem Anlass mehr. Rückgängig im Mitglied unter „Mitgliedschaft“ (Karte Ehrungen).`, 'Keine Gratulation', async () => {
      try { await api('congrats/off/' + r.member_id, 'PUT', { off: true }); closeDialog(); toast('Gespeichert.'); after().catch(fail); } catch (e) { fail(e); }
    }, () => congratsEdit(r, after), { safe: true });
  }
  /** Anlass von Hand ergänzen (z. B. Goldene Hochzeit) */
  async function congratsNew(after) {
    const people = await api('congrats/members');
    dialog(`<h2>Anlass ergänzen</h2><p class="muted" style="margin-top:0">Für Anlässe, die keine Regel kennt – z. B. eine Goldene Hochzeit.</p>
      <div class="mv-grid" style="--c:2"><label class="f w2">Mitglied<select id="cgM" translate="no"><option value="">${esc(GK.T('Bitte wählen'))}</option>${people.map(p => opt(p.id, p.name)).join('')}</select></label>
        <label class="f">Datum<input type="date" id="cgD"></label><label class="f">Anlass<input id="cgT" maxlength="60" placeholder="z. B. Goldene Hochzeit"></label>
        <label class="f w2">Gratulation<input id="cgP" maxlength="60" placeholder="z. B. Karte"></label></div>
      <div class="btns"><button class="btn ghost" id="cgX">Abbrechen</button><button class="btn primary" id="cgOk">Speichern</button></div>`);
    $('cgX').onclick = closeDialog;
    $('cgOk').onclick = () => GK.busy($('cgOk'), async () => {
      try { await api('congrats', 'POST', { member_id: +val('cgM') || null, date: val('cgD'), title: val('cgT'), plan: val('cgP') }); closeDialog(); toast('Gespeichert.'); after().catch(fail); } catch (e) { fail(e); }
    });
  }
  /** Einstellungen › Karte „Gratulationen“: Regeln (Anlass · Wann · Was) und Vorlauf der Erinnerung */
  const cgWhen = r => [...r.years, ...(r.from != null ? [GK.T('ab {0}', [r.from])] : [])].join(', ');
  const cgParse = s => { const t = String(s || ''), m = /ab\s*(\d+)/i.exec(t); return { from: m ? +m[1] : null, years: t.replace(/ab\s*\d+[^,;]*/ig, ' ').split(/[^\d]+/).filter(Boolean).map(Number) }; };
  async function congratsCard(el) {
    const c = await api('congrats/settings');
    const kinds = [['geburtstag', 'Geburtstag'], ['verein', 'Vereinsjubiläum'], ['abteilung:0', 'Abteilungsjubiläum (alle Abteilungen)'], ...c.depts.map(x => [`abteilung:${x.id}`, `${GK.T('Abteilungsjubiläum')} ${x.name}`])];
    const row = r => `<div class="mv-cg-ed" data-r><label class="f">Anlass<select data-k="kind">${kinds.map(([k, l]) => opt(k, l, r.kind === 'abteilung' ? `abteilung:${r.dept || 0}` : r.kind)).join('')}</select></label>
      <label class="f">Wann (Jahre)<input data-k="when" value="${esc(cgWhen(r))}" placeholder="z. B. 70, 75, ab 80"></label><label class="f">Was<input data-k="what" value="${esc(r.what)}" maxlength="60" placeholder="z. B. Blumen"></label>
      <button class="btn small danger" data-rx>Entfernen</button></div>`;
    const rec = c.recipients.map(x => `${x.name} (${[x.mail ? GK.T('E-Mail') : '', x.push ? GK.T('Push') : ''].filter(Boolean).join(', ') || GK.T('weder E-Mail noch Push')})`).join(', ');
    el.innerHTML = `<h3>Gratulationen</h3><p class="muted s" style="margin-top:0">Wem wann gratuliert wird. „ab 80“ heißt: mit 80 und danach jedes Jahr. Die Liste steht unter Mitglieder › Gratulationen.</p>
      <div id="cgRules">${c.rules.map(row).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="btn" id="cgAdd">+ Regel</button></div>
      <div class="mv-grid" style="--c:4;margin-top:14px"><label class="f w2">Erinnerung … Tage vorher<input id="cgDays" value="${c.days}" inputmode="numeric"></label></div>
      <p class="muted s" style="margin:8px 0 0">Erinnert werden alle mit dem Recht „Gratulationen“: <span translate="no">${esc(rec) || esc(GK.T('noch niemand'))}</span>.</p>${foot('cgSaveSet')}`;
    const bind = () => el.querySelectorAll('[data-rx]').forEach(b => { b.onclick = () => b.closest('[data-r]').remove(); });
    bind();
    $('cgAdd').onclick = () => { $('cgRules').insertAdjacentHTML('beforeend', row({ kind: 'geburtstag', years: [], from: null, what: '' })); bind(); };
    $('cgSaveSet').onclick = () => GK.busy($('cgSaveSet'), async () => {
      const rules = [...el.querySelectorAll('[data-r]')].map(x => { const [kind, dept] = x.querySelector('[data-k=kind]').value.split(':'); return { kind, dept: +dept || 0, ...cgParse(x.querySelector('[data-k=when]').value), what: x.querySelector('[data-k=what]').value }; });
      try { await api('congrats/settings', 'PUT', { rules, days: +val('cgDays') }); GK.clean(); toast('Gespeichert.'); await congratsCard(el); } catch (e) { fail(e); }
    });
  }
  async function congratsPage() {
    current = 'mv-gratulationen';
    $('main').innerHTML = `<h2 class="page">Gratulationen</h2><p class="lead">Geburtstage und Jubiläen der nächsten 30 Tage: wer sich kümmert und was erledigt ist.</p><div id="mvBody"><p class="muted">Lade …</p></div>`;
    await showCongrats(pageEl());
  }

  const G = { key: 'mitglieder', label: 'Mitglieder', icon: 'ausweis', order: 7 };   // Menüposition (siehe Kern: feste Modulreihenfolge)
  const GZ = { key: 'mv-zahlungen', label: 'Beiträge & Zahlungen', icon: 'zahlung', order: 7.5 };   // zweiter Menüpunkt des Moduls, direkt nach „Mitglieder“

  /* „Meine Daten“: was Mitglieder in der App sehen und ändern dürfen – Karte in Einstellungen */
  async function appDataCard(el) {
    await loadMeta();
    const s = st.meta.settings;
    el.innerHTML = `<h3>„Meine Daten“ in der App</h3><p class="muted s" style="margin-top:0">Was Mitglieder in der App sehen und selbst ändern dürfen. Änderungen an Daten bestätigt immer der Vorstand. Sind die Einwilligungen in der App ausgeblendet, widerrufen Mitglieder sie formlos beim Vorstand (z. B. per E-Mail).</p>
        <div class="mv-grid" style="--c:2"><div><div class="mv-sub">Sehen</div><div class="mv-cons">${Object.entries(s.app_labels.view).map(([k, l]) => `<label class="chk"><input type="checkbox" data-apv="${k}" ${s.app_perms.view[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
          <div><div class="mv-sub">Ändern</div><div class="mv-cons">${Object.entries(s.app_labels.edit).map(([k, l]) => `<label class="chk"><input type="checkbox" data-ape="${k}" ${s.app_perms.edit[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div></div>
        <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" id="eSaveApp">Speichern</button></div>`;
    const syncApp = () => { [['anschrift', 'anschrift'], ['kontakt', 'kontakt'], ['bank', 'bank'], ['einwilligungen', 'einwilligungen']].forEach(([v, e]) => { const vi = el.querySelector(`[data-apv="${v}"]`), ei = el.querySelector(`[data-ape="${e}"]`); if (vi && ei) { ei.disabled = !vi.checked; if (!vi.checked) ei.checked = false; } }); };
    el.querySelectorAll('[data-apv]').forEach(c => { c.addEventListener('change', syncApp); }); syncApp();
    $('eSaveApp').onclick = () => GK.busy($('eSaveApp'), async () => {
      try { await api('settings', 'PUT', { app_perms: { view: Object.fromEntries([...el.querySelectorAll('[data-apv]')].map(c => [c.dataset.apv, c.checked])), edit: Object.fromEntries([...el.querySelectorAll('[data-ape]')].map(c => [c.dataset.ape, c.checked])) } }); GK.clean(); toast('Gespeichert.'); await loadMeta(); } catch (e) { fail(e); }
    });
  }
  /* Menü „Mitglieder“: Mitglieder · Anträge (n) · Beiträge & Abteilungen · Auswertung · Einstellungen */
  GK.registerPage({ key: 'mitglieder', title: 'Mitglieder', perm: 'mitglieder', render, group: G });
  GK.registerPage({ key: 'mv-antraege', title: 'Anträge & Änderungen', perm: 'mitglieder', render: pageRender('mv-antraege', showApplications), group: G, tab: 'Anträge' });
  GK.registerPage({ key: 'mv-gratulationen', title: 'Gratulationen', perm: 'gratulationen', render: congratsPage, group: G });
  GK.registerPage({ key: 'mv-stamm', title: 'Beiträge & Abteilungen', perm: '!mitglieder', render: pageRender('mv-stamm', showCatalog), group: G });
  GK.registerPage({ key: 'mv-auswertung', title: 'Auswertung', perm: '!mitglieder', render: pageRender('mv-auswertung', showReports), group: G });
  GK.registerPage({ key: 'mv-einstellungen', title: 'Einstellungen', perm: '!mitglieder', render: pageRender('mv-einstellungen', showSettings), group: G });
  /* Menü „Beiträge & Zahlungen“ (Recht „Einzug“): Beitragslauf · Lastschriften · Offene Posten · Rechnungen & Mahnungen · Einstellungen
     (Adressen mv-beitraege und mv-einzug wie bisher, damit Lesezeichen und Links aus der Übersicht weiter stimmen) */
  GK.registerPage({ key: 'mv-beitraege', title: 'Beitragslauf', perm: 'mitglieder_finanzen', render: pageRender('mv-beitraege', showRun), group: GZ });
  GK.registerPage({ key: 'mv-einzug', title: 'Lastschriften', perm: 'mitglieder_finanzen', render: pageRender('mv-einzug', showCollections), group: GZ });
  GK.registerPage({ key: 'mv-posten', title: 'Offene Posten', perm: 'mitglieder_finanzen', render: pageRender('mv-posten', showCharges), group: GZ });
  GK.registerPage({ key: 'mv-mahnung', title: 'Rechnungen & Mahnungen', perm: 'mitglieder_finanzen', render: pageRender('mv-mahnung', showDunning), group: GZ });
  GK.registerPage({ key: 'mv-zeinst', title: 'Einstellungen', perm: 'mitglieder_finanzen', render: pageRender('mv-zeinst', showPaySettings), group: GZ });
  // Suche (Strg/⌘ K): Aktionen, Karten und Einstellungen der Mitglieder
  if (GK.registerSearch) GK.registerSearch([
    { label: 'Neues Mitglied anlegen', page: 'mitglieder', btn: '+ Neues Mitglied', kind: 'aktion', words: 'Mitglied aufnehmen Neuaufnahme' },
    { label: 'Mitglieder importieren', page: 'mitglieder', btn: 'Import', perm: '!mitglieder', kind: 'aktion', words: 'Import S-Verein WISO verein.cloud CSV Excel übernehmen' },
    { label: 'Mitgliederliste als Excel', page: 'mitglieder', btn: 'Excel', perm: '!mitglieder', kind: 'aktion', words: 'Export Liste Excel' },
    { label: 'Mitglieder mit Hinweis (fehlende Angaben)', page: 'mitglieder', seg: 'Mit Hinweis', words: 'Pflichtangaben fehlen Hinweis IBAN Mandat Beitrag' },
    { label: 'Ausgetretene Mitglieder', page: 'mitglieder', seg: 'Ausgetreten', words: 'Austritt ehemalige Kündigung' },
    { label: 'Beitrittserklärung erfassen', page: 'mv-antraege', btn: '+ Beitrittserklärung', kind: 'aktion', words: 'Antrag Aufnahme Beitritt' },
    { label: 'Online-Antrag', page: 'mv-antraege', btn: 'Online-Antrag', kind: 'aktion', words: 'online Antrag Beitritt' },
    { label: 'Formular Beitrittserklärung (PDF)', page: 'mv-antraege', btn: 'Formular', kind: 'aktion', words: 'PDF Formular leer drucken Beitritt' },
    { label: 'Beitragsarten', page: 'mv-stamm', card: 'Beiträge Hauptverein', in: 'Beiträge & Abteilungen', words: 'Beitrag Familienbeitrag Grundbeitrag' },
    { label: 'Neue Beitragsart', page: 'mv-stamm', btn: '+ Beitragsart', kind: 'aktion', in: 'Beiträge & Abteilungen', words: 'Beitrag anlegen Familienbeitrag' },
    { label: 'Zusatzbeiträge der Abteilungen', page: 'mv-stamm', card: 'Zusatzbeiträge', in: 'Beiträge & Abteilungen', words: 'Abteilungsbeitrag Zusatzbeitrag' },
    { label: 'Neuer Zusatzbeitrag', page: 'mv-stamm', btn: '+ Zusatzbeitrag', kind: 'aktion', in: 'Beiträge & Abteilungen', words: 'Abteilungsbeitrag anlegen' },
    { label: 'Abteilungen', page: 'mv-stamm', card: 'Abteilungen', in: 'Beiträge & Abteilungen', words: 'Abteilung Sparte anlegen' },
    { label: 'Neue Abteilung', page: 'mv-stamm', btn: '+ Abteilung', kind: 'aktion', in: 'Beiträge & Abteilungen', words: 'Sparte anlegen' },
    { label: 'Altersstufen prüfen', page: 'mv-stamm', card: 'Altersstufen', in: 'Beiträge & Abteilungen', words: 'Alter Jugend Erwachsene Beitragsart wechseln umstellen' },
    { label: 'Beitragslauf', page: 'mv-beitraege', perm: 'mitglieder_finanzen', kind: 'aktion', boost: 1, words: 'Beiträge abrechnen Jahresbeitrag Lastschrift' },
    { label: 'Lastschriften und SEPA-Datei', page: 'mv-einzug', card: 'Neuer Einzug', perm: 'mitglieder_finanzen', kind: 'aktion', boost: 1, words: 'SEPA Einzug pain.008 Vorabinformation Rücklastschrift' },
    { label: 'Verkauf per Lastschrift einziehen', page: 'mv-einzug', card: 'Verkauf einziehen', perm: 'mitglieder_finanzen', kind: 'aktion', words: 'Getränke Verkaufskonten Einzug SEPA abbuchen' },
    { label: 'Überfällige Posten', page: 'mv-posten', seg: 'Überfällig', perm: 'mitglieder_finanzen', words: 'Forderung offen überfällig nicht bezahlt' },
    { label: 'Forderung anlegen', page: 'mv-posten', btn: '+ Forderung', perm: 'mitglieder_finanzen', kind: 'aktion', words: 'Posten Gutschrift Betrag Mitglied berechnen' },
    { label: 'Rechnungen & Mahnungen (Beiträge)', page: 'mv-mahnung', perm: 'mitglieder_finanzen', words: 'Mahnung Erinnerung Rechnung bar' },
    { label: 'Mitgliederzahlen und Abteilungen', page: 'mv-auswertung', card: 'Abteilungen', words: 'Statistik Zahlen Stichtag' },
    { label: 'Bestandserhebung (Landessportbund)', page: 'mv-auswertung', card: 'Bestandserhebung', words: 'LSB Statistik Meldung Verband' },
    { label: 'Runde Geburtstage & Jubiläen', page: 'mv-auswertung', card: 'Runde Geburtstage', words: 'Geburtstag Jubiläum Ehrung' },
    { label: 'Anstehende Gratulationen', page: 'mv-gratulationen', perm: 'gratulationen', boost: 1, words: 'Geburtstag Jubiläum Ehrung Blumen gratulieren Ehrennadel' },
    { label: 'Anlass für eine Gratulation ergänzen', page: 'mv-gratulationen', btn: '+ Anlass', perm: 'gratulationen', kind: 'aktion', words: 'Hochzeit Gratulation von Hand' },
    { label: 'Erinnerung an Gratulationen (E-Mail, Push)', page: 'mv-gratulationen', card: 'Deine Erinnerung', perm: 'gratulationen', words: 'Benachrichtigung Geburtstag Push E-Mail' },
    { label: 'Regeln für Gratulationen', page: 'mv-einstellungen', card: 'Gratulationen', field: 'cgDays', in: 'Einstellungen', words: 'Geburtstag Jubiläum Ehrennadel Urkunde Blumen Erinnerung Tage vorher' },
    { label: 'Mitgliedsnummern, Beitragsjahr und Kündigungsfrist', page: 'mv-einstellungen', card: 'Mitgliedschaft', field: 'eNo', in: 'Einstellungen', words: 'Mitgliedsnummer Beitragsjahr Kündigungsfrist Kündigung' },
    { label: 'Lastschrift als Pflicht', page: 'mv-einstellungen', card: 'Mitgliedschaft', field: 'eSepaReq', in: 'Einstellungen', words: 'Zahlart Lastschrift Rechnung bar' },
    { label: 'Abteilungsleitungen: Ein- und Austritte bestätigen', page: 'mv-einstellungen', card: 'Mitgliedschaft', field: 'eScope', in: 'Einstellungen', words: 'Abteilungsleitung bestätigen' },
    { label: 'Beitrittserklärung und Online-Antrag (Formular, Einwilligungen)', page: 'mv-einstellungen', card: 'Beitrittserklärung', in: 'Einstellungen', words: 'Formular Satzung Einwilligung Online-Antrag Tablet' },
    { label: '„Meine Daten“ in der Mitglieder-App', page: 'mv-einstellungen', card: '„Meine Daten“', in: 'Einstellungen', words: 'App Anschrift Bankverbindung Kündigen Einwilligungen' },
    { label: 'Neue Anträge melden an (E-Mail)', page: 'mv-einstellungen', card: 'Benachrichtigungen', field: 'eNotify', in: 'Einstellungen', words: 'Benachrichtigung Antrag E-Mail Vorstand' },
    { label: 'Datenschutz nach dem Austritt', page: 'mv-einstellungen', card: 'Datenschutz', field: 'eRet2', in: 'Einstellungen', words: 'DSGVO Anonymisieren löschen Aufbewahrung Erinnerung' },
    { label: 'Einstellungen der Mitglieder übertragen', page: 'mv-einstellungen', card: 'Einstellungen übertragen', kind: 'aktion', in: 'Einstellungen', words: 'Export Import Datei' },
    { label: 'Lastschrift (Gläubiger-ID, Mandatsreferenz)', page: 'mv-zeinst', card: 'Lastschrift', field: 'eCi', perm: 'mitglieder_finanzen', words: 'SEPA Gläubiger-ID Gläubiger Mandatsreferenz Vorabinformation Rücklastschrift Verkaufs-Einzug Zahlungsempfänger Konto' },
    { label: 'Rechnungen und Mahnungen (Mahngebühr, Zusatz)', page: 'mv-zeinst', card: 'Rechnungen & Mahnungen', field: 'eDun', perm: 'mitglieder_finanzen', words: 'Mahngebühr Rechnungstext Zusatz Steuernummer' },
  ]);
  // Konten & PINs gehören zum Verkauf, sobald die Mitglieder hier verwaltet werden
  if (GK.regroup && (!GK.modules || GK.modules().includes('getraenke'))) GK.regroup('konten', 'getraenke', { title: 'Konten & PINs', tab: 'Konten' });
  else if (GK.relabel) GK.relabel('konten', 'Konten & PINs');
  if (GK.badges) GK.badges(async () => { if (!GK.can('mitglieder')) return {}; const m = await api('meta'); return { 'mv-antraege': m.counts.applications + m.counts.changes, ...(GK.canFull('mitglieder') ? { 'mv-stamm': m.ages || 0 } : {}) }; });
})();
