'use strict';
/**
 * Austrittsbestätigung per E-Mail – ein Text für alle Wege: Austritt in der Verwaltung, bestätigte Kündigung aus der Mitglieder-App und
 * bestätigter Austritt einer Abteilungsleitung.
 *  - Betreff und Text legt der Verein unter Mitglieder › Einstellungen fest (Platzhalter {Vorname} …), Standard = mitgelieferter Text.
 *  - Beim Austritt wählt die Verwaltung: Standardtext senden, vor dem Versenden anpassen oder keine E-Mail (mail.mode = standard|custom|none).
 *  - Empfänger: eigene Adresse, sonst das Familienoberhaupt, sonst wer für das Mitglied zahlt (wie bei anderen Dokumenten).
 *  - Ein Fehler beim Versand macht den Austritt nicht rückgängig – er steht in der Antwort und wird in der Oberfläche gezeigt.
 *  Jeder Versand steht im Protokoll und im Verlauf des Mitglieds (Feld „Austrittsbestätigung“).
 */
const PH = ['Vorname', 'Nachname', 'Mitgliedsnummer', 'Verein', 'Austritt', 'Kündigungseingang', 'Personen'];
const DEF_SUBJECT = 'Bestätigung Ihres Austritts – {Verein}';
const DEF_TEXT = 'Guten Tag {Vorname} {Nachname},\n\nhiermit bestätigen wir den Austritt von {Personen} aus dem {Verein}. Die Mitgliedschaft endet zum {Austritt}.\n\nDanke für Ihre Zeit bei uns – Sie sind jederzeit wieder herzlich willkommen.\n\nViele Grüße\n{Verein}';
const FIELD = 'Austrittsbestätigung';
const MODES = ['standard', 'custom', 'none'];
const unknownPh = t => [...new Set([...String(t || '').matchAll(/\{([^{}\n]{1,40})\}/g)].map(m => m[1]).filter(k => !PH.includes(k)))];
const fill = (t, v) => String(t).replace(/\{([^{}\n]{1,40})\}/g, (m, k) => (PH.includes(k) ? v[k] || '' : m));

