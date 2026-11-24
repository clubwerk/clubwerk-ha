'use strict';
// Nachgebaute PayPal-REST-Schnittstelle (Sandbox) für Tests: OAuth, Orders v2, Payments v2 (Capture, Refund), Transaction Search,
// Freigabe-Seite für die Weiterleitung und signierte Webhooks (eigenes Zertifikat, SHA256withRSA, CRC32).
// Nutzung: const mock = await require('./paypal-mock.cjs').starten({ port, kunden: { 'id': { secret: '…' } } })
// Steuerung: mock.einstellen({ capture: 'PENDING' | 'DECLINED' | 'INSTRUMENT_DECLINED', refund: 'PENDING' | 'FAILED', stoerung: { kunde, n, pfad } }), mock.anhalten(kunde, pfad), mock.capture(id, { status }),
//            mock.webhook(url, typ, resource), mock.aufrufe (Liste { kunde, methode, pfad }), mock.daten (orders, captures, refunds)
const http = require('http'), crypto = require('crypto'), fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');

function zertifikat() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ppmock-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(d, 'k.pem'), '-out', path.join(d, 'c.pem'), '-days', '3', '-subj', '/CN=messageverificationcerts.sandbox.paypal.com'], { stdio: 'ignore' });
  const r = { key: fs.readFileSync(path.join(d, 'k.pem'), 'utf8'), cert: fs.readFileSync(path.join(d, 'c.pem'), 'utf8') };
  fs.rmSync(d, { recursive: true, force: true });
  return r;
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const cent = v => Math.round(Number(v) * 100), wert = c => (c / 100).toFixed(2);
const gebuehr = c => Math.round(c * 0.0249) + 35;   // wie PayPal DE: 2,49 % + 0,35 €

