function cargarMenu(paginaActiva) {
  const menu = document.getElementById("menu");

  menu.innerHTML = `
    <a ${paginaActiva === "dashboard" ? 'class="active"' : ""} href="/guardcontrol/">Dashboard</a>
    <a ${paginaActiva === "usuarios" ? 'class="active"' : ""} href="/guardcontrol/usuarios.html">Usuarios</a>
    <a ${paginaActiva === "empresas" ? 'class="active"' : ""} href="/guardcontrol/empresas.html">Empresas</a>
    <a ${paginaActiva === "instalaciones" ? 'class="active"' : ""} href="/guardcontrol/instalaciones.html">Instalaciones</a>
    <a ${paginaActiva === "puntos" ? 'class="active"' : ""} href="/guardcontrol/puntos.html">Puntos QR</a>
    <a ${paginaActiva === "reportes" ? 'class="active"' : ""} href="/guardcontrol/reportes.html">Reportes</a>
    <a ${paginaActiva === "herramientas" ? 'class="active"' : ""} href="/guardcontrol/herramientas.html">🛠 Herramientas</a>
  `;
}