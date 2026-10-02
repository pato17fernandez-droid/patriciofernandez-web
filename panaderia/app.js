const STORAGE_KEY = 'panaderiaSistemaV1';
const LOGIN_KEY = 'panaderiaLogin';
const EMPTY_DATA = { clients: [], orders: [], guides: [], payments: [], trays: [], ovens: [] };
let db = loadData();
let currentAction = null;
let currentEditId = null;

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0));
const fmtDate = d => { if (!d) return ''; const [y,m,day] = d.split('-'); return `${day}-${m}-${y}`; };
const today = () => new Date().toISOString().slice(0,10);
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const esc = s => String(s ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && typeof saved === 'object' ? saved : structuredClone(EMPTY_DATA);
  } catch {
    return structuredClone(EMPTY_DATA);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  renderAll();
}

function getClient(id) { return db.clients.find(c => c.id === id); }
function orderKg(o) { return Number(o.hallulla||0) + Number(o.marraqueta||0) + Number(o.ciabatta||0); }
function orderProducts(o) {
  return [['Hallulla',o.hallulla],['Marraqueta',o.marraqueta],['Ciabatta',o.ciabatta]]
    .filter(x => Number(x[1]) > 0)
    .map(x => `${x[0]} ${x[1]} kg`).join(' · ') || '-';
}
function guideBalance(g) { return Math.max(0, Number(g.total||0) - Number(g.paid||0)); }
function clientBalance(id) { return db.guides.filter(g=>g.clientId===id).reduce((s,g)=>s+guideBalance(g),0); }
function clientTrayBalance(id) {
  const t = db.trays.find(x=>x.clientId===id);
  return t ? Number(t.delivered||0)-Number(t.returned||0) : 0;
}
function badge(text) {
  const map = {'Pendiente':'badge-yellow','En producción':'badge-blue','Preparado':'badge-blue','Despachado':'badge-gray','Entregado':'badge-green','Pagada':'badge-green','Parcial':'badge-blue','Operativo':'badge-green','Mantención':'badge-yellow','Inactivo':'badge-red'};
  return `<span class="badge-soft ${map[text]||'badge-gray'}">${esc(text)}</span>`;
}
function emptyRow(cols, text='Sin registros') { return `<tr><td colspan="${cols}" class="text-center text-muted py-4">${text}</td></tr>`; }
function stat(icon,label,value,small) { return `<div class="stat-card"><div class="stat-icon"><i class="bi ${icon}"></i></div><div><span>${label}</span><strong>${value}</strong><small>${small}</small></div></div>`; }
function mini(label,val) { return `<div class="mini-stat"><span>${label}</span><strong>${val}</strong></div>`; }
function toast(msg) {
  const n = document.createElement('div');
  n.className = 'toast-msg'; n.textContent = msg; $('toastBox').appendChild(n);
  setTimeout(()=>n.remove(), 3000);
}

function showApp() {
  $('loginView').classList.add('d-none');
  $('appView').classList.remove('d-none');
  navigate('dashboard');
}
function logout() {
  sessionStorage.removeItem(LOGIN_KEY);
  $('appView').classList.add('d-none');
  $('loginView').classList.remove('d-none');
}
function navigate(section) {
  document.querySelectorAll('.app-section').forEach(x=>x.classList.remove('active-section'));
  $('section-'+section).classList.add('active-section');
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.section===section));
  const titles = {
    dashboard:['Panel de control','Resumen general de la operación'], clientes:['Clientes','Registro comercial y operativo'],
    pedidos:['Pedidos','Registro y seguimiento de pedidos'], despachos:['Despachos','Control del avance de entregas'],
    guias:['Guías de despacho','Control documental y estado de pago'], pagos:['Pagos','Abonos y pagos recibidos'],
    bandejas:['Bandejas','Saldos de bandejas por cliente'], hornos:['Hornos','Equipos en comodato'],
    informes:['Informes','Resumen de kilos y cobranza'], configuracion:['Configuración','Opciones del sistema']
  };
  $('pageTitle').textContent = titles[section][0];
  $('pageSubtitle').textContent = titles[section][1];
  document.querySelector('.sidebar')?.classList.remove('open');
  renderAll();
}

