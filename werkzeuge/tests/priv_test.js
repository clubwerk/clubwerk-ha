const B='http://localhost:3201/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,140):'')); if(!c) fails++;};
let ck=''; async function A(url,method='GET',body){const h={'X-Getraenke':'1',Cookie:ck}; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(sc) ck=sc.split(';')[0]; return [r.status, await r.json().catch(()=>({}))];}
async function T(url,body){const r=await fetch(B+url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return [r.status, await r.json().catch(()=>({}))];}
(async()=>{
  await A('api/admin/setup','POST',{username:'thorsten',name:'T',password:'Test-Kennwort-42'});
  let [,st]=await T('api/tablet/state'); const ms=st.members.filter(m=>m.kind==='mitglied'); const art=st.articles[0]; const m1=ms[0], m2=ms[1];
  let [s,j]=await T('api/tablet/unlock',{memberId:m1.id}); ok('ohne PIN: kein Betrag beim Öffnen', s===200 && j.private===false && j.balance===undefined && j.eventOpen_cents===undefined);
  let tok=j.token; [s,j]=await T('api/tablet/book',{token:tok,items:[{articleId:art.id,qty:2}]}); ok('ohne PIN: Buchen geht, aber kein Betrag in der Antwort', s===200 && j.balance===undefined && j.private===false);
  [s,j]=await T('api/tablet/account?token='+tok); ok('ohne PIN: Mein Konto gesperrt', s===403, j.error);
  [s,j]=await T('api/tablet/pin',{token:tok,newPin:'4711'}); ok('PIN setzen', s===200);
  [s,j]=await T('api/tablet/account?token='+tok); ok('nach PIN setzen: Konto sichtbar', s===200 && j.rows.length===1 && j.balance.cents===art.price_cents*2);
  [s,j]=await T('api/tablet/unlock',{memberId:m1.id}); ok('mit PIN: ohne PIN-Eingabe kein Zugang', s===401);
  [s,j]=await T('api/tablet/unlock',{memberId:m1.id,pin:'4711'}); ok('mit PIN: Betrag sichtbar', j.private===true && j.balance.cents===art.price_cents*2);
  // Veranstaltung
  await A('api/admin/users','POST',{username:'fest',name:'F',password:'fest12345',role:'admin',perms:['veranstaltungen']});
  [s,j]=await A('api/admin/events','POST',{name:'Fest',date:'2026-10-13'}); const ev=j.id; await A(`api/admin/events/${ev}/activate`,'POST',{});
  [s,j]=await T('api/tablet/event/guest',{name:'Opa Heinz'}); ok('Veranstaltung: Liste für die Theke sichtbar (Gast)', j.private===true && j.open_cents===0);
  let gt=j.token; [s,j]=await T('api/tablet/book',{token:gt,items:[{articleId:art.id,qty:1}]}); ok('Gast: Buchung zeigt Listenstand', s===200 && j.open_cents===art.price_cents);
  [s,j]=await T('api/tablet/account?token='+gt); ok('Gast: Liste abrufbar (nur Veranstaltungsbuchungen)', s===200 && j.rows.length===1);
  [s,j]=await T('api/tablet/event/guest',{memberId:m2.id}); ok('Mitglied auf Liste: Listenstand, kein Getränkekonto', j.private===true && j.open_cents===0 && j.balance===undefined);
  [s,j]=await T('api/tablet/event/guest',{memberId:m1.id}); ok('Thekenbetrieb: Mitglied mit PIN ohne PIN-Abfrage buchbar', s===200 && j.token && !j.needPin && j.balance===undefined);
  const gid=j.guest.id; [s,j]=await T('api/tablet/unlock',{guestId:gid}); ok('…auch beim erneuten Antippen keine PIN', s===200 && j.token);
  let lastTok=j.token; [s,j]=await T('api/tablet/book',{token:j.token,items:[{articleId:art.id,qty:1}]}); ok('…Buchung zeigt nur Veranstaltungsstand', s===200 && j.open_cents===art.price_cents && j.balance===undefined); const bid=j.bookings[0].id; const ttok=lastTok;
  [s,j]=await T('api/tablet/undo',{token:ttok,bookingIds:[bid]}); ok('Rückgängig am Tablet bei Veranstaltung gesperrt', s===403, j.error);
  [,st]=await T('api/tablet/state'); ok('Liste ohne PIN-Kennzeichen, mit offenem Betrag', st.event.guests.every(g=>!('hasPin' in g)) && st.event.guests.some(g=>g.open_cents>0));
  const gast=st.members.find(m=>m.kind==='gast'), verein=st.members.find(m=>m.kind==='verein');
  [s,j]=await T('api/tablet/unlock',{memberId:gast.id}); [s,j]=await T('api/tablet/book',{token:j.token,items:[{articleId:art.id,qty:1}]}); ok('Gastkonto während Veranstaltung gesperrt', s===400, j.error);
  [s,j]=await T('api/tablet/unlock',{memberId:verein.id}); [s,j]=await T('api/tablet/book',{token:j.token,items:[{articleId:art.id,qty:1}]}); ok('Vereinskonto während Veranstaltung gesperrt', s===400);
  [s,j]=await A('api/admin/login','POST',{username:'fest',password:'fest12345'}); [s,j]=await A(`api/admin/events/${ev}/deactivate`,'POST',{});
  [s,j]=await T('api/tablet/unlock',{memberId:verein.id}); [s,j]=await T('api/tablet/book',{token:j.token,items:[{articleId:art.id,qty:1}]}); ok('nach Deaktivieren: Vereinskonto wieder möglich', s===200);
  [s,j]=await T('api/tablet/unlock',{memberId:m1.id}); ok('nach Deaktivieren: PIN wieder Pflicht', s===401);
  console.log(fails? fails+' FEHLER':'alles ok');
})();
