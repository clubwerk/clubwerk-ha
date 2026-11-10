'use strict';
/**
 * Willkommens-E-Mail – ein Weg für alle Fälle: angenommene Beitrittserklärung, „Neues Mitglied“ (auch Partner/Kind anlegen)
 * und der Knopf „Willkommens-E-Mail senden …“ am Mitglied.
 *  - Betreff und Text legt der Verein unter Mitglieder › Einstellungen fest (Platzhalter {Vorname} …), Standard = der frühere feste Text.
 *  - Den SEPA-Block (Mandatsreferenz, Gläubiger-ID) hängt Clubwerk bei Lastschrift immer selbst an – nicht änderbar.
 *  - Anhang: die hochgeladene Beitrittserklärung, wenn sie ein PDF ist.
 *  - Ohne eigene Adresse geht die Mail an das Familienoberhaupt.
 *  - Optional mit Einladung zur Mitglieder-App (ctx.appInvite) – nur, wenn die Adresse dem Mitglied gehört (Regel „gemeinsame Adresse“,
 *    store.mailOwners); sonst bleibt nur der QR-Code.
 *  Jeder Versand steht im Protokoll und im Verlauf des Mitglieds (Feld „Willkommens-E-Mail“, daraus „zuletzt gesendet am …“).
 */
const fs = require('fs');
const path = require('path');

const PH = ['Vorname', 'Nachname', 'Mitgliedsnummer', 'Verein', 'Eintritt', 'Beitrag'];
const DEF_SUBJECT = 'Willkommen im {Verein}';
const DEF_TEXT = 'Guten Tag {Vorname} {Nachname},\n\nherzlich willkommen im {Verein}! Ihre Mitgliedschaft ist bestätigt.\n\nMitgliedsnummer: {Mitgliedsnummer}\n\nViele Grüße\n{Verein}';
const FIELD = 'Willkommens-E-Mail';
/** unbekannte Platzhalter im Text ({Irgendwas}) */
const unknownPh = t => [...new Set([...String(t || '').matchAll(/\{([^{}\n]{1,40})\}/g)].map(m => m[1]).filter(k => !PH.includes(k)))];
const fill = (t, v) => String(t).replace(/\{(Vorname|Nachname|Mitgliedsnummer|Verein|Eintritt|Beitrag)\}/g, (m, k) => v[k] || '');

