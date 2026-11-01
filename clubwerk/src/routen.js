'use strict';
/* Nur für Tests (Testreihe rmatrix): Mit CW_TEST_ROUTEN=<datei> schreibt der Server nach dem Start alle Adressen je Port
   in diese Datei – Pfad, Methoden und die Rechte aus auth.need(). So prüft der Test jede Adresse, auch neue.
   Ohne die Umgebungsvariable wird diese Datei nie geladen. */
const fs = require('fs');
const Router = require('router');

// Express merkt sich den Pfad von use() nicht – hier am Eintrag festhalten
const use0 = Router.prototype.use;
Router.prototype.use = function use(...a) {
  const n = this.stack.length;
  use0.apply(this, a);
  let p = a[0]; while (Array.isArray(p)) p = p[0];
  for (let i = n; i < this.stack.length; i++) this.stack[i].cwPath = typeof p === 'function' ? '/' : p;
  return this;
};

const ports = [], extras = [];
/** Router, die nicht im Express-Stapel hängen, sondern von Hand aufgerufen werden (Bereiche der Module in der Mitglieder-App) */
function extra(label, prefix, router) { if (router) extras.push({ label, prefix, router }); }
/** von tls.listen aufgerufen: welches Programm auf welchem Port läuft */
let timer = null;
function app(a, port, label) {
  ports.push({ a, port: Number(port), label });
  clearTimeout(timer); timer = setTimeout(() => dump(process.env.CW_TEST_ROUTEN), 1500);   // Module melden ihre Adressen beim Start nach und nach an
}

const join = (a, b) => (a.replace(/\/$/, '') + '/' + String(b).replace(/^\//, '')).replace(/\/+$/, '') || '/';
function walk(stack, prefix, inherited, out) {
  for (const l of stack || []) {
    const mw = l.route ? [] : [l.handle];
    if (l.route) {
      const perms = [...inherited]; let need = inherited.length > 0;
      for (const s of l.route.stack) if (s.handle && s.handle.cwPerms) { perms.push(...s.handle.cwPerms); need = true; }
      const paths = Array.isArray(l.route.path) ? l.route.path : [l.route.path];
      for (const p of paths) if (typeof p === 'string') out.push({ path: join(prefix, p), methods: Object.keys(l.route.methods).filter(m => l.route.methods[m]).map(m => m.toUpperCase()), perms: [...new Set(perms)], need });
    } else if (l.handle && Array.isArray(l.handle.stack)) {
      walk(l.handle.stack, join(prefix, l.cwPath || '/'), inherited, out);
    } else if (mw[0] && mw[0].cwPerms && (l.cwPath || '/') === '/') {
      inherited = [...inherited, ...mw[0].cwPerms];   // use(need(…)) ohne Pfad gilt für alles, was danach in diesem Router kommt
    }
  }
}
function dump(file) {
  const out = ports.map(({ a, port, label }) => { const routes = []; walk((a.router || a._router || {}).stack, '', [], routes); for (const x of extras) if (x.label === label) walk(x.router.stack, x.prefix, [], routes); return { port, label, routes }; });
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
}
module.exports = { app, extra, dump };
