const user = obtenerUsuario();

const params = new URLSearchParams(location.search);
const codigoQR = params.get("punto");

document.getElementById("guardia").innerText = user.nombre;
document.getElementById("codigo").innerText = codigoQR || "Sin código";

async function registrarRonda() {
  if (!codigoQR) {
    alert("No se encontró el código QR");
    return;
  }

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
        `✅ Ronda registrada correctamente<br>
         Punto: ${resultado.punto.nombre}<br>
         Instalación: ${resultado.punto.instalacion}<br>
         Empresa: ${resultado.punto.empresa}`;
    } else {
      document.getElementById("estado").innerText = "Error: " + resultado.error;
    }

  }, () => {
    document.getElementById("estado").innerText = "Debes permitir la ubicación GPS";
  });
}