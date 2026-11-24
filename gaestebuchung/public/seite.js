// Buchungsseite für Gäste: Tag und Zeit wählen, Angaben, bezahlen (PayPal-Knöpfe am Rechner, Weiterleitung am Handy).
(() => {
  const sec = document.getElementById('buchen');
  if (!sec) return;
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euro = c => (c / 100).toFixed(2).replace('.', ',') + ' €';
  const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const tagTxt = s => { const d = new Date(s + 'T12:00:00Z'); return [WT[d.getUTCDay()], `${s.slice(8, 10)}.${s.slice(5, 7)}.`]; };
  const imRahmen = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();
  const handy = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700;
  const art = sec.dataset.art;
  let daten = null, tag = null, wahl = null, laeuft = false;
  /* Turnstile (Sicherheitsprüfung von Cloudflare): ein Token je Reservierung, danach neu */
  let tsToken = '', tsId = null, tsSkript = null;
  function mensch() {
    const key = sec.dataset.turnstile, el = $('mensch');
    if (!key || !el || tsId !== null || art === 'test') return;
    tsSkript = tsSkript || new Promise((ok, nein) => { const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.onload = ok; s.onerror = nein; document.head.appendChild(s); });
    tsSkript.then(() => { tsId = window.turnstile.render(el, { sitekey: key, action: 'reservieren', language: 'de', callback: t => { tsToken = t; }, 'expired-callback': () => { tsToken = ''; }, 'error-callback': () => { tsToken = ''; } }); })
      .catch(() => zeige('Die Sicherheitsprüfung lässt sich gerade nicht laden. Bitte die Seite neu laden.'));
  }
  const tsVerbraucht = () => { tsToken = ''; if (tsId !== null && window.turnstile) window.turnstile.reset(tsId); };

  const zeige = text => { const f = $('fehler'); f.textContent = text || ''; f.hidden = !text; };
  const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.fehler || 'Das hat nicht geklappt. Bitte noch einmal versuchen.');
    return d;
  };
  function angaben() {
    const f = $('daten'), v = n => f.elements[n].value.trim();
    const a = { vorname: v('vorname'), nachname: v('nachname'), email: v('email'), telefon: v('telefon'), zustimmung: f.elements.zustimmung.checked };
    if (!a.vorname || !a.nachname) return [null, 'Bitte Vor- und Nachnamen angeben.'];
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(a.email)) return [null, 'Bitte eine gültige E-Mail-Adresse angeben.'];
    if (!/^\+?[0-9 ()/-]{6,30}$/.test(a.telefon)) return [null, 'Bitte eine Handynummer angeben.'];
    if (!a.zustimmung) return [null, 'Bitte den Hinweisen zu Datenschutz und Storno zustimmen.'];
    if (sec.dataset.turnstile && art !== 'test' && !tsToken) return [null, 'Bitte zuerst die Sicherheitsprüfung abschließen.'];
    return [{ ...a, platz: wahl.platz, datum: wahl.datum, beginn: wahl.beginn, turnstile: tsToken }, null];
  }

  function tage() {
    $('tage').innerHTML = daten.tage.map(t => { const [w, d] = tagTxt(t.datum); return `<button type="button" role="tab" class="tag${t.datum === tag ? ' an' : ''}" aria-selected="${t.datum === tag}" data-tag="${t.datum}"><span>${w}</span><b class="num">${d}</b></button>`; }).join('');
    $('tage').querySelectorAll('[data-tag]').forEach(b => { b.onclick = () => { tag = b.dataset.tag; wahl = null; $('daten').hidden = true; tage(); zeiten(); }; });
  }
  function zeiten() {
    const t = daten.tage.find(x => x.datum === tag);
    if (!t) { $('zeiten').innerHTML = '<p class="leer">Gerade sind keine Zeiten frei. Schau bald wieder vorbei.</p>'; return; }
    $('zeiten').innerHTML = t.plaetze.map(p => `<div class="platz"><h3>${esc(p.name)}</h3><div class="slots">${p.zeiten.map(z => {
      const an = wahl && wahl.platz === p.id && wahl.beginn === z.beginn;
      return `<button type="button" class="slot${an ? ' an' : ''}" aria-pressed="${Boolean(an)}" data-p="${p.id}" data-b="${z.beginn}"><b class="num">${z.beginn}–${z.ende}</b><span class="num">${euro(z.preis)}</span></button>`; }).join('')}</div></div>`).join('');
    $('zeiten').querySelectorAll('[data-p]').forEach(b => { b.onclick = () => {
      const p = t.plaetze.find(x => x.id === +b.dataset.p), z = p.zeiten.find(x => x.beginn === b.dataset.b);
      wahl = { platz: p.id, name: p.name, datum: tag, beginn: z.beginn, ende: z.ende, preis: z.preis };
      zeiten(); formular();
    }; });
  }
  function formular() {
    const f = $('daten'); f.hidden = false; zeige('');
    const [w, d] = tagTxt(wahl.datum);
    $('wahl').innerHTML = `<b>${esc(wahl.name)}</b> · ${w}, ${d} · <span class="num">${wahl.beginn}–${wahl.ende} Uhr</span> · <b class="num">${euro(wahl.preis)}</b>`;
    const z = $('zahlen');
    if (imRahmen && handy) {   // im Rahmen der Homepage am Handy: Seite selbst öffnen, dort per Weiterleitung zu PayPal (kein Popup)
      f.querySelectorAll('.felder, .info, .ja').forEach(e => { e.hidden = true; });
      const u = new URL('/', location.href); u.searchParams.set('platz', wahl.platz); u.searchParams.set('datum', wahl.datum); u.searchParams.set('beginn', wahl.beginn);
      z.innerHTML = `<a class="knopf voll" href="${esc(u.href)}" target="_top">Weiter zur Buchung</a><p class="klein">Die Buchungsseite öffnet sich groß – dort gibst du deine Angaben ein und bezahlst.</p>`;
    } else if (handy || art === 'test' || !sec.dataset.client) {
      z.innerHTML = '<button type="button" class="knopf pp voll" id="zPP">Mit PayPal bezahlen</button><button type="button" class="knopf karte voll" id="zKarte">Debit- oder Kreditkarte</button>';
      const los = karte => async () => {
        if (laeuft) return; const [a, err] = angaben(); if (err) return zeige(err);
        laeuft = true; zeige('');
        try { const r = await post('/api/v1/reservieren', { ...a, weg: 'weiterleitung', karte }); location.href = r.weiter; } catch (e) { zeige(e.message); laeuft = false; tsVerbraucht(); }
      };
      $('zPP').onclick = los(false); $('zKarte').onclick = los(true);
    } else knoepfe(z);
    if (!(imRahmen && handy)) mensch();
    f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  /* PayPal-Knöpfe (Standard-SDK): „PayPal“ und „Debit- oder Kreditkarte“ */
  let sdk = null;
  function knoepfe(z) {
    z.innerHTML = '<div id="ppKnopf"></div><div id="karteKnopf"></div>';
    sdk = sdk || new Promise((ok, nein) => { const s = document.createElement('script'); s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(sec.dataset.client)}&currency=EUR&intent=capture&components=buttons&locale=de_DE`; s.onload = ok; s.onerror = nein; document.head.appendChild(s); });
    sdk.then(() => {
      let ref = null, t = null;
      const opts = quelle => ({ fundingSource: quelle, style: { layout: 'vertical', shape: 'pill', label: 'pay' },
        onClick: (d, actions) => { const [, err] = angaben(); zeige(err || ''); return err ? actions.reject() : actions.resolve(); },
        createOrder: async () => { const [a] = angaben(); try { const r = await post('/api/v1/reservieren', { ...a, weg: 'sdk' }); ref = r.ref; t = r.t; return r.order_id; } finally { tsVerbraucht(); } },
        onApprove: async (d, actions) => { const r = await post('/api/v1/bezahlen', { ref, t, order_id: d.orderID }); if (r.status === 'nochmal') return actions.restart(); location.href = r.link; },
        onCancel: () => { if (ref) post('/api/v1/abbrechen', { ref, t }).catch(() => {}); zeige('Zahlung abgebrochen – es wurde nichts abgebucht.'); },
        onError: e => zeige((e && e.message && !/^\s*$/.test(e.message) && !/paypal/i.test(e.message) ? e.message : '') || 'Die Zahlung hat nicht geklappt. Bitte noch einmal versuchen.') });
      for (const [q, el] of [[window.paypal.FUNDING.PAYPAL, '#ppKnopf'], [window.paypal.FUNDING.CARD, '#karteKnopf']]) { const b = window.paypal.Buttons(opts(q)); if (b.isEligible()) b.render(el); }
    }).catch(() => { zeige('PayPal lässt sich gerade nicht laden. Bitte die Seite neu laden.'); });
  }

  fetch('/api/v1/angebot').then(r => r.json()).then(d => {
    daten = d;
    if (d.offline || d.zu) { sec.innerHTML = `<div class="hinweis">${d.zu ? 'Der Verein nimmt gerade keine Online-Buchungen an.' : 'Die Online-Buchung ist gerade nicht möglich. Bitte später noch einmal versuchen.'}</div>`; return; }
    if (!d.tage.length) { $('tage').innerHTML = ''; $('zeiten').innerHTML = '<p class="leer">Gerade sind keine Zeiten frei. Schau bald wieder vorbei.</p>'; return; }
    const v = sec.dataset;
    tag = d.tage.some(t => t.datum === v.datum) ? v.datum : d.tage[0].datum;
    tage(); zeiten();
    if (v.platz && v.beginn) { const b = $('zeiten').querySelector(`[data-p="${CSS.escape(v.platz)}"][data-b="${CSS.escape(v.beginn)}"]`); if (b) b.click(); }
  }).catch(() => { $('zeiten').innerHTML = '<p class="leer">Die freien Zeiten lassen sich gerade nicht laden. Bitte die Seite neu laden.</p>'; });
})();

/* Storno in zwei Schritten (kein confirm() – im Rahmen der Homepage oft gesperrt) */
document.querySelectorAll('form.storno button[data-frage]').forEach(b => {
  b.addEventListener('click', e => {
    if (b.dataset.sicher) return;
    e.preventDefault(); b.dataset.sicher = '1'; b.classList.add('rot');
    b.insertAdjacentHTML('beforebegin', `<p class="klein">${b.dataset.frage.replace(/[<>&]/g, '')}</p>`);
    b.textContent = 'Ja, stornieren';
  });
});