async function starten({ port, kunden = {}, webhookId = 'WH-TEST-1' } = {}) {
  const Z = zertifikat();
  const st = { orders: new Map(), captures: new Map(), refunds: new Map(), tokens: new Map(), idem: new Map(), rechnungen: new Set(), n: 0, opt: { capture: 'COMPLETED', refund: 'COMPLETED', aus: false }, aufrufe: [] };
  const base = `http://127.0.0.1:${port}`;
  const id = p => `${p}${String(++st.n).padStart(6, '0')}TEST`;
  const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const fehler = (rs, status, name, issue, msg) => { rs.writeHead(status, { 'Content-Type': 'application/json' }); rs.end(JSON.stringify({ name, message: msg || name, details: issue ? [{ issue }] : [] })); };
  const ok = (rs, d, status = 200) => { rs.writeHead(status, { 'Content-Type': 'application/json' }); rs.end(JSON.stringify(d)); };
  const kopie = o => JSON.parse(JSON.stringify(o));

  function captureAnlegen(o) {
    const pu = o.purchase_units[0], c = cent(pu.amount.value), f = gebuehr(c);
    const status = st.opt.capture === 'PENDING' ? 'PENDING' : st.opt.capture === 'DECLINED' ? 'DECLINED' : 'COMPLETED';
    const cap = { id: id('C'), status, amount: { currency_code: pu.amount.currency_code, value: pu.amount.value }, final_capture: true, custom_id: pu.custom_id, invoice_id: pu.invoice_id,
      seller_receivable_breakdown: { gross_amount: { ...pu.amount }, paypal_fee: { currency_code: pu.amount.currency_code, value: wert(f) }, net_amount: { currency_code: pu.amount.currency_code, value: wert(c - f) } },
      supplementary_data: { related_ids: { order_id: o.id } }, create_time: now(), update_time: now() };
    if (status === 'PENDING') cap.status_details = { reason: 'PENDING_REVIEW' };
    st.captures.set(cap.id, cap);
    pu.payments = { captures: [cap] };
    o.status = 'COMPLETED';
    return cap;
  }
  const orderSicht = o => { const x = kopie(o); delete x._ret; delete x._abbruch; if (x.purchase_units[0].payments) x.purchase_units[0].payments.captures = x.purchase_units[0].payments.captures.map(c => kopie(st.captures.get(c.id))); return x; };

  const srv = http.createServer((rq, rs) => {
    const teile = []; rq.on('data', d => teile.push(d)); rq.on('end', () => {
      // anhalten (Tests: Rennen nachstellen): die nächste passende Anfrage dieses Kunden wartet, bis der Test sie loslässt
      const h0 = st.halt, k0 = st.tokens.get(String(rq.headers.authorization || '').replace(/^Bearer /, ''));
      if (h0 && k0 === h0.kunde && h0.pfad.test(rq.url)) { st.halt = null; h0.da(); h0.weiter.then(go); } else go();
      function go() {
      const roh = Buffer.concat(teile), u = new URL(rq.url, base), p = u.pathname, m = rq.method;
      let body = {}; try { body = roh.length ? JSON.parse(roh) : {}; } catch (e) { body = {}; }
      // ---- Cloudflare Turnstile (siteverify): Token „mensch-ok“ gilt einmal, alles andere nicht; einstellen({ turnstile: 'aus' }) = nicht erreichbar
      if (m === 'POST' && p === '/turnstile/v0/siteverify') {
        st.turnstile = st.turnstile || { aufrufe: 0, benutzt: new Set() }; st.turnstile.aufrufe++;
        if (st.opt.turnstile === 'aus') { rs.writeHead(503); rs.end(); return; }
        const f = new URLSearchParams(), roh2 = roh.toString();
        const feld = n => { const mm = roh2.match(new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`)); return mm ? mm[1] : f.get(n); };
        const tok = feld('response'), ok2 = feld('secret') === 'turnstile-geheim' && /^mensch-ok/.test(tok || '') && !st.turnstile.benutzt.has(tok);
        if (ok2) st.turnstile.benutzt.add(tok);
        return ok(rs, ok2 ? { success: true, action: 'reservieren', hostname: 'buchen.example.org', 'error-codes': [] } : { success: false, 'error-codes': [tok ? 'invalid-input-response' : 'missing-input-response'] });
      }
      if (st.opt.aus && !p.startsWith('/__')) { rs.writeHead(503); rs.end(); return; }
      // ---- Freigabe-Seite (Käufer im Browser): gibt frei und kehrt zurück
      if (m === 'GET' && p === '/checkoutnow') {
        const o = st.orders.get(u.searchParams.get('token'));
        if (!o) { rs.writeHead(404); rs.end('unbekannt'); return; }
        if (u.searchParams.get('abbruch') === '1') { rs.writeHead(302, { Location: o._abbruch }); rs.end(); return; }
        o.status = 'APPROVED'; o.payer = { payer_id: 'PAYERTEST1', email_address: 'gast@example.com' };
        const r = new URL(o._ret); r.searchParams.set('token', o.id); r.searchParams.set('PayerID', 'PAYERTEST1');
        rs.writeHead(302, { Location: r.href }); rs.end(); return;
      }
      if (m === 'GET' && p.startsWith('/v1/notifications/certs/')) { rs.writeHead(200, { 'Content-Type': 'text/plain' }); rs.end(Z.cert); return; }
      // ---- OAuth
      if (m === 'POST' && p === '/v1/oauth2/token') {
        const [k, s] = Buffer.from(String(rq.headers.authorization || '').replace(/^Basic /, ''), 'base64').toString().split(':');
        if (!kunden[k] || kunden[k].secret !== s) return fehler(rs, 401, 'invalid_client', null, 'Client Authentication failed');
        const t = 'A21-' + crypto.randomBytes(12).toString('hex'); st.tokens.set(t, k);
        return ok(rs, { access_token: t, token_type: 'Bearer', expires_in: 32400, scope: 'https://uri.paypal.com/services/payments/payment' });
      }
      const kunde = st.tokens.get(String(rq.headers.authorization || '').replace(/^Bearer /, ''));
      if (!kunde) return fehler(rs, 401, 'AUTHENTICATION_FAILURE', null, 'Authentication failed due to invalid authentication credentials');
      st.aufrufe.push({ kunde, methode: m, pfad: p });
      const sg = st.opt.stoerung;   // Störung (Tests): die nächsten n passenden Anfragen dieses Kunden mit 500 beantworten
      if (sg && sg.kunde === kunde && sg.n > 0 && sg.pfad.test(p)) { sg.n--; return fehler(rs, 500, 'INTERNAL_SERVER_ERROR'); }
      const rid = rq.headers['paypal-request-id'];
      if (m === 'POST' && rid && st.idem.has(`${kunde}:${p}:${rid}`)) { const [s1, d1] = st.idem.get(`${kunde}:${p}:${rid}`); return ok(rs, d1, s1); }   // Idempotenz
      const merk = (s1, d1) => { if (m === 'POST' && rid) st.idem.set(`${kunde}:${p}:${rid}`, [s1, d1]); return ok(rs, d1, s1); };
      // ---- Orders
      if (m === 'POST' && p === '/v2/checkout/orders') {
        const pu = (body.purchase_units || [])[0];
        if (body.intent !== 'CAPTURE' || !pu || !pu.amount || !/^\d+\.\d{2}$/.test(pu.amount.value)) return fehler(rs, 400, 'INVALID_REQUEST', 'INVALID_PARAMETER_VALUE');
        if (pu.invoice_id && st.rechnungen.has(pu.invoice_id)) return fehler(rs, 422, 'UNPROCESSABLE_ENTITY', 'DUPLICATE_INVOICE_ID');
        if (pu.invoice_id) st.rechnungen.add(pu.invoice_id);
        const ec = body.payment_source && body.payment_source.paypal && body.payment_source.paypal.experience_context;
        const o = { id: id('O'), intent: 'CAPTURE', status: ec ? 'PAYER_ACTION_REQUIRED' : 'CREATED', purchase_units: [kopie(pu)], create_time: now(), _ret: ec ? ec.return_url : '', _abbruch: ec ? ec.cancel_url : '' };
        o.links = [{ rel: ec ? 'payer-action' : 'approve', href: `${base}/checkoutnow?token=${o.id}`, method: 'GET' }, { rel: 'self', href: `${base}/v2/checkout/orders/${o.id}`, method: 'GET' }];
        st.orders.set(o.id, o);
        return merk(201, orderSicht(o));
      }
      let x = p.match(/^\/v2\/checkout\/orders\/([A-Z0-9]+)$/);
      if (m === 'GET' && x) { const o = st.orders.get(x[1]); return o ? ok(rs, orderSicht(o)) : fehler(rs, 404, 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID'); }
      x = p.match(/^\/v2\/checkout\/orders\/([A-Z0-9]+)\/capture$/);
      if (m === 'POST' && x) {
        const o = st.orders.get(x[1]);
        if (!o) return fehler(rs, 404, 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID');
        if (o.status === 'COMPLETED') return fehler(rs, 422, 'UNPROCESSABLE_ENTITY', 'ORDER_ALREADY_CAPTURED');
        if (o.status !== 'APPROVED') return fehler(rs, 422, 'UNPROCESSABLE_ENTITY', 'ORDER_NOT_APPROVED');
        if (st.opt.capture === 'INSTRUMENT_DECLINED') { st.opt.capture = 'COMPLETED'; return fehler(rs, 422, 'UNPROCESSABLE_ENTITY', 'INSTRUMENT_DECLINED'); }
        captureAnlegen(o);
        return merk(201, orderSicht(o));
      }
      // ---- Payments
      x = p.match(/^\/v2\/payments\/captures\/([A-Z0-9]+)$/);
      if (m === 'GET' && x) { const c = st.captures.get(x[1]); return c ? ok(rs, kopie(c)) : fehler(rs, 404, 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID'); }
      x = p.match(/^\/v2\/payments\/captures\/([A-Z0-9]+)\/refund$/);
      if (m === 'POST' && x) {
        const c = st.captures.get(x[1]);
        if (!c) return fehler(rs, 404, 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID');
        if (c.status === 'REFUNDED') return fehler(rs, 422, 'UNPROCESSABLE_ENTITY', 'CAPTURE_FULLY_REFUNDED');
        if (c.status !== 'COMPLETED') return fehler(rs, 422, 'UNPROCESSABLE_ENTITY', 'CAPTURE_NOT_REFUNDABLE');
        const gross = cent(c.amount.value), f = Math.max(0, cent(c.seller_receivable_breakdown.paypal_fee.value) - 35);   // feste Gebühr bleibt bei PayPal
        const status = st.opt.refund === 'PENDING' ? 'PENDING' : st.opt.refund === 'FAILED' ? 'FAILED' : 'COMPLETED';
        const r = { id: id('R'), status, amount: { ...c.amount }, note_to_payer: body.note_to_payer, create_time: now(), update_time: now(),
          seller_payable_breakdown: { gross_amount: { ...c.amount }, paypal_fee: { currency_code: c.amount.currency_code, value: wert(f) }, net_amount: { currency_code: c.amount.currency_code, value: wert(gross - f) } },
          links: [{ rel: 'up', href: `${base}/v2/payments/captures/${c.id}`, method: 'GET' }], _capture: c.id };
        st.refunds.set(r.id, r);
        if (status === 'COMPLETED') c.status = 'REFUNDED';
        const sicht = kopie(r); delete sicht._capture;
        return merk(201, sicht);
      }
      x = p.match(/^\/v2\/payments\/refunds\/([A-Z0-9]+)$/);
      if (m === 'GET' && x) { const r = st.refunds.get(x[1]); if (!r) return fehler(rs, 404, 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID'); const s = kopie(r); delete s._capture; return ok(rs, s); }
      // ---- Transaction Search (nur lesend)
      if (m === 'GET' && p === '/v1/reporting/transactions') {
        const von = Date.parse(u.searchParams.get('start_date')), bis = Date.parse(u.searchParams.get('end_date'));
        if (!Number.isFinite(von) || !Number.isFinite(bis) || bis < von || bis - von > 31 * 86400000) return fehler(rs, 400, 'INVALID_REQUEST', 'INVALID_DATE_RANGE');
        const liste = [];
        for (const c of st.captures.values()) {
          const t = Date.parse(c.create_time); if (t < von || t > bis || c.status === 'DECLINED') continue;
          liste.push({ transaction_info: { transaction_id: c.id, transaction_event_code: 'T0006', transaction_initiation_date: c.create_time, transaction_updated_date: c.update_time,
            transaction_amount: { ...c.amount }, fee_amount: { currency_code: 'EUR', value: '-' + c.seller_receivable_breakdown.paypal_fee.value }, transaction_status: c.status === 'PENDING' ? 'P' : 'S', custom_field: c.custom_id, invoice_id: c.invoice_id } });
        }
        for (const r of st.refunds.values()) {
          const t = Date.parse(r.create_time); if (t < von || t > bis || r.status !== 'COMPLETED') continue;
          const c = st.captures.get(r._capture);
          liste.push({ transaction_info: { transaction_id: r.id, paypal_reference_id: r._capture, transaction_event_code: 'T1107', transaction_initiation_date: r.create_time, transaction_updated_date: r.update_time,
            transaction_amount: { currency_code: r.amount.currency_code, value: '-' + r.amount.value }, fee_amount: { currency_code: 'EUR', value: r.seller_payable_breakdown.paypal_fee.value }, transaction_status: 'S', custom_field: c && c.custom_id, invoice_id: c && c.invoice_id } });
        }
        if (st.opt.fremd) liste.push({ transaction_info: { transaction_id: 'CFREMD0001TEST', transaction_event_code: 'T0006', transaction_initiation_date: now(), transaction_amount: { currency_code: 'EUR', value: '12.00' }, fee_amount: { currency_code: 'EUR', value: '-0.65' }, transaction_status: 'S', custom_field: 'G-ZZZZ-ZZZZ' } });
        return ok(rs, { transaction_details: liste, account_number: 'TESTKONTO', start_date: u.searchParams.get('start_date'), end_date: u.searchParams.get('end_date'), last_refreshed_datetime: now(), page: 1, total_items: liste.length, total_pages: 1 });
      }
      fehler(rs, 404, 'NOT_FOUND', null, 'not found ' + p);
      }
    });
  });
  await new Promise(r => srv.listen(port, '127.0.0.1', r));

  const api = {
    base, webhookId, srv, st, get daten() { return st; }, get aufrufe() { return st.aufrufe; },
    einstellen: o => Object.assign(st.opt, o),
    /** nächste passende Anfrage von kunde anhalten → { erreicht: Promise, los() } */
    anhalten: (kunde, pfad) => { let da, los; const erreicht = new Promise(r => { da = r; }), weiter = new Promise(r => { los = r; }); st.halt = { kunde, pfad, da, weiter }; return { erreicht, los }; },
    /** Käufer gibt eine Order frei (wie die Freigabe-Seite, ohne Browser) */
    freigeben: oid => { const o = st.orders.get(oid); if (o) { o.status = 'APPROVED'; } return Boolean(o); },
    /** Zahlung nachträglich ändern (vorläufig → bezahlt, Erstattung im PayPal-Konto, Teilerstattung, Rückbuchung) */
    capture: (cid, aend) => { const c = st.captures.get(cid); if (c) { Object.assign(c, aend, { update_time: now() }); } return c; },
    refundSetzen: (rid, aend) => { const r = st.refunds.get(rid); if (r) { Object.assign(r, aend); if (aend.status === 'COMPLETED') { const c = st.captures.get(r._capture); if (c) c.status = 'REFUNDED'; } } return r; },
    /** signierten Webhook schicken; falsch: 'signatur' | 'zert' (fremde Zertifikatsadresse) */
    async webhook(url, typ, resource, { falsch = null, eventId = null } = {}) {
      const ev = { id: eventId || 'WH-' + crypto.randomBytes(8).toString('hex'), event_type: typ, resource_type: typ.startsWith('CHECKOUT') ? 'checkout-order' : 'capture', create_time: now(), resource };
      const roh = Buffer.from(JSON.stringify(ev)), tid = crypto.randomUUID(), zeit = now();
      let sig = crypto.sign('sha256', Buffer.from(`${tid}|${zeit}|${webhookId}|${crc32(roh)}`), Z.key).toString('base64');
      if (falsch === 'signatur') sig = crypto.sign('sha256', Buffer.from(`${tid}|${zeit}|${webhookId}|1`), Z.key).toString('base64');
      const certUrl = falsch === 'zert' ? 'http://127.0.0.2:1/v1/notifications/certs/X' : `${base}/v1/notifications/certs/CERT-TEST`;
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'paypal-transmission-id': tid, 'paypal-transmission-time': zeit, 'paypal-transmission-sig': sig, 'paypal-cert-url': certUrl, 'paypal-auth-algo': 'SHA256withRSA' }, body: roh });
      return r.status;
    },
    schliessen: () => new Promise(r => srv.close(r)),
  };
  return api;
}
module.exports = { starten };