function renderDashboard() {
  const td = today();
  const todays = db.orders.filter(o=>o.date===td);
  const kg = todays.reduce((s,o)=>s+orderKg(o),0);
  const receivable = db.guides.reduce((s,g)=>s+guideBalance(g),0);
  $('dashboardStats').innerHTML =
    stat('bi-bag-check','Pedidos de hoy',todays.length,`${todays.filter(o=>o.status==='Pendiente').length} pendientes`) +
    stat('bi-box-seam','Kg pedidos hoy',`${kg.toFixed(2)} kg`,'Total registrado') +
    stat('bi-people','Clientes activos',db.clients.filter(c=>c.active!==false).length,'Con registro activo') +
    stat('bi-cash-stack','Por cobrar',money(receivable),`${db.guides.filter(g=>guideBalance(g)>0).length} guías con saldo`);

  $('dashboardOrders').innerHTML = db.orders.slice().sort((a,b)=>String(b.id).localeCompare(String(a.id))).slice(0,5)
    .map(o=>`<tr><td><strong>${esc(getClient(o.clientId)?.name||'Cliente')}</strong></td><td>${orderKg(o).toFixed(2)} kg</td><td>${fmtDate(o.date)}</td><td>${badge(o.status)}</td></tr>`).join('') || emptyRow(4);

  const pending = db.orders.filter(o=>['Pendiente','En producción','Preparado'].includes(o.status)).length;
  const unpaid = db.guides.filter(g=>guideBalance(g)>0).length;
  const trays = db.trays.filter(t=>Number(t.delivered||0)-Number(t.returned||0)>0).length;
  $('dashboardAlerts').innerHTML = [
    `<div class="alert-item warning"><i class="bi bi-exclamation-triangle"></i><div><strong>${pending} pedidos en proceso</strong><div>Revisar producción y despacho.</div></div></div>`,
    `<div class="alert-item danger"><i class="bi bi-cash"></i><div><strong>${unpaid} guías con saldo</strong><div>Total por cobrar: ${money(receivable)}.</div></div></div>`,
    `<div class="alert-item info"><i class="bi bi-boxes"></i><div><strong>${trays} clientes con bandejas pendientes</strong><div>Revisar devoluciones.</div></div></div>`
  ].join('');
}

function renderClients() {
  const q = ($('clientSearch')?.value||'').toLowerCase();
  const list = db.clients.filter(c=>[c.name,c.rut,c.commune,c.route].some(v=>(v||'').toLowerCase().includes(q)));
  $('clientsTable').innerHTML = list.map(c=>`<tr>
    <td><strong>${esc(c.name)}</strong><div class="text-muted small">${esc(c.contact||'')}</div></td>
    <td>${esc(c.rut||'-')}</td><td>${esc(c.commune||'-')}</td><td>${esc(c.route||'-')}</td>
    <td>${c.oven?badge('Operativo'):badge('Inactivo')}</td>
    <td class="${clientBalance(c.id)>0?'money-pending':'money-positive'}">${money(clientBalance(c.id))}</td>
    <td>${clientTrayBalance(c.id)}</td>
    <td><button class="icon-btn" onclick="openClientDetail('${c.id}')"><i class="bi bi-eye"></i></button> <button class="icon-btn" onclick="editClient('${c.id}')"><i class="bi bi-pencil"></i></button></td>
  </tr>`).join('') || emptyRow(8,'Aún no hay clientes registrados');
}

function renderOrders() {
  const q = ($('orderSearch')?.value||'').toLowerCase(); const f = $('orderStatusFilter')?.value||'';
  const list = db.orders.filter(o=>(getClient(o.clientId)?.name||'').toLowerCase().includes(q)&&(!f||o.status===f));
  $('ordersTable').innerHTML = list.slice().sort((a,b)=>String(b.id).localeCompare(String(a.id))).map(o=>`<tr>
    <td>#${o.id}</td><td><strong>${esc(getClient(o.clientId)?.name||'')}</strong></td><td>${esc(orderProducts(o))}</td>
    <td><strong>${orderKg(o).toFixed(2)} kg</strong></td><td>${fmtDate(o.date)}</td><td>${badge(o.status)}</td>
    <td><button class="icon-btn" onclick="cycleOrderStatus('${o.id}')"><i class="bi bi-arrow-repeat"></i></button> <button class="icon-btn" onclick="editOrder('${o.id}')"><i class="bi bi-pencil"></i></button></td>
  </tr>`).join('') || emptyRow(7,'Aún no hay pedidos registrados');
  const count=s=>db.orders.filter(o=>o.status===s).length;
  $('orderStats').innerHTML = mini('Total',db.orders.length)+mini('Pendientes',count('Pendiente'))+mini('En producción',count('En producción'))+mini('Entregados',count('Entregado'));
}

