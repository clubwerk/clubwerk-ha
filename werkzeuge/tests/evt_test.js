const B='http://localhost:3198/'; let fails=0;
const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,140):'')); if(!c) fails++;};
const jars={};
async function c(who,url,method='GET',body){
  const h={'X-Clubwerk':'1'}; if(jars[who]) h.Cookie=jars[who]; if(body!==undefined) h['Content-Type']='application/json';
  const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
  const sc=r.headers.get('set-cookie'); if(sc) jars[who]=sc.split(';')[0];
  const t=await r.text(); let j; try{j=JSON.parse(t)}catch(e){j=t}; return [r.status,j];
}
const TODAY=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const T=(url,body)=>c('tab',url,body===undefined?'GET':'POST',body);
(async()=>{
  await c('o','api/admin/setup','POST',{username:'thorsten',name:'T',password:'Test-Kennwort-42'});
  await c('o','api/admin/users','POST',{username:'fest',name:'Festwart',password:'fest12345',role:'admin',perms:['veranstaltungen']});
  await c('o','api/admin/users','POST',{username:'kasse',name:'Kassierer',password:'kasse12345',role:'admin',perms:['uebernahme']});
  await c('f','api/admin/login','POST',{username:'fest',password:'fest12345'});
  await c('k','api/admin/login','POST',{username:'kasse',password:'kasse12345'});
  let [s,j]=await c('f','api/admin/events','POST',{name:'Sommerfest',date:'2026-10-12'}); const ev=j.id; ok('Veranstaltung angelegt',s===200);
  [s,j]=await c('f','api/admin/events'); const e0=j.find(x=>x.id===ev);
  ok('Snacks & Bälle in der Veranstaltungsliste', e0.articles.some(a=>/Chips/.test(a.name)) && e0.articles.some(a=>/Süßes/.test(a.name)), e0.articles.map(a=>a.name).join(', '));
  await c('f',`api/admin/events/${ev}/activate`,'POST',{});
  let [,st]=await T('api/tablet/state'); ok('Tablet sieht Veranstaltung mit leerer Liste', st.event && Array.isArray(st.event.guests) && st.event.guests.length===0);
  const mA=st.members.find(m=>m.kind==='mitglied'), mB=st.members.filter(m=>m.kind==='mitglied')[5];
  const art=st.event.articles[0];
  // Mitglied aus Liste hinzufügen
  [s,j]=await T('api/tablet/event/guest',{memberId:mA.id}); ok('Mitglied auf Liste gesetzt',s===200&&j.token, j.guest&&j.guest.name); const tA=j.token, gA=j.guest.id;
  [s,j]=await T('api/tablet/event/guest',{memberId:mA.id}); ok('doppelt → gleicher Eintrag', j.guest.id===gA);
  [s,j]=await T('api/tablet/book',{token:tA,items:[{articleId:art.id,qty:2},{custom:true,cents:350,note:'Grillwurst'}]});
  ok('Buchung angeschrieben + freier Betrag (Listenstand für die Theke)', s===200 && j.paid_cash===0 && j.open_cents===art.price_cents*2+350 && j.balance===undefined, JSON.stringify(j).slice(0,120));
  [s,j]=await T('api/tablet/event/guest',{name:'Opa Heinz'}); const tO=j.token, gO=j.guest.id; ok('frei eingetragener Name', s===200 && j.guest.memberId===null);
  await T('api/tablet/book',{token:tO,items:[{articleId:art.id,qty:3}]});
  [s,j]=await T('api/tablet/event/guest',{name:mB.name}); ok('Name eines Mitglieds wird automatisch verknüpft', j.guest.memberId===mB.id); const tB=j.token, gB=j.guest.id;
  await T('api/tablet/book',{token:tB,items:[{articleId:art.id,qty:1}]});
  [s,j]=await T('api/tablet/unlock',{eventId:ev}); await T('api/tablet/book',{token:j.token,items:[{articleId:art.id,qty:1}]});
  // alter Weg: Mitglied direkt → landet auf Liste
  const mC=st.members.filter(m=>m.kind==='mitglied')[9];
  [s,j]=await T('api/tablet/unlock',{memberId:mC.id}); [s,j]=await T('api/tablet/book',{token:j.token,items:[{articleId:art.id,qty:1}]});
  ok('Mitglied über Namensliste → automatisch auf Veranstaltungsliste', j.kind==='event' && j.guest);
  [,st]=await T('api/tablet/state'); ok('Tablet-Liste zeigt 4 Namen mit offenem Betrag', st.event.guests.length===4 && st.event.guests.every(g=>g.open_cents>0), st.event.guests.map(g=>g.name).join(', '));
  [s,j]=await T('api/tablet/account?token='+tA); ok('Liste am Tablet für die Theke sichtbar (nur Veranstaltung)', s===200 && j.rows.length===2 && j.open_cents>0);
  // Bezahlen
  [s,j]=await c('f',`api/admin/events/${ev}/guests/${gA}/pay`,'POST',{method:'bar'}); ok('A hat bar bezahlt', s===200 && j.cents===art.price_cents*2+350);
  [s,j]=await c('f',`api/admin/events/${ev}/guests/${gO}/pay`,'POST',{method:'karte'}); ok('Opa hat mit Karte bezahlt', s===200);
  [s,j]=await c('f',`api/admin/events/${ev}/guests/${gO}/pay`,'POST',{method:'karte'}); ok('nochmal bezahlen → nichts offen', s===400, j.error);
  [,st]=await T('api/tablet/state'); ok('Tablet zeigt „bezahlt“', st.event.guests.find(g=>g.id===gA).paid===true);
  [s,j]=await T('api/tablet/undo',{token:tA,bookingIds:[1]}); ok('Rückgängig nach Bezahlung gesperrt', s>=400, j.error);
  // nach Bezahlung nochmal buchen → wieder offen
  await T('api/tablet/book',{token:tA,items:[{articleId:art.id,qty:1}]});
  [s,j]=await c('f','api/admin/events'); let E=j.find(x=>x.id===ev); let G=Object.fromEntries(E.guests.map(g=>[g.id,g]));
  ok('A wieder offen mit neuem Getränk', G[gA].open_cents===art.price_cents && G[gA].bar_cents===art.price_cents*2+350);
  ok('Summen: bar = Barverkauf + bar bezahlt', E.bar_cents===art.price_cents*1+art.price_cents*2+350, `${E.bar_cents} sale ${E.sale_cents}`);
  ok('Karte', E.karte_cents===art.price_cents*3);
  // Rechte
  [s,j]=await c('f',`api/admin/events/${ev}/transfer`,'POST',{}); ok('Festwart darf NICHT übernehmen', s===403);
  [s,j]=await c('k',`api/admin/events/${ev}/guests/${gA}/pay`,'POST',{method:'bar'}); ok('Kassierer darf nicht „bezahlt“ setzen (nur Veranstaltungsrecht)', s===403);
  [s,j]=await c('k','api/admin/events'); ok('Kassierer sieht die Listen', s===200 && j.length===1);
  // manuell offen: Opa bucht nochmal (offen, ohne Mitglied)
  await T('api/tablet/book',{token:tO,items:[{articleId:art.id,qty:1}]});
  // Abrechnung blockiert
  [s,j]=await c('o','api/admin/balances'); ok('Abrechnung zeigt offene Veranstaltungsbeträge als Hinweis', j.eventOpen.length>0, JSON.stringify(j.eventOpen));
  [s,j]=await c('k',`api/admin/events/${ev}/transfer`,'POST',{}); ok('Kassierer übernimmt Mitglieder, frei eingetragene bleiben', s===200 && j.people===3 && j.skipped.includes('Opa Heinz'), JSON.stringify(j));
  [s,j]=await c('o','api/admin/balances?from=2026-01-01&to=2026-12-31'); ok('Beträge stehen auf der Getränkeliste', j.rows.some(r=>r.id===mB.id) && j.rows.some(r=>r.id===mA.id), j.rows.map(r=>r.name+' '+r.total_cents).join(', '));
  // Opa zuordnen und übernehmen
  [s,j]=await c('k',`api/admin/events/${ev}/guests/${gO}`,'PUT',{memberId:st.members.filter(m=>m.kind==='mitglied')[12].id}); ok('Kassierer ordnet freien Namen einem Mitglied zu', s===200, j.error);
  [s,j]=await c('k',`api/admin/events/${ev}/transfer`,'POST',{}); ok('…und übernimmt ihn', j.people===1 && !j.skipped.length);
  [s,j]=await c('o','api/admin/balances'); [s,j]=await c('o','api/admin/settle','POST',{asOf:j.asOf,upTo:j.upTo}); ok('Abrechnung jetzt möglich', s===200, j.error);
  // Zahlung zurücknehmen
  [s,j]=await c('f','api/admin/events'); E=j.find(x=>x.id===ev);
  const pay=E.payments.find(p=>p.guest_id===gA);
  [s,j]=await c('f',`api/admin/events/${ev}/payments/${pay.id}`,'DELETE'); ok('Zahlung zurückgenommen', s===200);
  [s,j]=await c('f','api/admin/events'); E=j.find(x=>x.id===ev); ok('…Betrag wieder offen', E.guests.find(g=>g.id===gA).open_cents===art.price_cents*2+350);
  // Admin: Namen hinzufügen, löschen
  [s,j]=await c('f',`api/admin/events/${ev}/guests`,'POST',{name:'Gast Tante Erna'}); ok('Admin fügt Namen hinzu', s===200); const gE=j.id;
  [s,j]=await c('f',`api/admin/events/${ev}/guests/${gE}`,'DELETE'); ok('leeren Namen entfernen', s===200);
  [s,j]=await c('f',`api/admin/events/${ev}/guests/${gA}`,'DELETE'); ok('Namen mit Buchungen nicht entfernbar', s===400);
  // freier Betrag auf normaler Liste
  await c('f',`api/admin/events/${ev}/deactivate`,'POST',{});
  [s,j]=await T('api/tablet/unlock',{memberId:mA.id}); [s,j]=await T('api/tablet/book',{token:j.token,items:[{custom:true,cents:1200,note:'Startgeld Turnier'}]});
  ok('Freier Betrag auf normaler Liste', s===200 && j.kind==='konto' && j.total_cents===1200);
  [s,j]=await T('api/tablet/book',{token:tA,items:[{articleId:art.id,qty:1}]}); ok('nach Ende kein Buchen mehr auf Liste', s===401||s===400, j.error);
  [s,j]=await T('api/tablet/book',{token:tA,items:[{custom:true,cents:5}]}); ok('zu kleiner Betrag abgelehnt', s>=400);
  [,st]=await T('api/tablet/state'); ok('Freier Betrag nicht als Artikelkachel', !st.articles.some(a=>a.name==='Freier Betrag'));
  [s,j]=await c('o','api/admin/articles'); ok('Freier Betrag nicht in Artikelverwaltung', !j.some(a=>a.name==='Freier Betrag'));
  [s,j]=await c('o','api/admin/bookings','POST',{memberId:mA.id,amount_cents:500,note:'Kaffee-Spende'}); ok('Admin bucht freien Betrag nach', s===200);
  [s,j]=await c('o','api/admin/bookings?from=2026-01-01&to=2026-12-31'); ok('Buchungsliste zeigt Text', j.rows.some(r=>r.article==='Freier Betrag: Kaffee-Spende') && j.rows.some(r=>r.guest), j.rows.slice(0,3).map(r=>r.article+'/'+r.member).join(' | '));
  const r=await fetch(B+'api/admin/export.xlsx?from=2026-01-01&to=2026-12-31',{headers:{Cookie:jars.o}}); const buf=Buffer.from(await r.arrayBuffer());
  require('fs').writeFileSync(process.argv[2]+'/evt_export.xlsx',buf); ok('Excel-Export', r.status===200 && buf.length>5000, buf.length);
  // Doppelt eingetragen → beim Zuordnen zusammenführen
  await c('f',`api/admin/events/${ev}/activate`,'POST',{});
  [s,j]=await T('api/tablet/event/guest',{name:'Adi P.'}); await T('api/tablet/book',{token:j.token,items:[{articleId:art.id,qty:1}]}); const gD=j.guest.id;
  [s,j]=await c('k',`api/admin/events/${ev}/guests/${gD}`,'PUT',{memberId:mA.id}); ok('Doppeleintrag wird zusammengeführt', s===200 && j.merged, JSON.stringify(j));
  [s,j]=await c('f','api/admin/events'); E=j.find(x=>x.id===ev); ok('…Buchung jetzt beim Mitglied', !E.guests.some(g=>g.id===gD) && E.guests.find(g=>g.id===gA).qty>=4);
  console.log(fails? fails+' FEHLER':'alles ok');
})();
