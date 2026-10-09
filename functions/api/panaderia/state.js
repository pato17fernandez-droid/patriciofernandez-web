import { seedClients } from './seed-clients.js';
import { seedSepA } from './seed-sep-a.js';
import { seedSepB } from './seed-sep-b.js';
import { seedOct } from './seed-oct.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

const SEP_PENDING_GUIDES=new Set([
  'hist-2026-09-17-cli-don-juan-melipeuco-1641',
  'hist-2026-09-17-cli-el-huerto-jaramillo-1630',
  'hist-2026-09-22-cli-el-huerto-jaramillo-1658',
  'hist-2026-09-29-cli-el-huerto-jaramillo-1726',
  'hist-2026-09-25-cli-el-refugio-1688',
  'hist-2026-09-28-cli-el-refugio-1718',
  'hist-2026-09-30-cli-fredy-1734',
  'hist-2026-09-16-cli-hernan-astorga-pucon-1614',
  'hist-2026-09-28-cli-hernan-astorga-pucon-1709',
  'hist-2026-09-28-cli-km-06-1708',
  'hist-2026-09-25-cli-maria-flores-1695',
  'hist-2026-09-26-cli-maria-flores-cunco-1707',
  'hist-2026-09-29-cli-rustico-1728',
  'hist-2026-09-29-cli-tote-1723'
]);

function normalizeGuide(x){
  const raw={id:x.id,number:x.numero,clientId:x.cliente_id,date:x.fecha,kg:x.kilos,total:x.total,paid:x.pagado,status:x.estado,notes:x.observaciones};
  if(x.cliente_id==='cli-el-laurel')return raw;
  const sep=String(x.fecha||'').slice(0,7)==='2026-09';
  if(!sep)return raw;
  const pending=SEP_PENDING_GUIDES.has(x.id);
  return {...raw,paid:pending?0:Number(x.total||0),status:pending?'Pendiente':'Pagada'};
}

async function addColumn(DB,table,def){
  const name=def.trim().split(/\s+/)[0];
  const info=await DB.prepare(`PRAGMA table_info(${table})`).all();
  if(!(info.results||[]).some(c=>c.name===name))await DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${def}`).run();
}

async function ensureSchema(DB){
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_clientes (id TEXT PRIMARY KEY,nombre TEXT NOT NULL,rut TEXT DEFAULT '',giro TEXT DEFAULT '',direccion TEXT DEFAULT '',comuna TEXT DEFAULT '',telefono TEXT DEFAULT '',contacto TEXT DEFAULT '',ruta TEXT DEFAULT '',horno INTEGER NOT NULL DEFAULT 0,activo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_pedidos (id INTEGER PRIMARY KEY,cliente_id TEXT NOT NULL,hallulla REAL NOT NULL DEFAULT 0,marraqueta REAL NOT NULL DEFAULT 0,ciabatta REAL NOT NULL DEFAULT 0,fecha_entrega TEXT NOT NULL,estado TEXT NOT NULL DEFAULT 'Pendiente',observaciones TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(cliente_id) REFERENCES pan_clientes(id))`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_guias (id TEXT PRIMARY KEY,numero TEXT NOT NULL,cliente_id TEXT NOT NULL,fecha TEXT NOT NULL,kilos REAL NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT 0,pagado INTEGER NOT NULL DEFAULT 0,estado TEXT NOT NULL DEFAULT 'Pendiente',observaciones TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(cliente_id) REFERENCES pan_clientes(id))`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_pagos (id TEXT PRIMARY KEY,guia_id TEXT NOT NULL,cliente_id TEXT NOT NULL,fecha TEXT NOT NULL,monto INTEGER NOT NULL DEFAULT 0,medio TEXT DEFAULT '',observaciones TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(guia_id) REFERENCES pan_guias(id),FOREIGN KEY(cliente_id) REFERENCES pan_clientes(id))`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_bandejas (cliente_id TEXT PRIMARY KEY,entregadas INTEGER NOT NULL DEFAULT 0,devueltas INTEGER NOT NULL DEFAULT 0,ultimo_movimiento TEXT DEFAULT '',FOREIGN KEY(cliente_id) REFERENCES pan_clientes(id))`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_hornos (id TEXT PRIMARY KEY,cliente_id TEXT NOT NULL,modelo TEXT DEFAULT '',fecha_instalacion TEXT DEFAULT '',estado TEXT NOT NULL DEFAULT 'Operativo',observaciones TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(cliente_id) REFERENCES pan_clientes(id))`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_meta (clave TEXT PRIMARY KEY,valor TEXT DEFAULT '')`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_pedidos_cliente ON pan_pedidos(cliente_id)`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_pedidos_fecha ON pan_pedidos(fecha_entrega)`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_guias_cliente ON pan_guias(cliente_id)`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_guias_fecha ON pan_guias(fecha)`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_pagos_guia ON pan_pagos(guia_id)`)
  ]);
  for(const def of ["zona TEXT DEFAULT ''",'precio_hallulla INTEGER NOT NULL DEFAULT 0','precio_marraqueta INTEGER NOT NULL DEFAULT 0','precio_ciabatta INTEGER NOT NULL DEFAULT 0','precio_medio_baguette INTEGER NOT NULL DEFAULT 0','precio_pan_completo INTEGER NOT NULL DEFAULT 0'])await addColumn(DB,'pan_clientes',def);
  await addColumn(DB,'pan_pedidos','medio_baguette REAL NOT NULL DEFAULT 0');
  await addColumn(DB,'pan_pedidos','pan_completo REAL NOT NULL DEFAULT 0');
}

