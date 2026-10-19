const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const enc=new TextEncoder();
const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
async function sha256(s){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
function cookie(req,name){const raw=req.headers.get('cookie')||'';for(const part of raw.split(';')){const [k,...v]=part.trim().split('=');if(k===name)return v.join('=')}return''}
export async function onRequestGet({request,env}){
  try{
    if(!env.DB)return json({authenticated:false},401);
    const token=cookie(request,'pan_session');if(!token)return json({authenticated:false},401);
    const hash=await sha256(token),now=Date.now();
    const s=await env.DB.prepare('SELECT usuario,expires_at FROM pan_auth_sessions WHERE token_hash=?').bind(hash).first();
    if(!s||Number(s.expires_at||0)<=now){
      if(s)await env.DB.prepare('DELETE FROM pan_auth_sessions WHERE token_hash=?').bind(hash).run();
      return json({authenticated:false},401,{'set-cookie':'pan_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
    }
    return json({authenticated:true,user:s.usuario,expiresAt:Number(s.expires_at)});
  }catch{return json({authenticated:false},401)}
}
