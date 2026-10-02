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
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_meta (clave TEXT PRIMARY KEY,valor TEXT DEFAULT '')`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_guias (
      id TEXT PRIMARY KEY,numero TEXT NOT NULL,cliente_id TEXT NOT NULL,fecha TEXT NOT NULL,
      kilos REAL NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT 0,pagado INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'Pendiente',observaciones TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  ]);
}

function rowStatement(DB,r,i){
  const [date,ci,h,m,c,b,p,guide,amount,paidFlag]=r;
  const kg=Number(h||0)+Number(m||0)+Number(c||0)+Number(b||0)+Number(p||0);
  if(kg<=0 && Number(amount||0)<=0) return null;
  const client=seedClients[ci];
  if(!client) return null;
  const clientId=client[0];
  const id=`hist-${date}-${clientId}-${guide||i}`;
  return DB.prepare(`INSERT OR REPLACE INTO pan_historial
    (id,cliente_id,fecha,hallulla,marraqueta,ciabatta,medio_baguette,pan_completo,numero_guia,monto_guia,pagado)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id,clientId,date,Number(h||0),Number(m||0),Number(c||0),Number(b||0),Number(p||0),String(guide||''),Number(amount||0),paidFlag?1:0
    );
}

async function seedBase(DB){
  const marker=await DB.prepare("SELECT valor FROM pan_meta WHERE clave='historial_separado_v2'").first();
  if(marker) return;
  const rows=[...seedSepA,...seedSepB,...seedOct];
  const stmts=rows.map((r,i)=>rowStatement(DB,r,i)).filter(Boolean);
  for(let i=0;i<stmts.length;i+=75) await DB.batch(stmts.slice(i,i+75));
  await DB.batch([
    DB.prepare("DELETE FROM pan_pedidos WHERE observaciones='Importado desde Excel histórico'"),
    DB.prepare("DELETE FROM pan_guias WHERE observaciones='Importado desde Excel histórico' AND kilos=0 AND total=0"),
    DB.prepare("INSERT OR REPLACE INTO pan_meta (clave,valor) VALUES ('historico_excel_2026_09_10','migrado_a_historial')"),
    DB.prepare("INSERT OR REPLACE INTO pan_meta (clave,valor) VALUES ('historial_separado_v2','ok')")
  ]);
}

async function syncUpdatedOctober(DB){
  const marker=await DB.prepare("SELECT valor FROM pan_meta WHERE clave='octubre_excel_actualizado_2026_10_02_v1'").first();
  if(marker) return;

  await DB.batch([
    DB.prepare("DELETE FROM pan_historial WHERE fecha LIKE '2026-10-%'"),
    DB.prepare("DELETE FROM pan_guias WHERE fecha LIKE '2026-10-%' AND observaciones='Importado desde Excel histórico' AND kilos=0 AND total=0")
  ]);

  const hist=[];
  const guides=[];
  seedOct.forEach((r,i)=>{
    const hs=rowStatement(DB,r,i);
    if(hs) hist.push(hs);
    const [date,ci,h,m,c,b,p,guide,amount,paidFlag]=r;
    if(!guide) return;
    const client=seedClients[ci];
    if(!client) return;
    const clientId=client[0];
    const gid=`hist-${date}-${clientId}-${guide}`;
    const kg=Number(h||0)+Number(m||0)+Number(c||0)+Number(b||0)+Number(p||0);
    const excelPaid=paidFlag?Number(amount||0):0;
    guides.push(DB.prepare(`INSERT INTO pan_guias (id,numero,cliente_id,fecha,kilos,total,pagado,estado,observaciones)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        numero=excluded.numero,cliente_id=excluded.cliente_id,fecha=excluded.fecha,kilos=excluded.kilos,total=excluded.total,
        pagado=CASE WHEN pan_guias.pagado>excluded.pagado THEN pan_guias.pagado ELSE excluded.pagado END,
        estado=CASE WHEN (CASE WHEN pan_guias.pagado>excluded.pagado THEN pan_guias.pagado ELSE excluded.pagado END)>=excluded.total AND excluded.total>0 THEN 'Pagada' ELSE 'Pendiente' END,
        observaciones='Importado desde Excel histórico'`).bind(
          gid,String(guide),clientId,date,kg,Number(amount||0),excelPaid,paidFlag?'Pagada':'Pendiente','Importado desde Excel histórico'
        ));
  });

  for(let i=0;i<hist.length;i+=75) await DB.batch(hist.slice(i,i+75));
  for(let i=0;i<guides.length;i+=75) await DB.batch(guides.slice(i,i+75));
  await DB.prepare("INSERT OR REPLACE INTO pan_meta (clave,valor) VALUES ('octubre_excel_actualizado_2026_10_02_v1','ok')").run();
}

export async function onRequestGet({env}){
  try{
    if(!env.DB) return json({error:'Binding D1 DB no configurado'},500);
    await ensureSchema(env.DB);
    await seedBase(env.DB);
    await syncUpdatedOctober(env.DB);
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
