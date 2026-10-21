// Dropbox-Attrappe mit Inhalten (Upload, Upload-Sitzung, Download, Liste, Löschen)
const http=require('http'); const files=new Map(); const sess=new Map(); const PORT=+process.argv[2]||3298;
http.createServer((req,res)=>{let b=[];req.on('data',c=>b.push(c));req.on('end',()=>{
  const body=Buffer.concat(b); const u=req.url; const J=(o,c=200)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(o));};
  if(u==='/oauth2/token'){const p=new URLSearchParams(body.toString());
    if(p.get('grant_type')==='authorization_code') return p.get('code')==='GUTERCODE1234567890'?J({access_token:'a1',refresh_token:'r1',expires_in:14400}):J({error:'invalid_grant'},400);
    return J({access_token:'a1',expires_in:14400});}
  if(u==='/_files') return J([...files.entries()].map(([k,v])=>[k,v.length]));
  if(u==='/_seed'){ files.set('/clubwerk/datenbank/2020-01-01_getraenke.db',Buffer.from('x')); files.set('/clubwerk/excel/2020-01-01_getraenke-stand.xlsx',Buffer.from('x'));
    for(let i=1;i<=40;i++){const d=new Date(Date.UTC(2026,0,1)+i*86400000*3).toISOString().slice(0,10); files.set(`/clubwerk/komplett/${d}_clubwerk.cwbackup`,Buffer.from('alt'));} return J({ok:1});}
  if(req.headers.authorization!=='Bearer a1') return J({error_summary:'invalid_access_token/'},401);
  const arg=()=>JSON.parse(req.headers['dropbox-api-arg']||'{}');
  if(u==='/2/users/get_current_account') return J({name:{display_name:'TC'},email:'vorstand@example.org'});
  if(u==='/2/files/upload'){const a=arg(); files.set(a.path.toLowerCase(),body); return J({name:a.path.split('/').pop(),size:body.length});}
  if(u==='/2/files/upload_session/start'){const id='s'+Math.random(); sess.set(id,[body]); return J({session_id:id});}
  if(u==='/2/files/upload_session/append_v2'){const a=arg(); sess.get(a.cursor.session_id).push(body); return J(null);}
  if(u==='/2/files/upload_session/finish'){const a=arg(); const all=Buffer.concat([...sess.get(a.cursor.session_id),body]); files.set(a.commit.path.toLowerCase(),all); return J({size:all.length});}
  if(u==='/2/files/download'){const a=arg(); const f=files.get(a.path.toLowerCase()); if(!f) return J({error_summary:'path/not_found/'},409); res.writeHead(200,{'Content-Type':'application/octet-stream'}); return res.end(f);}
  if(u==='/2/files/list_folder'){const a=JSON.parse(body); const pre=a.path.toLowerCase()+'/';
    const ents=[...files.keys()].filter(k=>k.startsWith(pre)&&!k.slice(pre.length).includes('/')).map(k=>({'.tag':'file',name:k.slice(pre.length).replace('clubwerk.cwbackup','Clubwerk.cwbackup'),path_lower:k,size:files.get(k).length,server_modified:new Date().toISOString()}));
    if(!ents.length) return J({error_summary:'path/not_found/..'},409); return J({entries:ents,has_more:false,cursor:'x'});}
  if(u==='/2/files/delete_v2'){const a=JSON.parse(body); files.delete(a.path); return J({metadata:{}});}
  if(u==='/2/auth/token/revoke') return J(null);
  J({error_summary:'unknown '+u},404);
});}).listen(PORT,()=>console.log('fake dropbox',PORT));
