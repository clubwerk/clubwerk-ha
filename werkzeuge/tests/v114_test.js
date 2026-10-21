const B='http://127.0.0.1:3236/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,220):'')); if(!c) fails++;};
let ck=''; async function A(url,method='GET',body){const h={'X-Getraenke':'1',Cookie:ck}; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) ck=sc.split(';')[0]; const ct=r.headers.get('content-type')||''; return [r.status, ct.includes('json')?await r.json():Buffer.from(await r.arrayBuffer())];}
async function T(url,body){const r=await fetch(B+url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return [r.status, await r.json().catch(()=>({}))];}
const ExcelJS=require(process.env.CW_APP + '/node_modules/exceljs');
(async()=>{
  let s,j; await A('api/admin/setup','POST',{clubName:'SV Test',password:'Test-Kennwort-42'});
  for (const n of ['Zora Abel','Jonas von der Heide','Anna Becker','Örni Ösch','Karl Müller','Lena Ziegler']) await A('api/admin/members','POST',{name:n,kind:'mitglied'});
  // Mannschaft: PIN Pflicht
  [s,j]=await A('api/admin/members','POST',{name:'Herren 1',kind:'mannschaft'}); ok('Mannschaft ohne PIN abgelehnt', s===400, j.error);
  [s,j]=await A('api/admin/members','POST',{name:'Herren 1',kind:'mannschaft',pin:'2468'}); const team=j.id; ok('Mannschaft mit PIN', s===200);
  [s,j]=await T('api/tablet/unlock',{memberId:team}); ok('Tablet: Mannschaft braucht PIN', s===401||s===403, s+' '+j.error);
  [s,j]=await T('api/tablet/unlock',{memberId:team,pin:'2468'}); const tt=j.token; ok('Tablet: Mannschaft mit PIN', s===200);
  [s,j]=await T('api/tablet/pin',{token:tt,currentPin:'2468',newPin:'1111'}); ok('Mannschaft kann PIN nicht selbst ändern', s===400, j.error);
  [s,j]=await A(`api/admin/members/${team}`,'PUT',{pin:'9999'}); [s,j]=await T('api/tablet/unlock',{memberId:team,pin:'9999'}); ok('Vorstand vergibt neue Mannschafts-PIN', s===200);
  // Mitglied: PIN setzen und wieder entfernen
  [,j]=await A('api/admin/members'); const ms=j.rows; const anna=ms.find(m=>m.name==='Anna Becker');
  ok('Mitglieder nach Nachname', ms.filter(m=>m.kind==='mitglied').map(m=>m.name).join('|')==='Zora Abel|Anna Becker|Jonas von der Heide|Karl Müller|Örni Ösch|Lena Ziegler', ms.filter(m=>m.kind==='mitglied').map(m=>m.name).join('|'));
  let [,u]=await T('api/tablet/unlock',{memberId:anna.id}); await T('api/tablet/pin',{token:u.token,newPin:'1234'});
  [,u]=await T('api/tablet/unlock',{memberId:anna.id,pin:'1234'}); [s,j]=await T('api/tablet/pin',{token:u.token,currentPin:'1234',newPin:''}); ok('Mitglied entfernt PIN', s===200 && j.hasPin===false);
  // Artikel: Sortierung + Löschen
  [,j]=await A('api/admin/articles'); const arts=j; const key=a=>a.category.toLowerCase()+'|'+a.name.toLowerCase();
  ok('Artikel nach Kategorie + Name', arts.every((a,i)=>!i||require(process.env.CW_APP + '/src/db.js').deKey(arts[i-1].category)+'\u0001'+require(process.env.CW_APP + '/src/db.js').deKey(arts[i-1].name) <= require(process.env.CW_APP + '/src/db.js').deKey(a.category)+'\u0001'+require(process.env.CW_APP + '/src/db.js').deKey(a.name)), arts.map(a=>a.category+'/'+a.name).join(', '));
  [,j]=await T('api/tablet/state'); ok('Tablet: Artikel gleich sortiert', j.articles.map(a=>a.id).join()===arts.filter(a=>a.active).map(a=>a.id).join());
  const unused=arts.find(a=>a.name.startsWith('Chips')), used=arts.find(a=>a.name.startsWith('Cola 0'));
  [,u]=await T('api/tablet/unlock',{memberId:anna.id}); await T('api/tablet/book',{token:u.token,items:[{articleId:used.id,qty:2}]});
  [s,j]=await A('api/admin/articles/'+unused.id,'DELETE'); ok('Unbenutzter Artikel endgültig gelöscht', s===200 && !j.kept);
  [s,j]=await A('api/admin/articles/'+used.id,'DELETE'); ok('Verkaufter Artikel entfernt, Historie bleibt', s===200 && j.kept);
  [,j]=await A('api/admin/articles'); ok('Beide weg aus Artikelliste', !j.some(a=>a.id===unused.id||a.id===used.id));
  [,j]=await T('api/tablet/state'); ok('Weg vom Tablet', !j.articles.some(a=>a.id===used.id));
  [,j]=await A('api/admin/balances'); ok('Offener Betrag bleibt', j.rows.find(r=>r.id===anna.id)?.total_cents===2*used.price_cents);
  // Mitglied löschen
  [s,j]=await A('api/admin/members/'+anna.id,'DELETE'); ok('Mit offenem Betrag nicht löschbar', s===400, j.error);
  [,j]=await A('api/admin/balances'); await A('api/admin/settle','POST',{asOf:j.asOf,upTo:j.upTo});
  [s,j]=await A('api/admin/members/'+anna.id,'DELETE'); ok('Nach Abrechnung gelöscht (Historie bleibt)', s===200 && j.kept);
  const lena=ms.find(m=>m.name==='Lena Ziegler'); [s,j]=await A('api/admin/members/'+lena.id,'DELETE'); ok('Ohne Buchungen endgültig gelöscht', s===200 && !j.kept);
  [,j]=await A('api/admin/members'); ok('Beide weg aus der Liste', !j.rows.some(m=>m.id===anna.id||m.id===lena.id));
  [,j]=await T('api/tablet/state'); ok('Weg vom Tablet', !j.members.some(m=>m.id===anna.id));
  [s,j]=await A('api/admin/members','POST',{name:'Anna Becker',kind:'mitglied'}); ok('Name wieder frei', s===200);
  const verein=ms.find(m=>m.kind==='verein'); [s,j]=await A('api/admin/members/'+verein.id,'DELETE'); ok('Sonderkonto nicht löschbar', s===400);
  [s,j]=await A('api/admin/bookings?from=2000-01-01&to=2100-01-01'); ok('Alte Buchungen behalten Namen', JSON.stringify(j).includes('Anna Becker'));
  // Veranstaltungen löschen
  [s,j]=await A('api/admin/events','POST',{name:'Leer',date:'2026-10-01'}); const e1=j.id;
  [s,j]=await A('api/admin/events/'+e1,'DELETE'); ok('Leere Veranstaltung gelöscht', s===200 && !j.kept);
  [s,j]=await A('api/admin/events','POST',{name:'Fest',date:'2026-10-02'}); const e2=j.id;
  await A(`api/admin/events/${e2}/activate`,'POST',{}); [s,j]=await A('api/admin/events/'+e2,'DELETE'); ok('Aktive nicht löschbar', s===400, j.error);
  const k=ms.find(m=>m.name==='Karl Müller'); [s,j]=await T('api/tablet/event/guest',{memberId:k.id}); await T('api/tablet/book',{token:j.token,items:[{articleId:arts.find(a=>a.active&&a.id!==used.id&&a.id!==unused.id).id,qty:1}]});
  await A(`api/admin/events/${e2}/deactivate`,'POST',{}); [s,j]=await A('api/admin/events/'+e2,'DELETE'); ok('Mit Offenem nicht löschbar', s===400, j.error);
  await A(`api/admin/events/${e2}/transfer`,'POST',{}); [s,j]=await A('api/admin/events/'+e2,'DELETE'); ok('Nach Übernahme gelöscht (Umsatz bleibt)', s===200 && j.kept, JSON.stringify(j));
  [,j]=await A('api/admin/events'); ok('Nicht mehr in der Liste', !j.some(e=>e.id===e2));
  // Export: Kategorie-Überschrift, Sortierung
  [,j]=await A('api/admin/balances'); [s,j]=await A('api/admin/export.xlsx?asOf='+encodeURIComponent(j.asOf)+'&upTo='+j.upTo); const wb=new ExcelJS.Workbook(); await wb.xlsx.load(j);
  ok('Export: „Kategorie“', JSON.stringify(wb.getWorksheet('Buchungen').getRow(4).values).includes('Kategorie'));
  console.log(fails?`${fails} FEHLER`:'ALLES OK'); process.exit(fails?1:0);
})();
