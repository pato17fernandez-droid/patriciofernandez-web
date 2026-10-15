import { seedFinanceOctPatch } from './seed-finance-oct-patch.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function apply(DB){
  await DB.prepare(`CREATE TABLE IF NOT EXISTS pan_fin_movimientos (
    id TEXT PRIMARY KEY,fecha TEXT DEFAULT '',periodo TEXT NOT NULL,tipo TEXT NOT NULL,categoria TEXT DEFAULT '',
    descripcion TEXT NOT NULL,cuenta TEXT NOT NULL,medio TEXT DEFAULT '',monto INTEGER NOT NULL DEFAULT 0,
    notas TEXT DEFAULT '',origen TEXT DEFAULT 'Manual',referencia TEXT DEFAULT '',transfer_id TEXT DEFAULT '',
    sentido TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const stmts=seedFinanceOctPatch.map(r=>{
    const [id,fecha,descripcion,tipo,categoria,cuenta,medio,monto,notas,origen]=r;
    return DB.prepare(`INSERT OR REPLACE INTO pan_fin_movimientos
      (id,fecha,periodo,tipo,categoria,descripcion,cuenta,medio,monto,notas,origen,referencia,transfer_id,sentido)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id,fecha||'','2026-10',tipo,categoria,descripcion,cuenta,medio,Number(monto||0),notas||'',origen||'Excel octubre 2026','','','');
  });
  if(stmts.length) await DB.batch(stmts);
  return stmts.length;
}

export async function onRequestGet({env}){
  try{
    if(!env.DB)return json({error:'Binding D1 DB no configurado'},500);
    const count=await apply(env.DB);
    return json({ok:true,count});
  }catch(e){return json({error:e.message||'Error aplicando ajustes'},500)}
}
