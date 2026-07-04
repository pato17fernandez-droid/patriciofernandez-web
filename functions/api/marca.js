export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const guardia = body.guardia || "SIN_GUARDIA";
    const punto = body.punto || "SIN_PUNTO";
    const latitud = body.latitud || null;
    const longitud = body.longitud || null;

    await context.env.DB.prepare(`
      INSERT INTO marcas (guardia, punto, latitud, longitud, fecha)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(guardia, punto, latitud, longitud).run();

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(`
    SELECT * FROM marcas
    ORDER BY id DESC
    LIMIT 50
  `).all();

  return Response.json(results);
}
