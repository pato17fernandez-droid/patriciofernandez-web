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