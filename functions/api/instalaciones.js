export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT i.id, i.empresa_id, i.nombre, i.direccion, i.latitud, i.longitud, i.estado,
             e.nombre AS empresa
      FROM instalaciones i
      LEFT JOIN empresas e ON e.id = i.empresa_id
      ORDER BY i.id DESC
    `).all();

    return Response.json(results);
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { empresa_id, nombre, direccion, latitud, longitud } = body;

    if (!empresa_id || !nombre) {
      return Response.json({ ok: false, error: "Empresa y nombre son obligatorios" }, { status: 400 });
    }

    await context.env.DB.prepare(`
      INSERT INTO instalaciones (empresa_id, nombre, direccion, latitud, longitud, estado)
      VALUES (?, ?, ?, ?, ?, 'Activa')
    `).bind(empresa_id, nombre, direccion || "", latitud || null, longitud || null).run();

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}