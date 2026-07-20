const DASHBOARD_REFRESH_MS = 30000;

document.addEventListener("DOMContentLoaded", () => {
  if (typeof protegerPagina === "function") {
    protegerPagina(["Administrador"]);
  }

  if (typeof cargarMenu === "function") {
    cargarMenu("dashboard");
  }

  cargarDatosUsuario();
  actualizarFechaHora();
  cargarDashboard();

  const botonActualizar = document.getElementById("btnActualizar");
  if (botonActualizar) botonActualizar.addEventListener("click", cargarDashboard);

  window.setInterval(actualizarFechaHora, 1000);
  window.setInterval(cargarDashboard, DASHBOARD_REFRESH_MS);
});

function cargarDatosUsuario() {
  if (typeof obtenerUsuario !== "function") return;
  const usuario = obtenerUsuario();
  if (!usuario) return;

  asignarTexto("nombreUsuario", usuario.nombre || usuario.usuario || "Usuario");
  asignarTexto("rolUsuario", usuario.rol || "Administrador");
}

function actualizarFechaHora() {
  const elemento = document.getElementById("fechaHora");
  if (!elemento) return;

  elemento.textContent = new Intl.DateTimeFormat("es-CL", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "America/Santiago"
  }).format(new Date());
}

async function obtenerJSON(url) {
  const respuesta = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(`La respuesta de ${url} no contiene JSON válido.`);
  }

  if (!respuesta.ok) {
    throw new Error(datos?.error || `Error HTTP ${respuesta.status} en ${url}.`);
  }

  if (!Array.isArray(datos)) {
    throw new Error(datos?.error || `La respuesta de ${url} no es una lista.`);
  }

  return datos;
}

async function cargarDashboard() {
  const botonActualizar = document.getElementById("btnActualizar");

  if (botonActualizar) {
    botonActualizar.disabled = true;
    botonActualizar.textContent = "Actualizando...";
  }

  establecerEstadoSistema("cargando");

  try {
    const [usuarios, empresas, instalaciones, puntos, rondas] = await Promise.all([
      obtenerJSON("/api/usuarios"),
      obtenerJSON("/api/empresas"),
      obtenerJSON("/api/instalaciones"),
      obtenerJSON("/api/puntos"),
      obtenerJSON("/api/rondas")
    ]);

    asignarTexto("totalUsuarios", usuarios.length);
    asignarTexto("totalEmpresas", empresas.length);
    asignarTexto("totalInstalaciones", instalaciones.length);
    asignarTexto("totalPuntos", puntos.length);
    asignarTexto("totalRondas", rondas.length);

    actualizarResumenUltimaRonda(rondas);
    renderizarRondas(rondas.slice(0, 10));

    asignarTexto("ultimaActualizacion", new Intl.DateTimeFormat("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "America/Santiago"
    }).format(new Date()));

    establecerEstadoSistema("online");
  } catch (error) {
    console.error("Error al cargar el dashboard:", error);
    establecerEstadoSistema("error");
    renderizarError(error.message);
    mostrarNotificacion(error.message, "error");
  } finally {
    if (botonActualizar) {
      botonActualizar.disabled = false;
      botonActualizar.textContent = "Actualizar datos";
    }
  }
}

function asignarTexto(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.textContent = String(valor);
}

function actualizarResumenUltimaRonda(rondas) {
  const ultimaRonda = rondas[0];
  asignarTexto("ultimoGuardia", ultimaRonda?.guardia || "Sin registros");
  asignarTexto("ultimoPunto", ultimaRonda?.punto || "Sin registros");
}

function renderizarRondas(rondas) {
  const tabla = document.getElementById("tablaRondas");
  if (!tabla) return;

  if (!rondas.length) {
    tabla.innerHTML = `<tr><td colspan="7" class="empty-state">Aún no existen rondas registradas.</td></tr>`;
    return;
  }

  tabla.innerHTML = rondas.map((ronda) => {
    const gpsDisponible = ronda.latitud !== null && ronda.latitud !== undefined && ronda.latitud !== "" && ronda.longitud !== null && ronda.longitud !== undefined && ronda.longitud !== "";

    const enlaceMapa = gpsDisponible
      ? `<a class="table-link" href="https://www.google.com/maps?q=${encodeURIComponent(ronda.latitud)},${encodeURIComponent(ronda.longitud)}" target="_blank" rel="noopener noreferrer">Ver mapa</a>`
      : '<span class="muted">Sin GPS</span>';

    return `<tr>
      <td>${escaparHTML(ronda.id ?? "-")}</td>
      <td>${escaparHTML(ronda.guardia || "-")}</td>
      <td>${escaparHTML(ronda.empresa || "-")}</td>
      <td>${escaparHTML(ronda.instalacion || "-")}</td>
      <td>${escaparHTML(ronda.punto || "-")}</td>
      <td>${escaparHTML(formatearFecha(ronda.fecha))}</td>
      <td>${enlaceMapa}</td>
    </tr>`;
  }).join("");
}

function renderizarError(mensaje) {
  const tabla = document.getElementById("tablaRondas");
  if (!tabla) return;
  tabla.innerHTML = `<tr><td colspan="7" class="empty-state error-text">No fue posible cargar los datos: ${escaparHTML(mensaje)}</td></tr>`;
}

function formatearFecha(fecha) {
  if (!fecha) return "-";
  const fechaNormalizada = String(fecha).includes("T") ? String(fecha) : `${String(fecha).replace(" ", "T")}Z`;
  const fechaObjeto = new Date(fechaNormalizada);
  if (Number.isNaN(fechaObjeto.getTime())) return String(fecha);

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santiago"
  }).format(fechaObjeto);
}

function establecerEstadoSistema(estado) {
  const elemento = document.getElementById("estadoSistema");
  if (!elemento) return;

  elemento.classList.remove("status-loading", "status-online", "status-error");
  const texto = elemento.querySelector("span:last-child");

  if (estado === "cargando") {
    elemento.classList.add("status-loading");
    if (texto) texto.textContent = "Actualizando";
    return;
  }

  if (estado === "error") {
    elemento.classList.add("status-error");
    if (texto) texto.textContent = "Error de conexión";
    return;
  }

  elemento.classList.add("status-online");
  if (texto) texto.textContent = "Sistema operativo";
}

function mostrarNotificacion(mensaje, tipo = "ok") {
  const notificacion = document.getElementById("notificacion");
  if (!notificacion) return;

  notificacion.textContent = mensaje;
  notificacion.className = `notification notification-${tipo} visible`;
  window.setTimeout(() => notificacion.classList.remove("visible"), 4500);
}

function escaparHTML(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
