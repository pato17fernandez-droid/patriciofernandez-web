const SESION_MAXIMA_MS = 8 * 60 * 60 * 1000; // 8 horas

function obtenerUsuario() {
  const data = localStorage.getItem("guardcontrol_user");
  const inicioSesion = localStorage.getItem("guardcontrol_session_started");

  if (!data || !inicioSesion) {
    redirigirAlLogin();
    return null;
  }

  const tiempoTranscurrido = Date.now() - Number(inicioSesion);

  if (tiempoTranscurrido > SESION_MAXIMA_MS) {
    cerrarSesionPorExpiracion();
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    limpiarSesion();
    redirigirAlLogin();
    return null;
  }
}

function protegerPagina(rolesPermitidos) {
  const user = obtenerUsuario();
  if (!user) return;

  if (!rolesPermitidos.includes(user.rol)) {
    alert("Acceso denegado para tu rol: " + user.rol);

    if (user.rol === "Guardia") {
      location.href = "/guardcontrol/guardia.html";
    } else if (user.rol === "Supervisor") {
      location.href = "/guardcontrol/reportes.html";
    } else {
      location.href = "/guardcontrol/";
    }
    return;
  }

  document.querySelectorAll(".user").forEach(el => {
    el.innerText = `${user.nombre} (${user.rol})`;
  });
}

function guardarDestinoPendiente() {
  const actual = location.pathname + location.search;

  if (!actual.includes("login.html")) {
    localStorage.setItem("guardcontrol_redirect_after_login", actual);
  }
}

function redirigirAlLogin() {
  guardarDestinoPendiente();
  location.href = "/guardcontrol/login.html";
}

function limpiarSesion() {
  localStorage.removeItem("guardcontrol_user");
  localStorage.removeItem("guardcontrol_session_started");
}

function cerrarSesion() {
  limpiarSesion();
  localStorage.removeItem("guardcontrol_redirect_after_login");
  location.href = "/guardcontrol/login.html";
}

function cerrarSesionPorExpiracion() {
  limpiarSesion();
  guardarDestinoPendiente();
  alert("Tu sesión expiró. Inicia sesión nuevamente.");
  location.href = "/guardcontrol/login.html";
}