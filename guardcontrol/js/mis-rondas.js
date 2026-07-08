const user = obtenerUsuario();

document.getElementById("guardia").innerText = user.nombre + " (" + user.rol + ")";

async function cargarMisRondas() {
  const respuesta = await fetch("/api/rondas");
  const rondas = await respuesta.json();

  const misRondas = rondas.filter(r => Number(r.usuario_id) === Number(user.id));

  const tabla = document.getElementById("tablaMisRondas");

  if (!misRondas.length) {
    tabla.innerHTML = `<tr><td colspan="4">Aún no tienes rondas registradas</td></tr>`;
    return;
  }

  tabla.innerHTML = misRondas.map(r => {
    const mapa = `https://www.google.com/maps?q=${r.latitud},${r.longitud}`;

    return `
      <tr>
        <td>${r.punto}</td>
        <td>${r.instalacion}</td>
        <td>${r.fecha}</td>
        <td><a href="${mapa}" target="_blank">Ver mapa</a></td>
      </tr>
    `;
  }).join("");
}

cargarMisRondas();