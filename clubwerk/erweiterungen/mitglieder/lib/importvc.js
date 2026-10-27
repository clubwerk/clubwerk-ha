'use strict';
/**
 * Mitglieder-Import: verein.cloud, S-Verein / SPG-Verein, WISO Mein Verein und jede andere CSV- oder Excel-Datei.
 *  - Die Datei wird gelesen (CSV mit ; , oder Tab, UTF-8 oder Windows-1252; Excel .xlsx), das Format an den Spaltenköpfen erkannt.
 *  - verein.cloud: eigener Leser mit allen Feinheiten (nummerierte Spalten Abteilung_1, Beitragsbezeichnung_1_1 …).
 *  - Alle anderen: Spaltenzuordnung (Vorschlag aus Vorlage bzw. ähnlichen Spaltennamen, im Dialog änderbar, je Format gemerkt).
 *  - Abteilungen und Beitragsarten werden angelegt, „Gebucht bis“ übernommen (es wird nichts doppelt abgerechnet).
 *  - Abgleich mit dem Bestand über Mitgliedsnummer oder Name – vorhandene Personen (z. B. aus den Getränken) werden ergänzt,
 *    PINs und App-Freischaltungen bleiben erhalten.
 *  - Abweichende Zahler / Gemeinschaften (Familien) werden verknüpft.
 */
