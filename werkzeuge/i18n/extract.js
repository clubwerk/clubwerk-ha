// Extrahiert alle deutschen Oberflächentexte aus Clubwerk → clubwerk/sprachen/katalog.json (+ werkzeuge/i18n/ausgabe/katalog-quellen.json: wo jeder Text steht)
// Aufruf: (einmal: npm ci im Ordner werkzeuge/i18n)  node werkzeuge/i18n/extract.js
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const Core = require(path.join(__dirname, '..', '..', 'clubwerk', 'public', 'i18n-core.js'));
const APP = process.argv[2] || path.join(__dirname, '..', '..', 'clubwerk');
const OUT = process.argv[3] || path.join(APP, 'sprachen');

const SKIP_FILES = /(i18n-core|i18n-dom|artikel-icons|articleicons|sw)\.js$|node_modules|vorlage-erweiterung|\/data\//;
const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|\.git|^data$/.test(e.name)) walk(f); } else if (/\.(js|html)$/.test(e.name) && !SKIP_FILES.test(f)) files.push(f); } };
for (const d of ['public', 'src', 'erweiterungen']) walk(path.join(APP, d));

const found = new Map();
// kleine Wörter, die allein auf der Oberfläche stehen (sonst nicht von Schlüsseln zu unterscheiden)
const EXTRA = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'extra.json'), 'utf8')));   // key -> Set(file:line)
const M = '\u0001';
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&shy;': '', '&hellip;': '…', '&middot;': '·', '&ndash;': '–', '&mdash;': '—', '&rarr;': '→', '&larr;': '←', '&times;': '×', '&euro;': '€', '&bdquo;': '„', '&ldquo;': '“' };
const decode = s => s.replace(/&[a-z#0-9]+;/gi, m => (ENT[m] !== undefined ? ENT[m] : /^&#\d+;$/.test(m) ? String.fromCharCode(+m.slice(2, -1)) : m));

function looksText(t) {
  const lit = t.replace(/\{\d+\}/g, ' ');
  if (!/[A-Za-zÄÖÜäöüß]{2,}/.test(lit)) return false;
  if (/^(https?:|mailto:|data:|\/\/|\.\/|\.\.\/|#|api\/|\/api)/.test(t)) return false;
  if (/^[\w.\-\/]+\.(js|css|png|svg|json|html|db|pem|yaml|xlsx|pdf|zip|woff2)$/i.test(t)) return false;
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|WHERE|FROM \w+ WHERE|PRAGMA|COALESCE)\b/.test(t)) return false;
  if (/^[a-z-]+:\s*[^ ]+;?$/.test(t) && !/[äöüß]/.test(t)) return false;
  if (/(var\(--|px\b|;\s*[a-z-]+:|rgba?\(|#[0-9a-f]{3,6}\b|^\.[a-z]|=>|\(\)|\$\{)/i.test(t) && !/[äöüß]/i.test(t)) return false;
  if (!/\{\d+\}/.test(t) && /^[a-z][a-z0-9_\-.:\/]*$/.test(lit.trim()) && !/[äöüß]/.test(lit) && !EXTRA.has(t)) return false;     // Schlüssel, Klassen, IDs
  if (/^[A-Z0-9_\-]+$/.test(lit.trim()) && lit.trim().length > 1 && !/^(OK|PIN|PDF|IBAN|BIC|QR|ZIP|HTTPS?|E-Mail)$/.test(lit.trim())) return false;   // KONSTANTEN
  if (/^[a-z]+[A-Z]\w*$/.test(lit.trim())) return false;                                      // camelCase
  if (/^[\w-]+(\s+[\w-]+)*$/.test(t) && /^(btn|row|card|muted|banner|f |s |pill|chip|tag|on|off|hidden|sel|ok|err|warn)\b/.test(t)) return false;  // CSS-Klassenlisten
  if (t.length > 1500) return false;
  const tt = t.trim();
  if (/^(\/|\[|--|;|\.\w|link\[|:root)/.test(tt)) return false;                 // Pfade, Selektoren, CSS
  if (/\{(?!\d+\}|[a-zA-Z_]\w*\})/.test(tt) || /\^=|\$=|\*=/.test(tt)) return false;            // Code-Fragmente
  if (!/\s/.test(tt) && /[\/?=&]/.test(tt) && !/^[A-ZÄÖÜ][a-zäöüß]+\/[A-ZÄÖÜ]?[a-zäöüß]+$/.test(tt)) return false;
  if (/^\{\d+\}[\/._-]/.test(tt) && !/\s/.test(tt)) return false;
  if (!/\s/.test(tt)) {
    if (/^-/.test(tt) || /[\[\]@]|\.\*|\(|_/.test(tt) || /\{\d+\}/.test(tt)) return false;
    if (/\d/.test(tt) && /^[\w.\-:]+$/.test(tt) && !/^[A-ZÄÖÜ]/.test(tt)) return false;
    if (/^(Cache-Control|Content-Disposition|Content-Security-Policy|Content-Type|Cross-Origin-Opener-Policy|Cross-Origin-Resource-Policy|Permissions-Policy|Referrer-Policy|Set-Cookie|Strict-Transport-Security|X-Content-Type-Options|X-Frame-Options|Helvetica|Helvetica-Bold|Europe\/Berlin|de-DE|Bearer|Basic|None|Image|Icon|Submit|Settings|Permissions|CHANGELOG\.md|Dockerfile|Mac|SHA256:)$/.test(tt)) return false;
  }
  return true;
}
function add(raw, where) {
  // Zeilen einzeln (E-Mails, Meldungen) und als Ganzes
  const parts = raw.includes('\n') ? raw.split('\n') : [raw];
  for (const p of parts) addOne(p, where);
}
function addOne(raw, where) {
  let n = 0; const map = new Map();
  let t = raw.replace(new RegExp(M + '(\\d+)' + M, 'g'), (m, i) => { if (!map.has(i)) map.set(i, n++); return '{' + map.get(i) + '}'; });
  t = Core.norm(t);
  // nur Platzhalter an den Rändern mit Satzzeichen? → trotzdem behalten
  if (!t || !looksText(t)) return;
  if (!found.has(t)) found.set(t, new Set());
  found.get(t).add(where);
}
/** HTML-artigen Text in Textstücke + Attributwerte zerlegen */
function splitHtml(s, where) {
  if (!/[<>]/.test(s)) { add(decode(s), where); return; }
  const re = /<(script|style)[\s\S]*?<\/\1>|<!--[\s\S]*?-->|<[^>]*>|([^<]+)/gi;
  let m;
  while ((m = re.exec(s))) {
    if (m[2] !== undefined) { add(decode(m[2]), where); continue; }
    const tag = m[0];
    if (/^<(script|style)/i.test(tag) || /^<!--/.test(tag)) continue;
    const ar = /\s(placeholder|title|aria-label|alt|data-tip|value)\s*=\s*("([^"]*)"|'([^']*)')/gi; let a;
    while ((a = ar.exec(tag))) { if (a[1].toLowerCase() === 'value' && !/type\s*=\s*["']?(button|submit|reset)/i.test(tag)) continue; add(decode(a[3] !== undefined ? a[3] : a[4]), where); }
  }
}
/** Kann ein Ausdruck HTML liefern? (Tags, Symbole, Listen) → dann teilt er den Text im Browser in mehrere Stücke */
const HTML_FN = /^(icon|ti|navBtn|pill|okPill|bar|opt|kTable|svg|ArtIcons\.svg|badge|chip|btn|row|cell|th|td|link|esc2|nl2br|mdLite|stageView|pName|fmtIcon|tick|ic)$/;
function mayHtml(n) {
  let yes = false;
  const visit = x => {
    if (!x || yes || typeof x !== 'object') return;
    if (x.type === 'StringLiteral' && /<[a-z\/!]/i.test(x.value)) { yes = true; return; }
    if (x.type === 'TemplateElement' && /<[a-z\/!]/i.test(x.value.cooked || x.value.raw)) { yes = true; return; }
    if (x.type === 'CallExpression') {
      const c = x.callee; const nm = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? (c.property.name || '') : '';
      const full = c.type === 'MemberExpression' && c.object.type === 'Identifier' ? c.object.name + '.' + nm : nm;
      if (HTML_FN.test(nm) || HTML_FN.test(full) || nm === 'join') { yes = true; return; }
    }
    for (const k of Object.keys(x)) { if (k === 'loc' || k === 'start' || k === 'end') continue; const v = x[k]; if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === 'string') visit(v); }
  };
  visit(n);
  return yes;
}
function tplString(node, split) {
  let s = '';
  node.quasis.forEach((q, i) => { s += q.value.cooked == null ? q.value.raw : q.value.cooked; if (i < node.expressions.length) s += split && mayHtml(node.expressions[i]) ? '<x>' : M + i + M; });
  return s;
}
function skipContext(p) {
  const par = p.parent;
  if (!par) return false;
  if ((par.type === 'ObjectProperty' || par.type === 'ObjectMethod' || par.type === 'ClassProperty') && par.key === p.node && !par.computed) return true;
  if (par.type === 'MemberExpression' && par.property === p.node) return true;
  if (par.type === 'ImportDeclaration' || par.type === 'ExportNamedDeclaration') return true;
  if (par.type === 'CallExpression') {
    const c = par.callee;
    const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? ((c.object.name || (c.object.property && c.object.property.name) || '') + '.' + (c.property.name || '')) : '';
    if (/^(require|console\.(log|error|warn|info)|db\.prepare|db\.exec|\.prepare|\.exec|\.querySelector|\.querySelectorAll|\.getElementById|\$|addEventListener|\.addEventListener|\.setAttribute|\.getAttribute|\.closest|\.matches|getSetting|setSetting|addColumn|\.toggle|\.add|\.remove|\.contains|\.getItem|\.setItem|\.removeItem|sget|sset|fetch|api|icon|ArtIcons\.svg|\.createElement|\.get|\.set|\.has|\.split|\.join|\.replace|\.startsWith|\.endsWith|\.includes|\.indexOf|\.padStart|\.toLocaleString|\.toLocaleDateString|\.type|res\.type|res\.set|\.status|\.header|r\.headers\.get|req\.get|\.append|\.on|spawn|execFile|\.slice|\.json)$/.test(name) && p.listKey === 'arguments') {
      // Ausnahme: Texte in ask/alert/toast/bad/Error → bleiben (stehen nicht in dieser Liste)
      return true;
    }
    if (/\.prepare$|\.exec$|^db\./.test(name)) return true;
  }
  if (par.type === 'BinaryExpression' && /^(===|!==|==|!=|in|instanceof)$/.test(par.operator)) return true;
  if (par.type === 'SwitchCase') return true;
  return false;
}
/** a + 'x' + b → „{0}x{1}“ (zusätzlich zu den Einzelteilen) */
function concat(node, code) {
  const ops = [];
  const flat = n => { if (n.type === 'BinaryExpression' && n.operator === '+') { flat(n.left); flat(n.right); } else ops.push(n); };
  flat(node);
  if (!ops.some(o => o.type === 'StringLiteral' || o.type === 'TemplateLiteral')) return null;
  let s = '', i = 0;
  for (const o of ops) {
    if (o.type === 'StringLiteral') s += o.value;
    else if (o.type === 'TemplateLiteral') { let t = ''; o.quasis.forEach((q, k) => { t += q.value.cooked == null ? q.value.raw : q.value.cooked; if (k < o.expressions.length) t += M + (i++) + M; }); s += t; }
    else s += M + (i++) + M;
  }
  return s;
}

for (const f of files) {
  const rel = path.relative(APP, f);
  const src = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.html')) {
    const body = src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '');
    splitHtml(body, rel);
    continue;
  }
  let ast;
  try { ast = parser.parse(src, { sourceType: 'script', errorRecovery: true, plugins: [] }); } catch (e) { console.error('PARSE', rel, e.message); continue; }
  traverse(ast, {
    StringLiteral(p) {
      if (p.parent.type === 'BinaryExpression' && p.parent.operator === '+') { /* via concat */ }
      if (skipContext(p)) return;
      if (p.parent.type === 'Directive' || p.parent.type === 'DirectiveLiteral') return;
      splitHtml(p.node.value, rel + ':' + p.node.loc.start.line);
    },
    TemplateLiteral(p) {
      if (p.parent.type === 'TaggedTemplateExpression') return;
      if (skipContext(p)) return;
      const w = rel + ':' + p.node.loc.start.line;
      splitHtml(tplString(p.node, false), w);
      if (p.node.expressions.some(mayHtml)) splitHtml(tplString(p.node, true), w);
    },
    BinaryExpression(p) {
      if (p.node.operator !== '+' || (p.parent.type === 'BinaryExpression' && p.parent.operator === '+')) return;
      const s = concat(p.node); if (s) splitHtml(s, rel + ':' + p.node.loc.start.line);
    },
  });
}
// erweiterung.json
for (const d of fs.readdirSync(path.join(APP, 'erweiterungen'))) {
  const f = path.join(APP, 'erweiterungen', d, 'erweiterung.json'); if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, 'utf8')); const w = 'erweiterungen/' + d + '/erweiterung.json';
  const vals = [j.name, j.beschreibung, ...(j.perms ? Object.values(j.perms) : []), j.tablet && j.tablet.label, j.verwaltung && j.verwaltung.label, j.mitgliederApp && j.mitgliederApp.label].filter(Boolean);
  for (const v of vals) add(v, w);
}
for (const e of EXTRA) if (!found.has(e)) found.set(e, new Set(['zusatz']));
const keys = [...found.keys()].sort((a, b) => a.localeCompare(b, 'de'));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'katalog.json'), JSON.stringify({ _info: 'Alle deutschen Originaltexte von Clubwerk (automatisch erzeugt). Nicht von Hand bearbeiten.', strings: keys }, null, 1));
fs.mkdirSync(path.join(__dirname, 'ausgabe'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'ausgabe', 'katalog-quellen.json'), JSON.stringify(Object.fromEntries(keys.map(k => [k, [...found.get(k)].slice(0, 3)])), null, 1));
console.log('Texte:', keys.length, 'Muster:', keys.filter(k => /\{\d+\}/.test(k)).length);
