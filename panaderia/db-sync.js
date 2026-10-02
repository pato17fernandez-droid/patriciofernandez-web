(() => {
  const API='/api/panaderia/state';
  const LOCAL_KEY='panaderiaSistemaV1';
  let syncing=false,remoteReady=false,reportMode='month',reportMonth='',reportFrom='',reportTo='';
  const el=id=>document.getElementById(id);
  const fmt=n=>Number(n||0).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:3});
  const clp=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n||0));
  const monthName=v=>{if(!v)return'';const [y,m]=v.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,x=>x.toUpperCase())};

  function installReportUI(){
    const section=el('section-informes');
    if(!section||el('reportFilters'))return;
    const controls=document.createElement('div');
    controls.id='reportFilters'; controls.className='card-panel';
    controls.innerHTML=`<div class="panel-head"><div><h2>Período del informe</h2><p>Separa automáticamente por mes o selecciona cualquier rango para informes semanales.</p></div></div>
      <div class="filter-row">
        <select id="reportMode" class="form-select compact-select"><option value="month">Mensual</option><option value="custom">Rango personalizado</option></select>
        <select id="reportMonth" class="form-select compact-select"></select>
        <input id="reportFrom" type="date" class="form-control compact-select d-none">
        <input id="reportTo" type="date" class="form-control compact-select d-none">
        <button id="applyReport" class="primary-btn"><i class="bi bi-funnel"></i>Aplicar</button>
      </div><div id="quickWeeks" class="filter-row mt-3"></div>`;
    section.insertBefore(controls,el('reportCards'));
    const extra=document.createElement('div'); extra.className='two-col'; extra.innerHTML=`
      <div class="card-panel"><div class="panel-head"><div><h2>Detalle por producto</h2><p id="reportRangeLabel"></p></div></div><div id="reportProducts"></div></div>
      <div class="card-panel"><div class="panel-head"><div><h2>Resumen de guías</h2><p>Pagado y pendiente del período</p></div></div><div id="reportGuideSummary"></div></div>`;
    el('reportCards').after(extra);
    el('reportMode').addEventListener('change',()=>{reportMode=el('reportMode').value;toggleReportInputs();renderReports()});
    el('reportMonth').addEventListener('change',()=>{reportMonth=el('reportMonth').value;buildQuickWeeks();renderReports()});
    el('applyReport').addEventListener('click',()=>{reportFrom=el('reportFrom').value;reportTo=el('reportTo').value;renderReports()});
  }

  function refreshMonthOptions(){
    if(!el('reportMonth'))return;
    const months=[...new Set((db.orders||[]).map(o=>(o.date||'').slice(0,7)).filter(Boolean))].sort().reverse();
    const previous=reportMonth;
    if(!reportMonth)reportMonth=months[0]||new Date().toISOString().slice(0,7);
    el('reportMonth').innerHTML=months.map(m=>`<option value="${m}">${monthName(m)}</option>`).join('')||`<option value="${reportMonth}">${monthName(reportMonth)}</option>`;
    if(months.includes(previous))reportMonth=previous;
    el('reportMonth').value=reportMonth;
    buildQuickWeeks();
  }
  function toggleReportInputs(){
    const custom=reportMode==='custom'; el('reportMonth')?.classList.toggle('d-none',custom); el('reportFrom')?.classList.toggle('d-none',!custom); el('reportTo')?.classList.toggle('d-none',!custom); el('quickWeeks')?.classList.toggle('d-none',custom);
  }
  function monthLastDay(month){const [y,m]=month.split('-').map(Number);return new Date(y,m,0).getDate()}
  function rangeForReport(){
    if(reportMode==='custom'&&reportFrom&&reportTo)return [reportFrom,reportTo];
    const last=monthLastDay(reportMonth); return [`${reportMonth}-01`,`${reportMonth}-${String(last).padStart(2,'0')}`];
  }
  function buildQuickWeeks(){
    const q=el('quickWeeks'); if(!q||!reportMonth)return; const last=monthLastDay(reportMonth); const blocks=[[1,6],[7,13],[14,20],[21,27],[28,last]];
    q.innerHTML='<span class="text-muted small me-1">Semanas rápidas:</span>'+blocks.filter(([a,b])=>a<=last).map(([a,b],i)=>`<button type="button" class="secondary-btn week-btn" data-a="${a}" data-b="${b}">Semana ${i+1}: ${a}-${b}</button>`).join('');
    q.querySelectorAll('.week-btn').forEach(btn=>btn.addEventListener('click',()=>{const a=btn.dataset.a.padStart(2,'0'),b=btn.dataset.b.padStart(2,'0');reportMode='custom';reportFrom=`${reportMonth}-${a}`;reportTo=`${reportMonth}-${b}`;el('reportMode').value='custom';el('reportFrom').value=reportFrom;el('reportTo').value=reportTo;toggleReportInputs();renderReports()}));
  }

  function enhancedOrderKg(o){return Number(o.hallulla||0)+Number(o.marraqueta||0)+Number(o.ciabatta||0)+Number(o.medioBaguette||0)+Number(o.panCompleto||0)}
  function enhancedProducts(o){return [['Hallulla',o.hallulla],['Marraqueta',o.marraqueta],['Ciabatta',o.ciabatta],['Medio baguette',o.medioBaguette],['Pan completo',o.panCompleto]].filter(x=>Number(x[1])>0).map(x=>`${x[0]} ${fmt(x[1])} kg`).join(' · ')||'-'}

  function enhancedReports(){
    if(!el('reportCards'))return; refreshMonthOptions(); toggleReportInputs();
    const [from,to]=rangeForReport(); const orders=(db.orders||[]).filter(o=>o.date>=from&&o.date<=to); const guides=(db.guides||[]).filter(g=>g.date>=from&&g.date<=to);
    const products={hallulla:0,marraqueta:0,ciabatta:0,medioBaguette:0,panCompleto:0}; orders.forEach(o=>Object.keys(products).forEach(k=>products[k]+=Number(o[k]||0)));
    const totalKg=Object.values(products).reduce((a,b)=>a+b,0), sales=guides.reduce((s,g)=>s+Number(g.total||0),0), paid=guides.reduce((s,g)=>s+Number(g.paid||0),0), due=Math.max(0,sales-paid);
    const label=reportMode==='month'?monthName(reportMonth):`${fmtDateLocal(from)} al ${fmtDateLocal(to)}`;
    el('reportCards').innerHTML=stat('bi-box-seam','Kg del período',`${fmt(totalKg)} kg`,label)+stat('bi-receipt','Monto guías',clp(sales),`${guides.length} guías`)+stat('bi-check-circle','Pagado',clp(paid),'Según estado histórico')+stat('bi-exclamation-circle','Pendiente',clp(due),'Saldo del período');
    if(el('reportRangeLabel'))el('reportRangeLabel').textContent=label;
    const pRows=[['Hallulla',products.hallulla],['Marraqueta',products.marraqueta],['Ciabatta',products.ciabatta],['Medio baguette',products.medioBaguette],['Pan completo',products.panCompleto]].filter(x=>x[1]>0||['Hallulla','Marraqueta','Ciabatta'].includes(x[0]));
    if(el('reportProducts'))el('reportProducts').innerHTML=pRows.map(([n,v])=>`<div class="report-row-head py-2 border-bottom"><span>${n}</span><strong>${fmt(v)} kg</strong></div>`).join('')+`<div class="report-row-head py-3"><strong>TOTAL</strong><strong>${fmt(totalKg)} kg</strong></div>`;
    if(el('reportGuideSummary'))el('reportGuideSummary').innerHTML=`<div class="report-row-head py-2 border-bottom"><span>Guías del período</span><strong>${guides.length}</strong></div><div class="report-row-head py-2 border-bottom"><span>Pagadas</span><strong>${guides.filter(g=>Number(g.paid||0)>=Number(g.total||0)&&Number(g.total||0)>0).length}</strong></div><div class="report-row-head py-2 border-bottom"><span>Con saldo</span><strong>${guides.filter(g=>Number(g.total||0)>Number(g.paid||0)).length}</strong></div><div class="report-row-head py-2"><span>Saldo pendiente</span><strong class="money-pending">${clp(due)}</strong></div>`;
    const byClient=(db.clients||[]).map(c=>({name:c.name,kg:orders.filter(o=>o.clientId===c.id).reduce((s,o)=>s+enhancedOrderKg(o),0)})).filter(x=>x.kg>0).sort((a,b)=>b.kg-a.kg),max=Math.max(1,...byClient.map(x=>x.kg));
    el('reportClientKg').innerHTML=byClient.length?byClient.map((x,i)=>`<div class="report-row"><div class="report-row-head"><span>${i===0?'🏆 ':''}${escLocal(x.name)}</span><strong>${fmt(x.kg)} kg</strong></div><div class="report-bar"><span style="width:${Math.round(x.kg/max*100)}%"></span></div></div>`).join(''):'<p class="text-muted">Sin kilos en este período.</p>';
    const balances=(db.clients||[]).map(c=>({name:c.name,balance:guides.filter(g=>g.clientId===c.id).reduce((s,g)=>s+Math.max(0,Number(g.total||0)-Number(g.paid||0)),0)})).filter(x=>x.balance>0).sort((a,b)=>b.balance-a.balance);
    el('reportReceivables').innerHTML=balances.length?balances.map(x=>`<div class="report-row-head py-2 border-bottom"><span>${escLocal(x.name)}</span><strong class="money-pending">${clp(x.balance)}</strong></div>`).join(''):'<p class="text-muted">No hay saldos pendientes en el período.</p>';
  }
  function fmtDateLocal(d){if(!d)return'';const [y,m,day]=d.split('-');return `${day}-${m}-${y}`}
  function escLocal(s=''){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}

  async function loadRemote(){try{const r=await fetch(API,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();if(data&&Array.isArray(data.clients)){localStorage.setItem(LOCAL_KEY,JSON.stringify(data));db=data;remoteReady=true;refreshMonthOptions();renderAll();console.info('Panadería: datos cargados desde Cloudflare D1')}}catch(e){console.warn('Panadería: no se pudo cargar D1, se mantiene copia local.',e)}}
  async function pushRemote(snapshot){if(syncing)return;syncing=true;try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(snapshot)});if(!r.ok)throw new Error(`${r.status}: ${await r.text()}`);remoteReady=true;console.info('Panadería: cambios guardados en Cloudflare D1')}catch(e){console.error('Panadería: error guardando en D1.',e);if(typeof toast==='function')toast('No se pudo sincronizar con la base de datos')}finally{syncing=false}}

  window.addEventListener('DOMContentLoaded',async()=>{
    installReportUI();
    try{orderKg=enhancedOrderKg;orderProducts=enhancedProducts;renderReports=enhancedReports}catch(e){console.warn(e)}
    await loadRemote();
    if(typeof saveData==='function'){const original=saveData;saveData=function(){original();pushRemote(db)}}
    window.panaderiaDbStatus=()=>({remoteReady});
  });
})();
