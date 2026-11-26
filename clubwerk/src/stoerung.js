'use strict';
/* Benachrichtigung bei Störungen – ein Baustein für alle Module mit Karte „Benachrichtigungen“ (Flutlicht, Zugang, Beregnung;
   Mängel nutzt nur die Empfängerliste). Modul-Aufruf über ctx.stoerung:
   - einrichten({ recht, seite, ha, pushId }, ctx.admin) legt GET/PUT /api/admin/x/<modul>/stoerung an (Karte GK.stoerungKarte in der Verwaltung).
     ha = { get, set, zeigen } nur bei Modulen, die früher an einen notify-Dienst von Home Assistant gemeldet haben (Wert bleibt im Modul).
   - melden(text, { key }): E-Mail an die eingetragenen Adressen über das zentrale Postfach (nur mit Vereinsnamen), Push über die
     Mitglieder-App an Verwaltungsnutzer mit dem Recht des Moduls (Anlass "<modul>.stoerung", Vorstand gibt frei) und – falls
     eingetragen – an den notify-Dienst von Home Assistant. Gleiche Meldung höchstens einmal je Stunde, je Modul höchstens 20 am Tag.
   - empfaenger(), pruefen(text), pushAnlass(label, desc)
   Die Adressen sind Personendaten: Einstellung ext_<modul>_stoerung_mail, nie im Funktionsexport. */
const { getSetting, setSetting, db, audit } = require('./db');
const { jetzt, nowTs, pad } = require('./util');

const MAX = 10, DAY_MAX = 20, SAME_MS = 3600000;
const KEY = id => `ext_${id}_stoerung_mail`;
const re = /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]+$/;

/** Text der Verwaltung → Liste gültiger Adressen; wirft mit field 'stoerungMail' bei ungültiger Adresse */
function pruefen(text) {
  const l = [...new Set(String(text || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean).map(x => x.toLowerCase()))];
  const falsch = l.find(x => x.length > 120 || !re.test(x));
  if (falsch) throw Object.assign(new Error(`„${falsch.slice(0, 60)}“ ist keine gültige E-Mail-Adresse. Mehrere Adressen mit Komma trennen.`), { field: 'stoerungMail' });
  if (l.length > MAX) throw Object.assign(new Error(`Bitte höchstens ${MAX} Adressen eintragen.`), { field: 'stoerungMail' });
  return l;
}
const lesen = id => String(getSetting(KEY(id), '') || '').split(/[,;\s]+/).filter(x => re.test(x));

/** Lokale Adresse der Verwaltung für Links in Mails: zuletzt im Vereinsnetz benutzte Adresse, sonst Rechnername der lokalen App-Adresse */
function adminBase() {
  const seen = getSetting('stoerung_admin_url', '');
  if (/^https?:\/\/[^/\s]+$/.test(seen)) return seen;
  try { const u = new URL(getSetting('app_url', '')); return `${require('./tls').enabled() ? 'https' : 'http'}://${u.hostname}:${process.env.PORT || 3100}`; } catch (e) { return ''; }
}
function merkeAdresse(req) {
  if (req.get('x-ingress-path')) return;   // Seitenleiste von Home Assistant: Adresse taugt nicht für einen Link
  const host = String(req.get('host') || '');
  if (/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) { const u = `${req.protocol}://${host}`; if (getSetting('stoerung_admin_url', '') !== u) setSetting('stoerung_admin_url', u); }
}

