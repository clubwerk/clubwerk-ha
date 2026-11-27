'use strict';
/* ---------- Rechte beschreiben: Gruppe, Reihenfolge, Name, Kurzbeschreibung, Abhängigkeiten, Vorlagen ----------
   Die Schlüssel (gespeichert bei Rollen und Benutzern) ändern sich nie – hier steht nur, wie sie heißen und zusammengehören.
   Kern und Verkauf beschreiben ihre Rechte hier; Module in erweiterung.json:
     "perms": { "schlüssel": { "label": "…", "hint": "…", "level": "bedienen" | "einrichten", "requires": ["…"], "vorlagen": ["vorstand", …] } }
   (der alte Text statt eines Objekts geht weiter: er wird zum Namen).
   requires: Das Recht wirkt nur zusammen mit diesen Rechten – entweder weil der Server die Daten nur damit herausgibt
   (Bankdaten, Dokumente und Beiträge erreicht man nur über Seiten mit „Mitglieder“) oder weil der Server das andere Recht
   ohnehin schon mit einschließt („… einrichten“ darf auch bedienen, jedes Recht für Plätze zeigt die Belegung). Die Oberfläche
   kreuzt es sichtbar mit an, der Server lehnt neue Lücken ab (checkGaps) – nichts wird still ergänzt. */

/** Kernrechte und Verkauf, in der Reihenfolge der Anzeige. gruppe: Modul, unter dem das Recht erscheint (Kern: „allgemein“). */
const CORE = {
  buchungen: { gruppe: 'getraenke', label: 'Buchungen', hint: 'Buchungen ansehen, stornieren und nachtragen, „+ Betrag auf Konto“', vorlagen: ['kassenwart', 'thekendienst'] },
  konten: { gruppe: 'getraenke', label: 'Konten', hint: 'Mitglieder und Konten anlegen, neue vom Tablet bestätigen', vorlagen: ['kassenwart'] },
  abrechnung: { gruppe: 'getraenke', label: 'Abrechnung', hint: 'Konten als abgerechnet markieren, Auswertung und Excel-Export', vorlagen: ['kassenwart'] },
  export: { gruppe: 'getraenke', label: 'Export', hint: 'Aktuellen Stand ansehen und als Excel exportieren (z. B. Kassenprüfung)', vorlagen: ['vorstand', 'kassenwart'] },
  veranstaltungen: { gruppe: 'getraenke', label: 'Veranstaltungen & Deckel', hint: 'Veranstaltungen und Gäste-Deckel führen, „hat bezahlt“ abhaken', vorlagen: ['thekendienst'] },
  lieferungen: { gruppe: 'getraenke', label: 'Lieferungen', hint: 'Lieferungen und Belege hochladen', vorlagen: ['thekendienst'] },
  bestand: { gruppe: 'getraenke', label: 'Bestand', hint: 'Bestand, Inventur und Abgleich', vorlagen: ['thekendienst'] },
  bestellung: { gruppe: 'getraenke', label: 'Bestellung', hint: 'Bestellung vorbereiten (Bestellmail)', vorlagen: ['thekendienst'] },
  artikel: { gruppe: 'getraenke', label: 'Artikel & Preise', hint: 'Artikel, Preise und Kategorien einrichten', level: 'einrichten' },
  uebernahme: { gruppe: 'getraenke', label: 'Übernahme', hint: 'Offene Beträge von Veranstaltungen auf die Getränkeliste übernehmen', vorlagen: ['kassenwart'] },
  kontoauszug: { gruppe: 'mitglieder', label: 'Kontoauszug', hint: 'Kontoauszüge einlesen und zuordnen – zu Beiträgen bzw. Ausgaben nur mit „Beiträge & Einzug“ bzw. „Buchhaltung“', vorlagen: ['kassenwart'] },
  email: { gruppe: 'allgemein', label: 'Nachrichten', hint: 'Nachrichten an Mitglieder per E-Mail, in der App und als Push', vorlagen: ['vorstand', 'schriftfuehrer', 'abteilungsleitung'] },
  app: { gruppe: 'allgemein', label: 'Mitglieder-App einrichten', hint: 'Bereiche, Reiter, Benachrichtigungen und Name der App (Adresse und Sicherheit nur mit „Alle Rechte“)', level: 'einrichten' },
  sicherheit: { gruppe: 'allgemein', label: 'Sicherheitswarnungen', hint: 'Sicherheitswarnungen per Push und E-Mail erhalten und ansehen', vorlagen: ['vorstand'] },
  deinstallieren: { gruppe: 'allgemein', label: 'Module', hint: 'Module deinstallieren und wieder installieren (vorher Pflicht-Sicherung)', level: 'einrichten' },
};
/** Nur mit „Alle Rechte“ – nicht einzeln vergebbar (Anzeige im Fenster als Hinweis) */
const ONLY_ALL = { benutzer: 'Benutzer', einstellungen: 'Einstellungen' };

