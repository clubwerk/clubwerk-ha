const B='http://127.0.0.1:3232/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,200):'')); if(!c) fails++;};
const mk=()=>{let ck=''; return async function A(url,method='GET',body){const h={'X-Clubwerk':'1',Cookie:ck}; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) ck=sc.split(';')[0]; return [r.status, await r.json().catch(()=>({}))];};};
async function T(url,body){const r=await fetch(B+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return [r.status, await r.json().catch(()=>({}))];}
(async()=>{
  const A=mk(); let s,j;
  await A('api/admin/setup','POST',{clubName:'SV Test',password:'Test-Kennwort-42'});
  for (const n of ['Anna Becker','Jonas von der Heide','Müller, Karl','Cher']) await A('api/admin/members','POST',{name:n,kind:'mitglied'});
  await A('api/admin/members','POST',{name:'Damen 30',kind:'mannschaft',pin:'4711'});
  const st=await (await fetch(B+'api/tablet/state')).json(); const art=st.articles.find(a=>!a.custom);
  for (const m of st.members.filter(m=>m.kind==='mitglied'||m.kind==='mannschaft')) { const [,u]=await T('api/tablet/unlock',{memberId:m.id,pin:'4711'}); await T('api/tablet/book',{token:u.token,items:[{articleId:art.id,qty:2}]}); }
  [s,j]=await A('api/admin/abtippliste');
  ok('Liste geladen', s===200 && j.rows.length===5, s+' '+j.rows?.length);
  ok('Sortierung Nachname, Mannschaft am Ende', j.rows.map(r=>r.last).join('|')==='Becker|Cher|von der Heide|Müller|Damen 30', j.rows.map(r=>r.last+'/'+r.first).join(' | '));
  ok('Komma-Format und Partikel', j.rows.find(r=>r.last==='Müller').first==='Karl' && j.rows.find(r=>r.last==='von der Heide').first==='Jonas');
  ok('Summe', j.total_cents===j.rows.reduce((a,r)=>a+r.cents,0) && j.total_cents===10*art.price_cents);
  ok('Standardtext', /^Getränke \d\d\.\d\d\.\d{4} – \d\d\.\d\d\.\d{4}$/.test(j.text), j.text);
  [s,j]=await A('api/admin/abtippliste/text','PUT',{template:'Getränke {jahr}\n<b>{verein}</b>'});
  [s,j]=await A('api/admin/abtippliste'); ok('Vorlage gespeichert, einzeilig', j.text===`Getränke ${new Date().getFullYear()} <b>SV Test</b>` , j.text);
  await A('api/admin/abtippliste/text','PUT',{template:''}); [s,j]=await A('api/admin/abtippliste'); ok('Leer -> Standard', j.template==='Getränke {von} – {bis}');
  // fester Stand: später Gebuchtes erscheint nicht
  const asOf=j.asOf, upTo=j.upTo; await new Promise(r=>setTimeout(r,1100));
  { const m=st.members.find(m=>m.name==='Anna Becker'); const [,u]=await T('api/tablet/unlock',{memberId:m.id}); await T('api/tablet/book',{token:u.token,items:[{articleId:art.id,qty:1}]}); }
  [s,j]=await A(`api/admin/abtippliste?asOf=${encodeURIComponent(asOf)}&upTo=${upTo}`); ok('Fester Stand wie Export', j.total_cents===10*art.price_cents, j.total_cents);
  // Rechte: nur Export darf lesen, nicht Vorlage ändern; ohne Recht 403
  await A('api/admin/users','POST',{username:'pruefer',name:'Prüfer',password:'pruefer1234',role:'admin',perms:['export']});
  await A('api/admin/users','POST',{username:'wart',name:'Wart',password:'wart12345',role:'admin',perms:['bestand']});
  const P=mk(); await P('api/admin/login','POST',{username:'pruefer',password:'pruefer1234'});
  [s]=await P('api/admin/abtippliste'); ok('Export-Recht darf lesen', s===200, s);
  [s]=await P('api/admin/abtippliste/text','PUT',{template:'x'}); ok('Export-Recht darf Vorlage nicht ändern', s===403, s);
  const W=mk(); await W('api/admin/login','POST',{username:'wart',password:'wart12345'});
  [s]=await W('api/admin/abtippliste'); ok('Ohne Recht 403', s===403, s);
  console.log(fails?`${fails} FEHLER`:'ALLES OK'); process.exit(fails?1:0);
})();
