const user = obtenerUsuario();

async function ejecutarDemo(accion) {
  const respuesta = await fetch("/api/demo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accion,
      rol: user.rol
    })
  });

  const resultado = await respuesta.json();

  if (resultado.ok) {
    document.getElementById("estado").innerText = resultado.mensaje;
  } else {
    document.getElementById("estado").innerText = "Error: " + resultado.error;
  }
}

function reiniciarDemo() {
  const confirmar = confirm("Esto borrará rondas, puntos, instalaciones, empresas y usuarios que no sean administradores. ¿Continuar?");
  if (!confirmar) return;

  ejecutarDemo("reset");
}

function cargarDemo() {
  ejecutarDemo("load");
}