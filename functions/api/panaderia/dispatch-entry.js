const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function addColumn(DB,table,def){
  const name=def.trim().split(/\s+/)[0];
  const info=await DB.prepare(`PRAGMA table_info(${table})`).all();
  if(!(info.results||[]).some(c=>c.name===name))await DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${def}`).run();
}
async function ensure(DB){
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_clientes (
      id TEXT PRIMARY KEY,nombre TEXT NOT NULL,rut TEXT DEFAULT '',giro TEXT DEFAULT '',direccion TEXT DEFAULT '',comuna TEXT DEFAULT '',
      telefono TEXT DEFAULT '',contacto TEXT DEFAULT '',ruta TEXT DEFAULT '',zona TEXT DEFAULT '',horno INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_pedidos (
      id INTEGER PRIMARY KEY,cliente_id TEXT NOT NULL,hallulla REAL NOT NULL DEFAULT 0,marraqueta REAL NOT NULL DEFAULT 0,
      ciabatta REAL NOT NULL DEFAULT 0,medio_baguette REAL NOT NULL DEFAULT 0,pan_completo REAL NOT NULL DEFAULT 0,
      fecha_entrega TEXT NOT NULL,estado TEXT NOT NULL DEFAULT 'Entregado',observaciones TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_guias (
      id TEXT PRIMARY KEY,numero TEXT NOT NULL,cliente_id TEXT NOT NULL,fecha TEXT NOT NULL,kilos REAL NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,pagado INTEGER NOT NULL DEFAULT 0,estado TEXT NOT NULL DEFAULT 'Pendiente',
      observaciones TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  ]);
  for(const def of ['precio_hallulla INTEGER NOT NULL DEFAULT 0','precio_marraqueta INTEGER NOT NULL DEFAULT 0','precio_ciabatta INTEGER NOT NULL DEFAULT 0','precio_medio_baguette INTEGER NOT NULL DEFAULT 0','precio_pan_completo INTEGER NOT NULL DEFAULT 0'])await addColumn(DB,'pan_clientes',def);
  await addColumn(DB,'pan_pedidos','medio_baguette REAL NOT NULL DEFAULT 0');
  await addColumn(DB,'pan_pedidos','pan_completo REAL NOT NULL DEFAULT 0');
}
const roundKg=n=>Math.round(Number(n||0)*1000)/1000;

export async function onRequestPost({request,env}){
  try{
    if(!env.DB)return json({error:'Base de datos no disponible'},500);
    await ensure(env.DB);
    const x=await request.json().catch(()=>({}));
    const clientId=String(x.clientId||''),date=String(x.date||''),guideNumber=String(x.guideNumber||'').trim();
    if(!clientId||!date||!guideNumber)return json({error:'Falta cliente, fecha o número de guía'},400);

    const client=await env.DB.prepare(`SELECT id,nombre,precio_hallulla,precio_marraqueta,precio_ciabatta,precio_medio_baguette,precio_pan_completo
      FROM pan_clientes WHERE id=? AND activo=1`).bind(clientId).first();
    if(!client)return json({error:'Cliente no encontrado o inactivo'},404);

    const products=[
      ['hallulla','precio_hallulla','Hallulla'],
      ['marraqueta','precio_marraqueta','Marraqueta'],
      ['ciabatta','precio_ciabatta','Ciabatta'],
      ['medioBaguette','precio_medio_baguette','Medio baguette'],
      ['panCompleto','precio_pan_completo','Pan completo']
    ];
    const kilos={};
    let totalKg=0,total=0;
    for(const [key,priceKey,label] of products){
      const kg=Math.max(0,roundKg(x[key]));
      kilos[key]=kg; totalKg+=kg;
      if(kg>0){
        const net=Number(client[priceKey]||0);
        if(net<=0)return json({error:`Falta configurar el precio de ${label} para ${client.nombre}`},400);
        const gross=Math.round(net*1.19);
        total+=kg*gross;
      }
    }
    totalKg=roundKg(totalKg); total=Math.round(total);
    if(totalKg<=0)return json({error:'Ingresa kilos en al menos un producto'},400);

    const dup=await env.DB.prepare('SELECT id,cliente_id,fecha FROM pan_guias WHERE numero=? AND fecha LIKE ? LIMIT 1')
      .bind(guideNumber,date.slice(0,7)+'%').first();
    const requestedId=Number(x.orderId||Date.now());
    const orderId=Number.isFinite(requestedId)&&requestedId>0?requestedId:Date.now();
    const guideId=String(x.guideId||`dispatch-${orderId}`);
    if(dup&&dup.id!==guideId)return json({error:`La guía N° ${guideNumber} ya está registrada en este mes`},409);

    const old=await env.DB.prepare('SELECT pagado FROM pan_guias WHERE id=?').bind(guideId).first();
    const paid=Math.min(Number(old?.pagado||0),total);
    const status=paid<=0?'Pendiente':paid<total?'Parcial':'Pagada';
    const notes=String(x.notes||'');

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO pan_pedidos
        (id,cliente_id,hallulla,marraqueta,ciabatta,medio_baguette,pan_completo,fecha_entrega,estado,observaciones)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET cliente_id=excluded.cliente_id,hallulla=excluded.hallulla,marraqueta=excluded.marraqueta,
        ciabatta=excluded.ciabatta,medio_baguette=excluded.medio_baguette,pan_completo=excluded.pan_completo,
        fecha_entrega=excluded.fecha_entrega,estado='Entregado',observaciones=excluded.observaciones`)
        .bind(orderId,clientId,kilos.hallulla,kilos.marraqueta,kilos.ciabatta,kilos.medioBaguette,kilos.panCompleto,date,'Entregado',notes),
      env.DB.prepare(`INSERT INTO pan_guias (id,numero,cliente_id,fecha,kilos,total,pagado,estado,observaciones)
        VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET numero=excluded.numero,cliente_id=excluded.cliente_id,fecha=excluded.fecha,kilos=excluded.kilos,
        total=excluded.total,pagado=excluded.pagado,estado=excluded.estado,observaciones=excluded.observaciones`)
        .bind(guideId,guideNumber,clientId,date,totalKg,total,paid,status,`Registrada desde Despachos${notes?' · '+notes:''}`)
    ]);

    return json({ok:true,orderId,guideId,clientName:client.nombre,totalKg,total,paid,status});
  }catch(e){return json({error:e.message||'Error registrando despacho'},500)}
}
