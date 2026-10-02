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
  const clientOptions=selected=>(db.clients||[]).filter(c=>c.active!==false).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'es')).map(c=>`<option value="${esc(c.id)}"${c.id===selected?' selected':''}>${esc(c.name)}</option>`).join('');

  function rowsForMonth(){
    const month=currentMonth();
    const hist=(window.panHistorial||[]).filter(r=>String(r.date||'').slice(0,7)===month && rowKg(r)>0);
    if(hist.length) return hist;
    return (db.guides||[]).filter(g=>String(g.date||'').slice(0,7)===month).map(g=>({date:g.date,clientId:g.clientId,clientName:(typeof getClient==='function'?getClient(g.clientId)?.name:'')||'Cliente',hallulla:0,marraqueta:0,ciabatta:0,medioBaguette:0,panCompleto:0,guide:g.number,amount:g.total||0,_guideOnly:true,kg:g.kg||0}));
  }
  function clientName(r){return r.clientName||(typeof getClient==='function'?getClient(r.clientId)?.name:'')||'Cliente'}
  function effectiveKg(r){return r._guideOnly?Number(r.kg||0):rowKg(r)}

  function openOrderModal(id=null){
    const o=id?(db.orders||[]).find(x=>String(x.id)===String(id)):{};
    currentAction='order'; currentEditId=id;
    byId('modalTitle').textContent=id?'Editar pedido':'Ingresar pedido';
    byId('modalSubtitle').textContent='Pedido para producción y posterior despacho';
    byId('modalSubmit').classList.remove('d-none');
    const month=currentMonth();
    const d=new Date();
    const defaultDate=o.date||`${month}-${String(d.getDate()).padStart(2,'0')}`;
    byId('modalBody').innerHTML=`<div class="form-grid">
      <div class="full"><label class="form-label">Cliente</label><select name="clientId" class="form-select" required><option value="">Seleccione...</option>${clientOptions(o.clientId)}</select></div>
      <div><label class="form-label">Hallulla (kg)</label><input name="hallulla" type="number" step="0.01" min="0" class="form-control" value="${Number(o.hallulla||0)}"></div>
      <div><label class="form-label">Marraqueta (kg)</label><input name="marraqueta" type="number" step="0.01" min="0" class="form-control" value="${Number(o.marraqueta||0)}"></div>
      <div><label class="form-label">Ciabatta (kg)</label><input name="ciabatta" type="number" step="0.01" min="0" class="form-control" value="${Number(o.ciabatta||0)}"></div>
      <div><label class="form-label">Medio baguette (kg)</label><input name="medioBaguette" type="number" step="0.01" min="0" class="form-control" value="${Number(o.medioBaguette||0)}"></div>
      <div><label class="form-label">Pan completo (kg)</label><input name="panCompleto" type="number" step="0.01" min="0" class="form-control" value="${Number(o.panCompleto||0)}"></div>
      <div><label class="form-label">Fecha de entrega</label><input name="date" type="date" class="form-control" value="${esc(defaultDate)}" required></div>
      <div><label class="form-label">Estado</label><select name="status" class="form-select">${['Pendiente','En producción','Preparado','Despachado','Entregado'].map(s=>`<option${(o.status||'Pendiente')===s?' selected':''}>${s}</option>`).join('')}</select></div>
      <div class="full"><label class="form-label">Observaciones</label><textarea name="notes" class="form-control" rows="3">${esc(o.notes||'')}</textarea></div>
    </div>`;
    bootstrap.Modal.getOrCreateInstance(byId('entityModal')).show();
  }
  window.openDispatchOrderModal=openOrderModal;

  function ensureLayout(){
    const section=byId('section-despachos');
    if(section&&!section.dataset.ordersOnly){
      section.dataset.ordersOnly='1';
      section.innerHTML=`
        <div class="section-toolbar dispatch-toolbar">
          <div><h2 class="section-inline-title">Ingresar pedidos</h2><p class="muted mb-0">Registra pedidos y revisa los que aún están pendientes de despacho.</p></div>
          <button id="newDispatchOrderBtn" class="primary-btn"><i class="bi bi-plus-circle"></i> Ingresar pedido</button>
        </div>
        <div class="card-panel">
          <div class="panel-head"><div><h2>Pedidos por despachar</h2><p id="pendingOrdersSubtitle"></p></div></div>
          <div class="table-wrap"><table class="data-table"><thead><tr><th>Entrega</th><th>Cliente</th><th>Productos</th><th>Total kg</th><th>Estado</th><th></th></tr></thead><tbody id="dispatchPendingOrders"></tbody></table></div>
        </div>`;
      byId('newDispatchOrderBtn')?.addEventListener('click',()=>openOrderModal());
    }

    if(!byId('section-historial-despachos')){
      const history=document.createElement('section');
      history.id='section-historial-despachos';
      history.className='app-section';
      history.innerHTML=`
        <div class="section-toolbar"><div><h2 class="section-inline-title">Historial de despachos</h2><p class="muted mb-0">Consulta despachos por cliente, producto, kilos y monto de guía.</p></div></div>
        <div class="card-panel mb-3"><div class="filter-row"><div class="search-control"><i class="bi bi-search"></i><input id="dispatchClientSearch" placeholder="Buscar cliente..."></div><select id="dispatchClientFilter" class="form-select compact-select"><option value="">Todos los clientes</option></select></div></div>
        <div id="dispatchSummary" class="mini-stats"></div>
        <div class="card-panel"><div class="panel-head"><div><h2 id="dispatchTitle">Historial de despachos</h2><p id="dispatchSubtitle"></p></div></div><div class="table-wrap"><table class="data-table dispatch-history-table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Hallulla</th><th>Marraqueta</th><th>Ciabatta</th><th>Otros</th><th>Total kg</th><th>Guía</th><th>Monto guía</th></tr></thead><tbody id="dispatchHistoryTable"></tbody></table></div></div>`;
      const main=document.querySelector('.main-content');
      const config=byId('section-configuracion');
      main?.insertBefore(history,config||null);
      byId('dispatchClientSearch')?.addEventListener('input',renderHistory);
      byId('dispatchClientFilter')?.addEventListener('change',renderHistory);
    }

    const nav=byId('mainNav');
    if(nav&&!byId('historyDispatchNav')){
      const b=document.createElement('button');
      b.id='historyDispatchNav'; b.className='nav-item';
      b.innerHTML='<i class="bi bi-clock-history"></i><span>Historial despachos</span>';
      const guidesBtn=nav.querySelector('[data-section="guias"]');
      nav.insertBefore(b,guidesBtn||null);
      b.addEventListener('click',()=>{
        document.querySelectorAll('.app-section').forEach(x=>x.classList.remove('active-section'));
        byId('section-historial-despachos')?.classList.add('active-section');
        document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        const t=byId('pageTitle'),s=byId('pageSubtitle');
        if(t)t.textContent='Historial de despachos'; if(s)s.textContent='Despachos realizados y detalle por cliente';
        document.querySelector('.sidebar')?.classList.remove('open');
        renderHistory();
      });
    }
  }

  function renderPendingOrders(){
    const tbody=byId('dispatchPendingOrders');if(!tbody)return;
    const month=currentMonth();
    const orders=(db.orders||[]).filter(o=>String(o.date||'').slice(0,7)===month && o.status!=='Entregado').sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)));
    tbody.innerHTML=orders.length?orders.map(o=>{const parts=[['Hallulla',o.hallulla],['Marraqueta',o.marraqueta],['Ciabatta',o.ciabatta],['Medio baguette',o.medioBaguette],['Pan completo',o.panCompleto]].filter(([,v])=>Number(v||0)>0).map(([n,v])=>`${n}: ${kg(v)} kg`).join(' · ');return `<tr><td>${fmtDate(o.date)}</td><td><strong>${esc((typeof getClient==='function'?getClient(o.clientId)?.name:'')||'Cliente')}</strong></td><td>${esc(parts||'-')}</td><td><strong>${kg(rowKg(o))} kg</strong></td><td>${typeof badge==='function'?badge(o.status||'Pendiente'):esc(o.status||'Pendiente')}</td><td><button class="icon-btn" onclick="openDispatchOrderModal('${esc(o.id)}')"><i class="bi bi-pencil"></i></button></td></tr>`}).join(''):`<tr><td colspan="6" class="text-center text-muted py-4">No hay pedidos pendientes en ${monthLabel(month)}.</td></tr>`;
    const sub=byId('pendingOrdersSubtitle');if(sub)sub.textContent=`${monthLabel(month)} · ${orders.length} pedido${orders.length===1?'':'s'} pendiente${orders.length===1?'':'s'}`;
  }

  function refillClients(rows){const select=byId('dispatchClientFilter');if(!select)return;const current=select.value;const names=[...new Set(rows.map(clientName))].sort((a,b)=>a.localeCompare(b,'es'));select.innerHTML='<option value="">Todos los clientes</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');if(names.includes(current))select.value=current;}

  function renderHistory(){
    const table=byId('dispatchHistoryTable');if(!table)return;
    const month=currentMonth(),all=rowsForMonth();refillClients(all);
    const search=(byId('dispatchClientSearch')?.value||'').trim().toLowerCase(),selected=byId('dispatchClientFilter')?.value||'';
    const rows=all.filter(r=>{const name=clientName(r);return(!search||name.toLowerCase().includes(search))&&(!selected||name===selected)}).sort((a,b)=>String(b.date).localeCompare(String(a.date))||clientName(a).localeCompare(clientName(b),'es'));
    table.innerHTML=rows.length?rows.map(r=>{const otros=Number(r.medioBaguette||0)+Number(r.panCompleto||0);return `<tr><td>${fmtDate(r.date)}</td><td><strong>${esc(clientName(r))}</strong></td><td>${Number(r.hallulla||0)>0?kg(r.hallulla)+' kg':'-'}</td><td>${Number(r.marraqueta||0)>0?kg(r.marraqueta)+' kg':'-'}</td><td>${Number(r.ciabatta||0)>0?kg(r.ciabatta)+' kg':'-'}</td><td>${otros>0?kg(otros)+' kg':'-'}</td><td><strong>${kg(effectiveKg(r))} kg</strong></td><td>${r.guide?`N° ${esc(r.guide)}`:'-'}</td><td><strong>${Number(r.amount||0)>0?money(r.amount):'-'}</strong></td></tr>`}).join(''):`<tr><td colspan="9" class="text-center text-muted py-4">No hay despachos para este filtro en ${monthLabel(month)}.</td></tr>`;
    const totalKg=rows.reduce((s,r)=>s+effectiveKg(r),0),totalAmount=rows.reduce((s,r)=>s+Number(r.amount||0),0),clients=new Set(rows.map(clientName)).size,guides=rows.filter(r=>r.guide).length;
    const summary=byId('dispatchSummary');if(summary&&typeof mini==='function')summary.innerHTML=mini(`Despachos · ${monthLabel(month)}`,rows.length)+mini('Clientes',clients)+mini('Total kilos',`${kg(totalKg)} kg`)+mini('Monto guías',money(totalAmount));
    const title=byId('dispatchTitle');if(title)title.textContent=selected?`Historial de ${selected}`:'Historial de despachos';const sub=byId('dispatchSubtitle');if(sub)sub.textContent=`${monthLabel(month)} · ${guides} guía${guides===1?'':'s'} con número registrado`;
  }

  function renderAllDispatch(){ensureLayout();renderPendingOrders();renderHistory();}
  function install(){ensureLayout();try{renderDispatch=renderAllDispatch}catch{}window.renderDispatch=renderAllDispatch;renderAllDispatch();setTimeout(renderAllDispatch,400);setTimeout(renderAllDispatch,1400);}
  window.addEventListener('DOMContentLoaded',install);window.addEventListener('load',()=>setTimeout(install,50));
})();