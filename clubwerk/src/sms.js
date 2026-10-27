'use strict';
/* =====================================================================================================
   SMS über ein USB-Modem (LTE-Stick mit seriellem AT-Zugang, SIM ohne PIN) – ohne Internet, ohne fremden Dienst.
   Das Add-on bekommt die seriellen Geräte des Hosts (config.yaml: uart: true). Jede Aktion öffnet den Anschluss,
   schickt die AT-Befehle und schließt ihn wieder – ein umgesteckter Stick stört so nicht. Immer nur eine Aktion
   gleichzeitig (Warteschlange). Genutzt für den zweiten Faktor beim Freischalten der Mitglieder-App von unterwegs.
   Einstellungen: sms_on ('1'), sms_device (z. B. /dev/ttyUSB2 oder /dev/serial/by-id/…).
   ===================================================================================================== */
const fs = require('fs');
const path = require('path');
const tty = require('tty');
const { execFile } = require('child_process');
const { getSetting } = require('./db');

let chain = Promise.resolve();
/** eine Aktion nach der anderen */
function serial(fn) { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; }

const on = () => getSetting('sms_on', '0') === '1';
const device = () => getSetting('sms_device', '');
const DEV_RE = /^\/dev\/(tty(USB|ACM|AMA|S)\d{1,3}|serial\/by-(id|path)\/[\w:.,+@-]{1,160})$/;
const validDevice = d => DEV_RE.test(String(d || ''));

/** mögliche Anschlüsse (by-id zuerst – bleibt beim Umstecken gleich) */
function candidates() {
  const out = [];
  try { for (const f of fs.readdirSync('/dev/serial/by-id')) out.push(path.join('/dev/serial/by-id', f)); } catch (e) { /* keine */ }
  try { for (const f of fs.readdirSync('/dev')) if (/^tty(USB|ACM)\d+$/.test(f)) out.push('/dev/' + f); } catch (e) { /* */ }
  return [...new Set(out)];
}

function stty(dev) {
  return new Promise((resolve, reject) => {
    execFile('stty', ['-F', dev, '115200', 'raw', '-echo', '-echoe', '-echok', '-ixon', '-ixoff', '-crtscts', 'clocal'], { timeout: 5000 }, err => (err ? reject(new Error('Anschluss lässt sich nicht einstellen (' + (err.code === 'ENOENT' ? 'stty fehlt' : String(err.message).split('\n')[0]) + ').')) : resolve()));
  });
}

