const params = new URLSearchParams(location.search);

const empresa = params.get("empresa") || "-";
const instalacion = params.get("instalacion") || "-";
const punto = params.get("punto") || "-";
const codigo = params.get("codigo") || "-";

document.getElementById("empresa").innerText = empresa;
document.getElementById("instalacion").innerText = instalacion;
document.getElementById("punto").innerText = punto;
document.getElementById("codigo").innerText = codigo;

const urlMarcaje = `${location.origin}/guardcontrol/marcar.html?punto=${encodeURIComponent(codigo)}`;

const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlMarcaje)}`;

document.getElementById("qr").src = qrImg;