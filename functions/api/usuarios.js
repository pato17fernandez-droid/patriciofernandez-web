export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const nombre = body.nombre;
    const usuario = body.usuario;
    const password = body.password;
    const rol = body.rol;

    if (!nombre || !usuario || !password || !rol) {
      return Response.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    await context.env.DB.prepare(`
      INSERT INTO usuarios (nombre, usuario, password, rol)
      VALUES (?, ?, ?, ?)
    `).bind(nombre, usuario, password, rol).run();

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}