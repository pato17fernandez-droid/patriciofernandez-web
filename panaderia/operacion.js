(() => {
  const byId = id => document.getElementById(id);
  const currentMonth = () => new Date().toISOString().slice(0,7);
  const MONTH_KEY = 'panaderiaMesTrabajo';
  const formatMonth = ym => {
    if (!ym) return '';
    const [y,m] = ym.split('-').map(Number);
    return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
  };
  const fmtKg = n => Number(n||0).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:3});

  let guideMonth = localStorage.getItem(MONTH_KEY) || currentMonth();

  function availableMonths(){
    const values=[];
    (db.guides||[]).forEach(g=>{ const m=(g.date||'').slice(0,7); if(m) values.push(m); });
    (db.history||[]).forEach(h=>{ const m=(h.date||'').slice(0,7); if(m) values.push(m); });
    values.push(currentMonth());
    return [...new Set(values)].sort().reverse();
  }

  function setWorkingMonth(month){
    if(!month) return;
    guideMonth=month;
    localStorage.setItem(MONTH_KEY,month);
    const top=byId('workingMonthFilter'); if(top) top.value=month;
    const guides=byId('guideMonthFilter'); if(guides) guides.value=month;
    try{ renderAll(); }catch(e){ console.warn(e); }
  }
  window.setPanaderiaMonth=setWorkingMonth;

  function installWorkingMonthFilter(){
    const topbar=document.querySelector('.topbar');
    if(!topbar || byId('workingMonthFilter')) return;
    const wrap=document.createElement('div');
    wrap.className='d-flex align-items-center gap-2 ms-auto me-3';
    wrap.innerHTML='<span class="small text-muted d-none d-md-inline">Mes de trabajo</span><select id="workingMonthFilter" class="form-select compact-select" style="min-width:170px"></select>';
    const user=topbar.querySelector('.user-block');
    topbar.insertBefore(wrap,user||null);
    byId('workingMonthFilter').addEventListener('change',e=>setWorkingMonth(e.target.value));
    refreshMonthSelectors();
  }

  function hideOrdersModule(){
    document.querySelector('[data-section="pedidos"]')?.remove();
    byId('section-pedidos')?.remove();
    document.querySelectorAll('[data-action="new-order"]').forEach(el=>el.remove());
  }

  function installGuideMonthFilter(){
    const section = byId('section-guias');
    if (!section || byId('guideMonthFilter')) return;
    const toolbar = section.querySelector('.section-toolbar');
    if (!toolbar) return;
    const select = document.createElement('select');
    select.id = 'guideMonthFilter';
    select.className = 'form-select compact-select';
    select.addEventListener('change',()=>setWorkingMonth(select.value));
    const filterRow = toolbar.querySelector('.filter-row');
    (filterRow || toolbar).appendChild(select);
    refreshMonthSelectors();
  }

  function refreshMonthSelectors(){
    const months=availableMonths();
    if(!months.includes(guideMonth)) guideMonth=months[0]||currentMonth();
    localStorage.setItem(MONTH_KEY,guideMonth);
    const options=months.map(m=>`<option value="${m}" ${m===guideMonth?'selected':''}>${formatMonth(m)}</option>`).join('');
    const a=byId('guideMonthFilter'); if(a) a.innerHTML=options;
    const b=byId('workingMonthFilter'); if(b) b.innerHTML=options;
  }

  function monthGuides(){ return (db.guides||[]).filter(g=>(g.date||'').slice(0,7)===guideMonth); }
  function balanceForClientMonth(id){ return monthGuides().filter(g=>g.clientId===id).reduce((s,g)=>s+guideBalance(g),0); }

  function markGuidePaid(id){
    const g = (db.guides||[]).find(x=>x.id===id);
    if (!g) return;
    const balance = Math.max(0, Number(g.total||0)-Number(g.paid||0));
    if (balance <= 0) { if (typeof toast === 'function') toast(`Guía N° ${g.number} ya está pagada`); return; }
    if (!confirm(`¿Marcar la guía N° ${g.number} como pagada por ${money(balance)}?`)) return;
    g.paid = Number(g.total||0);
    g.status = 'Pagada';
    db.payments = db.payments || [];
    db.payments.unshift({ id: uid('pay'), guideId: g.id, clientId: g.clientId, date: today(), amount: balance, method: 'Pago total', notes: `Guía ${formatMonth((g.date||'').slice(0,7))} marcada como pagada` });
    saveData();
    if (typeof toast === 'function') toast(`Guía N° ${g.number} marcada como pagada`);
  }
  window.markGuidePaid = markGuidePaid;

  function enhancedRenderGuides(){
    if (!byId('guidesTable')) return;
    refreshMonthSelectors();
    const q=(byId('guideSearch')?.value||'').toLowerCase();
    const f=byId('guideStatusFilter')?.value||'';
    const list=monthGuides().filter(g=>{
      const matchText=(String(g.number||'').toLowerCase().includes(q)||(getClient(g.clientId)?.name||'').toLowerCase().includes(q));
      const matchStatus=!f||g.status===f;
      return matchText&&matchStatus;
    });
    byId('guidesTable').innerHTML=list.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(g=>{
      const bal=guideBalance(g);
      const action=bal>0 ? `<button class="primary-btn pay-guide-btn" onclick="markGuidePaid('${g.id}')"><i class="bi bi-check2-circle"></i> Marcar pagada</button>` : `<span class="badge-soft badge-green"><i class="bi bi-check2"></i> Pagada</span>`;
      return `<tr><td><strong>N° ${esc(g.number)}</strong></td><td>${esc(getClient(g.clientId)?.name||'')}</td><td>${fmtDate(g.date)}</td><td>${fmtKg(g.kg)} kg</td><td>${money(g.total)}</td><td>${money(g.paid)}</td><td class="${bal>0?'money-pending':'money-positive'}">${money(bal)}</td><td>${badge(g.status)}</td><td>${action} <button class="icon-btn" onclick="editGuide('${g.id}')" title="Editar"><i class="bi bi-pencil"></i></button></td></tr>`;
    }).join('')||emptyRow(9,`No hay guías en ${formatMonth(guideMonth)}`);
    const total=list.reduce((s,g)=>s+Number(g.total||0),0), paid=list.reduce((s,g)=>s+Number(g.paid||0),0);
    byId('guideStats').innerHTML=mini(`Guías · ${formatMonth(guideMonth)}`,list.length)+mini('Total del mes',money(total))+mini('Pagado del mes',money(paid))+mini('Por cobrar del mes',money(Math.max(0,total-paid)));
  }

  function enhancedRenderPayments(){
    if(!byId('paymentsTable')) return;
    const guides=monthGuides();
    const guideIds=new Set(guides.map(g=>g.id));
    const list=(db.payments||[]).filter(p=>guideIds.has(p.guideId));
    byId('paymentsTable').innerHTML=list.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(p=>{
      const g=(db.guides||[]).find(x=>x.id===p.guideId);
      return `<tr><td>${fmtDate(p.date)}</td><td>${esc(getClient(p.clientId)?.name||'')}</td><td>${g?'N° '+esc(g.number):'-'}</td><td class="money-positive">${money(p.amount)}</td><td>${esc(p.method||'')}</td><td>${esc(p.notes||'-')}</td></tr>`;
    }).join('')||emptyRow(6,`No hay pagos asociados a guías de ${formatMonth(guideMonth)}`);
    const received=list.reduce((s,p)=>s+Number(p.amount||0),0);
    const due=guides.reduce((s,g)=>s+guideBalance(g),0);
    byId('paymentStats').innerHTML=mini(`Pagos · ${formatMonth(guideMonth)}`,list.length)+mini('Recibido del mes',money(received))+mini('Por cobrar del mes',money(due))+mini('Guías saldadas',guides.filter(g=>guideBalance(g)===0&&Number(g.total||0)>0).length);
  }

  function enhancedDashboard(){
    if (!byId('dashboardStats')) return;
    refreshMonthSelectors();
    const guides=monthGuides();
    const td=today();
    const todayGuides=guides.filter(g=>g.date===td);
    const monthKg=guides.reduce((s,g)=>s+Number(g.kg||0),0);
    const receivable=guides.reduce((s,g)=>s+guideBalance(g),0);
    byId('dashboardStats').innerHTML=
      stat('bi-calendar3','Mes seleccionado',formatMonth(guideMonth),'Todo el resumen corresponde solo a este mes')+
      stat('bi-file-earmark-text','Guías del mes',guides.length,`${fmtKg(monthKg)} kg despachados`)+
      stat('bi-people','Clientes activos',(db.clients||[]).filter(c=>c.active!==false).length,'Registro general')+
      stat('bi-cash-stack','Por cobrar del mes',money(receivable),`${guides.filter(g=>guideBalance(g)>0).length} guías pendientes`);

    const recent=guides.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);
    byId('dashboardOrders').innerHTML=recent.map(g=>`<tr><td><strong>${esc(getClient(g.clientId)?.name||'Cliente')}</strong></td><td>${fmtKg(g.kg)} kg</td><td>${fmtDate(g.date)}</td><td>${badge(g.status)}</td></tr>`).join('')||emptyRow(4,`Sin guías en ${formatMonth(guideMonth)}`);
    const heading=byId('dashboardOrders')?.closest('.card-panel')?.querySelector('.panel-head h2');
    const sub=byId('dashboardOrders')?.closest('.card-panel')?.querySelector('.panel-head p');
    if(heading) heading.textContent=`Guías · ${formatMonth(guideMonth)}`;
    if(sub) sub.textContent='Este bloque nunca mezcla meses';

    const unpaid=guides.filter(g=>guideBalance(g)>0).length;
    const trays=(db.trays||[]).filter(t=>Number(t.delivered||0)-Number(t.returned||0)>0).length;
    byId('dashboardAlerts').innerHTML=`<div class="alert-item danger"><i class="bi bi-cash"></i><div><strong>${unpaid} guías por pagar en ${formatMonth(guideMonth)}</strong><div>Total por cobrar del mes: ${money(receivable)}.</div></div></div><div class="alert-item info"><i class="bi bi-boxes"></i><div><strong>${trays} clientes con bandejas pendientes</strong><div>Las bandejas se mantienen como saldo operativo general.</div></div></div>`;
  }

  function enhancedRenderClients(){
    const table=byId('clientsTable'); if(!table) return;
    const q=(byId('clientSearch')?.value||'').toLowerCase();
    const list=(db.clients||[]).filter(c=>[c.name,c.rut,c.commune,c.route].some(v=>(v||'').toLowerCase().includes(q)));
    table.innerHTML=list.map(c=>`<tr><td><strong>${esc(c.name)}</strong><div class="text-muted small">${esc(c.contact||'')}</div></td><td>${esc(c.rut||'-')}</td><td>${esc(c.commune||'-')}</td><td>${esc(c.route||'-')}</td><td>${c.oven?badge('Operativo'):badge('Inactivo')}</td><td class="${balanceForClientMonth(c.id)>0?'money-pending':'money-positive'}">${money(balanceForClientMonth(c.id))}<div class="small text-muted">${formatMonth(guideMonth)}</div></td><td>${clientTrayBalance(c.id)}</td><td><button class="icon-btn" onclick="openClientDetail('${c.id}')"><i class="bi bi-eye"></i></button> <button class="icon-btn" onclick="editClient('${c.id}')"><i class="bi bi-pencil"></i></button></td></tr>`).join('')||emptyRow(8,'Aún no hay clientes registrados');
  }

  window.addEventListener('DOMContentLoaded',()=>{
    hideOrdersModule();
    installWorkingMonthFilter();
    installGuideMonthFilter();
    try {
      renderGuides = enhancedRenderGuides;
      renderPayments = enhancedRenderPayments;
      renderDashboard = enhancedDashboard;
      renderClients = enhancedRenderClients;
      renderAll();
    } catch(e) { console.warn('No se pudo aplicar módulo operativo mensual', e); }
  });
})();
