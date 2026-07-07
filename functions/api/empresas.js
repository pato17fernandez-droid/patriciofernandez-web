export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT id, nombre, rut, correo, telefono, estado
      FROM empresas
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

    const { nombre, rut, correo, telefono } = body;

    if (!nombre) {
      return Response.json({ ok: false, error: "El nombre es obligatorio" }, { status: 400 });
    }

    await context.env.DB.prepare(`
      INSERT INTO empresas (nombre, rut, correo, telefono, estado)
      VALUES (?, ?, ?, ?, 'Activa')
    `).bind(nombre, rut || "", correo || "", telefono || "").run();

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}