export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const usuario = String(body.usuario || "").trim();
    const password = String(body.password || "");

    if (!usuario || !password) {
      return Response.json({ ok: false, error: "Ingresa usuario y contraseña." }, { status: 400 });
    }

    const user = await context.env.DB.prepare(`
      SELECT id, nombre, usuario, rol
      FROM usuarios
      WHERE usuario = ? AND password = ?
      LIMIT 1
    `).bind(usuario, password).first();

    if (!user) {
      return Response.json({ ok: false, error: "Usuario o contraseña incorrectos." }, { status: 401 });
    }

    return Response.json({ ok: true, user });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || "Error interno del servidor." }, { status: 500 });
  }
}
