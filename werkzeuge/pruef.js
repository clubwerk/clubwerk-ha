// PRUEFSUMMEN.md um die aktuelle Version ergänzen: node werkzeuge/pruef.js .
const fs = require('fs'), path = require('path'); const repo = process.argv[2] || path.join(__dirname, '..');
const u = require(path.join(__dirname, '..', 'clubwerk', 'src', 'selfupdate.js'));
const dir = path.join(repo, 'clubwerk'); const ver = u.yamlField(fs.readFileSync(path.join(dir, 'config.yaml'), 'utf8'), 'version');
const sha = u.contentHash(dir); const f = path.join(repo, 'PRUEFSUMMEN.md');
let t = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '# Prüfsummen der Versionen\n\nNach dem Hochladen eines Update-Pakets (Einstellungen → Update) zeigt Clubwerk eine Prüfsumme des Paketinhalts. Sie muss mit der Zahl hier übereinstimmen – sonst das Paket nicht übernehmen.\n\n| Version | Prüfsumme (Anzeige) | SHA-256 des Inhalts |\n|---|---|---|\n';
t = t.split('\n').filter(l => !l.startsWith(`| ${ver} |`)).join('\n').replace(/\n*$/, '\n');
const lines = t.split('\n'); const idx = lines.findIndex(l => l.startsWith('|---')); lines.splice(idx + 1, 0, `| ${ver} | \`${u.shortHash(sha)}\` | \`${sha}\` |`);
fs.writeFileSync(f, lines.join('\n')); console.log(ver, u.shortHash(sha));
