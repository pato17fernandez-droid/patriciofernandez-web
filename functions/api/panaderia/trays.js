const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function ensure(DB){
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_bandejas (
      cliente_id TEXT PRIMARY KEY,
      entregadas INTEGER NOT NULL DEFAULT 0,
      devueltas INTEGER NOT NULL DEFAULT 0,
      ultimo_movimiento TEXT DEFAULT ''
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_bandeja_movimientos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      fecha TEXT NOT NULL,
      entregadas INTEGER NOT NULL DEFAULT 0,
      devueltas INTEGER NOT NULL DEFAULT 0,
      observaciones TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_bandeja_mov_cliente ON pan_bandeja_movimientos(cliente_id)`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_bandeja_mov_fecha ON pan_bandeja_movimientos(fecha)`)
  ]);
}

export async function onRequestGet({env}){
  try{
    if(!env.DB)return json({error:'Binding D1 DB no configurado'},500);
    await ensure(env.DB);
    const [s,m]=await env.DB.batch([
      env.DB.prepare('SELECT * FROM pan_bandejas ORDER BY ultimo_movimiento DESC,cliente_id'),
      env.DB.prepare('SELECT * FROM pan_bandeja_movimientos ORDER BY fecha DESC,created_at DESC LIMIT 1000')
    ]);
    return json({
      balances:(s.results||[]).map(x=>({clientId:x.cliente_id,delivered:Number(x.entregadas||0),returned:Number(x.devueltas||0),balance:Number(x.entregadas||0)-Number(x.devueltas||0),last:x.ultimo_movimiento||''})),
      movements:(m.results||[]).map(x=>({id:x.id,clientId:x.cliente_id,date:x.fecha,delivered:Number(x.entregadas||0),returned:Number(x.devueltas||0),notes:x.observaciones||'',createdAt:x.created_at}))
    });
  }catch(e){return json({error:e.message||'Error cargando bandejas'},500)}
}

export async function onRequestPost({request,env}){
  try{
    if(!env.DB)return json({error:'Binding D1 DB no configurado'},500);
    await ensure(env.DB);
    const body=await request.json(),action=String(body?.action||'movement');

    if(action==='movement'){
      const x=body?.data||{};
      const clientId=String(x.clientId||''),date=String(x.date||'');
      const delivered=Math.max(0,Math.round(Number(x.delivered||0)));
      const returned=Math.max(0,Math.round(Number(x.returned||0)));
      if(!clientId||!date)return json({error:'Falta cliente o fecha'},400);
      if(delivered===0&&returned===0)return json({error:'Ingresa bandejas entregadas o devueltas'},400);
      const current=await env.DB.prepare('SELECT * FROM pan_bandejas WHERE cliente_id=?').bind(clientId).first();
      const newDelivered=Number(current?.entregadas||0)+delivered;
      const newReturned=Number(current?.devueltas||0)+returned;
      const id=String(x.id||`tray-${Date.now()}`);
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO pan_bandeja_movimientos (id,cliente_id,fecha,entregadas,devueltas,observaciones) VALUES (?,?,?,?,?,?)`)
          .bind(id,clientId,date,delivered,returned,String(x.notes||'')),
        env.DB.prepare(`INSERT INTO pan_bandejas (cliente_id,entregadas,devueltas,ultimo_movimiento) VALUES (?,?,?,?)
          ON CONFLICT(cliente_id) DO UPDATE SET entregadas=excluded.entregadas,devueltas=excluded.devueltas,ultimo_movimiento=excluded.ultimo_movimiento`)
          .bind(clientId,newDelivered,newReturned,date)
      ]);
      return json({ok:true,id,delivered:newDelivered,returned:newReturned,balance:newDelivered-newReturned,last:date});
    }

    if(action==='setOpening'){
      const x=body?.data||{};
      const clientId=String(x.clientId||''),date=String(x.date||'');
      const balance=Math.max(0,Math.round(Number(x.balance||0)));
      if(!clientId||!date)return json({error:'Falta cliente o fecha'},400);
      const current=await env.DB.prepare('SELECT * FROM pan_bandejas WHERE cliente_id=?').bind(clientId).first();
      const oldBal=Number(current?.entregadas||0)-Number(current?.devueltas||0);
      const diff=balance-oldBal;
      if(diff===0)return json({ok:true,balance});
      const delivered=diff>0?diff:0,returned=diff<0?Math.abs(diff):0;
      const id=String(x.id||`tray-open-${Date.now()}`);
      const newDelivered=Number(current?.entregadas||0)+delivered;
      const newReturned=Number(current?.devueltas||0)+returned;
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO pan_bandeja_movimientos (id,cliente_id,fecha,entregadas,devueltas,observaciones) VALUES (?,?,?,?,?,?)`)
          .bind(id,clientId,date,delivered,returned,String(x.notes||'Ajuste de saldo inicial')),
        env.DB.prepare(`INSERT INTO pan_bandejas (cliente_id,entregadas,devueltas,ultimo_movimiento) VALUES (?,?,?,?)
          ON CONFLICT(cliente_id) DO UPDATE SET entregadas=excluded.entregadas,devueltas=excluded.devueltas,ultimo_movimiento=excluded.ultimo_movimiento`)
          .bind(clientId,newDelivered,newReturned,date)
      ]);
      return json({ok:true,id,balance:newDelivered-newReturned});
    }

    if(action==='deleteMovement'){
      const id=String(body?.id||'');if(!id)return json({error:'Falta id'},400);
      const mov=await env.DB.prepare('SELECT * FROM pan_bandeja_movimientos WHERE id=?').bind(id).first();
      if(!mov)return json({error:'Movimiento no encontrado'},404);
      const current=await env.DB.prepare('SELECT * FROM pan_bandejas WHERE cliente_id=?').bind(mov.cliente_id).first();
      const delivered=Math.max(0,Number(current?.entregadas||0)-Number(mov.entregadas||0));
      const returned=Math.max(0,Number(current?.devueltas||0)-Number(mov.devueltas||0));
      const last=await env.DB.prepare('SELECT fecha FROM pan_bandeja_movimientos WHERE cliente_id=? AND id<>? ORDER BY fecha DESC,created_at DESC LIMIT 1').bind(mov.cliente_id,id).first();
      await env.DB.batch([
        env.DB.prepare('DELETE FROM pan_bandeja_movimientos WHERE id=?').bind(id),
        env.DB.prepare('UPDATE pan_bandejas SET entregadas=?,devueltas=?,ultimo_movimiento=? WHERE cliente_id=?').bind(delivered,returned,String(last?.fecha||''),mov.cliente_id)
      ]);
      return json({ok:true});
    }

    return json({error:'Acción no soportada'},400);
  }catch(e){return json({error:e.message||'Error guardando bandejas'},500)}
}
