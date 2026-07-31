export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT id, nombre, usuario, rol
      FROM usuarios
      ORDER BY id DESC
    `).all();

    return Response.json(results);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error.message
      },
      {
        status: 500
      }
    );
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const nombre = String(body.nombre || "").trim();
    const usuario = String(body.usuario || "").trim();
    const password = String(body.password || "").trim();
    const rol = String(body.rol || "").trim();

    if (!nombre || !usuario || !password || !rol) {
      return Response.json(
        {
          ok: false,
          error: "Completa todos los campos"
        },
        {
          status: 400
        }
      );
    }

    const usuarioExistente = await context.env.DB.prepare(`
      SELECT id
      FROM usuarios
      WHERE LOWER(usuario) = LOWER(?)
      LIMIT 1
    `).bind(usuario).first();

    if (usuarioExistente) {
      return Response.json(
        {
          ok: false,
          error: "Ese nombre de usuario ya está registrado"
        },
        {
          status: 409
        }
      );
    }

    const resultado = await context.env.DB.prepare(`
      INSERT INTO usuarios (
        nombre,
        usuario,
        password,
        rol
      )
      VALUES (?, ?, ?, ?)
    `).bind(
      nombre,
      usuario,
      password,
      rol
    ).run();

    return Response.json({
      ok: true,
      mensaje: "Usuario creado correctamente",
      id: resultado.meta?.last_row_id || null
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error.message
      },
      {
        status: 500
      }
    );
  }
}

export async function onRequestPut(context) {
  try {
    const body = await context.request.json();

    const id = Number(body.id);
    const nombre = String(body.nombre || "").trim();
    const usuario = String(body.usuario || "").trim();
    const password = String(body.password || "").trim();
    const rol = String(body.rol || "").trim();

    if (!Number.isInteger(id) || id <= 0) {
      return Response.json(
        {
          ok: false,
          error: "ID de usuario no válido"
        },
        {
          status: 400
        }
      );
    }

    if (!nombre || !usuario || !rol) {
      return Response.json(
        {
          ok: false,
          error: "Nombre, usuario y rol son obligatorios"
        },
        {
          status: 400
        }
      );
    }

    const usuarioActual = await context.env.DB.prepare(`
      SELECT id, nombre, usuario, rol
      FROM usuarios
      WHERE id = ?
      LIMIT 1
    `).bind(id).first();

    if (!usuarioActual) {
      return Response.json(
        {
          ok: false,
          error: "Usuario no encontrado"
        },
        {
          status: 404
        }
      );
    }

    const usuarioDuplicado = await context.env.DB.prepare(`
      SELECT id
      FROM usuarios
      WHERE LOWER(usuario) = LOWER(?)
        AND id != ?
      LIMIT 1
    `).bind(
      usuario,
      id
    ).first();

    if (usuarioDuplicado) {
      return Response.json(
        {
          ok: false,
          error: "Ese nombre de usuario ya pertenece a otra persona"
        },
        {
          status: 409
        }
      );
    }

    if (password) {
      await context.env.DB.prepare(`
        UPDATE usuarios
        SET
          nombre = ?,
          usuario = ?,
          password = ?,
          rol = ?
        WHERE id = ?
      `).bind(
        nombre,
        usuario,
        password,
        rol,
        id
      ).run();
    } else {
      await context.env.DB.prepare(`
        UPDATE usuarios
        SET
          nombre = ?,
          usuario = ?,
          rol = ?
        WHERE id = ?
      `).bind(
        nombre,
        usuario,
        rol,
        id
      ).run();
    }

    return Response.json({
      ok: true,
      mensaje: "Usuario actualizado correctamente"
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error.message
      },
      {
        status: 500
      }
    );
  }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = Number(url.searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return Response.json(
        {
          ok: false,
          error: "ID de usuario no válido"
        },
        {
          status: 400
        }
      );
    }

    const usuario = await context.env.DB.prepare(`
      SELECT id, nombre, usuario, rol
      FROM usuarios
      WHERE id = ?
      LIMIT 1
    `).bind(id).first();

    if (!usuario) {
      return Response.json(
        {
          ok: false,
          error: "Usuario no encontrado"
        },
        {
          status: 404
        }
      );
    }

    if (String(usuario.rol).toLowerCase() === "administrador") {
      const cantidadAdministradores = await context.env.DB.prepare(`
        SELECT COUNT(*) AS total
        FROM usuarios
        WHERE LOWER(rol) = 'administrador'
      `).first();

      if (Number(cantidadAdministradores?.total || 0) <= 1) {
        return Response.json(
          {
            ok: false,
            error: "No puedes eliminar el único administrador del sistema"
          },
          {
            status: 400
          }
        );
      }
    }

    try {
      const rondasUsuario = await context.env.DB.prepare(`
        SELECT COUNT(*) AS total
        FROM rondas
        WHERE usuario_id = ?
      `).bind(id).first();

      if (Number(rondasUsuario?.total || 0) > 0) {
        return Response.json(
          {
            ok: false,
            error: "No se puede eliminar este usuario porque tiene rondas registradas"
          },
          {
            status: 400
          }
        );
      }
    } catch (errorRondas) {
      console.warn(
        "No se pudo comprobar si el usuario tiene rondas:",
        errorRondas.message
      );
    }

    await context.env.DB.prepare(`
      DELETE FROM usuarios
      WHERE id = ?
    `).bind(id).run();

    return Response.json({
      ok: true,
      mensaje: "Usuario eliminado correctamente"
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error.message
      },
      {
        status: 500
      }
    );
  }
}