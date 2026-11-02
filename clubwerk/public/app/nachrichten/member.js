'use strict';
/* Nachrichten – Postfach in der Mitglieder-App: Liste (ungelesene fett, angeheftete zuerst), einzelne Nachricht, Anhänge.
   Alles bleibt in der App: Anhänge öffnen in einem Blatt über der Seite, Links sind nur Text (kein neues Fenster, kein Safari). */
(() => {
  if (!window.VA) return;
  if (!document.getElementById('nxStyle')) {
    const s = document.createElement('style'); s.id = 'nxStyle';
    s.textContent = `
      .nx-row .vh-tx { min-width: 0; flex: 1; }
      .nx-row .vh-tx strong { overflow-wrap: anywhere; }
      .nx-row .vh-tx .nx-pre { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
      .nx-row.read strong { font-weight: 600; }
      .nx-row .vh-fm-ico { position: relative; }
      .nx-row:not(.read) .vh-fm-ico::after { content: ''; position: absolute; top: 5px; right: 5px; width: 10px; height: 10px; border-radius: 50%; background: var(--brand); border: 2px solid var(--card); }
      .nx-head { margin: 0 0 4px; font-size: 19px; line-height: 1.3; font-weight: 800; color: var(--ink); overflow-wrap: anywhere; }
      .nx-meta { margin: 0 0 14px; font-size: 13px; color: var(--muted); }
      .nx-body { font-size: 15px; line-height: 1.55; color: var(--ink); overflow-wrap: anywhere; }
      .nx-body p, .nx-body div { margin: 0 0 10px; }
      .nx-body h2, .nx-body h3 { margin: 14px 0 6px; font-size: 16px; line-height: 1.3; }
      .nx-body ul, .nx-body ol { margin: 0 0 10px; padding-left: 22px; }
      .nx-body blockquote { margin: 0 0 10px; padding: 2px 0 2px 12px; border-left: 3px solid var(--line); color: var(--muted); }
      .nx-body hr { border: 0; border-top: 1px solid var(--line); margin: 12px 0; }
      .nx-body .vh-url { color: var(--brand-ink); font-weight: 600; overflow-wrap: anywhere; }
      .nx-files > button { text-align: left; font: inherit; color: inherit; background: none; border: 0; border-top: 1px solid var(--line); cursor: pointer; }
      .nx-files > button:first-child { border-top: 0; }
      .nx-view { display: flex; align-items: center; justify-content: center; max-height: 60vh; overflow: auto; background: var(--hover); border-radius: 12px; margin: 0 0 12px; }
      .nx-view img { max-width: 100%; height: auto; display: block; }
      .nx-view iframe { width: 100%; height: 58vh; border: 0; background: #fff; }
      .nx-q { margin: 0 0 12px; font-size: 16px; line-height: 1.4; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
      .nx-opt { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); font-size: 15px; cursor: pointer; }
      .nx-opt:first-child { border-top: 0; padding-top: 2px; }
      .nx-opt input { width: 22px; height: 22px; flex: none; margin: 0; accent-color: var(--brand); }
      .nx-opt .vh-tx { min-width: 0; flex: 1; overflow-wrap: anywhere; }
      .nx-bar { height: 6px; border-radius: 3px; background: var(--hover); margin-top: 6px; overflow: hidden; } .nx-bar i { display: block; height: 100%; background: var(--brand); border-radius: 3px; }
      .nx-opt b { font-variant-numeric: tabular-nums; white-space: nowrap; }`;
    document.head.appendChild(s);
  }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const deD = s => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '');
  const kb = n => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`);
  const MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>';
  const CHEV = '<svg class="vh-fm-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const CLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>';

  window.VA.registerSection({
    id: 'nachrichten',
    render(el, ctx) {
      let blobUrl = '';
      const sheet = () => { let sh = document.getElementById('nxFile'); if (!sh) { sh = document.createElement('div'); sh.id = 'nxFile'; sh.className = 'vh-sheet'; document.body.appendChild(sh); } return sh; };
      const closeFile = () => { const sh = document.getElementById('nxFile'); if (sh) sh.classList.remove('show'); if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ''; } };
      ctx.onLeave(closeFile);

      /* Anhang ansehen: Bilder und PDF im Blatt über der App, alles andere als Download (Teilen-Menü, wo das Handy es kann) */
      async function openFile(msgId, f) {
        let blob;
        try { blob = await ctx.blob(`file/${msgId}/${f.id}`); } catch (e) { ctx.toast(e.message, true); return; }
        if (f.kind === 'other') {
          const file = new File([blob], f.name, { type: blob.type });
          try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
          const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
          return;
        }
        closeFile(); blobUrl = URL.createObjectURL(blob);
        const sh = sheet();
        sh.innerHTML = `<div class="vh-box"><h2 translate="no">${esc(f.name)}</h2>
          <div class="nx-view">${f.kind === 'image' ? `<img src="${blobUrl}" alt="${esc(f.name)}">` : `<iframe src="${blobUrl}" title="${esc(f.name)}"></iframe>`}</div>
          <div class="vh-row"><button class="ok" id="nxX" type="button">Schließen</button></div></div>`;
        sh.querySelector('#nxX').onclick = closeFile;
        sh.classList.add('show');
      }

      async function open(id) {
        el.innerHTML = '<div class="vh-empty">Lade …</div>';
        let m;
        try { m = await ctx.api('msg/' + id); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div><button class="vh-btn sec" id="nxBack" type="button">Zurück zu den Nachrichten</button>`; el.querySelector('#nxBack').onclick = list; return; }
        el.innerHTML = `<div class="vh-card">
            <h3 class="nx-head" style="display:block" translate="no">${esc(m.subject)}</h3>
            <p class="nx-meta"><span translate="no">${esc(m.from)}</span>${m.from ? ' · ' : ''}${deD(m.at)}${m.pinned ? ' · <span class="vh-chip a">angeheftet</span>' : ''}</p>
            <div class="nx-body" translate="no">${m.html}</div></div>
          ${m.files.length ? `<div class="vh-card flush"><h3>Anhänge <small>${m.files.length}</small></h3><div class="vh-rows nx-files">${m.files.map((f, i) => `<button type="button" class="vh-fm" data-f="${i}"><span class="vh-fm-ico">${CLIP}</span><span class="vh-tx"><strong translate="no">${esc(f.name)}</strong><small>${kb(f.size)}</small></span>${CHEV}</button>`).join('')}</div></div>` : ''}
          <button class="vh-btn sec" id="nxBack" type="button" style="width:100%">Zurück zu den Nachrichten</button>`;
        el.querySelector('#nxBack').onclick = list;
        el.querySelectorAll('[data-f]').forEach(b => { b.onclick = () => openFile(m.id, m.files[+b.dataset.f]); });
        if (m.poll) { el.querySelector('.vh-card').insertAdjacentHTML('afterend', '<div class="vh-card" id="nxPoll"></div>'); pollCard(m.id, m.poll); }
      }

      /* Umfrage: Antworten antippen und „Abstimmen“ (ändern bis zum Ende); Ergebnis als Balken, wenn der Verein es zeigt */
      function pollCard(id, p) {
        const box = document.getElementById('nxPoll'); if (!box) return;
        const sum = p.counts ? Math.max(1, p.voters) : 0, voted = p.mine.length > 0;
        const ends = p.ends_at ? `bis ${p.ends_at.slice(8, 10)}.${p.ends_at.slice(5, 7)}. ${p.ends_at.slice(11, 16)} Uhr` : '';
        const state = !p.open ? '<span class="vh-chip">beendet</span>' : voted ? '<span class="vh-chip g">abgestimmt</span>' : '<span class="vh-chip a">offen</span>';
        box.innerHTML = `<h3>Umfrage ${state}</h3><p class="nx-q" translate="no">${esc(p.question)}</p>
          <div>${p.options.map((o, i) => `<label class="nx-opt"><input type="${p.multi ? 'checkbox' : 'radio'}" name="nxV" value="${i}" ${p.mine.includes(i) ? 'checked' : ''} ${p.open ? '' : 'disabled'}>
            <span class="vh-tx"><span translate="no">${esc(o)}</span>${p.counts ? `<div class="nx-bar"><i style="width:${Math.round(p.counts[i] / sum * 100)}%"></i></div>` : ''}</span>${p.counts ? `<b>${Math.round(p.counts[i] / sum * 100)} %</b>` : ''}</label>`).join('')}</div>
          <p class="vh-note" style="text-align:left;margin:10px 0 0">${[p.multi ? 'Mehrere Antworten möglich.' : '', p.anonymous ? 'Anonym – niemand sieht, was du gewählt hast.' : 'Der Verein sieht, was du gewählt hast.', p.counts ? `${p.voters} ${p.voters === 1 ? 'Stimme' : 'Stimmen'}.` : p.show === 'ende' && p.open ? 'Das Ergebnis siehst du nach dem Ende.' : p.show === 'nie' ? 'Das Ergebnis sieht nur der Verein.' : '', p.open && ends ? `Abstimmen ${ends}.` : ''].filter(Boolean).join(' ')}</p>
          ${p.open ? `<button class="vh-btn wide" id="nxVote" type="button" style="margin-top:12px">${voted ? 'Stimme ändern' : 'Abstimmen'}</button>` : ''}`;
        const b = box.querySelector('#nxVote');
        if (b) b.onclick = async () => {
          const choices = [...box.querySelectorAll('input[name="nxV"]:checked')].map(x => +x.value);
          if (!choices.length) return ctx.toast('Bitte eine Antwort wählen.', true);
          try { const r = await ctx.api('vote/' + id, 'POST', { choices }); ctx.toast(voted ? 'Stimme geändert.' : 'Danke für deine Stimme!'); pollCard(id, r.poll); } catch (e) { ctx.toast(e.message, true); }
        };
      }

      async function list() {
        let d;
        try { d = await ctx.api('list'); } catch (e) { el.innerHTML = `<div class="vh-empty">${esc(e.message)}</div>`; return; }
        if (!d.items.length) { el.innerHTML = '<div class="vh-empty">Keine Nachrichten. Was der Verein dir schickt, erscheint hier.</div>'; return; }
        el.innerHTML = `<div class="vh-card flush"><h3>Nachrichten${d.unread ? ` <small>${d.unread} neu</small>` : ''}</h3><div class="vh-rows">${d.items.map(m => `<button type="button" class="vh-fm nx-row${m.read ? ' read' : ''}" data-id="${m.id}">
            <span class="vh-fm-ico">${MAIL}</span>
            <span class="vh-tx"><strong translate="no">${esc(m.subject)}</strong><small class="nx-pre" translate="no">${esc(m.preview)}</small><small>${deD(m.at)}${m.from ? ' · ' + esc(m.from) : ''}${m.files ? ` · ${m.files} ${m.files === 1 ? 'Anhang' : 'Anhänge'}` : ''}${m.poll === 'offen' ? ' · <span class="vh-chip a">Umfrage</span>' : ''}${m.pinned ? ' · <span class="vh-chip a">angeheftet</span>' : ''}</small></span>${CHEV}</button>`).join('')}</div></div>`;
        el.querySelectorAll('[data-id]').forEach(b => { b.onclick = () => open(+b.dataset.id); });
      }

      if (ctx.focus) open(+ctx.focus); else { el.innerHTML = '<div class="vh-empty">Lade …</div>'; list(); }
    },
  });
})();
