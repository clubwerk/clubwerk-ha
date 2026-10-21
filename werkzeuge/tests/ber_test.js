const B='http://127.0.0.1:3240/', P='http://127.0.0.1:5240/', HA='http://127.0.0.1:5241/api/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,240):'')); if(!c) fails++;};
let ck=''; async function A(url,method='GET',body,base=B,cookie=ck){const h={'X-Getraenke':'1',Cookie:cookie}; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(base+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'}); const sc=r.headers.get('set-cookie'); if(base===B&&sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) ck=sc.split(';')[0]; return [r.status, await r.json().catch(()=>({})), r];}
const calls=async()=>(await (await fetch(HA+'_calls',{headers:{Authorization:'Bearer tok'}})).json());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  let s,j,r;
  [s,j]=await A('api/admin/status'); ok('Modul Beregnung angeboten', j.modules.some(m=>m.id==='beregnung'&&!m.active));
  await A('api/admin/setup','POST',{clubName:'TC Test',password:'Test-Kennwort-42',modules:{getraenke:true,zeiterfassung:false,beregnung:true}});
  [s,j]=await A('api/admin/status'); ok('Recht beregnung', j.user.perms.includes('beregnung')&&j.user.perms.includes('beregnung_bedienen'));
  r=await fetch(P); ok('Port-App liefert Webapp', r.status===200 && (await r.text()).includes('Alle Zonen ausschalten'));
  [s,j]=await A('api/info','GET',undefined,P); ok('Info', j.club==='TC Test' && j.mode==='pin' && !j.hasPin, JSON.stringify(j));
  [s,j]=await A('api/admin/x/beregnung/config'); ok('HA-Geräte gelistet', s===200 && j.list.length===7 && j.sensors.length===1 && j.cfg.vendor==='other', j.error||j.list.length);
  ok('Herstellerliste', j.vendors.length>=8 && j.vendors.some(v=>v.id==='rainbird'));
  await A('api/admin/x/beregnung/config','PUT',{vendor:'hydrawise'});
  [s,j]=await A('api/admin/x/beregnung/config'); ok('Hydrawise über HA: nur dessen Ventile', j.list.length===4 && j.filtered && j.list.every(x=>x.ref.startsWith('valve.platz_1')||x.ref.startsWith('valve.platz_2')), j.list.map(x=>x.ref).join());
  await A('api/admin/x/beregnung/config','PUT',{vendor:'rainbird'});
  [s,j]=await A('api/admin/x/beregnung/config'); ok('Nichts gefunden → alles anbieten', j.list.length===7 && !j.filtered);
  [s,j]=await A('api/admin/x/beregnung/config','PUT',{vendor:'gibtsnicht'}); ok('Unbekannter Hersteller abgelehnt', s===400);
  await A('api/admin/x/beregnung/config','PUT',{vendor:'other'});
  [s,j]=await A('api/admin/x/beregnung/config','PUT',{plaetze:[{name:'Platz 1',zones:[{ref:'valve.platz_1_vorne',label:'Vorne',sec:12},{ref:'valve.platz_1_hinten',label:'Hinten',sec:12}]},{name:'Platz 3',zones:[{ref:'valve.platz_3',sec:12}]},{name:'Platz 4',zones:[{ref:'switch.platz_4',sec:12}]}],cooldownMin:1,nextEntity:'sensor.zone_1_next_cycle'});
  ok('Konfiguration gespeichert', s===200, JSON.stringify(j));
  [s,j]=await A('api/admin/x/beregnung/config','PUT',{plaetze:[{name:'X',zones:[{ref:'light.x',sec:60}]}]}); ok('Ungültige Zone abgelehnt', s===400);
  [s,j]=await A('api/run','POST',{platz:0,pin:'1234'},P); ok('Ohne Vereins-PIN gesperrt', s===403, j.error);
  [s]=await A('api/admin/x/beregnung/pin','PUT',{pin:'12'}); ok('Zu kurze PIN abgelehnt', s===400);
  await A('api/admin/x/beregnung/pin','PUT',{pin:'2580'});
  [s,j]=await A('api/verify-pin','POST',{pin:'0000'},P); ok('Falsche PIN', s===401 && j.pin);
  [s,j]=await A('api/verify-pin','POST',{pin:'2580'},P); ok('Richtige PIN', s===200);
  [s,j]=await A('api/status','GET',undefined,P); ok('Status', j.online && j.plaetze.length===3 && j.plaetze[0].sub==='Erst Vorne, dann Hinten · je 0,2 min' && /heute|morgen/.test(j.next), JSON.stringify(j).slice(0,300));
  [s,j]=await A('api/run','POST',{platz:0,pin:'2580'},P); ok('Platz 1 gestartet', s===200 && j.totalSec===24 && j.waitSec===0, JSON.stringify(j));
  [s,j]=await A('api/run','POST',{platz:1,pin:'2580'},P); ok('Platz 3 hinten angestellt', s===200 && j.waitSec>=20, JSON.stringify(j));
  [s,j]=await A('api/run','POST',{platz:0,pin:'2580'},P); ok('Doppelstart abgelehnt', s===400, j.error);
  await sleep(2500);
  let c=await calls(); ok('Vorne offen, sonst nichts', c.length===1 && c[0].svc==='valve.open_valve' && c[0].e==='valve.platz_1_vorne', JSON.stringify(c.map(x=>x.svc+' '+x.e)));
  [s,j]=await A('api/status','GET',undefined,P); ok('Countdown & Phase', j.plaetze[0].state==='run' && j.plaetze[0].phase==='Vorne' && j.plaetze[0].remain>18 && j.plaetze[1].state==='wait', JSON.stringify(j.plaetze.map(p=>[p.state,p.remain,p.phase,p.startsIn])));
  await sleep(11500);
  c=await calls(); ok('Vorne zu, dann Hinten auf (nie gleichzeitig)', c.map(x=>x.svc+' '+x.e).join('|')==='valve.open_valve valve.platz_1_vorne|valve.close_valve valve.platz_1_vorne|valve.open_valve valve.platz_1_hinten', c.map(x=>x.svc+' '+x.e).join('|'));
  [s,j]=await A('api/status','GET',undefined,P); ok('Phase Hinten', j.plaetze[0].phase==='Hinten', JSON.stringify(j.plaetze[0]));
  [s,j]=await A('api/stop','POST',{pin:'1'},P); ok('Stopp mit falscher PIN abgelehnt', s===401);
  [s,j]=await A('api/stop','POST',{pin:'2580'},P); ok('Stopp', s===200);
  c=await calls(); ok('Alle eingerichteten Zonen geschlossen', ['valve.platz_1_vorne','valve.platz_1_hinten','valve.platz_3'].every(e=>c.some(x=>x.svc==='valve.close_valve'&&x.e===e)) && c.some(x=>x.svc==='switch.turn_off'&&x.e==='switch.platz_4'));
  [s,j]=await A('api/status','GET',undefined,P); ok('Nach Stopp nichts mehr geplant', j.plaetze.every(p=>p.state==='idle'), JSON.stringify(j.plaetze.map(p=>p.state)));
  ok('Sperre nach Beregnung', Boolean(j.plaetze[0].blockedUntil), JSON.stringify(j.plaetze[0]));
  [s,j]=await A('api/run','POST',{platz:0,pin:'2580'},P); ok('Start während Sperre abgelehnt', s===400 && /wieder möglich/.test(j.error), j.error);
  // Automatik von außen
  await fetch(HA+'services/switch/turn_on',{method:'POST',headers:{Authorization:'Bearer tok','Content-Type':'application/json'},body:JSON.stringify({entity_id:'switch.platz_4'})});
  await sleep(4500);
  [s,j]=await A('api/status','GET',undefined,P); ok('Automatik erkannt', j.plaetze[2].state==='auto', j.plaetze[2].state);
  await A('api/admin/x/beregnung/config','PUT',{stopFree:true,cooldownMin:0});
  [s]=await A('api/stop','POST',{},P); ok('Stopp ohne PIN (wenn erlaubt)', s===200);
  // Login-Modus
  await A('api/admin/x/beregnung/config','PUT',{mode:'login'});
  [s,j]=await A('api/status','GET',undefined,P,''); ok('Gesperrt ohne Anmeldung', s===401 && j.login);
  [s,j]=await A('api/run','POST',{platz:1,pin:'2580'},P,''); ok('Vereins-PIN reicht nicht mehr', s===401);
  [s,j]=await A('api/admin/users','POST',{username:'platzwart',name:'Platzwart',password:'regen12345',perms:['beregnung_bedienen']}); ok('Benutzer angelegt', s===200, JSON.stringify(j));
  [s,j]=await A('api/admin/users','POST',{username:'kassierer',name:'Kasse',password:'regen12345',perms:['buchungen']});
  r=await fetch(P+'api/login',{method:'POST',headers:{'Content-Type':'application/json','X-Getraenke':'1'},body:JSON.stringify({username:'kassierer',password:'regen12345'})}); const ck2=r.headers.get('set-cookie').split(';')[0];
  [s,j]=await A('api/run','POST',{platz:1},P,ck2); ok('Konto ohne Recht abgelehnt', s===403);
  r=await fetch(P+'api/login',{method:'POST',headers:{'Content-Type':'application/json','X-Getraenke':'1'},body:JSON.stringify({username:'platzwart',password:'regen12345'})}); const ck3=r.headers.get('set-cookie').split(';')[0];
  [s,j]=await A('api/info','GET',undefined,P,ck3); ok('Angemeldet', j.user==='Platzwart');
  [s,j]=await A('api/run','POST',{platz:1},P,ck3); ok('Platzwart startet', s===200);
  await sleep(2000);
  [s,j]=await A('api/admin/x/beregnung/log'); ok('Protokoll mit Namen', j.rows.some(x=>x.who==='Platzwart'&&x.action==='start') && j.rows.some(x=>x.who==='Vereins-PIN'), JSON.stringify(j.rows.map(x=>x.action+':'+x.who)));
  r=await fetch(B+'api/admin/x/beregnung/log.xlsx',{headers:{Cookie:ck}}); ok('Excel', r.status===200 && (await r.arrayBuffer()).byteLength>4000);
  // Tablet-Kopfzeile
  [s,j]=await A('api/tablet/nav'); ok('Nicht in Kopfzeile (Standard)', !j.items.some(i=>i.id==='beregnung'));
  await A('api/admin/x/beregnung/config','PUT',{header:true});
  [s,j]=await A('api/tablet/nav'); ok('In Kopfzeile', j.items.some(i=>i.id==='beregnung'&&i.href==='x/beregnung/'));
  r=await fetch(B+'x/beregnung/'); ok('Tablet-Seite', r.status===200);
  [s,j]=await A('api/tablet/x/beregnung/status','GET',undefined,B,ck3); ok('Tablet-API', s===200 && j.plaetze.length===3);
  // Port-App zeigt nichts anderes
  r=await fetch(P+'api/admin/status'); ok('Verwaltung über Port nicht erreichbar', r.status===404);
  r=await fetch(P+'admin.html'); ok('admin.html über Port nicht erreichbar', r.status===404);
  r=await fetch(P+'manifest.json'); j=await r.json(); ok('Manifest', j.short_name==='Beregnung' && j.name.startsWith('TC Test'));
  // Deaktivieren
  await A('api/admin/extensions/beregnung','PUT',{active:false});
  r=await fetch(P); ok('Port zeigt Hinweis wenn aus', r.status===404);
  console.log(fails?`${fails} FEHLER`:'ALLES OK'); process.exit(fails?1:0);
})();
