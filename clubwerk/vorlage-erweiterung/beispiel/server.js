'use strict';
/* Server-Teil einer Erweiterung. activate(ctx) wird beim Start einmal aufgerufen.
   ctx.tablet  – Router unter /api/tablet/x/<id>/…  (ohne Anmeldung, Passwortschutz der Buchungsseite gilt)
   ctx.admin   – Router unter /api/admin/x/<id>/…   (nur angemeldete Admins; Rechte mit ctx.need('recht'))
   ctx.db, ctx.getSetting/setSetting, ctx.audit, ctx.bad, ctx.int, ctx.cleanName, ctx.rateLimit, ctx.nowTs
   ctx.isActive() – ist die Erweiterung gerade eingeschaltet? (z. B. für Hintergrundaufgaben)
   ctx.hooks.tabletVisible = () => true|false – Link am Tablet nur zeigen, wenn sinnvoll
   ctx.require('exceljs' | 'pdfkit' | 'nodemailer' | …) – Bibliotheken von Clubwerk mitbenutzen */
exports.activate = ctx => {
  const { db, need, bad, cleanName } = ctx;
  db.exec('CREATE TABLE IF NOT EXISTS beispiel_notizen (id INTEGER PRIMARY KEY, text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime(\'now\',\'localtime\')))');

  ctx.tablet.get('/notizen', (req, res) => res.json(db.prepare('SELECT * FROM beispiel_notizen ORDER BY id DESC LIMIT 20').all()));

  ctx.admin.get('/notizen', need('beispiel'), (req, res) => res.json(db.prepare('SELECT * FROM beispiel_notizen ORDER BY id DESC').all()));
  ctx.admin.post('/notizen', need('beispiel'), (req, res) => {
    const text = cleanName((req.body || {}).text, 200);
    if (!text) return bad(res, 'Bitte einen Text eintragen.');
    db.prepare('INSERT INTO beispiel_notizen(text) VALUES (?)').run(text);
    ctx.audit(req.user, 'Beispiel: Notiz angelegt', text);
    res.json({ ok: true });
  });
};
