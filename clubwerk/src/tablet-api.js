'use strict';
/* Tablet-Schnittstelle (/api/tablet/*): Zustand, Entsperren mit PIN, Buchen, Rückgängig, Konto, Gäste-Deckel, neues Mitglied.
   Der Passwortschutz der Buchungsseite (Gate) bleibt in server.js und läuft vorher. Aus server.js ausgelagert: die Helfer kommen
   von dort (h), der Aufruf steht an derselben Stelle, die Reihenfolge der Adressen bleibt. */
const { db, isPerson, customArticleId, DATA_DIR, getSetting, stockList, audit, clubColor } = require('./db');
const { euro } = require('./util');
const artIcons = require('./articleicons');
const { securityAlert } = require('./security');
const auth = require('./auth');
const plugins = require('./plugins');
module.exports = function tabletApi(h) {
  const {
    app, bad, cleanName, int, logoUrl, memberBalance, normPath, rateLimit, UNDO_WINDOW_MIN
  } = h;
  /* =====================================================================
     Tablet
     ===================================================================== */
  /* „Ich bin öfter hier“: Anzahl und Zeitraum stellt ein Admin mit allen Rechten ein */
  const topN = () => Math.max(0, Math.min(60, int(getSetting('top_n', '15'), 15)));
  const topDays = () => Math.max(1, Math.min(365, int(getSetting('top_days', '30'), 30)));
  /* „Nur anschreiben“: ohne Bar- und Kartenwege (Standard aus). Wer keine Kasse im Sinne der Kassenpflicht betreiben will, schaltet sie hier ab –
     am Tablet ausgeblendet, hier und in der Verwaltung abgelehnt */
  const nurAnschreiben = () => getSetting('nur_anschreiben', '0') === '1';
  const NUR_ANSCHREIBEN_MSG = 'Dieser Verein hat „Nur anschreiben“ eingeschaltet – Bar- und Kartenzahlung gibt es hier nicht.';

  function activeEvent(withGuests = false) {
    const ev = db.prepare('SELECT id, name, date FROM events WHERE active = 1 AND closed_at IS NULL LIMIT 1').get();
    if (!ev) return null;
    ev.articles = db.prepare(`SELECT a.id, a.name, a.category, ea.price_cents, a.icon, a.image
    FROM event_articles ea JOIN articles a ON a.id = ea.article_id
    WHERE ea.event_id = ? AND a.custom = 0 ORDER BY cat_rank(a.category), de_key(a.category), de_key(a.name)`).all(ev.id);
    if (withGuests) {
      // Für die Namensliste am Tablet: keine Beträge, nur ob jemand schon alles bezahlt hat
      ev.guests = db.prepare(`SELECT g.id, g.name, g.member_id AS memberId, m.kind, m.pin_hash IS NOT NULL AS hasPin,
        (SELECT COUNT(*) FROM bookings b WHERE b.event_guest_id = g.id AND b.cancelled_at IS NULL) AS n,
        (SELECT COUNT(*) FROM bookings b WHERE b.event_guest_id = g.id AND b.cancelled_at IS NULL AND b.kind = 'event'
           AND b.payment_id IS NULL AND b.transferred_at IS NULL) AS openN
      FROM event_guests g LEFT JOIN members m ON m.id = g.member_id
      WHERE g.event_id = ? ORDER BY name_key(g.name, 'mitglied')`).all(ev.id)
        .map(g => ({ id: g.id, name: g.name, memberId: g.memberId, kind: g.kind, paid: g.n > 0 && g.openN === 0, open_cents: guestOpen(g.id) }));
    }
    return ev;
  }

  /** Offene (noch nicht bezahlte, nicht übernommene) Buchungen eines Namens auf der Veranstaltungsliste */
  const OPEN_GUEST = `kind = 'event' AND cancelled_at IS NULL AND payment_id IS NULL AND transferred_at IS NULL`;
  function guestOpen(guestId) {
    return db.prepare(`SELECT COALESCE(SUM(total_cents),0) AS cents FROM bookings WHERE event_guest_id = ? AND ${OPEN_GUEST}`).get(guestId).cents;
  }
  /** Namen auf die Liste der laufenden Veranstaltung setzen (oder vorhandenen Eintrag zurückgeben). */
  function addGuest(ev, { memberId, name }, by) {
    if (memberId) {
      const m = db.prepare("SELECT * FROM members WHERE id = ? AND active = 1").get(int(memberId));
      if (!m) throw new Error('Mitglied nicht gefunden.');
      if (!['mitglied', 'nichtmitglied', 'mannschaft'].includes(m.kind)) throw new Error('Dieses Konto kann nicht auf die Liste.');
      const g = db.prepare('SELECT * FROM event_guests WHERE event_id = ? AND member_id = ?').get(ev.id, m.id);
      if (g) return g;
      const id = Number(db.prepare('INSERT INTO event_guests(event_id, name, member_id, created_by) VALUES (?,?,?,?)').run(ev.id, m.name, m.id, by).lastInsertRowid);
      return db.prepare('SELECT * FROM event_guests WHERE id = ?').get(id);
    }
    const n = cleanName(name, 60);
    if (n.length < 2) throw new Error('Bitte einen Namen eingeben.');
    const g = db.prepare('SELECT * FROM event_guests WHERE event_id = ? AND lower(name) = lower(?)').get(ev.id, n);
    if (g) return g;
    // Genau ein aktives Mitglied mit diesem Namen → gleich verknüpfen
    const m = db.prepare("SELECT * FROM members WHERE lower(name) = lower(?) AND active = 1 AND kind IN ('mitglied','nichtmitglied','mannschaft')").all(n);
    if (m.length === 1) return addGuest(ev, { memberId: m[0].id }, by);
    if (db.prepare('SELECT COUNT(*) n FROM event_guests WHERE event_id = ?').get(ev.id).n >= 500) throw new Error('Die Liste ist voll.');
    const id = Number(db.prepare('INSERT INTO event_guests(event_id, name, created_by) VALUES (?,?,?)').run(ev.id, n, by).lastInsertRowid);
    return db.prepare('SELECT * FROM event_guests WHERE id = ?').get(id);
  }
  function guestResponse(g, ev) {
    const r = { token: auth.issueTabletToken('guest:' + g.id), guest: { id: g.id, name: g.name, memberId: g.member_id },
      event: { id: ev.id, name: ev.name }, private: true, open_cents: guestOpen(g.id) };
    return r;
  }

  /** „Ich bin öfter hier“: die topN() Mitglieder mit den meisten Buchungen in den letzten topDays() Tagen (Standard 15 aus 30 Tagen). */
  function topMembers() {
    // Nur die letzten Tage lesen (Index auf created_at) statt aller Verkäufe aller Jahre – sonst wuchs jede Tablet-Startseite mit der Zeit (planung/n-plus-1.md).
    // Gleichstand wie bisher: kleinere Nummer zuerst.
    return db.prepare(`SELECT b.member_id AS id, SUM(b.qty) AS n
    FROM bookings b INDEXED BY ix_bookings_created JOIN members m ON m.id = b.member_id
    WHERE b.cancelled_at IS NULL AND m.kind IN ('mitglied','nichtmitglied') AND m.active = 1
      AND b.kind IN ('konto','event') AND b.created_at >= date('now','localtime', ?)
    GROUP BY b.member_id ORDER BY n DESC, b.member_id LIMIT ?`).all(`-${topDays()} days`, topN()).map(r => r.id);
  }

  function eventOpen(memberId) {
    return db.prepare(`SELECT COALESCE(SUM(total_cents),0) AS cents FROM bookings
    WHERE member_id = ? AND event_guest_id IS NOT NULL AND ${OPEN_GUEST}`).get(memberId).cents;
  }
  /** eventOpen für alle Konten auf einmal → Funktion id → Cent (Listen: eine Abfrage statt einer je Konto) */
  function eventOpenAll() {
    const m = new Map(db.prepare(`SELECT member_id, SUM(total_cents) AS cents FROM bookings
    WHERE member_id IS NOT NULL AND event_guest_id IS NOT NULL AND ${OPEN_GUEST} GROUP BY member_id`).all().map(r => [r.member_id, r.cents || 0]));
    return id => m.get(id) || 0;
  }

  const DRINK_TABLET = /^\/api\/tablet\/(state|unlock|undo|book|account|pin|member|tab|tab\/pay|event\/guest|logout|artikelbild(\/.*)?)$/;
  app.use((req, res, next) => (DRINK_TABLET.test(normPath(req.path)) && !plugins.isActive('getraenke')
    ? res.status(404).json({ error: 'Das Modul „Verkauf“ ist ausgeschaltet.' }) : next()));

  /* Profilbilder am Tablet – nur wenn das Mitglied sie für diesen Zweck freigegeben hat (verkauf · buchung · helfer) */
  app.get('/api/tablet/photo/:id', (req, res) => {
    const u = String(req.query.u || '');
    if (!['verkauf', 'buchung', 'helfer'].includes(u)) return res.status(404).end();
    require('./photos').send(res, int(req.params.id), u);
  });
  app.get('/api/tablet/artikelbild/:file', (req, res) => {
    const p = artIcons.imagePath(DATA_DIR, req.params.file);
    if (!p) return res.status(404).end();
    res.setHeader('Content-Type', artIcons.mimeOf(req.params.file));
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(p);
  });

  app.get('/api/tablet/state', (req, res) => {
    const photos = require('./photos');
    // Profilbild-Kennung gleich mitlesen (photos.version nimmt die Zeile) statt je Mitglied eine eigene Abfrage
    const members = db.prepare(`SELECT id, name, kind, pending, pin_hash IS NOT NULL AS hasPin, offen_buchen AS offen, photo, photo_use
    FROM members WHERE active = 1 AND deleted = 0 AND kind != 'extern' ORDER BY name_key(name, kind)`).all()   // Gastspieler/innen (Spielbetrieb) haben kein Konto
      .map(({ photo, photo_use, ...m }) => ({ ...m, hasPin: Boolean(m.hasPin), offen: Boolean(m.hasPin && m.offen && m.kind === 'mitglied'), pending: Boolean(m.pending), ph: m.kind === 'mitglied' ? photos.version({ photo, photo_use }, 'verkauf') : null }));
    // Module können Konten in der Namensliste ausblenden (z. B. Angehörige, die über den Hauptzahler buchen)
    const hidden = new Set();
    for (const p of plugins.withHook('tabletMembers')) { try { const r = p.hooks.tabletMembers() || {}; (r.hidden || []).forEach(id => hidden.add(id)); } catch (e) { console.error(`Modul ${p.meta.id}: ausgeblendete Mitglieder nicht lesbar:`, e.message); } }
    members.forEach(m => { if (hidden.has(m.id)) m.hidden = true; });
    const stock = new Map(stockList().map(s => [s.id, s]));
    const articles = db.prepare('SELECT id, name, category, price_cents, icon, image FROM articles WHERE active = 1 AND custom = 0 ORDER BY cat_rank(category), de_key(category), de_key(name)').all()
      .map(a => {
        const s = stock.get(a.id);
        return { ...a, soldOut: Boolean(s && s.track_stock && s.delivered > 0 && s.stock <= 0) };
      });
    res.json({
      clubName: getSetting('club_name', process.env.CLUB_NAME || 'Unser Verein'),
      members, articles, top: topN() ? topMembers().filter(id => !hidden.has(id)) : [], topDays: topDays(), event: activeEvent(true), color: clubColor(), logo: logoUrl(),
      tabs: openTabs(), nurAnschreiben: nurAnschreiben(),
    });
  });

  /* Datenschutz: Offene Beträge und Buchungsverlauf gibt es am Tablet nur für Konten mit PIN.
     (Ein Token für ein Konto mit PIN wird nur nach richtiger PIN ausgegeben.) */
  const privateOk = m => Boolean(m && m.pin_hash);
  /* Schalter „Andere dürfen für mich buchen“ (nur Mitglieder mit PIN): Das Konto lässt sich ohne PIN zum Buchen öffnen,
     aber ohne Einsicht (Beträge, Verlauf) und ohne PIN-Änderung – die Freigabe ist ein eingeschränktes Token (auth.ohnePin). */
  const offenOk = m => Boolean(m && m.pin_hash && m.offen_buchen && m.kind === 'mitglied');

  function unlockResponse(m, ohnePin = false) {
    const r = {
      token: auth.issueTabletToken(m.id, { ohnePin }),
      member: { id: m.id, name: m.name, kind: m.kind, hasPin: Boolean(m.pin_hash), offen: offenOk(m), pending: Boolean(m.pending) },
      private: !ohnePin && privateOk(m), ohnePin,
    };
    if (r.private) { r.balance = memberBalance(m.id); r.eventOpen_cents = eventOpen(m.id); }
    return r;
  }

  app.post('/api/tablet/unlock', rateLimit('unlock', 40, 60000), async (req, res) => {
    const { memberId, eventId, guestId, tabId, pin } = req.body || {};
    if (tabId) {
      const t = db.prepare("SELECT * FROM guest_tabs WHERE id = ? AND status = 'offen'").get(int(tabId));
      if (!t) return bad(res, 'Dieser Deckel ist schon bezahlt oder geschlossen.', 404);
      return res.json(tabResponse(t));
    }
    if (guestId) {
      const ev = activeEvent();
      const g = ev && db.prepare('SELECT * FROM event_guests WHERE id = ? AND event_id = ?').get(int(guestId), ev.id);
      if (!g) return bad(res, 'Dieser Name steht nicht auf der Liste der laufenden Veranstaltung.', 404);
      return res.json(guestResponse(g, ev));             // Thekenbetrieb: keine PIN
    }
    if (eventId) {
      const ev = activeEvent();
      if (!ev || ev.id !== int(eventId)) return bad(res, 'Diese Veranstaltung ist nicht aktiv.');
      if (nurAnschreiben()) return bad(res, NUR_ANSCHREIBEN_MSG, 403);
      return res.json({ token: auth.issueTabletToken('event:' + ev.id), event: { id: ev.id, name: ev.name } });
    }
    const m = db.prepare('SELECT * FROM members WHERE id = ? AND active = 1').get(int(memberId));
    if (!m) return bad(res, 'Konto nicht gefunden.', 404);
    if (m.kind === 'mannschaft' && !m.pin_hash) return bad(res, 'Für dieses Mannschaftskonto ist noch keine PIN vergeben – bitte an den Vorstand wenden.', 403);
    // ohne PIN nur, wenn das Mitglied „Andere dürfen für mich buchen“ selbst eingeschaltet hat; eine mitgesendete PIN wird immer geprüft
    if (m.pin_hash && !pin && offenOk(m)) return res.json(unlockResponse(m, true));
    // ohne PIN bei ausgeschaltetem Schalter (z. B. Tablet-Liste noch vom alten Stand): Hinweis, kein Fehlversuch – sonst sperrt das Antippen das Mitglied
    if (m.pin_hash && !pin) return bad(res, 'Ohne PIN buchen ist für dieses Konto nicht erlaubt. Bitte die PIN eingeben.', 401);
    if (m.pin_hash) {
      const err = await checkPin(m, pin);
      if (err) return bad(res, err.msg, err.code);
    }
    res.json(unlockResponse(m));
  });

  /* Falsche PINs über alle Mitglieder: Die Sperre je Mitglied bremst nicht, wer reihum bei vielen Mitgliedern rät (dieselbe PIN öffnet
     auch Türen am Tablet). Gesperrt wird deshalb nichts (die Theke muss weiterlaufen), aber ab 25 Fehlversuchen in 24 Stunden geht eine
     Sicherheitswarnung an den Vorstand (bei 25, dann je weitere 50). */
  let pinFails = [];
  function pinFailAll() {
    const now = Date.now(); pinFails = pinFails.filter(t => now - t < 86400000).slice(-5000); pinFails.push(now);   // begrenzt (Speicher)
    if (pinFails.length === 25 || (pinFails.length > 25 && pinFails.length % 50 === 0)) securityAlert('tablet.pins', `Am Tablet wurde in 24 Stunden ${pinFails.length}-mal eine falsche Mitglieder-PIN eingegeben (über mehrere Mitglieder). Rät jemand PINs durch? Bitte im Protokoll unter „PIN gesperrt“ nachsehen.`);
  }
  /** PIN prüfen inkl. Sperre nach 5 Fehlversuchen. Die Sperre verdoppelt sich bei jeder weiteren Fehlserie
   *  (5 min, 10, 20, 40 … höchstens 24 h) und steht im Protokoll. Gibt null oder { msg, code } zurück. */
  function checkPin(m0, pin) {
    // nacheinander je Mitglied und Zähler erst hier lesen – gleichzeitige Versuche dürfen die Sperre nicht überholen
    return auth.nacheinander('pin:' + m0.id, async () => {
      const m = db.prepare('SELECT * FROM members WHERE id = ?').get(m0.id) || m0;
      return checkPinJetzt(m, pin);
    });
  }
  async function checkPinJetzt(m, pin) {
    if (m.locked_until && m.locked_until > new Date().toISOString()) {
      const until = new Date(m.locked_until).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: process.env.TZ || 'Europe/Berlin' });
      return { msg: `Zu viele falsche PINs – gesperrt bis ${until} Uhr. Der Vorstand kann die PIN zurücksetzen.`, code: 429 };
    }
    if (!(await auth.verifySecret(String(pin || ''), m.pin_hash))) {
      pinFailAll();
      const fails = m.failed_pins + 1;
      if (fails >= 5) {
        const strikes = (m.pin_strikes || 0) + 1;
        const mins = Math.min(5 * 2 ** (strikes - 1), 24 * 60);
        db.prepare('UPDATE members SET failed_pins = 0, pin_strikes = ?, locked_until = ? WHERE id = ?')
          .run(strikes, new Date(Date.now() + mins * 60000).toISOString(), m.id);
        audit('tablet', 'PIN gesperrt', `${m.name}: 5 falsche PINs, Sperre ${mins >= 60 ? Math.round(mins / 60) + ' h' : mins + ' min'}`);
      } else db.prepare('UPDATE members SET failed_pins = ? WHERE id = ?').run(fails, m.id);
      return { msg: 'PIN falsch.', code: 401 };
    }
    if (m.failed_pins || m.pin_strikes || m.locked_until) db.prepare('UPDATE members SET failed_pins = 0, pin_strikes = 0, locked_until = NULL WHERE id = ?').run(m.id);
    if (auth.pinUmstellen(m.pin_hash)) db.prepare('UPDATE members SET pin_hash = ? WHERE id = ? AND pin_hash = ?').run(await auth.hashPin(String(pin)), m.id, m.pin_hash);   // alte PIN auf Pfeffer umstellen
    return null;
  }

  /* Veranstaltung: Namen am Tablet auf die Abrechnungsliste setzen (aus der Mitgliederliste oder frei) */
  app.post('/api/tablet/event/guest', rateLimit('guest', 40, 10 * 60000), (req, res) => {
    const ev = activeEvent();
    if (!ev) return bad(res, 'Es läuft gerade keine Veranstaltung.');
    const { memberId, name } = req.body || {};
    let g;
    try { g = addGuest(ev, { memberId, name }, 'tablet'); } catch (e) { return bad(res, e.message); }
    res.json(guestResponse(g, ev));
  });

  /* ---------- Gäste-Deckel ---------- */
  const tabOpen = id => db.prepare('SELECT COALESCE(SUM(total_cents),0) c FROM bookings WHERE tab_id = ? AND cancelled_at IS NULL').get(id).c;
  function openTabs() {
    return db.prepare(`SELECT t.id, t.name, t.created_at FROM guest_tabs t WHERE t.status = 'offen' ORDER BY t.created_at`).all()
      .map(t => ({ ...t, open_cents: tabOpen(t.id) }));
  }
  function tabResponse(t) {
    return { token: auth.issueTabletToken('tab:' + t.id), tab: { id: t.id, name: t.name }, open_cents: tabOpen(t.id) };
  }
  /* Neuen Deckel öffnen – gibt es schon einen offenen mit diesem Namen, wird der genommen */
  app.post('/api/tablet/tab', rateLimit('tab', 30, 10 * 60000), (req, res) => {
    if (activeEvent()) return bad(res, 'Während der Veranstaltung bitte die Veranstaltungsliste nutzen.');
    const name = cleanName((req.body || {}).name, 60);
    if (name.length < 2) return bad(res, 'Bitte einen Namen eingeben, z. B. „Gastmannschaft SV Musterdorf“.');
    let t = db.prepare("SELECT * FROM guest_tabs WHERE status = 'offen' AND lower(name) = lower(?)").get(name);
    if (!t) {
      if (db.prepare("SELECT COUNT(*) n FROM guest_tabs WHERE status = 'offen'").get().n >= 60) return bad(res, 'Zu viele offene Deckel. Bitte erst welche bezahlen lassen.');
      const id = Number(db.prepare("INSERT INTO guest_tabs(name, created_by) VALUES (?, 'tablet')").run(name).lastInsertRowid);
      t = db.prepare('SELECT * FROM guest_tabs WHERE id = ?').get(id);
      audit('tablet', 'Gäste-Deckel geöffnet', name);
    }
    res.json(tabResponse(t));
  });
  /* Bezahlen am Tablet (Thekenpersonal): Deckel komplett bar oder mit Karte */
  app.post('/api/tablet/tab/pay', rateLimit('tabpay', 30, 10 * 60000), (req, res) => {
    const { token, method } = req.body || {};
    const who = auth.checkTabletToken(token);
    if (typeof who !== 'string' || !who.startsWith('tab:')) return bad(res, 'Sitzung abgelaufen. Bitte den Deckel erneut wählen.', 401);
    if (!['bar', 'karte'].includes(method)) return bad(res, 'Bitte bar oder Karte wählen.');
    const t = db.prepare("SELECT * FROM guest_tabs WHERE id = ? AND status = 'offen'").get(int(who.slice(4)));
    if (!t) return bad(res, 'Dieser Deckel ist schon geschlossen.');
    if (nurAnschreiben() && tabOpen(t.id)) return bad(res, NUR_ANSCHREIBEN_MSG, 403);   // ein leerer Deckel darf geschlossen werden
    const cents = closeTab(t, { status: 'bezahlt', method, by: 'tablet' });
    auth.dropTabletToken(token);
    res.json({ ok: true, cents, method, name: t.name });
  });
  /** Deckel schließen (bezahlt / übernommen / abgeschrieben). Leere Deckel werden einfach gelöscht. */
  function closeTab(t, { status, method = null, by, memberId = null, note = null }) {
    const cents = tabOpen(t.id);
    db.transaction(() => {
      if (!cents && !db.prepare('SELECT 1 FROM bookings WHERE tab_id = ? AND cancelled_at IS NULL').get(t.id)) {
        db.prepare('UPDATE bookings SET tab_id = NULL WHERE tab_id = ?').run(t.id);
        db.prepare('DELETE FROM guest_tabs WHERE id = ?').run(t.id);
        return;
      }
      db.prepare(`UPDATE guest_tabs SET status = ?, method = ?, cents = ?, member_id = ?, note = ?, closed_at = datetime('now','localtime'), closed_by = ? WHERE id = ?`)
        .run(status, method, cents, memberId, note, by, t.id);
      if (status === 'bezahlt') db.prepare('UPDATE bookings SET paid_cash = 1 WHERE tab_id = ? AND cancelled_at IS NULL').run(t.id);
      if (status === 'uebernommen') db.prepare(`UPDATE bookings SET kind = 'konto', member_id = ?, transferred_at = datetime('now','localtime'), transferred_by = ?
      WHERE tab_id = ? AND cancelled_at IS NULL`).run(memberId, by, t.id);
      if (status === 'abgeschrieben') db.prepare("UPDATE bookings SET kind = 'verein', total_cents = 0 WHERE tab_id = ? AND cancelled_at IS NULL").run(t.id);
    })();
    const what = { bezahlt: method === 'karte' ? 'mit Karte bezahlt' : 'bar bezahlt', uebernommen: 'auf Konto übernommen', abgeschrieben: 'abgeschrieben' }[status];
    audit(by, 'Gäste-Deckel ' + what, `${t.name}: ${euro(cents)}${note ? ' – ' + note : ''}`);
    return cents;
  }

  /* Neu im Verein: jeder darf sich am Tablet anlegen, ein Admin bestätigt später. */
  const NEW_MEMBERS_PER_DAY = 15;   // mehr neue Namen je Tag am Tablet nur über den Vorstand (Schutz vor Unsinn-Einträgen)
  app.post('/api/tablet/member', rateLimit('member', 5, 10 * 60000), (req, res) => {
    const name = cleanName((req.body || {}).name, 61);
    if (name.length < 5 || name.split(' ').length < 2) return bad(res, 'Bitte Vor- und Nachnamen eingeben.');
    if (name.length > 60 || /[<>{}]/.test(name)) return bad(res, 'Bitte nur den Namen eingeben.');
    const same = db.prepare("SELECT * FROM members WHERE lower(name) = lower(?) AND deleted = 0 AND kind != 'extern'").get(name);
    if (same && same.active) return bad(res, `„${same.name}“ gibt es schon – bitte in der Namensliste suchen.`);
    if (same && !same.active) return bad(res, 'Dieser Name ist gesperrt. Bitte an den Vorstand wenden.');
    const newToday = db.prepare(`SELECT COUNT(*) n FROM members WHERE pending = 1 AND date(created_at) = date('now','localtime')`).get().n;
    if (newToday >= NEW_MEMBERS_PER_DAY) return bad(res, 'Heute wurden schon viele neue Namen angelegt. Bitte an den Vorstand wenden.', 429);
    const id = Number(db.prepare("INSERT INTO members(name, kind, pending) VALUES (?, 'mitglied', 1)").run(name).lastInsertRowid);
    res.json(unlockResponse(db.prepare('SELECT * FROM members WHERE id = ?').get(id)));
  });

  // Idempotenz beim Tablet-Buchen: Der Client schickt je Warenkorb-Absenden eine zufällige requestId. Kommt dieselbe ID
  // desselben Kontos binnen 2 Minuten erneut (Doppeltipp, Wiederholung bei wackeligem WLAN), wird die erste Antwort
  // zurückgegeben statt noch einmal zu buchen. Nur im Speicher – nach einem Neustart ist die Liste leer.
  const BOOK_REPLAY_MS = 2 * 60000;
  const bookReplay = new Map();                                      // "konto|requestId" -> { at, body }
  const replayKey = (who, requestId) => {
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) return null;
    const now = Date.now();
    for (const [k, v] of bookReplay) if (now - v.at > BOOK_REPLAY_MS) bookReplay.delete(k);
    return `${who}|${requestId}`;
  };

  /* Ohne PIN geöffnete Sitzungen nehmen nur zurück, was sie selbst gebucht haben (Token → Buchungsnummern), nicht die
     Buchungen des Mitglieds oder anderer – sonst ließen sich der Verlauf über Buchungsnummern abtasten und fremde Buchungen stornieren */
  const ohnePinGebucht = new Map();
  function merkeOhnePin(token, ids) {
    const now = Date.now();
    for (const [k, v] of ohnePinGebucht) if (now - v.at > UNDO_WINDOW_MIN * 60000) ohnePinGebucht.delete(k);
    const e = ohnePinGebucht.get(token) || { ids: new Set() };
    e.at = now; ids.forEach(id => e.ids.add(id)); ohnePinGebucht.set(token, e);
  }

  app.post('/api/tablet/book', rateLimit('book', 120, 60000), (req, res) => {
    // „pay“ aus älteren Tablet-Versionen wird weiter angenommen, aber nicht mehr ausgewertet: ob bar oder angeschrieben,
    // ergibt sich allein aus dem Konto (Deckel, Veranstaltungsliste, Mitglied …)
    const { token, items, requestId } = req.body || {};
    const who = auth.checkTabletTokenBuchen(token);
    if (!who) return bad(res, 'Sitzung abgelaufen. Bitte Namen erneut wählen.', 401);
    const eingeschraenkt = !auth.checkTabletToken(token);   // ohne PIN geöffnet: nichts Privates in der Antwort
    if (eingeschraenkt && !offenOk(db.prepare('SELECT * FROM members WHERE id = ?').get(who))) return bad(res, 'Sitzung abgelaufen. Bitte Namen erneut wählen.', 401);   // Schalter inzwischen aus
    const rkey = replayKey(eingeschraenkt ? `op${who}` : who, requestId);
    if (rkey && bookReplay.has(rkey)) return res.json(bookReplay.get(rkey).body);   // Wiederholung: Erstergebnis, keine neue Buchung
    if (!Array.isArray(items) || !items.length) return bad(res, 'Keine Artikel gewählt.');
    const ev = activeEvent();

    let member = null, guest = null, tab = null, kind, paidCash = null;
    if (typeof who === 'string' && who.startsWith('tab:')) {
      tab = db.prepare("SELECT * FROM guest_tabs WHERE id = ? AND status = 'offen'").get(int(who.slice(4)));
      if (!tab) return bad(res, 'Dieser Deckel ist schon bezahlt oder geschlossen.', 401);
      if (ev) return bad(res, 'Während der Veranstaltung bitte die Veranstaltungsliste nutzen.');
      kind = 'gast'; paidCash = 0;                          // angeschrieben, bezahlt wird am Ende
    } else if (typeof who === 'string' && who.startsWith('event:')) {
      if (!ev || ev.id !== int(who.slice(6))) return bad(res, 'Die Veranstaltung ist beendet.');
      if (nurAnschreiben()) return bad(res, NUR_ANSCHREIBEN_MSG, 403);
      kind = 'event'; paidCash = 1;                         // Barverkauf ohne Namen
    } else if (typeof who === 'string' && who.startsWith('guest:')) {
      guest = db.prepare('SELECT * FROM event_guests WHERE id = ?').get(int(who.slice(6)));
      if (!guest || !ev || guest.event_id !== ev.id) return bad(res, 'Die Veranstaltung ist beendet.', 401);
      kind = 'event'; paidCash = 0;                         // wird auf der Veranstaltungsliste angeschrieben
    } else {
      member = db.prepare('SELECT * FROM members WHERE id = ? AND active = 1').get(who);
      if (!member) return bad(res, 'Konto nicht gefunden.');
      kind = { mitglied: 'konto', nichtmitglied: 'konto', mannschaft: 'konto', verein: 'verein', gast: 'gast' }[member.kind];
      if (kind === 'gast' && nurAnschreiben()) return bad(res, NUR_ANSCHREIBEN_MSG, 403);
      if (ev && (kind === 'verein' || kind === 'gast')) return bad(res, 'Während der Veranstaltung wird nur auf die Veranstaltungsliste gebucht – für Gäste „Barverkauf ohne Namen“.');
      if (ev && kind === 'konto') {                         // während einer Veranstaltung immer auf deren Liste
        guest = addGuest(ev, { memberId: member.id }, 'tablet');
        kind = 'event'; paidCash = 0;
      }
    }

    // Bei laufender Veranstaltung gelten nur deren Getränke und Preise
    const evPrice = ev ? new Map(ev.articles.map(a => [a.id, a.price_cents])) : null;
    const getArticle = db.prepare('SELECT * FROM articles WHERE id = ?');
    const insB = db.prepare(`INSERT INTO bookings(member_id, article_id, event_id, kind, qty, unit_cents, total_cents, paid_cash, event_guest_id, note, tab_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const ins = { run: (...a) => insB.run(...a, tab ? tab.id : null) };
    const created = [];
    const memberId = member ? member.id : (guest ? guest.member_id : null);
    if (items.length > 30) return bad(res, 'Zu viele Positionen.');
    const tx = db.transaction(() => {
      for (const it of items) {
        if (it && it.custom) {                              // frei eingegebener Betrag
          if (!Number.isInteger(Number(it.cents))) throw new Error('Betrag bitte in ganzen Cent angeben.');   // keine Nachkommastellen stillschweigend abschneiden
          const cents = int(it.cents);
          if (cents < 10 || cents > 50000) throw new Error('Betrag bitte zwischen 0,10 € und 500 €.');
          const note = cleanName(it.note, 60) || null;
          const total = kind === 'verein' ? 0 : cents;
          const r = ins.run(memberId, customArticleId(), ev ? ev.id : null, kind, 1, cents, total, paidCash, guest ? guest.id : null, note);
          created.push({ id: Number(r.lastInsertRowid), name: 'Betrag' + (note ? ' (' + note + ')' : ''), qty: 1, total_cents: total, list_cents: cents });
          continue;
        }
        if (!Number.isInteger(Number(it.qty))) throw new Error('Ungültige Menge.');
        const qty = int(it.qty);
        if (qty < 1 || qty > 99) throw new Error('Ungültige Menge.');
        const a = getArticle.get(int(it.articleId));
        if (!a || a.custom) throw new Error('Artikel nicht verfügbar.');
        let price = a.price_cents;
        if (evPrice) {
          if (!evPrice.has(a.id)) throw new Error(`„${a.name}“ gibt es bei dieser Veranstaltung nicht.`);
          price = evPrice.get(a.id);
        } else if (!a.active) throw new Error('Artikel nicht verfügbar.');
        const total = kind === 'verein' ? 0 : price * qty;
        const r = ins.run(memberId, a.id, ev ? ev.id : null, kind, qty, price, total, paidCash, guest ? guest.id : null, null);
        created.push({ id: Number(r.lastInsertRowid), name: a.name, qty, total_cents: total, list_cents: price * qty });
      }
    });
    try { tx(); } catch (e) { return bad(res, e.message); }

    const resp = { bookings: created, kind, paid_cash: paidCash, event: ev ? ev.name : null,
      total_cents: created.reduce((s, b) => s + b.total_cents, 0) };
    if (tab) {
      resp.tab = { id: tab.id, name: tab.name }; resp.open_cents = tabOpen(tab.id);
    } else if (guest) {
      // Veranstaltungsliste ist exklusiv (nur Buchungen dieser Veranstaltung, nie das Getränkekonto) –
      // das Thekenpersonal muss sie für jeden sehen können, auch ohne PIN
      resp.guest = { id: guest.id, name: guest.name }; resp.private = !eingeschraenkt; if (!eingeschraenkt) resp.open_cents = guestOpen(guest.id);
    } else if (member) {
      resp.private = !eingeschraenkt && privateOk(member);
      if (resp.private) {
        resp.balance = memberBalance(member.id);
        resp.eventOpen_cents = eventOpen(member.id);
      }
    }
    if (rkey) bookReplay.set(rkey, { at: Date.now(), body: resp });
    if (eingeschraenkt) merkeOhnePin(token, created.map(b => b.id));
    res.json(resp);
  });

  app.post('/api/tablet/undo', rateLimit('undo', 60, 60000), (req, res) => {
    const { token, bookingIds } = req.body || {};
    const who = auth.checkTabletTokenBuchen(token);
    if (!who) return bad(res, 'Sitzung abgelaufen. Rückgängig bitte über den Vorstand.', 401);
    const eingeschraenkt = !auth.checkTabletToken(token);
    if (eingeschraenkt && !offenOk(db.prepare('SELECT * FROM members WHERE id = ?').get(who))) return bad(res, 'Sitzung abgelaufen. Rückgängig bitte über den Vorstand.', 401);
    if (!Array.isArray(bookingIds) || !bookingIds.length) return bad(res, 'Nichts zum Zurücknehmen.');
    const ids = bookingIds.map(i => int(i));
    const selbst = ohnePinGebucht.get(token);
    if (eingeschraenkt && !ids.every(id => selbst && selbst.ids.has(id))) return bad(res, 'Diese Buchung gehört nicht zu diesem Konto.', 403);
    const rows = db.prepare(`SELECT * FROM bookings WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
    const limit = new Date(Date.now() - UNDO_WINDOW_MIN * 60000);
    for (const b of rows) {
      if (b.kind === 'event') return bad(res, 'Bei Veranstaltungen storniert nur der Vorstand (Verwaltung → Buchungen).', 403);
      const owners = [b.tab_id ? 'tab:' + b.tab_id : null, b.event_guest_id ? 'guest:' + b.event_guest_id : null, b.member_id, b.member_id === null && !b.event_guest_id && !b.tab_id ? 'event:' + b.event_id : null];
      if (!owners.includes(who)) return bad(res, 'Diese Buchung gehört nicht zu diesem Konto.', 403);
      if (b.tab_id && !db.prepare("SELECT 1 FROM guest_tabs WHERE id = ? AND status = 'offen'").get(b.tab_id)) return bad(res, 'Der Deckel ist schon bezahlt.');
      if (b.payment_id || b.transferred_at) return bad(res, 'Schon bezahlt bzw. übernommen – bitte an den Vorstand wenden.');
      // Abgerechnete Buchungen dürfen am Tablet nicht mehr storniert werden – sonst passen Abrechnung und Buchungen
      // nicht mehr zusammen; eine Gutschrift kann nur die Verwaltung erteilen.
      if (b.settled_id) return bad(res, 'Diese Buchung ist bereits abgerechnet – bitte an den Vorstand wenden.');
      if (new Date(b.created_at.replace(' ', 'T')) < limit) {
        return bad(res, `Rückgängig ist nur ${UNDO_WINDOW_MIN} Minuten lang möglich. Bitte an den Vorstand wenden.`);
      }
    }
    // settled_id IS NULL auch hier: schützt gegen eine Abrechnung zwischen Prüfung und UPDATE
    const upd = db.prepare(`UPDATE bookings SET cancelled_at = datetime('now','localtime'), cancelled_by = 'tablet'
    WHERE id = ? AND cancelled_at IS NULL AND settled_id IS NULL`);
    let cancelled = 0;
    db.transaction(() => rows.forEach(b => { cancelled += upd.run(b.id).changes; }))();   // schon stornierte zählen nicht mit
    if (!cancelled && rows.some(b => !b.cancelled_at)) return bad(res, 'Diese Buchung ist bereits abgerechnet – bitte an den Vorstand wenden.');
    res.json({ ok: true, cancelled });
  });

  app.get('/api/tablet/account', (req, res) => {
    const who = auth.checkTabletToken(req.query.token);
    if (typeof who === 'string' && who.startsWith('tab:')) {
      const t = db.prepare('SELECT * FROM guest_tabs WHERE id = ?').get(int(who.slice(4)));
      if (!t) return bad(res, 'Sitzung abgelaufen.', 401);
      const rows = db.prepare(`SELECT b.created_at, CASE WHEN a.custom = 1 THEN 'Betrag' || COALESCE(' (' || b.note || ')', '') ELSE COALESCE(b.article_name, a.name) END AS name,
        b.qty, b.total_cents, b.kind FROM bookings b JOIN articles a ON a.id = b.article_id
      WHERE b.tab_id = ? AND b.cancelled_at IS NULL ORDER BY b.created_at DESC LIMIT 200`).all(t.id);
      return res.json({ tab: { id: t.id, name: t.name }, rows, open_cents: tabOpen(t.id) });
    }
    if (typeof who === 'string' && who.startsWith('guest:')) {
      const g = db.prepare('SELECT g.*, e.name AS event FROM event_guests g JOIN events e ON e.id = g.event_id WHERE g.id = ?').get(int(who.slice(6)));
      if (!g) return bad(res, 'Sitzung abgelaufen.', 401);
      const rows = db.prepare(`SELECT b.created_at, CASE WHEN a.custom = 1 THEN 'Betrag' || COALESCE(' (' || b.note || ')', '') ELSE COALESCE(b.article_name, a.name) END AS name,
        b.qty, b.total_cents, b.kind, b.payment_id, b.transferred_at, p.method
      FROM bookings b JOIN articles a ON a.id = b.article_id LEFT JOIN event_payments p ON p.id = b.payment_id
      WHERE b.event_guest_id = ? AND b.cancelled_at IS NULL ORDER BY b.created_at DESC LIMIT 200`).all(g.id);
      return res.json({ guest: { id: g.id, name: g.name }, event: g.event, rows, open_cents: guestOpen(g.id) });
    }
    if (!who || typeof who !== 'number') return bad(res, 'Sitzung abgelaufen.', 401);
    if (!privateOk(db.prepare('SELECT pin_hash FROM members WHERE id = ?').get(who))) return bad(res, 'Konto und Verlauf sind nur mit PIN sichtbar.', 403);
    // Offene Konto-Buchungen (seit der letzten Abrechnung dieses Mitglieds) + sonstige der letzten 60 Tage
    const rows = db.prepare(`SELECT b.created_at, CASE WHEN a.custom = 1 THEN 'Betrag' || COALESCE(' (' || b.note || ')', '') ELSE COALESCE(b.article_name, a.name) END AS name,
      b.qty, b.total_cents, b.kind, b.paid_cash, b.transferred_at, e.name AS event
    FROM bookings b JOIN articles a ON a.id = b.article_id LEFT JOIN events e ON e.id = b.event_id
    WHERE b.member_id = ? AND b.cancelled_at IS NULL
      AND ((b.kind = 'konto' AND b.settled_id IS NULL) OR (b.kind <> 'konto' AND date(b.created_at) >= date('now','localtime','-60 days')))
    ORDER BY b.created_at DESC LIMIT 200`).all(who);
    const last = db.prepare('SELECT MAX(until_at) t FROM member_settlements WHERE member_id = ?').get(who).t;
    res.json({ lastSettled: last, rows, balance: memberBalance(who), eventOpen_cents: eventOpen(who) });
  });

  app.post('/api/tablet/pin', rateLimit('pin', 20, 60000), async (req, res) => {
    const { token, currentPin, newPin } = req.body || {};
    const who = auth.checkTabletToken(token);
    if (!who || typeof who !== 'number') return bad(res, 'Sitzung abgelaufen.', 401);
    const m = db.prepare('SELECT * FROM members WHERE id = ?').get(who);
    if (!isPerson(m.kind)) return bad(res, 'Für dieses Konto kann keine PIN gesetzt werden.');
    if (m.pin_hash) {
      const err = await checkPin(m, currentPin);           // zählt in dieselbe Sperre wie das Entsperren
      if (err) return bad(res, err.msg === 'PIN falsch.' ? 'Aktuelle PIN falsch.' : err.msg, err.code);
    }
    // Die PIN ist eine Zentralfunktion (Verkauf, Platzbuchung, Helferdienste) – entfernen kann sie nur der Vorstand (zurücksetzen)
    if (newPin === '' || newPin === null) return bad(res, 'Die PIN kann nicht entfernt werden – sie gilt für Verkauf, Platzbuchung und Helferdienste. Vergessen? Der Vorstand setzt sie zurück.');
    { const e = auth.pinProblem(newPin); if (e) return bad(res, e); }
    const newHash = await auth.hashPin(newPin);
    db.prepare(`UPDATE members SET pin_hash = ?, failed_pins = 0, pin_strikes = 0, locked_until = NULL,
      pin_changed_at = datetime('now','localtime'), pin_changed_by = 'Mitglied' WHERE id = ?`).run(newHash, m.id);
    // eine PIN für alles: gilt ab sofort auch in der Mitglieder-App
    // nur mit der bisherigen PIN als Nachweis (die erste PIN am Tablet ändert eine vorhandene App-PIN nicht)
    await require('./invites').pinToApp(m.id, db.prepare('SELECT pin_hash FROM members WHERE id = ?').get(m.id).pin_hash, m.pin_hash ? String(currentPin) : null);
    audit('tablet', m.pin_hash ? 'PIN geändert' : 'PIN festgelegt', m.name);
    require('./push').send(m.id, 'app.pin', { title: `${getSetting('club_name', 'Verein')}: PIN geändert`, body: 'Deine PIN wurde am Tablet geändert. Warst du das nicht, melde dich bitte beim Vorstand.' }).catch(() => {});
    res.json({ ok: true, hasPin: true });
  });

  /* Das Mitglied schaltet „Andere dürfen für mich buchen“ selbst – nur mit vollem PIN-Nachweis (nie mit einer ohne PIN geöffneten Sitzung) */
  app.post('/api/tablet/offen', rateLimit('pin', 20, 60000), (req, res) => {
    const { token, an } = req.body || {};
    const who = auth.checkTabletToken(token);
    if (!who || typeof who !== 'number') return bad(res, 'Sitzung abgelaufen.', 401);
    const m = db.prepare('SELECT * FROM members WHERE id = ?').get(who);
    if (!m || m.kind !== 'mitglied' || !m.pin_hash) return bad(res, 'Dafür braucht das Konto eine PIN.');
    const neu = an ? 1 : 0;
    if (neu !== m.offen_buchen) {
      db.prepare('UPDATE members SET offen_buchen = ? WHERE id = ?').run(neu, m.id);
      audit('tablet', 'Andere dürfen für mich buchen', `${m.name}: ${neu ? 'eingeschaltet' : 'ausgeschaltet'}`);
    }
    res.json({ ok: true, offen: Boolean(neu) });
  });

  app.post('/api/tablet/logout', (req, res) => {
    auth.dropTabletToken((req.body || {}).token);
    res.json({ ok: true });
  });
  return { addGuest, closeTab, eventOpen, eventOpenAll, guestOpen, nurAnschreiben, NUR_ANSCHREIBEN_MSG, OPEN_GUEST, topDays, topN };
};
