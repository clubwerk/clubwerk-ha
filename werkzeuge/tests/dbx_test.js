const B='http://localhost:3199/'; let fails=0; const ok=(n,c,x='')=>{console.log((c?'✔ ':'✘ ')+n+(x?'  '+String(x).slice(0,150):'')); if(!c) fails++;};
let ck=''; async function c(url,method='GET',body){const h={'X-Getraenke':'1',Cookie:ck}; if(body!==undefined)h['Content-Type']='application/json';
  const r=await fetch(B+url,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(sc) ck=sc.split(';')[0]; return [r.status, await r.json().catch(()=>({}))];}
(async()=>{
  await c('api/admin/setup','POST',{username:'thorsten',name:'T',password:'Test-Kennwort-42'});
  let [s,j]=await c('api/admin/dropbox'); ok('Status: nicht verbunden', s===200 && !j.connected && !j.authUrl);
  [s,j]=await c('api/admin/dropbox','PUT',{appKey:'abc def'}); ok('ungültiger App key abgelehnt', s===400);
  [s,j]=await c('api/admin/dropbox','PUT',{appKey:'appkey12345',appSecret:'secretsecret12'}); ok('Schlüssel gespeichert', s===200);
  [s,j]=await c('api/admin/dropbox'); ok('Freigabe-Link erzeugt, Secret wird nicht zurückgegeben', j.authUrl.includes('client_id=appkey12345') && j.authUrl.includes('token_access_type=offline') && !JSON.stringify(j).includes('secretsecret'), j.authUrl);
  [s,j]=await c('api/admin/dropbox/connect','POST',{code:'FALSCHERCODE123456'}); ok('falscher Code → verständlicher Fehler', s===400, j.error);
  [s,j]=await c('api/admin/dropbox/connect','POST',{code:'GUTERCODE1234567890'}); ok('verbunden', s===200 && j.account.includes('vorstand@'), j.account);
  [s,j]=await c('api/admin/dropbox','PUT',{folder:'/Getränkekasse TC/../', keep:30}); 
  [s,j]=await c('api/admin/dropbox'); ok('Ordner bereinigt (Umlaut bleibt)', j.folder==='/Getränkekasse TC', j.folder);
  await fetch('http://localhost:3299/_seed');
  [s,j]=await c('api/admin/dropbox/run','POST',{}); ok('Jetzt hochladen', s===200, j.msg||j.error);
  const files=await (await fetch('http://localhost:3299/_files')).json();
  ok('Excel + Datenbank in Dropbox, alte gelöscht', files.some(f=>/excel\/\d{4}-\d\d-\d\d_getraenke-stand\.xlsx/.test(f[0])) && files.some(f=>/datenbank\/\d{4}-\d\d-\d\d_getraenke\.db/.test(f[0])) && !files.some(f=>f[0].includes('2020-01-01')), JSON.stringify(files));
  [s,j]=await c('api/admin/dropbox'); ok('Status zeigt letzten Export', j.last_ok && j.last_msg && !j.last_error, j.last_msg);
  [s,j]=await c('api/admin/audit'); ok('Protokoll', JSON.stringify(j).includes('Dropbox-Export'));
  [s,j]=await c('api/admin/dropbox/disconnect','POST',{}); [s,j]=await c('api/admin/dropbox'); ok('getrennt', !j.connected);
  [s,j]=await c('api/admin/dropbox/run','POST',{}); ok('ohne Verbindung kein Upload', s===400, j.error);
  console.log(fails? fails+' FEHLER':'alles ok');
})();