function register(sh) {
  const { C, store, personRow, one, txt, deD, uname } = sh;
  const { S, SET } = store;
  const admin = C.admin, { need, bad, int } = C;
  const P = need('mitglieder');
  const clubName = () => S('creditor_name') || C.getSetting('club_name', 'Verein');
  // Übersetzen wie bei der Willkommens-E-Mail: der eigene Text des Vereins bleibt, der mitgelieferte Standard kommt in der Sprache der Anfrage
  const tr = t => C.require('./i18n').tr(String(t));
  const trLines = t => String(t).split('\n').map(l => (l ? tr(l) : l)).join('\n');
  const defTpl = () => ({ subject: trLines(DEF_SUBJECT), text: trLines(DEF_TEXT) });
  const tpl = () => { const d = defTpl(); return { subject: S('exit_mail_subject') || d.subject, text: S('exit_mail_text') || d.text, custom: Boolean(S('exit_mail_subject') || S('exit_mail_text')) }; };

  /** „Anna Beispiel“, „Anna und Max Beispiel“ … – natürliche Reihenfolge, wie in einem Brief */
  const personen = names => { const n = names.filter(Boolean); return n.length > 1 ? `${n.slice(0, -1).join(', ')} ${tr('und')} ${n[n.length - 1]}` : n[0] || ''; };
  const fullName = p => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name;
  function vars(p, x) {
    const sp = store.splitName(p.name);
    return { Vorname: p.first_name || sp.first || '', Nachname: p.last_name || sp.last || '', Mitgliedsnummer: p.member_no || '–', Verein: clubName(),
      Austritt: x.exit_date ? deD(x.exit_date) : '', Kündigungseingang: x.notice_date ? deD(x.notice_date) : '', Personen: personen(x.names && x.names.length ? x.names : [fullName(p)]) };
  }
  /** Was geht? → { ok, why, to, via } */
  function state(id) {
    const p = personRow(id); if (!p) return null;
    let r = sh.welcome.recipient(p);   // eigene Adresse, sonst Familienoberhaupt
    if (!r) { const payer = store.payerOf(id), pp = payer !== id && personRow(payer), x = pp && sh.welcome.recipient(pp); if (x) r = { to: x.to, via: pp.name }; }   // sonst wer für das Mitglied zahlt
    const vn = C.require('./vereinsname');
    const why = !vn.isSet() ? vn.MSG : !C.mail.ready() ? 'Kein Postfach eingerichtet (Einstellungen › Postfach).' : !r ? 'Keine E-Mail-Adresse hinterlegt – auch nicht beim Familienoberhaupt oder Zahler.' : '';
    return { ok: !why, why, to: r ? r.to : null, via: r ? r.via : null };
  }
  function build(p, x, t = tpl()) {
    const v = vars(p, x);
    return { subject: fill(t.subject, v).replace(/\s+/g, ' ').trim().slice(0, 200), text: fill(t.text, v).trim() };
  }
  /** Bestätigung nach einem Austritt. mail = { mode, subject, text } aus dem Fenster; x = { exit_date, notice_date, names }.
   *  → null (keine E-Mail gewünscht) | { sent: true, to } | { sent: false, error } – wirft nie. */
  async function afterExit(id, user, mail, x, why) {
    const mode = MODES.includes(mail && mail.mode) ? mail.mode : 'standard';
    if (mode === 'none') return null;
    const p = personRow(id); if (!p) return null;
    const stt = state(id); if (!stt.ok) return { sent: false, error: stt.why };
    let t = tpl();
    if (mode === 'custom') {
      const subject = one(mail.subject, 200), text = txt(mail.text, 6000);
      if (!subject.trim() || !text.trim()) return { sent: false, error: 'Betreff oder Text der Bestätigung war leer – es wurde keine E-Mail gesendet.' };
      t = { subject, text };
    }
    const m = build(p, x, t);
    try { await C.mail.send({ raw: true, to: stt.to, subject: m.subject, text: m.text, log: { art: 'austritt', memberId: id, by: user || null, name: p.name, via: stt.via } }); } catch (e) { return { sent: false, error: `Die Bestätigung konnte nicht gesendet werden: ${e.message}` }; }
    store.hist(id, user ? uname({ user }) : null, FIELD, null, `an ${stt.to}${mode === 'custom' ? ' · angepasst' : ''}`);
    C.audit(user || null, 'Mitglieder: Austrittsbestätigung gesendet', `${p.name} · per E-Mail${stt.via ? ` an das Oberhaupt ${stt.via}` : ''}${mode === 'custom' ? ' · angepasster Text' : ''} · ${why}`);
    return { sent: true, to: stt.to };
  }

  /* ---------- Verwaltung ---------- */
  /** Für das Fenster: geht die Bestätigung, an wen, und wie sieht sie mit dem Standardtext aus (zum Anpassen) */
  admin.post('/member/:id/exit-mail', P, (req, res) => {
    const id = int(req.params.id), b = req.body || {};
    const p = personRow(id); if (!p) return bad(res, 'Mitglied nicht gefunden.', 404);
    if (req.mvScope && !sh.inScope(id, req.mvScope)) return bad(res, 'Nur Mitglieder deiner Abteilung(en).', 403);
    const names = [fullName(p), ...(Array.isArray(b.with) ? b.with.map(int).map(personRow).filter(Boolean).map(fullName) : [])];
    res.json({ ...state(id), ...build(p, { exit_date: b.exit_date, notice_date: b.notice_date, names }) });
  });
  const view = () => ({ ...tpl(), def: defTpl(), placeholders: PH.map(k => `{${k}}`), mailReady: C.mail.ready() });
  admin.get('/exit-template', P, (req, res) => res.json(view()));
  function check(b) {
    const subject = one(b.subject, 200), text = txt(b.text, 6000);
    if (!subject.trim() || !text.trim()) return { error: 'Betreff und Text dürfen nicht leer sein – „Standardtext wiederherstellen“ setzt den Standard ein.' };
    return { subject, text, unknown: unknownPh(subject + '\n' + text) };
  }
  admin.post('/exit-template/preview', P, (req, res) => {
    const c = check(req.body || {}); if (c.error) return bad(res, c.error);
    const p = { first_name: 'Anna', last_name: 'Beispiel', name: 'Anna Beispiel', member_no: '1001' };
    const d = new Date(); const exit = `${d.getFullYear()}-12-31`;
    res.json({ ...build(p, { exit_date: exit, notice_date: store.today(), names: ['Anna Beispiel'] }, c), unknown: c.unknown });
  });
  admin.put('/exit-template', P, (req, res) => {
    const b = req.body || {};
    if (req.mvScope) return bad(res, 'Die Austrittsbestätigung legt die Vereinsverwaltung fest.', 403);
    const before = tpl(), d = defTpl(); let { subject, text } = d;
    if (!b.reset) { const c = check(b); if (c.error) return bad(res, c.error); if (c.unknown.length && !b.force) return res.status(409).json({ error: `Unbekannte Platzhalter: ${c.unknown.map(k => `{${k}}`).join(', ')}. Erlaubt sind ${PH.map(k => `{${k}}`).join(', ')}.`, unknown: c.unknown }); ({ subject, text } = c); }
    SET('exit_mail_subject', subject === d.subject ? '' : subject); SET('exit_mail_text', text === d.text ? '' : text);   // Standard = leer gespeichert
    const diff = C.auditDiff({ subject: 'Betreff', text: ['Text', 'text'] }, { subject: before.subject, text: before.text }, { subject, text });
    if (diff) C.audit(req.user, 'Mitglieder: Austrittsbestätigung geändert', b.reset ? 'Standardtext wiederhergestellt' : diff);
    res.json({ ok: true, ...view() });
  });

  return { afterExit, state, fullName };
}
module.exports = { register, PH, DEF_SUBJECT, DEF_TEXT };
