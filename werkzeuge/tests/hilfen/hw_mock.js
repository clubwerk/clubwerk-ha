const http=require('http');const calls=[];const relays=[1,2,3,4,5,6].map(n=>({relay_id:1000+n,relay:n,name:'Z'+n,time:3600*n,run:0}));
http.createServer((q,r)=>{const u=new URL(q.url,'http://x');if(u.searchParams.get('api_key')!=='abcd-1234-efgh'){r.writeHead(401);return r.end();}
 if(u.pathname.endsWith('statusschedule.php'))return r.end(JSON.stringify({relays,nextpoll:30}));
 if(u.pathname.endsWith('setzone.php')){calls.push(Object.fromEntries(u.searchParams));const id=+u.searchParams.get('relay_id');const z=relays.find(x=>x.relay_id===id);
   if(u.searchParams.get('action')==='run'&&z){z.time=1;z.run=+u.searchParams.get('custom');} if(u.searchParams.get('action')==='stopall')relays.forEach(x=>{if(x.time===1)x.time=999;});return r.end('{"message":"ok"}');}
 if(u.pathname.endsWith('_calls'))return r.end(JSON.stringify(calls));r.writeHead(404);r.end();}).listen(5242);
