(() => {
  const API='/api/panaderia/trays';
  const q=id=>document.getElementById(id);
  const safe=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const fmtDate=d=>{if(!d)return '-';const [y,m,day]=String(d).split('-');return y&&m&&day?`${day}-${m}-${y}`:d};
  const uid=()=>`tray-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  let state={balances:[],movements:[]};

  async function api(body){
    const opt=body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'};
    const r=await fetch(API,opt),data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
    return data;
  }
  const client=id=>typeof getClient==='function'?getClient(id):null;

  function today(){return new Date().toISOString().slice(0,10)}
  function clientOptions(selected=''){
    return (db.clients||[]).filter(c=>c.active!==false).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'es')).map(c=>`<option value="${safe(c.id)}" ${c.id===selected?'selected':''}>${safe(c.name)}</option>`).join('');
  }

  function renderStats(){
    const total=state.balances.reduce((s,x)=>s+Number(x.balance||0),0);
    const withBal=state.balances.filter(x=>Number(x.balance||0)>0).length;
    const td=today();
    const deliveredToday=state.movements.filter(x=>x.date===td).reduce((s,x)=>s+Number(x.delivered||0),0);
    const returnedToday=state.movements.filter(x=>x.date===td).reduce((s,x)=>s+Number(x.returned||0),0);
    const box=q('trayStats');if(!box)return;
    box.innerHTML=`
      <div class="mini-stat"><span>Bandejas en clientes</span><strong>${total}</strong></div>
      <div class="mini-stat"><span>Clientes con saldo</span><strong>${withBal}</strong></div>
      <div class="mini-stat"><span>Entregadas hoy</span><strong>${deliveredToday}</strong></div>
      <div class="mini-stat"><span>Devueltas hoy</span><strong>${returnedToday}</strong></div>`;
  }

  function renderBalances(){
    const body=q('traysTable');if(!body)return;
    const search=(q('traySearch')?.value||'').toLowerCase();
    const byClient=new Map((state.balances||[]).map(x=>[x.clientId,x]));
    const allActive=(db.clients||[]).filter(c=>c.active!==false).map(c=>byClient.get(c.id)||({clientId:c.id,delivered:0,returned:0,balance:0,last:''}));
    const rows=allActive.filter(x=>{
      const name=client(x.clientId)?.name||x.clientId;
      return !search||name.toLowerCase().includes(search);
    }).sort((a,b)=>Number(b.balance||0)-Number(a.balance||0)||String(client(a.clientId)?.name||'').localeCompare(String(client(b.clientId)?.name||''),'es'));
    body.innerHTML=rows.map(x=>{
      const name=client(x.clientId)?.name||x.clientId;
      const bal=Number(x.balance||0);
      return `<tr>
        <td><strong>${safe(name)}</strong></td>
        <td>${x.delivered}</td>
        <td>${x.returned}</td>
        <td><strong class="${bal>0?'money-pending':'money-positive'}">${bal}</strong></td>
        <td>${fmtDate(x.last)}</td>
        <td class="text-nowrap">
          <button class="icon-btn" data-tray-add="${safe(x.clientId)}" title="Registrar movimiento"><i class="bi bi-plus-circle"></i></button>
          <button class="icon-btn" data-tray-opening="${safe(x.clientId)}" title="Ajustar saldo"><i class="bi bi-sliders"></i></button>
        </td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" class="text-center text-muted py-4">Aún no hay control de bandejas registrado.</td></tr>';
  }

  function renderHistory(){
    const body=q('trayHistoryTable');if(!body)return;
    const clientFilter=q('trayClientFilter')?.value||'';
    const from=q('trayDateFrom')?.value||'',to=q('trayDateTo')?.value||'';
    const rows=(state.movements||[]).filter(x=>{
      if(clientFilter&&x.clientId!==clientFilter)return false;
      if(from&&x.date<from)return false;
      if(to&&x.date>to)return false;
      return true;
    });
    body.innerHTML=rows.map(x=>{
      const name=client(x.clientId)?.name||x.clientId;
      const delta=Number(x.delivered||0)-Number(x.returned||0);
      return `<tr>
        <td>${fmtDate(x.date)}</td>
        <td><strong>${safe(name)}</strong></td>
        <td>${x.delivered||0}</td>
        <td>${x.returned||0}</td>
        <td class="${delta>0?'money-pending':'money-positive'}">${delta>0?'+':''}${delta}</td>
        <td>${safe(x.notes||'-')}</td>
        <td><button class="icon-btn" data-tray-delete="${safe(x.id)}" title="Eliminar movimiento"><i class="bi bi-trash"></i></button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="7" class="text-center text-muted py-4">Sin movimientos para estos filtros.</td></tr>';
  }

  function syncDbBalances(){
    db.trays=(state.balances||[]).map(x=>({clientId:x.clientId,delivered:x.delivered,returned:x.returned,last:x.last}));
    try{localStorage.setItem('panaderiaSistemaV1',JSON.stringify(db));}catch{}
    try{if(typeof renderClients==='function')renderClients()}catch{}
  }

  function render(){renderStats();renderBalances();renderHistory();}

  async function load(){
    try{
      state=await api();
      syncDbBalances();
      render();
    }catch(e){
      console.error(e);
      if(typeof toast==='function')toast('No se pudo cargar el control de bandejas');
    }
  }

  function modal(){return bootstrap.Modal.getOrCreateInstance(q('trayModal'))}

  function openMovement(clientId=''){
    q('trayModalTitle').textContent='Registrar movimiento de bandejas';
    q('trayModalBody').innerHTML=`
      <div class="form-grid">
        <div class="full"><label class="form-label">Cliente</label><select name="clientId" class="form-select" required><option value="">Seleccione...</option>${clientOptions(clientId)}</select></div>
        <div><label class="form-label">Fecha</label><input name="date" type="date" class="form-control" value="${today()}" required></div>
        <div></div>
        <div><label class="form-label">Bandejas entregadas con pan</label><input name="delivered" type="number" min="0" value="0" class="form-control"></div>
        <div><label class="form-label">Bandejas vacías devueltas</label><input name="returned" type="number" min="0" value="0" class="form-control"></div>
        <div class="full"><label class="form-label">Observación</label><textarea name="notes" class="form-control" rows="2" placeholder="Ej. Quedaron 3 bandejas con pan en el local"></textarea></div>
      </div>
      <div class="alert alert-info mt-3 mb-0">El saldo del cliente aumenta con las bandejas entregadas y disminuye con las bandejas devueltas.</div>`;
    q('trayForm').dataset.mode='movement';
    modal().show();
  }

  function openOpening(clientId=''){
    const current=state.balances.find(x=>x.clientId===clientId)?.balance||0;
    q('trayModalTitle').textContent='Ajustar saldo de bandejas';
    q('trayModalBody').innerHTML=`
      <div class="form-grid">
        <div class="full"><label class="form-label">Cliente</label><select name="clientId" class="form-select" required><option value="">Seleccione...</option>${clientOptions(clientId)}</select></div>
        <div><label class="form-label">Fecha del ajuste</label><input name="date" type="date" class="form-control" value="${today()}" required></div>
        <div><label class="form-label">Saldo correcto en poder del cliente</label><input name="balance" type="number" min="0" value="${current}" class="form-control" required></div>
        <div class="full"><label class="form-label">Observación</label><textarea name="notes" class="form-control" rows="2">Ajuste según planilla del conductor</textarea></div>
      </div>
      <div class="alert alert-warning mt-3 mb-0">Úsalo para cargar el saldo inicial real o corregir una diferencia de conteo. No borra el historial: registra el ajuste.</div>`;
    q('trayForm').dataset.mode='opening';
    modal().show();
  }

  async function submit(e){
    e.preventDefault();
    const v=Object.fromEntries(new FormData(e.currentTarget).entries());
    const btn=q('traySaveBtn');btn.disabled=true;btn.textContent='Guardando...';
    try{
      if(e.currentTarget.dataset.mode==='opening'){
        await api({action:'setOpening',data:{id:uid(),clientId:v.clientId,date:v.date,balance:Number(v.balance||0),notes:v.notes||''}});
      }else{
        await api({action:'movement',data:{id:uid(),clientId:v.clientId,date:v.date,delivered:Number(v.delivered||0),returned:Number(v.returned||0),notes:v.notes||''}});
      }
      modal().hide();await load();if(typeof toast==='function')toast('Movimiento de bandejas guardado');
    }catch(err){alert(err.message||'No se pudo guardar')}finally{btn.disabled=false;btn.textContent='Guardar'}
  }

  async function remove(id){
    const x=state.movements.find(m=>m.id===id);if(!x)return;
    if(!confirm('¿Eliminar este movimiento de bandejas? El saldo del cliente se recalculará.'))return;
    try{await api({action:'deleteMovement',id});await load();if(typeof toast==='function')toast('Movimiento eliminado')}catch(e){alert(e.message)}
  }

  function install(){
    const section=q('section-bandejas');if(!section)return;
    section.innerHTML=`
      <div class="section-toolbar">
        <div><h2 class="section-inline-title">Control de bandejas</h2><p class="muted mb-0">Registro diario según planilla del conductor</p></div>
        <div class="fin-top-actions">
          <button id="trayOpeningBtn" class="secondary-btn"><i class="bi bi-sliders"></i> Ajustar saldo</button>
          <button id="trayNewBtn" class="primary-btn"><i class="bi bi-plus-circle"></i> Registrar movimiento</button>
        </div>
      </div>
      <div id="trayStats" class="mini-stats"></div>
      <div class="section-toolbar">
        <div class="search-control"><i class="bi bi-search"></i><input id="traySearch" placeholder="Buscar cliente"></div>
      </div>
      <div class="card-panel">
        <div class="panel-head"><div><h2>Saldo por cliente</h2><p>Bandejas actualmente en poder de cada cliente</p></div></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Cliente</th><th>Entregadas acum.</th><th>Devueltas acum.</th><th>Saldo</th><th>Último movimiento</th><th></th></tr></thead><tbody id="traysTable"></tbody></table></div>
      </div>
      <div class="card-panel mt-3">
        <div class="panel-head"><div><h2>Historial de movimientos</h2><p>Cada entrega y devolución queda registrada</p></div></div>
        <div class="fin-filter-grid mb-3">
          <select id="trayClientFilter" class="form-select"><option value="">Todos los clientes</option>${clientOptions()}</select>
          <input id="trayDateFrom" type="date" class="form-control">
          <input id="trayDateTo" type="date" class="form-control">
        </div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Entregadas</th><th>Devueltas</th><th>Variación saldo</th><th>Observación</th><th></th></tr></thead><tbody id="trayHistoryTable"></tbody></table></div>
      </div>`;

    if(!q('trayModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`<div class="modal fade" id="trayModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content"><form id="trayForm"><div class="modal-header"><h5 id="trayModalTitle" class="modal-title">Bandejas</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div id="trayModalBody" class="modal-body"></div><div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button><button id="traySaveBtn" type="submit" class="btn btn-warning fw-bold">Guardar</button></div></form></div></div></div>`;
      document.body.appendChild(wrap.firstElementChild);
    }

    q('trayNewBtn').addEventListener('click',()=>openMovement());
    q('trayOpeningBtn').addEventListener('click',()=>openOpening());
    q('trayForm').addEventListener('submit',submit);
    q('traySearch').addEventListener('input',renderBalances);
    q('trayClientFilter').addEventListener('change',renderHistory);
    q('trayDateFrom').addEventListener('change',renderHistory);
    q('trayDateTo').addEventListener('change',renderHistory);
    q('traysTable').addEventListener('click',e=>{
      const add=e.target.closest('[data-tray-add]'),opening=e.target.closest('[data-tray-opening]');
      if(add)openMovement(add.dataset.trayAdd);
      if(opening)openOpening(opening.dataset.trayOpening);
    });
    q('trayHistoryTable').addEventListener('click',e=>{
      const del=e.target.closest('[data-tray-delete]');if(del)remove(del.dataset.trayDelete);
    });
    document.querySelector('[data-section="bandejas"]')?.addEventListener('click',()=>setTimeout(load,0));
    load();
  }

  window.addEventListener('DOMContentLoaded',()=>setTimeout(install,50));
  window.panaderiaBandejas={load,render};
})();
