const http=require('http'); const files=new Map(); const log=[];
http.createServer((req,res)=>{let b=[];req.on('data',c=>b.push(c));req.on('end',()=>{
  const body=Buffer.concat(b); const u=req.url; const J=(o,c=200)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(o));};
  log.push(u);
  if(u==='/oauth2/token'){const p=new URLSearchParams(body.toString());
    if(p.get('client_secret')!=='secretsecret12') return J({error:'invalid_client',error_description:'Invalid client_id or client_secret'},400);
    if(p.get('grant_type')==='authorization_code') return p.get('code')==='GUTERCODE1234567890'?J({access_token:'a1',refresh_token:'r1',expires_in:14400}):J({error:'invalid_grant',error_description:'code doesn\'t exist or has expired'},400);
    if(p.get('grant_type')==='refresh_token') return p.get('refresh_token')==='r1'?J({access_token:'a1',expires_in:14400}):J({error:'invalid_grant'},400);}
  if(u==='/_files') return J([...files.entries()]);
  if(u==='/_seed'){ // alte Dateien zum Aufräumen
    files.set('/getränkekasse tc/excel/2020-01-01_getraenke-stand.xlsx',1); files.set('/getränkekasse tc/datenbank/2020-01-01_getraenke.db',1); return J({ok:1});}
  if(req.headers.authorization!=='Bearer a1') return J({error_summary:'invalid_access_token/'},401);
  if(u==='/2/users/get_current_account') return J({name:{display_name:'TC Grün-Weiß'},email:'vorstand@example.org'});
  if(u==='/2/files/upload'){const a=req.headers['dropbox-api-arg']; if(/[^\x00-\x7f]/.test(a)) return J({error_summary:'non-ascii header'},400);
    const arg=JSON.parse(a); files.set(arg.path.toLowerCase(),body.length); return J({name:arg.path.split('/').pop(),path_display:arg.path,size:body.length});}
  if(u==='/2/files/list_folder'){const a=JSON.parse(body); const pre=a.path.toLowerCase()+'/';
    const ents=[...files.keys()].filter(k=>k.startsWith(pre)&&!k.slice(pre.length).includes('/')).map(k=>({'.tag':'file',name:k.slice(pre.length),path_lower:k}));
    if(!ents.length) return J({error_summary:'path/not_found/..'},409); return J({entries:ents,has_more:false,cursor:'x'});}
  if(u==='/2/files/delete_v2'){const a=JSON.parse(body); files.delete(a.path); return J({metadata:{}});}
  if(u==='/2/auth/token/revoke') return J(null);
  J({error_summary:'unknown '+u},404);
});}).listen(3299,()=>console.log('fake dropbox 3299'));
