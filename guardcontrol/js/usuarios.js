async function cargarUsuarios() {
  try {
    const respuesta = await fetch("/api/usuarios");
    const usuarios = await respuesta.json();

    const tabla = document.getElementById("tablaUsuarios");

    if (!usuarios.length) {
      tabla.innerHTML = `<tr><td colspan="4">No hay usuarios registrados</td></tr>`;
      return;
    }

    tabla.innerHTML = usuarios.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.nombre}</td>
        <td>${u.usuario}</td>
        <td>${u.rol}</td>
      </tr>
    `).join("");

  } catch (error) {
    document.getElementById("tablaUsuarios").innerHTML =
      `<tr><td colspan="4">Error al cargar usuarios</td></tr>`;
  }
}

cargarUsuarios();