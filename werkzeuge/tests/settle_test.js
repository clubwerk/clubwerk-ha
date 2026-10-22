const B='http://127.0.0.1:3205/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,170):'')); if(!c) fails++;};
let ck=''; async function A(url,method='GET',body){const h={'X-Clubwerk':'1',Cookie:ck}; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) ck=sc.split(';')[0]; const ct=r.headers.get('content-type')||''; return [r.status, ct.includes('json')? await r.json(): Buffer.from(await r.arrayBuffer())];}
async function T(url,body){const r=await fetch(B+url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return [r.status, await r.json().catch(()=>({}))];}
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ExcelJS=require(process.env.CW_APP + '/node_modules/exceljs');
(async()=>{
  let s,j; await A('api/admin/setup','POST',{username:'thorsten',name:'T',password:'Test-Kennwort-42'});
  [,j]=await T('api/tablet/state'); const ms=j.members.filter(m=>m.kind==='mitglied'); const art=j.articles.find(a=>!a.custom); const [a,b]=[ms[0],ms[1]];
  const book=async(m,q)=>{const [,u]=await T('api/tablet/unlock',{memberId:m.id,pin:'4711'}); return (await T('api/tablet/book',{token:u.token,items:[{articleId:art.id,qty:q}]}))[1];};
  const x1=await book(a,2); await book(b,1);
  // Mitglied a setzt PIN, damit Kontoansicht geht
  let [,u]=await T('api/tablet/unlock',{memberId:a.id}); await T('api/tablet/pin',{token:u.token,newPin:'4711'});
  await sleep(1100);
  [s,j]=await A('api/admin/balances'); const asOf=j.asOf, upTo=j.upTo; ok('Offene Beträge', j.rows.length===2 && j.total_cents===3*art.price_cents, `${j.rows.map(r=>r.name+' '+r.total_cents)} Stand ${asOf}`);
  [s,j]=await A('api/admin/export.xlsx?upTo='+upTo+'&asOf='+encodeURIComponent(asOf)); const wb=new ExcelJS.Workbook(); await wb.xlsx.load(j);
  ok('Excel: Abrechnung + Offene Buchungen', wb.getWorksheet('Abrechnung') && wb.getWorksheet('Offene Buchungen').rowCount===6, wb.worksheets.map(w=>w.name).join(', ')+' / '+wb.getWorksheet('Abrechnung').getCell('A2').value);
  await sleep(1100); await book(a,1);   // nach dem Export gebucht
  [s,j]=await A('api/admin/bookings','POST',{memberId:b.id,articleId:art.id,qty:5,date:'2026-02-01'});   // rückdatiert nach dem Export
  [s,j]=await A('api/admin/settle','POST',{asOf,upTo,memberIds:[b.id]}); ok('Einzeln abgerechnet', s===200 && j.members===1 && j.cents===art.price_cents, JSON.stringify(j));
  [s,j]=await A('api/admin/balances'); ok('B: nur rückdatiert Nachgetragenes offen', j.rows.find(r=>r.id===b.id)?.total_cents===5*art.price_cents, j.rows.find(r=>r.id===b.id)?.total_cents);
  [s,j]=await A('api/admin/settle','POST',{asOf,upTo}); ok('Alle abgerechnet (Stand Export)', s===200 && j.members===1 && j.cents===2*art.price_cents, JSON.stringify(j));
  [s,j]=await A('api/admin/balances'); ok('Nach Export Gebuchtes bleibt offen', j.rows.length===2 && j.rows.find(r=>r.id===a.id).total_cents===art.price_cents, j.total_cents);
  [s,j]=await A('api/admin/members'); j=j.rows; ok('Mitgliederliste zeigt offen', j.find(m=>m.id===a.id).balance_cents===art.price_cents && j.find(m=>m.id===b.id).balance_cents===5*art.price_cents);
  [,u]=await T('api/tablet/unlock',{memberId:a.id,pin:'4711'}); ok('Tablet: offen nur Neues', u.balance.cents===art.price_cents, u.balance.cents);
  [s,j]=await fetch(B+'api/tablet/account?token='+u.token).then(async r=>[r.status,await r.json()]); ok('Tablet-Konto: zuletzt abgerechnet + 1 Zeile', j.lastSettled && j.rows.length===1, j.lastSettled+' '+j.rows.length);
  [s,j]=await A('api/admin/settle','POST',{asOf,upTo}); ok('Nichts mehr offen bis Stand → Meldung', s===400, j.error);
  // Storno einer abgerechneten Buchung → Gutschrift
  [s,j]=await A(`api/admin/bookings/${x1.bookings[0].id}/cancel`,'POST',{}); ok('Storno abgerechnet → Gutschrift', j.credit, j.message);
  [s,j]=await A('api/admin/balances'); ok('Offen nach Gutschrift', j.rows.find(r=>r.id===a.id).total_cents===-art.price_cents, j.rows.find(r=>r.id===a.id).total_cents);
  // Nachtragen mit altem Datum → bleibt offen
  [s,j]=await A('api/admin/bookings','POST',{memberId:b.id,articleId:art.id,qty:1,date:'2026-01-05'}); ok('Nachtragen mit altem Datum möglich', s===200);
  [s,j]=await A('api/admin/balances'); ok('…und offen', j.rows.find(r=>r.id===b.id)?.total_cents===6*art.price_cents);
  // Verlauf / Rückgängig
  [s,j]=await A('api/admin/settle-history'); ok('Verlauf', j.length===2 && j[0].undo && !j[1].undo, j.map(h=>h.batch+':'+h.members+':'+h.cents));
  [s,j]=await A('api/admin/settle/'+j[1].batch,'DELETE'); ok('Ältere nicht zurücknehmbar', s===400, j.error);
  [s,j]=await A('api/admin/settle-history'); const hb=j[0].batch; [s,j]=await A('api/admin/settle/'+hb,'DELETE'); ok('Zurücknehmen nach Gutschrift gesperrt', s===400, j.error);
  [s,j]=await A(`api/admin/bookings/${x1.bookings[0].id}/cancel`,'POST',{}); ok('Zweite Gutschrift gesperrt', s===400, j.error);
  [s,j]=await A('api/admin/settle','POST',{...(await A('api/admin/balances').then(x=>({asOf:x[1].asOf,upTo:x[1].upTo}))),memberIds:[b.id]}); const nb=j.batch;
  [s,j]=await A('api/admin/settle/'+nb,'DELETE'); ok('Letzte zurückgenommen', s===200, j.error);
  [s,j]=await A('api/admin/balances'); ok('b wieder offen', j.rows.find(r=>r.id===b.id)?.total_cents===6*art.price_cents);
  [s,j]=await A('api/admin/settle','POST',{asOf:'2099-01-01 00:00:00',upTo:1}); ok('Stand in der Zukunft abgelehnt', s===400);
  [s,j]=await A('api/admin/settle','POST',{}); ok('Ohne Stand abgelehnt', s===400);
  let r=await fetch(B+'api/ha/summary').then(r=>r.json()); ok('HA-Summe offen', Math.round(r.open_eur*100)===(await A('api/admin/balances'))[1].total_cents, r.open_eur);
  [s,j]=await A('api/admin/audit'); ok('Protokoll', JSON.stringify(j).includes('Konto abgerechnet') && JSON.stringify(j).includes('Abrechnung zurückgenommen'));
  console.log(fails?fails+' Fehler':'alles ok');
})();
