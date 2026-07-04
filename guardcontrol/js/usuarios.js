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

async function crearUsuario() {
  const datos = {
    nombre: document.getElementById("nombre").value.trim(),
    usuario: document.getElementById("usuario").value.trim(),
    password: document.getElementById("password").value.trim(),
    rol: document.getElementById("rol").value
  };

  if (!datos.nombre || !datos.usuario || !datos.password || !datos.rol) {
    alert("Completa todos los campos");
    return;
  }

  const respuesta = await fetch("/api/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (resultado.ok) {
    alert("Usuario creado correctamente");
    document.getElementById("nombre").value = "";
    document.getElementById("usuario").value = "";
    document.getElementById("password").value = "";
    cargarUsuarios();
  } else {
    alert("Error al guardar: " + JSON.stringify(resultado));
  }
}

cargarUsuarios();