function register(sh) {
  const { C, store, fees, personRow, one, txt, euro, deD, uname } = sh;
  const { S, SET } = store;
  const db = C.db, admin = C.admin, { need, bad, int } = C;
  const P = need('mitglieder');
  const club = () => ({ name: S('creditor_name') || C.getSetting('club_name', 'Verein'), ci: S('creditor_id') });
  /* Übersetzen: Der eigene Text des Vereins bleibt, wie er ist (Mail geht mit raw). Der mitgelieferte Standardtext und die festen Teile
     (SEPA-Block, Anhang-Hinweis, App-Einladung) kommen in der Sprache der Anfrage bzw. der Vereinssprache – wie jede Systemmail. */
  const tr = t => C.require('./i18n').tr(String(t));
  const trLines = t => String(t).split('\n').map(l => (l ? tr(l) : l)).join('\n');
  const defTpl = () => ({ subject: trLines(DEF_SUBJECT), text: trLines(DEF_TEXT) });
  const tpl = () => { const d = defTpl(); return { subject: S('welcome_subject') || d.subject, text: S('welcome_text') || d.text, custom: Boolean(S('welcome_subject') || S('welcome_text')) }; };

  /** Beitrag als Satzteil: „Erwachsene, 120,00 € jährlich“ – Familienmitglieder: Beitrag des Oberhaupts „(Familienbeitrag)“ */
  function feeText(p) {
    const q = id => db.prepare(`SELECT f.* FROM mv_member_fee mf JOIN mv_fee f ON f.id = mf.fee_id WHERE mf.member_id = ? AND f.kind != 'zusatz' AND (mf.end_date IS NULL OR mf.end_date >= ?) ORDER BY mf.start_date DESC, mf.id DESC LIMIT 1`).get(id, store.today());
    const own = p.member_id ? q(p.member_id) : db.prepare("SELECT * FROM mv_fee WHERE active = 1 AND kind != 'zusatz' AND family = 0 ORDER BY sort, name LIMIT 1").get(),   // Vorschau: erster Beitrag
      f = own || (p.family_of ? q(p.family_of) : null);
    if (!f) return '';
    return `${f.name}, ${euro(f.cents)}${fees.INTERVAL_LABEL[f.interval] ? ' ' + fees.INTERVAL_LABEL[f.interval] : ''}${own ? '' : ' (Familienbeitrag)'}`;
  }
  /** Werte der Platzhalter für ein Mitglied */
  function vars(p) {
    return { Vorname: p.first_name || store.splitName(p.name).first || '', Nachname: p.last_name || store.splitName(p.name).last || '', Mitgliedsnummer: p.member_no || '–',
      Verein: club().name, Eintritt: p.entry_date ? deD(p.entry_date) : '', Beitrag: feeText(p) || '–' };
  }
  /** Empfänger: eigene Adresse, sonst die des Oberhaupts (Familie) */
  function recipient(p) {
    const ok = e => e && sh.mailOk(String(e).trim()) && !/@clubwerk\.invalid$/i.test(e);
    if (ok(p.email)) return { to: String(p.email).trim(), via: null };
    if (p.family_of) { const h = personRow(p.family_of); if (h && ok(h.email)) return { to: String(h.email).trim(), via: h.name }; }
    return null;
  }
  /** SEPA-Block (fest): Mandat des Mitglieds bzw. seines Zahlers – nur bei Lastschrift */
  function sepaRows(p) {
    const payer = store.payerOf(p.member_id), pp = personRow(payer) || p;
    if ((pp.payment || 'lastschrift') !== 'lastschrift') return [];
    const b = db.prepare('SELECT mandate_ref FROM mv_bank WHERE member_id = ? AND mandate_revoked IS NULL').get(payer);
    if (!b || !b.mandate_ref) return [];
    return [[tr('Mandatsreferenz für das SEPA-Lastschriftmandat'), b.mandate_ref], ...(club().ci ? [[tr('Gläubiger-Identifikationsnummer'), club().ci]] : [])];
  }
  /** Beitrittserklärung als PDF (zuletzt hochgeladene des Mitglieds) */
  function docFile(id) {
    const d = db.prepare("SELECT * FROM mv_document WHERE member_id = ? AND kind = 'antrag' ORDER BY id DESC LIMIT 1").get(id);
    if (!d) return null;
    const f = path.join(C.require('./db').DATA_DIR, 'mitglieder-dokumente', path.basename(d.file));
    if (!fs.existsSync(f)) return null;
    const head = Buffer.alloc(5); try { const fd = fs.openSync(f, 'r'); fs.readSync(fd, head, 0, 5, 0); fs.closeSync(fd); } catch (e) { return null; }
    return head.toString('latin1') === '%PDF-' ? f : null;
  }
  /** Was geht, was nicht? (für Fenster und Knopf) */
  function state(id) {
    const p = personRow(id); if (!p) return null;
    const r = recipient(p), mailReady = C.mail.ready();
    const why = !mailReady ? 'Kein Postfach eingerichtet (Einstellungen › Postfach).' : !r ? 'Keine E-Mail-Adresse hinterlegt.' : '';
    const last = db.prepare('SELECT at, by_user FROM mv_history WHERE member_id = ? AND field = ? ORDER BY id DESC LIMIT 1').get(id, FIELD);
    let app = { ok: false, reason: 'Die Mitglieder-App ist nicht verfügbar.' };
    try { app = C.appInvite ? C.appInvite.state(id) : app; } catch (e) { /* */ }
    if (app.ok && r && r.via) app = { ok: false, reason: 'Die E-Mail geht an das Oberhaupt – die Einladung zur App bitte per QR-Code.' };
    return { ok: !why, why, to: r ? r.to : null, via: r ? r.via : null, last: last ? { at: last.at, by: last.by_user } : null, app: { ok: Boolean(app.ok), reason: app.ok ? '' : app.reason } };
  }
  /** Mail bauen (ohne zu senden) – auch für die Vorschau */
  function build(p, { subject, text } = tpl(), invite = null) {
    const v = vars(p), rows = p.sample ? p.sample : sepaRows(p), file = p.sample ? null : docFile(p.member_id);
    const body = fill(text, v).trim(), subj = fill(subject, v).replace(/\s+/g, ' ').trim().slice(0, 200);
    const att = file ? tr('Ihre Beitrittserklärung finden Sie als PDF im Anhang.') : '', steps = invite ? invite.steps.map(tr) : [];
    const fixed = [...(rows.length ? ['', ...rows.map(([k, x]) => `${k}: ${x}`)] : []), ...(att ? ['', att] : [])];
    const app = invite ? ['', '', tr('Mitglieder-App'), tr('Öffnen Sie diese E-Mail auf Ihrem Handy und tippen Sie auf „App jetzt freischalten“:'), invite.url, tr(invite.note), '', ...steps.map((x, i) => `${i + 1}. ${x}`)] : [];
    return { subject: subj, text: [body, ...fixed, ...app].join('\n'), rows, file,
      card: { heading: subj, before: body, ...(rows.length ? { title: tr('Für Ihre Unterlagen'), rows } : {}), after: [att, invite ? tr('Mitglieder-App: Öffnen Sie diese E-Mail auf Ihrem Handy und tippen Sie auf den Knopf.') : ''].filter(Boolean).join('\n\n') || undefined,
        ...(invite ? { steps, button: { label: tr('App jetzt freischalten'), url: invite.url, wide: true, note: tr(invite.note) } } : {}) } };
  }
  /** Versand – gemeinsam für alle Wege. opts.app: Einladung zur Mitglieder-App mitsenden. → { to, app } */
  async function send(id, user, { app = false, guide = false, why = 'von Hand' } = {}) {
    const p = personRow(id); if (!p) throw new Error('Mitglied nicht gefunden.');
    const stt = state(id); if (!stt.ok) throw new Error(stt.why);
    let inv = null;
    if (app) { if (!stt.app.ok) throw new Error(stt.app.reason); inv = C.appInvite.create(id, user); }
    const m = build(p, tpl(), inv);
    try {
      const att = [...(m.file ? [{ filename: 'Beitrittserklaerung.pdf', path: m.file }] : []), ...(inv && guide ? [await C.appInvite.guide()] : [])];
      await C.mail.send({ raw: true, to: stt.to, subject: m.subject, text: m.text, card: m.card, attachments: att.length ? att : undefined });
    } catch (e) { if (inv) inv.revoke(); throw e; }
    const by = user ? uname({ user }) : null;
    store.hist(id, by, FIELD, null, `an ${stt.to}${inv ? ' · mit Einladung zur Mitglieder-App' : ''}`);
    C.audit(user || null, 'Mitglieder: Willkommens-E-Mail gesendet', `${p.name} · an ${stt.to}${stt.via ? ` (Oberhaupt ${stt.via})` : ''}${inv ? ' · mit Einladung zur Mitglieder-App' : ''} · ${why}`);
    return { to: stt.to, app: Boolean(inv) };
  }

  /* ---------- Verwaltung ---------- */
  admin.get('/member/:id/welcome', P, (req, res) => { const s = state(int(req.params.id)); if (!s) return bad(res, 'Mitglied nicht gefunden.', 404); res.json(s); });
  admin.post('/member/:id/welcome', P, async (req, res) => {
    const id = int(req.params.id);
    if (req.mvScope && !sh.inScope(id, req.mvScope)) return bad(res, 'Nur Mitglieder deiner Abteilung(en).', 403);
    const b = req.body || {};
    try { res.json({ ok: true, ...(await send(id, req.user, { app: Boolean(b.app), guide: b.guide !== false, why: 'Knopf am Mitglied' })), state: state(id) }); } catch (e) { bad(res, e.message); }
  });
  /** Vorlage (Einstellungen) */
  const view = () => ({ ...tpl(), def: defTpl(), placeholders: PH.map(k => `{${k}}`), mailReady: C.mail.ready() });
  admin.get('/welcome-template', P, (req, res) => res.json(view()));
  /** Prüfen: leer nicht erlaubt; unbekannte Platzhalter → Warnung (speichern geht trotzdem, wenn force) */
  function check(b) {
    const subject = one(b.subject, 200), text = txt(b.text, 6000);
    if (!subject.trim() || !text.trim()) return { error: 'Betreff und Text dürfen nicht leer sein – „Standardtext wiederherstellen“ setzt den Standard ein.' };
    return { subject, text, unknown: unknownPh(subject + '\n' + text) };
  }
  admin.post('/welcome-template/preview', P, (req, res) => {
    const c = check(req.body || {}); if (c.error) return bad(res, c.error);
    const id = int((req.body || {}).member_id);
    const p = (id && personRow(id)) || { member_id: 0, first_name: 'Anna', last_name: 'Beispiel', name: 'Anna Beispiel', member_no: '1001', entry_date: store.today(), payment: 'lastschrift',
      sample: [[tr('Mandatsreferenz für das SEPA-Lastschriftmandat'), store.mandateRefFor('1001')], [tr('Gläubiger-Identifikationsnummer'), club().ci || 'DE98ZZZ09999999999']] };
    const m = build(p, c);
    res.json({ subject: m.subject, text: m.text, unknown: c.unknown, sample: !id });
  });
  admin.put('/welcome-template', P, (req, res) => {
    const b = req.body || {};
    if (req.mvScope) return bad(res, 'Die Willkommens-E-Mail legt die Vereinsverwaltung fest.', 403);
    const before = tpl();
    const d = defTpl(); let { subject, text } = d;
    if (!b.reset) { const c = check(b); if (c.error) return bad(res, c.error); if (c.unknown.length && !b.force) return res.status(409).json({ error: `Unbekannte Platzhalter: ${c.unknown.map(k => `{${k}}`).join(', ')}. Erlaubt sind ${PH.map(k => `{${k}}`).join(', ')}.`, unknown: c.unknown }); ({ subject, text } = c); }
    // Standard = leer gespeichert (künftige Änderungen am Standard kommen dann von selbst an)
    SET('welcome_subject', subject === d.subject ? '' : subject); SET('welcome_text', text === d.text ? '' : text);
    const diff = C.auditDiff({ subject: 'Betreff', text: ['Text', 'text'] }, { subject: before.subject, text: before.text }, { subject, text });
    if (diff) C.audit(req.user, 'Mitglieder: Willkommens-E-Mail geändert', b.reset ? 'Standardtext wiederhergestellt' : diff);
    res.json({ ok: true, ...view() });
  });

  return { send, state };
}
module.exports = { register, PH, DEF_SUBJECT, DEF_TEXT, unknownPh };
