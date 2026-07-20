function cargarMenu(paginaActiva) {
  const contenedor = document.getElementById("menu");

  if (!contenedor) {
    return;
  }

  const enlaces = [
    { id: "dashboard", texto: "Centro de Operaciones", icono: "🏠", url: "/guardcontrol/" },
    { id: "usuarios", texto: "Usuarios", icono: "👥", url: "/guardcontrol/usuarios.html" },
    { id: "empresas", texto: "Empresas", icono: "🏢", url: "/guardcontrol/empresas.html" },
    { id: "instalaciones", texto: "Instalaciones", icono: "📍", url: "/guardcontrol/instalaciones.html" },
    { id: "puntos", texto: "Puntos QR", icono: "🔳", url: "/guardcontrol/puntos.html" },
    { id: "reportes", texto: "Reportes", icono: "📊", url: "/guardcontrol/reportes.html" },
    { id: "herramientas", texto: "Herramientas", icono: "🛠️", url: "/guardcontrol/herramientas.html" }
  ];

  const enlacesHtml = enlaces.map((enlace) => {
    const claseActiva = paginaActiva === enlace.id ? "active" : "";
    return `<a class="${claseActiva}" href="${enlace.url}"><span class="menu-icon" aria-hidden="true">${enlace.icono}</span><span>${enlace.texto}</span></a>`;
  }).join("");

  contenedor.innerHTML = `
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">🛡️</div>
      <div>
        <div class="logo">Guard<span>Control</span></div>
        <div class="subtitle">Control inteligente de rondas</div>
      </div>
    </div>

    <nav class="menu" aria-label="Menú principal">${enlacesHtml}</nav>

    <div class="sidebar-footer">
      <div class="sidebar-version">GuardControl v2.0</div>
      <button class="logout-button" id="btnCerrarSesion" type="button"><span aria-hidden="true">🚪</span><span>Cerrar sesión</span></button>
    </div>
  `;

  const botonCerrarSesion = document.getElementById("btnCerrarSesion");

  if (botonCerrarSesion) {
    botonCerrarSesion.addEventListener("click", () => {
      if (typeof cerrarSesion === "function") {
        cerrarSesion();
        return;
      }

      localStorage.removeItem("guardcontrol_usuario");
      localStorage.removeItem("guardcontrol_session_started");
      window.location.href = "/guardcontrol/login.html";
    });
  }
}
