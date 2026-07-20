const SESION_MAXIMA_MS = 8 * 60 * 60 * 1000;

function obtenerUsuario() {
  const data = localStorage.getItem("guardcontrol_user");
  const inicioSesion = localStorage.getItem("guardcontrol_session_started");

  if (!data || !inicioSesion) {
    redirigirAlLogin();
    return null;
  }

  const inicioNumerico = Number(inicioSesion);
  const tiempoTranscurrido = Date.now() - inicioNumerico;

  if (!Number.isFinite(inicioNumerico) || tiempoTranscurrido < 0 || tiempoTranscurrido > SESION_MAXIMA_MS) {
    cerrarSesionPorExpiracion();
    return null;
  }

  try {
    const usuario = JSON.parse(data);
    if (!usuario || !usuario.rol) throw new Error("Sesión inválida.");
    return usuario;
  } catch {
    limpiarSesion();
    redirigirAlLogin();
    return null;
  }
}

function protegerPagina(rolesPermitidos = []) {
  const usuario = obtenerUsuario();
  if (!usuario) return;

  const rolActual = String(usuario.rol).trim().toLowerCase();
  const rolesNormalizados = rolesPermitidos.map((rol) => String(rol).trim().toLowerCase());

  if (rolesNormalizados.length > 0 && !rolesNormalizados.includes(rolActual)) {
    alert(`Acceso denegado para tu rol: ${usuario.rol}`);
    redirigirSegunRol(usuario.rol);
    return;
  }

  document.querySelectorAll(".user").forEach((elemento) => {
    elemento.textContent = `${usuario.nombre} (${usuario.rol})`;
  });
}

function guardarDestinoPendiente() {
  const actual = window.location.pathname + window.location.search;
  if (actual.startsWith("/guardcontrol/") && !actual.includes("login.html")) {
    localStorage.setItem("guardcontrol_redirect_after_login", actual);
  }
}

function redirigirAlLogin() {
  guardarDestinoPendiente();
  window.location.href = "/guardcontrol/login.html";
}

function limpiarSesion() {
  localStorage.removeItem("guardcontrol_user");
  localStorage.removeItem("guardcontrol_session_started");
}

function cerrarSesion() {
  limpiarSesion();
  localStorage.removeItem("guardcontrol_redirect_after_login");
  window.location.href = "/guardcontrol/login.html";
}

function cerrarSesionPorExpiracion() {
  guardarDestinoPendiente();
  limpiarSesion();
  alert("Tu sesión expiró. Inicia sesión nuevamente.");
  window.location.href = "/guardcontrol/login.html";
}

function redirigirSegunRol(rol) {
  const rolNormalizado = String(rol).trim().toLowerCase();
  if (rolNormalizado === "guardia") { window.location.href = "/guardcontrol/guardia.html"; return; }
  if (rolNormalizado === "supervisor") { window.location.href = "/guardcontrol/reportes.html"; return; }
  window.location.href = "/guardcontrol/";
}
