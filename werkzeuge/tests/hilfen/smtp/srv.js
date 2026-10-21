const { SMTPServer } = require('smtp-server'); const { simpleParser } = require('mailparser'); const fs=require('fs');
let n=0;
new SMTPServer({ authOptional: true, disabledCommands: ['STARTTLS'], onAuth(a, s, cb) { cb(null, { user: a.username }); },
  onData(stream, s, cb) { simpleParser(stream).then(m => { n++; fs.writeFileSync(__dirname+'/mail'+n+'.json', JSON.stringify({ to: m.to.text, cc: m.cc ? m.cc.text : '', from: m.from.text, subject: m.subject, text: m.text, reply: m.replyTo ? m.replyTo.text : '', html: m.html || '', att: m.attachments.map(a => ({ f: a.filename, size: a.size })) }, null, 1));
    m.attachments.forEach(a => fs.writeFileSync(__dirname+'/'+a.filename, a.content)); cb(); }); } }).listen(2525);