/** Anschluss öffnen → { cmd(text, ms) → Antwort, write(raw), close() } */
async function open(dev) {
  if (!validDevice(dev)) throw new Error('Ungültiger Anschluss.');
  if (!fs.existsSync(dev)) throw new Error(`Anschluss ${dev} nicht gefunden – ist der Stick eingesteckt?`);
  await stty(dev).catch(e => { if (!/^\/dev\/pts\//.test(dev)) throw e; });
  let fd;
  try { fd = fs.openSync(dev, fs.constants.O_RDWR | fs.constants.O_NOCTTY); } catch (e) { throw new Error(`Anschluss ${dev} lässt sich nicht öffnen (${e.code}).`); }
  const rs = tty.isatty(fd) ? new tty.ReadStream(fd) : fs.createReadStream(null, { fd, autoClose: false });
  let buf = '', waiter = null;
  rs.on('data', d => { buf += d.toString('latin1'); if (waiter) waiter(); });
  rs.on('error', () => {});
  const wait = (re, ms) => new Promise((resolve, reject) => {
    const t = setTimeout(() => { waiter = null; reject(new Error('Das Modem antwortet nicht.')); }, ms);
    waiter = () => { const m = buf.match(re); if (m) { clearTimeout(t); waiter = null; const out = buf.slice(0, m.index + m[0].length); buf = buf.slice(m.index + m[0].length); resolve(out); } };
    waiter();
  });
  const FINAL = /\r?\n?(OK|ERROR|\+CM[ES] ERROR:[^\r\n]*|NO CARRIER)\r?\n/;
  const write = s => fs.writeSync(fd, Buffer.from(s, 'latin1'));
  return {
    async cmd(c, ms = 3000) {
      buf = ''; write(c + '\r');
      const out = await wait(FINAL, ms);
      const lines = out.split(/\r?\n/).map(x => x.trim()).filter(x => x && x !== c);
      const last = lines[lines.length - 1] || '';
      if (last !== 'OK') { const e = new Error(errText(last)); e.code = last; throw e; }
      return lines.slice(0, -1);
    },
    async prompt(c, ms = 5000) { buf = ''; write(c + '\r'); await wait(/>\s?/, ms); },
    async finish(text, ms = 60000) {
      buf = ''; write(text + '\x1a');
      const out = await wait(FINAL, ms);
      const last = out.split(/\r?\n/).map(x => x.trim()).filter(Boolean).pop() || '';
      if (last !== 'OK') { const e = new Error(errText(last)); e.code = last; throw e; }
      return out;
    },
    close() { try { rs.destroy(); } catch (e) { /* */ } try { fs.closeSync(fd); } catch (e) { /* schon zu */ } },
  };
}
function errText(code) {
  const c = String(code || '');
  if (/SIM PIN|\+CME ERROR: (11|SIM PIN required)/i.test(c)) return 'Die SIM-Karte verlangt eine PIN – bitte die SIM-PIN am Handy ausschalten.';
  if (/\+CME ERROR: (10|SIM not inserted)/i.test(c)) return 'Keine SIM-Karte im Stick.';
  if (/\+CMS ERROR: (38|42|47|331|NO NETWORK|network)/i.test(c)) return 'Kein Mobilfunknetz – Empfang am Standort prüfen.';
  if (/\+CMS ERROR: (21|500|330)/i.test(c)) return 'Die SMS wurde abgelehnt (Guthaben, Tarif oder Nummer prüfen).';
  return c ? `Modem meldet: ${c}` : 'Das Modem antwortet nicht.';
}

/** „0170 123 45 67“ → „+491701234567“; nur Handynummern (Deutschland: 015x/016x/017x), sonst null */
function normPhone(s) {
  let p = String(s || '').replace(/[\s\-/().]/g, '');
  if (!p) return null;
  if (p.startsWith('00')) p = '+' + p.slice(2);
  else if (p.startsWith('0')) p = '+49' + p.slice(1);
  if (!/^\+\d{8,15}$/.test(p)) return null;
  if (p.startsWith('+49') && !/^\+491[5-7]\d{7,10}$/.test(p)) return null;   // Festnetz kann keine SMS
  return p;
}
/** „+491701234567“ → „+49 170 ••• •• 67“ */
const maskPhone = p => (p ? `${p.slice(0, 3)} ${p.slice(3, 6)} ••• •• ${p.slice(-2)}` : '');

/** Text für die SMS: nur Zeichen, die jedes Modem im Textmodus sicher überträgt (Umlaute umschreiben) */
const gsmSafe = s => String(s || '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
  .replace(/[–—]/g, '-').replace(/[„“”]/g, '"').replace(/[^A-Za-z0-9 .,:;!?()+\-/'"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);

/** Zustand des Modems → { ok, device, model, sim, signal (0–100 %), network, operator } */
function status(dev = device()) {
  return serial(async () => {
    if (!dev) return { ok: false, error: 'Kein Anschluss gewählt.' };
    let p;
    try {
      p = await open(dev);
      await p.cmd('AT', 2000); await p.cmd('ATE0', 2000).catch(() => {}); await p.cmd('AT+CMEE=2', 2000).catch(() => {});
      const model = (await p.cmd('AT+CGMM', 3000).catch(() => [])).join(' ').slice(0, 60) || null;
      let sim = 'unbekannt';
      try { const r = (await p.cmd('AT+CPIN?', 3000)).join(' '); sim = (r.match(/\+CPIN:\s*(.+)/) || [])[1] || r; } catch (e) { sim = /SIM not inserted|ERROR: 10/i.test(e.code) ? 'keine SIM' : /PIN/i.test(e.code) ? 'SIM PIN' : 'unbekannt'; }
      const csq = (await p.cmd('AT+CSQ', 3000).catch(() => [])).join(' ');
      const q = +((csq.match(/\+CSQ:\s*(\d+)/) || [])[1] ?? 99);
      const reg = (await p.cmd('AT+CEREG?', 3000).catch(() => [])).join(' ') + ' ' + (await p.cmd('AT+CREG?', 3000).catch(() => [])).join(' ');
      const network = /\+C(E)?REG:\s*\d,\s*[15]\b/.test(reg);
      const op = (await p.cmd('AT+COPS?', 5000).catch(() => [])).join(' ');
      const operator = (op.match(/"([^"]+)"/) || [])[1] || null;
      const simOk = /READY/i.test(sim);
      return { ok: simOk && network, device: dev, model, sim: simOk ? 'bereit' : sim, signal: q >= 0 && q <= 31 ? Math.round(q / 31 * 100) : null, network, operator,
        error: !simOk ? (sim === 'SIM PIN' ? errText('SIM PIN') : sim === 'keine SIM' ? errText('+CME ERROR: 10') : 'SIM-Karte nicht bereit.') : !network ? 'Nicht im Mobilfunknetz angemeldet – Empfang prüfen.' : null };
    } catch (e) { return { ok: false, device: dev, error: e.message }; } finally { if (p) p.close(); }
  });
}

/** Anschlüsse durchprobieren → [{ device, answers }] */
function detect() {
  return serial(async () => {
    const out = [];
    for (const d of candidates().slice(0, 12)) {
      let p, answers = false;
      try { p = await open(d); await p.cmd('AT', 1200); answers = true; } catch (e) { /* kein AT-Anschluss */ } finally { if (p) p.close(); }
      out.push({ device: d, answers });
    }
    return out;
  });
}

/** SMS verschicken → { ok } oder wirft mit verständlicher Meldung */
function send(number, text) {
  const to = normPhone(number);
  if (!to) return Promise.reject(new Error('Keine gültige Handynummer.'));
  const body = gsmSafe(text);
  if (require('./db').getSetting('demo_mode', '') === '1') return Promise.reject(new Error('In der Demo werden keine SMS verschickt.'));
  return serial(async () => {
    const dev = device(); if (!dev) throw new Error('Kein SMS-Modem eingerichtet.');
    let p;
    try {
      p = await open(dev);
      await p.cmd('AT', 2000); await p.cmd('ATE0', 2000).catch(() => {}); await p.cmd('AT+CMEE=2', 2000).catch(() => {});
      await p.cmd('AT+CMGF=1', 3000);
      await p.cmd('AT+CSCS="GSM"', 3000).catch(() => {});
      await p.prompt(`AT+CMGS="${to}"`, 8000);
      await p.finish(body, 60000);
      return { ok: true };
    } finally { if (p) p.close(); }
  });
}

const ready = () => on() && Boolean(device());

module.exports = { send, status, detect, ready, on, device, validDevice, normPhone, maskPhone, gsmSafe, candidates };
