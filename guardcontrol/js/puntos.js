async function cargarInstalacionesSelect() {
  const respuesta = await fetch("/api/instalaciones");
  const instalaciones = await respuesta.json();

  const select = document.getElementById("instalacion_id");

  select.innerHTML = instalaciones.map(i => `
    <option value="${i.id}">${i.empresa || "Sin empresa"} - ${i.nombre}</option>
  `).join("");
}

async function cargarPuntos() {
  const respuesta = await fetch("/api/puntos");
  const puntos = await respuesta.json();

  const tabla = document.getElementById("tablaPuntos");

  if (!puntos.length) {
    tabla.innerHTML = `<tr><td colspan="7">No hay puntos registrados</td></tr>`;
    return;
  }

  tabla.innerHTML = puntos.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.empresa || "-"}</td>
      <td>${p.instalacion || "-"}</td>
      <td>${p.nombre}</td>
      <td>${p.codigo_qr}</td>
      <td>
        <a href="/guardcontrol/qr.html?empresa=${encodeURIComponent(p.empresa || "-")}&instalacion=${encodeURIComponent(p.instalacion || "-")}&punto=${encodeURIComponent(p.nombre)}&codigo=${encodeURIComponent(p.codigo_qr)}" target="_blank">
          Imprimir QR
        </a>
      </td>
      <td>${p.estado}</td>
    </tr>
  `).join("");
}

async function crearPunto() {
  const datos = {
    instalacion_id: document.getElementById("instalacion_id").value,
    nombre: document.getElementById("nombre").value.trim(),
    latitud: document.getElementById("latitud").value.trim(),
    longitud: document.getElementById("longitud").value.trim()
  };

  if (!datos.instalacion_id || !datos.nombre) {
    alert("Instalación y nombre son obligatorios");
    return;
  }

  const respuesta = await fetch("/api/puntos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (resultado.ok) {
    alert("Punto creado correctamente");
    document.getElementById("nombre").value = "";
    document.getElementById("latitud").value = "";
    document.getElementById("longitud").value = "";
    cargarPuntos();
  } else {
    alert("Error: " + resultado.error);
  }
}

cargarInstalacionesSelect();
cargarPuntos();