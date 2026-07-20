function cargarMenu(paginaActiva) {

const menu=document.getElementById("menu");

menu.innerHTML=`

<div class="logo">

🛡 Guard<span>Control</span>

</div>

<div class="subtitle">

Sistema de Control de Rondas

</div>

<nav class="menu">

<a ${paginaActiva==="dashboard"?'class="active"':""}
href="/guardcontrol/">

🏠 Centro de Operaciones

</a>

<a ${paginaActiva==="usuarios"?'class="active"':""}
href="/guardcontrol/usuarios.html">

👥 Usuarios

</a>

<a ${paginaActiva==="empresas"?'class="active"':""}
href="/guardcontrol/empresas.html">

🏢 Empresas

</a>

<a ${paginaActiva==="instalaciones"?'class="active"':""}
href="/guardcontrol/instalaciones.html">

📍 Instalaciones

</a>

<a ${paginaActiva==="puntos"?'class="active"':""}
href="/guardcontrol/puntos.html">

📌 Puntos QR

</a>

<a ${paginaActiva==="reportes"?'class="active"':""}
href="/guardcontrol/reportes.html">

📊 Reportes

</a>

<a ${paginaActiva==="herramientas"?'class="active"':""}
href="/guardcontrol/herramientas.html">

🛠 Herramientas

</a>

<hr style="border-color:#263449;margin:20px 0;">

<a href="#"
onclick="cerrarSesion()">

🚪 Cerrar sesión

</a>

</nav>

`;

}