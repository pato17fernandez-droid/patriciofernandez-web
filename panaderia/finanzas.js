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
    const inc=rows.filter(x=>x.type==='Ingreso'&&x.affectsFlow!==false).reduce((s,x)=>s+Number(x.amount||0),0);
    const operatingOut=rows.filter(x=>x.type==='Egreso'&&x.affectsFlow!==false).reduce((s,x)=>s+Number(x.amount||0),0);
    const excludedIn=rows.filter(x=>x.type==='Ingreso'&&x.affectsFlow===false).reduce((s,x)=>s+Number(x.amount||0),0);
    const excludedOut=rows.filter(x=>x.type==='Egreso'&&x.affectsFlow===false).reduce((s,x)=>s+Number(x.amount||0),0);
    const net=inc-operatingOut;
    const stats=q('financeStats');if(!stats)return;
    stats.innerHTML=`
      <div class="fin-kpi"><span>Ingresos operacionales · ${safe(labelMonth(currentPeriod()))}</span><strong class="money-positive">${moneyCL(inc)}</strong><small>${excludedIn?moneyCL(excludedIn)+' fuera del flujo neto':rows.filter(x=>x.type==='Ingreso'&&x.affectsFlow!==false).length+' movimientos'}</small></div>
      <div class="fin-kpi"><span>Egresos operacionales · ${safe(labelMonth(currentPeriod()))}</span><strong class="money-pending">${moneyCL(operatingOut)}</strong><small>${excludedOut?moneyCL(excludedOut)+' fuera del flujo neto':'Sin egresos excluidos'}</small></div>
      <div class="fin-kpi"><span>Flujo neto operacional</span><strong class="${net>=0?'money-positive':'money-pending'}">${moneyCL(net)}</strong><small>No descuenta cheques/gastos marcados como automáticos</small></div>
      <div class="fin-kpi account"><span><i class="bi bi-cash-stack"></i> Caja Efectivo</span><strong>${moneyCL(calcAccount('Caja Efectivo Panadería'))}</strong><small>Saldo real: incluye todos los movimientos</small></div>
      <div class="fin-kpi account"><span><i class="bi bi-bank"></i> Banco Santander</span><strong>${moneyCL(calcAccount('Banco Santander'))}</strong><small>Saldo real: incluye cheques y gastos automáticos</small></div>`;
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
    rows.filter(x=>x.type==='Egreso'&&x.affectsFlow!==false).forEach(x=>map[x.category||'Sin categoría']=(map[x.category||'Sin categoría']||0)+Number(x.amount||0));
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
        <td><strong>${safe(x.description)}</strong>${(x.type==='Ingreso'||x.type==='Egreso')&&x.affectsFlow===false?'<small class="fin-note"><span class="badge-soft badge-blue">Fuera del flujo neto</span></small>':''}<small class="fin-note">${safe(x.notes||'')}</small></td>
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
        <div class="full" id="finFlowWrap">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" name="excludeFlow" id="finExcludeFlow" ${x.affectsFlow===false?'checked':''}>
            <label class="form-check-label" for="finExcludeFlow"><strong>Excluir del flujo neto operacional</strong></label>
          </div>
          <small class="text-muted">Sirve tanto para ingresos como para egresos que quieras excluir del resultado operacional. El movimiento igual afecta el saldo real de Caja o Banco Santander.</small>
        </div>
      </div>`;
    const syncFlowOption=()=>{const wrap=q('finFlowWrap');if(wrap)wrap.style.display='block'};
    q('finType').addEventListener('change',e=>{q('finCategory').innerHTML=categoryOptions(e.target.value);syncFlowOption()});
    syncFlowOption();
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
        await api({action:'save',data:{id:editing?.id||uid(),date:v.date,period:editing?.period||currentPeriod(),type,description:v.description,category:v.category,account:v.account,method:v.method,amount:Number(v.amount),notes:v.notes||'',origin:editing?.origin||'Manual',affectsFlow:v.excludeFlow!=='on'}});
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


  function calcAccountAtPeriod(name,period){
    const opening=Number(finance.accounts.find(a=>a.name===name)?.openingBalance||0);
    return finance.movements.reduce((s,x)=>{
      if(x.account!==name||String(x.period||'')>period)return s;
      if(x.type==='Ingreso')return s+Number(x.amount||0);
      if(x.type==='Egreso')return s-Number(x.amount||0);
      if(x.type==='Transferencia')return s+(x.direction==='Entrada'?Number(x.amount||0):-Number(x.amount||0));
      return s;
    },opening);
  }

  function categoryMap(rows,type,affects=true){
    const map={};
    rows.filter(x=>x.type===type&&(affects===null||x.affectsFlow!==false===affects)).forEach(x=>{
      const k=x.category||'Sin categoría';
      map[k]=(map[k]||0)+Number(x.amount||0);
    });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  }

  function reportBars(entries,total){
    if(!entries.length)return '<p class="muted">Sin movimientos en esta categoría.</p>';
    const max=Math.max(1,...entries.map(x=>x[1]));
    return entries.map(([name,value])=>`
      <div class="chart-row"><div class="chart-label"><span>${safe(name)}</span><strong>${moneyCL(value)}</strong></div>
      <div class="bar-track"><i style="width:${Math.max(3,value/max*100)}%"></i></div>
      <small>${total?((value/total)*100).toFixed(1):'0.0'}% del total</small></div>`).join('');
  }

  function dailyFlowSvg(rows){
    const dayMap={};
    rows.filter(x=>x.affectsFlow!==false&&(x.type==='Ingreso'||x.type==='Egreso')).forEach(x=>{
      const d=x.date||'Sin fecha';
      dayMap[d]=(dayMap[d]||0)+(x.type==='Ingreso'?Number(x.amount||0):-Number(x.amount||0));
    });
    const pts=Object.entries(dayMap).filter(([d])=>d!=='Sin fecha').sort((a,b)=>a[0].localeCompare(b[0]));
    if(!pts.length)return '<p class="muted">Sin datos diarios para graficar.</p>';
    let accum=0;
    const values=pts.map(([d,v])=>[d,accum+=v]);
    const min=Math.min(0,...values.map(x=>x[1])),max=Math.max(0,...values.map(x=>x[1]));
    const range=Math.max(1,max-min),w=760,h=230,pad=34;
    const xy=values.map((x,i)=>{
      const px=pad+(values.length===1?(w-2*pad)/2:i*(w-2*pad)/(values.length-1));
      const py=pad+(max-x[1])*(h-2*pad)/range;
      return [px,py,x[0],x[1]];
    });
    const zeroY=pad+(max-0)*(h-2*pad)/range;
    const poly=xy.map(x=>x[0].toFixed(1)+','+x[1].toFixed(1)).join(' ');
    const labels=xy.filter((_,i)=>i===0||i===xy.length-1||i===Math.floor(xy.length/2)).map(x=>`
      <text x="${x[0]}" y="${h-8}" text-anchor="middle" font-size="11" fill="#68707d">${x[2].slice(8,10)}/${x[2].slice(5,7)}</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolución acumulada del flujo operacional">
      <line x1="${pad}" y1="${zeroY}" x2="${w-pad}" y2="${zeroY}" stroke="#d8dde5" stroke-width="1"/>
      <polyline points="${poly}" fill="none" stroke="#b7791f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      ${xy.map(x=>`<circle cx="${x[0]}" cy="${x[1]}" r="4" fill="#b7791f"><title>${x[2]}: ${moneyCL(x[3])}</title></circle>`).join('')}
      ${labels}
    </svg>`;
  }

  function generateFinanceReport(){
    const period=currentPeriod();
    const rows=(finance.movements||[]).filter(x=>x.period===period).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    const opIncome=rows.filter(x=>x.type==='Ingreso'&&x.affectsFlow!==false);
    const opExpense=rows.filter(x=>x.type==='Egreso'&&x.affectsFlow!==false);
    const excluded=rows.filter(x=>(x.type==='Ingreso'||x.type==='Egreso')&&x.affectsFlow===false);
    const inc=opIncome.reduce((s,x)=>s+Number(x.amount||0),0);
    const out=opExpense.reduce((s,x)=>s+Number(x.amount||0),0);
    const excludedIn=excluded.filter(x=>x.type==='Ingreso').reduce((s,x)=>s+Number(x.amount||0),0);
    const excludedOut=excluded.filter(x=>x.type==='Egreso').reduce((s,x)=>s+Number(x.amount||0),0);
    const net=inc-out;
    const inCats=categoryMap(rows,'Ingreso',true);
    const outCats=categoryMap(rows,'Egreso',true);
    const caja=calcAccountAtPeriod('Caja Efectivo Panadería',period);
    const banco=calcAccountAtPeriod('Banco Santander',period);
    const transfers=rows.filter(x=>x.type==='Transferencia');
    const transferAmount=transfers.filter(x=>x.direction==='Salida').reduce((s,x)=>s+Number(x.amount||0),0);
    const generated=new Date().toLocaleString('es-CL');
    const detailRows=rows.filter(x=>x.type!=='Transferencia'||x.direction==='Salida');

    const w=window.open('','_blank');
    if(!w){alert('El navegador bloqueó la ventana del informe. Habilita ventanas emergentes para esta página.');return;}
    w.document.open();
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe Finanzas - ${safe(labelMonth(period))}</title>
    <style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;background:#eef1f5}.page{max-width:1120px;margin:24px auto;background:#fff;padding:38px;border-radius:18px}
      h1{margin:0;font-size:30px}.sub{color:#667085;margin:6px 0 24px}.head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #e5a900;padding-bottom:20px}
      .brand{font-weight:800;font-size:18px}.actions{display:flex;gap:8px}.btn{border:0;border-radius:10px;padding:10px 15px;font-weight:700;cursor:pointer}.print{background:#f5b800}.close{background:#eef1f5}
      .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0}.kpi{border:1px solid #e4e7ec;border-radius:14px;padding:15px}.kpi span{display:block;color:#667085;font-size:12px}.kpi strong{display:block;font-size:22px;margin-top:5px}.good{color:#067647}.bad{color:#b42318}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{border:1px solid #e4e7ec;border-radius:14px;padding:18px;margin-bottom:16px;break-inside:avoid}.card h2{font-size:18px;margin:0 0 4px}.muted{color:#667085;font-size:12px}
      .chart-row{margin:12px 0}.chart-label{display:flex;justify-content:space-between;gap:15px;font-size:13px}.bar-track{height:9px;background:#edf0f3;border-radius:20px;overflow:hidden;margin:5px 0}.bar-track i{display:block;height:100%;background:#d49a00;border-radius:20px}
      svg{width:100%;height:auto;display:block}.accounts{display:grid;grid-template-columns:1fr 1fr;gap:12px}.account{background:#f8fafc;border-radius:12px;padding:15px}.account span{color:#667085;font-size:12px}.account strong{display:block;font-size:21px;margin-top:4px}
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{text-align:left;padding:8px;border-bottom:1px solid #e7eaf0;vertical-align:top}th{background:#f8fafc}.amount{text-align:right;white-space:nowrap}
      .badge{display:inline-block;padding:3px 7px;border-radius:999px;background:#eef2f6;font-size:10px}.note{background:#fff8e6;border-left:4px solid #e5a900;padding:10px 12px;margin-top:12px;font-size:12px}
      footer{margin-top:24px;color:#98a2b3;font-size:10px;text-align:center}.section-title{margin:26px 0 10px;font-size:21px}
      @media(max-width:760px){.page{margin:0;padding:18px;border-radius:0}.kpis,.grid,.accounts{grid-template-columns:1fr}.actions{position:sticky;top:8px}.head{display:block}.actions{margin-top:12px}}
      @media print{body{background:#fff}.page{max-width:none;margin:0;padding:12mm;border-radius:0}.actions{display:none}.card{break-inside:avoid}.section-title{break-after:avoid}@page{size:A4;margin:9mm}}
    </style></head><body><main class="page">
      <div class="head"><div><div class="brand">NOVABAKE · Panadería</div><h1>Informe mensual de Finanzas</h1><p class="sub">${safe(labelMonth(period))} · Generado ${safe(generated)}</p></div>
      <div class="actions"><button class="btn close" onclick="window.close()">Cerrar</button><button class="btn print" onclick="window.print()">Imprimir / Guardar PDF</button></div></div>

      <div class="kpis">
        <div class="kpi"><span>Ingresos operacionales</span><strong class="good">${moneyCL(inc)}</strong><small>${opIncome.length} movimientos</small></div>
        <div class="kpi"><span>Egresos operacionales</span><strong class="bad">${moneyCL(out)}</strong><small>${opExpense.length} movimientos</small></div>
        <div class="kpi"><span>Flujo neto operacional</span><strong class="${net>=0?'good':'bad'}">${moneyCL(net)}</strong><small>Ingresos menos egresos operacionales</small></div>
        <div class="kpi"><span>Ingresos fuera del flujo</span><strong>${moneyCL(excludedIn)}</strong><small>No afectan el resultado operacional</small></div>
        <div class="kpi"><span>Egresos fuera del flujo</span><strong>${moneyCL(excludedOut)}</strong><small>Igualmente afectan el saldo real</small></div>
        <div class="kpi"><span>Transferencias internas</span><strong>${moneyCL(transferAmount)}</strong><small>No son ingreso ni egreso</small></div>
      </div>

      <div class="card"><h2>Posición de Caja y Banco al cierre del período</h2><p class="muted">Saldos reales considerando todos los movimientos registrados hasta ${safe(labelMonth(period))}.</p>
        <div class="accounts"><div class="account"><span>Caja Efectivo Panadería</span><strong>${moneyCL(caja)}</strong></div><div class="account"><span>Banco Santander</span><strong>${moneyCL(banco)}</strong></div></div>
      </div>

      <div class="grid">
        <div class="card"><h2>Distribución de egresos operacionales</h2><p class="muted">Principales categorías del mes.</p>${reportBars(outCats,out)}</div>
        <div class="card"><h2>Distribución de ingresos operacionales</h2><p class="muted">Origen de los ingresos que sí participan del flujo.</p>${reportBars(inCats,inc)}</div>
      </div>

      <div class="card"><h2>Evolución del flujo operacional</h2><p class="muted">Acumulado diario de ingresos menos egresos operacionales dentro del mes.</p>${dailyFlowSvg(rows)}</div>

      <h2 class="section-title">Movimientos fuera del flujo operacional</h2>
      <div class="card"><p class="muted">Movimientos reales que afectan Caja o Banco, pero fueron marcados para no distorsionar el resultado operacional.</p>
        ${excluded.length?`<table><thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Cuenta</th><th class="amount">Monto</th></tr></thead><tbody>${excluded.map(x=>`<tr><td>${dateCL(x.date)}</td><td>${safe(x.description)}</td><td>${safe(x.type)}</td><td>${safe(x.account)}</td><td class="amount">${moneyCL(x.amount)}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">No hubo movimientos excluidos en este período.</p>'}
      </div>

      <h2 class="section-title">Detalle de movimientos del mes</h2>
      <div class="card"><table><thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Categoría</th><th>Cuenta</th><th class="amount">Monto</th><th>Condición</th></tr></thead>
        <tbody>${detailRows.map(x=>`<tr><td>${dateCL(x.date)}</td><td>${safe(x.description||'Transferencia interna')}</td><td>${safe(x.type)}</td><td>${safe(x.category||'-')}</td><td>${safe(x.account)}</td><td class="amount">${moneyCL(x.amount)}</td><td><span class="badge">${x.type==='Transferencia'?'Interna':x.affectsFlow===false?'Fuera del flujo':'Operacional'}</span></td></tr>`).join('')||'<tr><td colspan="7">Sin movimientos en el período.</td></tr>'}
      </table></div>

      <div class="note"><strong>Lectura del informe:</strong> el flujo neto operacional es un indicador de gestión. Los movimientos marcados “Fuera del flujo” no se incorporan a ese resultado, pero sí modifican los saldos reales de Caja o Banco.</div>
      <footer>Informe generado desde el Sistema de Gestión NOVABAKE · ${safe(labelMonth(period))}</footer>
    </main></body></html>`);
    w.document.close();
    w.focus();
  }

  function bind(){
    q('financeMonthFilter')?.addEventListener('change',e=>{localStorage.setItem('panaderiaFinanceMonth',e.target.value);render()});
    q('financeSearch')?.addEventListener('input',render);
    q('financeTypeFilter')?.addEventListener('change',render);
    q('financeAccountFilter')?.addEventListener('change',render);
    q('financeNewIncome')?.addEventListener('click',()=>openMovement('Ingreso'));
    q('financeNewExpense')?.addEventListener('click',()=>openMovement('Egreso'));
    q('financeTransfer')?.addEventListener('click',openTransfer);
    q('financeReport')?.addEventListener('click',generateFinanceReport);
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
  window.panaderiaFinanzas={load,render,generateReport:generateFinanceReport};
})();
