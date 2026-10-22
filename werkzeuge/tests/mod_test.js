const B='http://127.0.0.1:3238/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,200):'')); if(!c) fails++;};
let ck=''; async function A(url,method='GET',body){const h={'X-Clubwerk':'1',Cookie:ck}; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'}); const sc=r.headers.get('set-cookie'); if(sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) ck=sc.split(';')[0]; return [r.status, await r.json().catch(()=>({})), r];}
(async()=>{
  let s,j,r;
  [s,j]=await A('api/admin/status'); ok('Ersteinrichtung bietet Module an', j.modules && j.modules.map(m=>m.id).join()==='beregnung,getraenke,zeiterfassung,zugang', JSON.stringify(j.modules?.map(m=>m.id+':'+m.active)));
  // Nur Zeiterfassung
  await A('api/admin/setup','POST',{clubName:'Musikverein Test',password:'Test-Kennwort-42',modules:{getraenke:false,zeiterfassung:true}});
  [s,j]=await A('api/admin/status'); ok('Getränke-Rechte ausgeblendet', !j.permLabels.artikel && !j.user.perms.includes('artikel') && j.user.perms.includes('konten'), j.user.perms.join(','));
  [s]=await A('api/admin/articles'); ok('Getränke-Schnittstelle gesperrt', s===404);
  [s]=await A('api/tablet/state'); ok('Tablet-Buchung gesperrt', s===404);
  r=(await A(''))[2]; ok('Startseite → erstes Modul (ohne Personal: Startseite)', r.status===302 && r.headers.get('location')==='start.html', r.status+' '+r.headers.get('location'));
  await A('api/admin/x/zeiterfassung/staff','POST',{name:'Maria Keller',pin:'1234'});
  r=(await A(''))[2]; ok('Mit Personal → Zeiterfassung', r.status===302 && r.headers.get('location')==='x/zeiterfassung/', r.headers.get('location'));
  [s,j]=await A('api/tablet/nav'); ok('Kopfzeile nur Zeiterfassung', j.items.map(i=>i.id).join()==='zeiterfassung', JSON.stringify(j.items));
  [s,j]=await A('api/admin/members'); ok('Mitglieder (Kern) erreichbar', s===200);
  // Getränke einschalten
  [s]=await A('api/admin/extensions/getraenke','PUT',{active:true}); ok('Getränke eingeschaltet', s===200);
  [s]=await A('api/admin/articles'); ok('Getränke-Schnittstelle frei', s===200);
  r=(await A(''))[2]; ok('Startseite = Getränke', r.status===200);
  [s,j]=await A('api/tablet/nav'); ok('Kopfzeile Getränke zuerst', j.items.map(i=>i.id).join()==='getraenke,zeiterfassung', JSON.stringify(j.items.map(i=>i.id)));
  [s,j]=await A('api/admin/status'); ok('Getränke-Rechte wieder da', j.user.perms.includes('artikel'));
  // alles aus
  await A('api/admin/extensions/getraenke','PUT',{active:false}); await A('api/admin/extensions/zeiterfassung','PUT',{active:false});
  r=(await A(''))[2]; ok('Nichts aktiv → Startseite', r.headers.get('location')==='start.html');
  [s,j]=await A('api/admin/audit'); ok('Protokoll', JSON.stringify(j).includes('Erweiterung deaktiviert'));
  console.log(fails?`${fails} FEHLER`:'ALLES OK'); process.exit(fails?1:0);
})();
