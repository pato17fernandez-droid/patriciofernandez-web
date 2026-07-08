function obtenerUsuario() {
  const data = localStorage.getItem("guardcontrol_user");

  if (!data) {
    location.href = "/guardcontrol/login.html";
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    localStorage.removeItem("guardcontrol_user");
    location.href = "/guardcontrol/login.html";
    return null;
  }
}

function mostrarUsuario() {
  const user = obtenerUsuario();
  if (!user) return;

  document.querySelectorAll(".user").forEach(el => {
    el.innerText = `${user.nombre} (${user.rol})`;
  });
}

function cerrarSesion() {
  localStorage.removeItem("guardcontrol_user");
  location.href = "/guardcontrol/login.html";
}

mostrarUsuario();