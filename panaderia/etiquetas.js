/* Módulo Etiquetas NOVABAKE - primera versión de prueba.
   Impresión vía diálogo del navegador y driver USB instalado en Windows.
   La cantidad de bolsas NO se deduce de los kilogramos. */
(() => {
  'use strict';
  const $e = id => document.getElementById(id);
  const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isoLocal = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
  const parseISO = s => { const [y,m,d]=String(s).split('-').map(Number); return new Date(y,m-1,d,12); };
  const fmt = date => [String(date.getDate()).padStart(2,'0'),String(date.getMonth()+1).padStart(2,'0'),date.getFullYear()].join('/');
  const plusDays = (value,n) => { const d=parseISO(value); d.setDate(d.getDate()+n); return fmt(d); };
  const plusMonths = (value,n) => { const d=parseISO(value),day=d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+n); const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); d.setDate(Math.min(day,last)); return fmt(d); };
  const products = ['Hallulla','Marraqueta','Ciabatta'];
  const currentClients = () => (typeof db !== 'undefined' && Array.isArray(db.clients)) ? db.clients : [];
  const currentOrders = () => (typeof db !== 'undefined' && Array.isArray(db.orders)) ? db.orders : [];
  const nameFor = id => currentClients().find(c=>String(c.id)===String(id))?.name || 'Cliente no encontrado';

  function mount() {
    if ($e('section-etiquetas')) return;
    const target=document.querySelector('#mainNav');
    const btn=document.createElement('button');
    btn.className='nav-item';
    btn.dataset.section='etiquetas';
    btn.innerHTML='<i class="bi bi-upc-scan"></i><span>Etiquetas</span>';
    target?.appendChild(btn);
    const panel=document.createElement('section');
    panel.id='section-etiquetas'; panel.className='app-section';
    panel.innerHTML=`
      <div class="section-toolbar"><div><h2 class="section-inline-title">Etiquetas de bolsas</h2>
        <p class="muted mb-0">Una etiqueta por bolsa · impresión por USB desde este computador</p></div></div>
      <div class="card-panel" style="max-width:1000px">
        <div class="alert alert-info">Versión de prueba: revisa siempre cliente, producto, fechas y cantidad de bolsas antes de imprimir. Las fechas predeterminadas deben estar validadas por la panadería.</div>
        <div class="row g-3">
          <div class="col-md-12"><label class="form-label" for="et-order">Usar un pedido existente (opcional)</label>
            <select id="et-order" class="form-select"><option value="">Ingreso manual</option></select>
            <div class="form-text">Si el pedido contiene varios productos, elige qué producto estás etiquetando.</div>
          </div>
          <div class="col-md-6"><label class="form-label" for="et-client">Cliente / lote</label>
            <select class="form-select" id="et-client"><option value="">Seleccionar cliente</option></select></div>
          <div class="col-md-6"><label class="form-label" for="et-other-client">Nombre manual (si el cliente no está registrado)</label>
            <input id="et-other-client" class="form-control" placeholder="Opcional"></div>
          <div class="col-md-6"><label class="form-label" for="et-product">Tipo de pan</label>
            <select class="form-select" id="et-product">${products.map(p=>'<option>'+p+'</option>').join('')}</select></div>
          <div class="col-md-6"><label class="form-label" for="et-bags">Cantidad real de bolsas (= etiquetas)</label>
            <input id="et-bags" class="form-control" type="number" min="1" max="500" step="1" value="1"></div>
          <div class="col-md-4"><label class="form-label" for="et-date">Fecha de entrega / salida</label>
            <input id="et-date" class="form-control" type="date" required></div>
          <div class="col-md-4"><label class="form-label" for="et-days">Usar hasta (días posteriores)</label>
            <input id="et-days" class="form-control" type="number" min="0" max="365" value="5"></div>
          <div class="col-md-4"><label class="form-label" for="et-months">Vto. cámara (meses posteriores)</label>
            <input id="et-months" class="form-control" type="number" min="0" max="60" value="4"></div>
        </div>
        <div class="mt-3 d-flex flex-wrap align-items-center gap-2">
          <button class="primary-btn" type="button" id="et-print"><i class="bi bi-printer"></i> Preparar impresión</button>
          <button class="secondary-btn" type="button" id="et-preview"><i class="bi bi-eye"></i> Actualizar vista previa</button>
          <span id="et-count" class="muted"></span>
        </div>
        <div class="mt-3"><h3 style="font-size:16px">Vista previa de la etiqueta</h3>
          <div id="et-preview-box" style="background:white;color:#111;border:1px solid #aaa;width:min(100%,430px);aspect-ratio:80/45;padding:3px;font-family:Arial,sans-serif"></div>
          <p class="form-text mt-2">Formato inicial 80 × 45 mm, adaptado al ancho de la impresora térmica. Debe ajustarse al tamaño real de tus etiquetas y al controlador de la POS-8360.</p>
        </div>
      </div>`;
    document.querySelector('.main-content')?.appendChild(panel);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.app-section').forEach(s=>s.classList.remove('active-section'));
      panel.classList.add('active-section');
      document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b===btn));
      $e('pageTitle').textContent='Etiquetas';
      $e('pageSubtitle').textContent='Generación de etiquetas para bolsas de pan';
      document.querySelector('.sidebar')?.classList.remove('open');
      refreshSelectors(); refreshPreview();
    });
    $e('et-date').value=isoLocal();
    $e('et-order').addEventListener('change', selectOrder);
    ['et-client','et-other-client','et-product','et-bags','et-date','et-days','et-months'].forEach(id => $e(id).addEventListener('input',refreshPreview));
    $e('et-preview').addEventListener('click',refreshPreview);
    $e('et-print').addEventListener('click',printLabels);
    refreshSelectors(); refreshPreview();
  }

  function refreshSelectors() {
    const client=$e('et-client'), old=client.value;
    client.innerHTML='<option value="">Seleccionar cliente</option>'+currentClients().filter(c=>c.active!==false).map(c=>'<option value="'+html(c.id)+'">'+html(c.name)+'</option>').join('');
    if([...client.options].some(x=>x.value===old)) client.value=old;
    const select=$e('et-order'), choice=select.value;
    select.innerHTML='<option value="">Ingreso manual</option>'+currentOrders().slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,150).map(o=>'<option value="'+html(o.id)+'">#'+html(o.id)+' · '+html(nameFor(o.clientId))+' · '+html(o.date)+'</option>').join('');
    if([...select.options].some(x=>x.value===choice)) select.value=choice;
  }
  function selectOrder() {
    const order=currentOrders().find(o=>String(o.id)===$e('et-order').value);
    if(!order) return;
    $e('et-client').value=String(order.clientId);
    $e('et-other-client').value='';
    $e('et-date').value=order.date || isoLocal();
    $e('et-product').value=products.find(p=>Number(order[p.toLowerCase()])>0) || products[0];
    // El pedido guarda KG, pero no la cantidad real de bolsas; no se infiere.
    $e('et-bags').value=1;
    refreshPreview();
  }
  function data() {
    const date=$e('et-date').value;
    const client=$e('et-other-client').value.trim() || currentClients().find(c=>String(c.id)===$e('et-client').value)?.name || '';
    const bags=Number($e('et-bags').value);
    const days=Number($e('et-days').value),months=Number($e('et-months').value);
    if(!client) throw Error('Selecciona o escribe un cliente.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parseISO(date).getTime())) throw Error('Ingresa una fecha válida.');
    if(!Number.isInteger(bags)||bags<1||bags>500) throw Error('La cantidad de bolsas debe estar entre 1 y 500.');
    if(!Number.isInteger(days)||days<0||days>365||!Number.isInteger(months)||months<0||months>60) throw Error('Revisa los plazos de vencimiento.');
    return {client,product:$e('et-product').value,date:fmt(parseISO(date)),useUntil:plusDays(date,days),chamberExpiry:plusMonths(date,months),bags};
  }
  // Plantilla inspirada en la etiqueta de trazabilidad usada en 4Barcode.
  const labelCSS = `
    * { box-sizing: border-box; }
    .trace-label { width:100%; height:100%; table-layout:fixed; border-collapse:collapse; background:#fff; color:#000; font-family:Arial,Helvetica,sans-serif; }
    .trace-label col:first-child { width:50%; }
    .trace-label col:nth-child(2) { width:12.5%; }
    .trace-label col:nth-child(3) { width:25%; }
    .trace-label col:nth-child(4) { width:12.5%; }
    .trace-label th,.trace-label td { border:1.2px solid #000; padding:0 1mm; text-align:center; vertical-align:middle; font-size:9pt; line-height:1.05; overflow-wrap:anywhere; }
    .trace-label .trace-title { height:21%; font-size:17pt; font-weight:800; letter-spacing:.2px; }
    .trace-label .trace-strong { font-size:12pt; font-weight:800; }
    .trace-label .trace-dates { height:10%; }
    .trace-label .trace-date { height:11%; font-size:10pt; }
    .trace-label .trace-info { height:10%; }
  `;
  const dateCells = value => {
    const [dia,mes,anio]=value.split('/');
    return '<td>'+html(dia)+'</td><td>'+html(mes)+'</td><td>'+html(anio)+'</td>';
  };
  function innerLabel(d) {
    return '<table class="trace-label" aria-label="Etiqueta de trazabilidad"><colgroup><col><col><col><col></colgroup>'+
      '<tbody><tr><th class="trace-title" colspan="4">TRAZABILIDAD</th></tr>'+
      '<tr class="trace-info"><td>LOTE</td><td colspan="3">'+html(d.client.toUpperCase())+'</td></tr>'+
      '<tr class="trace-info"><td>MARCA</td><td colspan="3" class="trace-strong">NOVABAKE</td></tr>'+
      '<tr class="trace-info"><td>NOMBRE PRODUCTO</td><td colspan="3">'+html(d.product.toUpperCase())+'</td></tr>'+
      '<tr class="trace-dates"><td></td><td>DIA</td><td>MES</td><td>AÑO</td></tr>'+
      '<tr class="trace-date"><td>FECHA DE ENTREGA</td>'+dateCells(d.date)+'</tr>'+
      '<tr class="trace-date"><td>USAR HASTA</td>'+dateCells(d.useUntil)+'</tr>'+
      '<tr class="trace-date"><td>FECHA Vto. EN CAMARA</td>'+dateCells(d.chamberExpiry)+'</tr></tbody></table>';
  }
  function refreshPreview() {
    if(!$e('et-preview-box')) return;
    try {
      const d=data();
      $e('et-preview-box').innerHTML='<style>'+labelCSS+'</style>'+innerLabel(d);
      $e('et-count').textContent=d.bags+' etiqueta(s)';
    } catch(e) {
      $e('et-preview-box').textContent=e.message;
      $e('et-count').textContent='';
    }
  }
  function printLabels() {
    let d;
    try { d=data(); } catch(e) { alert(e.message); return; }
    if(!confirm('Preparar '+d.bags+' etiqueta(s) de '+d.product+' para '+d.client+'? Verifica los datos antes de imprimir.')) return;
    const popup=window.open('','_blank');
    if(!popup) { alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');return; }
    const labels=Array.from({length:d.bags},()=>'<div class="label">'+innerLabel(d)+'</div>').join('');
    popup.document.open();
    popup.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas NOVABAKE</title><style>'+
      labelCSS+
      '@page{size:80mm 45mm;margin:0}body{margin:0;color:#000;font-family:Arial,sans-serif}.label{width:80mm;height:45mm;padding:1.5mm;overflow:hidden;break-after:page;page-break-after:always}.label:last-child{break-after:auto;page-break-after:auto}.controls{display:none}@media screen{body{background:#eee}.label{background:white;margin:12px auto;box-shadow:0 2px 10px #bbb}.controls{display:block;position:sticky;top:0;background:#fff;padding:12px;text-align:center}.controls button{padding:8px 20px}}</style></head><body>'+
      '<div class="controls"><button onclick="window.print()">Imprimir etiquetas</button> Selecciona POS-8360, papel 80 mm, escala 100%, sin márgenes ni encabezados. Haz primero una impresión de prueba.</div>'+
      labels+'</body></html>');
    popup.document.close();
  }
  document.addEventListener('DOMContentLoaded',mount);
})();