function renderDispatch() {
  $('dispatchTable').innerHTML = db.orders.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(o=>`<tr>
    <td>#${o.id}</td><td>${esc(getClient(o.clientId)?.name||'')}</td><td>${orderKg(o).toFixed(2)} kg</td><td>${fmtDate(o.date)}</td><td>${badge(o.status)}</td>
    <td><button class="icon-btn" onclick="cycleOrderStatus('${o.id}')"><i class="bi bi-arrow-right-circle"></i> Avanzar</button></td>
  </tr>`).join('') || emptyRow(6,'Aún no hay despachos');
}

function renderGuides() {
  const q = ($('guideSearch')?.value||'').toLowerCase(); const f = $('guideStatusFilter')?.value||'';
  const list = db.guides.filter(g=>((g.number||'').toLowerCase().includes(q)||(getClient(g.clientId)?.name||'').toLowerCase().includes(q))&&(!f||g.status===f));
  $('guidesTable').innerHTML = list.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(g=>`<tr>
    <td><strong>N° ${esc(g.number)}</strong></td><td>${esc(getClient(g.clientId)?.name||'')}</td><td>${fmtDate(g.date)}</td><td>${Number(g.kg||0).toFixed(2)} kg</td>
    <td>${money(g.total)}</td><td>${money(g.paid)}</td><td class="${guideBalance(g)>0?'money-pending':'money-positive'}">${money(guideBalance(g))}</td><td>${badge(g.status)}</td>
    <td><button class="icon-btn" onclick="editGuide('${g.id}')"><i class="bi bi-pencil"></i></button></td>
  </tr>`).join('') || emptyRow(9,'Aún no hay guías registradas');
  const total=db.guides.reduce((s,g)=>s+Number(g.total||0),0), paid=db.guides.reduce((s,g)=>s+Number(g.paid||0),0);
  $('guideStats').innerHTML = mini('Guías',db.guides.length)+mini('Total',money(total))+mini('Pagado',money(paid))+mini('Por cobrar',money(total-paid));
}

function renderPayments() {
  $('paymentsTable').innerHTML = db.payments.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(p=>{
    const g=db.guides.find(x=>x.id===p.guideId);
    return `<tr><td>${fmtDate(p.date)}</td><td>${esc(getClient(p.clientId)?.name||'')}</td><td>${g?'N° '+esc(g.number):'-'}</td><td class="money-positive">${money(p.amount)}</td><td>${esc(p.method||'')}</td><td>${esc(p.notes||'-')}</td></tr>`;
  }).join('') || emptyRow(6,'Aún no hay pagos registrados');
  const paid=db.payments.reduce((s,p)=>s+Number(p.amount||0),0), due=db.guides.reduce((s,g)=>s+guideBalance(g),0);
  $('paymentStats').innerHTML = mini('Pagos',db.payments.length)+mini('Recibido',money(paid))+mini('Por cobrar',money(due))+mini('Guías saldadas',db.guides.filter(g=>guideBalance(g)===0).length);
}

