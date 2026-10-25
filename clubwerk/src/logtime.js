'use strict';
/* Zeitstempel vor jeder Zeile im Protokoll des Add-ons (Home Assistant → Add-ons → Clubwerk → Protokoll), in Ortszeit:
   [2026-10-20 14:47:03] Clubwerk auf Port 3100 …  – mehrzeilige Meldungen bekommen den Stempel nur in der ersten Zeile. */
const { nowTs } = require('./util');
const stamp = () => `[${nowTs()}]`;
if (!console.__cwStamp) {
  for (const k of ['log', 'info', 'warn', 'error']) {
    const orig = console[k].bind(console);
    console[k] = (...a) => orig(stamp(), ...a);
  }
  console.__cwStamp = true;
}
module.exports = { stamp };
