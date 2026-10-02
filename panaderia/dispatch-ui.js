(() => {
  const byId=id=>document.getElementById(id);
  const MONTH_KEY='panaderiaMesTrabajo';
  const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n||0));
  const kg=n=>Number(n||0).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:3});
  const fmtDate=d=>{if(!d)return'-';const [y,m,day]=String(d).split('-');return `${day}-${m}-${y}`};
  const monthLabel=ym=>{if(!ym)return'';const [y,m]=ym.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())};
  const currentMonth=()=>localStorage.getItem(MONTH_KEY)||new Date().toISOString().slice(0,7);
  const rowKg=r=>Number(r.hallulla||0)+Number(r.marraqueta||0)+Number(r.ciabatta||0)+Number(r.medioBaguette||0)+Number(r.panCompleto||0);

  function rowsForMonth(){
    const month=currentMonth();
    const hist=(window.panHistorial||[]).filter(r=>String(r.date||'').slice(0,7)===month && rowKg(r)>0);
    if(hist.length) return hist;
    return (db.guides||[]).filter(g=>String(g.date||'').slice(0,7)===month).map(g=>({
      date:g.date,clientId:g.clientId,clientName:(typeof getClient==='function'?getClient(g.clientId)?.name:'')||'Cliente',
      hallulla:0,marraqueta:0,ciabatta:0,medioBaguette:0,panCompleto:0,guide:g.number,amount:g.total||0,_guideOnly:true,kg:g.kg||0
    }));
  }
  function clientName(r){return r.clientName||(typeof getClient==='function'?getClient(r.clientId)?.name:'')||'Cliente'}
  function effectiveKg(r){return r._guideOnly?Number(r.kg||0):rowKg(r)}

  function ensureLayout(){
    const section=byId('section-despachos');
    if(!section||section.dataset.redesigned)return;
    section.dataset.redesigned='1';
    section.innerHTML=`
      <div class="section-toolbar dispatch-toolbar">
        <div><h2 class="section-inline-title">Historial de despachos</h2><p class="muted mb-0">Consulta los despachos del mes por cliente, producto, kilos y monto de guía.</p></div>
      </div>
      <div class="card-panel mb-3">
        <div class="filter-row">
          <div class="search-control"><i class="bi bi-search"></i><input id="dispatchClientSearch" placeholder="Buscar cliente..."></div>
          <select id="dispatchClientFilter" class="form-select compact-select"><option value="">Todos los clientes</option></select>
        </div>
      </div>
      <div id="dispatchSummary" class="mini-stats"></div>
      <div class="card-panel">
        <div class="panel-head"><div><h2 id="dispatchTitle">Despachos del mes</h2><p id="dispatchSubtitle"></p></div></div>
        <div class="table-wrap"><table class="data-table dispatch-history-table">
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Hallulla</th><th>Marraqueta</th><th>Ciabatta</th><th>Otros</th><th>Total kg</th><th>Guía</th><th>Monto guía</th></tr></thead>
          <tbody id="dispatchHistoryTable"></tbody>
        </table></div>
      </div>`;
    byId('dispatchClientSearch')?.addEventListener('input',renderDispatchHistory);
    byId('dispatchClientFilter')?.addEventListener('change',renderDispatchHistory);
  }

  function refillClients(rows){
    const select=byId('dispatchClientFilter'); if(!select)return;
    const current=select.value;
    const names=[...new Set(rows.map(clientName))].sort((a,b)=>a.localeCompare(b,'es'));
    select.innerHTML='<option value="">Todos los clientes</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
    if(names.includes(current))select.value=current;
  }

  function renderDispatchHistory(){
    ensureLayout();
    const table=byId('dispatchHistoryTable'); if(!table)return;
    const month=currentMonth();
    const all=rowsForMonth();
    refillClients(all);
    const search=(byId('dispatchClientSearch')?.value||'').trim().toLowerCase();
    const selected=byId('dispatchClientFilter')?.value||'';
    const rows=all.filter(r=>{
      const name=clientName(r);
      return (!search||name.toLowerCase().includes(search))&&(!selected||name===selected);
    }).sort((a,b)=>String(b.date).localeCompare(String(a.date))||clientName(a).localeCompare(clientName(b),'es'));

    table.innerHTML=rows.length?rows.map(r=>{
      const otros=Number(r.medioBaguette||0)+Number(r.panCompleto||0);
      return `<tr>
        <td>${fmtDate(r.date)}</td>
        <td><strong>${esc(clientName(r))}</strong></td>
        <td>${Number(r.hallulla||0)>0?kg(r.hallulla)+' kg':'-'}</td>
        <td>${Number(r.marraqueta||0)>0?kg(r.marraqueta)+' kg':'-'}</td>
        <td>${Number(r.ciabatta||0)>0?kg(r.ciabatta)+' kg':'-'}</td>
        <td>${otros>0?kg(otros)+' kg':'-'}</td>
        <td><strong>${kg(effectiveKg(r))} kg</strong></td>
        <td>${r.guide?`N° ${esc(r.guide)}`:'-'}</td>
        <td><strong>${Number(r.amount||0)>0?money(r.amount):'-'}</strong></td>
      </tr>`;
    }).join(''):`<tr><td colspan="9" class="text-center text-muted py-4">No hay despachos para este filtro en ${monthLabel(month)}.</td></tr>`;

    const totalKg=rows.reduce((s,r)=>s+effectiveKg(r),0);
    const totalAmount=rows.reduce((s,r)=>s+Number(r.amount||0),0);
    const clients=new Set(rows.map(clientName)).size;
    const guides=rows.filter(r=>r.guide).length;
    const summary=byId('dispatchSummary');
    if(summary&&typeof mini==='function')summary.innerHTML=
      mini(`Despachos · ${monthLabel(month)}`,rows.length)+mini('Clientes',clients)+mini('Total kilos',`${kg(totalKg)} kg`)+mini('Monto guías',money(totalAmount));
    const title=byId('dispatchTitle'); if(title) title.textContent=selected?`Historial de ${selected}`:'Historial de despachos';
    const sub=byId('dispatchSubtitle'); if(sub) sub.textContent=`${monthLabel(month)} · ${guides} guía${guides===1?'':'s'} con número registrado`;
  }

  function install(){
    ensureLayout();
    try{renderDispatch=renderDispatchHistory;}catch{}
    window.renderDispatch=renderDispatchHistory;
    renderDispatchHistory();
    setTimeout(renderDispatchHistory,400);
    setTimeout(renderDispatchHistory,1400);
  }

  window.addEventListener('DOMContentLoaded',install);
  window.addEventListener('load',()=>setTimeout(install,50));
})();
