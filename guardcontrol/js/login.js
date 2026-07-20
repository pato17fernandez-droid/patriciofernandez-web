document.addEventListener("DOMContentLoaded", () => {
  const formulario =
    document.getElementById("loginForm") ||
    document.getElementById("formLogin") ||
    document.querySelector("form");

  const inputUsuario =
    document.getElementById("usuario") ||
    document.querySelector('input[name="usuario"]');

  const inputPassword =
    document.getElementById("password") ||
    document.getElementById("contrasena") ||
    document.querySelector('input[name="password"]');

  const mensaje =
    document.getElementById("mensaje") ||
    document.getElementById("mensajeLogin");

  const botonIngresar =
    document.getElementById("btnIngresar") ||
    formulario?.querySelector('button[type="submit"]');

  // Si existe una sesión válida, permite continuar sin volver a iniciar sesión.
  revisarSesionExistente();

  if (!formulario) {
    console.error("No se encontró el formulario de inicio de sesión.");
    return;
  }

  formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const usuario = inputUsuario?.value.trim();
    const password = inputPassword?.value;

    if (!usuario || !password) {
      mostrarMensaje("Ingresa tu usuario y contraseña.", "error");
      return;
    }

    cambiarEstadoBoton(true);
    mostrarMensaje("Iniciando sesión...", "info");

    try {
      const respuesta = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usuario,
          password
        })
      });

      let resultado;

      try {
        resultado = await respuesta.json();
      } catch {
        throw new Error("El servidor entregó una respuesta no válida.");
      }

      if (!respuesta.ok) {
        throw new Error(
          resultado?.error ||
          resultado?.mensaje ||
          "Usuario o contraseña incorrectos."
        );
      }

      const usuarioRecibido =
        resultado.user ||
        resultado.usuario ||
        resultado.data;

      if (!usuarioRecibido) {
        throw new Error(
          "El servidor no devolvió los datos del usuario."
        );
      }

      if (!usuarioRecibido.rol) {
        throw new Error(
          "El usuario no tiene un rol asignado."
        );
      }

      // Guardar usuario autenticado.
      localStorage.setItem(
        "guardcontrol_user",
        JSON.stringify(usuarioRecibido)
      );

      // Guardar el momento exacto en que comenzó la sesión.
      localStorage.setItem(
        "guardcontrol_session_started",
        Date.now().toString()
      );

      mostrarMensaje("Inicio de sesión correcto.", "ok");

      const destinoPendiente = localStorage.getItem(
        "guardcontrol_redirect_after_login"
      );

      if (destinoPendiente && destinoSeguro(destinoPendiente)) {
        localStorage.removeItem(
          "guardcontrol_redirect_after_login"
        );

        window.location.href = destinoPendiente;
        return;
      }

      redirigirSegunRol(usuarioRecibido.rol);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);

      localStorage.removeItem("guardcontrol_user");
      localStorage.removeItem("guardcontrol_session_started");

      mostrarMensaje(
        error.message || "No fue posible iniciar sesión.",
        "error"
      );
    } finally {
      cambiarEstadoBoton(false);
    }
  });

  function mostrarMensaje(texto, tipo = "info") {
    if (!mensaje) {
      if (tipo === "error") {
        alert(texto);
      }

      return;
    }

    mensaje.textContent = texto;
    mensaje.classList.remove("ok", "error", "info");

    if (tipo) {
      mensaje.classList.add(tipo);
    }
  }

  function cambiarEstadoBoton(cargando) {
    if (!botonIngresar) return;

    botonIngresar.disabled = cargando;
    botonIngresar.textContent = cargando
      ? "Ingresando..."
      : "Iniciar sesión";
  }

  function redirigirSegunRol(rol) {
    const rolNormalizado = String(rol)
      .trim()
      .toLowerCase();

    if (rolNormalizado === "guardia") {
      window.location.href = "/guardcontrol/guardia.html";
      return;
    }

    if (rolNormalizado === "supervisor") {
      window.location.href = "/guardcontrol/reportes.html";
      return;
    }

    if (rolNormalizado === "administrador") {
      window.location.href = "/guardcontrol/";
      return;
    }

    localStorage.removeItem("guardcontrol_user");
    localStorage.removeItem("guardcontrol_session_started");

    mostrarMensaje(
      `El rol "${rol}" no está reconocido por el sistema.`,
      "error"
    );
  }

  function revisarSesionExistente() {
    const usuarioGuardado = localStorage.getItem(
      "guardcontrol_user"
    );

    const inicioSesion = localStorage.getItem(
      "guardcontrol_session_started"
    );

    if (!usuarioGuardado || !inicioSesion) {
      return;
    }

    const tiempoMaximoSesion = 8 * 60 * 60 * 1000;
    const tiempoTranscurrido =
      Date.now() - Number(inicioSesion);

    if (
      !Number.isFinite(tiempoTranscurrido) ||
      tiempoTranscurrido < 0 ||
      tiempoTranscurrido > tiempoMaximoSesion
    ) {
      localStorage.removeItem("guardcontrol_user");
      localStorage.removeItem(
        "guardcontrol_session_started"
      );

      mostrarMensaje(
        "Tu sesión anterior expiró. Inicia sesión nuevamente.",
        "info"
      );

      return;
    }

    try {
      const usuario = JSON.parse(usuarioGuardado);

      if (!usuario?.rol) {
        throw new Error("Sesión incompleta.");
      }

      /*
       * No redirigimos automáticamente desde aquí.
       * Así, si una persona abre manualmente el login,
       * todavía puede iniciar sesión con otro usuario.
       */
    } catch {
      localStorage.removeItem("guardcontrol_user");
      localStorage.removeItem(
        "guardcontrol_session_started"
      );
    }
  }

  function destinoSeguro(destino) {
    if (typeof destino !== "string") {
      return false;
    }

    // Solo permite rutas internas de GuardControl.
    return destino.startsWith("/guardcontrol/");
  }
});