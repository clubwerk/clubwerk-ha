const B='http://127.0.0.1:3208/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,160):'')); if(!c) fails++;};
const jar={}; async function A(who,url,method='GET',body){const h={'X-Getraenke':'1',Cookie:jar[who]||''}; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) jar[who]=sc.split(';')[0]; return [r.status, await r.json()];}
(async()=>{
  let s,j; [s,j]=await A('a','api/admin/setup','POST',{username:'hacker',password:'Test-Kennwort-42'}); ok('Setup', s===200);
  [s,j]=await A('a','api/admin/status'); ok('Adminkonto = admin', j.user.username==='admin' && j.user.name==='Adminkonto' && j.user.builtin, JSON.stringify(j.user));
  [s,j]=await A('a','api/admin/users'); const adm=j[0];
  [s,j]=await A('a',`api/admin/users/${adm.id}`,'PUT',{name:'Hans'}); ok('Name fest', s===400, j.error);
  [s,j]=await A('a',`api/admin/users/${adm.id}`,'PUT',{role:'admin'}); ok('Rolle fest', s===400, j.error);
  [s,j]=await A('a',`api/admin/users/${adm.id}`,'PUT',{active:false}); ok('nicht sperrbar', s===400, j.error);
  [s,j]=await A('a',`api/admin/users/${adm.id}`,'DELETE'); ok('nicht löschbar', s===400, j.error);
  [s,j]=await A('a','api/admin/users','POST',{username:'thorsten',name:'Thorsten',password:'thorsten123',role:'oberadmin'}); ok('Alle Rechte vergeben nur mit eigenem Passwort', s===401);
  [s,j]=await A('a','api/admin/users','POST',{username:'thorsten',name:'Thorsten',password:'thorsten123',role:'oberadmin',myPassword:'Test-Kennwort-42'}); const tid=j.id; ok('Benutzer mit allen Rechten', s===200);
  [s]=await A('t','api/admin/login','POST',{username:'thorsten',password:'thorsten123'});
  [s,j]=await A('t','api/admin/users'); ok('…sieht Benutzerverwaltung', s===200 && j.length===2);
  [s,j]=await A('t','api/admin/users','POST',{username:'kasse',name:'Kasse',password:'kasse12345',role:'admin',perms:['abrechnung']}); const kid=j.id; ok('…legt Benutzer an', s===200);
  [s,j]=await A('t',`api/admin/users/${adm.id}`,'DELETE'); ok('…kann Adminkonto nicht löschen', s===400);
  [s,j]=await A('t',`api/admin/users/${adm.id}/password`,'POST',{password:'neuesPW123'}); ok('…ohne eigenes Passwort abgelehnt', s===401);
  [s,j]=await A('t',`api/admin/users/${adm.id}/password`,'POST',{password:'neuesPW123',myPassword:'thorsten123'}); ok('…kann Adminkonto-Passwort neu setzen', s===200);
  [s,j]=await A('t','api/admin/backups'); ok('…darf Datensicherung', s===200);
  [s,j]=await A('t',`api/admin/users/${kid}`,'DELETE'); ok('Benutzer löschen', s===200);
  [s,j]=await A('t',`api/admin/users/${tid}`,'DELETE'); ok('sich selbst nicht löschen', s===400);
  [s,j]=await A('a','api/admin/users'); ok('Session Adminkonto nach PW-Reset beendet', s===401);
  [s]=await A('a','api/admin/login','POST',{username:'admin',password:'neuesPW123'}); ok('Login admin mit neuem PW', s===200);
  [s,j]=await A('a',`api/admin/users/${tid}`,'PUT',{role:'admin',perms:['export']}); ok('Alle Rechte entziehen', s===200);
  [s,j]=await A('t','api/admin/users'); ok('…danach keine Benutzerverwaltung', s===403 || s===401);
  console.log(fails?fails+' Fehler':'alles ok');
})();
