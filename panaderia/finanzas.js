(() => {
  const API='/api/panaderia/finance';
  const moneyCL=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n||0));
  const dateCL=d=>{if(!d)return 'Sin fecha';const p=String(d).split('-');return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:d};
  const uid=()=>`fin-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const q=id=>document.getElementById(id);
  const safe=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const incoming=['Pago de clientes','Otros ingresos','Aporte de socios','Devoluciones/Reembolsos'];
  const outgoing=['Insumos producción','Sueldos y finiquitos','Pagos extras trabajadores','Petróleo horno','Combustible y transporte reparto','Combustible otros vehículos','Peajes','Mantención vehículos','Instalaciones y mantención','Transporte personal','Impuestos','Servicios profesionales','Arriendo','Retiros','Compras varias','Otros egresos'];
  let finance={movements:[],accounts:[]}, editing=null;

  async function api(body){
    const opt=body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'};
    const r=await fetch(API,opt),data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
    return data;
  }

  function periods(){
    const vals=finance.movements.map(x=>x.period).filter(Boolean);
    vals.push(new Date().toISOString().slice(0,7));
    return [...new Set(vals)].sort().reverse();
  }
  function currentPeriod(){return q('financeMonthFilter')?.value||localStorage.getItem('panaderiaFinanceMonth')||'2026-10'}
  function labelMonth(ym){const [y,m]=ym.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())}

  function calcAccount(name){
    const opening=Number(finance.accounts.find(a=>a.name===name)?.openingBalance||0);
    return finance.movements.reduce((s,x)=>{
      if(x.account!==name)return s;
      if(x.type==='Ingreso')return s+Number(x.amount||0);
      if(x.type==='Egreso')return s-Number(x.amount||0);
      if(x.type==='Transferencia')return s+(x.direction==='Entrada'?Number(x.amount||0):-Number(x.amount||0));
      return s;
    },opening);
  }

  function renderStats(rows){
    const inc=rows.filter(x=>x.type==='Ingreso').reduce((s,x)=>s+Number(x.amount||0),0);
    const out=rows.filter(x=>x.type==='Egreso').reduce((s,x)=>s+Number(x.amount||0),0);
    const net=inc-out;
    const stats=q('financeStats');if(!stats)return;
    stats.innerHTML=`
      <div class="fin-kpi"><span>Ingresos · ${safe(labelMonth(currentPeriod()))}</span><strong class="money-positive">${moneyCL(inc)}</strong><small>${rows.filter(x=>x.type==='Ingreso').length} movimientos</small></div>
      <div class="fin-kpi"><span>Egresos · ${safe(labelMonth(currentPeriod()))}</span><strong class="money-pending">${moneyCL(out)}</strong><small>${rows.filter(x=>x.type==='Egreso').length} movimientos</small></div>
      <div class="fin-kpi"><span>Flujo neto</span><strong class="${net>=0?'money-positive':'money-pending'}">${moneyCL(net)}</strong><small>Ingresos menos egresos</small></div>
      <div class="fin-kpi account"><span><i class="bi bi-cash-stack"></i> Caja Efectivo</span><strong>${moneyCL(calcAccount('Caja Efectivo Panadería'))}</strong><small>Saldo calculado desde registros</small></div>
      <div class="fin-kpi account"><span><i class="bi bi-bank"></i> Banco Santander</span><strong>${moneyCL(calcAccount('Banco Santander'))}</strong><small>Saldo calculado desde registros</small></div>`;
  }

  function filteredRows(){
    const period=currentPeriod(),search=(q('financeSearch')?.value||'').toLowerCase(),type=q('financeTypeFilter')?.value||'',account=q('financeAccountFilter')?.value||'';
    return finance.movements.filter(x=>{
      if(x.period!==period)return false;
      if(type&&x.type!==type)return false;
      if(account&&x.account!==account)return false;
      if(search&&!([x.description,x.category,x.notes,x.account].join(' ').toLowerCase().includes(search)))return false;
      return true;
    }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  }

  function renderCategories(rows){
    const box=q('financeCategories');if(!box)return;
    const map={};
    rows.filter(x=>x.type==='Egreso').forEach(x=>map[x.category||'Sin categoría']=(map[x.category||'Sin categoría']||0)+Number(x.amount||0));
    const list=Object.entries(map).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...list.map(x=>x[1]));
    box.innerHTML=list.length?list.slice(0,8).map(([name,total])=>`
      <div class="fin-cat-row"><div><span>${safe(name)}</span><strong>${moneyCL(total)}</strong></div><div class="fin-bar"><i style="width:${Math.max(4,total/max*100)}%"></i></div></div>`).join(''):'<p class="text-muted mb-0">Sin egresos para este período.</p>';
  }

  function renderTable(rows){
    const tbody=q('financeTable');if(!tbody)return;
    tbody.innerHTML=rows.map(x=>{
      const sign=x.type==='Ingreso'?'+':x.type==='Egreso'?'-':x.direction==='Entrada'?'+':'-';
      const cls=sign==='+'?'money-positive':'money-pending';
      const editable=x.type!=='Transferencia';
      return `<tr>
        <td>${dateCL(x.date)}</td>
        <td><strong>${safe(x.description)}</strong><small class="fin-note">${safe(x.notes||'')}</small></td>
        <td><span class="badge-soft ${x.type==='Ingreso'?'badge-green':x.type==='Egreso'?'badge-yellow':'badge-blue'}">${safe(x.type)}</span></td>
        <td>${safe(x.category||'-')}</td>
        <td>${safe(x.account)}</td>
        <td class="${cls}"><strong>${sign}${moneyCL(x.amount).replace('$','').trim()}</strong></td>
        <td>${safe(x.origin||'Manual')}</td>
        <td class="text-nowrap">${editable?`<button class="icon-btn" data-fin-edit="${safe(x.id)}" title="Editar"><i class="bi bi-pencil"></i></button>`:''}
          <button class="icon-btn" data-fin-delete="${safe(x.id)}" title="Eliminar"><i class="bi bi-trash"></i></button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="8" class="empty-state">No hay movimientos para los filtros seleccionados.</td></tr>';
  }

  function render(){
    const sel=q('financeMonthFilter');
    if(sel){
      const chosen=sel.value||localStorage.getItem('panaderiaFinanceMonth')||'2026-10';
      sel.innerHTML=periods().map(p=>`<option value="${p}" ${p===chosen?'selected':''}>${safe(labelMonth(p))}</option>`).join('');
      if(!sel.value)sel.value=periods()[0]||'2026-10';
      localStorage.setItem('panaderiaFinanceMonth',sel.value);
    }
    const rows=filteredRows();
    renderStats(rows);renderCategories(rows);renderTable(rows);
    const count=q('financeCount');if(count)count.textContent=`${rows.length} movimientos`;
  }

  async function load(){
    try{finance=await api();render()}catch(e){console.error(e);if(typeof toast==='function')toast('No se pudieron cargar Finanzas')}
  }

  function modal(){
    return bootstrap.Modal.getOrCreateInstance(q('financeModal'));
  }
  function categoryOptions(type,selected=''){
    const list=type==='Ingreso'?incoming:outgoing;
    return list.map(x=>`<option ${x===selected?'selected':''}>${safe(x)}</option>`).join('');
  }
  function openMovement(type='Egreso',id=null){
    editing=id?finance.movements.find(x=>x.id===id):null;
    const x=editing||{type,date:new Date().toISOString().slice(0,10),period:currentPeriod(),account:'Banco Santander',method:'Transferencia',category:type==='Ingreso'?'Pago de clientes':'Insumos producción'};
    q('financeModalTitle').textContent=id?'Editar movimiento':type==='Ingreso'?'Registrar ingreso':'Registrar egreso';
    q('financeModalBody').innerHTML=`
      <div class="form-grid">
        <div><label class="form-label">Fecha</label><input name="date" type="date" class="form-control" value="${safe(x.date||'')}"></div>
        <div><label class="form-label">Tipo</label><select name="type" id="finType" class="form-select"><option ${x.type==='Ingreso'?'selected':''}>Ingreso</option><option ${x.type==='Egreso'?'selected':''}>Egreso</option></select></div>
        <div class="full"><label class="form-label">Descripción</label><input name="description" class="form-control" required value="${safe(x.description||'')}" placeholder="Ej. Compra harina"></div>
        <div><label class="form-label">Categoría</label><select name="category" id="finCategory" class="form-select">${categoryOptions(x.type,x.category)}</select></div>
        <div><label class="form-label">Cuenta</label><select name="account" id="finAccount" class="form-select"><option ${x.account==='Banco Santander'?'selected':''}>Banco Santander</option><option ${x.account==='Caja Efectivo Panadería'?'selected':''}>Caja Efectivo Panadería</option></select></div>
        <div><label class="form-label">Monto</label><input name="amount" type="number" min="1" step="1" class="form-control" required value="${Number(x.amount||'')||''}"></div>
        <div><label class="form-label">Medio</label><select name="method" id="finMethod" class="form-select"><option ${x.method==='Transferencia'?'selected':''}>Transferencia</option><option ${x.method==='Efectivo'?'selected':''}>Efectivo</option></select></div>
        <div class="full"><label class="form-label">Notas</label><textarea name="notes" class="form-control" rows="2">${safe(x.notes||'')}</textarea></div>
      </div>`;
    q('finType').addEventListener('change',e=>q('finCategory').innerHTML=categoryOptions(e.target.value));
    q('finAccount').addEventListener('change',e=>{q('finMethod').value=e.target.value==='Caja Efectivo Panadería'?'Efectivo':'Transferencia'});
    modal().show();
  }

  function openTransfer(){
    editing={transfer:true};
    q('financeModalTitle').textContent='Transferir entre cuentas';
    q('financeModalBody').innerHTML=`
      <div class="form-grid">
        <div><label class="form-label">Fecha</label><input name="date" type="date" class="form-control" value="${new Date().toISOString().slice(0,10)}" required></div>
        <div><label class="form-label">Monto</label><input name="amount" type="number" min="1" step="1" class="form-control" required></div>
        <div><label class="form-label">Desde</label><select name="from" class="form-select"><option>Banco Santander</option><option>Caja Efectivo Panadería</option></select></div>
        <div><label class="form-label">Hacia</label><select name="to" class="form-select"><option>Caja Efectivo Panadería</option><option>Banco Santander</option></select></div>
        <div class="full"><label class="form-label">Notas</label><textarea name="notes" class="form-control" rows="2"></textarea></div>
      </div>
      <div class="alert alert-info mt-3 mb-0">La transferencia mueve dinero entre Caja y Santander, pero no cuenta como ingreso ni egreso de la panadería.</div>`;
    modal().show();
  }

  async function submit(e){
    e.preventDefault();const fd=new FormData(e.currentTarget),v=Object.fromEntries(fd.entries()),btn=q('financeSaveBtn');
    btn.disabled=true;btn.textContent='Guardando...';
    try{
      if(editing?.transfer){
        if(v.from===v.to)throw new Error('Las cuentas deben ser distintas');
        await api({action:'transfer',data:{id:uid(),date:v.date,period:currentPeriod(),from:v.from,to:v.to,amount:Number(v.amount),notes:v.notes||''}});
      }else{
        const type=v.type||editing?.type||'Egreso';
        await api({action:'save',data:{id:editing?.id||uid(),date:v.date,period:editing?.period||currentPeriod(),type,description:v.description,category:v.category,account:v.account,method:v.method,amount:Number(v.amount),notes:v.notes||'',origin:editing?.origin||'Manual'}});
      }
      modal().hide();editing=null;await load();if(typeof toast==='function')toast('Movimiento financiero guardado');
    }catch(err){alert(err.message||'No se pudo guardar')}finally{btn.disabled=false;btn.textContent='Guardar'}
  }

  async function remove(id){
    const x=finance.movements.find(r=>r.id===id);if(!x)return;
    if(!confirm(`¿Eliminar "${x.description}" por ${moneyCL(x.amount)}?`))return;
    try{await api({action:'delete',id});await load();if(typeof toast==='function')toast('Movimiento eliminado')}catch(e){alert(e.message)}
  }

  async function opening(account){
    const current=finance.accounts.find(a=>a.name===account)?.openingBalance||0;
    const raw=prompt(`Saldo inicial de ${account}:\nIngresa el monto con el que comenzó el control.`,String(current));
    if(raw===null)return;const amount=Number(String(raw).replace(/[^0-9-]/g,''));
    if(!Number.isFinite(amount))return alert('Monto inválido');
    try{await api({action:'openingBalance',account,amount});await load()}catch(e){alert(e.message)}
  }

  function bind(){
    q('financeMonthFilter')?.addEventListener('change',e=>{localStorage.setItem('panaderiaFinanceMonth',e.target.value);render()});
    q('financeSearch')?.addEventListener('input',render);
    q('financeTypeFilter')?.addEventListener('change',render);
    q('financeAccountFilter')?.addEventListener('change',render);
    q('financeNewIncome')?.addEventListener('click',()=>openMovement('Ingreso'));
    q('financeNewExpense')?.addEventListener('click',()=>openMovement('Egreso'));
    q('financeTransfer')?.addEventListener('click',openTransfer);
    q('financeForm')?.addEventListener('submit',submit);
    q('financeTable')?.addEventListener('click',e=>{
      const edit=e.target.closest('[data-fin-edit]'),del=e.target.closest('[data-fin-delete]');
      if(edit)openMovement('',edit.dataset.finEdit);if(del)remove(del.dataset.finDelete);
    });
    q('financeOpeningCaja')?.addEventListener('click',()=>opening('Caja Efectivo Panadería'));
    q('financeOpeningSantander')?.addEventListener('click',()=>opening('Banco Santander'));
    document.querySelector('[data-section="finanzas"]')?.addEventListener('click',()=>setTimeout(load,0));
  }

  window.addEventListener('DOMContentLoaded',()=>{bind();load()});
  window.panaderiaFinanzas={load,render};
})();
