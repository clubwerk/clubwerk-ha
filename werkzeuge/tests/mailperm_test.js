// BUG-1: Rechte-Migration „E-Mail“ – Rolle/Benutzer mit „mitglieder“ bekommen beim Start „email“ (ohne Server, direkt über die Module).  node mailperm_test.js <S>
const fs = require('fs'); const S = process.argv[2]; const APP = process.env.CW_APP;
const DATA = S + '/r_mailperm'; fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
process.env.DATA_DIR = DATA; process.env.SEED = 'off';
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? '✔ ' : '✘ ') + n + (x ? '  ' + String(x).slice(0, 300) : '')); if (!c) fails++; };
const { db, getSetting } = require(APP + '/src/db');
// Bestandsinstallation nachstellen: Adminkonto, Rolle und Benutzer mit „mitglieder“, aber ohne „email“
db.prepare("INSERT INTO admin_users(username, name, pw_hash, role, perms, builtin) VALUES ('admin', 'Adminkonto', 'x', 'oberadmin', '[]', 1)").run();
db.prepare("INSERT INTO admin_users(username, name, pw_hash, role, perms) VALUES ('kassier', 'Kassier', 'x', 'admin', ?)").run(JSON.stringify(['mitglieder', 'konten']));
db.prepare("INSERT INTO admin_users(username, name, pw_hash, role, perms) VALUES ('theke', 'Theke', 'x', 'admin', ?)").run(JSON.stringify(['konten']));
db.prepare("INSERT INTO admin_roles(name, perms) VALUES ('Testrolle', ?)").run(JSON.stringify(['mitglieder']));
const kw = db.prepare("SELECT perms FROM admin_roles WHERE name = 'Kassenwart'").get();
ok('Vorher: Kassenwart-Vorlage ohne „email“', kw && !JSON.parse(kw.perms).includes('email'), kw && kw.perms);
ok('Vorher: Markierung nicht gesetzt', !getSetting('mail_perm_migrated', ''));
require(APP + '/src/mailer');   // führt die Migration beim Laden aus
const P = (t, w) => JSON.parse(db.prepare(`SELECT perms FROM ${t} WHERE ${w}`).get().perms);
ok('Rolle mit „mitglieder“ hat jetzt „email“', P('admin_roles', "name = 'Testrolle'").includes('email'), JSON.stringify(P('admin_roles', "name = 'Testrolle'")));
ok('Rollenvorlage Kassenwart hat jetzt „email“', P('admin_roles', "name = 'Kassenwart'").includes('email'));
ok('Benutzer mit „mitglieder“ hat jetzt „email“', P('admin_users', "username = 'kassier'").includes('email'), JSON.stringify(P('admin_users', "username = 'kassier'")));
ok('Benutzer ohne „mitglieder“ unverändert', !P('admin_users', "username = 'theke'").includes('email'));
ok('Rolle ohne „mitglieder“ unverändert (Kassenprüfer)', !P('admin_roles', "name = 'Kassenprüfer'").includes('email'));
ok('Markierung gesetzt', getSetting('mail_perm_migrated', '') === '1');
db.close();
console.log(fails ? `\n${fails} FEHLER` : '\nALLES OK'); process.exit(fails ? 1 : 0);
