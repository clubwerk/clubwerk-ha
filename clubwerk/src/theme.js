/* ---------- Vereinsfarbe → Farbwerte für alle Oberflächen (theme.css) ----------
   Aus Haupt- und optionaler Zweitfarbe entstehen alle Abstufungen für hell, dunkel und „Hoher Kontrast“.
   Der Kontrast wird dabei sichergestellt: Text in Vereinsfarbe hat auf allen Flächen mindestens 4,5 : 1 (Hoher Kontrast 7 : 1) –
   zu helle Farben werden für Text abgedunkelt, im dunklen Modus aufgehellt. Die Rohfarbe (--club) dient nur als Schmuck.
   Die Flächenfarben hier müssen zu den Tokens in public/style.css passen. */
const FL = {   // muted: gedämpfter Text (--muted) – er bleibt auch auf dem Schimmer lesbar
  light: { bg: '#f2f3ef', card: '#ffffff', hover: '#eff2ed', muted: '#56625a' },
  dark: { bg: '#0e1310', card: '#161d19', hover: '#1d2620', muted: '#a7b2aa' },
  hcLight: { bg: '#ffffff', card: '#ffffff', hover: '#eceeea', muted: '#2b322d' },
  hcDark: { bg: '#000000', card: '#0b0e0c', hover: '#1b211d', muted: '#dde3df' },
};
const INK = '#131a16', DARK_INK = '#0e1310';

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/** Farbe mischen: t = Anteil des Ziels (0 = Farbe, 1 = Ziel) */
const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const lum = h => { const v = rgb(h).map(x => x / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Farbe schrittweise Richtung „toward“ (Schwarz/Weiß) schieben, bis sie auf allen Flächen den Mindestkontrast erreicht */
function ensure(c, bgs, min, toward) {
  for (let t = 0; t <= 1.0001; t += 0.02) { const x = mix(c, toward, Math.min(1, t)); if (bgs.every(b => contrast(x, b) >= min)) return x; }
  return toward;
}

function vars(c, c2, mode) {
  const dark = mode === 'dark' || mode === 'hcDark', hc = mode === 'hcLight' || mode === 'hcDark';
  const f = FL[mode], min = hc ? 7 : 4.5, away = dark ? '#ffffff' : '#000000';
  // Schimmer: kaum sichtbar – so zurückgenommen, dass gedämpfter Text darauf mindestens 4,5 : 1 behält
  const calm = g => { for (let t = 0; t <= 1.0001; t += 0.02) { const x = mix(g, f.bg, Math.min(1, t)); if (contrast(x, f.muted) >= 4.6) return x; } return f.bg; };
  const glow1 = calm(mix(c, f.bg, dark ? 0.86 : 0.84)), glow2 = calm(c2 ? mix(c2, f.bg, dark ? 0.88 : 0.86) : mix(c, f.bg, dark ? 0.93 : 0.92));
  const soft = dark ? mix(c, f.bg, hc ? 0.84 : 0.78) : mix(c, '#ffffff', 0.88);
  const surfaces = [f.bg, f.card, f.hover, ...(hc ? [] : [glow1, glow2])];
  let brand = ensure(dark ? mix(c, '#ffffff', 0.08) : c, surfaces, min, away);
  // Schrift auf der Vereinsfarbe: hell → weiß, dunkel → fast schwarz; reicht es nicht, wird die Fläche weiter verschoben
  let onBrand = dark ? DARK_INK : '#ffffff';
  if (contrast(onBrand, brand) < min) brand = ensure(brand, [onBrand], min, away);
  const brandInk = ensure(dark ? mix(c, '#ffffff', 0.55) : mix(c, '#000000', 0.3), [soft, ...surfaces], min, away);
  // Hauptkarte: dunkle Fläche in Vereinsfarbe mit sanftem Verlauf, weiße Schrift (auch die gedämpfte) bleibt überall lesbar
  const heroB = ensure(dark ? mix(c, '#000000', 0.25) : c, ['#ffffff'], dark ? 7.5 : 6.5, '#000000');
  const heroA = mix(heroB, '#000000', 0.35), heroC = ensure(mix(heroB, '#ffffff', 0.08), ['#ffffff'], 5.6, '#000000');
  let heroMuted = mix('#ffffff', heroB, 0.3);
  for (let t = 0.3; t > 0 && contrast(heroMuted, heroC) < 4.6; t -= 0.02) heroMuted = mix('#ffffff', heroB, t);
  const accent = c2 ? ensure(dark ? mix(c2, '#ffffff', 0.08) : c2, surfaces, min, away) : brand;
  return {
    club: c, brand, 'on-brand': onBrand, 'brand-ink': brandInk, 'brand-soft': soft, 'brand-hover': mix(brand, away, 0.16),
    accent, 'accent-soft': c2 ? (dark ? mix(c2, f.bg, 0.8) : mix(c2, '#ffffff', 0.88)) : soft,
    'hero-a': heroA, 'hero-b': heroB, 'hero-c': heroC, 'on-hero': '#ffffff', 'on-hero-muted': heroMuted,
    'glow-1': glow1, 'glow-2': glow2,
    // ältere Namen, die Module noch verwenden
    green: brand, 'green-dark': brandInk, 'green-soft': soft, 'green-over': dark ? mix(c, f.bg, 0.66) : mix(c, '#ffffff', 0.8),
    'green-line': dark ? mix(c, f.bg, 0.55) : mix(c, '#ffffff', 0.68), 'green-muted': dark ? mix(c, f.bg, 0.35) : mix(c, '#ffffff', 0.45),
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
/** theme.css für Haupt- und Zweitfarbe (#rrggbb; Zweitfarbe leer = keine) */
function themeCss(c, c2) {
  c = HEX.test(c || '') ? c.toLowerCase() : '#1f6b3a';
  c2 = HEX.test(c2 || '') ? c2.toLowerCase() : '';
  const css = o => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(';');
  return `:root{${css(vars(c, c2, 'light'))}}:root[data-theme="dark"]{${css(vars(c, c2, 'dark'))}}`
    + `:root[data-contrast="hoch"]{${css(vars(c, c2, 'hcLight'))}}:root[data-theme="dark"][data-contrast="hoch"]{${css(vars(c, c2, 'hcDark'))}}`;
}

module.exports = { themeCss, vars, contrast, mix, FL };
