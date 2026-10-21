// Test-Mailserver auf Port 2525: legt jede Mail als mailN.json (und ihre Anhänge) in diesem Ordner ab. Stürzt nie ab.
const { SMTPServer } = require('smtp-server'); const { simpleParser } = require('mailparser'); const fs = require('fs'); const path = require('path');
let n = 0;
const safe = (s, i) => (String(s || `anhang-${n}-${i}`).replace(/[\/\\]/g, '_') || `anhang-${n}-${i}`);
new SMTPServer({ authOptional: true, disabledCommands: ['STARTTLS'], onAuth(a, s, cb) { cb(null, { user: a.username }); },
  onData(stream, s, cb) {
    simpleParser(stream).then(m => {
      n++;
      const att = (m.attachments || []).map((a, i) => ({ f: a.filename, size: a.size, file: safe(a.filename, i), content: a.content }));
      fs.writeFileSync(path.join(__dirname, 'mail' + n + '.json'), JSON.stringify({ to: m.to ? m.to.text : '', cc: m.cc ? m.cc.text : '', from: m.from ? m.from.text : '', subject: m.subject, text: m.text, reply: m.replyTo ? m.replyTo.text : '', html: m.html || '', att: att.map(a => ({ f: a.f, size: a.size })) }, null, 1));
      for (const a of att) { try { fs.writeFileSync(path.join(__dirname, a.file), a.content); } catch (e) { console.error('Anhang', a.file, e.message); } }
      cb();
    }).catch(e => { console.error('Mail', e.message); cb(); });
  } }).listen(2525);
process.on('uncaughtException', e => console.error('SMTP-Mock:', e.message));
