const B='http://127.0.0.1:3206/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,200):'')); if(!c) fails++;};
let ck=''; async function A(url,method='GET',body){const h={'X-Getraenke':'1',Cookie:ck}; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) ck=sc.split(';')[0]; return [r.status, await r.json()];}
async function T(url,body){const r=await fetch(B+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return [r.status, await r.json().catch(()=>({}))];}
(async()=>{
  let s,j; await A('api/admin/setup','POST',{username:'thorsten',name:'T',password:'Test-Kennwort-42'});
  [,j]=await A('api/admin/members'); const ms=j.rows.filter(m=>m.kind==='mitglied'); const p1=ms[0], p2=ms[1];
  let [,u]=await T('api/tablet/unlock',{memberId:p1.id}); await T('api/tablet/pin',{token:u.token,newPin:'4711'});
  [,u]=await T('api/tablet/unlock',{memberId:p2.id}); await T('api/tablet/pin',{token:u.token,newPin:'1111'});
  await A(`api/admin/members/${p2.id}/reset-pin`,'POST',{});
  [,j]=await A('api/admin/members'); const a1=j.rows.find(m=>m.id===p1.id), a2=j.rows.find(m=>m.id===p2.id);
  ok('PIN gesetzt mit Datum (Mitglied)', a1.hasPin && a1.pin_changed_at && a1.pin_changed_by==='Mitglied', a1.pin_changed_at+' '+a1.pin_changed_by);
  ok('PIN zurückgesetzt mit Datum + Admin', !a2.hasPin && a2.pin_changed_at && a2.pin_changed_by==='admin', a2.pin_changed_at+' '+a2.pin_changed_by);
  [,j]=await A('api/admin/audit'); ok('Protokoll PIN festgelegt', JSON.stringify(j).includes('PIN festgelegt'));
  [,j]=await A('api/admin/members'); const absent=j.rows.filter(m=>m.kind==='mitglied'&&m.active&&(!m.last_seen||m.last_seen<j.seasonStart));
  ok('13 nicht da', absent.length===13, absent.length+' Saison '+j.seasonStart);
  // eines davon mit offenem Betrag → übersprungen
  [,j]=await A('api/admin/balances'); await A('api/admin/settle','POST',{asOf:j.asOf,upTo:j.upTo});   // alles abgerechnet
  const old=absent.find(m=>m.bookings>0); const never=absent.find(m=>m.bookings===0); const withOpen=absent.find(m=>m.bookings===0 && m.id!==never.id);
  const st=await (await fetch(B+'api/tablet/state')).json(); const art=st.articles.find(a=>!a.custom);
  if (!old || !never || !withOpen) ok('Testdaten für das Entfernen vorhanden', false, 'zu wenige abwesende Mitglieder');
  else {
  [s,j]=await A('api/admin/bookings','POST',{memberId:withOpen.id,articleId:art.id,qty:1,date:'2025-09-01'}); if(s!==200) console.log(j);
  [s,j]=await A('api/admin/members/remove-inactive','POST',{ids:[withOpen.id, old.id, never.id, ms[50].id]}); ok('Entfernen', s===200 && j.deleted===1 && j.hidden===1 && j.skipped.length===2, JSON.stringify(j));
  [,j]=await A('api/admin/members'); ok('gelöscht / ausgeblendet', !j.rows.find(m=>m.id===never.id) && j.rows.find(m=>m.id===old.id).active===false);
  }
  console.log(fails?fails+' Fehler':'alles ok');
})();
