// HTML der Buchungsseite. Kein Inline-Skript (Content-Security-Policy), alles Variable wird maskiert.
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const deD = s => { const [y, m, d] = String(s).split('-'); return `${d}.${m}.${y}`; };
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const wtag = s => WT[new Date(s + 'T12:00:00Z').getUTCDay()];
export const euro = c => (c / 100).toFixed(2).replace('.', ',') + ' €';

/** Kopfzeilen für API-Antworten und Weiterleitungen */
export const apiKopf = () => ({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000', 'Cross-Origin-Resource-Policy': 'same-origin' });

const TS = 'https://challenges.cloudflare.com';
function kopf(lage, paypal) {
  const anc = (lage.anzeige.homepage || []).join(' ') || "'none'";
  const pp = paypal ? ' https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com https://*.paypalobjects.com' : '';
  return {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    // Einbetten nur auf der eingetragenen Homepage (frame-ancestors); PayPal-Knöpfe brauchen Skripte, Rahmen und Verbindungen zu PayPal
    // Turnstile (Cloudflare): Skript und Rahmen der Sicherheitsprüfung
    'Content-Security-Policy': `default-src 'none'; script-src 'self'${pp} ${TS}; style-src 'self' 'unsafe-inline'; img-src 'self' data:${pp}; connect-src 'self'${pp} ${TS}; frame-src${pp} ${TS}; form-action 'self'${pp}; base-uri 'none'; frame-ancestors ${anc}`,
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Strict-Transport-Security': 'max-age=31536000',
    'Permissions-Policy': 'payment=(self "https://www.paypal.com" "https://www.sandbox.paypal.com"), camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',   // PayPal öffnet am Rechner ein eigenes Fenster
  };
}

/** Schriftfarbe auf der Vereinsfarbe: Weiß oder fast Schwarz, je nachdem was besser lesbar ist (WCAG-Kontrast) */
function tinte(hex) {
  const n = parseInt(hex.slice(1), 16), f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * f(n >> 16 & 255) + 0.7152 * f(n >> 8 & 255) + 0.0722 * f(n & 255);
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? '#ffffff' : '#111111';
}
export function html(lage, inhalt, status = 200, { paypal = false } = {}) {
  const a = lage.anzeige || {}, farbe = /^#[0-9a-f]{6}$/i.test(String(a.farbe)) ? a.farbe : '#1f6f43';
  const links = [a.impressum ? `<a href="${esc(a.impressum)}" target="_top" rel="noopener">Impressum</a>` : '', a.datenschutz ? `<a href="${esc(a.datenschutz)}" target="_top" rel="noopener">Datenschutz</a>` : ''].filter(Boolean).join(' · ');
  const body = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark"><meta name="robots" content="noindex">
<title>${esc(a.verein ? `Platz buchen – ${a.verein}` : 'Platz buchen')}</title>
<link rel="stylesheet" href="/stil.css"><style>:root{--brand:${farbe};--brand-ink:${tinte(farbe)}}</style></head>
<body data-homepage="${esc((a.homepage || []).join(' '))}">
<header class="kopf">${lage.logo ? '<img class="logo" src="/logo" alt="" width="44" height="44">' : ''}<div><div class="verein">${esc(a.verein || '')}</div><h1>Platz buchen</h1></div></header>
<main id="main">${inhalt}</main>
<footer class="fuss">${links}</footer>
<script src="/seite.js"></script><script src="/hoehe-innen.js"></script>
</body></html>`;
  return new Response(body, { status, headers: kopf(lage, paypal) });
}

export function buchen(lage, env, url) {
  const a = lage.anzeige || {};
  if (lage.offline) return '<div class="hinweis">Die Online-Buchung ist gerade nicht möglich. Bitte später noch einmal versuchen.</div>';
  if (lage.zu) return '<div class="hinweis">Der Verein nimmt gerade keine Online-Buchungen an.</div>';
  const vor = ['platz', 'datum', 'beginn'].map(k => `data-${k}="${esc((url.searchParams.get(k) || '').slice(0, 12))}"`).join(' ');
  const pp = String(env.PAYPAL_CLIENT_ID || '');
  const hinweis = String(a.hinweis || '').trim();
  return `<section id="buchen" data-client="${esc(pp)}" data-turnstile="${esc(String(env.TURNSTILE_SITE_KEY || ''))}" data-art="${esc(lage.paypalArt || '')}" data-storno="${esc(lage.regeln.storno_stunden)}" ${vor}>
  <h2 class="sec">1 · Tag wählen</h2>
  <div class="tage" id="tage" role="tablist" aria-label="Tag"></div>
  <h2 class="sec">2 · Zeit wählen</h2>
  <div id="zeiten" class="zeiten"><p class="leer">Freie Zeiten werden geladen …</p></div>
  <form id="daten" class="karte" hidden novalidate>
    <h2 class="sec">3 · Deine Angaben</h2>
    <p class="wahl" id="wahl"></p>
    <div class="felder">
      <label>Vorname<input name="vorname" autocomplete="given-name" maxlength="60" required></label>
      <label>Nachname<input name="nachname" autocomplete="family-name" maxlength="60" required></label>
      <label>E-Mail<input name="email" type="email" autocomplete="email" maxlength="160" required></label>
      <label>Handy<input name="telefon" type="tel" autocomplete="tel" maxlength="30" required></label>
    </div>
    <details class="info"><summary>Datenschutz und Storno</summary>
      <p>Wir speichern Name, E-Mail und Handynummer nur für diese Buchung: für die Bestätigung mit dem Zugangscode, für Rückfragen und für die Buchhaltung des Vereins. Bezahlt wird über PayPal; dabei gelten die Datenschutzhinweise von PayPal. Kontaktdaten löschen wir auf der Buchungsseite 30 Tage nach dem Termin.</p>
      <p>Stornieren mit Erstattung geht über den Link in der Bestätigung bis ${esc(lage.regeln.storno_stunden)} Stunden vor Beginn.</p>
      ${hinweis ? `<p>${esc(hinweis).replace(/\n/g, '<br>')}</p>` : ''}
    </details>
    <label class="ja"><input type="checkbox" name="zustimmung"> Ich habe die Hinweise zu Datenschutz und Storno gelesen.</label>
    <div id="mensch" class="mensch"></div>
    <p class="fehler" id="fehler" role="alert" hidden></p>
    <h2 class="sec">4 · Bezahlen</h2>
    <div id="zahlen" class="zahlen"></div>
  </form>
</section>`;
}

const STATUS = {
  reserviert: ['a', 'Zahlung läuft', 'Die Zeit ist für dich reserviert. Bitte schließe die Zahlung ab.'],
  bezahlt: ['g', 'Bezahlt', 'Danke! Die Bestätigung mit dem Code fürs Tor schicken wir dir per E-Mail, sobald der Verein die Buchung übernommen hat – meist innerhalb weniger Minuten.'],
  vorlaeufig: ['a', 'Zahlung in Prüfung', 'PayPal prüft die Zahlung noch. Die Zeit ist für dich reserviert; die Bestätigung mit dem Code kommt, sobald die Zahlung durch ist.'],
  abgelehnt: ['r', 'Nicht gebucht', 'Die Zahlung wurde nicht abgeschlossen. Es wurde nichts abgebucht.'],
  abgelaufen: ['r', 'Nicht gebucht', 'Die Reservierung ist abgelaufen. Es wurde nichts abgebucht.'],
  storno_angefragt: ['a', 'Storno läuft', 'Die Buchung ist storniert, die Erstattung wird gerade veranlasst.'],
  erstattung_laeuft: ['a', 'Erstattung läuft', 'Die Buchung ist storniert. Die Erstattung läuft – das kann bei PayPal ein paar Minuten dauern.'],
  erstattet: ['n', 'Storniert', 'Die Buchung ist storniert und das Geld erstattet.'],
  erstattung_fehler: ['r', 'Bitte Verein kontaktieren', 'Bei dieser Zahlung ist etwas nicht in Ordnung. Der Verein ist informiert und meldet sich bei dir.'],
};

export function bestaetigung(bk, { token, stornoMoeglich, frist, meldung, stunden }) {
  const [ton, titel, text] = STATUS[bk.status] || ['n', bk.status, ''];
  const eingetragen = bk.status === 'bezahlt' && bk.verein === 'eingetragen';
  const belegt = bk.verein === 'belegt';
  const fristTxt = new Date(frist).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${meldung ? `<div class="hinweis ok" role="status">${esc(meldung)}</div>` : ''}
<section class="karte bestaetigt">
  <p class="marke ${ton}">${esc(titel)}</p>
  <h2>${esc(bk.platz_name)}</h2>
  <p class="wann num">${esc(wtag(bk.datum))}, ${esc(deD(bk.datum))} · ${esc(bk.beginn)}–${esc(bk.ende)} Uhr</p>
  <dl><dt>Buchungsnummer</dt><dd class="num">${esc(bk.ref)}</dd><dt>Betrag</dt><dd class="num">${esc(euro(bk.betrag))}</dd>${bk.nachname ? `<dt>Name</dt><dd>${esc(bk.vorname)} ${esc(bk.nachname)}</dd>` : ''}</dl>
  <p>${belegt ? 'Leider war der Platz zu dieser Zeit inzwischen vergeben. ' + (bk.status === 'abgelehnt' ? 'Es wurde nichts abgebucht.' : 'Das Geld wird erstattet.') : eingetragen ? 'Gebucht. Die E-Mail mit dem Code fürs Tor ist unterwegs.' : esc(text)}</p>
  ${stornoMoeglich ? `<form method="post" action="/buchung/${esc(bk.ref)}/storno" class="storno"><input type="hidden" name="t" value="${esc(token)}">
    <p class="klein">Stornieren mit Erstattung ist bis ${esc(fristTxt)} Uhr möglich (${esc(stunden)} Stunden vor Beginn).</p>
    <button class="knopf leise" type="submit" data-frage="Buchung wirklich stornieren? Das Geld wird erstattet.">Buchung stornieren</button></form>` : ''}
  <p class="klein">Bewahre diesen Link auf – damit siehst du den Stand deiner Buchung.</p>
  <p><a class="knopf" href="/" target="_self">Weitere Zeit buchen</a></p>
</section>`;
}

export function fehlerSeite(text, neu = false) {
  return `<section class="karte"><p>${esc(text)}</p>${neu ? '<p><a class="knopf" href="/">Neue Zeit wählen</a></p>' : ''}</section>`;
}
