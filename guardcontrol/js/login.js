document.addEventListener("DOMContentLoaded", () => {
  const formulario = document.getElementById("loginForm");
  const inputUsuario = document.getElementById("usuario");
  const inputPassword = document.getElementById("password");
  const mensaje = document.getElementById("mensaje");
  const botonIngresar = document.getElementById("btnIngresar");

  if (!formulario || !inputUsuario || !inputPassword || !botonIngresar) {
    console.error("El formulario de inicio de sesión está incompleto.");
    return;
  }

  formulario.addEventListener("submit", iniciarSesion);

  async function iniciarSesion(event) {
    event.preventDefault();
    const usuario = inputUsuario.value.trim();
    const password = inputPassword.value;

    if (!usuario || !password) {
      mostrarMensaje("Ingresa tu usuario y contraseña.", "error");
      return;
    }

    cambiarEstadoBoton(true);
    mostrarMensaje("Iniciando sesión...", "info");

    try {
      const respuesta = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ usuario, password })
      });

      let resultado;
      try { resultado = await respuesta.json(); }
      catch { throw new Error("El servidor entregó una respuesta no válida."); }

      if (!respuesta.ok || resultado.ok === false) {
        throw new Error(resultado.error || resultado.mensaje || "Usuario o contraseña incorrectos.");
      }

      const usuarioRecibido = resultado.user || resultado.usuario || resultado.data;
      if (!usuarioRecibido || !usuarioRecibido.rol) {
        throw new Error("El servidor no devolvió un usuario válido.");
      }

      localStorage.setItem("guardcontrol_user", JSON.stringify(usuarioRecibido));
      localStorage.setItem("guardcontrol_session_started", Date.now().toString());
      mostrarMensaje("Inicio de sesión correcto.", "ok");

      const destinoPendiente = localStorage.getItem("guardcontrol_redirect_after_login");
      if (destinoPendiente && destinoSeguro(destinoPendiente)) {
        localStorage.removeItem("guardcontrol_redirect_after_login");
        window.location.href = destinoPendiente;
        return;
      }

      redirigirSegunRol(usuarioRecibido.rol);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      localStorage.removeItem("guardcontrol_user");
      localStorage.removeItem("guardcontrol_session_started");
      mostrarMensaje(error.message || "No fue posible iniciar sesión.", "error");
    } finally {
      cambiarEstadoBoton(false);
    }
  }

  function mostrarMensaje(texto, tipo = "info") {
    mensaje.textContent = texto;
    mensaje.className = `login-message ${tipo}`;
  }

  function cambiarEstadoBoton(cargando) {
    botonIngresar.disabled = cargando;
    botonIngresar.textContent = cargando ? "Ingresando..." : "Iniciar sesión";
  }

  function redirigirSegunRol(rol) {
    const rolNormalizado = String(rol).trim().toLowerCase();
    if (rolNormalizado === "guardia") { window.location.href = "/guardcontrol/guardia.html"; return; }
    if (rolNormalizado === "supervisor") { window.location.href = "/guardcontrol/reportes.html"; return; }
    if (rolNormalizado === "administrador") { window.location.href = "/guardcontrol/"; return; }
    localStorage.removeItem("guardcontrol_user");
    localStorage.removeItem("guardcontrol_session_started");
    mostrarMensaje(`El rol "${rol}" no está reconocido por el sistema.`, "error");
  }

  function destinoSeguro(destino) {
    return typeof destino === "string" && destino.startsWith("/guardcontrol/") && !destino.includes("login.html");
  }
});
