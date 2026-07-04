export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT id, nombre, usuario, rol
      FROM usuarios
      ORDER BY id DESC
    `).all();

    return Response.json(results);
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const { nombre, usuario, password, rol } = body;

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