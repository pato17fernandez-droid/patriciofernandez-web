const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const enc=new TextEncoder();
const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
async function sha256(s){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
function cookie(req,name){const raw=req.headers.get('cookie')||'';for(const part of raw.split(';')){const [k,...v]=part.trim().split('=');if(k===name)return v.join('=')}return''}
export async function onRequestPost({request,env}){
  try{
    const token=cookie(request,'pan_session');
    if(token&&env.DB){const hash=await sha256(token);await env.DB.prepare('DELETE FROM pan_auth_sessions WHERE token_hash=?').bind(hash).run()}
  }catch{}
  return json({ok:true},200,{'set-cookie':'pan_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
}
