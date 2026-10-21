const B='http://127.0.0.1:3192/', fs=require('fs'); let ck='';
const H=(x={})=>({'X-Getraenke':'1',Cookie:ck,...x});
(async()=>{
 let r=await fetch(B+'api/admin/setup',{method:'POST',headers:H({'Content-Type':'application/json'}),body:JSON.stringify({username:'thorsten',name:'T',password:'Test-Kennwort-42'})});
 ck=r.headers.get('set-cookie').split(';')[0];
 console.log('branding vorher', await (await fetch(B+'api/branding')).json());
 r=await fetch(B+'api/admin/logo',{method:'POST',headers:H(),body:fs.readFileSync('bad.svg')}); console.log('bad', r.status, await r.json());
 r=await fetch(B+'api/admin/logo',{method:'POST',headers:H(),body:Buffer.from('hallo')}); console.log('txt', r.status, await r.json());
 r=await fetch(B+'api/admin/logo',{method:'POST',body:fs.readFileSync('test_logo.svg')}); console.log('ohne header', r.status);
 r=await fetch(B+'api/admin/logo',{method:'POST',headers:H(),body:fs.readFileSync('test_logo.svg')}); const d=await r.json(); console.log('ok', r.status, d);
 r=await fetch(B+d.logo); const t=await r.text(); console.log(r.headers.get('content-type'), r.headers.get('content-security-policy')); console.log(t);
 console.log('tablet', (await (await fetch(B+'api/tablet/state')).json()).logo);
 r=await fetch(B+'api/admin/audit',{headers:H()}); console.log(JSON.stringify(await r.json()).slice(0,300));
})();