function renderTrays() {
  $('traysTable').innerHTML = db.trays.map(t=>{ const bal=Number(t.delivered||0)-Number(t.returned||0); return `<tr><td><strong>${esc(getClient(t.clientId)?.name||'')}</strong></td><td>${t.delivered||0}</td><td>${t.returned||0}</td><td>${bal}</td><td>${fmtDate(t.last)}</td><td><button class="icon-btn" onclick="openTrayModal('${t.clientId}')"><i class="bi bi-plus-circle"></i></button></td></tr>`; }).join('') || emptyRow(6,'Aún no hay movimientos de bandejas');
}
function renderOvens() {
  $('ovensTable').innerHTML = db.ovens.map(o=>`<tr><td><strong>${esc(getClient(o.clientId)?.name||'')}</strong></td><td>${esc(o.model||'-')}</td><td>${fmtDate(o.installed)}</td><td>${badge(o.status)}</td><td>${esc(o.notes||'-')}</td><td><button class="icon-btn" onclick="editOven('${o.id}')"><i class="bi bi-pencil"></i></button></td></tr>`).join('') || emptyRow(6,'Aún no hay hornos registrados');
}
function renderReports() {
  const totalKg=db.orders.reduce((s,o)=>s+orderKg(o),0), sales=db.guides.reduce((s,g)=>s+Number(g.total||0),0), received=db.payments.reduce((s,p)=>s+Number(p.amount||0),0), due=db.guides.reduce((s,g)=>s+guideBalance(g),0);
  $('reportCards').innerHTML = stat('bi-box-seam','Kg registrados',totalKg.toFixed(2),'Pedidos')+stat('bi-receipt','Total guías',money(sales),'Monto registrado')+stat('bi-cash-coin','Pagos recibidos',money(received),'Histórico')+stat('bi-exclamation-circle','Por cobrar',money(due),'Saldo de guías');
  const byClient=db.clients.map(c=>({name:c.name,kg:db.orders.filter(o=>o.clientId===c.id).reduce((s,o)=>s+orderKg(o),0)})).sort((a,b)=>b.kg-a.kg);
  const max=Math.max(1,...byClient.map(x=>x.kg));
  $('reportClientKg').innerHTML = byClient.length ? byClient.map(x=>`<div class="report-row"><div class="report-row-head"><span>${esc(x.name)}</span><strong>${x.kg.toFixed(2)} kg</strong></div><div class="report-bar"><span style="width:${Math.round(x.kg/max*100)}%"></span></div></div>`).join('') : '<p class="text-muted">Sin datos todavía.</p>';
  const rec=db.clients.map(c=>({name:c.name,balance:clientBalance(c.id)})).filter(x=>x.balance>0).sort((a,b)=>b.balance-a.balance);
  $('reportReceivables').innerHTML = rec.length ? rec.map(x=>`<div class="report-row-head py-2 border-bottom"><span>${esc(x.name)}</span><strong class="money-pending">${money(x.balance)}</strong></div>`).join('') : '<p class="text-muted">No hay saldos pendientes.</p>';
}
function renderAll(){ renderDashboard(); renderClients(); renderOrders(); renderDispatch(); renderGuides(); renderPayments(); renderTrays(); renderOvens(); renderReports(); }

