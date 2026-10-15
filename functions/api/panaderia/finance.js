import { seedFinanceOct2026 } from './seed-finance-oct-2026.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function ensure(DB){
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_fin_movimientos (
      id TEXT PRIMARY KEY,
      fecha TEXT DEFAULT '',
      periodo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      categoria TEXT DEFAULT '',
      descripcion TEXT NOT NULL,
      cuenta TEXT NOT NULL,
      medio TEXT DEFAULT '',
      monto INTEGER NOT NULL DEFAULT 0,
      notas TEXT DEFAULT '',
      origen TEXT DEFAULT 'Manual',
      referencia TEXT DEFAULT '',
      transfer_id TEXT DEFAULT '',
      sentido TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_fin_cuentas (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      saldo_inicial INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_meta (
      clave TEXT PRIMARY KEY,
      valor TEXT DEFAULT ''
    )`)
  ]);
  await DB.batch([
    DB.prepare(`INSERT OR IGNORE INTO pan_fin_cuentas (id,nombre,saldo_inicial,activo) VALUES ('caja','Caja Efectivo Panadería',0,1)`),
    DB.prepare(`INSERT OR IGNORE INTO pan_fin_cuentas (id,nombre,saldo_inicial,activo) VALUES ('santander','Banco Santander',0,1)`)
  ]);
}

async function seedOctober(DB){
  const done=await DB.prepare("SELECT valor FROM pan_meta WHERE clave='finanzas_octubre_2026_v1'").first();
  if(done)return;
  const stmts=seedFinanceOct2026.map(r=>{
    const [id,fecha,descripcion,tipo,categoria,cuenta,medio,monto,notas,origen]=r;
    return DB.prepare(`INSERT OR IGNORE INTO pan_fin_movimientos
      (id,fecha,periodo,tipo,categoria,descripcion,cuenta,medio,monto,notas,origen,referencia,transfer_id,sentido)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id,fecha||'','2026-10',tipo,categoria,descripcion,cuenta,medio,Number(monto||0),notas||'',origen||'Excel octubre 2026','','','');
  });
  for(let i=0;i<stmts.length;i+=75) await DB.batch(stmts.slice(i,i+75));
  await DB.prepare("INSERT OR REPLACE INTO pan_meta (clave,valor) VALUES ('finanzas_octubre_2026_v1','ok')").run();
}

function movement(x){
  return {
    id:x.id,date:x.fecha,period:x.periodo,type:x.tipo,category:x.categoria,description:x.descripcion,
    account:x.cuenta,method:x.medio,amount:Number(x.monto||0),notes:x.notas,origin:x.origen,
    reference:x.referencia,transferId:x.transfer_id,direction:x.sentido,createdAt:x.created_at
  };
}

export async function onRequestGet({env}){
  try{
    if(!env.DB)return json({error:'Binding D1 DB no configurado'},500);
    await ensure(env.DB);await seedOctober(env.DB);
    const [m,a]=await env.DB.batch([
      env.DB.prepare(`SELECT * FROM pan_fin_movimientos ORDER BY CASE WHEN fecha='' THEN 1 ELSE 0 END, fecha DESC, created_at DESC`),
      env.DB.prepare(`SELECT * FROM pan_fin_cuentas WHERE activo=1 ORDER BY id`)
    ]);
    return json({
      movements:(m.results||[]).map(movement),
      accounts:(a.results||[]).map(x=>({id:x.id,name:x.nombre,openingBalance:Number(x.saldo_inicial||0)}))
    });
  }catch(e){return json({error:e.message||'Error financiero'},500)}
}

export async function onRequestPost({request,env}){
  try{
    if(!env.DB)return json({error:'Binding D1 DB no configurado'},500);
    await ensure(env.DB);await seedOctober(env.DB);
    const body=await request.json(),action=String(body?.action||'save');

    if(action==='save'){
      const x=body?.data||{};
      if(!x.id||!x.type||!x.description||!x.account)return json({error:'Movimiento incompleto'},400);
      const amount=Math.round(Number(x.amount||0));
      if(amount<=0)return json({error:'El monto debe ser mayor a 0'},400);
      const date=String(x.date||''),period=String(x.period||date.slice(0,7)||new Date().toISOString().slice(0,7));
      await env.DB.prepare(`INSERT INTO pan_fin_movimientos
        (id,fecha,periodo,tipo,categoria,descripcion,cuenta,medio,monto,notas,origen,referencia,transfer_id,sentido)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET fecha=excluded.fecha,periodo=excluded.periodo,tipo=excluded.tipo,categoria=excluded.categoria,
        descripcion=excluded.descripcion,cuenta=excluded.cuenta,medio=excluded.medio,monto=excluded.monto,notas=excluded.notas,
        origen=CASE WHEN pan_fin_movimientos.origen LIKE 'Excel %' THEN pan_fin_movimientos.origen ELSE excluded.origen END`)
        .bind(String(x.id),date,period,String(x.type),String(x.category||''),String(x.description),String(x.account),
          String(x.method||''),amount,String(x.notes||''),String(x.origin||'Manual'),String(x.reference||''),'',String(x.direction||'')).run();
      return json({ok:true});
    }

    if(action==='delete'){
      const id=String(body?.id||'');if(!id)return json({error:'Falta id'},400);
      const row=await env.DB.prepare('SELECT transfer_id FROM pan_fin_movimientos WHERE id=?').bind(id).first();
      if(row?.transfer_id) await env.DB.prepare('DELETE FROM pan_fin_movimientos WHERE transfer_id=?').bind(row.transfer_id).run();
      else await env.DB.prepare('DELETE FROM pan_fin_movimientos WHERE id=?').bind(id).run();
      return json({ok:true});
    }

    if(action==='transfer'){
      const x=body?.data||{},from=String(x.from||''),to=String(x.to||'');
      const amount=Math.round(Number(x.amount||0)),date=String(x.date||'');
      if(!from||!to||from===to||amount<=0)return json({error:'Transferencia inválida'},400);
      const period=String(x.period||date.slice(0,7)||new Date().toISOString().slice(0,7));
      const tid=String(x.id||`tr-${Date.now()}`);
      const note=String(x.notes||'');
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO pan_fin_movimientos (id,fecha,periodo,tipo,categoria,descripcion,cuenta,medio,monto,notas,origen,referencia,transfer_id,sentido)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(`${tid}-out`,date,period,'Transferencia','Transferencia entre cuentas',`Transferencia a ${to}`,from,'Transferencia interna',amount,note,'Manual','',tid,'Salida'),
        env.DB.prepare(`INSERT INTO pan_fin_movimientos (id,fecha,periodo,tipo,categoria,descripcion,cuenta,medio,monto,notas,origen,referencia,transfer_id,sentido)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(`${tid}-in`,date,period,'Transferencia','Transferencia entre cuentas',`Transferencia desde ${from}`,to,'Transferencia interna',amount,note,'Manual','',tid,'Entrada')
      ]);
      return json({ok:true,transferId:tid});
    }

    if(action==='openingBalance'){
      const account=String(body?.account||''),amount=Math.round(Number(body?.amount||0));
      if(!account)return json({error:'Falta cuenta'},400);
      await env.DB.prepare('UPDATE pan_fin_cuentas SET saldo_inicial=?,updated_at=CURRENT_TIMESTAMP WHERE nombre=?').bind(amount,account).run();
      return json({ok:true});
    }

    return json({error:'Acción no soportada'},400);
  }catch(e){return json({error:e.message||'Error guardando finanzas'},500)}
}
