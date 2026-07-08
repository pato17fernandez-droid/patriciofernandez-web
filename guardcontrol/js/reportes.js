const user = obtenerUsuario();

let rondasOriginales = [];
let rondasFiltradas = [];

document.querySelectorAll(".user").forEach(el => {
  el.innerText = `${user.nombre} (${user.rol})`;
});

function formatearFechaChile(fechaUTC) {
  return new Date(fechaUTC + "Z").toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "short",
    timeStyle: "medium"
  });
}

function fechaChileISO(fechaUTC) {
  const fecha = new Date(fechaUTC + "Z");

  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(fecha);

  return partes;
}

async function cargarRondas() {
  try {
    const respuesta = await fetch("/api/rondas");
    const rondas = await respuesta.json();

    rondasOriginales = Array.isArray(rondas) ? rondas : [];

    aplicarFiltros(false);

    document.getElementById("ultimaActualizacion").innerText =
      new Date().toLocaleTimeString("es-CL", {
        timeZone: "America/Santiago"
      });

  } catch (error) {
    console.error(error);
    document.getElementById("tablaRondas").innerHTML = `
      <tr>
        <td colspan="7">Error al cargar rondas</td>
      </tr>
    `;
  }
}

function aplicarFiltros(mostrarAviso = true) {
  const texto = document.getElementById("filtroTexto").value.trim().toLowerCase();
  const fecha = document.getElementById("filtroFecha").value;

  rondasFiltradas = rondasOriginales.filter(r => {
    const contenido = `
      ${r.guardia || ""}
      ${r.empresa || ""}
      ${r.instalacion || ""}
      ${r.punto || ""}
    `.toLowerCase();

    const coincideTexto = !texto || contenido.includes(texto);
    const coincideFecha = !fecha || fechaChileISO(r.fecha) === fecha;

    return coincideTexto && coincideFecha;
  });

  renderizarTabla(rondasFiltradas);
  actualizarResumen(rondasFiltradas);

  if (mostrarAviso) {
    console.log("Filtros aplicados");
  }
}

function limpiarFiltros() {
  document.getElementById("filtroTexto").value = "";
  document.getElementById("filtroFecha").value = "";

  rondasFiltradas = [...rondasOriginales];

  renderizarTabla(rondasFiltradas);
  actualizarResumen(rondasFiltradas);
}

function actualizarResumen(rondas) {
  document.getElementById("totalRondas").innerText = rondas.length;

  if (!rondas.length) {
    document.getElementById("ultimaRonda").innerText = "-";
    return;
  }

  document.getElementById("ultimaRonda").innerText =
    formatearFechaChile(rondas[0].fecha);
}

function renderizarTabla(rondas) {
  const tabla = document.getElementById("tablaRondas");

  if (!rondas.length) {
    tabla.innerHTML = `
      <tr>
        <td colspan="7">No hay rondas para mostrar</td>
      </tr>
    `;
    return;
  }

  tabla.innerHTML = rondas.map(r => {
    const mapa = `https://www.google.com/maps?q=${r.latitud},${r.longitud}`;
    const fechaChile = formatearFechaChile(r.fecha);

    return `
      <tr>
        <td>${r.id}</td>
        <td>${r.guardia}</td>
        <td>${r.empresa || "-"}</td>
        <td>${r.instalacion || "-"}</td>
        <td>${r.punto || "-"}</td>
        <td>${fechaChile}</td>
        <td>
          <a href="${mapa}" target="_blank">📍 Ver mapa</a>
        </td>
      </tr>
    `;
  }).join("");
}

cargarRondas();
setInterval(cargarRondas, 5000);