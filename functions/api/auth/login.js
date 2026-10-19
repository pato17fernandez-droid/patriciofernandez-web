const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});

const enc=new TextEncoder();
const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
async function sha256(s){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
function randomToken(){const a=new Uint8Array(32);crypto.getRandomValues(a);return [...a].map(b=>b.toString(16).padStart(2,'0')).join('')}
function same(a,b){
  a=String(a||'');b=String(b||'');
  const n=Math.max(a.length,b.length);let d=a.length^b.length;
  for(let i=0;i<n;i++)d|=(a.charCodeAt(i%Math.max(1,a.length))||0)^(b.charCodeAt(i%Math.max(1,b.length))||0);
  return d===0;
}
async function ensure(DB){
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_auth_sessions (
      token_hash TEXT PRIMARY KEY,
      usuario TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      ip_hash TEXT DEFAULT ''
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_auth_attempts (
      attempt_key TEXT PRIMARY KEY,
      fail_count INTEGER NOT NULL DEFAULT 0,
      window_start INTEGER NOT NULL,
      blocked_until INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )`)
  ]);
}
export async function onRequestPost({request,env}){
  try{
    if(!env.DB)return json({error:'Base de datos no disponible'},500);
    if(!env.PANADERIA_ADMIN_PASSWORD)return json({error:'Seguridad no configurada. Falta PANADERIA_ADMIN_PASSWORD en Cloudflare.'},503);
    await ensure(env.DB);
    const body=await request.json().catch(()=>({}));
    const user=String(body?.username||'').trim();
    const pass=String(body?.password||'');
    const expectedUser=String(env.PANADERIA_ADMIN_USER||'admin');
    const ip=request.headers.get('CF-Connecting-IP')||request.headers.get('x-forwarded-for')||'unknown';
    const key=await sha256(user.toLowerCase()+'|'+ip);
    const now=Date.now(),windowMs=15*60*1000,blockMs=15*60*1000;
    let row=await env.DB.prepare('SELECT * FROM pan_auth_attempts WHERE attempt_key=?').bind(key).first();

    if(row&&Number(row.blocked_until||0)>now){
      const retry=Math.ceil((Number(row.blocked_until)-now)/1000);
      return json({error:'Demasiados intentos. Intenta nuevamente más tarde.',retryAfter:retry},429,{'retry-after':String(retry)});
    }

    const ok=same(user,expectedUser)&&same(pass,String(env.PANADERIA_ADMIN_PASSWORD));
    if(!ok){
      let count=1,start=now;
      if(row&&now-Number(row.window_start||0)<=windowMs){count=Number(row.fail_count||0)+1;start=Number(row.window_start||now)}
      const blocked=count>=5?now+blockMs:0;
      await env.DB.prepare(`INSERT INTO pan_auth_attempts (attempt_key,fail_count,window_start,blocked_until,updated_at)
        VALUES (?,?,?,?,?) ON CONFLICT(attempt_key) DO UPDATE SET fail_count=excluded.fail_count,window_start=excluded.window_start,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at`)
        .bind(key,count,start,blocked,now).run();
      if(blocked)return json({error:'Demasiados intentos fallidos. Acceso bloqueado por 15 minutos.',retryAfter:900},429,{'retry-after':'900'});
      return json({error:`Usuario o contraseña incorrectos. Quedan ${Math.max(0,5-count)} intentos antes del bloqueo.`},401);
    }

    await env.DB.prepare('DELETE FROM pan_auth_attempts WHERE attempt_key=?').bind(key).run();
    const token=randomToken(),hash=await sha256(token),expires=now+12*60*60*1000,ipHash=await sha256(ip);
    await env.DB.prepare('DELETE FROM pan_auth_sessions WHERE expires_at<?').bind(now).run();
    await env.DB.prepare('INSERT INTO pan_auth_sessions (token_hash,usuario,created_at,expires_at,last_seen,ip_hash) VALUES (?,?,?,?,?,?)')
      .bind(hash,user,now,expires,now,ipHash).run();
    const cookie=`pan_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`;
    return json({ok:true,user,expiresAt:expires},200,{'set-cookie':cookie});
  }catch(e){return json({error:e.message||'Error iniciando sesión'},500)}
}
