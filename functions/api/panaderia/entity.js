const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function ensure(DB){
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_clientes (id TEXT PRIMARY KEY,nombre TEXT NOT NULL,rut TEXT DEFAULT '',giro TEXT DEFAULT '',direccion TEXT DEFAULT '',comuna TEXT DEFAULT '',telefono TEXT DEFAULT '',contacto TEXT DEFAULT '',ruta TEXT DEFAULT '',horno INTEGER NOT NULL DEFAULT 0,activo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_guias (id TEXT PRIMARY KEY,numero TEXT NOT NULL,cliente_id TEXT NOT NULL,fecha TEXT NOT NULL,kilos REAL NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT 0,pagado INTEGER NOT NULL DEFAULT 0,estado TEXT NOT NULL DEFAULT 'Pendiente',observaciones TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_pagos (id TEXT PRIMARY KEY,guia_id TEXT NOT NULL,cliente_id TEXT NOT NULL,fecha TEXT NOT NULL,monto INTEGER NOT NULL DEFAULT 0,medio TEXT DEFAULT '',observaciones TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_bandejas (cliente_id TEXT PRIMARY KEY,entregadas INTEGER NOT NULL DEFAULT 0,devueltas INTEGER NOT NULL DEFAULT 0,ultimo_movimiento TEXT DEFAULT '')`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_hornos (id TEXT PRIMARY KEY,cliente_id TEXT NOT NULL,modelo TEXT DEFAULT '',fecha_instalacion TEXT DEFAULT '',estado TEXT NOT NULL DEFAULT 'Operativo',observaciones TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
  ]);
  const info=await DB.prepare('PRAGMA table_info(pan_clientes)').all();
  const cols=new Set((info.results||[]).map(x=>x.name));
  for(const def of ["zona TEXT DEFAULT ''",'precio_hallulla INTEGER NOT NULL DEFAULT 0','precio_marraqueta INTEGER NOT NULL DEFAULT 0','precio_ciabatta INTEGER NOT NULL DEFAULT 0']){
    const name=def.split(/\s+/)[0]; if(!cols.has(name)) await DB.prepare(`ALTER TABLE pan_clientes ADD COLUMN ${def}`).run();
  }
}

export async function onRequestPost({request,env}){
  try{
    if(!env.DB)return json({error:'Binding D1 DB no configurado'},500);
    await ensure(env.DB);
    const body=await request.json();
    const type=body?.type, x=body?.data||{};

    if(type==='client'){
      if(!x.id||!x.name)return json({error:'Cliente incompleto'},400);
      await env.DB.prepare(`INSERT INTO pan_clientes (id,nombre,rut,giro,direccion,comuna,telefono,contacto,ruta,zona,precio_hallulla,precio_marraqueta,precio_ciabatta,horno,activo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre,rut=excluded.rut,giro=excluded.giro,direccion=excluded.direccion,comuna=excluded.comuna,telefono=excluded.telefono,contacto=excluded.contacto,ruta=excluded.ruta,zona=excluded.zona,precio_hallulla=excluded.precio_hallulla,precio_marraqueta=excluded.precio_marraqueta,precio_ciabatta=excluded.precio_ciabatta,horno=excluded.horno,activo=excluded.activo`)
      .bind(String(x.id),String(x.name||''),String(x.rut||''),String(x.business||''),String(x.address||''),String(x.commune||''),String(x.phone||''),String(x.contact||''),String(x.route||''),String(x.zone||''),Number(x.priceHallulla||0),Number(x.priceMarraqueta||0),Number(x.priceCiabatta||0),x.oven?1:0,x.active===false?0:1).run();
      return json({ok:true});
    }

    if(type==='guide'){
      if(!x.id||!x.clientId)return json({error:'Guía incompleta'},400);
      const total=Number(x.total||0), paid=Math.min(Number(x.paid||0),total);
      const status=paid<=0?'Pendiente':paid<total?'Parcial':'Pagada';
      await env.DB.prepare(`INSERT INTO pan_guias (id,numero,cliente_id,fecha,kilos,total,pagado,estado,observaciones) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET numero=excluded.numero,cliente_id=excluded.cliente_id,fecha=excluded.fecha,kilos=excluded.kilos,total=excluded.total,pagado=excluded.pagado,estado=excluded.estado,observaciones=excluded.observaciones`)
      .bind(String(x.id),String(x.number||''),String(x.clientId),String(x.date||''),Number(x.kg||0),total,paid,status,String(x.notes||'')).run();
      return json({ok:true,status,paid});
    }

    if(type==='payment'){
      if(!x.id||!x.guideId)return json({error:'Pago incompleto'},400);
      const g=await env.DB.prepare('SELECT * FROM pan_guias WHERE id=?').bind(String(x.guideId)).first();
      if(!g)return json({error:'Guía no encontrada'},404);
      const balance=Math.max(0,Number(g.total||0)-Number(g.pagado||0));
      const amount=Math.min(Number(x.amount||0),balance);
      if(amount<=0)return json({error:'Monto inválido o guía ya pagada'},400);
      const paid=Number(g.pagado||0)+amount, status=paid>=Number(g.total||0)?'Pagada':'Parcial';
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO pan_pagos (id,guia_id,cliente_id,fecha,monto,medio,observaciones) VALUES (?,?,?,?,?,?,?)`).bind(String(x.id),String(x.guideId),String(g.cliente_id),String(x.date||''),amount,String(x.method||''),String(x.notes||'')),
        env.DB.prepare('UPDATE pan_guias SET pagado=?,estado=? WHERE id=?').bind(paid,status,String(x.guideId))
      ]);
      return json({ok:true,amount,paid,status});
    }

    if(type==='guidePaid'){
      if(!x.guideId)return json({error:'Falta guía'},400);
      const g=await env.DB.prepare('SELECT * FROM pan_guias WHERE id=?').bind(String(x.guideId)).first();
      if(!g)return json({error:'Guía no encontrada'},404);
      const amount=Math.max(0,Number(g.total||0)-Number(g.pagado||0));
      if(amount<=0)return json({ok:true,amount:0,paid:Number(g.pagado||0),status:'Pagada'});
      const paymentId=String(x.paymentId||`pay-${Date.now()}`);
      await env.DB.batch([
        env.DB.prepare('UPDATE pan_guias SET pagado=total,estado=? WHERE id=?').bind('Pagada',String(x.guideId)),
        env.DB.prepare(`INSERT OR IGNORE INTO pan_pagos (id,guia_id,cliente_id,fecha,monto,medio,observaciones) VALUES (?,?,?,?,?,?,?)`).bind(paymentId,String(x.guideId),String(g.cliente_id),String(x.date||''),amount,String(x.method||'Pago total'),String(x.notes||'Marcada como pagada desde Guías'))
      ]);
      return json({ok:true,amount,paid:Number(g.total||0),status:'Pagada',paymentId});
    }

    if(type==='tray'){
      if(!x.clientId)return json({error:'Falta cliente'},400);
      await env.DB.prepare(`INSERT INTO pan_bandejas (cliente_id,entregadas,devueltas,ultimo_movimiento) VALUES (?,?,?,?)
      ON CONFLICT(cliente_id) DO UPDATE SET entregadas=excluded.entregadas,devueltas=excluded.devueltas,ultimo_movimiento=excluded.ultimo_movimiento`)
      .bind(String(x.clientId),Number(x.delivered||0),Number(x.returned||0),String(x.last||'')).run();
      return json({ok:true});
    }

    if(type==='oven'){
      if(!x.id||!x.clientId)return json({error:'Horno incompleto'},400);
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO pan_hornos (id,cliente_id,modelo,fecha_instalacion,estado,observaciones) VALUES (?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET cliente_id=excluded.cliente_id,modelo=excluded.modelo,fecha_instalacion=excluded.fecha_instalacion,estado=excluded.estado,observaciones=excluded.observaciones`)
        .bind(String(x.id),String(x.clientId),String(x.model||''),String(x.installed||''),String(x.status||'Operativo'),String(x.notes||'')),
        env.DB.prepare('UPDATE pan_clientes SET horno=? WHERE id=?').bind(x.status==='Inactivo'?0:1,String(x.clientId))
      ]);
      return json({ok:true});
    }

    return json({error:'Tipo no soportado'},400);
  }catch(e){return json({error:e.message||'Error guardando en D1'},500)}
}