function selectClients(selected='') { return db.clients.filter(c=>c.active!==false).map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${esc(c.name)}</option>`).join(''); }
function selectGuides(selected='') { return db.guides.filter(g=>guideBalance(g)>0 || g.id===selected).map(g=>`<option value="${g.id}" ${g.id===selected?'selected':''}>N° ${esc(g.number)} · ${esc(getClient(g.clientId)?.name||'')} · saldo ${money(guideBalance(g))}</option>`).join(''); }

function openModal(action,id=null) {
  currentAction=action; currentEditId=id;
  let title='', sub='', body='';
  if(action==='client') {
    const c=id?db.clients.find(x=>x.id===id):{}; title=id?'Editar cliente':'Nuevo cliente'; sub='Datos comerciales y operativos';
    body=`<div class="form-grid"><div><label class="form-label">Nombre / Razón social</label><input name="name" class="form-control" value="${esc(c.name||'')}" required></div><div><label class="form-label">RUT</label><input name="rut" class="form-control" value="${esc(c.rut||'')}"></div><div><label class="form-label">Giro</label><input name="business" class="form-control" value="${esc(c.business||'')}"></div><div><label class="form-label">Contacto</label><input name="contact" class="form-control" value="${esc(c.contact||'')}"></div><div><label class="form-label">Teléfono</label><input name="phone" class="form-control" value="${esc(c.phone||'')}"></div><div><label class="form-label">Comuna</label><input name="commune" class="form-control" value="${esc(c.commune||'')}"></div><div><label class="form-label">Ruta</label><input name="route" class="form-control" value="${esc(c.route||'')}"></div><div><label class="form-label">Horno en comodato</label><select name="oven" class="form-select"><option value="false">No</option><option value="true" ${c.oven?'selected':''}>Sí</option></select></div><div class="full"><label class="form-label">Dirección</label><input name="address" class="form-control" value="${esc(c.address||'')}"></div></div>`;
  }
  if(action==='order') {
    const o=id?db.orders.find(x=>String(x.id)===String(id)):{}; title=id?'Editar pedido':'Nuevo pedido'; sub='Productos, kilos y fecha de entrega';
    body=`<div class="form-grid"><div class="full"><label class="form-label">Cliente</label><select name="clientId" class="form-select" required><option value="">Seleccione...</option>${selectClients(o.clientId)}</select></div><div><label class="form-label">Hallulla (kg)</label><input name="hallulla" type="number" step="0.01" min="0" class="form-control" value="${o.hallulla||0}"></div><div><label class="form-label">Marraqueta (kg)</label><input name="marraqueta" type="number" step="0.01" min="0" class="form-control" value="${o.marraqueta||0}"></div><div><label class="form-label">Ciabatta (kg)</label><input name="ciabatta" type="number" step="0.01" min="0" class="form-control" value="${o.ciabatta||0}"></div><div><label class="form-label">Fecha entrega</label><input name="date" type="date" class="form-control" value="${o.date||today()}" required></div><div><label class="form-label">Estado</label><select name="status" class="form-select">${['Pendiente','En producción','Preparado','Despachado','Entregado'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="full"><label class="form-label">Observaciones</label><textarea name="notes" class="form-control">${esc(o.notes||'')}</textarea></div></div>`;
  }
  if(action==='guide') {
    const g=id?db.guides.find(x=>x.id===id):{}; title=id?'Editar guía':'Nueva guía'; sub='Registro de guía de despacho';
    body=`<div class="form-grid"><div><label class="form-label">N° Guía</label><input name="number" class="form-control" value="${esc(g.number||'')}" required></div><div><label class="form-label">Fecha</label><input name="date" type="date" class="form-control" value="${g.date||today()}" required></div><div class="full"><label class="form-label">Cliente</label><select name="clientId" class="form-select" required><option value="">Seleccione...</option>${selectClients(g.clientId)}</select></div><div><label class="form-label">Kg</label><input name="kg" type="number" step="0.01" min="0" class="form-control" value="${g.kg||0}"></div><div><label class="form-label">Monto total</label><input name="total" type="number" min="0" class="form-control" value="${g.total||0}" required></div><div class="full"><label class="form-label">Observaciones</label><textarea name="notes" class="form-control">${esc(g.notes||'')}</textarea></div></div>`;
  }
  if(action==='payment') {
    title='Registrar pago'; sub='Pago o abono a una guía pendiente';
    body=`<div class="form-grid"><div class="full"><label class="form-label">Guía</label><select name="guideId" class="form-select" required><option value="">Seleccione...</option>${selectGuides()}</select></div><div><label class="form-label">Fecha</label><input name="date" type="date" class="form-control" value="${today()}" required></div><div><label class="form-label">Monto</label><input name="amount" type="number" min="1" class="form-control" required></div><div><label class="form-label">Medio de pago</label><select name="method" class="form-select"><option>Transferencia</option><option>Efectivo</option><option>Cheque</option><option>Otro</option></select></div><div class="full"><label class="form-label">Observación</label><textarea name="notes" class="form-control"></textarea></div></div>`;
  }
  if(action==='tray') {
    const t=db.trays.find(x=>x.clientId===id); title='Movimiento de bandejas'; sub='Registrar entrega o devolución';
    body=`<div class="form-grid"><div class="full"><label class="form-label">Cliente</label><select name="clientId" class="form-select" required><option value="">Seleccione...</option>${selectClients(id||'')}</select></div><div><label class="form-label">Bandejas entregadas</label><input name="delivered" type="number" min="0" class="form-control" value="0"></div><div><label class="form-label">Bandejas devueltas</label><input name="returned" type="number" min="0" class="form-control" value="0"></div><div><label class="form-label">Fecha</label><input name="last" type="date" class="form-control" value="${today()}" required></div><div class="full"><small class="text-muted">Saldo actual: ${t?Number(t.delivered||0)-Number(t.returned||0):0}</small></div></div>`;
  }
  if(action==='oven') {
    const o=id?db.ovens.find(x=>x.id===id):{}; title=id?'Editar horno':'Registrar horno'; sub='Equipo instalado en comodato';
    body=`<div class="form-grid"><div class="full"><label class="form-label">Cliente</label><select name="clientId" class="form-select" required><option value="">Seleccione...</option>${selectClients(o.clientId)}</select></div><div><label class="form-label">Modelo</label><input name="model" class="form-control" value="${esc(o.model||'')}"></div><div><label class="form-label">Fecha instalación</label><input name="installed" type="date" class="form-control" value="${o.installed||today()}"></div><div><label class="form-label">Estado</label><select name="status" class="form-select">${['Operativo','Mantención','Inactivo'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="full"><label class="form-label">Observaciones</label><textarea name="notes" class="form-control">${esc(o.notes||'')}</textarea></div></div>`;
  }
  $('modalTitle').textContent=title; $('modalSubtitle').textContent=sub; $('modalBody').innerHTML=body; $('modalSubmit').classList.remove('d-none');
  bootstrap.Modal.getOrCreateInstance($('entityModal')).show();
}

function saveModal(e) {
  e.preventDefault(); const fd=new FormData(e.target); const v=Object.fromEntries(fd.entries());
  if(currentAction==='client') {
    const obj={id:currentEditId||uid('c'),name:v.name,rut:v.rut,business:v.business,address:v.address,commune:v.commune,phone:v.phone,contact:v.contact,route:v.route,oven:v.oven==='true',active:true};
    db.clients=currentEditId?db.clients.map(x=>x.id===currentEditId?obj:x):[...db.clients,obj]; toast('Cliente guardado');
  }
  if(currentAction==='order') {
    const total=Number(v.hallulla||0)+Number(v.marraqueta||0)+Number(v.ciabatta||0); if(total<=0){alert('Ingresa al menos un producto.');return;}
    const obj={id:currentEditId||Date.now().toString().slice(-6),clientId:v.clientId,hallulla:Number(v.hallulla||0),marraqueta:Number(v.marraqueta||0),ciabatta:Number(v.ciabatta||0),date:v.date,status:v.status,notes:v.notes};
    db.orders=currentEditId?db.orders.map(x=>String(x.id)===String(currentEditId)?obj:x):[...db.orders,obj]; toast('Pedido guardado');
  }
  if(currentAction==='guide') {
    const existing=currentEditId?db.guides.find(x=>x.id===currentEditId):null;
    const paid=existing?.paid||0; const total=Number(v.total||0); const status=paid<=0?'Pendiente':paid<total?'Parcial':'Pagada';
    const obj={id:currentEditId||uid('g'),number:v.number,clientId:v.clientId,date:v.date,kg:Number(v.kg||0),total,paid,status,notes:v.notes};
    db.guides=currentEditId?db.guides.map(x=>x.id===currentEditId?obj:x):[...db.guides,obj]; toast('Guía guardada');
  }
  if(currentAction==='payment') {
    const g=db.guides.find(x=>x.id===v.guideId); if(!g)return;
    const amount=Math.min(Number(v.amount||0),guideBalance(g)); if(amount<=0){alert('Ingresa un monto válido.');return;}
    db.payments.push({id:uid('p'),guideId:g.id,clientId:g.clientId,date:v.date,amount,method:v.method,notes:v.notes});
    g.paid=Number(g.paid||0)+amount; g.status=guideBalance(g)<=0?'Pagada':'Parcial'; toast('Pago registrado');
  }
  if(currentAction==='tray') {
    const clientId=v.clientId; let t=db.trays.find(x=>x.clientId===clientId); if(!t){t={clientId,delivered:0,returned:0,last:v.last};db.trays.push(t);} t.delivered=Number(t.delivered||0)+Number(v.delivered||0); t.returned=Number(t.returned||0)+Number(v.returned||0); t.last=v.last; toast('Movimiento de bandejas registrado');
  }
  if(currentAction==='oven') {
    const obj={id:currentEditId||uid('o'),clientId:v.clientId,model:v.model,installed:v.installed,status:v.status,notes:v.notes};
    db.ovens=currentEditId?db.ovens.map(x=>x.id===currentEditId?obj:x):[...db.ovens,obj]; const c=getClient(v.clientId); if(c)c.oven=v.status!=='Inactivo'; toast('Horno guardado');
  }
  saveData(); bootstrap.Modal.getInstance($('entityModal')).hide();
}

function editClient(id){openModal('client',id)}
function editOrder(id){openModal('order',id)}
function editGuide(id){openModal('guide',id)}
function openTrayModal(id){openModal('tray',id)}
function editOven(id){openModal('oven',id)}
function cycleOrderStatus(id){const o=db.orders.find(x=>String(x.id)===String(id));if(!o)return;const states=['Pendiente','En producción','Preparado','Despachado','Entregado'];o.status=states[(states.indexOf(o.status)+1)%states.length];saveData();toast(`Pedido #${id}: ${o.status}`)}
function openClientDetail(id){const c=getClient(id);if(!c)return;const orders=db.orders.filter(o=>o.clientId===id),guides=db.guides.filter(g=>g.clientId===id);$('modalTitle').textContent=c.name;$('modalSubtitle').textContent='Ficha del cliente';$('modalBody').innerHTML=`<div class="detail-grid"><div><small>RUT</small><strong>${esc(c.rut||'-')}</strong></div><div><small>Comuna</small><strong>${esc(c.commune||'-')}</strong></div><div><small>Ruta</small><strong>${esc(c.route||'-')}</strong></div><div><small>Horno</small><strong>${c.oven?'Sí':'No'}</strong></div><div><small>Pedidos</small><strong>${orders.length}</strong></div><div><small>Kg acumulados</small><strong>${orders.reduce((s,o)=>s+orderKg(o),0).toFixed(2)} kg</strong></div><div><small>Saldo guías</small><strong class="money-pending">${money(clientBalance(id))}</strong></div><div><small>Saldo bandejas</small><strong>${clientTrayBalance(id)}</strong></div></div><hr><h6>Guías del cliente</h6>${guides.map(g=>`<div class="report-row-head py-2 border-bottom"><span>N° ${esc(g.number)} · ${fmtDate(g.date)}</span><span>${money(guideBalance(g))} ${badge(g.status)}</span></div>`).join('')||'<p class="text-muted">Sin guías registradas.</p>'}`;$('modalSubmit').classList.add('d-none');bootstrap.Modal.getOrCreateInstance($('entityModal')).show();$('entityModal').addEventListener('hidden.bs.modal',()=>$('modalSubmit').classList.remove('d-none'),{once:true});}

function exportData(){const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='panaderia-respaldo.json';a.click();URL.revokeObjectURL(a.href)}
function resetData(){if(!confirm('¿Seguro que quieres borrar todos los registros guardados en este navegador?'))return;db=structuredClone(EMPTY_DATA);saveData();toast('Registros eliminados')}

document.addEventListener('DOMContentLoaded',()=>{
  $('loginForm').addEventListener('submit',e=>{e.preventDefault();if($('loginUser').value==='admin'&&$('loginPass').value==='panaderia123'){sessionStorage.setItem(LOGIN_KEY,'1');$('loginError').classList.add('d-none');showApp()}else $('loginError').classList.remove('d-none')});
  if(sessionStorage.getItem(LOGIN_KEY)==='1')showApp();
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.section)));
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.action;if(a==='new-order')openModal('order');if(a==='new-client')openModal('client');if(a==='new-guide')openModal('guide');if(a==='new-payment')openModal('payment');if(a==='new-tray')openModal('tray');if(a==='new-oven')openModal('oven')}));
  $('entityForm').addEventListener('submit',saveModal); $('logoutBtn').addEventListener('click',logout); $('mobileMenuBtn').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
  $('clientSearch').addEventListener('input',renderClients); $('orderSearch').addEventListener('input',renderOrders); $('orderStatusFilter').addEventListener('change',renderOrders); $('guideSearch').addEventListener('input',renderGuides); $('guideStatusFilter').addEventListener('change',renderGuides);
  $('exportBtn').addEventListener('click',exportData); $('resetBtn').addEventListener('click',resetData); renderAll();
});