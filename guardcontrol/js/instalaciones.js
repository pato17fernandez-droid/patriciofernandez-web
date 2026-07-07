async function cargarEmpresasSelect() {
  const respuesta = await fetch("/api/empresas");
  const empresas = await respuesta.json();

  const select = document.getElementById("empresa_id");

  if (!empresas.length) {
    select.innerHTML = `<option value="">Primero crea una empresa</option>`;
    return;
  }

  select.innerHTML = empresas.map(e =>
    `<option value="${e.id}">${e.nombre}</option>`
  ).join("");
}

async function cargarInstalaciones() {
  try {
    const respuesta = await fetch("/api/instalaciones");
    const instalaciones = await respuesta.json();

    const tabla = document.getElementById("tablaInstalaciones");

    if (!instalaciones.length) {
      tabla.innerHTML = `<tr><td colspan="5">No hay instalaciones registradas</td></tr>`;
      return;
    }

    tabla.innerHTML = instalaciones.map(i => `
      <tr>
        <td>${i.id}</td>
        <td>${i.empresa || "-"}</td>
        <td>${i.nombre}</td>
        <td>${i.direccion || "-"}</td>
        <td>${i.estado}</td>
      </tr>
    `).join("");

  } catch (error) {
    document.getElementById("tablaInstalaciones").innerHTML =
      `<tr><td colspan="5">Error al cargar instalaciones</td></tr>`;
  }
}

async function crearInstalacion() {
  const datos = {
    empresa_id: document.getElementById("empresa_id").value,
    nombre: document.getElementById("nombre").value.trim(),
    direccion: document.getElementById("direccion").value.trim(),
    latitud: document.getElementById("latitud").value.trim(),
    longitud: document.getElementById("longitud").value.trim()
  };

  if (!datos.empresa_id || !datos.nombre) {
    alert("Empresa y nombre son obligatorios");
    return;
  }

  const respuesta = await fetch("/api/instalaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (resultado.ok) {
    alert("Instalación creada correctamente");
    document.getElementById("nombre").value = "";
    document.getElementById("direccion").value = "";
    document.getElementById("latitud").value = "";
    document.getElementById("longitud").value = "";
    cargarInstalaciones();
  } else {
    alert("Error: " + resultado.error);
  }
}

cargarEmpresasSelect();
cargarInstalaciones();