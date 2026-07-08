function obtenerUsuario() {
  const data = localStorage.getItem("guardcontrol_user");

  if (!data) {
    window.location.href = "/guardcontrol/login.html";
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    localStorage.removeItem("guardcontrol_user");
    window.location.href = "/guardcontrol/login.html";
    return null;
  }
}

function protegerPagina(rolesPermitidos) {
  const user = obtenerUsuario();
  if (!user) return;

  if (!rolesPermitidos.includes(user.rol)) {
    alert("Acceso denegado para tu rol: " + user.rol);

    if (user.rol === "Guardia") {
      window.location.href = "/guardcontrol/guardia.html";
    } else if (user.rol === "Supervisor") {
      window.location.href = "/guardcontrol/reportes.html";
    } else {
      window.location.href = "/guardcontrol/";
    }

    return;
  }

  document.querySelectorAll(".user").forEach(el => {
    el.innerText = `${user.nombre} (${user.rol})`;
  });
}

function cerrarSesion() {
  localStorage.removeItem("guardcontrol_user");
  window.location.href = "/guardcontrol/login.html";
}