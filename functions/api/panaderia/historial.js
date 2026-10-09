import { seedClients } from './seed-clients.js';
import { seedSepA } from './seed-sep-a.js';
import { seedSepB } from './seed-sep-b.js';
import { seedOct } from './seed-oct.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function ensureSchema(DB){
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_clientes (
      id TEXT PRIMARY KEY,nombre TEXT NOT NULL,rut TEXT DEFAULT '',giro TEXT DEFAULT '',direccion TEXT DEFAULT '',
      comuna TEXT DEFAULT '',telefono TEXT DEFAULT '',contacto TEXT DEFAULT '',ruta TEXT DEFAULT '',zona TEXT DEFAULT '',
      precio_hallulla INTEGER NOT NULL DEFAULT 0,precio_marraqueta INTEGER NOT NULL DEFAULT 0,precio_ciabatta INTEGER NOT NULL DEFAULT 0,
      precio_medio_baguette INTEGER NOT NULL DEFAULT 0,precio_pan_completo INTEGER NOT NULL DEFAULT 0,
      horno INTEGER NOT NULL DEFAULT 0,activo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_pedidos (
      id INTEGER PRIMARY KEY,cliente_id TEXT NOT NULL,hallulla REAL NOT NULL DEFAULT 0,marraqueta REAL NOT NULL DEFAULT 0,
      ciabatta REAL NOT NULL DEFAULT 0,medio_baguette REAL NOT NULL DEFAULT 0,pan_completo REAL NOT NULL DEFAULT 0,
      fecha_entrega TEXT NOT NULL,estado TEXT NOT NULL DEFAULT 'Pendiente',observaciones TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_historial (
      id TEXT PRIMARY KEY,cliente_id TEXT NOT NULL,fecha TEXT NOT NULL,hallulla REAL NOT NULL DEFAULT 0,
      marraqueta REAL NOT NULL DEFAULT 0,ciabatta REAL NOT NULL DEFAULT 0,medio_baguette REAL NOT NULL DEFAULT 0,
      pan_completo REAL NOT NULL DEFAULT 0,numero_guia TEXT DEFAULT '',monto_guia INTEGER NOT NULL DEFAULT 0,
      pagado INTEGER NOT NULL DEFAULT 0,origen TEXT NOT NULL DEFAULT 'Excel histórico',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_guias (
      id TEXT PRIMARY KEY,numero TEXT NOT NULL,cliente_id TEXT NOT NULL,fecha TEXT NOT NULL,
      kilos REAL NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT 0,pagado INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'Pendiente',observaciones TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_meta (clave TEXT PRIMARY KEY,valor TEXT DEFAULT '')`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_historial_fecha ON pan_historial(fecha)`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_historial_cliente ON pan_historial(cliente_id)`)
  ]);
}

async function addColumn(DB,table,def){
  const name=def.trim().split(/\s+/)[0];
  const info=await DB.prepare(`PRAGMA table_info(${table})`).all();
  if(!(info.results||[]).some(c=>c.name===name)) await DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${def}`).run();
}

async function syncClients(DB){
  await addColumn(DB,'pan_clientes',"zona TEXT DEFAULT ''");
  await addColumn(DB,'pan_clientes','precio_hallulla INTEGER NOT NULL DEFAULT 0');
  await addColumn(DB,'pan_clientes','precio_marraqueta INTEGER NOT NULL DEFAULT 0');
  await addColumn(DB,'pan_clientes','precio_ciabatta INTEGER NOT NULL DEFAULT 0');
  await addColumn(DB,'pan_clientes','precio_medio_baguette INTEGER NOT NULL DEFAULT 0');
  await addColumn(DB,'pan_clientes','precio_pan_completo INTEGER NOT NULL DEFAULT 0');
  const stmts=seedClients.map(c=>DB.prepare(`INSERT INTO pan_clientes
    (id,nombre,rut,zona,ruta,precio_hallulla,precio_marraqueta,precio_ciabatta,precio_medio_baguette,precio_pan_completo,activo)
    VALUES (?,?,?,?,?,?,?,?,?,?,1)
    ON CONFLICT(id) DO UPDATE SET
      nombre=excluded.nombre,
      rut=CASE WHEN excluded.rut<>'' THEN excluded.rut ELSE pan_clientes.rut END,
      zona=CASE WHEN excluded.zona<>'' THEN excluded.zona ELSE pan_clientes.zona END,
      ruta=CASE WHEN excluded.ruta<>'' THEN excluded.ruta ELSE pan_clientes.ruta END,
      precio_hallulla=excluded.precio_hallulla,precio_marraqueta=excluded.precio_marraqueta,precio_ciabatta=excluded.precio_ciabatta,
      precio_medio_baguette=excluded.precio_medio_baguette,precio_pan_completo=excluded.precio_pan_completo`)
    .bind(c[0],c[1],c[2],c[3],c[4],c[5],c[6],c[7],c[8]||0,c[9]||0));
  for(let i=0;i<stmts.length;i+=75) await DB.batch(stmts.slice(i,i+75));
}

function rowStatement(DB,r,i){
  const [date,ci,h,m,c,b,p,guide,amount,paidFlag]=r;
  const kg=Number(h||0)+Number(m||0)+Number(c||0)+Number(b||0)+Number(p||0);
  if(kg<=0&&Number(amount||0)<=0)return null;
  const client=seedClients[ci]; if(!client)return null;
  const id=`hist-${date}-${client[0]}-${guide||i}`;
  return DB.prepare(`INSERT OR REPLACE INTO pan_historial
    (id,cliente_id,fecha,hallulla,marraqueta,ciabatta,medio_baguette,pan_completo,numero_guia,monto_guia,pagado)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id,client[0],date,Number(h||0),Number(m||0),Number(c||0),Number(b||0),Number(p||0),String(guide||''),Number(amount||0),paidFlag?1:0);
}

function guideStatement(DB,r){
  const [date,ci,h,m,c,b,p,guide,amount,paidFlag]=r;
  if(!guide||!seedClients[ci])return null;
  const clientId=seedClients[ci][0],kg=Number(h||0)+Number(m||0)+Number(c||0)+Number(b||0)+Number(p||0);
  const gid=`hist-${date}-${clientId}-${guide}`,paid=paidFlag?Number(amount||0):0;
  return DB.prepare(`INSERT OR REPLACE INTO pan_guias (id,numero,cliente_id,fecha,kilos,total,pagado,estado,observaciones)
    VALUES (?,?,?,?,?,?,?,?,?)`).bind(gid,String(guide),clientId,date,kg,Number(amount||0),paid,paidFlag?'Pagada':'Pendiente','Importado desde Excel histórico');
}

async function seedBase(DB){
  const marker=await DB.prepare("SELECT valor FROM pan_meta WHERE clave='historial_separado_v2'").first();
  if(marker)return;
  const rows=[...seedSepA,...seedSepB,...seedOct],stmts=rows.map((r,i)=>rowStatement(DB,r,i)).filter(Boolean);
  for(let i=0;i<stmts.length;i+=75)await DB.batch(stmts.slice(i,i+75));
  await DB.batch([
    DB.prepare("DELETE FROM pan_pedidos WHERE observaciones='Importado desde Excel histórico'"),
    DB.prepare("DELETE FROM pan_guias WHERE observaciones='Importado desde Excel histórico' AND kilos=0 AND total=0"),
    DB.prepare("INSERT OR REPLACE INTO pan_meta (clave,valor) VALUES ('historico_excel_2026_09_10','migrado_a_historial')"),
    DB.prepare("INSERT OR REPLACE INTO pan_meta (clave,valor) VALUES ('historial_separado_v2','ok')")
  ]);
}

const sepUnpaid=[["2026-09-01",4,"1"],["2026-09-02",4,"1"],["2026-09-03",4,"1"],["2026-09-04",4,"1"],["2026-09-05",4,"1"],["2026-09-07",4,"1"],["2026-09-08",4,"1"],["2026-09-09",4,"1"],["2026-09-10",4,"1"],["2026-09-11",4,"1"],["2026-09-12",4,"1"],["2026-09-14",4,"1"],["2026-09-15",4,"1"],["2026-09-16",4,"1"],["2026-09-17",4,"1"],["2026-09-18",4,"1"],["2026-09-19",4,"1"],["2026-09-21",4,"1"],["2026-09-22",4,"1"],["2026-09-23",4,"1"],["2026-09-24",4,"1"],["2026-09-25",4,"1"],["2026-09-26",4,"1"],["2026-09-28",4,"1"],["2026-09-29",4,"1"],["2026-09-30",4,"1"],["2026-09-07",2,"1"],["2026-09-17",2,"1641"],["2026-09-25",5,"1688"],["2026-09-28",5,"1718"],["2026-09-28",13,"1708"],["2026-09-29",21,"1728"],["2026-09-25",17,"1695"],["2026-09-26",18,"1707"],["2026-09-16",7,"1614"],["2026-09-28",7,"1709"],["2026-09-30",6,"1734"],["2026-09-29",26,"1723"],["2026-09-17",3,"1630"],["2026-09-22",3,"1658"],["2026-09-29",3,"1726"]];

async function syncLatestExcel(DB){
  const marker=await DB.prepare("SELECT valor FROM pan_meta WHERE clave='excel_actualizado_2026_10_09_v1'").first();
  if(marker)return;

  const octHist=seedOct.map((r,i)=>rowStatement(DB,r,i)).filter(Boolean);
  const octGuides=seedOct.map(r=>guideStatement(DB,r)).filter(Boolean);

  await DB.batch([
    DB.prepare("DELETE FROM pan_historial WHERE fecha LIKE '2026-10-%'"),
    DB.prepare("DELETE FROM pan_guias WHERE fecha LIKE '2026-10-%' AND observaciones='Importado desde Excel histórico'"),
    DB.prepare("UPDATE pan_historial SET pagado=1 WHERE fecha LIKE '2026-09-%'"),
    DB.prepare("UPDATE pan_guias SET pagado=total,estado='Pagada' WHERE fecha LIKE '2026-09-%' AND observaciones='Importado desde Excel histórico'")
  ]);

  const unpaid=[];
  for(const [date,ci,guide] of sepUnpaid){
    const c=seedClients[ci]; if(!c)continue;
    const id=`hist-${date}-${c[0]}-${guide}`;
    unpaid.push(DB.prepare("UPDATE pan_historial SET pagado=0 WHERE id=?").bind(id));
    unpaid.push(DB.prepare("UPDATE pan_guias SET pagado=0,estado='Pendiente' WHERE id=?").bind(id));
  }
  for(let i=0;i<unpaid.length;i+=75)await DB.batch(unpaid.slice(i,i+75));
  for(let i=0;i<octHist.length;i+=75)await DB.batch(octHist.slice(i,i+75));
  for(let i=0;i<octGuides.length;i+=75)await DB.batch(octGuides.slice(i,i+75));
  await DB.prepare("INSERT OR REPLACE INTO pan_meta (clave,valor) VALUES ('excel_actualizado_2026_10_09_v1','ok')").run();
}

export async function onRequestGet({env}){
  try{
    if(!env.DB)return json({error:'Binding D1 DB no configurado'},500);
    await ensureSchema(env.DB);await syncClients(env.DB);await seedBase(env.DB);await syncLatestExcel(env.DB);
    const r=await env.DB.prepare(`SELECT h.*,c.nombre AS cliente_nombre FROM pan_historial h LEFT JOIN pan_clientes c ON c.id=h.cliente_id ORDER BY h.fecha DESC,h.cliente_id`).all();
    return json({history:(r.results||[]).map(x=>({id:x.id,clientId:x.cliente_id,clientName:x.cliente_nombre||'',date:x.fecha,hallulla:x.hallulla,marraqueta:x.marraqueta,ciabatta:x.ciabatta,medioBaguette:x.medio_baguette,panCompleto:x.pan_completo,guide:x.numero_guia,amount:x.monto_guia,paid:!!x.pagado}))});
  }catch(e){return json({error:e.message||'Error historial D1'},500)}
}
