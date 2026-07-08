async function cargarPuntos() {
  try {
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

  } catch (error) {
    console.error(error);
    document.getElementById("tablaPuntos").innerHTML =
      `<tr><td colspan="7">Error al cargar puntos</td></tr>`;
  }
}