(() => {
  const STATE_API='/api/panaderia/state';
  const HISTORY_API='/api/panaderia/historial';
  const LOCAL_KEY='panaderiaSistemaV1';
  let syncing=false,remoteReady=false,historyReady=false;
  let reportMode='month',reportMonth='',reportFrom='',reportTo='';
  let panHistory=[];

  const el=id=>document.getElementById(id);
  const fmt=n=>Number(n||0).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:3});
  const clp=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n||0));
  const monthName=v=>{if(!v)return'';const [y,m]=v.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,x=>x.toUpperCase())};
  const escLocal=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const fmtDateLocal=d=>{if(!d)return'';const [y,m,day]=d.split('-');return `${day}-${m}-${y}`};

  function installReportUI(){
    const section=el('section-informes');
    if(!section||el('reportFilters'))return;
    const controls=document.createElement('div');
    controls.id='reportFilters'; controls.className='card-panel';
    controls.innerHTML=`
      <div class="panel-head"><div><h2>Período del informe</h2><p>El historial de Excel está separado por mes. También puedes usar cualquier rango para un informe semanal.</p></div></div>
      <div class="filter-row">
        <select id="reportMode" class="form-select compact-select"><option value="month">Mensual</option><option value="custom">Rango personalizado</option></select>
        <select id="reportMonth" class="form-select compact-select"></select>
        <input id="reportFrom" type="date" class="form-control compact-select d-none">
        <input id="reportTo" type="date" class="form-control compact-select d-none">
        <button id="applyReport" class="primary-btn"><i class="bi bi-funnel"></i>Aplicar</button>
      </div>
      <div id="quickWeeks" class="filter-row mt-3"></div>`;
    section.insertBefore(controls,el('reportCards'));

    const extra=document.createElement('div');
    extra.className='two-col';
    extra.innerHTML=`
      <div class="card-panel"><div class="panel-head"><div><h2>Detalle por producto</h2><p id="reportRangeLabel"></p></div></div><div id="reportProducts"></div></div>
      <div class="card-panel"><div class="panel-head"><div><h2>Resumen de guías</h2><p>Estado de pago según los Excel importados</p></div></div><div id="reportGuideSummary"></div></div>`;
    el('reportCards').after(extra);

    el('reportMode').addEventListener('change',()=>{
      reportMode=el('reportMode').value;
      toggleReportInputs();
      renderHistoricalReports();
    });
    el('reportMonth').addEventListener('change',()=>{
      reportMonth=el('reportMonth').value;
      buildQuickWeeks();
      renderHistoricalReports();
    });
    el('applyReport').addEventListener('click',()=>{
      reportFrom=el('reportFrom').value;
      reportTo=el('reportTo').value;
      renderHistoricalReports();
    });
  }

  function refreshMonthOptions(){
    if(!el('reportMonth'))return;
    const months=[...new Set(panHistory.map(r=>(r.date||'').slice(0,7)).filter(Boolean))].sort().reverse();
    if(!reportMonth) reportMonth=months[0]||new Date().toISOString().slice(0,7);
    if(!months.includes(reportMonth)&&months.length) reportMonth=months[0];
    el('reportMonth').innerHTML=months.map(m=>`<option value="${m}">${monthName(m)}</option>`).join('')||`<option value="${reportMonth}">${monthName(reportMonth)}</option>`;
    el('reportMonth').value=reportMonth;
    buildQuickWeeks();
  }

  function toggleReportInputs(){
    const custom=reportMode==='custom';
    el('reportMonth')?.classList.toggle('d-none',custom);
    el('reportFrom')?.classList.toggle('d-none',!custom);
    el('reportTo')?.classList.toggle('d-none',!custom);
    el('quickWeeks')?.classList.toggle('d-none',custom);
  }

  function monthLastDay(month){const [y,m]=month.split('-').map(Number);return new Date(y,m,0).getDate()}
  function rangeForReport(){
    if(reportMode==='custom'&&reportFrom&&reportTo)return [reportFrom,reportTo];
    const last=monthLastDay(reportMonth);
    return [`${reportMonth}-01`,`${reportMonth}-${String(last).padStart(2,'0')}`];
  }

  function buildQuickWeeks(){
    const q=el('quickWeeks');
    if(!q||!reportMonth)return;
    const last=monthLastDay(reportMonth);
    const blocks=[[1,6],[7,13],[14,20],[21,27],[28,last]];
    q.innerHTML='<span class="text-muted small me-1">Rangos rápidos:</span>'+blocks.filter(([a])=>a<=last).map(([a,b],i)=>`<button type="button" class="secondary-btn week-btn" data-a="${a}" data-b="${b}">Semana ${i+1}: ${a}-${b}</button>`).join('');
    q.querySelectorAll('.week-btn').forEach(btn=>btn.addEventListener('click',()=>{
      const a=String(btn.dataset.a).padStart(2,'0'),b=String(btn.dataset.b).padStart(2,'0');
      reportMode='custom'; reportFrom=`${reportMonth}-${a}`; reportTo=`${reportMonth}-${b}`;
      el('reportMode').value='custom'; el('reportFrom').value=reportFrom; el('reportTo').value=reportTo;
      toggleReportInputs(); renderHistoricalReports();
    }));
  }

  function historyKg(r){return Number(r.hallulla||0)+Number(r.marraqueta||0)+Number(r.ciabatta||0)+Number(r.medioBaguette||0)+Number(r.panCompleto||0)}

  function renderHistoricalReports(){
    if(!el('reportCards'))return;
    refreshMonthOptions(); toggleReportInputs();
    const [from,to]=rangeForReport();
    const rows=panHistory.filter(r=>r.date>=from&&r.date<=to);
    const products={hallulla:0,marraqueta:0,ciabatta:0,medioBaguette:0,panCompleto:0};
    rows.forEach(r=>Object.keys(products).forEach(k=>products[k]+=Number(r[k]||0)));
    const totalKg=Object.values(products).reduce((a,b)=>a+b,0);
    const guideRows=rows.filter(r=>r.guide);
    const amount=guideRows.reduce((s,r)=>s+Number(r.amount||0),0);
    const receivableRows=rows.filter(r=>!r.paid&&Number(r.amount||0)>0);
    const pendingAmount=receivableRows.reduce((s,r)=>s+Number(r.pendingAmount ?? r.amount ?? 0),0);
    const paidAmount=guideRows.filter(r=>r.paid).reduce((s,r)=>s+Number(r.amount||0),0);
    const label=reportMode==='month'?monthName(reportMonth):`${fmtDateLocal(from)} al ${fmtDateLocal(to)}`;

    el('reportCards').innerHTML=
      stat('bi-box-seam','Kg del período',`${fmt(totalKg)} kg`,label)+
      stat('bi-receipt','Monto guías',clp(amount),`${guideRows.length} guías`)+
      stat('bi-check-circle','Pagado',clp(paidAmount),`${guideRows.filter(r=>r.paid).length} guías pagadas`)+
      stat('bi-exclamation-circle','Por cobrar',clp(pendingAmount),`${receivableRows.length} registros pendientes`);

    if(el('reportRangeLabel'))el('reportRangeLabel').textContent=label;
    if(el('reportProducts'))el('reportProducts').innerHTML=
      [['Hallulla',products.hallulla],['Marraqueta',products.marraqueta],['Ciabatta',products.ciabatta],['Medio baguette',products.medioBaguette],['Pan completo',products.panCompleto]]
      .filter(([n,v])=>v>0||['Hallulla','Marraqueta','Ciabatta'].includes(n))
      .map(([n,v])=>`<div class="report-row-head py-2 border-bottom"><span>${n}</span><strong>${fmt(v)} kg</strong></div>`).join('')+
      `<div class="report-row-head py-3"><strong>TOTAL</strong><strong>${fmt(totalKg)} kg</strong></div>`;

    if(el('reportGuideSummary'))el('reportGuideSummary').innerHTML=`
      <div class="report-row-head py-2 border-bottom"><span>Guías del período</span><strong>${guideRows.length}</strong></div>
      <div class="report-row-head py-2 border-bottom"><span>Pagadas</span><strong>${guideRows.filter(r=>r.paid).length}</strong></div>
      <div class="report-row-head py-2 border-bottom"><span>Pendientes</span><strong>${guideRows.filter(r=>!r.paid).length}</strong></div>
      <div class="report-row-head py-2"><span>Guías pendientes</span><strong>${guideRows.filter(r=>!r.paid).length}</strong></div>`;

    const map=new Map();
    rows.forEach(r=>{
      const key=r.clientId||r.clientName||'sin-cliente';
      const item=map.get(key)||{name:r.clientName||getClient?.(r.clientId)?.name||'Cliente',kg:0};
      item.kg+=historyKg(r); map.set(key,item);
    });
    const byClient=[...map.values()].filter(x=>x.kg>0).sort((a,b)=>b.kg-a.kg);
    const max=Math.max(1,...byClient.map(x=>x.kg));
    el('reportClientKg').innerHTML=byClient.length?byClient.map((x,i)=>`<div class="report-row"><div class="report-row-head"><span>${i===0?'🏆 ':''}${escLocal(x.name)}</span><strong>${fmt(x.kg)} kg</strong></div><div class="report-bar"><span style="width:${Math.round(x.kg/max*100)}%"></span></div></div>`).join(''):'<p class="text-muted">Sin kilos en este período.</p>';

    const debts=new Map();
    rows.filter(r=>!r.paid&&Number(r.amount||0)>0).forEach(r=>{
      const name=r.clientName||getClient?.(r.clientId)?.name||'Cliente';
      debts.set(name,(debts.get(name)||0)+Number(r.pendingAmount ?? r.amount ?? 0));
    });
    el('reportReceivables').innerHTML=debts.size?[...debts.entries()].sort((a,b)=>b[1]-a[1]).map(([name,balance])=>`<div class="report-row-head py-2 border-bottom"><span>${escLocal(name)}</span><strong class="money-pending">${clp(balance)}</strong></div>`).join(''):'<p class="text-muted">No hay saldos pendientes en el período.</p>';
  }

  const SEP_PENDING_GUIDES=new Set([
    'hist-2026-09-17-cli-don-juan-melipeuco-1641',
    'hist-2026-09-17-cli-el-huerto-jaramillo-1630',
    'hist-2026-09-22-cli-el-huerto-jaramillo-1658',
    'hist-2026-09-29-cli-el-huerto-jaramillo-1726',
    'hist-2026-09-25-cli-el-refugio-1688',
    'hist-2026-09-28-cli-el-refugio-1718',
    'hist-2026-09-30-cli-fredy-1734',
    'hist-2026-09-16-cli-hernan-astorga-pucon-1614',
    'hist-2026-09-28-cli-hernan-astorga-pucon-1709',
    'hist-2026-09-28-cli-km-06-1708',
    'hist-2026-09-25-cli-maria-flores-1695',
    'hist-2026-09-26-cli-maria-flores-cunco-1707',
    'hist-2026-09-29-cli-rustico-1728',
    'hist-2026-09-29-cli-tote-1723'
  ]);

  function normalizeSeptemberHistory(rows){
    return (rows||[]).map(r=>{
      if(r.clientId==='cli-el-laurel') return {...r,guide:'',paid:false};
      if(String(r.date||'').slice(0,7)!=='2026-09') return r;
      return {...r,paid:!SEP_PENDING_GUIDES.has(r.id)};
    });
  }

  function normalizeSeptemberGuides(guides){
    return (guides||[])
      .filter(g=>g.clientId!=='cli-el-laurel')
      .map(g=>{
        if(String(g.date||'').slice(0,7)!=='2026-09') return g;
        const pending=SEP_PENDING_GUIDES.has(g.id);
        return {...g,paid:pending?0:Number(g.total||0),status:pending?'Pendiente':'Pagada'};
      });
  }

  async function loadHistory(){
    try{
      const r=await fetch(HISTORY_API,{cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const data=await r.json();
      panHistory=normalizeSeptemberHistory(Array.isArray(data.history)?data.history:[]);
      window.panHistorial=panHistory;
      historyReady=true;
      refreshMonthOptions();
      renderHistoricalReports();
      console.info('Panadería: historial mensual cargado por separado');
    }catch(e){console.warn('Panadería: no se pudo cargar historial mensual.',e)}
  }

  async function loadRemote(){
    try{
      const r=await fetch(STATE_API,{cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const data=await r.json();
      if(data&&Array.isArray(data.clients)){
        data.guides=normalizeSeptemberGuides(data.guides);
        localStorage.setItem(LOCAL_KEY,JSON.stringify(data));
        db=data; remoteReady=true; renderAll(); renderHistoricalReports();
        console.info('Panadería: datos operativos cargados desde Cloudflare D1');
      }
    }catch(e){console.warn('Panadería: no se pudo cargar D1, se mantiene copia local.',e)}
  }

  async function pushRemote(snapshot){
    if(syncing)return; syncing=true;
    try{
      const r=await fetch(STATE_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(snapshot)});
      if(!r.ok)throw new Error(`${r.status}: ${await r.text()}`);
      remoteReady=true;
    }catch(e){console.error('Panadería: error guardando en D1.',e);if(typeof toast==='function')toast('No se pudo sincronizar con la base de datos')}
    finally{syncing=false}
  }

  window.addEventListener('DOMContentLoaded',async()=>{
    installReportUI();
    try{renderReports=renderHistoricalReports}catch(e){console.warn(e)}
    await loadHistory();
    await loadRemote();
    if(typeof saveData==='function'){
      const original=saveData;
      saveData=function(){original();pushRemote(db)};
    }
    window.panaderiaDbStatus=()=>({remoteReady,historyReady,historyRows:panHistory.length});
  });
})();
