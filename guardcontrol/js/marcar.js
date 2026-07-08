const user = obtenerUsuario();

const params = new URLSearchParams(location.search);
const codigoQR = params.get("punto");

let puntoEncontrado = null;

document.getElementById("guardia").innerText = user.nombre;
document.getElementById("codigo").innerText = codigoQR || "Sin código";

async function cargarDatosPunto() {
  if (!codigoQR) {
    document.getElementById("estado").innerHTML =
      `<span class="error">QR inválido: falta código del punto.</span>`;
    return;
  }

  try {
    const respuesta = await fetch("/api/puntos");
    const puntos = await respuesta.json();

    puntoEncontrado = puntos.find(p => p.codigo_qr === codigoQR);

    if (!puntoEncontrado) {
      document.getElementById("empresa").innerText = "-";
      document.getElementById("instalacion").innerText = "-";
      document.getElementById("punto").innerText = "-";
      document.getElementById("estado").innerHTML =
        `<span class="error">QR no registrado en el sistema.</span>`;
      return;
    }

    document.getElementById("empresa").innerText = puntoEncontrado.empresa || "-";
    document.getElementById("instalacion").innerText = puntoEncontrado.instalacion || "-";
    document.getElementById("punto").innerText = puntoEncontrado.nombre || "-";

    document.getElementById("btnRegistrar").disabled = false;

  } catch (error) {
    document.getElementById("estado").innerHTML =
      `<span class="error">Error cargando datos del punto.</span>`;
  }
}

async function registrarRonda() {
  if (!codigoQR) {
    alert("No se encontró el código QR");
    return;
  }

  document.getElementById("btnRegistrar").disabled = true;
  document.getElementById("estado").innerText = "Obteniendo ubicación GPS...";

  navigator.geolocation.getCurrentPosition(async pos => {
    const datos = {
      usuario_id: user.id,
      guardia: user.nombre,
      codigo_qr: codigoQR,
      latitud: pos.coords.latitude,
      longitud: pos.coords.longitude
    };

    const respuesta = await fetch("/api/rondas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });

    const resultado = await respuesta.json();

    if (resultado.ok) {
      document.getElementById("estado").innerHTML =
        `<span class="ok">✅ Ronda registrada correctamente</span><br><br>
         Guardia: ${user.nombre}<br>
         Punto: ${resultado.punto.nombre}<br>
         Instalación: ${resultado.punto.instalacion}<br>
         Empresa: ${resultado.punto.empresa}`;
    } else {
      document.getElementById("estado").innerHTML =
        `<span class="error">Error: ${resultado.error}</span>`;
      document.getElementById("btnRegistrar").disabled = false;
    }

  }, () => {
    document.getElementById("estado").innerHTML =
      `<span class="error">Debes permitir la ubicación GPS.</span>`;
    document.getElementById("btnRegistrar").disabled = false;
  });
}

cargarDatosPunto();