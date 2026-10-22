const B='http://127.0.0.1:3240/', P='http://127.0.0.1:5240/', M='http://127.0.0.1:5243/', HA='http://127.0.0.1:5241/api/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,240):'')); if(!c) fails++;};
let ck=''; async function A(url,method='GET',body,base=B,dev){const h={'X-Clubwerk':'1',Cookie:base===B?ck:''}; if(dev)h['X-Geraet']=dev; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(base+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(base===B&&sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) ck=sc.split(';')[0]; return [r.status, await r.json().catch(()=>({}))];}
const calls=async()=>(await (await fetch(HA+'_calls',{headers:{Authorization:'Bearer tok'}})).json());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wd=new Date().getDay();
(async()=>{ let s,j,r;
  await A('api/admin/setup','POST',{clubName:'TC Test',password:'Test-Kennwort-42',modules:{getraenke:true,zeiterfassung:false,beregnung:true,zugang:true}});
  [s,j]=await A('api/admin/extensions'); ok('App-Module gemeldet', JSON.stringify(j.appModules)==='["zugang","beregnung"]', JSON.stringify(j.appModules));
  r=await fetch(B+'app/'); ok('App nicht über Hauptport', r.status===404);
  r=await fetch(M); ok('App-Seite', r.status===200 && (await r.text()).includes('Mitglieder-App'));
  r=await fetch(M+'kit.css'); ok('kit.css über App-Port', r.status===200 && (await r.text()).includes('.vh-tile'));
  r=await fetch(M+'m/zugang/member.js'); ok('Bereichs-Skript', r.status===200);
  r=await fetch(M+'m/zugang/admin.js'); ok('admin.js nicht über App', r.status===404);
  // Einrichtung
  await A('api/admin/x/zugang/config','PUT',{wlanOnly:true,doors:[{name:'Haustür',type:'lock',ref:'lock.haustuer'},{name:'Tor',type:'impulse',ref:'switch.tor_relais',pulseSec:1}]});
  const all=Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,[['00:00','24:00']]])); const closed=Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,[]])); closed[(wd+1)%7]=[['07:00','23:00']];
  [s,j]=await A('api/admin/x/zugang/config','PUT',{profiles:[{id:'mitglied',name:'Mitglied',doors:'all',windows:all,isDefault:true},{id:'heutezu',name:'Heute zu',doors:'all',windows:closed}]});
  const D=Object.fromEntries((await A('api/admin/x/zugang/config'))[1].cfg.doors.map(d=>[d.name,d.id]));
  await A('api/admin/x/beregnung/config','PUT',{plaetze:[{name:'Platz 1',zones:[{ref:'valve.platz_1_vorne',label:'Vorne',sec:12}]}]});
  await A('api/admin/x/beregnung/pin','PUT',{pin:'2580'});
  [s,j]=await A('api/admin/members','POST',{name:'Max Mustermann',kind:'mitglied'}); const max=j.id;
  [s,j]=await A('api/admin/members','POST',{name:'Erika Beispiel',kind:'mitglied'}); const eri=j.id;
  [s,j]=await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',grant:true}); ok('Zugang freigeschaltet mit Standardprofil', s===200 && j.access.zugang.profile==='mitglied', JSON.stringify(j));
  [s,j]=await A(`api/admin/app/member/${max}/access`,'PUT',{module:'beregnung',grant:true}); ok('Beregnung freigeschaltet', s===200 && j.access.beregnung);
  [s,j]=await A(`api/admin/app/member/${max}/access`,'PUT',{module:'quatsch',grant:true}); ok('Unbekannter Bereich abgelehnt', s===400);
  [s,j]=await A('api/admin/app'); ok('Übersicht Mitglieder-App', j.rows.length===1 && j.modules.length===2 && j.members.some(m=>m.id===eri) && j.modules.find(m=>m.id==='zugang').options.profiles.length===2, JSON.stringify(j).slice(0,200));
  [s,j]=await A(`api/admin/app/member/${max}/invite`,'POST',{}); const t=j.token; ok('Einladung', s===200 && t);
  [s,j]=await A('api/admin/qr','POST',{url:'http://x.local:5001/#i='+t}); ok('QR', j.svg && j.svg.includes('<svg'));
  [s,j]=await A('api/me','GET',undefined,M); ok('Ohne Gerät: niemand', s===200 && !j.member);
  [s,j]=await A('api/m/zugang/status','GET',undefined,M); ok('Bereich ohne Gerät gesperrt', s===403 && j.device);
  [s,j]=await A('api/invite?t='+t,'GET',undefined,M); ok('Einladung ansehen', j.member==='Max Mustermann');
  [s,j]=await A('api/pair','POST',{t,pin:'2468'},M); const dev=j.device; ok('Gekoppelt', s===200 && dev);
  [s,j]=await A('api/pair','POST',{t,pin:'2468'},M); ok('Einladung nur einmal', s===400||s===410);
  [s,j]=await A('api/me','GET',undefined,M,dev); ok('Zwei Bereiche', j.member==='Max Mustermann' && j.sections.map(x=>x.id).join()==='zugang,beregnung', JSON.stringify(j.sections));
  [s,j]=await A('api/m/zugang/status','GET',undefined,M,dev); ok('Türen', s===200 && j.doors.length===2 && j.profile.name==='Mitglied');
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Haustür'],action:'auf',pin:'0000'},M,dev); ok('Falsche PIN', s===401 && j.pin);
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Haustür'],action:'auf',pin:'2468'},M,dev); ok('Haustür auf', s===200, j.error);
  let c=await calls(); ok('HA unlock', c.some(x=>x.svc==='lock.unlock'&&x.e==='lock.haustuer'));
  [s,j]=await A('api/m/beregnung/status','GET',undefined,M,dev); ok('Beregnung in App', s===200 && j.plaetze.length===1);
  // seit 3.11.1: Beregnung in der Mitglieder-App ohne zusätzliche PIN (das Handy ist gekoppelt und freigeschaltet)
  [s,j]=await A('api/m/beregnung/run','POST',{platz:0},M,dev); ok('Beregnung startet ohne extra PIN (Handy gekoppelt)', s===200, j.error);
  await sleep(1500);
  [s,j]=await A('api/m/beregnung/stop','POST',{pin:'2468'},M,dev); ok('Stopp', s===200);
  [s,j]=await A('api/admin/x/beregnung/log'); ok('Beregnung-Protokoll mit Name', j.rows.some(x=>x.who==='Max Mustermann'&&x.action==='start'));
  // Zeitprofil / Sperre / Entzug
  await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',profile:'heutezu'});
  [s,j]=await A('api/m/zugang/door','POST',{door:D['Haustür'],action:'zu',pin:'2468'},M,dev); ok('Außerhalb Zeitprofil', s===403 && /morgen|ab/.test(j.error), j.error);
  await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',profile:'mitglied',blocked:true});
  [s,j]=await A('api/m/zugang/status','GET',undefined,M,dev); ok('Gesperrt', s===403 && j.denied);
  [s,j]=await A('api/me','GET',undefined,M,dev); ok('Gesperrter Bereich mit Grund', j.sections.find(x=>x.id==='zugang').ok===false);
  await A(`api/admin/app/member/${max}/access`,'PUT',{module:'zugang',blocked:false});
  await A(`api/admin/app/member/${max}/access`,'PUT',{module:'beregnung',grant:false});
  [s,j]=await A('api/m/beregnung/status','GET',undefined,M,dev); ok('Beregnung entzogen', s===403);
  [s,j]=await A('api/me','GET',undefined,M,dev); ok('Nur noch Türen', j.sections.map(x=>x.id).join()==='zugang');
  // Beregnung: Modus „nur App“
  await A('api/admin/x/beregnung/config','PUT',{mode:'app',header:true});
  [s,j]=await A('api/status','GET',undefined,P); ok('Port 5000 im App-Modus gesperrt', s===403 && j.app);
  [s,j]=await A('api/tablet/nav'); ok('Beregnung nicht am Tablet im App-Modus', !j.items.some(i=>i.id==='beregnung'));
  [s,j]=await A('api/admin/x/beregnung/config','PUT',{mode:'pin'}); ok('zurück auf Vereins-PIN', j.cfg.mode==='pin');
  [s,j]=await A('api/status','GET',undefined,P); ok('Port 5000 wieder offen', s===200);
  // Tablet Zugang
  await A('api/admin/x/zugang/config','PUT',{header:true});
  [s,j]=await A('api/tablet/x/zugang/members'); ok('Tablet-Liste', j.members.length===1);
  [s,j]=await A('api/tablet/x/zugang/door','POST',{door:D['Tor'],action:'oeffnen',member:max,pin:'2468'}); ok('Tablet öffnet mit App-PIN', s===200, j.error);
  [s,j]=await A('api/tablet/x/zugang/door','POST',{door:D['Tor'],action:'oeffnen',member:eri,pin:'2468'}); ok('Tablet: nicht freigeschaltetes Mitglied', s===403);
  // Übersicht
  [s,j]=await A('api/admin/overview/modules'); ok('Übersicht-Module', j.some(x=>x.id==='zugang'&&x.kpis.length) && j.some(x=>x.id==='beregnung'), JSON.stringify(j).slice(0,250));
  // Handy entfernen / neuer QR
  [s,j]=await A(`api/admin/app/member/${max}/device`,'DELETE'); ok('Handy entfernt', s===200);
  [s,j]=await A('api/m/zugang/status','GET',undefined,M,dev); ok('Altes Handy gesperrt', s===403 && j.device);
  [s,j]=await A(`api/admin/app/member/${max}`); ok('Freischaltung bleibt', j.access.zugang && !j.device);
  // Mitglied löschen
  [s,j]=await A('api/admin/members/'+max,'DELETE'); ok('Mitglied löschbar', s===200, JSON.stringify(j));
  [s,j]=await A('api/admin/app'); ok('Aufgeräumt', j.rows.length===0);
  console.log(fails?`${fails} FEHLER`:'ALLES OK'); process.exit(fails?1:0);
})();
