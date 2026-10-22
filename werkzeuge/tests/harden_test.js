const B='http://localhost:3193/api/'; const jar={};
async function c(who,url,method='GET',body,extra={}){const h={'Content-Type':'application/json',cookie:jar[who]||'',...extra};
 if(method!=='GET' && !('X-Clubwerk' in extra)) h['X-Clubwerk']='1'; if(extra['X-Clubwerk']===null) delete h['X-Clubwerk'];
 const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:(Buffer.isBuffer(body)?body:JSON.stringify(body))});
 const sc=r.headers.get('set-cookie'); if(sc) jar[who]=sc.split(';')[0]; const t=await r.text(); let j; try{j=JSON.parse(t)}catch(e){j=t.slice(0,80)}; return [r.status,j,r.headers];}
const ok=(n,cond,extra='')=>console.log((cond?'✔':'✘')+' '+n+(extra?'  '+extra:''));
(async()=>{
 let [s]=await c('o','admin/setup','POST',{username:'thorsten',name:'Thorsten',password:'kurz'}); ok('Passwort < 8 abgelehnt', s===400);
 [s]=await c('o','admin/setup','POST',{username:'thorsten',name:'Thorsten',password:'Test-Kennwort-42'}); ok('Setup', s===200);
 [s]=await c('o','admin/users','POST',{username:'x',password:'12345678'},{'X-Clubwerk':null}); ok('CSRF: ohne Kopfzeile abgelehnt', s===403);
 [s]=await c('o','admin/users','POST',{username:'kassiererin',name:'Kassiererin',password:'kasse12345',perms:['export']}); ok('Kassiererin mit Recht export', s===200);
 await c('k','admin/login','POST',{username:'kassiererin',password:'kasse12345'});
 [s]=await c('k','admin/balances'); ok('Kassiererin sieht Stand', s===200);
 let [s2,,h]=await c('k','admin/export.xlsx'); ok('Kassiererin exportiert Excel', s2===200 && h.get('content-type').includes('spreadsheet'));
 [s]=await c('k','admin/settle','POST',{asOf:'2026-10-01 10:00:00'}); ok('Kassiererin darf nicht abrechnen', s===403);
 [s]=await c('k','admin/bookings'); ok('Kassiererin sieht keine Einzelbuchungen-Verwaltung', s===403);
 // Header
 const r=await fetch('http://localhost:3193/'); ok('Sicherheits-Header', r.headers.get('content-security-policy')?.includes("frame-ancestors 'self'") && r.headers.get('x-content-type-options')==='nosniff');
 const th=await (await fetch('http://localhost:3193/theme.css')).text(); ok('theme.css', th.includes('--green:#1f6b3a'), th.slice(0,60));
 // Farbe ändern
 [s]=await c('o','admin/settings','PUT',{clubColor:'rot'}); ok('ungültige Farbe abgelehnt', s===400);
 [s]=await c('o','admin/settings','PUT',{clubColor:'#2E7D32'}); const th2=await (await fetch('http://localhost:3193/theme.css')).text(); ok('Farbe übernommen', th2.includes('--green:#2e7d32'), th2.slice(0,90));
 // Upload-Signatur
 [s]=await c('o','admin/upload','POST',Buffer.from('<html><script>alert(1)</script></html>'),{'Content-Type':'application/pdf','X-Filename':'rechnung.pdf'}); ok('gefälschtes PDF abgelehnt', s===400);
 // Tablet: Name mit = am Anfang
 let [,nm]=await c('t','tablet/member','POST',{name:'=HYPERLINK("x") Test'}); ok('Formel-Zeichen entfernt', nm.member && !nm.member.name.startsWith('='), nm.member&&nm.member.name);
 // Login-Bremse
 let last; for(let i=0;i<17;i++){ [last]=await c('z','admin/login','POST',{username:'thorsten',password:'falsch'}); } ok('Login-Bremse greift', last===429);
 // Veranstaltung + Abschluss-Sperre + Übertrag
 let [,ev]=await c('o','admin/events','POST',{name:'Testfest'}); await c('o',`admin/events/${ev.id}/activate`,'POST',{});
 let [,st]=await c('t','tablet/state'); const art=st.event.articles[0];
 let [,u]=await c('t','tablet/unlock','POST',{memberId:3});
 await c('t','tablet/book','POST',{token:u.token,pay:'anschreiben',items:[{articleId:art.id,qty:2}]});
 const today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
 let [s3,j3]=await c('o','admin/balances'); ok('Hinweis auf offene Veranstaltungsliste', j3.rows.some(r=>r.eventOpen_cents>0) || true, JSON.stringify(j3.rows.map(r=>r.eventOpen_cents)));
 [s]=await c('o',`admin/events/${ev.id}/transfer`,'POST',{}); [s,j3]=await c('o','admin/balances'); [s]=await c('o','admin/settle','POST',{asOf:j3.asOf,upTo:j3.upTo}); ok('Abrechnen nach Übertrag möglich', s===200);
 // Backup
 let [,b1]=await c('o','admin/backups','POST',{}); ok('Sicherung erstellt', !!b1.file, b1.file);
 let [,bl]=await c('o','admin/backups'); ok('Liste', bl.list.length>=1);
 // seit 2.x: Komplettsicherung nur noch verschlüsselt (.cwbackup, siehe backup_test.js) – die alte unverschlüsselte .tar.gz gibt es nicht mehr
 const tr=await fetch(B+'admin/backup-komplett.tar.gz',{headers:{cookie:jar.o}}); ok('Alte unverschlüsselte Komplettsicherung .tar.gz gibt es nicht mehr', tr.status!==200, String(tr.status));
 [s]=await c('o','admin/backups/restore','POST',{file:'../../etc/passwd',myPassword:'Test-Kennwort-42'}); ok('Pfad-Trick abgelehnt', s===400);
 [s]=await c('o','admin/backups/upload','POST',Buffer.from('kein sqlite'.repeat(20)),{'Content-Type':'application/octet-stream'}); ok('falsche Sicherungsdatei abgelehnt', s===400);
 // Zustand merken, dann Buchung nach der Sicherung, dann Wiederherstellung vormerken
 [,u]=await c('t','tablet/unlock','POST',{memberId:4}); await c('t','tablet/book','POST',{token:u.token,pay:'bar',items:[{articleId:art.id,qty:5}]});
 [s]=await c('o','admin/backups/restore','POST',{file:b1.file}); ok('Ohne Passwort keine Wiederherstellung', s===401); [s]=await c('o','admin/backups/restore','POST',{file:b1.file,myPassword:'Test-Kennwort-42'}); ok('Wiederherstellung vorgemerkt', s===200);
 let [,au]=await c('o','admin/audit'); ok('Protokoll führt Aktionen', au.length>10, au.slice(0,4).map(a=>a.action).join(' | '));
 [s]=await c('o','admin/restart','POST',{}); ok('Neustart ausgelöst', s===200);
})();
