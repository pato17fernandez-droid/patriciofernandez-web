const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export async function onRequestPost({request,env}){
  try{
    if(!env.DB) return json({error:'Binding D1 DB no configurado'},500);
    const x=await request.json();
    if(!x?.id) return json({error:'Falta id de cliente'},400);

    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS pan_clientes (
      id TEXT PRIMARY KEY,nombre TEXT NOT NULL,rut TEXT DEFAULT '',giro TEXT DEFAULT '',direccion TEXT DEFAULT '',
      comuna TEXT DEFAULT '',telefono TEXT DEFAULT '',contacto TEXT DEFAULT '',ruta TEXT DEFAULT '',
      horno INTEGER NOT NULL DEFAULT 0,activo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();

    const info=await env.DB.prepare('PRAGMA table_info(pan_clientes)').all();
    const cols=new Set((info.results||[]).map(c=>c.name));
    const add=async(def)=>{const name=def.trim().split(/\s+/)[0];if(!cols.has(name)){await env.DB.prepare(`ALTER TABLE pan_clientes ADD COLUMN ${def}`).run();cols.add(name)}};
    await add("zona TEXT DEFAULT ''");
    await add('precio_hallulla INTEGER NOT NULL DEFAULT 0');
    await add('precio_marraqueta INTEGER NOT NULL DEFAULT 0');
    await add('precio_ciabatta INTEGER NOT NULL DEFAULT 0');

    await env.DB.prepare(`INSERT INTO pan_clientes
      (id,nombre,rut,giro,direccion,comuna,telefono,contacto,ruta,zona,precio_hallulla,precio_marraqueta,precio_ciabatta,horno,activo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        nombre=excluded.nombre,rut=excluded.rut,giro=excluded.giro,direccion=excluded.direccion,
        comuna=excluded.comuna,telefono=excluded.telefono,contacto=excluded.contacto,ruta=excluded.ruta,
        zona=excluded.zona,precio_hallulla=excluded.precio_hallulla,precio_marraqueta=excluded.precio_marraqueta,
        precio_ciabatta=excluded.precio_ciabatta,horno=excluded.horno,activo=excluded.activo`)
      .bind(
        String(x.id),String(x.name||''),String(x.rut||''),String(x.business||''),String(x.address||''),
        String(x.commune||''),String(x.phone||''),String(x.contact||''),String(x.route||''),String(x.zone||''),
        Number(x.priceHallulla||0),Number(x.priceMarraqueta||0),Number(x.priceCiabatta||0),x.oven?1:0,x.active===false?0:1
      ).run();

    return json({ok:true,id:x.id});
  }catch(e){return json({error:e.message||'Error guardando cliente'},500)}
}
