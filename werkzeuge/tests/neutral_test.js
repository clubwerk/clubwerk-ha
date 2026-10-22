const B='http://127.0.0.1:3211/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,170):'')); if(!c) fails++;};
let ck=''; async function A(url,method='GET',body,extra={}){const h={'X-Clubwerk':'1',Cookie:ck,...extra}; if(body!==undefined&&!(body instanceof Buffer))h['Content-Type']='application/json'; const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:(body instanceof Buffer?body:JSON.stringify(body))}); const sc=r.headers.get('set-cookie'); if(sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) ck=sc.split(';')[0]; const ct=r.headers.get('content-type')||''; return [r.status, ct.includes('json')?await r.json():Buffer.from(await r.arrayBuffer())];}
const ExcelJS=require(process.env.CW_APP + '/node_modules/exceljs');
(async()=>{
  let s,j;
  let br=await fetch(B+'api/branding').then(r=>r.json()); ok('Neutral vor Einrichtung', br.clubName==='Unser Verein' && !br.logo && br.color==='#1f6b3a', JSON.stringify(br));
  [s,j]=await A('api/admin/setup','POST',{clubName:'x',password:'Test-Kennwort-42'}); ok('Vereinsname zu kurz', s===400);
  [s,j]=await A('api/admin/setup','POST',{clubName:'SV Musterdorf 1920 e.V.',password:'Test-Kennwort-42'}); ok('Setup mit Vereinsname', s===200);
  br=await fetch(B+'api/branding').then(r=>r.json()); ok('Name übernommen', br.clubName==='SV Musterdorf 1920 e.V.');
  [s,j]=await A('api/admin/settings'); ok('Bestelldaten leer', !j.order.order_supplier && !j.order.customer_no && !j.order.delivery_address, JSON.stringify(j.order));
  const st=await fetch(B+'api/tablet/state').then(r=>r.json()); ok('Neutrale Konten', st.members.map(m=>m.name).join()==='Gast (bar),Verein (kostenfrei)', st.members.map(m=>m.name).join());
  ok('Neutrale Artikel', st.articles.length===14 && !st.articles.some(a=>/Tennis/.test(a.name)));
  // Artikel-Export + Import
  [s,j]=await A('api/admin/articles/export.xlsx'); let wb=new ExcelJS.Workbook(); await wb.xlsx.load(j); ok('Artikel-Export', wb.getWorksheet('Artikel').rowCount===15);
  wb=new ExcelJS.Workbook(); const ws=wb.addWorksheet('Liste'); ws.addRow(['Artikel','Spalte','Preis','Kiste','Bestand führen']);
  ws.addRow(['Musterbräu Pils 0,33','Bier','1,60',20,'ja']); ws.addRow(['Cola 0,33','Softdrinks',1.8,24,'']); ws.addRow(['Tennisbälle (Dose)','Bälle','8,00 €',1,'nein']); ws.addRow(['Kaputt','X','',1,'']); ws.addRow(['Bier 0,33','Bier','1,50',24,'']);
  const buf=Buffer.from(await wb.xlsx.writeBuffer());
  [s,j]=await A('api/admin/articles/import-excel','POST',buf,{'Content-Type':'application/octet-stream'}); ok('Artikel-Vorschau', s===200 && j.newCount===2 && j.changeCount===1, JSON.stringify(j.rows.map(r=>r.name+':'+r.status+':'+r.price_cents)));
  const take=j.rows.filter(r=>r.status==='ändern').map(r=>r.id).join(',');   // ab 2.10: je vorhandenem Artikel entscheiden
  [s,j]=await A('api/admin/articles/import-excel?commit=1&take='+take,'POST',buf,{'Content-Type':'application/octet-stream'});
  [s,j]=await A('api/admin/articles'); const cola=j.find(a=>a.name==='Cola 0,33'), tb=j.find(a=>a.name==='Tennisbälle (Dose)');
  ok('Import übernommen', cola.price_cents===180 && tb && tb.track_stock===0 && tb.category==='Bälle', JSON.stringify([cola.price_cents,tb&&tb.track_stock]));
  // Mitgliederimport mit Typ
  wb=new ExcelJS.Workbook(); const wm=wb.addWorksheet('M'); wm.addRow(['Vorname','Nachname','Typ']); wm.addRow(['Max','Muster','Mitglied']); wm.addRow(['','Herren 40','Mannschaft']); wm.addRow(['Chor','','Gruppe']);
  const mb=Buffer.from(await wb.xlsx.writeBuffer());
  [s,j]=await A('api/admin/members/import-excel?commit=1','POST',mb,{'Content-Type':'application/octet-stream'}); ok('Import mit Typ', j.added===3, JSON.stringify(j.rows));
  [s,j]=await A('api/admin/members'); ok('Mannschaften angelegt', j.rows.filter(m=>m.kind==='mannschaft').map(m=>m.name).sort().join()==='Chor,Herren 40');
  console.log(fails?fails+' Fehler':'alles ok');
})();
