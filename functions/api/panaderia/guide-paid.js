const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export async function onRequestPost({request,env}){
  try{
    if(!env.DB) return json({error:'Binding D1 DB no configurado'},500);
    const body=await request.json();
    const id=String(body?.guideId||'');
    const date=String(body?.date||new Date().toISOString().slice(0,10));
    if(!id) return json({error:'Falta guideId'},400);

    const g=await env.DB.prepare('SELECT * FROM pan_guias WHERE id=?').bind(id).first();
    if(!g) return json({error:'Guía no encontrada'},404);
    const total=Number(g.total||0);
    const previous=Number(g.pagado||0);
    const balance=Math.max(0,total-previous);

    await env.DB.prepare("UPDATE pan_guias SET pagado=?, estado='Pagada' WHERE id=?").bind(total,id).run();

    if(balance>0){
      const payId=`auto-${id}`;
      await env.DB.prepare(`INSERT OR IGNORE INTO pan_pagos (id,guia_id,cliente_id,fecha,monto,medio,observaciones)
        VALUES (?,?,?,?,?,?,?)`)
        .bind(payId,id,g.cliente_id,date,balance,'Pago total','Marcada como pagada desde Guías').run();
    }

    return json({ok:true,guideId:id,total,paid:total,balance:0});
  }catch(e){return json({error:e.message||'Error marcando guía pagada'},500)}
}
