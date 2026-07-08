export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { usuario, password } = body;

    if (!usuario || !password) {
      return Response.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const user = await context.env.DB.prepare(`
      SELECT id, nombre, usuario, rol
      FROM usuarios
      WHERE usuario = ? AND password = ?
      LIMIT 1
    `).bind(usuario, password).first();

    if (!user) {
      return Response.json({ ok: false, error: "Usuario o contraseña incorrectos" }, { status: 401 });
    }

    return Response.json({
      ok: true,
      user
    });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}