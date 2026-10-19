const enc=new TextEncoder();
const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
async function sha256(s){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
function getCookie(req,name){const raw=req.headers.get('cookie')||'';for(const part of raw.split(';')){const [k,...v]=part.trim().split('=');if(k===name)return v.join('=')}return''}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export async function onRequest({request,env,next}){
  try{
    if(!env.DB)return json({error:'Base de datos no disponible'},500);
    const token=getCookie(request,'pan_session');
    if(!token)return json({error:'No autorizado'},401);
    const hash=await sha256(token),now=Date.now();
    const s=await env.DB.prepare('SELECT usuario,expires_at FROM pan_auth_sessions WHERE token_hash=?').bind(hash).first();
    if(!s||Number(s.expires_at||0)<=now){
      if(s)await env.DB.prepare('DELETE FROM pan_auth_sessions WHERE token_hash=?').bind(hash).run();
      return json({error:'Sesión vencida'},401);
    }
    if(!['GET','HEAD','OPTIONS'].includes(request.method)){
      const origin=request.headers.get('origin');
      if(origin){
        const url=new URL(request.url);
        if(origin!==url.origin)return json({error:'Origen no permitido'},403);
      }
    }
    await env.DB.prepare('UPDATE pan_auth_sessions SET last_seen=? WHERE token_hash=?').bind(now,hash).run();
    return next();
  }catch(e){return json({error:'No autorizado'},401)}
}