const zuletzt = new Map();   // "<modul>|<key>" → Zeitpunkt (Drossel gleicher Meldungen)
const zeit = () => { const d = jetzt(); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`; };

function fuerModul(id, meta) {
  const name = (meta && meta.name) || id;
  let opt = { recht: (meta && meta.verwaltung && meta.verwaltung.recht) || id, seite: id, ha: null, pushId: 'stoerung' };
  /** Tagesgrenze je Modul (Einstellung stoerung_tag_<modul> = "JJJJ-MM-TT|Anzahl") */
  const darfMelden = () => {
    const heute = nowTs().slice(0, 10), [d, n0] = String(getSetting('stoerung_tag_' + id, '') || '').split('|'), n = d === heute ? Number(n0) || 0 : 0;
    if (n >= DAY_MAX) return false;
    setSetting('stoerung_tag_' + id, `${heute}|${n + 1}`); return true;
  };
  /** Verwaltungsnutzer mit dem Recht des Moduls (auch „alle Rechte“), deren Konto mit einem Mitglied verknüpft ist */
  const pushIds = () => {
    const auth = require('./auth');
    return db.prepare('SELECT * FROM admin_users WHERE active = 1 AND member_id IS NOT NULL').all().filter(u => auth.permInfo(u).perms.includes(opt.recht)).map(u => u.member_id);
  };
  /** @param {string} text @param {{ key?: string }} [o] */
  function melden(text, { key } = {}) {
    const t = require('./security').clean(text);   // keine Zugangsdaten oder Token-artigen Zeichenfolgen in Meldungen
    const k = `${id}|${key == null ? t : key}`, now = Date.now();
    if (zuletzt.has(k) && now - zuletzt.get(k) < SAME_MS) return { gedrosselt: true };
    if (zuletzt.size > 500) zuletzt.clear();
    zuletzt.set(k, now);
    if (!darfMelden()) return { gedrosselt: true };
    const out = { mail: 0, push: 0, ha: false };
    if (opt.ha) { const svc = String(opt.ha.get() || ''); if (svc) { out.ha = true; require('./ha').notify(svc, name, t).catch(() => {}); } }
    const club = getSetting('club_name', '');
    const mail = require('./mail'), to = lesen(id);
    if (to.length && mail.ready() && require('./vereinsname').isSet()) {
      const base = adminBase(), link = base ? `${base}/admin.html#${opt.seite}` : '';
      out.mail = to.length;
      mail.send({ to: to.join(', '), subject: `Störung ${name} – ${club}`,
        text: ['Hallo,', '', t, '', `Bereich: ${name}`, `Zeit: ${zeit()}`, '', link ? `In der Verwaltung ansehen (im Vereinsnetz): ${link}` : `Mehr dazu in der Verwaltung unter „${name}“.`, '', `Automatisch versendet von Clubwerk (${club}).`].join('\n'),
        card: { heading: `Störung ${name}`, title: club, rows: [['Was', t], ['Bereich', name], ['Zeit', zeit()]], after: 'Diese Nachricht kommt, weil die Adresse unter „Benachrichtigungen“ des Bereichs eingetragen ist.', ...(link ? { button: { label: 'In der Verwaltung ansehen', url: link, note: 'Nur im Vereinsnetz erreichbar.' } } : {}) } })
        .catch(e => console.error(`${name} – Störungs-Mail:`, e.message));
    }
    try {
      const ids = pushIds();
      if (ids.length) {
        out.push = ids.length;
        require('./push').send(ids, `${id}.stoerung`, { title: `Störung ${name}`, body: t.slice(0, 180), url: './', tag: `${id}-stoerung` }).catch(e => console.error(`${name} – Störungs-Push:`, e.message));
      }
    } catch (e) { console.error(`${name} – Störungs-Push:`, e.message); }
    return out;
  }
  function einrichten(o, router) {
    opt = { ...opt, ...o };
    const need = require('./auth').need(opt.recht);
    const stand = () => ({ mail: lesen(id).join(', '), ha: opt.ha && (!opt.ha.zeigen || opt.ha.zeigen() || opt.ha.get()) ? String(opt.ha.get() || '') : null, postfach: require('./mail').ready(), vereinsname: require('./vereinsname').isSet(),
      push: require('./push').enabled(`${id}.${opt.pushId}`) });
    router.get('/stoerung', need, (req, res) => { merkeAdresse(req); res.json(stand()); });
    router.put('/stoerung', need, (req, res) => {
      const b = req.body || {};
      try {
        const vorher = lesen(id).join(', ');
        if (b.mail !== undefined) { const l = pruefen(b.mail).join(', '); if (l !== vorher) { setSetting(KEY(id), l); audit(req.user, `${name}: E-Mail-Empfänger bei Störung geändert`, `${l.split(', ').filter(Boolean).length} Adresse(n)`); } }
        if (b.ha !== undefined && opt.ha) {
          const n = String(b.ha || '').trim().replace(/^notify\./, '');
          if (n && !/^[a-z0-9_]{1,80}$/.test(n)) throw Object.assign(new Error('Bitte nur den Namen des notify-Dienstes eintragen, z. B. mobile_app_handy_vorstand (Kleinbuchstaben, Ziffern, Unterstrich).'), { field: 'stoerungHa' });
          if (n !== String(opt.ha.get() || '')) { opt.ha.set(n); audit(req.user, `${name}: Home-Assistant-Dienst bei Störung geändert`, n || '(leer)'); }
        }
        merkeAdresse(req);
        res.json(stand());
      } catch (e) { res.status(400).json({ error: e.message, field: e.field }); }
    });
  }
  return {
    einrichten, melden, pruefen,
    empfaenger: () => lesen(id),
    setEmpfaenger: list => setSetting(KEY(id), pruefen(Array.isArray(list) ? list.join(',') : list).join(', ')),
    /** Push-Anlass fürs Modul (hooks.pushEvents): Nachricht an Verwaltungsnutzer mit dem Recht des Moduls */
    pushAnlass: (label, desc) => ({ id: 'stoerung', label, desc: `${desc} Nur für Verwaltungsnutzer mit dem Recht „${name}“, deren Konto mit einem Mitglied verknüpft ist.`, default: true }),
  };
}

module.exports = { fuerModul, pruefen };
