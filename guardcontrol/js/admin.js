async function cargarDashboard() {
  try {
    const respuesta = await fetch("/api/marcas");
    const marcas = await respuesta.json();

    document.getElementById("totalRegistros").innerText = marcas.length;

    if (marcas.length > 0) {
      document.getElementById("ultimoGuardia").innerText = marcas[0].guardia;
      document.getElementById("ultimoPunto").innerText = marcas[0].punto;
    }

    const tabla = document.getElementById("tabla");

    if (!marcas.length) {
      tabla.innerHTML = `<tr><td colspan="5">No hay registros todavía</td></tr>`;
      return;
    }

    tabla.innerHTML = marcas.map(marca => {
      const mapa = `https://www.google.com/maps?q=${marca.latitud},${marca.longitud}`;

      return `
        <tr>
          <td>${marca.id}</td>
          <td>${marca.guardia}</td>
          <td>${marca.punto}</td>
          <td>${marca.fecha}</td>
          <td><a href="${mapa}" target="_blank">Ver mapa</a></td>
        </tr>
      `;
    }).join("");

  } catch (error) {
    document.getElementById("tabla").innerHTML =
      `<tr><td colspan="5">Error cargando datos</td></tr>`;
  }
}

cargarDashboard();
setInterval(cargarDashboard, 5000);