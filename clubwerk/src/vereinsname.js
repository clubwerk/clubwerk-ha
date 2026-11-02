'use strict';
/* Vereinsname als Pflicht: ohne eingetragenen Namen stünde überall der Platzhalter „Unser Verein“. Dann gehen keine E-Mails und Push-Hinweise an Mitglieder raus;
   die Verwaltung zeigt einen roten Hinweis mit Link zur Einstellung (Einstellungen › Allgemein › Vereinsname). */
const { getSetting } = require('./db');
const MSG = 'Der Vereinsname fehlt – bitte unter Einstellungen › Verein eintragen. Bis dahin werden keine E-Mails und Hinweise an Mitglieder verschickt.';
const isSet = () => String(getSetting('club_name', '') || process.env.CLUB_NAME || '').trim().length >= 3;
module.exports = { isSet, MSG };
