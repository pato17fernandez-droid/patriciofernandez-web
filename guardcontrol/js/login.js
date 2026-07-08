async function login() {
  const datos = {
    usuario: document.getElementById("usuario").value.trim(),
    password: document.getElementById("password").value.trim()
  };

  if (!datos.usuario || !datos.password) {
    alert("Ingresa usuario y contraseña");
    return;
  }

  const respuesta = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (!resultado.ok) {
    alert(resultado.error);
    return;
  }

  localStorage.setItem("guardcontrol_user", JSON.stringify(resultado.user));

  if (resultado.user.rol === "Guardia") {
    location.href = "/guardcontrol/guardia.html";
  } else if (resultado.user.rol === "Supervisor") {
    location.href = "/guardcontrol/supervisor.html";
  } else {
    location.href = "/guardcontrol/";
  }
}