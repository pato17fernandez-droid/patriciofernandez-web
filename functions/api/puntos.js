export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT p.id, p.instalacion_id, p.nombre, p.codigo_qr,
             p.latitud, p.longitud, p.estado,
             i.nombre AS instalacion,
             e.nombre AS empresa
      FROM puntos_control p
      LEFT JOIN instalaciones i ON i.id = p.instalacion_id
      LEFT JOIN empresas e ON e.id = i.empresa_id
      ORDER BY p.id DESC
    `).all();

    return Response.json(results);
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { instalacion_id, nombre, latitud, longitud } = body;

    if (!instalacion_id || !nombre) {
      return Response.json({ ok: false, error: "Instalación y nombre son obligatorios" }, { status: 400 });
    }

    const codigo_qr = "GC-" + Date.now();

    await context.env.DB.prepare(`
      INSERT INTO puntos_control (instalacion_id, nombre, codigo_qr, latitud, longitud, estado)
      VALUES (?, ?, ?, ?, ?, 'Activo')
    `).bind(instalacion_id, nombre, codigo_qr, latitud || null, longitud || null).run();

    return Response.json({ ok: true, codigo_qr });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}