/** Vorlagen für typische Ämter beim Anlegen einer Rolle. Welche Rechte dazugehören, sagt jedes Recht selbst („vorlagen“) –
 *  so bringt ein neues Modul seine Rechte für die Ämter mit. Zurückhaltend: nur, was das Amt im Alltag braucht. */
const VORLAGEN = [
  { id: 'vorstand', name: 'Vorstand', beschreibung: 'Überblick: Mitglieder, Nachrichten, Verkaufsstand und Belegung ansehen – ohne Bankdaten und Einzug.' },
  { id: 'kassenwart', name: 'Kassenwart', beschreibung: 'Beiträge und Einzug, Bankdaten, Kontoauszug, Ausgaben und Kasse, Verkaufs-Abrechnung.' },
  { id: 'thekendienst', name: 'Thekendienst', beschreibung: 'Verkauf im Alltag: Buchungen, Veranstaltungen und Deckel, Lieferungen, Bestand, Bestellung – ohne Preise.' },
  { id: 'platzwart', name: 'Platzwart', beschreibung: 'Anlage bedienen: Belegung, Sperren, Beregnung, Flutlicht und Mängel.' },
  { id: 'sportwart', name: 'Sportwart', beschreibung: 'Spielbetrieb, Turniere, Belegung, Buchungen für andere sowie Serien und Sperren.' },
  { id: 'jugendwart', name: 'Jugendwart', beschreibung: 'Spielbetrieb und Turniere, Belegung ansehen und für andere buchen.' },
  { id: 'abteilungsleitung', name: 'Abteilungsleitung', beschreibung: 'Nur Mitglieder der eigenen Abteilung(en) und Nachrichten an sie.', scope: true },
  { id: 'schriftfuehrer', name: 'Schriftführer', beschreibung: 'Mitglieder, Dokumente, Gratulationen und Nachrichten.' },
];

const KEY_RE = /^[a-z0-9_]{2,40}$/;
const VORLAGE_IDS = new Set(VORLAGEN.map(v => v.id));
const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);
/** Beschreibung eines Rechts aus erweiterung.json (Text oder Objekt) in eine feste Form bringen */
function normalize(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : { label: String(v || '') };
  const arr = x => (Array.isArray(x) ? x.filter(k => typeof k === 'string' && KEY_RE.test(k)) : []);
  return { label: clean(o.label, 80), hint: clean(o.hint, 240), level: o.level === 'einrichten' ? 'einrichten' : 'bedienen',
    requires: arr(o.requires), vorlagen: arr(o.vorlagen).filter(id => VORLAGE_IDS.has(id)) };
}
const CORE_N = Object.fromEntries(Object.entries(CORE).map(([k, v]) => [k, { ...normalize(v), gruppe: v.gruppe }]));

/**
 * Katalog aller Rechte, nach Modulen gruppiert (Reihenfolge des Menüs, „Allgemein“ zuletzt).
 *  mods:      [{ id, name, active, perms: { key: Beschreibung } }] in Menü-Reihenfolge (aus plugins.js)
 *  effective: Recht wirkt gerade (Modul eingeschaltet) – Kernrechte in einer ausgeschalteten Gruppe wirken weiter und stehen dann unter „Allgemein“
 * → [{ id, name, active, perms: [{ key, label, hint, level, requires, vorlagen }] }]
 */
