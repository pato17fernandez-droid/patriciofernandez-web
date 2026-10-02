import { seedClients } from './seed-clients.js';
import { seedSepA } from './seed-sep-a.js';
import { seedSepB } from './seed-sep-b.js';
import { seedOct } from './seed-oct.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function ensureSchema(DB){
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_historial (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      fecha TEXT NOT NULL,
      hallulla REAL NOT NULL DEFAULT 0,
      marraqueta REAL NOT NULL DEFAULT 0,
      ciabatta REAL NOT NULL DEFAULT 0,
      medio_baguette REAL NOT NULL DEFAULT 0,
      pan_completo REAL NOT NULL DEFAULT 0,
      numero_guia TEXT DEFAULT '',
      monto_guia INTEGER NOT NULL DEFAULT 0,
      pagado INTEGER NOT NULL DEFAULT 0,
      origen TEXT NOT NULL DEFAULT 'Excel histórico',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_historial_fecha ON pan_historial(fecha)`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_historial_cliente ON pan_historial(cliente_id)`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_meta (clave TEXT PRIMARY KEY,valor TEXT DEFAULT '')`)
  ]);
}

async function seed(DB){
  const marker=await DB.prepare("SELECT valor FROM pan_meta WHERE clave='historial_separado_v2'").first();
  if(marker) return;

  const rows=[...seedSepA,...seedSepB,...seedOct];
  const stmts=[];
  rows.forEach((r,i)=>{
    const [date,ci,h,m,c,b,p,guide,amount,paidFlag]=r;
    const kg=Number(h||0)+Number(m||0)+Number(c||0)+Number(b||0)+Number(p||0);
    if(kg<=0 && Number(amount||0)<=0) return;
    const client=seedClients[ci];
    if(!client) return;
    const clientId=client[0];
    const id=`hist-${date}-${clientId}-${guide||i}`;
    stmts.push(DB.prepare(`INSERT OR IGNORE INTO pan_historial
      (id,cliente_id,fecha,hallulla,marraqueta,ciabatta,medio_baguette,pan_completo,numero_guia,monto_guia,pagado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(
        id,clientId,date,Number(h||0),Number(m||0),Number(c||0),Number(b||0),Number(p||0),String(guide||''),Number(amount||0),paidFlag?1:0
      ));
  });

  for(let i=0;i<stmts.length;i+=75) await DB.batch(stmts.slice(i,i+75));

  await DB.batch([
    DB.prepare("DELETE FROM pan_pedidos WHERE observaciones='Importado desde Excel histórico'"),
    DB.prepare("DELETE FROM pan_guias WHERE observaciones='Importado desde Excel histórico' AND kilos=0 AND total=0"),
    DB.prepare("INSERT OR REPLACE INTO pan_meta (clave,valor) VALUES ('historico_excel_2026_09_10','migrado_a_historial')"),
    DB.prepare("INSERT OR REPLACE INTO pan_meta (clave,valor) VALUES ('historial_separado_v1','ok')"),
    DB.prepare("INSERT OR REPLACE INTO pan_meta (clave,valor) VALUES ('historial_separado_v2','ok')")
  ]);
}

export async function onRequestGet({env}){
  try{
    if(!env.DB) return json({error:'Binding D1 DB no configurado'},500);
    await ensureSchema(env.DB);
    await seed(env.DB);
    const r=await env.DB.prepare(`SELECT h.*,c.nombre AS cliente_nombre
      FROM pan_historial h LEFT JOIN pan_clientes c ON c.id=h.cliente_id
      ORDER BY h.fecha DESC,h.cliente_id`).all();
    return json({history:(r.results||[]).map(x=>({
      id:x.id,clientId:x.cliente_id,clientName:x.cliente_nombre||'',date:x.fecha,
      hallulla:x.hallulla,marraqueta:x.marraqueta,ciabatta:x.ciabatta,
      medioBaguette:x.medio_baguette,panCompleto:x.pan_completo,
      guide:x.numero_guia,amount:x.monto_guia,paid:!!x.pagado
    }))});
  }catch(e){return json({error:e.message||'Error historial D1'},500)}
}
