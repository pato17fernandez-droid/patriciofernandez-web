export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const codigo = url.searchParams.get("codigo");

    if (!codigo) {
      return Response.json({ ok: false, error: "Falta código QR" }, { status: 400 });
    }

    const punto = await context.env.DB.prepare(`
      SELECT p.id, p.nombre, p.codigo_qr, p.latitud, p.longitud, p.estado,
             i.nombre AS instalacion,
             e.nombre AS empresa
      FROM puntos_control p
      LEFT JOIN instalaciones i ON i.id = p.instalacion_id
      LEFT JOIN empresas e ON e.id = i.empresa_id
      WHERE p.codigo_qr = ?
      LIMIT 1
    `).bind(codigo).first();

    if (!punto) {
      return Response.json({ ok: false, error: "QR no registrado" }, { status: 404 });
    }

    return Response.json({ ok: true, punto });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}