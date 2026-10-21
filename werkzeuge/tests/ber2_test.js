const B='http://127.0.0.1:3240/', P='http://127.0.0.1:5240/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,240):'')); if(!c) fails++;};
let ck=''; async function A(url,method='GET',body,base=B){const h={'X-Getraenke':'1',Cookie:ck}; if(body!==undefined)h['Content-Type']='application/json'; const r=await fetch(base+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(base===B&&sc&&sc.startsWith('gadmin=')&&!sc.startsWith('gadmin=;')) ck=sc.split(';')[0]; return [r.status, await r.json().catch(()=>({}))];}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ let s,j; const phase=process.argv[2];
  await A('api/admin/login','POST',{username:'admin',password:'Test-Kennwort-42'});
  if(phase==='a'){
    await A('api/admin/extensions/beregnung','PUT',{active:true});
    await A('api/admin/x/beregnung/config','PUT',{mode:'pin',backend:'ha',plaetze:[{name:'Platz 1',zones:[{ref:'valve.platz_1_vorne',label:'Vorne',sec:15},{ref:'valve.platz_1_hinten',label:'Hinten',sec:15}]}]});
    [s,j]=await A('api/run','POST',{platz:0,pin:'2580'},P); ok('gestartet vor Neustart',s===200,JSON.stringify(j));
  } else if(phase==='b'){
    await sleep(14000);
    const c=await (await fetch('http://127.0.0.1:5241/api/_calls',{headers:{Authorization:'Bearer tok'}})).json();
    const t=c.slice(-3).map(x=>x.svc+' '+x.e).join('|'); ok('Folgezone nach Neustart gestartet', t.endsWith('valve.close_valve valve.platz_1_vorne|valve.open_valve valve.platz_1_hinten'), t);
  } else {
    await A('api/stop','POST',{pin:'2580'},P);
    [s,j]=await A('api/admin/x/beregnung/config','PUT',{backend:'hydrawise',plaetze:[]}); ok('auf Hydrawise umgestellt', s===200, JSON.stringify(j));
    [s,j]=await A('api/admin/x/beregnung/key','PUT',{key:'abcd-1234-efgh'}); ok('Key gespeichert', s===200);
    [s,j]=await A('api/admin/x/beregnung/config'); ok('Key nie ausgeliefert', !JSON.stringify(j).includes('abcd-1234') && j.hasKey && j.list.length===6, j.error);
    [s,j]=await A('api/admin/x/beregnung/config','PUT',{plaetze:[{name:'Platz 1',zones:[{ref:'1',label:'Vorne',sec:12},{ref:'2',label:'Hinten',sec:12}]}]}); ok('Zonen per Nummer', s===200, JSON.stringify(j));
    [s,j]=await A('api/status','GET',undefined,P); ok('Nächste aus Hydrawise', /heute|morgen/.test(j.next)&&j.online, JSON.stringify(j).slice(0,200));
    [s,j]=await A('api/run','POST',{platz:0,pin:'2580'},P); ok('Start', s===200);
    await sleep(2000);
    let c=await (await fetch('http://127.0.0.1:5242/_calls?api_key=abcd-1234-efgh')).json(); ok('Hydrawise run Zone 1 mit Dauer', c.length===1&&c[0].relay_id==='1001'&&c[0].custom==='12'&&c[0].action==='run', JSON.stringify(c));
    await sleep(12000);
    c=await (await fetch('http://127.0.0.1:5242/_calls?api_key=abcd-1234-efgh')).json(); ok('dann Zone 2', c.length===2&&c[1].relay_id==='1002', JSON.stringify(c));
    [s]=await A('api/stop','POST',{pin:'2580'},P);
    c=await (await fetch('http://127.0.0.1:5242/_calls?api_key=abcd-1234-efgh')).json(); ok('stopall', c.at(-1).action==='stopall');
  }
  console.log(fails?`${fails} FEHLER`:'ALLES OK'); process.exit(fails?1:0);
})();
