let usuariosCargados = [];

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asegurarColumnaAcciones() {
  const tablaUsuarios = document.getElementById("tablaUsuarios");

  if (!tablaUsuarios) {
    return;
  }

  const tabla = tablaUsuarios.closest("table");

  if (!tabla) {
    return;
  }

  const filaEncabezado = tabla.querySelector("thead tr");

  if (!filaEncabezado) {
    return;
  }

  const encabezados = Array.from(
    filaEncabezado.querySelectorAll("th")
  );

  const tieneAcciones = encabezados.some(
    th => th.textContent.trim().toLowerCase() === "acciones"
  );

  if (!tieneAcciones) {
    const nuevoEncabezado = document.createElement("th");
    nuevoEncabezado.textContent = "Acciones";
    filaEncabezado.appendChild(nuevoEncabezado);
  }
}

async function cargarUsuarios() {
  const tabla = document.getElementById("tablaUsuarios");

  if (!tabla) {
    console.error("No existe el elemento #tablaUsuarios");
    return;
  }

  asegurarColumnaAcciones();

  tabla.innerHTML = `
    <tr>
      <td colspan="5">Cargando usuarios...</td>
    </tr>
  `;

  try {
    const respuesta = await fetch("/api/usuarios", {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(
        resultado.error || "No se pudieron cargar los usuarios"
      );
    }

    if (!Array.isArray(resultado)) {
      throw new Error("La respuesta del servidor no es válida");
    }

    usuariosCargados = resultado;

    if (usuariosCargados.length === 0) {
      tabla.innerHTML = `
        <tr>
          <td colspan="5">No hay usuarios registrados</td>
        </tr>
      `;
      return;
    }

    tabla.innerHTML = usuariosCargados.map(usuario => `
      <tr>
        <td>${escaparHtml(usuario.id)}</td>
        <td>${escaparHtml(usuario.nombre)}</td>
        <td>${escaparHtml(usuario.usuario)}</td>
        <td>${escaparHtml(usuario.rol)}</td>

        <td>
          <button
            type="button"
            onclick="editarUsuario(${Number(usuario.id)})"
            title="Editar usuario"
            style="
              cursor: pointer;
              margin-right: 6px;
              padding: 6px 10px;
            "
          >
            ✏️ Editar
          </button>

          <button
            type="button"
            onclick="eliminarUsuario(${Number(usuario.id)})"
            title="Eliminar usuario"
            style="
              cursor: pointer;
              padding: 6px 10px;
            "
          >
            🗑️ Eliminar
          </button>
        </td>
      </tr>
    `).join("");
  } catch (error) {
    console.error("Error al cargar usuarios:", error);

    tabla.innerHTML = `
      <tr>
        <td colspan="5">
          Error al cargar usuarios: ${escaparHtml(error.message)}
        </td>
      </tr>
    `;
  }
}

async function crearUsuario() {
  const campoNombre = document.getElementById("nombre");
  const campoUsuario = document.getElementById("usuario");
  const campoPassword = document.getElementById("password");
  const campoRol = document.getElementById("rol");

  if (
    !campoNombre ||
    !campoUsuario ||
    !campoPassword ||
    !campoRol
  ) {
    alert("No se encontraron todos los campos del formulario");
    return;
  }

  const datos = {
    nombre: campoNombre.value.trim(),
    usuario: campoUsuario.value.trim(),
    password: campoPassword.value.trim(),
    rol: campoRol.value.trim()
  };

  if (
    !datos.nombre ||
    !datos.usuario ||
    !datos.password ||
    !datos.rol
  ) {
    alert("Completa todos los campos");
    return;
  }

  try {
    const respuesta = await fetch("/api/usuarios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(datos)
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok || !resultado.ok) {
      throw new Error(
        resultado.error || "No se pudo crear el usuario"
      );
    }

    alert(
      resultado.mensaje ||
      "Usuario creado correctamente"
    );

    campoNombre.value = "";
    campoUsuario.value = "";
    campoPassword.value = "";

    await cargarUsuarios();
  } catch (error) {
    console.error("Error al crear usuario:", error);
    alert("Error: " + error.message);
  }
}

async function editarUsuario(id) {
  const usuarioActual = usuariosCargados.find(
    usuario => Number(usuario.id) === Number(id)
  );

  if (!usuarioActual) {
    alert("No se encontró el usuario seleccionado");
    return;
  }

  const nuevoNombre = prompt(
    "Nombre completo:",
    usuarioActual.nombre
  );

  if (nuevoNombre === null) {
    return;
  }

  const nuevoUsuario = prompt(
    "Nombre de usuario:",
    usuarioActual.usuario
  );

  if (nuevoUsuario === null) {
    return;
  }

  const nuevoRol = prompt(
    "Rol del usuario:\n\nAdministrador\nSupervisor\nGuardia",
    usuarioActual.rol
  );

  if (nuevoRol === null) {
    return;
  }

  const nuevaPassword = prompt(
    "Nueva contraseña:\n\nDéjala vacía para conservar la contraseña actual.",
    ""
  );

  if (nuevaPassword === null) {
    return;
  }

  const datos = {
    id: Number(id),
    nombre: nuevoNombre.trim(),
    usuario: nuevoUsuario.trim(),
    rol: nuevoRol.trim(),
    password: nuevaPassword.trim()
  };

  if (!datos.nombre || !datos.usuario || !datos.rol) {
    alert("Nombre, usuario y rol son obligatorios");
    return;
  }

  const rolesPermitidos = [
    "administrador",
    "supervisor",
    "guardia"
  ];

  if (!rolesPermitidos.includes(datos.rol.toLowerCase())) {
    alert(
      "El rol debe ser Administrador, Supervisor o Guardia"
    );
    return;
  }

  const confirmar = confirm(
    `¿Guardar los cambios del usuario "${usuarioActual.nombre}"?`
  );

  if (!confirmar) {
    return;
  }

  try {
    const respuesta = await fetch("/api/usuarios", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(datos)
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok || !resultado.ok) {
      throw new Error(
        resultado.error || "No se pudo actualizar el usuario"
      );
    }

    alert(
      resultado.mensaje ||
      "Usuario actualizado correctamente"
    );

    await cargarUsuarios();
  } catch (error) {
    console.error("Error al editar usuario:", error);
    alert("Error: " + error.message);
  }
}

async function eliminarUsuario(id) {
  const usuarioSeleccionado = usuariosCargados.find(
    usuario => Number(usuario.id) === Number(id)
  );

  if (!usuarioSeleccionado) {
    alert("No se encontró el usuario seleccionado");
    return;
  }

  const confirmar = confirm(
    `¿Estás seguro de eliminar a "${usuarioSeleccionado.nombre}"?\n\n` +
    `Usuario: ${usuarioSeleccionado.usuario}\n` +
    `Rol: ${usuarioSeleccionado.rol}\n\n` +
    "Esta acción no se puede deshacer."
  );

  if (!confirmar) {
    return;
  }

  try {
    const respuesta = await fetch(
      `/api/usuarios?id=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok || !resultado.ok) {
      throw new Error(
        resultado.error || "No se pudo eliminar el usuario"
      );
    }

    alert(
      resultado.mensaje ||
      "Usuario eliminado correctamente"
    );

    await cargarUsuarios();
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    alert("Error: " + error.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarUsuarios();
});