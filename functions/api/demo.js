export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const accion = body.accion;
    const rol = body.rol;

    if (rol !== "Administrador") {
      return Response.json({ ok: false, error: "Solo administradores" }, { status: 403 });
    }

    if (accion === "reset") {
      await context.env.DB.prepare(`DELETE FROM rondas`).run();
      await context.env.DB.prepare(`DELETE FROM puntos_control`).run();
      await context.env.DB.prepare(`DELETE FROM instalaciones`).run();
      await context.env.DB.prepare(`DELETE FROM empresas`).run();
      await context.env.DB.prepare(`DELETE FROM usuarios WHERE rol <> 'Administrador'`).run();

      return Response.json({ ok: true, mensaje: "Datos reiniciados correctamente" });
    }

    if (accion === "load") {
      await context.env.DB.prepare(`
        INSERT INTO empresas (nombre, rut, correo, telefono, estado)
        VALUES ('Seguridad Patagonia', '76.123.456-7', 'contacto@seguridadpatagonia.cl', '+56912345678', 'Activa')
      `).run();

      const empresa = await context.env.DB.prepare(`
        SELECT id FROM empresas WHERE nombre = 'Seguridad Patagonia' ORDER BY id DESC LIMIT 1
      `).first();

      await context.env.DB.prepare(`
        INSERT INTO instalaciones (empresa_id, nombre, direccion, latitud, longitud, estado)
        VALUES (?, 'Hospital Regional', 'Temuco, Chile', -38.7359, -72.5904, 'Activa')
      `).bind(empresa.id).run();

      const instalacion = await context.env.DB.prepare(`
        SELECT id FROM instalaciones WHERE nombre = 'Hospital Regional' ORDER BY id DESC LIMIT 1
      `).first();

      await context.env.DB.prepare(`
        INSERT INTO usuarios (nombre, usuario, password, rol)
        VALUES 
        ('Juan Pérez', 'juan', '1234', 'Guardia'),
        ('Pedro Soto', 'pedro', '1234', 'Guardia'),
        ('Supervisor Demo', 'supervisor', '1234', 'Supervisor')
      `).run();

      const puntos = ['Portón Norte', 'Patio Interior', 'Estacionamiento', 'Bodega'];

      for (const nombre of puntos) {
        const codigo = "GC-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

        await context.env.DB.prepare(`
          INSERT INTO puntos_control (instalacion_id, nombre, codigo_qr, latitud, longitud, estado)
          VALUES (?, ?, ?, -38.7359, -72.5904, 'Activo')
        `).bind(instalacion.id, nombre, codigo).run();
      }

      return Response.json({ ok: true, mensaje: "Datos demo cargados correctamente" });
    }

    return Response.json({ ok: false, error: "Acción no válida" }, { status: 400 });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}