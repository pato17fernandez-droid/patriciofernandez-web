async function cargarEmpresasSelect() {
  try {
    const respuesta = await fetch("/api/empresas");
    const empresas = await respuesta.json();
    const select = document.getElementById("empresa_id");

    if (!select) return;

    if (!Array.isArray(empresas) || !empresas.length) {
      select.innerHTML = `<option value="">Primero crea una empresa</option>`;
      return;
    }

    select.innerHTML = empresas.map((empresa) =>
      `<option value="${empresa.id}">${escaparHtml(empresa.nombre)}</option>`
    ).join("");
  } catch (error) {
    console.error("Error al cargar empresas:", error);
  }
}

async function cargarInstalaciones() {
  const tabla = document.getElementById("tablaInstalaciones");
  if (!tabla) return;

  try {
    const respuesta = await fetch("/api/instalaciones");
    const instalaciones = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(instalaciones?.error || "No fue posible cargar las instalaciones.");
    }

    if (!Array.isArray(instalaciones) || !instalaciones.length) {
      tabla.innerHTML = `<tr><td colspan="6">No hay instalaciones registradas</td></tr>`;
      return;
    }

    tabla.innerHTML = instalaciones.map((instalacion) => `
      <tr>
        <td>${instalacion.id}</td>
        <td>${escaparHtml(instalacion.empresa || "-")}</td>
        <td>${escaparHtml(instalacion.nombre || "-")}</td>
        <td>${escaparHtml(instalacion.direccion || "-")}</td>
        <td>${escaparHtml(instalacion.telegram_chat_id || "Grupo general")}</td>
        <td>${escaparHtml(instalacion.estado || "-")}</td>
      </tr>
    `).join("");
  } catch (error) {
    console.error("Error al cargar instalaciones:", error);
    tabla.innerHTML = `<tr><td colspan="6">Error al cargar instalaciones</td></tr>`;
  }
}

async function crearInstalacion() {
  const datos = {
    empresa_id: document.getElementById("empresa_id")?.value || "",
    nombre: document.getElementById("nombre")?.value.trim() || "",
    direccion: document.getElementById("direccion")?.value.trim() || "",
    latitud: document.getElementById("latitud")?.value.trim() || "",
    longitud: document.getElementById("longitud")?.value.trim() || "",
    telegram_chat_id: document.getElementById("telegram_chat_id")?.value.trim() || ""
  };

  if (!datos.empresa_id || !datos.nombre) {
    alert("Empresa y nombre son obligatorios");
    return;
  }

  try {
    const respuesta = await fetch("/api/instalaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok || !resultado.ok) {
      throw new Error(resultado.error || "No fue posible crear la instalación.");
    }

    alert("Instalación creada correctamente");

    ["nombre", "direccion", "latitud", "longitud", "telegram_chat_id"].forEach((id) => {
      const campo = document.getElementById(id);
      if (campo) campo.value = "";
    });

    await cargarInstalaciones();
  } catch (error) {
    console.error("Error al crear instalación:", error);
    alert("Error: " + error.message);
  }
}

function escaparHtml(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  cargarEmpresasSelect();
  cargarInstalaciones();
});