function catalog(mods, effective) {
  const groups = mods.map(m => ({ id: m.id, name: m.name, active: Boolean(m.active), perms: [] }));
  const byId = new Map(groups.map(g => [g.id, g]));
  const allg = { id: 'allgemein', name: 'Allgemein', active: true, perms: [] };
  const seen = new Set();   // ein Schlüssel nur einmal: beim ersten Modul, das ihn nennt (wie die Anmeldung in plugins.load)
  for (const m of mods) {
    const g = byId.get(m.id);
    for (const [k, v] of Object.entries(m.perms || {})) if (KEY_RE.test(k) && !CORE_N[k] && !seen.has(k)) { seen.add(k); const n = normalize(v); g.perms.push({ key: k, ...n, label: n.label || k }); }
  }
  for (const [k, v] of Object.entries(CORE_N)) {
    const g = byId.get(v.gruppe);
    const { gruppe, ...rest } = v; void gruppe;
    if (g && (g.active || !effective(k))) g.perms.push({ key: k, ...rest });
    else if (effective(k)) allg.perms.push({ key: k, ...rest });   // ohne Modul: nur, was weiter wirkt (z. B. „Konten“ ohne Verkauf)
  }
  // Alltag vor „einrichten“, sonst die Reihenfolge des Moduls
  for (const g of groups) g.perms = g.perms.map((p, i) => ({ p, i })).sort((a, b) => Number(a.p.level === 'einrichten') - Number(b.p.level === 'einrichten') || a.i - b.i).map(x => x.p);
  return [...groups, allg].filter(g => g.perms.length);
}

/** Name eines Rechts für Protokoll, Meldungen und Warnungen: „Buchungen (Verkauf)“ – nie der interne Schlüssel */
function nameOf(cat, k) {
  for (const g of cat) { const p = g.perms.find(x => x.key === k); if (p) return p.label === g.name || g.id === 'allgemein' ? p.label : `${p.label} (${g.name})`; }
  return ONLY_ALL[k] || 'unbekanntes Recht';
}

/** Lücken: Rechte in der Liste, deren Voraussetzung fehlt → [[recht, voraussetzung]] (nur bekannte Rechte) */
function gaps(cat, list) {
  const has = new Set(list), out = [];
  for (const g of cat) for (const p of g.perms) if (has.has(p.key)) for (const r of p.requires) if (!has.has(r) && cat.some(x => x.perms.some(y => y.key === r))) out.push([p.key, r]);
  return out;
}
/** Neue Lücken gegenüber dem bisherigen Stand → Fehlertext oder '' (alte Lücken bleiben, damit gespeicherte Rechte unverändert bleiben) */
function checkGaps(cat, next, before = [], wer = '') {
  const old = new Set(gaps(cat, before).map(x => x.join('>')));
  const neu = gaps(cat, next).filter(x => !old.has(x.join('>')));
  if (!neu.length) return '';
  return `${wer ? wer + ': ' : ''}${neu.map(([k, r]) => `„${nameOf(cat, k)}“ wirkt nur zusammen mit „${nameOf(cat, r)}“`).join('; ')}. Bitte das nötige Recht mit ankreuzen oder das andere abwählen.`;
}

/** Vorlagen mit den Rechten eingeschalteter Module (leere fallen weg) */
function vorlagen(cat) {
  return VORLAGEN.map(v => ({ ...v, perms: cat.filter(g => g.active).flatMap(g => g.perms.filter(p => p.vorlagen.includes(v.id)).map(p => p.key)) }))
    .map(v => ({ ...v, perms: v.scope ? v.perms.filter(k => require('./auth').DEPT_PERMS.includes(k)) : v.perms }))
    .filter(v => v.perms.length);
}

module.exports = { CORE, ONLY_ALL, VORLAGEN, normalize, catalog, nameOf, gaps, checkGaps, vorlagen };
