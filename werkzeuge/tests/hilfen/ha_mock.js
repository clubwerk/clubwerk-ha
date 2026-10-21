const http=require('http');const st={};const calls=[];
for(const id of ['valve.platz_1_vorne','valve.platz_1_hinten','valve.platz_2_vorne','valve.platz_2_hinten','valve.platz_3','switch.platz_4'])st[id]={entity_id:id,state:id.startsWith('valve')?'closed':'off',attributes:{friendly_name:id.split('.')[1].replace(/_/g,' ')}};
const add=(id,state,attrs={})=>st[id]={entity_id:id,state,attributes:{friendly_name:id.split('.')[1].replace(/_/g,' '),...attrs}};
add('lock.haustuer','locked');add('lock.kabine','locked');add('lock.kaputt','unavailable');add('switch.tor_relais','off');add('button.toroeffner','unknown');add('cover.einfahrt','closed');
add('binary_sensor.haustuer_kontakt','off',{device_class:'door'});add('binary_sensor.bewegung','off',{device_class:'motion'});
const next=new Date(Date.now()+5*3600e3).toISOString();
st['sensor.zone_1_next_cycle']={entity_id:'sensor.zone_1_next_cycle',state:next,attributes:{device_class:'timestamp',friendly_name:'Zone 1 nächster Lauf'}};
http.createServer((q,r)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{
 if(q.headers.authorization!=='Bearer tok'){r.writeHead(401);return r.end();}
 if(q.url==='/api/states'){r.setHeader('content-type','application/json');return r.end(JSON.stringify(Object.values(st)));}
 if(q.url==='/api/template'){const t=JSON.parse(b).template;const m=t.match(/integration_entities\('(\w+)'\)/);const map={hydrawise:['valve.platz_1_vorne','valve.platz_1_hinten','valve.platz_2_vorne','valve.platz_2_hinten','switch.platz_4'],rainbird:[],nuki:['lock.haustuer','lock.kabine']};return r.end(JSON.stringify(m?map[m[1]]||[]:[]));}
 if(q.url==='/api/_set'){const x=JSON.parse(b);st[x.e].state=x.s;return r.end('ok');}
 if(q.url==='/api/_calls'){return r.end(JSON.stringify(calls));}
 const m=q.url.match(/^\/api\/services\/(\w+)\/(\w+)$/);
 if(m){const body=JSON.parse(b||'{}');calls.push({t:Date.now(),svc:m[1]+'.'+m[2],e:body.entity_id,body});
  const e=st[body.entity_id]; if(e){ if(m[2]==='open_valve')e.state='open'; if(m[2]==='close_valve')e.state='closed'; if(m[2]==='turn_on')e.state='on'; if(m[2]==='turn_off')e.state='off'; if(m[2]==='unlock')e.state='unlocked'; if(m[2]==='lock')e.state='locked'; if(m[2]==='open_cover')e.state='open'; if(m[2]==='close_cover')e.state='closed';}
  r.end('[]');return;}
 r.writeHead(404);r.end();});}).listen(5241,()=>console.log('mock ha'));
