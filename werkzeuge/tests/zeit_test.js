const B='http://127.0.0.1:3234/'; const DB=process.argv[2]+'/r_z/getraenke.db'; const MAILDIR=process.argv[2]+'/smtp';
let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,220):'')); if(!c) fails++;};
const fs=require('fs'); const Database=require(process.env.CW_APP + '/node_modules/better-sqlite3');
const mk=()=>{let ck=''; return async function A(url,method='GET',body){const h={'X-Getraenke':'1',Cookie:ck}; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) ck=sc.split(';')[0]; const ct=r.headers.get('content-type')||''; return [r.status, ct.includes('json')?await r.json():Buffer.from(await r.arrayBuffer())];};};
async function T(url,body){const r=await fetch(B+url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return [r.status, await r.json().catch(()=>({}))];}
const pad=n=>String(n).padStart(2,'0'); const d=new Date(); const prev=d.getMonth()===0?`${d.getFullYear()-1}-12`:`${d.getFullYear()}-${pad(d.getMonth())}`;
(async()=>{
  const A=mk(); let s,j;
  await A('api/admin/setup','POST',{clubName:'SV Test',password:'Test-Kennwort-42'});
  const N=async()=>(await (await fetch(B+'api/tablet/nav')).json()).items.filter(x=>x.id!=='getraenke');
  [s,j]=await A('api/admin/x/zeiterfassung/month'); ok('Inaktiv: 404', s===404);
  ok('Nav leer', (await N()).length===0);
  [s,j]=await A('api/admin/extensions'); ok('Erweiterungen gelistet', j.all.filter(x=>!x.builtin).map(x=>x.id+':'+x.source).sort().join(',')==='beispiel:nachinstalliert,beregnung:mitgeliefert,zeiterfassung:mitgeliefert,zugang:mitgeliefert', j.all.map(x=>x.id+':'+x.source).join(','));
  [s,j]=await A('api/admin/status'); ok('Recht unsichtbar solange aus', !j.permLabels.zeiterfassung);
  [s,j]=await A('api/admin/extensions/zeiterfassung','PUT',{active:true}); ok('Aktiviert', s===200);
  [s,j]=await A('api/admin/status'); ok('Recht sichtbar', Boolean(j.permLabels.zeiterfassung));
  [s,j]=await A('api/admin/mail','PUT',{host:'127.0.0.1',port:2525,user:'',from:'getraenke@verein.de'}); ok('Postfach (zentral) gespeichert', s===200, JSON.stringify(j));
  ok('Link aus ohne Personal', (await N()).length===0);
  [s,j]=await A('api/admin/x/zeiterfassung/staff','POST',{name:'Maria Keller',job:'Reinigung',pin:'12',rate:'14'}); ok('PIN zu kurz', s===400, j.error);
  [s,j]=await A('api/admin/x/zeiterfassung/staff','POST',{name:'Maria Keller',job:'Reinigung',pin:'1234',rate:'14,00'}); const maria=j.id; ok('Person angelegt', s===200);
  [s,j]=await A('api/admin/x/zeiterfassung/staff','POST',{name:'Peter Schmidt',job:'Hausmeister',pin:'5678'}); const peter=j.id;
  ok('Link an mit Personal', (await N()).map(x=>x.label+'>'+x.href).join()==='Zeiterfassung>x/zeiterfassung/');
  [s,j]=await T('api/tablet/x/zeiterfassung/state'); ok('Tablet-Liste', j.staff.length===2 && !j.staff[0].in_since, JSON.stringify(j.staff.map(x=>x.name)));
  ok('Kein Stundensatz am Tablet', !JSON.stringify(j).includes('rate'));
  [s,j]=await T('api/tablet/x/zeiterfassung/stamp',{staffId:maria,pin:'0000'}); ok('Falsche PIN', s===401);
  [s,j]=await T('api/tablet/x/zeiterfassung/stamp',{staffId:maria,pin:'1234'}); ok('Kommen', j.action==='in', JSON.stringify(j));
  [s,j]=await T('api/tablet/x/zeiterfassung/stamp',{staffId:maria,pin:'1234'}); ok('Doppelt getippt → zurückgenommen', j.action==='undo');
  [s,j]=await T('api/tablet/x/zeiterfassung/stamp',{staffId:maria,pin:'1234'}); ok('Wieder kommen', j.action==='in');
  // Beginn per Korrektur 2:05 vorverlegen → dann Gehen
  [s,j]=await A('api/admin/x/zeiterfassung/month'); let e=j.staff.find(x=>x.id===maria).entries[0];
  const st=new Date(new Date(e.start_at.replace(' ','T'))-125*60000); const lts=x=>`${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
  [s,j]=await A('api/admin/x/zeiterfassung/entries/'+e.id,'PUT',{start:lts(st),note:''}); ok('Korrektur ohne Begründung abgelehnt', s===400, j.error);
  [s,j]=await A('api/admin/x/zeiterfassung/entries/'+e.id,'PUT',{start:lts(st),note:'Test vorverlegt'}); ok('Korrektur', s===200, JSON.stringify(j));
  [s,j]=await T('api/tablet/x/zeiterfassung/stamp',{staffId:maria,pin:'1234'}); ok('Gehen mit Tagesdauer', j.action==='out' && j.today_minutes>=125 && j.today_minutes<=127, JSON.stringify(j));
  // Vormonat nachtragen: 20:18 genau → 20:15
  const days=[[2,'16:04','18:11'],[7,'09:00','11:12'],[9,'16:10','18:05'],[14,'08:55','11:20'],[16,'15:30','18:30'],[21,'09:02','11:06'],[23,'16:00','18:14'],[28,'08:59','11:25'],[29,'16:07','18:02']];
  for (const [dd,a,b] of days) { [s,j]=await A('api/admin/x/zeiterfassung/entries','POST',{staffId:maria,start:`${prev}-${pad(dd)} ${a}`,end:`${prev}-${pad(dd)} ${b}`,note:'aus Papierliste'}); if(s!==200) console.log(j); }
  [s,j]=await A('api/admin/x/zeiterfassung/entries','POST',{staffId:maria,start:`${prev}-02 17:00`,end:`${prev}-02 19:00`,note:'x doppelt'}); ok('Überschneidung abgelehnt', s===400, j.error);
  [s,j]=await A('api/admin/x/zeiterfassung/entries','POST',{staffId:peter,start:`${prev}-10 10:00`,end:`${prev}-10 13:41`,note:'Rasen'});
  [s,j]=await A('api/admin/x/zeiterfassung/entries','POST',{staffId:peter,start:`${prev}-11 10:00`,end:`${prev}-11 10:03`,note:'kurz'});
  [s,j]=await A('api/admin/x/zeiterfassung/month?month='+prev); const m=j.staff.find(x=>x.id===maria), p=j.staff.find(x=>x.id===peter);
  ok('Maria genau 20:18 → 20:15', m.minutes===1218 && m.rounded===1215, m.minutes+' '+m.rounded);
  ok('Peter 3:44 → 3:45 (Rest 14)', p.minutes===224 && p.rounded===225, p.minutes+' '+p.rounded);
  ok('Betrag Maria 20,25 h × 14 €', m.amount_cents===28350, m.amount_cents);
  ok('Peter ohne Satz', p.rate_cents===null && p.amount_cents===null);
  const {roundMonth}=require(process.env.CW_APP + '/erweiterungen/zeiterfassung/server.js');
  ok('Rundungsregel', [[60,60],[63,60],[64,75],[74,75],[75,75],[1218,1215],[1421,1425],[3,0],[4,15]].every(([a,b])=>roundMonth(a)===b));
  // Stundensatz ab diesem Monat ändern: Vormonat bleibt
  { const db=new Database(DB); db.prepare('UPDATE staff_rates SET from_month = ? WHERE staff_id = ?').run(prev, maria); db.close(); }   // Satz wurde „im Vormonat“ eingetragen
  await A('api/admin/x/zeiterfassung/staff/'+maria,'PUT',{rate:'15,50'});
  [,j]=await A('api/admin/x/zeiterfassung/month?month='+prev); ok('Vormonat behält alten Satz', j.staff.find(x=>x.id===maria).rate_cents===1400);
  [,j]=await A('api/admin/x/zeiterfassung/month'); ok('Aktueller Monat neuer Satz', j.staff.find(x=>x.id===maria).rate_cents===1550);
  // vergessen auszustempeln
  const db=new Database(DB); db.prepare("INSERT INTO time_entries(staff_id,start_at) VALUES (?, datetime('now','localtime','-13 hours'))").run(peter); db.close();
  [,j]=await T('api/tablet/x/zeiterfassung/state'); ok('Vergessen markiert', j.staff.find(x=>x.id===peter).forgotten===true);
  [s,j]=await T('api/tablet/x/zeiterfassung/stamp',{staffId:peter,pin:'5678'}); ok('Nach Vergessen: neu kommen', j.action==='in-after-forgotten');
  // PDF / Excel
  [s,j]=await A('api/admin/x/zeiterfassung/report.pdf?month='+prev); ok('PDF', s===200 && j.slice(0,4).toString()==='%PDF' && j.length>3000, j.length); fs.writeFileSync(process.argv[2]+'/zeit_nachweis.pdf', j);
  [s,j]=await A('api/admin/x/zeiterfassung/report.xlsx?month='+prev); ok('Excel', s===200 && j.length>4000);
  // Mail
  [s,j]=await A('api/admin/x/zeiterfassung/mail','PUT',{to:'kein-mail'}); ok('Ungültige Adresse', s===400);
  [s,j]=await A('api/admin/x/zeiterfassung/mail','PUT',{to:'kasse@verein.de'}); ok('Empfänger', s===200);
  [s,j]=await A('api/admin/x/zeiterfassung/mail/send','POST',{month:prev}); ok('Versand', s===200, JSON.stringify(j));
  await new Promise(r=>setTimeout(r,800)); const mf=fs.readdirSync(MAILDIR).filter(f=>/^mail\d+\.json$/.test(f)).sort((a,b)=>+b.match(/\d+/)-+a.match(/\d+/))[0]; const mail=JSON.parse(fs.readFileSync(MAILDIR+'/'+mf));
  ok('Mail angekommen', mail.to==='kasse@verein.de' && mail.att.length===2 && /20:15 Std\./.test(mail.text), mail.subject+' | '+mail.att.map(a=>a.f).join(','));
  [,j]=await A('api/admin/x/zeiterfassung/month'); ok('Status gesendet', j.mail.sentMonth===prev && !j.mail.error);
  // Rechte
  await A('api/admin/users','POST',{username:'wart',name:'Wart',password:'wart12345',role:'admin',perms:['bestand']});
  const W=mk(); await W('api/admin/login','POST',{username:'wart',password:'wart12345'}); [s]=await W('api/admin/x/zeiterfassung/month'); ok('Ohne Recht 403', s===403);
  [,j]=await A('api/admin/audit'); ok('Protokoll', ['Person angelegt','korrigiert','nachgetragen','versendet'].every(w=>JSON.stringify(j).includes(w)));
  // eigene Links
  [s,j]=await A('api/admin/settings/links','PUT',{links:[{label:'Platzbuchung',url:'javascript:alert(1)'}]}); ok('javascript-Link abgelehnt', s===400, j.error);
  [s,j]=await A('api/admin/settings/links','PUT',{links:[{label:'Platzbuchung',url:'https://example.org/buchen'},{label:'',url:''}]}); ok('Link gespeichert', s===200 && j.links.length===1);
  let nav=await N(); ok('Nav: Erweiterung + Link', nav.length===2 && nav[1].href==='link.html?i=0' && nav[1].url==='https://example.org/buchen', JSON.stringify(nav));
  // Beispiel aus dem Ordner
  // ab 2.12: Erweiterungen aus dem Netzwerkordner laufen erst nach Freigabe durch das Adminkonto
  [s,j]=await A('api/admin/extensions'); const bsp=j.all.find(x=>x.id==='beispiel'); ok('Ordner-Erweiterung nicht freigegeben → läuft nicht', bsp && bsp.unapproved && !bsp.active, JSON.stringify(bsp&&{u:bsp.unapproved,e:bsp.error}));
  [s]=await A('api/admin/extensions/beispiel','PUT',{active:true}); ok('…lässt sich nicht einschalten', s===400);
  [s]=await A('api/admin/x/beispiel/notizen','POST',{text:'Hallo'}); ok('…keine Verwaltungs-Route', s===404);
  const pg=await fetch(B+'x/beispiel/'); ok('…keine Seite', pg.status===404);
  [s]=await A('api/admin/extensions/beispiel/approve','POST',{password:'falsch'}); ok('Freigabe nur mit Passwort', s===401);
  [s]=await A('api/admin/extensions/beispiel/approve','POST',{password:'Test-Kennwort-42',hash:'0'.repeat(64)}); ok('Freigabe nur für angezeigten Stand (Prüfsumme)', s===400);
  [s,j]=await A('api/admin/extensions/beispiel/approve','POST',{password:'Test-Kennwort-42',hash:bsp.hash}); ok('Freigabe mit Passwort', s===200 && j.restart, JSON.stringify(j));
  // Deaktivieren: weg, Daten bleiben
  await A('api/admin/extensions/zeiterfassung','PUT',{active:false});
  [s]=await A('api/admin/x/zeiterfassung/month'); ok('Deaktiviert: 404', s===404);
  ok('Deaktiviert: Seite weg', (await fetch(B+'x/zeiterfassung/')).status===404);
  ok('Deaktiviert: nicht in Nav', !(await N()).some(x=>x.id==='zeiterfassung'));
  await A('api/admin/extensions/zeiterfassung','PUT',{active:true});
  [s,j]=await A('api/admin/x/zeiterfassung/month?month='+prev); ok('Wieder aktiv: Daten da', j.staff.find(x=>x.id===maria).minutes===1218);
  [s,j]=await W('api/admin/extensions/zeiterfassung','PUT',{active:false}); ok('Ohne Recht nicht schaltbar', s===403);
  console.log(fails?`${fails} FEHLER`:'ALLES OK'); process.exit(fails?1:0);
})();