function register(sh) {
  const { C, store, sepa, fees, one, txt, uname, ar } = sh;
  const { S, SET, today, nowTs } = store;
  const { need, bad, int } = C;
  const admin = C.admin, db = C.db;
  const express = C.require('express');
  const P = need('mitglieder');

  function decode(buf) {
    let s = buf.toString('utf8');
    if (s.includes('\uFFFD')) { try { s = new TextDecoder('windows-1252').decode(buf); } catch (e) { s = buf.toString('latin1'); } }
    return s.replace(/^\uFEFF/, '');
  }
  function parseCsv(s) {
    const first = s.split(/\r?\n/, 1)[0];
    const delim = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
      else cur += ch;
    }
    row.push(cur); if (row.some(x => x.trim() !== '')) rows.push(row);
    return rows;
  }
  const deToIso = v => { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(String(v || '').trim()); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : (fees.isDate(String(v || '').trim()) ? String(v).trim() : null); };
  const money = v => { const s = String(v || '').replace(/[€\s]/g, ''); if (!s) return null; const n = Number(s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : null; };
  const INTERVAL = { jahr: 'jahr', jährlich: 'jahr', halbjahr: 'halbjahr', halbjährlich: 'halbjahr', quartal: 'quartal', vierteljährlich: 'quartal', monat: 'monat', monatlich: 'monat', einmalig: 'einmalig', einmal: 'einmalig' };
  const GENDER = { männlich: 'm', maennlich: 'm', m: 'm', weiblich: 'w', w: 'w', f: 'w' };
  const STATUS = { aktiv: 'aktiv', passiv: 'passiv', ehrenmitglied: 'ehren', ehren: 'ehren', ruhend: 'ruhend', fördermitglied: 'passiv', unterstützend: 'passiv' };
  const PAY = { lastschrift: 'lastschrift', rechnung: 'rechnung', überweisung: 'rechnung', bar: 'bar', barzahler: 'bar' };

  /** Excel-Zelle → Text (Datum als TT.MM.JJJJ) */
  const cellText = v => {
    if (v == null) return '';
    if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2, '0')}.${String(v.getUTCMonth() + 1).padStart(2, '0')}.${v.getUTCFullYear()}`;
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(t => t.text).join('');
      if (v.text != null) return String(v.text);
      if (v.result != null) return cellText(v.result);
      if (v.hyperlink) return String(v.hyperlink).replace(/^mailto:/, '');
      return '';
    }
    return String(v);
  };
  /** Datei (CSV oder .xlsx) → Zeilen (erste Zeile = Spaltenköpfe) */
  async function readTable(buf) {
    if (!buf || !buf.length) throw new Error('Die Datei ist leer.');
    let rows;
    if (buf[0] === 0x50 && buf[1] === 0x4b) {   // ZIP → Excel .xlsx
      const ExcelJS = C.require('exceljs');
      const wb = new ExcelJS.Workbook();
      try { await wb.xlsx.load(buf); } catch (e) { throw new Error('Die Excel-Datei lässt sich nicht lesen (bitte als .xlsx oder CSV speichern).'); }
      const ws = wb.worksheets.find(w => w.actualRowCount > 1) || wb.worksheets[0];
      if (!ws) throw new Error('Die Excel-Datei enthält keine Tabelle.');
      rows = [];
      const width = ws.columnCount;
      ws.eachRow({ includeEmpty: false }, row => { const r = []; for (let c = 1; c <= width; c++) r.push(cellText(row.getCell(c).value).trim()); if (r.some(x => x)) rows.push(r); });
    } else if (buf[0] === 0xd0 && buf[1] === 0xcf) {
      throw new Error('Alte Excel-Dateien (.xls) bitte in Excel als .xlsx oder CSV speichern und erneut wählen.');
    } else rows = parseCsv(decode(buf));
    if (rows.length < 2) throw new Error('Die Datei enthält keine Mitglieder.');
    rows[0] = rows[0].map(h => String(h || '').replace(/^\uFEFF/, '').trim());
    if (rows.length > 5001) throw new Error('Höchstens 5000 Mitglieder auf einmal.');
    return rows;
  }

  /* -------------------------------------------------------------------------------------------------
     Zielfelder und Vorlagen. Die Spaltennamen der Programme sind nicht offiziell beschrieben – die Vorlagen enthalten
     die üblichen Bezeichnungen (S-Verein/SPG-Verein-Exporte, WISO Mein Verein, jVerein-Format), ähnliche Namen werden
     ebenfalls erkannt. Was nicht passt, ordnet man im Dialog selbst zu.
     ------------------------------------------------------------------------------------------------- */
  const FIELDS = [
    ['member_no', 'Mitgliedsnummer', 'Person', ['mitgliedsnummer', 'mitgliedsnr', 'mitgliedernummer', 'mitgliedsnrs', 'mitgliedsnr.', 'mitglieds_nr', 'mitgliedsnr', 'mitglnr', 'mitgliednr', 'mnr', 'nr', 'nummer', 'kontaktnr', 'kontaktnummer', 'mitgliedsid', 'id']],
    ['salutation', 'Anrede', 'Person', ['anrede']],
    ['title', 'Titel', 'Person', ['titel', 'akadtitel', 'akademischertitel']],
    ['first_name', 'Vorname', 'Person', ['vorname', 'rufname', 'firstname']],
    ['last_name', 'Nachname', 'Person', ['nachname', 'name', 'familienname', 'zuname', 'lastname']],
    ['birth_date', 'Geburtsdatum', 'Person', ['geburtsdatum', 'geburtstag', 'gebdatum', 'geboren', 'geboren am', 'gebam']],
    ['gender', 'Geschlecht', 'Person', ['geschlecht', 'gender']],
    ['street', 'Straße', 'Anschrift', ['strasse', 'straße', 'strassehausnummer', 'straßeundhausnummer', 'strasseundhausnummer', 'strassenr', 'anschrift', 'adresse']],
    ['zip', 'PLZ', 'Anschrift', ['plz', 'postleitzahl']],
    ['city', 'Ort', 'Anschrift', ['ort', 'wohnort', 'stadt']],
    ['country', 'Land', 'Anschrift', ['land', 'staat']],
    ['address_extra', 'Adresszusatz', 'Anschrift', ['adresszusatz', 'zusatzadresse', 'zusatz', 'co']],
    ['phone', 'Telefon', 'Kontakt', ['telefon', 'telefonprivat', 'tel', 'telprivat', 'telefon1', 'festnetz']],
    ['mobile', 'Mobil', 'Kontakt', ['mobil', 'handy', 'mobiltelefon', 'mobilnummer', 'telefonmobil']],
    ['email', 'E-Mail', 'Kontakt', ['email', 'e-mail', 'emailadresse', 'mail', 'emailprivat']],
    ['letter_salutation', 'Briefanrede', 'Kontakt', ['briefanrede']],
    ['entry_date', 'Eintritt', 'Mitgliedschaft', ['eintritt', 'eintrittsdatum', 'mitgliedseit', 'eintrittam', 'beitritt', 'beitrittsdatum', 'vereinseintritt']],
    ['exit_date', 'Austritt', 'Mitgliedschaft', ['austritt', 'austrittsdatum', 'mitgliedbis', 'austrittam', 'vereinsaustritt']],
    ['exit_reason', 'Austrittsgrund', 'Mitgliedschaft', ['austrittsgrund', 'vereinsaustrittsgrund']],
    ['status', 'Status (aktiv/passiv …)', 'Mitgliedschaft', ['status', 'mitgliedsstatus', 'mitgliedsart', 'mitgliedschaft', 'art']],
    ['departments', 'Abteilung(en)', 'Mitgliedschaft', ['abteilung', 'abteilungen', 'sparte', 'sparten', 'gruppe', 'gruppen']],
    ['group', 'Familie / Gemeinschaft', 'Mitgliedschaft', ['familie', 'gemeinschaft', 'familienname gemeinschaft', 'haushalt', 'familiennr', 'familiennummer']],
    ['payer_no', 'Zahler (Mitgliedsnummer)', 'Mitgliedschaft', ['zahler', 'zahlernr', 'zahlermitglied', 'abweichenderzahler', 'abweichenderzahlermitglied', 'zahleristmitglied', 'hauptmitglied', 'uebergeordnetesmitglied', 'übergeordnetesmitglied']],
    ['family_no', 'Familie bei (Mitgliedsnummer des Oberhaupts)', 'Mitgliedschaft', ['familiebei', 'familienmitgliedschaft', 'familienmitgliedschaftbei', 'familienoberhaupt', 'oberhaupt', 'familienzahler']],
    ['key_no', 'Schlüsselnummer', 'Mitgliedschaft', ['schluesselnummer', 'schlüsselnummer', 'schluessel', 'schlüssel', 'transponder']],
    ['notes', 'Notizen', 'Mitgliedschaft', ['notiz', 'notizen', 'bemerkung', 'bemerkungen', 'info', 'anmerkung']],
    ['fee_name', 'Beitrag (Bezeichnung)', 'Beitrag', ['beitragsart', 'beitragsart1', 'beitragsgruppe', 'beitragstarif', 'tarif', 'beitragsbezeichnung', 'beitragsklasse', 'persoenlicherbeitragstarif', 'persönlicherbeitragstarif', 'beitrag']],
    ['fee_cents', 'Beitrag (Betrag)', 'Beitrag', ['betrag', 'beitragsbetrag', 'beitraghoehe', 'beitraghöhe', 'beitrag1', 'jahresbeitrag', 'beitrageuro']],
    ['fee_interval', 'Zahlungsintervall', 'Beitrag', ['intervall', 'zahlungsintervall', 'zahlweise', 'zahlungsweise', 'zahlungsrhythmus', 'rhythmus', 'turnus', 'beitragsintervall']],
    ['fee_booked', 'Gebucht bis', 'Beitrag', ['gebuchtbis', 'bezahltbis', 'abgerechnetbis', 'beitragbezahltbis', 'naechsteabrechnung', 'nächsteabrechnung', 'beitraggebuchtbis']],
    ['payment', 'Zahlungsart', 'Bank', ['zahlungsart', 'zahlart', 'zahlungsmethode', 'zahlungsform', 'lastschrift', 'einzug']],
    ['holder', 'Kontoinhaber', 'Bank', ['kontoinhaber', 'inhaber', 'kontoinhabername', 'kontoinh']],
    ['iban', 'IBAN', 'Bank', ['iban']],
    ['bic', 'BIC', 'Bank', ['bic', 'swift', 'swiftbic']],
    ['bank', 'Bank', 'Bank', ['bank', 'kreditinstitut', 'bankname', 'geldinstitut']],
    ['mandate_ref', 'Mandatsreferenz', 'Bank', ['mandatsreferenz', 'mandatsref', 'mandatreferenz', 'mandat', 'mandatsnummer', 'sepamandatsreferenz']],
    ['mandate_date', 'Mandat unterschrieben am', 'Bank', ['mandatsdatum', 'mandat_datum', 'mandatdatum', 'unterschriftsdatum', 'mandatvom', 'mandatsunterschrift', 'datummandat', 'mandaterteiltam']],
  ];
  const FIELD_KEYS = FIELDS.map(f => f[0]);
  const norm = h => String(h || '').toLowerCase().replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[^a-z0-9]/g, '');
  const SYN = Object.fromEntries(FIELDS.map(([k, , , syn]) => [k, new Set(syn.map(norm))]));
  /** Vorlagen: woran man das Programm erkennt + feste Zuordnungen, die vor den Ähnlichkeiten gelten */
  const PRESETS = {
    vereincloud: { label: 'verein.cloud', test: h => h.has('abteilung1') || h.has('beitragsbezeichnung11') || h.has('abweichenderzahlermitglied') || h.has('gebuchtbis11') },
    sverein: { label: 'S-Verein / SPG-Verein', test: h => ['mitgliedsnr', 'mandatdatum', 'beitragsart1', 'beitrag1', 'telefonprivat', 'telefondienstlich', 'beitragsgruppe', 'zahlungsweise', 'kuendigung', 'sterbetag'].filter(x => h.has(x)).length >= 2,
      fixed: { member_no: ['mitgliedsnr', 'mitgliedsnummer'], last_name: ['name', 'nachname'], fee_name: ['beitragsart1', 'beitragsgruppe', 'beitragsart'], fee_cents: ['beitrag1', 'beitrag', 'betrag'], fee_interval: ['zahlungsweise', 'zahlungsrhythmus'], mandate_date: ['mandatdatum', 'mandatsdatum'], phone: ['telefonprivat', 'telefon'], entry_date: ['eintritt'], exit_date: ['austritt'] } },
    wiso: { label: 'WISO Mein Verein', test: h => ['mitgliedseit', 'mitgliedbis', 'beitragstarif', 'persoenlicherbeitragstarif', 'zahlweise', 'zahlungsintervall', 'kontaktnr', 'kontaktart', 'standardbankverbindung', 'naechsteabrechnung', 'abteilungen'].filter(x => h.has(x)).length >= 2,
      fixed: { member_no: ['mitgliedsnr', 'mitgliedsnummer', 'kontaktnr'], entry_date: ['mitgliedseit', 'eintritt', 'eintrittsdatum'], exit_date: ['mitgliedbis', 'austritt', 'austrittsdatum'], fee_name: ['persoenlicherbeitragstarif', 'beitragstarif', 'tarif'], fee_interval: ['zahlweise', 'zahlungsintervall'], departments: ['abteilungen', 'abteilung'] } },
    eigene: { label: 'Eigene Datei', test: () => true },
  };
  function detect(head) {
    const h = new Set(head.map(norm));
    for (const [k, p] of Object.entries(PRESETS)) if (p.test(h)) return k;
    return 'eigene';
  }
  /** Zuordnung vorschlagen: gemerkte Zuordnung → feste Vorlage → gleiche/ähnliche Namen (jede Spalte nur einmal) */
  function suggest(head, format) {
    const n = head.map(norm), used = new Set(), map = {};
    let saved = {}; try { saved = JSON.parse(S('import_map_' + format, '{}')) || {}; } catch (e) { saved = {}; }
    const take = (k, i) => { if (i >= 0 && !used.has(i) && map[k] == null) { map[k] = head[i]; used.add(i); } };
    for (const k of FIELD_KEYS) if (saved[k] && head.includes(saved[k])) take(k, head.indexOf(saved[k]));
    const fixed = (PRESETS[format] || {}).fixed || {};
    for (const [k, list] of Object.entries(fixed)) for (const x of list) take(k, n.indexOf(x));
    for (const k of FIELD_KEYS) for (let i = 0; i < n.length; i++) if (SYN[k].has(n[i])) take(k, i);
    // ähnliche Namen (z. B. „E-Mail privat“, „Straße + Nr.“)
    //  … aber nicht „Abteilungseintritt“ als Abteilung oder „Beitragsbeginn“ als Beitrag
    const otherThing = rest => /^s?(datum|beginn|ende|start|eintritt|austritt|status|grund|nr|nummer|id|bis|seit|art|gruppe)/.test(rest);
    for (const k of FIELD_KEYS) if (map[k] == null) for (let i = 0; i < n.length; i++) if (!used.has(i) && n[i].length >= 4 && [...SYN[k]].some(x => x.length >= 4 && ((n[i].startsWith(x) && !otherThing(n[i].slice(x.length))) || x.startsWith(n[i])))) { take(k, i); break; }
    if (saved.__name_split) map.__name_split = true;
    return map;
  }

  const INTERVAL2 = v => {
    const s = norm(v); if (!s) return null;
    if (/^(jahr|jaehrlich|jahresbeitrag|12|1x|annual)/.test(s)) return 'jahr';
    if (/^(halbj|6|2x)/.test(s)) return 'halbjahr';
    if (/^(viertelj|quartal|3|4x)/.test(s)) return 'quartal';
    if (/^(monat|1$|12x)/.test(s)) return 'monat';
    if (/^(einmal|0)/.test(s)) return 'einmalig';
    return null;
  };
  const PAY2 = v => { const s = norm(v); if (!s) return null; if (/lastschrift|einzug|bankeinzug|sepa|abbuchung|^ja$|^1$/.test(s)) return 'lastschrift'; if (/bar/.test(s)) return 'bar'; if (/ueberweis|rechnung|selbstzahler|^nein$|^0$/.test(s)) return 'rechnung'; return null; };
  const GENDER2 = v => { const s = norm(v); if (!s) return null; if (/^(m|maennlich|herr|male)$/.test(s)) return 'm'; if (/^(w|f|weiblich|frau|female)$/.test(s)) return 'w'; return null; };
  const STATUS2 = v => { const s = norm(v); if (!s) return 'aktiv'; if (/ehren/.test(s)) return 'ehren'; if (/ruh/.test(s)) return 'ruhend'; if (/passiv|foerder|unterstuetz|inaktiv/.test(s)) return 'passiv'; return 'aktiv'; };

  /** Zeilen + Zuordnung → Datensätze (gleiche Form wie beim verein.cloud-Leser) */
  function readMapped(rows, map, o = {}) {
    const head = rows[0];
    const col = k => (map[k] ? head.indexOf(map[k]) : -1);
    const idx = Object.fromEntries(FIELD_KEYS.map(k => [k, col(k)]));
    if (idx.last_name < 0) throw new Error('Bitte die Spalte für den Nachnamen zuordnen.');
    const recs = [];
    rows.slice(1).forEach((r, li) => {
      const g = k => (idx[k] >= 0 ? String(r[idx[k]] == null ? '' : r[idx[k]]).trim() : '');
      let first = g('first_name'), last = g('last_name');
      if (!first && last.includes(',') && (idx.first_name < 0 || map.__name_split)) { const [l, ...f] = last.split(','); last = l.trim(); first = f.join(',').trim(); }
      else if (!first && idx.first_name < 0 && /\s/.test(last)) { const sp = store.splitName({ name: last }); first = sp.first; last = sp.last; }
      if (!last) return;
      const ib = sepa.checkIban(g('iban'));
      const bc = sepa.checkBic(g('bic'));
      const mref = g('mandate_ref');
      const sal = g('salutation');
      const depts = g('departments').split(/[,;/|\n]/).map(x => x.replace(/\(.*\)/, '').trim()).filter(x => x && !/^hauptverein$/i.test(x)).slice(0, 10).map(name => ({ name: one(name, 60), entry: null, exit: null, status: 'aktiv' }));
      const feeName = one(g('fee_name'), 80), cents = money(g('fee_cents'));
      const entry = deToIso(g('entry_date'));
      const feeList = feeName ? [{ dept: null, name: feeName, start: entry, end: null, booked: deToIso(g('fee_booked')) || o.bookedDefault || null, cents, interval: INTERVAL2(g('fee_interval')) || 'jahr' }] : [];
      recs.push({
        line: li + 2, member_no: one(g('member_no'), 20) || null,
        p: { first_name: one(first, 60) || null, last_name: one(last, 60) || null, salutation: one(sal, 20) || null, title: one(g('title'), 30) || null,
          letter_salutation: one(g('letter_salutation'), 80) || null, email: one(g('email'), 120).toLowerCase() || null, birth_date: deToIso(g('birth_date')), gender: GENDER2(g('gender')) || GENDER2(sal),
          entry_date: entry, exit_date: deToIso(g('exit_date')), exit_reason: one(g('exit_reason'), 80) || null,
          street: one(g('street'), 80) || null, zip: one(g('zip'), 10) || null, city: one(g('city'), 60) || null, country: one(g('country'), 40) || null, address_extra: one(g('address_extra'), 80) || null,
          phone: one(g('phone'), 40) || null, mobile: one(g('mobile'), 40) || null, notes: txt(g('notes'), 2000) || null, status: STATUS2(g('status')),
          key_no: one(g('key_no'), 30) || null, payment: PAY2(g('payment')) || (ib.ok ? 'lastschrift' : 'rechnung') },
        bank: ib.ok ? { holder: one(g('holder'), 70) || null, iban: ib.iban, bic: bc.ok ? bc.bic || null : null, bank: one(g('bank'), 70) || null,
          mandate_ref: mref && sepa.checkMandateRef(mref).ok ? mref : null, mandate_date: deToIso(g('mandate_date')), valid_until: null } : null,
        mandateUsed: Boolean(o.mandateUsed),
        ibanBad: g('iban') && !ib.ok ? ib.error : null,
        payer: { member: one(g('payer_no'), 80) || null, iban: null, holder: null, bic: null, bank: null }, family: one(g('family_no'), 80) || null,
        group: one(g('group'), 80) || null, honors: '', functions: '', depts, fees: feeList,
      });
    });
    return recs;
  }

  /** Telefonnummer ohne Vorwahl-Null (z. B. „[entfernt]“, weil das alte Programm sie als Zahl gespeichert hat) → „0[entfernt]“ */
  const phoneFix = t => { const x = String(t || '').trim(); return /^[1-9][\d \/-]{7,14}$/.test(x) && x.replace(/\D/g, '').length >= 9 ? '0' + x : x; };
  // verein.cloud: Spalte je Feld (im Dialog änderbar); Abteilungen und Beiträge liest Clubwerk immer aus den nummerierten Spalten
  const VC_COLS = { member_no: 'Mitglieds-Nr', salutation: 'Anrede', title: 'Titel', first_name: 'Vorname', last_name: 'Nachname', birth_date: 'Geburtsdatum', gender: 'Geschlecht',
    street: 'Straße', zip: 'PLZ', city: 'Ort', country: 'Land', address_extra: 'Zusatzadresse', phone: 'Telefon', mobile: 'Mobil', email: 'E-Mail', letter_salutation: 'Briefanrede',
    entry_date: 'Eintrittsdatum', exit_date: 'Austrittsdatum', exit_reason: 'Vereinsaustrittsgrund', status: 'Status', group: 'Gemeinschaft', payer_no: 'Abweichender Zahler Mitglied',
    family_no: 'Familie bei', key_no: 'Schlüsselnummer', notes: 'Notizen', payment: 'Zahlungsart', holder: 'Kontoinhaber', iban: 'IBAN', bic: 'BIC', bank: 'Kreditinstitut',
    mandate_ref: 'Mandatsreferenz', mandate_date: 'Unterschriftsdatum' };
  /** verein.cloud: CSV-Zeilen → Datensätze */
  function readRecords(rows, over = {}) {
    const head = rows[0].map(h => h.trim());
    const idx = name => head.findIndex(h => h.toLowerCase() === name.toLowerCase());
    if (idx('Nachname') < 0) throw new Error('Keine Spalte „Nachname“ gefunden – ist das ein Mitglieder-Export (CSV)?');
    const recs = [];
    for (const r of rows.slice(1)) {
      const g = name => { const i = idx(name); return i >= 0 ? String(r[i] || '').trim() : ''; };
      const v = (key, col) => (Object.prototype.hasOwnProperty.call(over, key) ? (over[key] ? g(over[key]) : '') : g(col));   // im Dialog anders zugeordnet?
      const depts = [], feeList = [];
      for (let n = 1; n <= 20; n++) {
        const dn = g(`Abteilung_${n}`); if (!dn) continue;   // verein.cloud lässt Lücken in den nummerierten Spalten
        if (!/^hauptverein$/i.test(dn)) depts.push({ name: dn, entry: deToIso(g(`Abteilungseintritt_${n}`)), exit: deToIso(g(`Abteilungsaustritt_${n}`)), status: /passiv/i.test(g(`Abteilungsstatus_${n}`)) ? 'passiv' : 'aktiv',
          fed: g(`Abteilungsstatus DFB_${n}`) && !/kein status/i.test(g(`Abteilungsstatus DFB_${n}`)) ? g(`Abteilungsstatus DFB_${n}`) : null, reason: g(`Abteilungsaustrittsgrund_${n}`) || null });
        for (let k = 1; k <= 10; k++) {
          const fn = g(`Beitragsbezeichnung_${n}_${k}`); if (!fn) continue;   // auch erst in _n_10 möglich
          feeList.push({ dept: dn, name: fn, start: deToIso(g(`Beitragsstart_${n}_${k}`)), end: deToIso(g(`Beitragsende_${n}_${k}`)), booked: deToIso(g(`Gebucht bis_${n}_${k}`)),
            cents: money(g(`Betrag_${n}_${k}`)), interval: INTERVAL[g(`Intervall_${n}_${k}`).toLowerCase()] || 'jahr' });
        }
      }
      // einfache Exporte ohne nummerierte Spalten
      if (!depts.length && g('Abteilungen')) for (const dn of g('Abteilungen').split(/[,;]/).map(x => x.replace(/\(.*\)/, '').trim()).filter(x => x && !/^hauptverein$/i.test(x))) depts.push({ name: dn, entry: null, exit: null, status: 'aktiv' });
      const ib = sepa.checkIban(v('iban', 'IBAN'));
      const pib = sepa.checkIban(g('Abweichender Zahler IBAN'));
      recs.push({
        line: recs.length + 2, member_no: v('member_no', 'Mitglieds-Nr') || (over.member_no === undefined ? g('Mitgliedsnummer') || g('Mitglieds-Nr.') : '') || null,
        p: { first_name: one(v('first_name', 'Vorname'), 60) || null, last_name: one(v('last_name', 'Nachname'), 60) || null, salutation: one(v('salutation', 'Anrede'), 20) || null, title: one(v('title', 'Titel'), 30) || null,
          letter_salutation: one(v('letter_salutation', 'Briefanrede'), 80) || null, email: one(v('email', 'E-Mail'), 120).toLowerCase() || null, birth_date: deToIso(v('birth_date', 'Geburtsdatum')), gender: GENDER[v('gender', 'Geschlecht').toLowerCase()] || null,
          entry_date: deToIso(v('entry_date', 'Eintrittsdatum')), exit_date: deToIso(v('exit_date', 'Austrittsdatum')), exit_reason: one(v('exit_reason', 'Vereinsaustrittsgrund'), 80) || null,
          street: one(v('street', 'Straße') || (over.street === undefined ? g('Strasse') : ''), 80) || null, zip: one(v('zip', 'PLZ'), 10) || null, city: one(v('city', 'Ort'), 60) || null, country: one(v('country', 'Land'), 40) || null, address_extra: one(v('address_extra', 'Zusatzadresse'), 80) || null,
          phone: one(phoneFix(v('phone', 'Telefon')), 40) || null, mobile: one(phoneFix(v('mobile', 'Mobil')), 40) || null, notes: txt(v('notes', 'Notizen'), 2000) || null, status: STATUS[v('status', 'Status').toLowerCase()] || 'aktiv',
          key_no: one(v('key_no', 'Schlüsselnummer'), 30) || null, payment: PAY[v('payment', 'Zahlungsart').toLowerCase().replace(/\s*\(.*\)\s*$/, '')] || (ib.ok ? 'lastschrift' : 'rechnung') },
        bank: ib.ok ? { holder: one(v('holder', 'Kontoinhaber'), 70) || null, iban: ib.iban, bic: sepa.checkBic(v('bic', 'BIC')).ok ? sepa.checkBic(v('bic', 'BIC')).bic || null : null, bank: one(v('bank', 'Kreditinstitut'), 70) || null,
          mandate_ref: sepa.checkMandateRef(v('mandate_ref', 'Mandatsreferenz')).ok ? v('mandate_ref', 'Mandatsreferenz') : null, mandate_date: deToIso(v('mandate_date', 'Unterschriftsdatum')), valid_until: deToIso(g('Gültigkeitsdatum')) } : null,
        ibanBad: v('iban', 'IBAN') && !ib.ok ? ib.error : null,
        mandateUsed: false,
        payer: { member: v('payer_no', 'Abweichender Zahler Mitglied') || null, iban: pib.ok ? pib.iban : null, holder: one(g('Abweichender Zahler Kontoinhaber'), 70) || null, bic: sepa.checkBic(g('Abweichender Zahler BIC')).bic || null, bank: one(g('Abweichender Zahler Kreditinstitut'), 70) || null },
        family: one(v('family_no', 'Familie bei'), 80) || null,
        group: one(v('group', 'Gemeinschaft'), 80) || null, honors: g('Ehrungen'), functions: g('Funktionen'), depts, fees: feeList,
      });
    }
    return recs.filter(r => r.p.last_name);
  }

  function matchMember(rec) {
    if (rec.member_no) { const m = db.prepare('SELECT member_id AS id FROM mv_person WHERE member_no = ?').get(rec.member_no); if (m) return { id: m.id, by: 'Mitgliedsnummer' }; }
    const full = `${rec.p.first_name || ''} ${rec.p.last_name}`.trim();
    const m = db.prepare(`SELECT id FROM members WHERE kind = 'mitglied' AND deleted = 0 AND (lower(name) = lower(?) OR lower(name) = lower(?)
      OR (lower(COALESCE(first_name,'')) = lower(?) AND lower(COALESCE(last_name,'')) = lower(?)))`).all(full, `${rec.p.last_name}, ${rec.p.first_name || ''}`, rec.p.first_name || '', rec.p.last_name);
    if (m.length === 1) {
      const taken = db.prepare('SELECT member_no FROM mv_person WHERE member_id = ?').get(m[0].id);
      if (taken && taken.member_no && rec.member_no && taken.member_no !== rec.member_no) return { id: null, conflict: `gleicher Name wie Nr. ${taken.member_no}` };
      return { id: m[0].id, by: 'Name' };
    }
    if (m.length > 1) return { id: null, conflict: 'Name mehrfach vorhanden' };
    return { id: null };
  }
  /* Ähnliche Namen im Bestand (Spitznamen, Schreibvarianten) – nur Vorschläge, zusammengeführt wird erst nach Entscheidung im Dialog */
  const NM = require('./names');
  const { splitPersonName } = C.require('./db');
  let pool = null;
  const loadPool = () => {
    pool = db.prepare(`SELECT m.id, m.name, m.first_name, m.last_name, p.member_no, p.birth_date FROM members m LEFT JOIN mv_person p ON p.member_id = m.id
      WHERE m.kind = 'mitglied' AND m.deleted = 0 AND COALESCE(p.anonymized_at, '') = ''`).all().map(e => {
      const sp = e.first_name || e.last_name ? { first: e.first_name || '', last: e.last_name || '' } : splitPersonName(e.name);
      return { ...e, first: sp.first || '', last: sp.last || '' };
    });
  };
  function candidates(rec, exclude = new Set()) {
    if (!pool) loadPool();
    const out = [];
    for (const e of pool) {
      if (exclude.has(e.id) || !NM.lastSimilar(rec.p.last_name, e.last)) continue;
      const why = NM.firstSimilar(rec.p.first_name, e.first); if (!why) continue;
      if (rec.p.birth_date && e.birth_date && rec.p.birth_date !== e.birth_date) continue;   // anderes Geburtsdatum = andere Person (z. B. Vater und Sohn)
      out.push({ id: e.id, name: e.name, member_no: e.member_no || '', birth_date: e.birth_date || '', why: why + (NM.norm(rec.p.last_name) !== NM.norm(e.last) ? ', Nachname ähnlich' : ''),
        sameBirth: Boolean(rec.p.birth_date && e.birth_date === rec.p.birth_date) });
    }
    return out.sort((a, b) => Number(b.sameBirth) - Number(a.sameBirth) || (a.why === 'gleicher Name' ? -1 : 0)).slice(0, 4);
  }
  /** Entscheidungen aus dem Dialog prüfen: { Zeile: Mitglieds-ID | 'neu' } → Map Zeile → ID */
  function decisions(recs, raw) {
    const out = new Map(); if (!raw || typeof raw !== 'object') return out;
    loadPool();   // Bestand frisch lesen
    const exact = new Set(recs.map(r => matchMember(r).id).filter(Boolean)), used = new Map();
    for (const r of recs) {
      const v = raw[r.line]; if (v == null || v === 'neu') continue;
      const id = Number(v);
      if (matchMember(r).id) continue;
      if (!candidates(r).some(c => c.id === id)) throw new Error(`Zeile ${r.line}: Diese Zuordnung passt nicht – bitte die Vorschau neu laden.`);
      if (exact.has(id)) throw new Error(`Zeile ${r.line}: Dieses Mitglied wird schon über eine andere Zeile (gleicher Name oder Nummer) ergänzt.`);
      if (used.has(id)) throw new Error(`Zeile ${r.line} und Zeile ${used.get(id)} sind demselben Mitglied zugeordnet – bitte eine davon „neu anlegen“.`);
      used.set(id, r.line); out.set(r.line, id);
    }
    return out;
  }
  function guessAges(name) {
    const s = String(name).toLowerCase();
    const min = /ab\s*(\d{1,2})/.exec(s), max = /bis\s*(\d{1,2})/.exec(s);
    return { age_min: min ? Number(min[1]) : null, age_max: max ? Number(max[1]) : null, family: /familie|alleinerz/.test(s) ? 1 : 0, work_minutes: /ohne\s+arbeit/.test(s) ? 0 : null };
  }

  // lesbare Namen für den Feldabgleich (keine internen Schlüssel anzeigen)
  const SAMPLE_LABEL = { aktiv: 'Aktiv', passiv: 'Passiv', ehren: 'Ehrenmitglied', ruhend: 'Ruhend', lastschrift: 'Lastschrift', rechnung: 'Rechnung', bar: 'Bar', ueberweisung: 'Überweisung' };
  /* ---------- Beitragsarten der Datei mit dem Bestand abgleichen ---------- */
  // Beiträge einer Abteilung (nicht „Hauptverein“) sind Zusatzbeiträge: sie hängen an der Abteilungszugehörigkeit, nicht am Mitglied
  //  (nur wenn die Datei überhaupt Beiträge im „Hauptverein“ führt – sonst sind die Abteilungsbeiträge die eigentlichen Mitgliedsbeiträge)
  const deptFeeTest = recs => {
    const hasHV = recs.some(r => r.fees.some(f => /^hauptverein$/i.test(String(f.dept || '').trim())));
    return f => Boolean(hasHV && f.dept && !/^hauptverein$/i.test(String(f.dept).trim()) && f.interval !== 'einmalig');
  };
  const feeKey = (f, zus) => `${zus ? String(f.dept).trim().toLowerCase() : ''}|${String(f.name).trim().toLowerCase()}`;
  const words = t => new Set(String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').split(/[^a-z0-9]+/).filter(w => w.length > 1));
  function feeSimilarity(a, b) {
    const x = words(a.name), y = words(b.name); if (!x.size || !y.size) return 0;
    const common = [...x].filter(w => y.has(w)).length;
    return common / new Set([...x, ...y]).size + (a.cents === b.cents && a.interval === b.interval ? 0.25 : 0);
  }
  /** vorhandene Beitragsart mit genau diesem Namen (gleiche Art) bzw. ähnliche Vorschläge */
  function feeMatch(f, zus) {
    const did = zus ? (db.prepare('SELECT id FROM mv_department WHERE lower(name) = lower(?)').get(f.dept) || {}).id : null;
    const pool = zus ? (did ? db.prepare("SELECT * FROM mv_fee WHERE kind = 'zusatz' AND department_id = ?").all(did) : []) : db.prepare("SELECT * FROM mv_fee WHERE kind != 'zusatz'").all();
    const exact = pool.find(x => x.name.trim().toLowerCase() === String(f.name).trim().toLowerCase());
    const suggest = exact ? [] : pool.map(x => ({ x, s: feeSimilarity(f, x) })).filter(o => o.s >= 0.5).sort((a, b) => b.s - a.s).slice(0, 4)
      .map(o => ({ id: o.x.id, name: o.x.name, cents: o.x.cents, interval: o.x.interval, active: o.x.active }));
    const others = pool.filter(x => x !== exact && !suggest.some(o => o.id === x.id)).sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map(x => ({ id: x.id, name: x.name, cents: x.cents, interval: x.interval, active: x.active }));
    return { exact: exact ? exact.id : null, suggest, others };
  }
  /** Entscheidungen je Beitragsart (Schlüssel → Beitrags-ID | 'neu' | 'skip'); bei ähnlichen vorhandenen ist eine Entscheidung Pflicht */
  function feeDecisions(recs, raw) {
    const isDept = deptFeeTest(recs), out = new Map(), seen = new Set();
    for (const r of recs) for (const f of r.fees) {
      const zus = isDept(f), key = feeKey(f, zus); if (seen.has(key)) continue; seen.add(key);
      const m = feeMatch(f, zus), v = raw && raw[key];
      if (m.exact && (v == null || v === '' || v === 'neu')) continue;   // gleicher Name: vorhandene verwenden, außer anders gewählt
      if (v === 'skip' || v === 'neu') { out.set(key, v); continue; }
      if (v != null && v !== '') {
        const id = Number(v);
        if (id !== m.exact && ![...m.suggest, ...m.others].some(x => x.id === id)) throw new Error(`Beitragsart „${f.name}“: Diese Zuordnung passt nicht – bitte die Vorschau neu laden.`);
        out.set(key, id); continue;
      }
      if (m.suggest.length) throw new Error(`Für die Beitragsart „${f.name}“ gibt es ähnliche vorhandene – bitte wählen: vorhandene verwenden, neu anlegen oder nicht übernehmen.`);
      out.set(key, 'neu');
    }
    return out;
  }

  function plan(recs) {
    const out = { new: 0, update: 0, conflicts: [], warnings: [], depts: new Set(), fees: new Map(), rows: [], similar: 0 };
    loadPool();
    const isDept = deptFeeTest(recs);
    const exactIds = new Set(recs.map(r => matchMember(r).id).filter(Boolean));
    const nameOf = r => `${r.p.last_name}, ${r.p.first_name || ''}`.replace(/, $/, '');
    /** „Abweichender Zahler“ / „Familie bei“ (Nummer oder Name) → Text für die Vorschau, wie beim Übernehmen gesucht */
    const whoIs = key => {
      const k = String(key).trim(), lk = k.toLowerCase(), rev = k.split(',').reverse().map(x => x.trim()).join(' ').toLowerCase();
      const inFile = recs.find(x => x.member_no === k || [`${x.p.first_name || ''} ${x.p.last_name}`.trim().toLowerCase(), nameOf(x).toLowerCase()].some(n => n === lk || n === rev));
      if (inFile) return { name: nameOf(inFile), rec: inFile };
      const hit = db.prepare("SELECT id FROM members WHERE kind = 'mitglied' AND deleted = 0 AND (lower(name) = ? OR lower(name) = ?)").all(lk, rev);
      const id = (db.prepare('SELECT member_id FROM mv_person WHERE member_no = ?').get(k) || {}).member_id || (hit.length === 1 ? hit[0].id : null);
      return id ? { name: k, id } : null;
    };
    const familyRec = rec => rec && rec.fees.some(f => !isDept(f) && !f.end && (guessAges(f.name).family || ((feeMatch(f, false).exact && db.prepare('SELECT family FROM mv_fee WHERE id = ?').get(feeMatch(f, false).exact).family))));
    const payerText = r => {
      const key = r.payer.member || r.family; if (!key) return null;
      const w = whoIs(key);
      if (!w) { out.warnings.push(`Zeile ${r.line} ${r.p.first_name} ${r.p.last_name}: Zahler „${key}“ nicht gefunden – wird nicht verknüpft`); return { name: key, missing: true }; }
      const fam = famOf(r, w);
      if (fam && store.isAdult(r.p.birth_date) && adultsAt.get(w.name) > 1) {
        out.warnings.push(`Zeile ${r.line} ${r.p.first_name} ${r.p.last_name}: über ${store.childMax()} Jahre und ohne eigenen Beitrag, zahlt über ${w.name} – dort wären mehr als zwei Erwachsene in der Familie. Wird nicht als Familie übernommen, bitte prüfen.`);
        return { name: w.name, family: false, check: true };
      }
      return { name: w.name, family: fam };
    };
    // Familie nur ohne eigenen Beitrag und mit Familienbeitrag beim Zahler; höchstens ein weiterer Erwachsener (Partner)
    const famOf = (r, w) => !r.fees.some(f => !isDept(f) && !f.end && f.interval !== 'einmalig') && Boolean(w.rec ? familyRec(w.rec) : store.familyFee(w.id));
    const adultsAt = new Map();
    for (const r of recs) {
      const w = r.payer.member && whoIs(r.payer.member);
      if (!w || !famOf(r, w) || !store.isAdult(r.p.birth_date)) continue;
      if (!adultsAt.has(w.name)) adultsAt.set(w.name, w.id ? store.familyMembers(w.id).filter(x => x.role === 'partner').length : 0);
      adultsAt.set(w.name, adultsAt.get(w.name) + 1);
    }
    for (const r of recs) {
      const m = matchMember(r);
      const sug = m.id ? [] : candidates(r, exactIds);
      if (sug.length) out.similar++;
      if (m.conflict && !sug.length) { out.conflicts.push(`Zeile ${r.line} ${r.p.first_name} ${r.p.last_name}: ${m.conflict} – wird neu angelegt`); }
      if (m.id) out.update++; else out.new++;
      if (r.ibanBad) out.warnings.push(`Zeile ${r.line} ${r.p.first_name} ${r.p.last_name}: IBAN ungültig (${r.ibanBad}) – nicht übernommen`);
      for (const d of r.depts) if (!db.prepare('SELECT 1 FROM mv_department WHERE lower(name) = lower(?)').get(d.name)) out.depts.add(d.name);
      for (const f of r.fees) {
        const zus = isDept(f), key = feeKey(f, zus);
        if (!out.fees.has(key)) out.fees.set(key, { key, name: f.name, cents: f.cents, interval: f.interval, dept: zus ? f.dept : null, ...feeMatch(f, zus), count: 0,
          example: { name: `${r.p.first_name || ''} ${r.p.last_name || ''}`.trim(), line: r.line, start: f.start, end: f.end, booked: f.booked, cents: f.cents, interval: f.interval } });
        out.fees.get(key).count++;
      }
      out.rows.push({ line: r.line, name: `${r.p.first_name || ''} ${r.p.last_name}`.trim(), member_no: r.member_no, birth_date: r.p.birth_date || '', action: m.id ? `ergänzen (${m.by})` : 'neu', suggest: sug, depts: r.depts.map(d => d.name).join(', '),
        fees: r.fees.map(f => `${f.name}${f.booked ? ' · gebucht bis ' + fees.deD(f.booked) : ''}`).join(', '), payer: payerText(r), mandate: r.bank && r.bank.mandate_ref ? r.bank.mandate_ref : '', exit: r.p.exit_date });
    }
    // Beginn des Beitragsjahres aus „Gebucht bis“ ablesen (z. B. 30.04. → Beitragsjahr ab 01.05.)
    const votes = {};
    for (const r of recs) for (const f of r.fees) if (f.booked && f.interval !== 'monat') { const m = fees.addDays(f.booked, 1).slice(5); if (m.endsWith('-01')) votes[m] = (votes[m] || 0) + 1; }
    const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    const yearHint = best && best[0] !== S('year_start', '01-01') ? best[0] : null;
    if (yearHint) out.warnings.unshift(`Laut „Gebucht bis“ beginnt euer Beitragsjahr am ${yearHint.slice(3)}.${yearHint.slice(0, 2)}. – eingestellt ist der ${S('year_start', '01-01').slice(3)}.${S('year_start', '01-01').slice(0, 2)}. Beim Übernehmen wird das angepasst.`);
    // Beispiel für den Feldabgleich: so landen die Spalten der Datei in Clubwerk (erste Person mit Nachnamen)
    const ex = recs.find(r => r.p.last_name) || recs[0];
    const sample = ex ? { line: ex.line, fields: [['Mitgliedsnummer', ex.member_no], ['Anrede', ex.p.salutation], ['Titel', ex.p.title], ['Vorname', ex.p.first_name], ['Nachname', ex.p.last_name],
      ['Geburtsdatum', ex.p.birth_date && fees.deD(ex.p.birth_date)], ['Geschlecht', { w: 'weiblich', m: 'männlich', d: 'divers' }[ex.p.gender] || ex.p.gender], ['Straße', ex.p.street], ['PLZ', ex.p.zip], ['Ort', ex.p.city], ['Land', ex.p.country],
      ['E-Mail', ex.p.email], ['Telefon', ex.p.phone], ['Mobil', ex.p.mobile], ['Eintritt', ex.p.entry_date && fees.deD(ex.p.entry_date)], ['Austritt', ex.p.exit_date && fees.deD(ex.p.exit_date)],
      ['Status', SAMPLE_LABEL[ex.p.status] || ex.p.status], ['Zahlungsart', SAMPLE_LABEL[ex.p.payment] || ex.p.payment], ['Kontoinhaber', ex.bank && ex.bank.holder], ['IBAN', ex.bank && sepa.maskIban(ex.bank.iban)], ['BIC', ex.bank && ex.bank.bic],
      ['Mandatsreferenz', ex.bank && ex.bank.mandate_ref], ['Mandat unterschrieben', ex.bank && ex.bank.mandate_date && fees.deD(ex.bank.mandate_date)],
      ['Abweichender Zahler', ex.payer.member], ['Familie bei', ex.family], ['Abteilungen', ex.depts.map(d => d.name).join(', ')], ['Beiträge', ex.fees.map(f => f.name).join(', ')]].map(([label, value]) => ({ label, value: value == null ? '' : String(value) })) } : null;
    return { ...out, yearHint, sample, depts: [...out.depts], fees: [...out.fees.values()] };
  }

  function commit(recs, user, dec = new Map(), feeDec = new Map()) {
    const ids = new Map();   // member_no / Zeile → id
    const stats = { created: 0, updated: 0, fees: 0, depts: 0, payers: 0, families: 0 };
    db.transaction(() => {
      const deptId = name => {
        let d = db.prepare('SELECT id FROM mv_department WHERE lower(name) = lower(?)').get(name);
        if (!d) { d = { id: Number(db.prepare('INSERT INTO mv_department(name) VALUES (?)').run(name).lastInsertRowid) }; stats.depts++; }
        return d.id;
      };
      const isDeptFee = deptFeeTest(recs);
      const feeId = f => {
        const zus = isDeptFee(f), choice = feeDec.get(feeKey(f, zus));
        if (choice === 'skip') return null;                 // „nicht übernehmen“: Mitglied ohne diesen Beitrag (Hinweis „ohne Beitrag“)
        if (Number.isInteger(choice)) return choice;        // „vorhandene verwenden“
        const did = zus ? deptId(f.dept) : null;
        let x = zus ? db.prepare("SELECT id FROM mv_fee WHERE lower(name) = lower(?) AND kind = 'zusatz' AND department_id = ?").get(f.name, did)
          : db.prepare("SELECT id FROM mv_fee WHERE lower(name) = lower(?) AND kind != 'zusatz'").get(f.name);
        if (!x) {
          const g = guessAges(f.name);
          x = { id: Number(db.prepare('INSERT INTO mv_fee(name, kind, department_id, cents, interval, age_min, age_max, family, work_minutes, on_form) VALUES (?,?,?,?,?,?,?,?,?,?)')
            .run(f.name, zus ? 'zusatz' : 'grund', zus ? did : (f.dept && !/^hauptverein$/i.test(f.dept) ? deptId(f.dept) : null), f.cents || 0, f.interval, g.age_min, g.age_max, zus ? 0 : g.family, zus ? null : g.work_minutes, zus ? 0 : 1).lastInsertRowid) };
          stats.fees++;
        }
        return x.id;
      };
      for (const r of recs) {
        const m = matchMember(r);
        let id = m.id || dec.get(r.line) || null;   // ähnlicher Name: im Dialog „zusammenführen“ gewählt → Daten aus der Datei übernehmen
        const fields = Object.fromEntries(Object.entries(r.p).filter(([, v]) => v != null && v !== ''));
        if (!id) { id = sh.createPerson({ ...fields, first_name: fields.first_name || '-', entry_date: fields.entry_date || today() }, user, { memberNo: r.member_no && !db.prepare('SELECT 1 FROM mv_person WHERE member_no = ?').get(r.member_no) ? r.member_no : null }); stats.created++; }
        else {
          store.ensurePerson(id);
          if (r.member_no && !db.prepare('SELECT 1 FROM mv_person WHERE member_no = ? AND member_id != ?').get(r.member_no, id)) fields.member_no = r.member_no;
          sh.savePerson(id, fields, user); stats.updated++;
        }
        if (r.p.exit_date && r.p.exit_date < today()) db.prepare('UPDATE members SET active = 0 WHERE id = ?').run(id);
        ids.set(r.member_no || `#${r.line}`, id); r.id = id;
        // Abteilungen
        for (const d of r.depts) {
          const did = deptId(d.name);
          if (!db.prepare('SELECT 1 FROM mv_member_department WHERE member_id = ? AND department_id = ? AND COALESCE(entry_date,\'\') = COALESCE(?,\'\')').get(id, did, d.entry))
            db.prepare('INSERT INTO mv_member_department(member_id, department_id, entry_date, exit_date, status, federation_status, exit_reason, booked_until) VALUES (?,?,?,?,?,?,?,?)').run(id, did, d.entry, d.exit, d.status, d.fed || null, d.reason || null, store.zusatzStart(did, d.entry || r.p.entry_date));
        }
        // Beiträge (mit „gebucht bis“)
        for (const f of r.fees) {
          const fid = feeId(f); if (!fid) { r.skipped = true; continue; }
          if (isDeptFee(f)) {   // Zusatzbeitrag → „abgerechnet bis“ an der Abteilungszugehörigkeit
            const did = deptId(f.dept);
            let md = db.prepare('SELECT * FROM mv_member_department WHERE member_id = ? AND department_id = ? ORDER BY exit_date IS NOT NULL, id DESC LIMIT 1').get(id, did);
            if (!md) { const mid = Number(db.prepare('INSERT INTO mv_member_department(member_id, department_id, entry_date, status) VALUES (?,?,?,?)').run(id, did, f.start || r.p.entry_date || today(), 'aktiv').lastInsertRowid); md = db.prepare('SELECT * FROM mv_member_department WHERE id = ?').get(mid); }
            const bu = [md.booked_until, f.booked].filter(Boolean).sort().pop() || null;
            // mehrere Zusatzbeiträge ohne eindeutige Altersgrenzen: den aus verein.cloud fest übernehmen
            const all = db.prepare("SELECT * FROM mv_fee WHERE kind = 'zusatz' AND department_id = ? AND active = 1").all(did);
            const auto = fees.pickByAge(all, r.p.birth_date || null, today()).fee;
            db.prepare('UPDATE mv_member_department SET booked_until = ?, fee_id = ? WHERE id = ?').run(bu, all.length > 1 && (!auto || auto.id !== fid) ? fid : md.fee_id, md.id);
            continue;
          }
          const fee = db.prepare('SELECT cents FROM mv_fee WHERE id = ?').get(fid);
          const start = f.start || r.p.entry_date || today();
          const ex = db.prepare('SELECT id FROM mv_member_fee WHERE member_id = ? AND fee_id = ? AND start_date = ?').get(id, fid, start);
          const cents = f.cents != null && f.cents !== fee.cents ? f.cents : null;
          if (ex) db.prepare('UPDATE mv_member_fee SET end_date = ?, booked_until = ?, cents = ? WHERE id = ?').run(f.end, f.booked, cents, ex.id);
          else db.prepare('INSERT INTO mv_member_fee(member_id, fee_id, start_date, end_date, booked_until, cents) VALUES (?,?,?,?,?,?)').run(id, fid, start, f.end, f.booked, cents);
        }
        // Bankverbindung & Mandat (schon in Gebrauch: Folgelastschrift)
        const b = r.bank || (r.payer.iban && !r.payer.member ? { holder: r.payer.holder, iban: r.payer.iban, bic: r.payer.bic, bank: r.payer.bank } : null);
        if (b && b.iban) {
          const used = r.fees.some(f => f.booked) || r.mandateUsed ? today() : null;
          const lastUsed = b.valid_until ? fees.addMonths(b.valid_until, -36) : used;
          const refFree = b.mandate_ref && !db.prepare('SELECT 1 FROM mv_bank WHERE mandate_ref = ? AND member_id != ?').get(b.mandate_ref, id);
          db.prepare(`INSERT INTO mv_bank(member_id, holder, iban, bic, bank, mandate_ref, mandate_date, mandate_first_used, mandate_last_used, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(member_id) DO UPDATE SET holder = excluded.holder, iban = excluded.iban, bic = COALESCE(excluded.bic, bic), bank = COALESCE(excluded.bank, bank),
            mandate_ref = COALESCE(excluded.mandate_ref, mandate_ref), mandate_date = COALESCE(excluded.mandate_date, mandate_date), mandate_first_used = COALESCE(mandate_first_used, excluded.mandate_first_used),
            mandate_last_used = COALESCE(excluded.mandate_last_used, mandate_last_used), updated_at = excluded.updated_at`)
            .run(id, b.holder || `${r.p.first_name || ''} ${r.p.last_name}`.trim(), b.iban, b.bic || null, b.bank || null, refFree ? b.mandate_ref : null, b.mandate_date || null, b.mandate_ref ? (lastUsed || used) : null, b.mandate_ref ? lastUsed : null, nowTs());
        }
        // Ehrungen / Funktionen (Textlisten)
        for (const h of String(r.honors || '').split(/[;\n]/).map(x => x.trim()).filter(Boolean)) if (!db.prepare('SELECT 1 FROM mv_honor WHERE member_id = ? AND name = ?').get(id, h.slice(0, 120))) db.prepare('INSERT INTO mv_honor(member_id, name) VALUES (?,?)').run(id, h.slice(0, 120));
        for (const f of String(r.functions || '').split(/[;\n]/).map(x => x.trim()).filter(Boolean)) if (!db.prepare('SELECT 1 FROM mv_function WHERE member_id = ? AND name = ?').get(id, f.slice(0, 120))) db.prepare('INSERT INTO mv_function(member_id, name) VALUES (?,?)').run(id, f.slice(0, 120));
      }
      // Zahler verknüpfen: „Abweichender Zahler Mitglied“ (Nummer oder Name), sonst Gemeinschaft mit genau einem Beitragszahler
      const findMember = key => {
        let pid = ids.get(key) || (db.prepare('SELECT member_id FROM mv_person WHERE member_no = ?').get(key) || {}).member_id;
        if (!pid) { const hit = db.prepare("SELECT id FROM members WHERE kind = 'mitglied' AND deleted = 0 AND (lower(name) = lower(?) OR lower(name) = lower(?))").all(key, key.split(',').reverse().map(s => s.trim()).join(' ')); if (hit.length === 1) pid = hit[0].id; }
        return pid || null;
      };
      for (const r of recs) {
        if (!r.payer.member) continue;
        const pid = findMember(r.payer.member.trim());
        if (pid && pid !== r.id) { db.prepare('UPDATE mv_person SET payer_id = ? WHERE member_id = ?').run(pid, r.id); stats.payers++; }
      }
      // Familienmitgliedschaft: Spalte „Familie bei“ (Nummer oder Name des Oberhaupts) – nur mit Familienbeitrag beim Oberhaupt, eine Ebene
      for (const r of recs) {
        if (!r.family) continue;
        const hid = findMember(r.family.trim());
        if (hid && hid !== r.id && store.familyFee(hid) && !(db.prepare('SELECT family_of FROM mv_person WHERE member_id = ?').get(hid) || {}).family_of) { db.prepare('UPDATE mv_person SET family_of = ? WHERE member_id = ?').run(hid, r.id); stats.families++; }
      }
      const groups = new Map();
      for (const r of recs) if (r.group) { if (!groups.has(r.group)) groups.set(r.group, []); groups.get(r.group).push(r); }
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        const payers = list.filter(r => r.fees.some(f => (f.cents || 0) > 0 && !f.end));
        if (payers.length !== 1) continue;
        for (const r of list) if (r !== payers[0] && !db.prepare('SELECT payer_id FROM mv_person WHERE member_id = ?').get(r.id).payer_id) { db.prepare('UPDATE mv_person SET payer_id = ? WHERE member_id = ?').run(payers[0].id, r.id); stats.payers++; }
      }
      store.flattenPayers();
      stats.families += store.familyFromPayers(recs.filter(r => !r.skipped).map(r => r.id));   // „nicht übernehmen“ macht niemanden zur Familie   // wie bisher: wer über einen Zahler mit Familienbeitrag läuft, gehört zu dessen Familienmitgliedschaft
    })();
    return stats;
  }

  const raw = express.raw({ type: () => true, limit: '20mb' });
  const periodEnd = () => fees.addDays(store.periodStart(today(), 'jahr'), -1);
  /** Datei ansehen: Format erkennen, Zuordnung vorschlagen (die Datei wird nicht gespeichert) */
  admin.post('/import/analyze', P, raw, ar(async (req, res) => {
    let rows; try { rows = await readTable(req.body); } catch (e) { return bad(res, e.message); }
    const head = rows[0], format = detect(head);
    // Beispielwerte immer aus einer einzigen Zeile (die vollständigste der ersten 50) – nie Werte verschiedener Personen mischen
    const filled = r => head.reduce((n, _, i) => n + (String(r[i] == null ? '' : r[i]).trim() ? 1 : 0), 0);
    let best = 1; for (let k = 2; k < Math.min(rows.length, 51); k++) if (filled(rows[k]) > filled(rows[best])) best = k;
    const sample = rows.length > 1 ? [head.map((_, i) => one(rows[best][i], 60))] : [], sampleLine = rows.length > 1 ? best + 1 : null;
    res.json({ format, label: PRESETS[format].label, presets: Object.entries(PRESETS).map(([k, p]) => ({ key: k, label: p.label })), headers: head, count: rows.length - 1, sample, sampleLine,
      fields: FIELDS.map(([key, label, group]) => ({ key, label, group })), vcFields: Object.keys(VC_COLS), mapping: format === 'vereincloud' ? Object.fromEntries(Object.entries(VC_COLS).filter(([, c]) => head.includes(c))) : suggest(head, format), booked_default: periodEnd() });
  }));
  /** Vorschau bzw. Übernahme mit Zuordnung (Zuordnung als JSON im Kopf „X-Mapping“) */
  admin.post('/import/run', P, raw, ar(async (req, res) => {
    let rows; try { rows = await readTable(req.body); } catch (e) { return bad(res, e.message); }
    const format = PRESETS[String(req.query.format || '')] ? String(req.query.format) : detect(rows[0]);
    let map = null;
    if (format !== 'vereincloud') {
      try { map = JSON.parse(decodeURIComponent(String(req.get('X-Mapping') || '')) || '{}'); } catch (e) { return bad(res, 'Die Spaltenzuordnung ist ungültig.'); }
      map = Object.fromEntries(Object.entries(map || {}).filter(([k, v]) => (FIELD_KEYS.includes(k) && typeof v === 'string' && rows[0].includes(v)) || (k === '__name_split' && v === true)));
    }
    let over = {};
    if (format === 'vereincloud' && req.get('X-Mapping')) {   // Zuordnung im Dialog geändert: fehlendes Feld = nicht übernehmen
      let m; try { m = JSON.parse(decodeURIComponent(String(req.get('X-Mapping')))) || {}; } catch (e) { return bad(res, 'Die Spaltenzuordnung ist ungültig.'); }
      over = Object.fromEntries(Object.keys(VC_COLS).map(k => [k, typeof m[k] === 'string' && rows[0].includes(m[k]) ? m[k] : '']));
      if (!over.last_name) return bad(res, 'Bitte die Spalte für den Nachnamen zuordnen.');
    }
    const bookedDefault = fees.isDate(String(req.query.booked || '')) ? String(req.query.booked) : null;
    let recs;
    try { recs = format === 'vereincloud' ? readRecords(rows, over) : readMapped(rows, map, { bookedDefault, mandateUsed: req.query.used === '1' }); } catch (e) { return bad(res, e.message); }
    return finish(req, res, recs, format, map);
  }));
  function finish(req, res, recs, format, map) {
    if (!recs.length) return bad(res, 'Keine Mitglieder in der Datei gefunden.');
    if (recs.length > 5000) return bad(res, 'Höchstens 5000 Mitglieder auf einmal.');
    if (req.query.commit !== '1') return res.json({ preview: true, count: recs.length, format, ...plan(recs) });
    if (recs.some(r => r.bank) && !req.user.perms.includes('mitglieder_bank')) return bad(res, 'Die Datei enthält Bankverbindungen – Importieren darf nur, wer das Recht „Bankdaten“ hat.', 403);
    const yh = /^(0[1-9]|1[0-2])-01$/.test(String(req.query.year_start || '')) ? req.query.year_start : null;
    if (yh) SET('year_start', yh);
    let dec, feeDec;
    try {
      const raw = JSON.parse(decodeURIComponent(String(req.get('X-Decisions') || '')) || '{}') || {};
      const both = raw.m || raw.f ? raw : { m: raw, f: {} };
      dec = decisions(recs, both.m || {}); feeDec = feeDecisions(recs, both.f || {});
    } catch (e) { return bad(res, e.message || 'Die Entscheidungen sind ungültig.'); }
    const stats = commit(recs, uname(req), dec, feeDec);
    if (map) SET('import_map_' + format, JSON.stringify(map));   // nur Spaltennamen, keine Daten
    C.audit(req.user, `Mitglieder importiert (${PRESETS[format].label})`, `${stats.created} neu, ${stats.updated} ergänzt, ${stats.depts} Abteilungen, ${stats.fees} Beitragsarten, ${stats.payers} Zahler verknüpft, ${stats.families} Familienmitgliedschaften`);
    res.json({ ok: true, ...stats });
  }
  /* bisheriger Weg (verein.cloud direkt) */
  admin.post('/import/verein-cloud', P, raw, ar(async (req, res) => {
    let recs;
    try { recs = readRecords(await readTable(req.body || Buffer.alloc(0))); } catch (e) { return bad(res, e.message); }
    return finish(req, res, recs, 'vereincloud', null);
  }));
}


module.exports = { register };
