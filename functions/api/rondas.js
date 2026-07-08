async function enviarTelegram(env, mensaje) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return;
  }

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: mensaje
    })
  });
}

export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT *
      FROM rondas
      ORDER BY id DESC
      LIMIT 100
    `).all();

    return Response.json(results);
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const { usuario_id, guardia, codigo_qr, latitud, longitud } = body;

    if (!usuario_id || !guardia || !codigo_qr) {
      return Response.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const punto = await context.env.DB.prepare(`
      SELECT p.id, p.nombre, p.codigo_qr,
             i.nombre AS instalacion,
             e.nombre AS empresa
      FROM puntos_control p
      LEFT JOIN instalaciones i ON i.id = p.instalacion_id
      LEFT JOIN empresas e ON e.id = i.empresa_id
      WHERE p.codigo_qr = ?
      LIMIT 1
    `).bind(codigo_qr).first();

    if (!punto) {
      return Response.json({ ok: false, error: "QR no válido" }, { status: 404 });
    }

    await context.env.DB.prepare(`
      INSERT INTO rondas (
        usuario_id, punto_id, guardia, empresa, instalacion, punto,
        codigo_qr, latitud, longitud, fecha
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      usuario_id,
      punto.id,
      guardia,
      punto.empresa || "",
      punto.instalacion || "",
      punto.nombre,
      punto.codigo_qr,
      latitud || null,
      longitud || null
    ).run();

    const mapa = `https://www.google.com/maps?q=${latitud},${longitud}`;

    const mensaje = `✅ NUEVA RONDA REGISTRADA

👮 Guardia: ${guardia}
🏢 Empresa: ${punto.empresa || "-"}
📍 Instalación: ${punto.instalacion || "-"}
📌 Punto: ${punto.nombre}
🔑 QR: ${punto.codigo_qr}

🌎 GPS: ${latitud}, ${longitud}
🗺️ Mapa: ${mapa}`;

    await enviarTelegram(context.env, mensaje);

    return Response.json({ ok: true, punto });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}