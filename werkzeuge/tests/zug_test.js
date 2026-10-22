// Zugang (Türen): Ende-zu-Ende über die Mitglieder-App (/api/m/zugang/…) – angepasst an die vereinheitlichte App (3.11+), Oktober 2026
const B='http://127.0.0.1:3240/', P='http://127.0.0.1:5243/', HA='http://127.0.0.1:5241/api/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,260):'')); if(!c) fails++;};
let ck=''; async function A(url,method='GET',body,base=B,dev){const h={'X-Clubwerk':'1',Cookie:base===B?ck:''}; if(dev)h['X-Geraet']=dev; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(base+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(base===B&&sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) ck=sc.split(';')[0]; return [r.status, await r.json().catch(()=>({}))];}
const calls=async()=>(await (await fetch(HA+'_calls',{headers:{Authorization:'Bearer tok'}})).json());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=new Date(), wd=now.getDay();
(async()=>{ let s,j;
  await A('api/admin/setup','POST',{clubName:'TC Test',password:'Test-Kennwort-42',modules:{getraenke:false,zeiterfassung:false,beregnung:false,zugang:true}});
  [s,j]=await A('api/admin/status'); ok('Recht zugang', j.user.perms.includes('zugang'));
  [s,j]=await A('api/admin/x/zugang/config'); ok('Geräte nach Art', s===200 && j.devices.lock.length===3 && j.devices.cover.length===1 && j.devices.binary_sensor.length===1 && j.cfg.profiles.length===2 && j.cfg.profiles[0].isDefault, j.error||JSON.stringify(j.devices).slice(0,200));
  await A('api/admin/x/zugang/config','PUT',{vendor:'nuki'}); [s,j]=await A('api/admin/x/zugang/config'); ok('Hersteller filtert', j.devices.lock.length===2 && j.filtered, j.devices.lock.map(x=>x.ref).join());
  [s,j]=await A('api/admin/x/zugang/config','PUT',{vendor:'other',doors:[{name:'Haustür',type:'lock',ref:'lock.haustuer',sensor:'binary_sensor.haustuer_kontakt'},{name:'Kabine',type:'lock',ref:'lock.kabine'},{name:'Tor',type:'impulse',ref:'switch.tor_relais',pulseSec:1},{name:'Einfahrt',type:'cover',ref:'cover.einfahrt'},{name:'Defekt',type:'lock',ref:'lock.kaputt'}]});
  ok('Türen gespeichert', s===200 && j.cfg.doors.length===5 && j.cfg.doors.every(d=>/^[a-f0-9]{8}$/.test(d.id)), JSON.stringify(j).slice(0,200));
  const D=Object.fromEntries(j.cfg.doors.map(d=>[d.name,d.id]));
  [s,j]=await A('api/admin/x/zugang/config','PUT',{doors:[{name:'X',type:'lock',ref:'switch.tor_relais'}]}); ok('Falscher Gerätetyp abgelehnt', s===400, j.error);
  // Profile: Standard "Jugend" nur Kabine, rund um die Uhr; "Geschlossen" heute nie
  const all=Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,[['00:00','24:00']]])); const closed=Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,[]])); closed[(wd+1)%7]=[['07:00','23:00']];
  [s,j]=await A('api/admin/x/zugang/config','PUT',{profiles:[{id:'mitglied',name:'Mitglied',doors:'all',windows:all,isDefault:false},{id:'jugend',name:'Jugend',doors:[D['Kabine']],windows:all,isDefault:true},{id:'heutezu',name:'Heute zu',doors:'all',windows:closed}]});
  ok('Profile gespeichert, ein Standard', s===200 && j.cfg.profiles.filter(p=>p.isDefault).length===1 && j.cfg.profiles[1].isDefault, j.error);
  [s,j]=await A('api/admin/x/zugang/config','PUT',{profiles:[{name:'Kaputt',doors:'all',windows:{1:[['25:00','26:00']]}}]}); ok('Ungültige Zeit abgelehnt', s===400, j.error);
  [s,j]=await A('api/admin/members','POST',{name:'Max Mustermann',kind:'mitglied'}); const max=j.id;
  [s,j]=await A('api/admin/members','POST',{name:'Erika Beispiel',kind:'mitglied'}); const eri=j.id;
  [s,j]=await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',grant:true}); ok('Freigeschaltet (Standardprofil)', s===200, j.error);
  [s,j]=await A(`api/admin/app/member/${max}/invite`,'POST',{}); const t=j.token; ok('Einladung', s===200 && t);
  [s,j]=await A('api/admin/x/zugang/members'); ok('Standardprofil vergeben', j.rows[0].profile==='jugend' && j.rows[0].device==='eingeladen', JSON.stringify(j.rows[0]));
  [s,j]=await A('api/m/zugang/status','GET',undefined,P); ok('Ohne Gerät gesperrt', s===403 && j.device);
  [s,j]=await A('api/pair','POST',{t,pin:'2468'},P); const dev=j.device; ok('Gekoppelt', s===200 && dev);
  [s,j]=await A('api/m/zugang/status','GET',undefined,P,dev); ok('Jugend sieht nur Kabine', s===200 && j.doors.length===1 && j.doors[0].name==='Kabine' && j.doors[0].allowed && j.profile.name==='Jugend', JSON.stringify(j).slice(0,250));
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Haustür'],action:'auf',pin:'2468'},P,dev); ok('Haustür verboten', s===403, j.error);
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Kabine'],action:'auf',pin:'1111'},P,dev); ok('Falsche PIN', s===401 && j.pin);
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Kabine'],action:'auf',pin:'2468'},P); ok('PIN ohne Gerät nutzlos', s===403);
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Kabine'],action:'auf',pin:'2468'},P,dev); ok('Kabine aufgeschlossen', s===200, j.error);
  let c=await calls(); ok('HA lock.unlock', c.some(x=>x.svc==='lock.unlock'&&x.e==='lock.kabine'));
  [s,j]=await A('api/m/zugang/status','GET',undefined,P,dev); ok('Zustand aufgeschlossen', j.doors[0].state==='aufgeschlossen' && j.doors[0].can.includes('zu'), JSON.stringify(j.doors[0]));
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Kabine'],action:'zu',pin:'2468'},P,dev); c=await calls(); ok('Abgeschlossen', s===200 && c.some(x=>x.svc==='lock.lock'&&x.e==='lock.kabine'));
  // Profil wechseln
  await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',profile:'mitglied'});
  [s,j]=await A('api/m/zugang/status','GET',undefined,P,dev); ok('Mitglied sieht alle 5', j.doors.length===5);
  const hd=j.doors.find(d=>d.name==='Haustür'); ok('Türkontakt angezeigt', /Tür zu/.test(hd.state), hd.state);
  ok('Defektes Schloss offline', j.doors.find(d=>d.name==='Defekt').offline);
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Tor'],action:'oeffnen',pin:'2468'},P,dev); ok('Tor-Impuls', s===200);
  await sleep(300); c=await calls(); ok('switch an', c.some(x=>x.svc==='switch.turn_on'&&x.e==='switch.tor_relais'));
  await sleep(1300); c=await calls(); ok('… und nach 1 s wieder aus', c.some(x=>x.svc==='switch.turn_off'&&x.e==='switch.tor_relais'));
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Einfahrt'],action:'auf',pin:'2468'},P,dev); c=await calls(); ok('Einfahrt öffnen', s===200 && c.some(x=>x.svc==='cover.open_cover'));
  // Zeitprofil schließt
  await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',profile:'heutezu'});
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Haustür'],action:'auf',pin:'2468'},P,dev); ok('Außerhalb Zeitprofil abgelehnt', s===403 && /wieder möglich ab/.test(j.error), j.error);
  [s,j]=await A('api/m/zugang/status','GET',undefined,P,dev); ok('Grund in Anzeige', j.doors.every(d=>!d.allowed) && /wieder möglich/.test(j.doors[0].reason));
  await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',profile:'mitglied'});
  // gültig bis gestern
  const y=new Date(Date.now()-86400000).toISOString().slice(0,10);
  await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',valid_until:y});
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Haustür'],action:'auf',pin:'2468'},P,dev); ok('Abgelaufen', s===403 && /gültig/.test(j.error), j.error);
  await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',valid_until:''});
  // Sperrtag heute
  const td=new Date(); const tds=`${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,'0')}-${String(td.getDate()).padStart(2,'0')}`;
  await A('api/admin/x/zugang/config','PUT',{blockDays:[{from:tds,to:tds,note:'Sanierung'}]});
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Haustür'],action:'auf',pin:'2468'},P,dev); ok('Sperrtag', s===403 && /Sanierung/.test(j.error), j.error);
  await A('api/admin/x/zugang/config','PUT',{blockDays:[]});
  // alle sperren
  await A('api/admin/x/zugang/config','PUT',{blockAll:true});
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Haustür'],action:'auf',pin:'2468'},P,dev); ok('Alle gesperrt', s===403);
  [s,j]=await A(`api/admin/x/zugang/doors/${D['Haustür']}/auf`,'POST',{}); ok('Fernbedienung trotzdem', s===200);
  await A('api/admin/x/zugang/config','PUT',{blockAll:false});
  // einzelnes Mitglied sperren
  await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',blocked:true});
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Haustür'],action:'zu',pin:'2468'},P,dev); ok('Mitglied gesperrt', s===403 && /gesperrt/.test(j.error));
  await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',blocked:false});
  // Tablet
  [s,j]=await A('api/tablet/nav'); ok('Tablet aus (Standard)', !j.items.some(i=>i.id==='zugang'));
  await A('api/admin/x/zugang/config','PUT',{header:true});
  [s,j]=await A('api/tablet/nav'); ok('Tablet ein', j.items.some(i=>i.id==='zugang'));
  [s,j]=await A('api/tablet/x/zugang/members'); ok('Tablet: nur freigeschaltete Mitglieder', j.members.length===1 && j.members[0].name==='Max Mustermann');
  [s,j]=await A('api/tablet/x/zugang/door','POST',{door:D['Kabine'],action:'auf',member:max,pin:'0000'}); ok('Tablet falsche PIN', s===401);
  [s,j]=await A('api/tablet/x/zugang/door','POST',{door:D['Kabine'],action:'auf',member:eri,pin:'2468'}); ok('Tablet fremdes Mitglied', s===403);
  [s,j]=await A('api/tablet/x/zugang/door','POST',{door:D['Kabine'],action:'auf',member:max,pin:'2468'}); ok('Tablet öffnet', s===200, j.error);
  // Neuer QR sperrt altes Handy
  await A(`api/admin/app/member/${max}/invite`,'POST',{});
  [s,j]=await A('api/m/zugang/status','GET',undefined,P,dev); ok('Neuer QR sperrt altes Handy', s===403);
  // Beregnung-Freischaltung ist getrennt
  [s,j]=await A('api/admin/x/zugang/log'); ok('Protokoll', j.rows.some(x=>x.action==='abgelehnt') && j.rows.some(x=>x.action==='auf'&&x.who==='Max Mustermann') && j.rows.some(x=>/Fernbedienung/.test(x.detail||'')) && j.rows.some(x=>x.detail==='am Tablet'), JSON.stringify(j.rows.map(r=>r.action)));
  let r=await fetch(B+'api/admin/x/zugang/log.xlsx',{headers:{Cookie:ck}}); ok('Excel', r.status===200);
  // Mitglied löschen
  [s,j]=await A('api/admin/members/'+max,'DELETE'); ok('Mitglied löschbar', s===200, JSON.stringify(j));
  [s,j]=await A('api/admin/x/zugang/members'); ok('Freischaltung weg', j.rows.length===0);
  r=await fetch(P+'api/admin/status'); ok('Verwaltung nicht über Port', r.status===404);
  console.log(fails?`${fails} FEHLER`:'ALLES OK'); process.exit(fails?1:0);
})();
