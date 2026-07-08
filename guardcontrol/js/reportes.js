const user = obtenerUsuario();

document.querySelectorAll(".user").forEach(el => {
  el.innerText = `${user.nombre} (${user.rol})`;
});

async function cargarRondas() {
  try {
    const respuesta = await fetch("/api/rondas");
    const rondas = await respuesta.json();

    const tabla = document.getElementById("tablaRondas");

    if (!rondas.length) {
      tabla.innerHTML = `<tr><td colspan="7">No hay rondas registradas todavía</td></tr>`;
      return;
    }

    tabla.innerHTML = rondas.map(r => {
      const mapa = `https://www.google.com/maps?q=${r.latitud},${r.longitud}`;

      return `
        <tr>
          <td>${r.id}</td>
          <td>${r.guardia}</td>
          <td>${r.empresa || "-"}</td>
          <td>${r.instalacion || "-"}</td>
          <td>${r.punto || "-"}</td>
          <td>${r.fecha}</td>
          <td><a href="${mapa}" target="_blank">Ver mapa</a></td>
        </tr>
      `;
    }).join("");

  } catch (error) {
    document.getElementById("tablaRondas").innerHTML =
      `<tr><td colspan="7">Error al cargar rondas</td></tr>`;
  }
}

cargarRondas();
setInterval(cargarRondas, 5000);