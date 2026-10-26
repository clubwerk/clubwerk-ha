/* Verein → E-Mail: schreiben wie in einem E-Mail-Programm (Empfänger-Chips, formatierter Text, Anhänge,
   Entwürfe mit automatischem Speichern, Vorlagen, Verteiler, Gesendet mit Zustellstatus).
   Wird vor admin.js geladen und meldet sich über CW_PAGES an, sobald GK bereitsteht. */
(window.CW_PAGES = window.CW_PAGES || []).push(GK => {
  'use strict';
  const { $, esc, api, toast, fail, dialog, closeDialog, ask, askText } = GK;
  const T = s => (GK.T ? GK.T(s) : s);
  let O = null;            // Optionen (Gruppen, Mitglieder, Verteiler, Vorlagen, Absender)
  let openDraft = null;    // beim Wechsel in „Neue E-Mail“ diesen Entwurf öffnen
  let tabsCtl = null;

  const style = document.createElement('style');
  style.textContent = `
  .ml-card{padding:0;overflow:hidden}
  .ml-line{display:grid;grid-template-columns:96px 1fr;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--line-soft);min-height:52px}
  .ml-line>b{font-size:13px;color:var(--muted);font-weight:600}
  .ml-from{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;font-size:14px}
  .ml-from .muted{font-size:13px}
  .ml-sub{border:0;background:transparent;font:inherit;font-size:16px;font-weight:600;width:100%;padding:6px 0;outline:none;color:var(--ink)}
  .ml-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;position:relative;min-height:34px}
  .ml-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 6px 0 11px;border-radius:15px;background:var(--hover);font-size:13px;font-weight:600;max-width:100%}
  .ml-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ml-chip small{font-weight:500;color:var(--muted)}
  .ml-chip.g{background:var(--brand-soft);color:var(--brand-ink)}
  .ml-chip.l{background:var(--blue-soft);color:var(--blue)}
  .ml-chip.bad{background:var(--red-soft);color:var(--red)}
  .ml-chip button{width:20px;height:20px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;color:inherit;opacity:.7}
  .ml-chip button:hover{opacity:1;background:rgba(0,0,0,.08)}
  .ml-in{flex:1 1 180px;min-width:140px;border:0;background:transparent;font:inherit;font-size:14px;height:32px;outline:none;color:var(--ink)}
  .ml-sug{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:30;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-pop);max-height:320px;overflow:auto;padding:6px}
  .ml-sug button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:8px;text-align:left;font-size:14px}
  .ml-sug button.on,.ml-sug button:hover{background:var(--hover)}
  .ml-sug small{color:var(--muted);font-size:12px;white-space:nowrap}
  .ml-sug .h{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);padding:8px 10px 4px;font-weight:700}
  .ml-meta{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;padding:8px 18px;border-bottom:1px solid var(--line-soft);font-size:13px;color:var(--muted);min-height:44px}
  .ml-meta .chk{font-size:13px}
  .ml-meta .ml-cnt{margin-left:auto;font-weight:600;color:var(--ink)}
  .ml-meta .ml-cnt.warn{color:var(--amber)}
  .ml-bar{display:flex;flex-wrap:wrap;gap:2px;padding:6px 12px;border-bottom:1px solid var(--line-soft);background:var(--field);align-items:center}
  .ml-bar button{height:32px;min-width:32px;padding:0 8px;border-radius:8px;font-size:14px;color:var(--ink);display:inline-flex;align-items:center;justify-content:center;gap:4px}
  .ml-bar button:hover,.ml-bar button.on{background:var(--hover)}
  .ml-bar .sep{width:1px;height:20px;background:var(--line);margin:0 6px}
  .ml-bar .grow{flex:1}
  .ml-bar select{width:auto;max-width:180px;height:32px;border:1px solid var(--line);border-radius:8px;background:var(--card);padding:0 8px;font:inherit;font-size:13px;color:var(--ink)}
  .ml-ed{min-height:300px;padding:16px 18px;outline:none;font-size:15px;line-height:1.55;color:var(--ink);overflow-wrap:anywhere}
  .ml-ed:empty::before{content:attr(data-ph);color:var(--faint)}
  .ml-ed p,.ml-view p{margin:0 0 .7em}.ml-ed h2,.ml-view h2{font-size:20px;margin:.6em 0 .4em}.ml-ed h3,.ml-view h3{font-size:16px;margin:.6em 0 .3em}
  .ml-ed blockquote,.ml-view blockquote{margin:.5em 0;padding:2px 0 2px 14px;border-left:3px solid var(--line);color:var(--muted)}
  .ml-ed ul,.ml-ed ol,.ml-view ul,.ml-view ol{margin:.3em 0 .7em;padding-left:24px}
  .ml-ed a,.ml-view a{color:var(--brand);text-decoration:underline}
  .ml-ed hr,.ml-view hr{border:0;border-top:1px solid var(--line);margin:12px 0}
  .ml-sig{margin:0 18px 14px;padding-top:10px;border-top:1px dashed var(--line);color:var(--muted);font-size:13.5px}
  .ml-files{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 18px;border-top:1px solid var(--line-soft)}
  .ml-file{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 6px 0 12px;border:1px solid var(--line);border-radius:10px;font-size:13px;max-width:100%;background:var(--card);color:var(--ink);text-decoration:none}
  .ml-file b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
  .ml-file small{color:var(--muted)}
  .ml-file button{width:24px;height:24px;border-radius:12px;font-size:16px;color:var(--muted)}
  .ml-file button:hover{background:var(--hover);color:var(--ink)}
  .ml-drop{outline:2px dashed var(--brand);outline-offset:-6px;background:var(--brand-soft)}
  .ml-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 18px;border-top:1px solid var(--line-soft)}
  .ml-foot .st{font-size:13px;color:var(--muted);margin-right:auto}
  .ml-list{display:flex;flex-direction:column}
  .ml-row{display:grid;grid-template-columns:minmax(0,1fr) 170px 150px 120px;gap:16px;align-items:center;padding:12px 4px;border-bottom:1px solid var(--line-soft);cursor:pointer;text-align:left;width:100%}
  .ml-row:hover{background:var(--hover)}
  .ml-row .t{min-width:0}.ml-row .t b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ml-row .t span{display:block;color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ml-row .c{font-size:13px;color:var(--muted)}.ml-row .r{text-align:right}
  .ml-view{border:1px solid var(--line);border-radius:12px;padding:16px 18px;font-size:15px;line-height:1.55;background:var(--card);overflow-wrap:anywhere}
  .ml-kv{display:grid;grid-template-columns:110px 1fr;gap:6px 12px;font-size:14px;margin:0 0 14px}
  .ml-kv dt{color:var(--muted)}.ml-kv dd{margin:0;min-width:0;overflow-wrap:anywhere}
  .ml-prog{height:8px;border-radius:4px;background:var(--hover);overflow:hidden;margin:6px 0 2px}
  .ml-prog i{display:block;height:100%;background:var(--brand);transition:width .3s}
  .ml-rc{max-height:280px;overflow:auto;border:1px solid var(--line-soft);border-radius:10px}
  .ml-rc table{margin:0}
  @media (max-width:760px){
    .ml-line{grid-template-columns:1fr;gap:4px;padding:10px 14px}
    .ml-row{grid-template-columns:minmax(0,1fr) auto;gap:4px 12px}
    .ml-row .c.who{display:none}
    .ml-bar{padding:6px 8px}.ml-ed{padding:14px}
    .ml-meta .ml-cnt{margin-left:0;width:100%}
    .ml-bar .grow{display:none}.ml-bar select{flex:1 1 40%;max-width:none}
    .ml-foot .st{width:100%}.ml-foot .btn{flex:1 1 calc(50% - 4px);justify-content:center}
  }`;
  document.head.appendChild(style);

  const kb = n => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`);
  const deT = s => (s ? new Date(s.replace(' ', 'T')).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');
  const okMail = m => /^[^@\s<>,;"]+@[^@\s<>,;"]+\.[^@\s<>,;"]+$/.test(m);
  const emptySpec = () => ({ groups: [], members: [], addresses: [], lists: [], payer: true });

  /* ---------- Einfügen nur mit erlaubter Formatierung ---------- */
  const OKTAG = new Set(['P', 'BR', 'DIV', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'A', 'H2', 'H3', 'BLOCKQUOTE', 'HR']);
  const MAP = { H1: 'H2', H4: 'H3', H5: 'H3', H6: 'H3', STRIKE: 'S', DEL: 'S' };
  function cleanHtml(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const walk = (node, out) => {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); continue; }
        if (n.nodeType !== 1) continue;
        const tag = MAP[n.tagName] || n.tagName;
        if (['SCRIPT', 'STYLE', 'HEAD', 'TITLE', 'META', 'LINK', 'IFRAME', 'OBJECT', 'SVG', 'IMG', 'TEMPLATE'].includes(n.tagName)) continue;
        if (!OKTAG.has(tag)) { walk(n, out); continue; }
        const el = document.createElement(tag);
        if (tag === 'A') { const h = n.getAttribute('href') || ''; if (/^(https?:|mailto:)/i.test(h)) el.setAttribute('href', h); }
        walk(n, el); out.appendChild(el);
      }
    };
    const box = document.createElement('div'); walk(doc.body, box); return box.innerHTML;
  }

  /* ---------- Empfänger-Feld mit Chips ---------- */
  function picker(host, spec, { lists = true, onChange } = {}) {
    let sugIdx = 0, sug = [];
    const groupLabel = g => (O.groups.find(x => x.t === g.t && String(x.v) === String(g.v)) || {}).label || g.v;
    const groupN = g => (O.groups.find(x => x.t === g.t && String(x.v) === String(g.v)) || {}).n;
    const mem = id => O.members.find(m => m.id === id);
    const render = () => {
      host.innerHTML = `${spec.groups.map((g, i) => `<span class="ml-chip g" title="${esc(T('Gruppe'))}"><span>${esc(groupLabel(g))}</span>${groupN(g) != null ? `<small>${groupN(g)}</small>` : ''}<button type="button" data-rm="g:${i}" aria-label="${esc(T('Entfernen'))}">×</button></span>`).join('')}
        ${(spec.lists || []).map((id, i) => { const l = O.lists.find(x => x.id === id); return `<span class="ml-chip l"><span>${esc(l ? l.name : '?')}</span><small>${esc(T('Verteiler'))}</small><button type="button" data-rm="l:${i}">×</button></span>`; }).join('')}
        ${spec.members.map((id, i) => { const m = mem(id); return `<span class="ml-chip ${m && !m.email && !m.viaPayer ? 'bad' : ''}" title="${esc(m ? m.email || (m.viaPayer ? T('über den Zahler') : T('keine E-Mail-Adresse')) : '')}"><span translate="no">${esc(m ? m.name : '?')}</span><button type="button" data-rm="m:${i}">×</button></span>`; }).join('')}
        ${spec.addresses.map((a, i) => `<span class="ml-chip ${okMail(a.replace(/^.*<|>$/g, '').trim()) ? '' : 'bad'}"><span translate="no">${esc(a)}</span><button type="button" data-rm="a:${i}">×</button></span>`).join('')}
        <input class="ml-in" placeholder="${esc(spec.groups.length + spec.members.length + spec.addresses.length + (spec.lists || []).length ? '' : T('Gruppe, Name oder E-Mail-Adresse …'))}" autocomplete="off" spellcheck="false" aria-label="${esc(T('Empfänger hinzufügen'))}">
        <div class="ml-sug hidden"></div>`;
      const inp = host.querySelector('.ml-in'), box = host.querySelector('.ml-sug');
      host.querySelectorAll('[data-rm]').forEach(b => { b.onclick = e => { e.stopPropagation(); const [k, i] = b.dataset.rm.split(':'); ({ g: spec.groups, l: spec.lists, m: spec.members, a: spec.addresses })[k].splice(+i, 1); changed(); render(); host.querySelector('.ml-in').focus(); }; });
      const show = () => {
        const q = inp.value.trim().toLowerCase();
        const has = (t, v) => spec.groups.some(g => g.t === t && String(g.v) === String(v));
        const gs = O.groups.filter(g => !has(g.t, g.v) && (!q || g.label.toLowerCase().includes(q))).slice(0, q ? 8 : 12).map(g => ({ k: 'g', g, label: g.label, info: `${g.n} ${T(g.n === 1 ? 'Person' : 'Personen')}` }));
        const ls = lists ? O.lists.filter(l => !(spec.lists || []).includes(l.id) && (!q || l.name.toLowerCase().includes(q))).slice(0, 6).map(l => ({ k: 'l', id: l.id, label: l.name, info: T('Verteiler') })) : [];
        const ms = q.length >= 2 ? O.members.filter(m => !spec.members.includes(m.id) && (m.name.toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q))).slice(0, 12).map(m => ({ k: 'm', id: m.id, label: m.name, info: m.email || (m.viaPayer ? T('über den Zahler') : T('keine E-Mail')) })) : [];
        const typed = q && okMail(q.replace(/^.*<|>$/g, '').trim()) ? [{ k: 'a', a: inp.value.trim(), label: inp.value.trim(), info: T('Adresse hinzufügen') }] : [];
        sug = [...typed, ...gs, ...ls, ...ms]; sugIdx = 0;
        if (!sug.length) { box.classList.add('hidden'); return; }
        const sec = (k, title) => (sug.some(x => x.k === k) ? `<div class="h">${esc(title)}</div>` + sug.map((x, i) => (x.k === k ? `<button type="button" data-i="${i}" class="${i === sugIdx ? 'on' : ''}"><span translate="${k === 'm' || k === 'a' ? 'no' : 'yes'}">${esc(x.label)}</span><small>${esc(x.info)}</small></button>` : '')).join('') : '');
        box.innerHTML = sec('a', T('Adresse')) + sec('g', T('Gruppen')) + sec('l', T('Verteiler')) + sec('m', T('Mitglieder'));
        box.classList.remove('hidden');
        box.querySelectorAll('[data-i]').forEach(b => { b.onmousedown = e => { e.preventDefault(); pick(sug[+b.dataset.i]); }; });
      };
      const pick = x => {
        if (!x) return;
        if (x.k === 'g') spec.groups.push({ t: x.g.t, v: x.g.v });
        if (x.k === 'l') spec.lists.push(x.id);
        if (x.k === 'm') spec.members.push(x.id);
        if (x.k === 'a') spec.addresses.push(x.a);
        changed(); render(); host.querySelector('.ml-in').focus();
      };
      const addTyped = () => {
        const parts = inp.value.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
        if (!parts.length) return false;
        parts.forEach(p => { if (!spec.addresses.includes(p)) spec.addresses.push(p); });
        changed(); render(); host.querySelector('.ml-in').focus(); return true;
      };
      inp.oninput = show; inp.onclick = show;   // Liste erst beim Tippen oder Antippen – nicht nach jedem Hinzufügen
      inp.onblur = () => { setTimeout(() => box.classList.add('hidden'), 120); if (inp.value.includes('@')) addTyped(); };
      inp.onkeydown = e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!sug.length) return; sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + sug.length) % sug.length; box.querySelectorAll('[data-i]').forEach(b => b.classList.toggle('on', +b.dataset.i === sugIdx)); }
        else if (e.key === 'Enter') { e.preventDefault(); if (!box.classList.contains('hidden') && sug[sugIdx]) pick(sug[sugIdx]); else addTyped(); }
        else if ((e.key === ',' || e.key === ';') && inp.value.includes('@')) { e.preventDefault(); addTyped(); }
        else if (e.key === 'Backspace' && !inp.value) { const order = [['a', spec.addresses], ['m', spec.members], ['l', spec.lists || []], ['g', spec.groups]]; for (const [, arr] of order) if (arr.length) { arr.pop(); changed(); render(); host.querySelector('.ml-in').focus(); break; } }
        else if (e.key === 'Escape') box.classList.add('hidden');
      };
      inp.onpaste = e => { const t = (e.clipboardData || window.clipboardData).getData('text'); if (/[,;\n]/.test(t) && t.includes('@')) { e.preventDefault(); inp.value = t; addTyped(); } };
    };
    const changed = () => { if (onChange) onChange(spec); };
    host.onclick = e => { if (e.target === host) host.querySelector('.ml-in').focus(); };
    render();
    return { render };
  }

  /* ---------- Editor ---------- */
  function editor(host, html, { onInput, placeholders = true, templates = false, minimal = false } = {}) {
    host.innerHTML = `<div class="ml-bar">
        <button type="button" data-c="bold" title="${esc(T('Fett'))} (Strg+B)"><b>B</b></button><button type="button" data-c="italic" title="${esc(T('Kursiv'))} (Strg+I)"><i>I</i></button>
        <button type="button" data-c="underline" title="${esc(T('Unterstrichen'))}"><u>U</u></button><button type="button" data-c="strikeThrough" title="${esc(T('Durchgestrichen'))}"><s>S</s></button>
        <span class="sep"></span>
        ${minimal ? '' : `<button type="button" data-b="H2" title="${esc(T('Überschrift'))}">H</button><button type="button" data-b="H3" title="${esc(T('Zwischenüberschrift'))}" style="font-size:12px">H</button><button type="button" data-b="P" title="${esc(T('Normaler Text'))}">¶</button><span class="sep"></span>`}
        <button type="button" data-c="insertUnorderedList" title="${esc(T('Aufzählung'))}">•≡</button><button type="button" data-c="insertOrderedList" title="${esc(T('Nummerierung'))}">1.</button>
        ${minimal ? '' : `<button type="button" data-b="BLOCKQUOTE" title="${esc(T('Zitat'))}">❝</button><button type="button" data-c="insertHorizontalRule" title="${esc(T('Trennlinie'))}">―</button>`}
        <button type="button" data-link="1" title="${esc(T('Link'))}">🔗</button><button type="button" data-c="removeFormat" title="${esc(T('Formatierung entfernen'))}">T̸</button>
        <span class="grow"></span>
        ${placeholders ? `<select data-ph="1" aria-label="${esc(T('Platzhalter einfügen'))}"><option value="">${esc(T('Platzhalter …'))}</option>${[['briefanrede', 'Briefanrede (z. B. „Hallo Anna“)'], ['vorname', 'Vorname'], ['nachname', 'Nachname'], ['name', 'Vor- und Nachname'], ['anrede', 'Anrede'], ['mitgliedsnr', 'Mitgliedsnummer'], ['verein', 'Vereinsname']].map(([k, l]) => `<option value="${k}">${esc(T(l))}</option>`).join('')}</select>` : ''}
        ${templates ? `<select data-tpl="1" aria-label="${esc(T('Vorlage einsetzen'))}"><option value="">${esc(T('Vorlage …'))}</option>${O.templates.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>` : ''}
      </div><div class="ml-ed" contenteditable="true" data-ph="${esc(T('Text schreiben …'))}"></div>`;
    const ed = host.querySelector('.ml-ed');
    ed.innerHTML = cleanHtml(html || '');
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* alt */ }
    const fire = () => { if (onInput) onInput(ed.innerHTML); };
    ed.addEventListener('input', fire);
    ed.addEventListener('paste', e => {
      const cd = e.clipboardData; if (!cd) return;
      e.preventDefault();
      const h = cd.getData('text/html');
      if (h) document.execCommand('insertHTML', false, cleanHtml(h));
      else document.execCommand('insertText', false, cd.getData('text/plain'));
    });
    ed.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) e.preventDefault(); });
    let saved = null;
    const keep = () => { const s = window.getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) saved = s.getRangeAt(0).cloneRange(); };
    const back = () => { ed.focus(); if (saved) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); } };
    ed.addEventListener('keyup', keep); ed.addEventListener('mouseup', keep); ed.addEventListener('blur', keep);
    host.querySelectorAll('[data-c]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { back(); document.execCommand(b.dataset.c, false, null); fire(); }; });
    host.querySelectorAll('[data-b]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { back(); const cur = document.queryCommandValue('formatBlock'); document.execCommand('formatBlock', false, String(cur).toUpperCase() === b.dataset.b ? 'P' : b.dataset.b); fire(); }; });
    host.querySelector('[data-link]').onmousedown = e => e.preventDefault();
    host.querySelector('[data-link]').onclick = async () => {
      keep();
      const sel = saved ? saved.toString() : '';
      let url = await askText(T('Link einfügen'), sel && /^(https?:|www\.)/i.test(sel) ? sel : 'https://', { ok: T('Einfügen') });
      if (!url) return;
      url = url.trim(); if (/^www\./i.test(url)) url = 'https://' + url; if (okMail(url)) url = 'mailto:' + url;
      if (!/^(https?:\/\/|mailto:)/i.test(url)) return toast(T('Bitte eine Adresse mit https:// eintragen.'), true);
      back();
      if (sel) document.execCommand('createLink', false, url);
      else document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(url.replace(/^mailto:/, ''))}</a>&nbsp;`);
      fire();
    };
    const ph = host.querySelector('[data-ph]');
    if (ph) ph.onchange = () => { if (!ph.value) return; back(); document.execCommand('insertText', false, `{${ph.value}}`); ph.value = ''; fire(); };
    return { el: ed, html: () => ed.innerHTML, set: h => { ed.innerHTML = cleanHtml(h || ''); fire(); }, tpl: host.querySelector('[data-tpl]') };
  }

  /* ---------- Seite ---------- */
  GK.registerPage({ key: 'email', title: 'E-Mail', perm: 'email', group: 'verein', before: 'benutzer', icon: 'mail' });
  GK.RENDER.email = async () => {
    O = await api('mail/options');
    $('main').innerHTML = `<h2 class="page">E-Mail</h2>
      <p class="lead">Mails an Mitglieder, Gruppen, Verteiler und freie Adressen – mit Formatierung, Anhängen und Platzhaltern. Gesendet wird über das Vereinspostfach mit deinem Namen; Antworten gehen an die Adresse unter „Absender“, ohne Eintrag ans Vereinspostfach.</p>
      ${O.ready ? '' : `<div class="banner a">${esc(T('Noch kein Postfach eingerichtet – Mails können erst nach Einstellungen → Postfach gesendet werden. Entwürfe gehen schon.'))}</div>`}
      <div id="mlTabs"></div>`;
    tabsCtl = GK.tabs($('mlTabs'), 'email', [['neu', 'Neue E-Mail'], ['entwuerfe', 'Entwürfe'], ['gesendet', 'Gesendet'], ['verteiler', 'Verteiler'], ['vorlagen', 'Vorlagen'], ['absender', 'Absender']], async (k, body) => {
      O = await api('mail/options');
      if (k === 'neu') return compose(body);
      if (k === 'entwuerfe' || k === 'gesendet') return folder(body, k);
      if (k === 'verteiler') return showLists(body);
      if (k === 'vorlagen') return showTemplates(body);
      return showMe(body);
    });
  };
  const goTab = k => { const b = document.querySelector(`#mlTabs [data-tab="${k}"]`); if (b) b.click(); };

  /* Verfassen */
  async function compose(body) {
    let id = openDraft, d = null; openDraft = null;
    if (id) { try { d = await api('mail/messages/' + id); } catch (e) { id = null; } }
    const st = { subject: d ? d.subject : '', html: d ? d.html : '', spec: d ? d.spec : emptySpec(), copy_me: d ? d.copy_me : Boolean(O.me.reply_to), files: d ? d.files : [] };
    if (!st.spec.lists) st.spec.lists = [];
    const me = O.me;
    body.innerHTML = `<div class="card ml-card" id="mlBox">
        <div class="ml-line"><b>${esc(T('Von'))}</b><div class="ml-from"><span translate="no"><b>${esc(me.name || '–')}</b> · ${esc(O.club)} ${O.from ? `&lt;${esc(O.from)}&gt;` : `<span class="muted">(${esc(T('noch kein Postfach'))})</span>`}</span>
          <span class="muted">${me.reply_to ? `${esc(T('Antworten an'))} <span translate="no">${esc(me.reply_to)}</span>` : esc(T('Antworten gehen ans Vereinspostfach'))} · <a href="#" id="mlMe">${esc(T('ändern'))}</a></span></div></div>
        <div class="ml-line"><b>${esc(T('An'))}</b><div class="ml-chips" id="mlTo"></div></div>
        <div class="ml-meta"><label class="chk"><input type="checkbox" id="mlPayer" ${st.spec.payer !== false ? 'checked' : ''}> ${esc(T('Ohne eigene Adresse an den Zahler (z. B. Eltern)'))}</label>
          <label class="chk"><input type="checkbox" id="mlCopy" ${st.copy_me ? 'checked' : ''}> ${esc(T('Kopie an mich'))}</label><span class="ml-cnt" id="mlCnt"></span></div>
        <div class="ml-line"><b>${esc(T('Betreff'))}</b><input class="ml-sub" id="mlSub" maxlength="200" value="${esc(st.subject)}" placeholder="${esc(T('Worum geht es?'))}"></div>
        <div id="mlEd"></div>
        ${me.signature ? `<div class="ml-sig" title="${esc(T('Unterschrift – unter „Absender“ änderbar'))}">${me.signature}</div>` : ''}
        <div class="ml-files" id="mlFiles"></div>
        <div class="ml-foot"><span class="st" id="mlSt">${d ? esc(T('Entwurf vom')) + ' ' + deT(d.updated_at || d.created_at) : ''}</span>
          <button class="btn ghost" id="mlTpl">${esc(T('Als Vorlage speichern'))}</button><button class="btn ghost" id="mlDel">${esc(T('Verwerfen'))}</button>
          <button class="btn" id="mlPrev">${esc(T('Vorschau'))}</button><button class="btn primary" id="mlSend">${esc(T('Senden …'))}</button></div></div>`;
    $('mlMe').onclick = e => { e.preventDefault(); goTab('absender'); };
    // Speichern: Entwurf beim ersten Tippen anlegen, danach kurz nach jeder Änderung
    let timer = 0, saving = null, dirtyN = 0;
    const payload = () => ({ subject: $('mlSub').value, html: ed.html(), spec: st.spec, copy_me: $('mlCopy').checked });
    const empty = () => !$('mlSub').value.trim() && !ed.el.textContent.trim() && !st.spec.groups.length && !st.spec.members.length && !st.spec.addresses.length && !st.spec.lists.length && !st.files.length;
    const save = async () => {
      clearTimeout(timer);
      if (saving) await saving;
      if (!id && empty()) return;
      const n = dirtyN;
      saving = (async () => {
        if (!id) id = (await api('mail/drafts', 'POST', payload())).id;
        else await api('mail/drafts/' + id, 'PUT', payload());
        if ($('mlSt')) $('mlSt').textContent = `${T('Entwurf gespeichert')} ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
      })();
      try { await saving; if (n === dirtyN) GK.clean && GK.clean(); } catch (e) { if ($('mlSt')) $('mlSt').textContent = e.message; } finally { saving = null; }
    };
    const touch = () => { dirtyN++; clearTimeout(timer); timer = setTimeout(() => { save(); count(); }, 1200); if ($('mlSt')) $('mlSt').textContent = T('Ungespeichert …'); };
    // Empfängerzahl (über die Vorschau des Servers, damit Familien und Zahler genau so gezählt werden wie beim Senden)
    let cTimer = 0;
    const count = () => {
      clearTimeout(cTimer);
      cTimer = setTimeout(async () => {
        const has = st.spec.groups.length + st.spec.members.length + st.spec.addresses.length + st.spec.lists.length;
        if (!has) { $('mlCnt').textContent = ''; return; }
        try { await save(); if (!id) return; const p = await api(`mail/drafts/${id}/preview`, 'POST', {}); const el = $('mlCnt'); if (!el) return;
          el.textContent = `${p.count} ${p.count === 1 ? T('Empfänger') : T('Empfänger')}${p.withoutCount ? ` · ${p.withoutCount} ${T('ohne E-Mail')}` : ''}${p.bad.length ? ` · ${p.bad.length} ${T('ungültig')}` : ''}`;
          el.classList.toggle('warn', Boolean(p.withoutCount || p.bad.length)); } catch (e) { /* still */ }
      }, 400);
    };
    picker($('mlTo'), st.spec, { onChange: () => { touch(); count(); } });
    const ed = editor($('mlEd'), st.html, { onInput: touch, templates: true });
    if (ed.tpl) ed.tpl.onchange = async () => {
      const t = O.templates.find(x => x.id === +ed.tpl.value); ed.tpl.value = ''; if (!t) return;
      if (ed.el.textContent.trim() && !await ask(`${T('Vorlage einsetzen?')}\n\n${T('Betreff und Text werden durch die Vorlage ersetzt.')}`, { ok: T('Einsetzen') })) return;
      if (t.subject) $('mlSub').value = t.subject; ed.set(t.html); touch();
    };
    $('mlSub').oninput = touch;
    $('mlCopy').onchange = touch;
    $('mlPayer').onchange = () => { st.spec.payer = $('mlPayer').checked; touch(); count(); };
    count();

    // Anhänge
    const drawFiles = () => {
      $('mlFiles').innerHTML = `${st.files.map(f => `<span class="ml-file" translate="no"><b title="${esc(f.name)}">📎 ${esc(f.name)}</b><small>${kb(f.size)}</small><button type="button" data-fx="${f.id}" aria-label="${esc(T('Anhang entfernen'))}">×</button></span>`).join('')}
        <label class="btn small ghost" style="cursor:pointer">＋ ${esc(T('Datei anhängen'))}<input type="file" id="mlFile" multiple hidden></label>
        <span class="muted s">${st.files.length ? `${kb(st.files.reduce((s, f) => s + f.size, 0))} ${esc(T('von 20 MB'))}` : esc(T('oder Dateien hierher ziehen · bis 10 MB je Datei'))}</span>`;
      $('mlFile').onchange = () => upload([...$('mlFile').files]);
      $('mlFiles').querySelectorAll('[data-fx]').forEach(b => { b.onclick = async () => { try { await api(`mail/drafts/${id}/files/${b.dataset.fx}`, 'DELETE'); st.files = st.files.filter(f => f.id !== b.dataset.fx); drawFiles(); } catch (e) { fail(e); } }; });
    };
    const upload = async list => {
      if (!list.length) return;
      if (!id) { dirtyN++; id = (await api('mail/drafts', 'POST', payload())).id; }
      for (const f of list) {
        if ($('mlSt')) $('mlSt').textContent = `${T('Lade hoch')}: ${f.name} …`;
        try {
          const r = await fetch(`api/admin/mail/drafts/${id}/files`, { method: 'POST', headers: { 'X-Clubwerk': '1', 'Content-Type': 'application/octet-stream', 'X-Name': encodeURIComponent(f.name), 'X-Type': f.type || '' }, body: f });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || T('Hochladen fehlgeschlagen.'));
          st.files = j.files;
        } catch (e) { toast(`${f.name}: ${e.message}`, true); }
      }
      if ($('mlSt')) $('mlSt').textContent = T('Entwurf gespeichert');
      drawFiles();
    };
    drawFiles();
    const box = $('mlBox');
    box.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); box.classList.add('ml-drop'); } });
    box.addEventListener('dragleave', e => { if (!box.contains(e.relatedTarget)) box.classList.remove('ml-drop'); });
    box.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); box.classList.remove('ml-drop'); upload([...e.dataTransfer.files]); } });

    $('mlDel').onclick = async () => {
      if (!id) { compose(body); return; }
      if (!await ask(`${T('Entwurf verwerfen?')}\n\n${T('Text, Empfänger und Anhänge werden gelöscht.')}`, { ok: T('Verwerfen'), danger: true })) return;
      clearTimeout(timer); try { await api('mail/drafts/' + id, 'DELETE'); toast(T('Entwurf verworfen.')); id = null; compose(body); } catch (e) { fail(e); }
    };
    $('mlTpl').onclick = async () => {
      if (!ed.el.textContent.trim()) return toast(T('Bitte zuerst einen Text schreiben.'), true);
      const name = await askText(T('Name der Vorlage'), $('mlSub').value.trim(), { ok: T('Speichern') }); if (!name) return;
      try { await api('mail/templates', 'POST', { name, subject: $('mlSub').value, html: ed.html() }); O = await api('mail/options'); toast(T('Vorlage gespeichert.')); } catch (e) { fail(e); }
    };
    const preview = async sendMode => {
      await save();
      if (!id) return toast(T('Bitte Empfänger, Betreff und Text eintragen.'), true);
      const p = await api(`mail/drafts/${id}/preview`, 'POST', {});
      dialog(`<h2>${esc(sendMode ? T('E-Mail senden') : T('Vorschau'))}</h2>
        ${p.errors.length ? `<div class="banner r" style="font-weight:400">${p.errors.map(esc).join('<br>')}</div>` : ''}
        <dl class="ml-kv"><dt>${esc(T('Von'))}</dt><dd translate="no">${esc(p.from)}</dd><dt>${esc(T('Antworten an'))}</dt><dd translate="no">${esc(p.reply_to || T('Vereinspostfach'))}</dd>
          <dt>${esc(T('An'))}</dt><dd><b>${p.count}</b> ${esc(T('Empfänger'))}${p.count ? ` · <a href="#" id="mlRcShow">${esc(T('anzeigen'))}</a>` : ''}${$('mlCopy').checked ? ` · ${esc(T('plus Kopie an dich'))}` : ''}</dd>
          ${p.withoutCount ? `<dt>${esc(T('Ohne E-Mail'))}</dt><dd>${p.withoutCount}: <span translate="no">${esc(p.without.slice(0, 15).join(', '))}${p.withoutCount > 15 ? ' …' : ''}</span></dd>` : ''}
          ${st.files.length ? `<dt>${esc(T('Anhänge'))}</dt><dd translate="no">${st.files.map(f => esc(f.name)).join(', ')} (${kb(st.files.reduce((s, f) => s + f.size, 0))})</dd>` : ''}</dl>
        <div class="ml-rc hidden" id="mlRc"><table class="tbl">${p.rcpt.map(r => `<tr><td translate="no">${esc(window.CWNames.lastFirst(r.name))}${r.via ? ` <span class="muted s">(${esc(T('über'))} ${esc(r.via)})</span>` : ''}</td><td translate="no" class="muted s">${esc(r.email)}</td></tr>`).join('')}</table></div>
        ${p.sample.to ? `<p class="muted s" style="margin:14px 0 6px">${esc(T('So sieht es bei'))} <span translate="no">${esc(p.sample.to)}</span> ${esc(T('aus'))}:</p>` : ''}
        <div class="ml-view"><h3 style="margin-top:0" translate="no">${esc(p.sample.subject)}</h3><div translate="no">${p.sample.html}</div></div>
        <div class="btns"><button class="btn ghost" id="c">${esc(sendMode ? T('Abbrechen') : T('Schließen'))}</button>${sendMode && !p.errors.length && p.ready ? `<button class="btn primary" id="go">${esc(T('Jetzt an'))} ${p.count} ${esc(T('senden'))}</button>` : ''}</div>`, true);
      $('c').onclick = closeDialog;
      if ($('mlRcShow')) $('mlRcShow').onclick = e => { e.preventDefault(); $('mlRc').classList.toggle('hidden'); };
      if (!p.ready && sendMode) toast(T('Erst unter Einstellungen → Postfach das Vereinspostfach eintragen.'), true);
      if ($('go')) $('go').onclick = async () => {
        $('go').disabled = true;
        try { const r = await api(`mail/drafts/${id}/send`, 'POST', {}); closeDialog(); toast(`${T('Wird gesendet an')} ${r.count} ${T('Empfänger')}.`); GK.clean && GK.clean(); const sent = id; id = null; showMessage(body, sent, 'gesendet'); markTab('gesendet'); }
        catch (e) { $('go').disabled = false; fail(e); }
      };
    };
    $('mlPrev').onclick = () => preview(false).catch(fail);
    $('mlSend').onclick = () => preview(true).catch(fail);
  }
  const markTab = k => { try { sessionStorage.setItem('tab_email', k); } catch (e) { /* egal */ } document.querySelectorAll('#mlTabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === k)); };

  /* Entwürfe und Gesendet */
  async function folder(body, box) {
    const r = await api('mail/messages?box=' + box);
    const draftBtn = document.querySelector('#mlTabs [data-tab="entwuerfe"]'); if (draftBtn) draftBtn.innerHTML = `${esc(T('Entwürfe'))}${r.drafts ? ` <span class="cnt">${r.drafts}</span>` : ''}`;
    if (!r.rows.length) { body.innerHTML = `<div class="card"><p class="muted" style="margin:0">${esc(box === 'entwuerfe' ? T('Keine Entwürfe. Was du in „Neue E-Mail“ schreibst, wird automatisch hier gespeichert.') : T('Noch keine E-Mail gesendet.'))}</p></div>`; return; }
    const stPill = m => (m.status === 'sendet' ? `<span class="pill a">${esc(T('wird gesendet'))} ${m.sent || ''}</span>` : m.status === 'teilweise' ? `<span class="pill r">${m.failed} ${esc(T('fehlgeschlagen'))}</span>` : m.status === 'gesendet' ? `<span class="pill g">${m.total} ${esc(T('zugestellt'))}</span>` : '');
    body.innerHTML = `<div class="card"><div class="ml-list">${r.rows.map(m => `<button type="button" class="ml-row" data-id="${m.id}">
        <span class="t"><b translate="no">${m.files ? '📎 ' : ''}${esc(m.subject || T('(ohne Betreff)'))}</b><span translate="no">${esc(m.preview || '')}</span></span>
        <span class="c who" translate="no">${esc(box === 'entwuerfe' ? '' : m.from_name || m.user_name || '')}</span>
        <span class="c">${deT(m.at)}</span><span class="c r">${box === 'entwuerfe' ? esc(T('Entwurf')) : stPill(m)}</span></button>`).join('')}</div></div>`;
    body.querySelectorAll('[data-id]').forEach(b => { b.onclick = () => { if (box === 'entwuerfe') { openDraft = +b.dataset.id; goTabForce('neu'); } else showMessage(body, +b.dataset.id, box); }; });
  }
  const goTabForce = k => { markTab(k); if (tabsCtl) tabsCtl.reload(); };

  async function showMessage(body, id, back) {
    let poll = 0;
    const draw = async () => {
      if (!document.body.contains(body)) return;
      const m = await api('mail/messages/' + id);
      const done = m.rcpt.filter(r => r.status !== 'wartet').length;
      const me = GK.me();
      body.innerHTML = `<div class="card">
        <div class="row" style="align-items:center;margin-bottom:12px"><button class="btn small ghost" id="mlBack">← ${esc(T('Gesendet'))}</button><span style="flex:1"></span>
          <button class="btn small" id="mlCopyM">${esc(T('Weiterverwenden'))}</button>${m.status === 'teilweise' ? `<button class="btn small" id="mlRetry">${esc(T('Fehlgeschlagene erneut senden'))}</button>` : ''}
          ${m.status !== 'sendet' && me && (m.user_name === (me.name || me.username) || me.role === 'oberadmin') ? `<button class="btn small danger" id="mlRm">${esc(T('Löschen'))}</button>` : ''}</div>
        <h3 style="margin:0 0 10px;font-size:19px" translate="no">${esc(m.subject)}</h3>
        <dl class="ml-kv"><dt>${esc(T('Von'))}</dt><dd translate="no">${esc(m.from_name || m.user_name || '')} · ${esc(O.club)}</dd>
          <dt>${esc(T('Antworten an'))}</dt><dd translate="no">${esc(m.reply_to || T('Vereinspostfach'))}</dd><dt>${esc(T('Gesendet'))}</dt><dd>${deT(m.sent_at)}</dd>
          <dt>${esc(T('Empfänger'))}</dt><dd>${m.total}${m.status === 'sendet' ? ` · ${esc(T('wird gesendet'))} (${done}/${m.rcpt.length})<div class="ml-prog"><i style="width:${m.rcpt.length ? Math.round(done / m.rcpt.length * 100) : 0}%"></i></div>` : ` · ${m.sent} ${esc(T('zugestellt'))}${m.failed ? `, <b style="color:var(--red)">${m.failed} ${esc(T('fehlgeschlagen'))}</b>` : ''}`}</dd>
          ${m.files.length ? `<dt>${esc(T('Anhänge'))}</dt><dd style="display:flex;flex-wrap:wrap;gap:6px">${m.files.map(f => `<a class="ml-file" href="api/admin/mail/messages/${m.id}/files/${encodeURIComponent(f.id)}" download translate="no"><b>📎 ${esc(f.name)}</b><small>${kb(f.size)}</small></a>`).join('')}</dd>` : ''}</dl>
        <div class="ml-view" translate="no">${m.html}${m.signature_html ? `<div style="margin-top:20px">${m.signature_html}</div>` : ''}</div>
        <h3 style="margin:18px 0 8px">${esc(T('Zustellung'))}</h3>
        <div class="ml-rc"><table class="tbl"><tr><th>${esc(T('Name'))}</th><th>${esc(T('E-Mail'))}</th><th>${esc(T('Status'))}</th></tr>${m.rcpt.map(r => `<tr><td translate="no">${esc(r.name || '')}${r.via ? ` <span class="muted s">(${esc(T('über'))} ${esc(r.via)})</span>` : ''}</td><td translate="no" class="muted s">${esc(r.email)}</td>
          <td>${r.status === 'ok' ? `<span class="pill g">${esc(T('zugestellt'))}</span>` : r.status === 'fehler' ? `<span class="pill r" title="${esc(r.error || '')}">${esc(T('Fehler'))}</span> <span class="muted s">${esc((r.error || '').slice(0, 80))}</span>` : `<span class="pill">${esc(T('wartet'))}</span>`}</td></tr>`).join('')}</table></div></div>`;
      $('mlBack').onclick = () => { clearTimeout(poll); markTab(back); folder(body, back).catch(fail); };
      $('mlCopyM').onclick = async () => { try { const r = await api(`mail/messages/${id}/copy`, 'POST', {}); clearTimeout(poll); openDraft = r.id; goTabForce('neu'); toast(T('Als neuer Entwurf geöffnet.')); } catch (e) { fail(e); } };
      if ($('mlRetry')) $('mlRetry').onclick = async () => { try { const r = await api(`mail/messages/${id}/retry`, 'POST', {}); toast(`${T('Wird erneut gesendet an')} ${r.n}.`); draw(); } catch (e) { fail(e); } };
      if ($('mlRm')) $('mlRm').onclick = async () => { if (!await ask(`${T('E-Mail aus „Gesendet“ löschen?')}\n\n${T('Die Mail und die Zustellliste werden gelöscht. Bei den Empfängern bleibt sie natürlich.')}`)) return; try { await api('mail/messages/' + id, 'DELETE'); toast(T('Gelöscht.')); markTab(back); folder(body, back); } catch (e) { fail(e); } };
      if (m.status === 'sendet') poll = setTimeout(() => draw().catch(() => {}), 1500);
    };
    await draw();
  }

  /* Verteiler */
  async function showLists(body) {
    body.innerHTML = `<div class="card"><div class="row" style="align-items:center;margin-bottom:6px"><h3 style="margin:0;flex:1">${esc(T('Verteiler'))} <span class="muted s">(${O.lists.length})</span></h3><button class="btn primary" id="mlLNew">＋ ${esc(T('Neuer Verteiler'))}</button></div>
      <p class="muted s" style="margin:0 0 10px">${esc(T('Gespeicherte Empfängerlisten wie „Vorstand“, „Trainer“ oder „Sponsoren“ – für alle mit dem Recht „E-Mail“. Gruppen bleiben aktuell: Wer neu in die Abteilung kommt, ist automatisch dabei.'))}</p>
      ${O.lists.length ? `<table class="tbl"><tr><th>${esc(T('Name'))}</th><th>${esc(T('Inhalt'))}</th><th></th></tr>${O.lists.map(l => `<tr><td><b>${esc(l.name)}</b></td><td class="muted s">${esc(specText(l.spec))}</td>
        <td class="r" style="white-space:nowrap"><button class="btn small" data-lw="${l.id}">${esc(T('Mail schreiben'))}</button> <button class="btn small" data-le="${l.id}">${esc(T('Bearbeiten'))}</button></td></tr>`).join('')}</table>` : `<p class="muted">${esc(T('Noch keine Verteiler.'))}</p>`}</div>`;
    $('mlLNew').onclick = () => listDialog(null, body);
    body.querySelectorAll('[data-le]').forEach(b => { b.onclick = () => listDialog(O.lists.find(l => l.id === +b.dataset.le), body); });
    body.querySelectorAll('[data-lw]').forEach(b => { b.onclick = async () => { try { const r = await api('mail/drafts', 'POST', { spec: { ...emptySpec(), lists: [+b.dataset.lw] } }); openDraft = r.id; goTabForce('neu'); } catch (e) { fail(e); } }; });
  }
  const specText = s => [s.groups.length && `${s.groups.length} ${T(s.groups.length === 1 ? 'Gruppe' : 'Gruppen')}`, s.members.length && `${s.members.length} ${T(s.members.length === 1 ? 'Mitglied' : 'Mitglieder')}`, s.addresses.length && `${s.addresses.length} ${T(s.addresses.length === 1 ? 'Adresse' : 'Adressen')}`].filter(Boolean).join(' · ');
  function listDialog(l, body) {
    const spec = l ? JSON.parse(JSON.stringify(l.spec)) : emptySpec(); delete spec.lists;
    dialog(`<h2>${esc(l ? T('Verteiler bearbeiten') : T('Neuer Verteiler'))}</h2>
      <label class="f">${esc(T('Name'))}<input id="lN" maxlength="60" value="${esc(l ? l.name : '')}" placeholder="${esc(T('z. B. Vorstand'))}"></label>
      <label class="f" style="margin-top:10px">${esc(T('Empfänger'))}</label><div class="ml-chips" id="lTo" style="border:1px solid var(--line);border-radius:12px;padding:6px 10px;min-height:44px"></div>
      <p class="muted s">${esc(T('Gruppen, Mitglieder oder Adressen (auch „Name <adresse@beispiel.de>“). Mehrere Adressen mit Komma einfügen.'))}</p>
      <div class="err" id="lErr"></div>
      <div class="btns">${l ? `<button class="btn danger" id="lDel" style="margin-right:auto">${esc(T('Löschen'))}</button>` : ''}<button class="btn ghost" id="c">${esc(T('Abbrechen'))}</button><button class="btn primary" id="ok">${esc(T('Speichern'))}</button></div>`);
    picker($('lTo'), spec, { lists: false });
    $('c').onclick = closeDialog;
    $('ok').onclick = async () => { try { if (l) await api('mail/lists/' + l.id, 'PUT', { name: $('lN').value, spec }); else await api('mail/lists', 'POST', { name: $('lN').value, spec }); closeDialog(); toast(T('Gespeichert.')); O = await api('mail/options'); showLists(body); } catch (e) { $('lErr').textContent = e.message; } };
    if ($('lDel')) $('lDel').onclick = async () => { if (!await ask(`${T('Verteiler löschen?')}\n\n„${l.name}“`)) return; try { await api('mail/lists/' + l.id, 'DELETE'); closeDialog(); toast(T('Gelöscht.')); O = await api('mail/options'); showLists(body); } catch (e) { fail(e); } };
  }

  /* Vorlagen */
  async function showTemplates(body) {
    body.innerHTML = `<div class="card"><div class="row" style="align-items:center;margin-bottom:6px"><h3 style="margin:0;flex:1">${esc(T('Vorlagen'))} <span class="muted s">(${O.templates.length})</span></h3><button class="btn primary" id="mlTNew">＋ ${esc(T('Neue Vorlage'))}</button></div>
      <p class="muted s" style="margin:0 0 10px">${esc(T('Wiederkehrende Mails wie Einladung zur Mitgliederversammlung oder Saisonstart – beim Schreiben über „Vorlage …“ einsetzen. Platzhalter wie {briefanrede} werden je Empfänger ersetzt.'))}</p>
      ${O.templates.length ? `<table class="tbl"><tr><th>${esc(T('Name'))}</th><th>${esc(T('Betreff'))}</th><th></th></tr>${O.templates.map(t => `<tr><td><b>${esc(t.name)}</b></td><td class="muted s" translate="no">${esc(t.subject || '–')}</td>
        <td class="r" style="white-space:nowrap"><button class="btn small" data-tu="${t.id}">${esc(T('Verwenden'))}</button> <button class="btn small" data-te="${t.id}">${esc(T('Bearbeiten'))}</button></td></tr>`).join('')}</table>` : `<p class="muted">${esc(T('Noch keine Vorlagen.'))}</p>`}</div>`;
    $('mlTNew').onclick = () => tplDialog(null, body);
    body.querySelectorAll('[data-te]').forEach(b => { b.onclick = () => tplDialog(O.templates.find(t => t.id === +b.dataset.te), body); });
    body.querySelectorAll('[data-tu]').forEach(b => { b.onclick = async () => { const t = O.templates.find(x => x.id === +b.dataset.tu); try { const r = await api('mail/drafts', 'POST', { subject: t.subject, html: t.html, spec: emptySpec() }); openDraft = r.id; goTabForce('neu'); } catch (e) { fail(e); } }; });
  }
  function tplDialog(t, body) {
    dialog(`<h2>${esc(t ? T('Vorlage bearbeiten') : T('Neue Vorlage'))}</h2>
      <div class="row"><label class="f" style="flex:1;min-width:180px">${esc(T('Name'))}<input id="tN" maxlength="60" value="${esc(t ? t.name : '')}"></label><label class="f" style="flex:2;min-width:220px">${esc(T('Betreff'))}<input id="tS" maxlength="200" value="${esc(t ? t.subject : '')}"></label></div>
      <div class="card ml-card" style="margin-top:12px;box-shadow:none;border:1px solid var(--line)"><div id="tEd"></div></div>
      <div class="err" id="tErr"></div>
      <div class="btns">${t ? `<button class="btn danger" id="tDel" style="margin-right:auto">${esc(T('Löschen'))}</button>` : ''}<button class="btn ghost" id="c">${esc(T('Abbrechen'))}</button><button class="btn primary" id="ok">${esc(T('Speichern'))}</button></div>`, true);
    const ed = editor($('tEd'), t ? t.html : `<p>{briefanrede},</p><p><br></p>`);
    ed.el.style.minHeight = '220px';
    $('c').onclick = closeDialog;
    $('ok').onclick = async () => { try { const b = { name: $('tN').value, subject: $('tS').value, html: ed.html() }; if (t) await api('mail/templates/' + t.id, 'PUT', b); else await api('mail/templates', 'POST', b); closeDialog(); toast(T('Gespeichert.')); O = await api('mail/options'); showTemplates(body); } catch (e) { $('tErr').textContent = e.message; } };
    if ($('tDel')) $('tDel').onclick = async () => { if (!await ask(`${T('Vorlage löschen?')}\n\n„${t.name}“`)) return; try { await api('mail/templates/' + t.id, 'DELETE'); closeDialog(); toast(T('Gelöscht.')); O = await api('mail/options'); showTemplates(body); } catch (e) { fail(e); } };
  }

  /* Absender */
  function showMe(body) {
    const me = O.me;
    body.innerHTML = `<div class="card"><h3>${esc(T('Dein Absender'))}</h3>
      <p class="muted s" style="margin-top:0">${esc(T('Gesendet wird immer über das Vereinspostfach – so landen Mails nicht im Spam. Empfänger sehen deinen Namen, und wenn sie auf „Antworten“ tippen, geht die Antwort an deine Adresse.'))}</p>
      <div class="row"><label class="f" style="flex:1;min-width:200px">${esc(T('Name'))}<input id="meN" maxlength="60" value="${esc(me.name)}" placeholder="${esc(T('z. B. Anna Schmidt (Vorstand)'))}"></label>
        <label class="f" style="flex:1;min-width:240px">${esc(T('Antworten an'))}<input id="meR" type="email" maxlength="120" value="${esc(me.reply_to)}" placeholder="anna@beispiel.de"></label></div>
      <p class="muted s">${esc(T('Absender in den Mails'))}: <b translate="no" id="meP"></b></p>
      <label class="f" style="margin-top:6px">${esc(T('Unterschrift'))}</label><div class="card ml-card" style="box-shadow:none;border:1px solid var(--line)"><div id="meEd"></div></div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" id="meSave">${esc(T('Speichern'))}</button></div></div>`;
    const prev = () => { $('meP').textContent = `${$('meN').value.trim() ? $('meN').value.trim() + ' · ' : ''}${O.club}${O.from ? ` <${O.from}>` : ` (${T('noch kein Postfach')})`}`; };
    $('meN').oninput = prev; prev();
    const ed = editor($('meEd'), me.signature || '', { placeholders: false, minimal: true });
    ed.el.style.minHeight = '110px'; ed.el.dataset.ph = T('z. B. Viele Grüße, Anna Schmidt · 2. Vorsitzende · 0171 …');
    $('meSave').onclick = async () => { try { const r = await api('mail/me', 'PUT', { name: $('meN').value, reply_to: $('meR').value, signature: ed.el.textContent.trim() ? ed.html() : '' }); O.me = r.me; toast(T('Gespeichert.')); } catch (e) { fail(e); } };
  }
});