async function syncSeedClients(DB){
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
  for(let i=0;i<stmts.length;i+=75)await DB.batch(stmts.slice(i,i+75));
}

async function seedHistorical(DB){
  const marker=await DB.prepare("SELECT valor FROM pan_meta WHERE clave='historico_excel_2026_09_10'").first();
  if(marker)return;
  const rows=[...seedSepA,...seedSepB,...seedOct],statements=[];
  seedClients.forEach(c=>statements.push(DB.prepare(`INSERT OR IGNORE INTO pan_clientes (id,nombre,rut,zona,ruta,precio_hallulla,precio_marraqueta,precio_ciabatta,precio_medio_baguette,precio_pan_completo,activo) VALUES (?,?,?,?,?,?,?,?,?,?,1)`).bind(c[0],c[1],c[2],c[3],c[4],c[5],c[6],c[7],c[8]||0,c[9]||0)));
  rows.forEach((r,i)=>{
    const [date,ci,h,m,c,b,p,guide,amount,paidFlag]=r,client=seedClients[ci];if(!client)return;
    const clientId=client[0],orderId=Number(date.replaceAll('-',''))*1000+i+1;
    statements.push(DB.prepare(`INSERT OR IGNORE INTO pan_pedidos (id,cliente_id,hallulla,marraqueta,ciabatta,medio_baguette,pan_completo,fecha_entrega,estado,observaciones) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(orderId,clientId,h,m,c,b,p,date,'Entregado','Importado desde Excel histórico'));
    if(guide){
      const gid=`hist-${date}-${clientId}-${guide}`,kg=Number(h)+Number(m)+Number(c)+Number(b)+Number(p);
      statements.push(DB.prepare(`INSERT OR IGNORE INTO pan_guias (id,numero,cliente_id,fecha,kilos,total,pagado,estado,observaciones) VALUES (?,?,?,?,?,?,?,?,?)`).bind(gid,String(guide),clientId,date,kg,Number(amount||0),paidFlag?Number(amount||0):0,paidFlag?'Pagada':'Pendiente','Importado desde Excel histórico'));
    }
  });
  for(let i=0;i<statements.length;i+=75)await DB.batch(statements.slice(i,i+75));
  await DB.prepare("INSERT OR REPLACE INTO pan_meta (clave,valor) VALUES ('historico_excel_2026_09_10','ok')").run();
}

function normalize(body){const arr=k=>Array.isArray(body?.[k])?body[k]:[];return{clients:arr('clients'),orders:arr('orders'),guides:arr('guides'),payments:arr('payments'),trays:arr('trays'),ovens:arr('ovens')}}

export async function onRequestGet({env}){
  try{
    if(!env.DB)return json({error:'Binding D1 DB no configurado'},500);
    await ensureSchema(env.DB);await seedHistorical(env.DB);await syncSeedClients(env.DB);
    const [c,o,g,p,t,h]=await env.DB.batch([
      env.DB.prepare('SELECT * FROM pan_clientes ORDER BY nombre'),env.DB.prepare('SELECT * FROM pan_pedidos ORDER BY fecha_entrega DESC,id DESC'),
      env.DB.prepare('SELECT * FROM pan_guias ORDER BY fecha DESC,numero DESC'),env.DB.prepare('SELECT * FROM pan_pagos ORDER BY fecha DESC,created_at DESC'),
      env.DB.prepare('SELECT * FROM pan_bandejas'),env.DB.prepare('SELECT * FROM pan_hornos ORDER BY fecha_instalacion DESC')
    ]);
    return json({
      clients:(c.results||[]).map(x=>({id:x.id,name:x.nombre,rut:x.rut,business:x.giro,address:x.direccion,commune:x.comuna,phone:x.telefono,contact:x.contacto,route:x.ruta,zone:x.zona,priceHallulla:x.precio_hallulla,priceMarraqueta:x.precio_marraqueta,priceCiabatta:x.precio_ciabatta,priceMedioBaguette:x.precio_medio_baguette||0,pricePanCompleto:x.precio_pan_completo||0,oven:!!x.horno,active:!!x.activo})),
      orders:(o.results||[]).map(x=>({id:x.id,clientId:x.cliente_id,hallulla:x.hallulla,marraqueta:x.marraqueta,ciabatta:x.ciabatta,medioBaguette:x.medio_baguette||0,panCompleto:x.pan_completo||0,date:x.fecha_entrega,status:x.estado,notes:x.observaciones})),
      guides:(g.results||[]).map(normalizeGuide),
      payments:(p.results||[]).map(x=>({id:x.id,guideId:x.guia_id,clientId:x.cliente_id,date:x.fecha,amount:x.monto,method:x.medio,notes:x.observaciones})),
      trays:(t.results||[]).map(x=>({clientId:x.cliente_id,delivered:x.entregadas,returned:x.devueltas,last:x.ultimo_movimiento})),
      ovens:(h.results||[]).map(x=>({id:x.id,clientId:x.cliente_id,model:x.modelo,installed:x.fecha_instalacion,status:x.estado,notes:x.observaciones}))
    });
  }catch(e){return json({error:e.message||'Error D1'},500)}
}

export async function onRequestPost({request,env}){
  try{
    if(!env.DB)return json({error:'Binding D1 DB no configurado'},500);
    await ensureSchema(env.DB);const db=normalize(await request.json());
    const stmts=[env.DB.prepare('DELETE FROM pan_pagos'),env.DB.prepare('DELETE FROM pan_bandejas'),env.DB.prepare('DELETE FROM pan_hornos'),env.DB.prepare('DELETE FROM pan_guias'),env.DB.prepare('DELETE FROM pan_pedidos'),env.DB.prepare('DELETE FROM pan_clientes')];
    db.clients.forEach(x=>stmts.push(env.DB.prepare(`INSERT INTO pan_clientes (id,nombre,rut,giro,direccion,comuna,telefono,contacto,ruta,zona,precio_hallulla,precio_marraqueta,precio_ciabatta,precio_medio_baguette,precio_pan_completo,horno,activo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(x.id,x.name||'',x.rut||'',x.business||'',x.address||'',x.commune||'',x.phone||'',x.contact||'',x.route||'',x.zone||'',Number(x.priceHallulla||0),Number(x.priceMarraqueta||0),Number(x.priceCiabatta||0),Number(x.priceMedioBaguette||0),Number(x.pricePanCompleto||0),x.oven?1:0,x.active===false?0:1)));
    db.orders.forEach(x=>stmts.push(env.DB.prepare(`INSERT INTO pan_pedidos (id,cliente_id,hallulla,marraqueta,ciabatta,medio_baguette,pan_completo,fecha_entrega,estado,observaciones) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(Number(x.id),x.clientId,Number(x.hallulla||0),Number(x.marraqueta||0),Number(x.ciabatta||0),Number(x.medioBaguette||0),Number(x.panCompleto||0),x.date||'',x.status||'Pendiente',x.notes||'')));
    db.guides.forEach(x=>stmts.push(env.DB.prepare(`INSERT INTO pan_guias (id,numero,cliente_id,fecha,kilos,total,pagado,estado,observaciones) VALUES (?,?,?,?,?,?,?,?,?)`).bind(x.id,x.number||'',x.clientId,x.date||'',Number(x.kg||0),Number(x.total||0),Number(x.paid||0),x.status||'Pendiente',x.notes||'')));
    db.payments.forEach(x=>stmts.push(env.DB.prepare(`INSERT INTO pan_pagos (id,guia_id,cliente_id,fecha,monto,medio,observaciones) VALUES (?,?,?,?,?,?,?)`).bind(x.id,x.guideId,x.clientId,x.date||'',Number(x.amount||0),x.method||'',x.notes||'')));
    db.trays.forEach(x=>stmts.push(env.DB.prepare(`INSERT INTO pan_bandejas (cliente_id,entregadas,devueltas,ultimo_movimiento) VALUES (?,?,?,?)`).bind(x.clientId,Number(x.delivered||0),Number(x.returned||0),x.last||'')));
    db.ovens.forEach(x=>stmts.push(env.DB.prepare(`INSERT INTO pan_hornos (id,cliente_id,modelo,fecha_instalacion,estado,observaciones) VALUES (?,?,?,?,?,?)`).bind(x.id,x.clientId,x.model||'',x.installed||'',x.status||'Operativo',x.notes||'')));
    for(let i=0;i<stmts.length;i+=75)await env.DB.batch(stmts.slice(i,i+75));
    return json({ok:true});
  }catch(e){return json({error:e.message||'Error guardando en D1'},500)}
}
