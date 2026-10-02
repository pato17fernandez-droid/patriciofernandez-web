(() => {
  const byId=id=>document.getElementById(id);
  const MONTH_KEY='panaderiaMesTrabajo';
  const TRAY_TARE=1.6;
  const esc=s=>String(s??'').replace(/[&<>'\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[m]));
  const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n||0));
  const kg=n=>Number(n||0).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:3});
  const fmtDate=d=>{if(!d)return'-';const [y,m,day]=String(d).split('-');return `${day}-${m}-${y}`};
  const monthLabel=ym=>{if(!ym)return'';const [y,m]=ym.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())};
  const currentMonth=()=>localStorage.getItem(MONTH_KEY)||new Date().toISOString().slice(0,7);
  const rowKg=r=>Number(r.hallulla||0)+Number(r.marraqueta||0)+Number(r.ciabatta||0)+Number(r.medioBaguette||0)+Number(r.panCompleto||0);
  const clientOptions=selected=>(db.clients||[]).filter(c=>c.active!==false).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'es')).map(c=>`<option value="${esc(c.id)}"${c.id===selected?' selected':''}>${esc(c.name)}</option>`).join('');
  const products=[['hallulla','Hallulla'],['marraqueta','Marraqueta'],['ciabatta','Ciabatta'],['medioBaguette','Medio baguette'],['panCompleto','Pan completo']];

  function rowsForMonth(){
    const month=currentMonth();
    const hist=(window.panHistorial||[]).filter(r=>String(r.date||'').slice(0,7)===month && rowKg(r)>0);
    if(hist.length) return hist;
    return (db.guides||[]).filter(g=>String(g.date||'').slice(0,7)===month).map(g=>({date:g.date,clientId:g.clientId,clientName:(typeof getClient==='function'?getClient(g.clientId)?.name:'')||'Cliente',hallulla:0,marraqueta:0,ciabatta:0,medioBaguette:0,panCompleto:0,guide:g.number,amount:g.total||0,_guideOnly:true,kg:g.kg||0}));
  }
  function clientName(r){return r.clientName||(typeof getClient==='function'?getClient(r.clientId)?.name:'')||'Cliente'}
  function effectiveKg(r){return r._guideOnly?Number(r.kg||0):rowKg(r)}

  function productCard(key,label,value){
    return `<div class="card-panel mb-3" data-weigh-product="${key}" style="padding:16px">
      <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
        <div><strong>${label}</strong><div class="small text-muted">Tara por bandeja: ${TRAY_TARE.toFixed(1)} kg</div></div>
        <div class="text-end"><small class="text-muted d-block">Kilos acumulados</small><strong class="fs-5"><span data-total-label="${key}">${kg(value)}</span> kg</strong></div>
      </div>
      <input type="hidden" name="${key}" value="${Number(value||0)}" data-total-input="${key}">
      <div class="form-grid">
        <div><label class="form-label">N° bandejas</label><input type="number" min="0" step="1" class="form-control" data-trays="${key}"></div>
        <div><label class="form-label">Peso que marca la pesa (kg)</label><input type="number" min="0" step="0.01" class="form-control" data-gross="${key}"></div>
        <div class="full"><button type="button" class="primary-btn" data-add-weighing="${key}"><i class="bi bi-plus-circle"></i> Sumar pesaje</button></div>
      </div>
      <div class="small mt-2" data-calc-note="${key}"></div>
      <div class="small text-muted mt-1" data-weigh-list="${key}">${Number(value||0)>0?`Inicial: ${kg(value)} kg`:''}</div>
    </div>`;
  }

  function bindWeighingTools(){
    const modal=byId('modalBody'); if(!modal)return;
    const updateGrand=()=>{
      const total=products.reduce((s,[key])=>s+Number(modal.querySelector(`[data-total-input="${key}"]`)?.value||0),0);
      const el=byId('orderGrandTotal'); if(el)el.textContent=`${kg(total)} kg`;
    };
    products.forEach(([key])=>{
      const hidden=modal.querySelector(`[data-total-input="${key}"]`);
      const label=modal.querySelector(`[data-total-label="${key}"]`);
      const note=modal.querySelector(`[data-calc-note="${key}"]`);
      const list=modal.querySelector(`[data-weigh-list="${key}"]`);
      const setTotal=v=>{hidden.value=Number(v.toFixed(3));label.textContent=kg(v);updateGrand();};
      modal.querySelector(`[data-add-weighing="${key}"]`)?.addEventListener('click',()=>{
        const trays=Number(modal.querySelector(`[data-trays="${key}"]`)?.value||0);
        const gross=Number(modal.querySelector(`[data-gross="${key}"]`)?.value||0);
        if(gross<=0){alert('Ingresa el peso que marca la pesa.');return;}
        const tare=trays*TRAY_TARE;
        const net=gross-tare;
        if(net<=0){alert('El peso neto no puede ser 0 o negativo. Revisa bandejas y peso.');return;}
        const total=Number(hidden.value||0)+net;
        setTotal(total);
        note.textContent=`${kg(gross)} kg − ${trays} bandeja${trays===1?'':'s'} × ${TRAY_TARE.toFixed(1)} kg = ${kg(net)} kg de pan.`;
        list.innerHTML += `${list.innerHTML?' · ':''}+ ${kg(net)} kg`;
        modal.querySelector(`[data-trays="${key}"]`).value='';
        modal.querySelector(`[data-gross="${key}"]`).value='';
      });
    });
    updateGrand();
  }

  function openOrderModal(id=null){
    const o=id?(db.orders||[]).find(x=>String(x.id)===String(id)):{};
    currentAction='order'; currentEditId=id;
    byId('modalTitle').textContent=id?'Editar pedido':'Ingresar pedido';
    byId('modalSubtitle').textContent='Pesaje por bandejas con acumulación de kilos.';
    byId('modalSubmit').classList.remove('d-none');
    const month=currentMonth();
    const d=new Date();
    const defaultDate=o.date||`${month}-${String(d.getDate()).padStart(2,'0')}`;
    byId('modalBody').innerHTML=`
      <div class="form-grid mb-3">
        <div class="full"><label class="form-label">Cliente</label><select name="clientId" class="form-select" required><option value="">Seleccione...</option>${clientOptions(o.clientId)}</select></div>
        <div><label class="form-label">Fecha de entrega</label><input name="date" type="date" class="form-control" value="${esc(defaultDate)}" required></div>
        <div><label class="form-label">Estado</label><select name="status" class="form-select">${['Pendiente','En producción','Preparado','Despachado','Entregado'].map(s=>`<option${(o.status||'Pendiente')===s?' selected':''}>${s}</option>`).join('')}</select></div>
      </div>
      ${products.map(([key,label])=>productCard(key,label,o[key]||0)).join('')}
      <div class="card-panel mb-3" style="padding:16px"><div class="d-flex justify-content-between align-items-center"><strong>Total del pedido</strong><strong id="orderGrandTotal" class="fs-4">0,00 kg</strong></div></div>
      <div><label class="form-label">Observaciones</label><textarea name="notes" class="form-control" rows="3">${esc(o.notes||'')}</textarea></div>`;
    bindWeighingTools();
    bootstrap.Modal.getOrCreateInstance(byId('entityModal')).show();
  }
  window.openDispatchOrderModal=openOrderModal;

  function ensureLayout(){
    const section=byId('section-despachos');
    if(section&&!section.dataset.ordersOnly){
      section.dataset.ordersOnly='1';
      section.innerHTML=`<div class="section-toolbar dispatch-toolbar"><div><h2 class="section-inline-title">Ingresar pedidos</h2><p class="muted mb-0">Registra pedidos mediante pesajes acumulados.</p></div><button id="newDispatchOrderBtn" class="primary-btn"><i class="bi bi-plus-circle"></i> Ingresar pedido</button></div><div class="card-panel"><div class="panel-head"><div><h2>Pedidos por despachar</h2><p id="pendingOrdersSubtitle"></p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Entrega</th><th>Cliente</th><th>Productos</th><th>Total kg</th><th>Estado</th><th></th></tr></thead><tbody id="dispatchPendingOrders"></tbody></table></div></div>`;
      byId('newDispatchOrderBtn')?.addEventListener('click',()=>openOrderModal());
    }
    if(!byId('section-historial-despachos')){
      const history=document.createElement('section');history.id='section-historial-despachos';history.className='app-section';history.innerHTML=`<div class="section-toolbar"><div><h2 class="section-inline-title">Historial de despachos</h2><p class="muted mb-0">Consulta despachos por cliente, producto, kilos y monto de guía.</p></div></div><div class="card-panel mb-3"><div class="filter-row"><div class="search-control"><i class="bi bi-search"></i><input id="dispatchClientSearch" placeholder="Buscar cliente..."></div><select id="dispatchClientFilter" class="form-select compact-select"><option value="">Todos los clientes</option></select></div></div><div id="dispatchSummary" class="mini-stats"></div><div class="card-panel"><div class="panel-head"><div><h2 id="dispatchTitle">Historial de despachos</h2><p id="dispatchSubtitle"></p></div></div><div class="table-wrap"><table class="data-table dispatch-history-table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Hallulla</th><th>Marraqueta</th><th>Ciabatta</th><th>Otros</th><th>Total kg</th><th>Guía</th><th>Monto guía</th></tr></thead><tbody id="dispatchHistoryTable"></tbody></table></div></div>`;
      document.querySelector('.main-content')?.insertBefore(history,byId('section-configuracion')||null);
      byId('dispatchClientSearch')?.addEventListener('input',renderHistory);byId('dispatchClientFilter')?.addEventListener('change',renderHistory);
    }
    const nav=byId('mainNav');if(nav&&!byId('historyDispatchNav')){const b=document.createElement('button');b.id='historyDispatchNav';b.className='nav-item';b.innerHTML='<i class="bi bi-clock-history"></i><span>Historial despachos</span>';nav.insertBefore(b,nav.querySelector('[data-section="guias"]')||null);b.addEventListener('click',()=>{document.querySelectorAll('.app-section').forEach(x=>x.classList.remove('active-section'));byId('section-historial-despachos')?.classList.add('active-section');document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(byId('pageTitle'))byId('pageTitle').textContent='Historial de despachos';if(byId('pageSubtitle'))byId('pageSubtitle').textContent='Despachos realizados y detalle por cliente';document.querySelector('.sidebar')?.classList.remove('open');renderHistory();});}
  }

  function renderPendingOrders(){
    const tbody=byId('dispatchPendingOrders');if(!tbody)return;const month=currentMonth();const orders=(db.orders||[]).filter(o=>String(o.date||'').slice(0,7)===month&&o.status!=='Entregado').sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)));
    tbody.innerHTML=orders.length?orders.map(o=>{const parts=products.filter(([key])=>Number(o[key]||0)>0).map(([key,label])=>`${label}: ${kg(o[key])} kg`).join(' · ');return `<tr><td>${fmtDate(o.date)}</td><td><strong>${esc((typeof getClient==='function'?getClient(o.clientId)?.name:'')||'Cliente')}</strong></td><td>${esc(parts||'-')}</td><td><strong>${kg(rowKg(o))} kg</strong></td><td>${typeof badge==='function'?badge(o.status||'Pendiente'):esc(o.status||'Pendiente')}</td><td><button class="icon-btn" onclick="openDispatchOrderModal('${esc(o.id)}')"><i class="bi bi-pencil"></i></button></td></tr>`}).join(''):`<tr><td colspan="6" class="text-center text-muted py-4">No hay pedidos pendientes en ${monthLabel(month)}.</td></tr>`;
    if(byId('pendingOrdersSubtitle'))byId('pendingOrdersSubtitle').textContent=`${monthLabel(month)} · ${orders.length} pedido${orders.length===1?'':'s'} pendiente${orders.length===1?'':'s'}`;
  }
  function refillClients(rows){const select=byId('dispatchClientFilter');if(!select)return;const current=select.value;const names=[...new Set(rows.map(clientName))].sort((a,b)=>a.localeCompare(b,'es'));select.innerHTML='<option value="">Todos los clientes</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');if(names.includes(current))select.value=current;}
  function renderHistory(){const table=byId('dispatchHistoryTable');if(!table)return;const month=currentMonth(),all=rowsForMonth();refillClients(all);const search=(byId('dispatchClientSearch')?.value||'').trim().toLowerCase(),selected=byId('dispatchClientFilter')?.value||'';const rows=all.filter(r=>{const name=clientName(r);return(!search||name.toLowerCase().includes(search))&&(!selected||name===selected)}).sort((a,b)=>String(b.date).localeCompare(String(a.date))||clientName(a).localeCompare(clientName(b),'es'));table.innerHTML=rows.length?rows.map(r=>{const otros=Number(r.medioBaguette||0)+Number(r.panCompleto||0);return `<tr><td>${fmtDate(r.date)}</td><td><strong>${esc(clientName(r))}</strong></td><td>${Number(r.hallulla||0)>0?kg(r.hallulla)+' kg':'-'}</td><td>${Number(r.marraqueta||0)>0?kg(r.marraqueta)+' kg':'-'}</td><td>${Number(r.ciabatta||0)>0?kg(r.ciabatta)+' kg':'-'}</td><td>${otros>0?kg(otros)+' kg':'-'}</td><td><strong>${kg(effectiveKg(r))} kg</strong></td><td>${r.guide?`N° ${esc(r.guide)}`:'-'}</td><td><strong>${Number(r.amount||0)>0?money(r.amount):'-'}</strong></td></tr>`}).join(''):`<tr><td colspan="9" class="text-center text-muted py-4">No hay despachos para este filtro en ${monthLabel(month)}.</td></tr>`;const totalKg=rows.reduce((s,r)=>s+effectiveKg(r),0),totalAmount=rows.reduce((s,r)=>s+Number(r.amount||0),0),clients=new Set(rows.map(clientName)).size,guides=rows.filter(r=>r.guide).length;if(byId('dispatchSummary')&&typeof mini==='function')byId('dispatchSummary').innerHTML=mini(`Despachos · ${monthLabel(month)}`,rows.length)+mini('Clientes',clients)+mini('Total kilos',`${kg(totalKg)} kg`)+mini('Monto guías',money(totalAmount));if(byId('dispatchTitle'))byId('dispatchTitle').textContent=selected?`Historial de ${selected}`:'Historial de despachos';if(byId('dispatchSubtitle'))byId('dispatchSubtitle').textContent=`${monthLabel(month)} · ${guides} guía${guides===1?'':'s'} con número registrado`;}
  function renderAllDispatch(){ensureLayout();renderPendingOrders();renderHistory();}
  function install(){ensureLayout();try{renderDispatch=renderAllDispatch}catch{}window.renderDispatch=renderAllDispatch;renderAllDispatch();setTimeout(renderAllDispatch,400);setTimeout(renderAllDispatch,1400);}
  window.addEventListener('DOMContentLoaded',install);window.addEventListener('load',()=>setTimeout(install,50));
})();