const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

async function ensureSchema(DB) {
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_clientes (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      rut TEXT DEFAULT '',
      giro TEXT DEFAULT '',
      direccion TEXT DEFAULT '',
      comuna TEXT DEFAULT '',
      telefono TEXT DEFAULT '',
      contacto TEXT DEFAULT '',
      ruta TEXT DEFAULT '',
      horno INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_pedidos (
      id INTEGER PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      hallulla REAL NOT NULL DEFAULT 0,
      marraqueta REAL NOT NULL DEFAULT 0,
      ciabatta REAL NOT NULL DEFAULT 0,
      fecha_entrega TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'Pendiente',
      observaciones TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES pan_clientes(id)
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_guias (
      id TEXT PRIMARY KEY,
      numero TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      fecha TEXT NOT NULL,
      kilos REAL NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      pagado INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'Pendiente',
      observaciones TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES pan_clientes(id)
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_pagos (
      id TEXT PRIMARY KEY,
      guia_id TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      fecha TEXT NOT NULL,
      monto INTEGER NOT NULL DEFAULT 0,
      medio TEXT DEFAULT '',
      observaciones TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guia_id) REFERENCES pan_guias(id),
      FOREIGN KEY (cliente_id) REFERENCES pan_clientes(id)
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_bandejas (
      cliente_id TEXT PRIMARY KEY,
      entregadas INTEGER NOT NULL DEFAULT 0,
      devueltas INTEGER NOT NULL DEFAULT 0,
      ultimo_movimiento TEXT DEFAULT '',
      FOREIGN KEY (cliente_id) REFERENCES pan_clientes(id)
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS pan_hornos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      modelo TEXT DEFAULT '',
      fecha_instalacion TEXT DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'Operativo',
      observaciones TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES pan_clientes(id)
    )`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_pedidos_cliente ON pan_pedidos(cliente_id)`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_guias_cliente ON pan_guias(cliente_id)`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pan_pagos_guia ON pan_pagos(guia_id)`)
  ]);
}

function normalize(body) {
  const arr = key => Array.isArray(body?.[key]) ? body[key] : [];
  return {
    clients: arr('clients'), orders: arr('orders'), guides: arr('guides'),
    payments: arr('payments'), trays: arr('trays'), ovens: arr('ovens')
  };
}

export async function onRequestGet({ env }) {
  try {
    if (!env.DB) return json({ error: 'Binding D1 DB no configurado' }, 500);
    await ensureSchema(env.DB);
    const [c,o,g,p,t,h] = await env.DB.batch([
      env.DB.prepare('SELECT * FROM pan_clientes ORDER BY nombre'),
      env.DB.prepare('SELECT * FROM pan_pedidos ORDER BY fecha_entrega DESC, id DESC'),
      env.DB.prepare('SELECT * FROM pan_guias ORDER BY fecha DESC, numero DESC'),
      env.DB.prepare('SELECT * FROM pan_pagos ORDER BY fecha DESC, created_at DESC'),
      env.DB.prepare('SELECT * FROM pan_bandejas'),
      env.DB.prepare('SELECT * FROM pan_hornos ORDER BY fecha_instalacion DESC')
    ]);
    return json({
      clients: (c.results||[]).map(x=>({id:x.id,name:x.nombre,rut:x.rut,business:x.giro,address:x.direccion,commune:x.comuna,phone:x.telefono,contact:x.contacto,route:x.ruta,oven:!!x.horno,active:!!x.activo})),
      orders: (o.results||[]).map(x=>({id:x.id,clientId:x.cliente_id,hallulla:x.hallulla,marraqueta:x.marraqueta,ciabatta:x.ciabatta,date:x.fecha_entrega,status:x.estado,notes:x.observaciones})),
      guides: (g.results||[]).map(x=>({id:x.id,number:x.numero,clientId:x.cliente_id,date:x.fecha,kg:x.kilos,total:x.total,paid:x.pagado,status:x.estado,notes:x.observaciones})),
      payments: (p.results||[]).map(x=>({id:x.id,guideId:x.guia_id,clientId:x.cliente_id,date:x.fecha,amount:x.monto,method:x.medio,notes:x.observaciones})),
      trays: (t.results||[]).map(x=>({clientId:x.cliente_id,delivered:x.entregadas,returned:x.devueltas,last:x.ultimo_movimiento})),
      ovens: (h.results||[]).map(x=>({id:x.id,clientId:x.cliente_id,model:x.modelo,installed:x.fecha_instalacion,status:x.estado,notes:x.observaciones}))
    });
  } catch (e) { return json({ error: e.message || 'Error D1' }, 500); }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return json({ error: 'Binding D1 DB no configurado' }, 500);
    await ensureSchema(env.DB);
    const db = normalize(await request.json());
    const stmts = [
      env.DB.prepare('DELETE FROM pan_pagos'), env.DB.prepare('DELETE FROM pan_bandejas'),
      env.DB.prepare('DELETE FROM pan_hornos'), env.DB.prepare('DELETE FROM pan_guias'),
      env.DB.prepare('DELETE FROM pan_pedidos'), env.DB.prepare('DELETE FROM pan_clientes')
    ];
    db.clients.forEach(x=>stmts.push(env.DB.prepare('INSERT INTO pan_clientes (id,nombre,rut,giro,direccion,comuna,telefono,contacto,ruta,horno,activo) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(x.id,x.name||'',x.rut||'',x.business||'',x.address||'',x.commune||'',x.phone||'',x.contact||'',x.route||'',x.oven?1:0,x.active===false?0:1)));
    db.orders.forEach(x=>stmts.push(env.DB.prepare('INSERT INTO pan_pedidos (id,cliente_id,hallulla,marraqueta,ciabatta,fecha_entrega,estado,observaciones) VALUES (?,?,?,?,?,?,?,?)').bind(Number(x.id),x.clientId,Number(x.hallulla||0),Number(x.marraqueta||0),Number(x.ciabatta||0),x.date||'',x.status||'Pendiente',x.notes||'')));
    db.guides.forEach(x=>stmts.push(env.DB.prepare('INSERT INTO pan_guias (id,numero,cliente_id,fecha,kilos,total,pagado,estado,observaciones) VALUES (?,?,?,?,?,?,?,?,?)').bind(x.id,x.number||'',x.clientId,x.date||'',Number(x.kg||0),Number(x.total||0),Number(x.paid||0),x.status||'Pendiente',x.notes||'')));
    db.payments.forEach(x=>stmts.push(env.DB.prepare('INSERT INTO pan_pagos (id,guia_id,cliente_id,fecha,monto,medio,observaciones) VALUES (?,?,?,?,?,?,?)').bind(x.id,x.guideId,x.clientId,x.date||'',Number(x.amount||0),x.method||'',x.notes||'')));
    db.trays.forEach(x=>stmts.push(env.DB.prepare('INSERT INTO pan_bandejas (cliente_id,entregadas,devueltas,ultimo_movimiento) VALUES (?,?,?,?)').bind(x.clientId,Number(x.delivered||0),Number(x.returned||0),x.last||'')));
    db.ovens.forEach(x=>stmts.push(env.DB.prepare('INSERT INTO pan_hornos (id,cliente_id,modelo,fecha_instalacion,estado,observaciones) VALUES (?,?,?,?,?,?)').bind(x.id,x.clientId,x.model||'',x.installed||'',x.status||'Operativo',x.notes||'')));
    await env.DB.batch(stmts);
    return json({ ok: true });
  } catch (e) { return json({ error: e.message || 'Error guardando en D1' }, 500); }
}
