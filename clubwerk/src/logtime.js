'use strict';
/* Zeitstempel vor jeder Zeile im Protokoll des Add-ons (Home Assistant → Add-ons → Clubwerk → Protokoll), in Ortszeit:
   [2026-10-20 14:47:03] Clubwerk auf Port 3100 …  – mehrzeilige Meldungen bekommen den Stempel nur in der ersten Zeile. */
const p = n => String(n).padStart(2, '0');
const stamp = () => { const d = new Date(); return `[${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}]`; };
if (!console.__cwStamp) {
  for (const k of ['log', 'info', 'warn', 'error']) {
    const orig = console[k].bind(console);
    console[k] = (...a) => orig(stamp(), ...a);
  }
  console.__cwStamp = true;
}
module.exports = { stamp };
