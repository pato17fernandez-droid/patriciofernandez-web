async function cargarEmpresas() {
  try {
    const respuesta = await fetch("/api/empresas");
    const empresas = await respuesta.json();

    const tabla = document.getElementById("tablaEmpresas");

    if (!empresas.length) {
      tabla.innerHTML = `<tr><td colspan="6">No hay empresas registradas</td></tr>`;
      return;
    }

    tabla.innerHTML = empresas.map(e => `
      <tr>
        <td>${e.id}</td>
        <td>${e.nombre}</td>
        <td>${e.rut || "-"}</td>
        <td>${e.correo || "-"}</td>
        <td>${e.telefono || "-"}</td>
        <td>${e.estado}</td>
      </tr>
    `).join("");

  } catch (error) {
    document.getElementById("tablaEmpresas").innerHTML =
      `<tr><td colspan="6">Error al cargar empresas</td></tr>`;
  }
}

async function crearEmpresa() {
  const datos = {
    nombre: document.getElementById("nombre").value.trim(),
    rut: document.getElementById("rut").value.trim(),
    correo: document.getElementById("correo").value.trim(),
    telefono: document.getElementById("telefono").value.trim()
  };

  if (!datos.nombre) {
    alert("El nombre de la empresa es obligatorio");
    return;
  }

  const respuesta = await fetch("/api/empresas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (resultado.ok) {
    alert("Empresa creada correctamente");
    document.getElementById("nombre").value = "";
    document.getElementById("rut").value = "";
    document.getElementById("correo").value = "";
    document.getElementById("telefono").value = "";
    cargarEmpresas();
  } else {
    alert("Error: " + resultado.error);
  }
}

cargarEmpresas();