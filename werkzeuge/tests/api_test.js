const B='http://localhost:3196/api/';
const jar={};
async function c(who,url,method='GET',body){const r=await fetch(B+url,{method,headers:{'Content-Type':'application/json',cookie:jar[who]||''},body:body?JSON.stringify(body):undefined});
 const sc=r.headers.get('set-cookie'); if(sc) jar[who]=sc.split(';')[0]; const t=await r.text(); let j; try{j=JSON.parse(t)}catch(e){j=t}; return [r.status,j];}
(async()=>{
 console.log('setup', (await c('ober','admin/setup','POST',{username:'thorsten',name:'Thorsten',password:'geheim123'}))[0]);
 console.log('neuer Admin', await c('ober','admin/users','POST',{username:'kasse',name:'Kassenwart',password:'kasse123',perms:['bestellung','veranstaltungen']}));
 console.log('login kasse', (await c('kasse','admin/login','POST',{username:'kasse',password:'kasse123'}))[0]);
 console.log('kasse -> users (403 erwartet)', (await c('kasse','admin/users'))[0]);
 console.log('kasse -> abrechnung (403)', (await c('kasse','admin/balances'))[0]);
 console.log('kasse -> order (200)', (await c('kasse','admin/order'))[0]);
 console.log('status kasse', (await c('kasse','admin/status'))[1].user);
 // Tablet: neues Mitglied
 let [s,nm]=await c('t','tablet/member','POST',{name:'Max Mustermann'}); console.log('neues Mitglied', s, nm.member);
 console.log('doppelt', (await c('t','tablet/member','POST',{name:'max mustermann'}))[1]);
 console.log('buchen neu', (await c('t','tablet/book','POST',{token:nm.token,items:[{articleId:1,qty:2}]}))[1].total_cents);
 // Veranstaltung
 let [,ev]=await c('kasse','admin/events','POST',{name:'Clubmeisterschaft'}); 
 let [,evs]=await c('kasse','admin/events'); const e=evs[0]; console.log('Getränke vorbelegt', e.articles.length);
 const arts=e.articles.slice(0,3).map(a=>({articleId:a.id,price_cents:200}));
 console.log('liste setzen', (await c('kasse',`admin/events/${e.id}/articles`,'PUT',{articles:arts}))[1]);
 console.log('aktivieren', (await c('kasse',`admin/events/${e.id}/activate`,'POST',{}))[0]);
 let [,st]=await c('t','tablet/state'); console.log('tablet event', st.event.name, st.event.articles.map(a=>a.name+':'+a.price_cents).join(', '), 'top', st.top);
 let [,u]=await c('t','tablet/unlock','POST',{memberId:2});
 console.log('ohne pay', (await c('t','tablet/book','POST',{token:u.token,items:[{articleId:arts[0].articleId,qty:1}]}))[1]);
 console.log('anschreiben', (await c('t','tablet/book','POST',{token:u.token,pay:'anschreiben',items:[{articleId:arts[0].articleId,qty:3}]}))[1]);
 console.log('bar', (await c('t','tablet/book','POST',{token:u.token,pay:'bar',items:[{articleId:arts[1].articleId,qty:1}]}))[1].total_cents);
 console.log('nicht in liste', (await c('t','tablet/book','POST',{token:u.token,pay:'bar',items:[{articleId:20,qty:1}]}))[1]);
 [,evs]=await c('kasse','admin/events'); console.log('summary', {cash:evs[0].expected_cents, credit:evs[0].credit_cents, credits:evs[0].credits});
 console.log('übertragen', (await c('kasse',`admin/events/${e.id}/transfer`,'POST',{}))[1]);
 console.log('balance konto', (await c('ober','admin/balances'))[1].rows.map(r=>r.name+':'+r.total_cents));
 // Mitglied bestätigen / zusammenführen
 let [,ms]=await c('ober','admin/members'); const p=ms.rows.find(m=>m.pending); console.log('pending', p.name, p.bookings);
 console.log('merge', (await c('ober',`admin/members/${p.id}/merge`,'POST',{intoId:5}))[1]);
 // Bestellung
 await c('ober','admin/articles/1','PUT',{min_stock:40,target_stock:200});
 let [,o]=await c('kasse','admin/order'); console.log('order', o.rows.filter(r=>r.low).map(r=>`${r.name} Bestand ${r.stock} -> ${r.suggest} Ki`));
})();
