'use strict';
/* Vereinsfarbe (theme.css), Vereinslogo, Symbole für Home-Bildschirm und Manifest, Branding für Tablet und Verwaltung.
   Aus server.js ausgelagert: die Helfer kommen von dort (h), der Aufruf steht an derselben Stelle, die Reihenfolge der Adressen bleibt. */
const path = require('path');
const fs = require('fs');
const { getSetting, clubColor } = require('./db');
module.exports = function logoRouten(h) {
  const {
    app, isDemo
  } = h;
  /* ---------- Vereinsfarbe (Berechnung der Abstufungen und des Kontrasts: src/theme.js) ---------- */
  const theme = require('./theme');
  /* Darstellung am Tablet (Einstellungen › Tablet): wie das Gerät oder vom Verein festgelegt – hell, dunkel, Hoher Kontrast */
  const TABLET_THEMES = ['auto', 'light', 'dark', 'hc'];
  const tabletTheme = () => { const t = getSetting('tablet_theme', 'auto'); return TABLET_THEMES.includes(t) ? t : 'auto'; };
  const clubColor2 = () => { const c = getSetting('club_color2', ''); return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : ''; };
  /* ?vorschau=rrggbb[&vorschau2=rrggbb]: dieselbe Berechnung für eine andere Farbe (Design-Prüfstand) – öffentlich wie theme.css selbst */
  app.get('/theme.css', (req, res) => {
    const q = k => (typeof req.query[k] === 'string' && /^[0-9a-f]{6}$/i.test(req.query[k]) ? '#' + req.query[k] : null);
    const pv = q('vorschau');
    res.type('text/css').set('Cache-Control', 'no-cache').send(pv ? theme.themeCss(pv, q('vorschau2') || '') : theme.themeCss(clubColor(), clubColor2()));
  });
  app.get('/icon.svg', (req, res) => {
    // Vereinslogo als Symbol, sofern es ein SVG ist – sonst das Clubwerk-Symbol in Vereinsfarbe
    const l = logoInfo();
    let svg;
    if (l && l.type === 'svg') svg = l.custom ? Buffer.from(getSetting('club_logo', ''), 'base64').toString('utf8') : fs.readFileSync(DEFAULT_LOGO, 'utf8');
    else svg = fs.readFileSync(path.join(__dirname, '..', 'public', 'icon.svg'), 'utf8').replace(/#1f6b3a/gi, clubColor())
      .replace(/#e8f2ea/gi, theme.vars(clubColor(), '', 'light')['brand-soft']);
    res.type('image/svg+xml').set({ 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" }).send(svg);
  });

  /* ---------- Vereinslogo (liegt in der Datenbank → steckt in jeder Sicherung) ---------- */
  const LOGO_TYPES = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
  const DEFAULT_LOGO = path.join(__dirname, '..', 'public', 'vereinslogo.svg');
  function logoInfo() {
    const type = getSetting('club_logo_type');
    if (type && LOGO_TYPES[type]) return { type, ver: getSetting('club_logo_ver', '1'), custom: true };
    if (fs.existsSync(DEFAULT_LOGO)) return { type: 'svg', ver: 'std', custom: false };
    return null;
  }
  const logoUrl = () => { const l = logoInfo(); return l ? `vereinslogo?v=${encodeURIComponent(l.ver)}` : null; };
  /** Erkennt das Bildformat am Inhalt; SVGs werden auf gefährliche Bestandteile geprüft und bereinigt. */
  function checkLogo(buf) {
    if (!buf || !buf.length) return { error: 'Keine Datei empfangen.' };
    if (buf.length > 2 * 1024 * 1024) return { error: 'Das Logo ist zu groß (max. 2 MB).' };
    const t = require('./util').imageType(buf);
    if (t === 'png' || t === 'jpg' || t === 'webp') return { type: t, data: buf };
    let s = buf.toString('utf8').replace(/^﻿/, '');
    if (!/<svg[\s>]/i.test(s)) return { error: 'Bitte ein Logo als SVG, PNG, JPG oder WebP hochladen.' };
    if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(s)) return { error: 'SVG mit eingebetteten Definitionen wird nicht angenommen.' };
    if (/<\s*(script|foreignObject|iframe|embed|object|audio|video|handler|listener)\b/i.test(s)) return { error: 'Das SVG enthält Skripte oder eingebettete Inhalte – bitte eine einfache SVG-Datei verwenden.' };
    // auch versteckte Varianten ablehnen: Zeichen-Codes (&#…), Namensräume (svg:script), Animation von Verweisen
    if (/&#|\bscript\b|<\s*[\w-]+:(script|foreignObject|iframe|embed|object|handler|listener)\b|attributeName\s*=\s*["']?\s*(xlink:)?href/i.test(s)) return { error: 'Das SVG enthält Skripte oder versteckte Inhalte – bitte eine einfache SVG-Datei verwenden (oder PNG).' };
    s = s.replace(/<\?xml[^>]*\?>/gi, '').replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')                       // Ereignis-Attribute
      .replace(/\s(?:xlink:)?href\s*=\s*("|')\s*(?!#|data:image\/(?:png|jpe?g|gif|webp);)[^"']*\1/gi, '') // nur interne Verweise
      .replace(/url\(\s*(['"]?)\s*(?!#)[^)]*\)/gi, 'none')                                  // keine externen CSS-Quellen
      .replace(/@import[^;]*;?/gi, '');
    if (/javascript:/i.test(s)) return { error: 'Das SVG enthält Skripte – bitte eine einfache SVG-Datei verwenden.' };
    return { type: 'svg', data: Buffer.from(s.trim(), 'utf8') };
  }
  app.get('/vereinslogo', (req, res) => {
    const l = logoInfo();
    if (!l) return res.status(404).end();
    const data = l.custom ? Buffer.from(getSetting('club_logo', ''), 'base64') : fs.readFileSync(DEFAULT_LOGO);
    res.set({ 'Content-Type': LOGO_TYPES[l.type], 'Cache-Control': req.query.v ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:", 'Content-Disposition': 'inline' });
    res.send(data);
  });
  /* Symbol für Home-Bildschirm/Manifest: aus dem Logo erzeugtes PNG, sonst ein PNG/JPG-Logo, sonst das Standard-Symbol */
  /* Symbol neu zeichnen, wenn sich Logo, Vereinsfarbe oder die Gestaltung (ICON_DESIGN) ändern */
  const ICON_DESIGN = '2';   // 2: Vereinsfarbe als Hintergrund, Logo groß mit schmalem weißem Rahmen
  const iconKey = () => `${getSetting('club_logo_ver', 'std')}:${clubColor()}:${ICON_DESIGN}`;
  const iconFresh = () => Boolean(getSetting('club_icon', '')) && getSetting('club_icon_ver', '') === iconKey();
  /* Rundes Symbol für Android („maskable“, planung/leitfaeden-2.md): Hintergrund randlos, Logo ganz im Kreis mit 80 % Durchmesser
     (Sicherheitszone) – Android schneidet rund, als Tropfen oder abgerundetes Quadrat zu. Erzeugt wie das normale Symbol (admin.js). */
  const maskFresh = () => Boolean(getSetting('club_icon_mask', '')) && getSetting('club_icon_mask_ver', '') === iconKey();
  const sendIcon = (res, mask) => {
    res.set('Cache-Control', 'no-cache');
    if (mask && maskFresh()) return res.type('image/png').send(Buffer.from(getSetting('club_icon_mask', ''), 'base64'));
    if (iconFresh()) return res.type('image/png').send(Buffer.from(getSetting('club_icon', ''), 'base64'));   // maskable noch nicht erzeugt: lieber Vereinsbild als fremdes
    const l = logoInfo();
    if (l && l.custom && (l.type === 'png' || l.type === 'jpg')) return res.type(LOGO_TYPES[l.type]).send(Buffer.from(getSetting('club_logo', ''), 'base64'));
    res.sendFile(path.join(__dirname, '..', 'public', mask ? 'icon-maskable-512.png' : 'icon-512.png'));
  };
  app.get('/vereinsicon.png', (req, res) => sendIcon(res, false));
  app.get('/vereinsicon-maskable.png', (req, res) => sendIcon(res, true));
  /* Tablet-Manifest mit dem Namen des Vereins (Whitelabel: auf dem Tablet erscheint der Verein, nicht das Produkt) */
  app.get('/manifest.webmanifest', (req, res) => {
    const club = getSetting('club_name', process.env.CLUB_NAME || 'Verein');
    res.set('Cache-Control', 'no-cache').type('application/manifest+json').send(JSON.stringify({
      name: club, short_name: club.length > 14 ? club.slice(0, 14) : club, start_url: './', scope: './', display: 'fullscreen', orientation: 'landscape',
      background_color: '#f6f5f1', theme_color: clubColor(),
      icons: [{ src: 'vereinsicon.png', sizes: '512x512', type: 'image/png' }, { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        { src: 'vereinsicon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] }));
  });
  app.get('/api/branding', (req, res) => {
    const l = logoInfo();
    res.json({ clubName: getSetting('club_name', process.env.CLUB_NAME || 'Unser Verein'), color: clubColor(), logo: logoUrl(), tabletTheme: tabletTheme(), demo: isDemo() || undefined, iconNeeded: Boolean(l) && (!iconFresh() || !maskFresh() || (l.type === 'svg' && getSetting('club_logo_png_ver', '') !== getSetting('club_logo_ver', 'std'))) });
  });
  return { checkLogo, clubColor2, iconKey, logoInfo, logoUrl, TABLET_THEMES, tabletTheme };
};
