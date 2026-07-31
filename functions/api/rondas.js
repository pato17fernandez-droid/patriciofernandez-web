async function enviarTelegram(env, chatId, mensaje) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return { ok: false, omitido: true };

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const respuesta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: mensaje,
      disable_web_page_preview: true
    })
  });

  let resultado = null;
  try { resultado = await respuesta.json(); } catch {}

  if (!respuesta.ok || resultado?.ok === false) {
    const detalle = resultado?.description || `Telegram respondió con estado ${respuesta.status}`;
    console.error("Error al enviar Telegram:", detalle);
    return { ok: false, error: detalle };
  }

  return { ok: true };
}

export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT * FROM rondas ORDER BY id DESC LIMIT 100
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
      SELECT
        p.id,
        p.nombre,
        p.codigo_qr,
        i.id AS instalacion_id,
        i.nombre AS instalacion,
        i.telegram_chat_id,
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

    const gpsDisponible = latitud !== null && latitud !== undefined && latitud !== "" &&
      longitud !== null && longitud !== undefined && longitud !== "";
    const mapa = gpsDisponible ? `https://www.google.com/maps?q=${latitud},${longitud}` : null;

    const mensaje = `✅ NUEVA RONDA REGISTRADA\n\n👮 Guardia: ${guardia}\n🏢 Empresa: ${punto.empresa || "-"}\n📍 Instalación: ${punto.instalacion || "-"}\n📌 Punto: ${punto.nombre}\n🔑 QR: ${punto.codigo_qr}\n\n🌎 GPS: ${gpsDisponible ? `${latitud}, ${longitud}` : "No disponible"}\n🗺️ Mapa: ${mapa || "No disponible"}`;

    const chatIdDestino = punto.telegram_chat_id || context.env.TELEGRAM_CHAT_ID;
    const telegram = await enviarTelegram(context.env, chatIdDestino, mensaje);

    return Response.json({
      ok: true,
      punto,
      telegram: {
        enviado: telegram.ok === true,
        destino: punto.telegram_chat_id ? "instalacion" : "grupo_general",
        error: telegram.error || null
      }
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
