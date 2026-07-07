async function cargarInstalacionesSelect() {
  const respuesta = await fetch("/api/instalaciones");
  const instalaciones = await respuesta.json();

  const select = document.getElementById("instalacion_id");

  if (!instalaciones.length) {
    select.innerHTML = `<option value="">Primero crea una instalación</option>`;
    return;
  }

  select.innerHTML = instalaciones.map(i =>
    `<option value="${i.id}">${i.empresa || "Sin empresa"} - ${i.nombre}</option>`
  ).join("");
}

async function cargarPuntos() {
  try {
    const respuesta = await fetch("/api/puntos");
    const puntos = await respuesta.json();

    const tabla = document.getElementById("tablaPuntos");

    if (!puntos.length) {
      tabla.innerHTML = `<tr><td colspan="7">No hay puntos registrados</td></tr>`;
      return;
    }

    tabla.innerHTML = puntos.map(p => {
      const urlQR = `${location.origin}/guardcontrol/marcar.html?punto=${encodeURIComponent(p.codigo_qr)}`;
      const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(urlQR)}`;

      return `
        <tr>
          <td>${p.id}</td>
          <td>${p.empresa || "-"}</td>
          <td>${p.instalacion || "-"}</td>
          <td>${p.nombre}</td>
          <td>${p.codigo_qr}</td>
          <td>
            <a href="${qrImg}" target="_blank">Ver QR</a>
          </td>
          <td>${p.estado}</td>
        </tr>
      `;
    }).join("");

  } catch (error) {
    document.getElementById("tablaPuntos").innerHTML =
      `<tr><td colspan="7">Error al cargar puntos</td></tr>`;
  }
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
    alert("Punto creado correctamente. Código: " + resultado.codigo_qr);
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