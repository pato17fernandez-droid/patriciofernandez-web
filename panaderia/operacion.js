(() => {
  const byId = id => document.getElementById(id);
  const currentMonth = () => new Date().toISOString().slice(0,7);
  const formatMonth = ym => {
    if (!ym) return 'Todos los meses';
    const [y,m] = ym.split('-').map(Number);
    return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
  };
  const fmtKg = n => Number(n||0).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:3});

  let guideMonth = currentMonth();

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
    select.addEventListener('change',()=>{ guideMonth=select.value; renderGuides(); });
    const filterRow = toolbar.querySelector('.filter-row');
    (filterRow || toolbar).appendChild(select);
    refreshGuideMonths();
  }

  function refreshGuideMonths(){
    const select = byId('guideMonthFilter');
    if (!select) return;
    const months = [...new Set((db.guides||[]).map(g=>(g.date||'').slice(0,7)).filter(Boolean))].sort().reverse();
    if (months.length && !months.includes(guideMonth)) guideMonth = months[0];
    select.innerHTML = '<option value="">Todos los meses</option>' + months.map(m=>`<option value="${m}" ${m===guideMonth?'selected':''}>${formatMonth(m)}</option>`).join('');
  }

  function markGuidePaid(id){
    const g = (db.guides||[]).find(x=>x.id===id);
    if (!g) return;
    const balance = Math.max(0, Number(g.total||0)-Number(g.paid||0));
    if (balance <= 0) {
      if (typeof toast === 'function') toast(`Guía N° ${g.number} ya está pagada`);
      return;
    }
    if (!confirm(`¿Marcar la guía N° ${g.number} como pagada por ${money(balance)}?`)) return;
    g.paid = Number(g.total||0);
    g.status = 'Pagada';
    db.payments = db.payments || [];
    db.payments.unshift({
      id: uid('pay'),
      guideId: g.id,
      clientId: g.clientId,
      date: today(),
      amount: balance,
      method: 'Pago total',
      notes: 'Marcada como pagada desde Guías'
    });
    saveData();
    if (typeof toast === 'function') toast(`Guía N° ${g.number} marcada como pagada`);
  }
  window.markGuidePaid = markGuidePaid;

  function enhancedRenderGuides(){
    if (!byId('guidesTable')) return;
    refreshGuideMonths();
    const q=(byId('guideSearch')?.value||'').toLowerCase();
    const f=byId('guideStatusFilter')?.value||'';
    const list=(db.guides||[]).filter(g=>{
      const matchText=(String(g.number||'').toLowerCase().includes(q)||(getClient(g.clientId)?.name||'').toLowerCase().includes(q));
      const matchStatus=!f||g.status===f;
      const matchMonth=!guideMonth||(g.date||'').slice(0,7)===guideMonth;
      return matchText&&matchStatus&&matchMonth;
    });
    byId('guidesTable').innerHTML=list.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(g=>{
      const bal=guideBalance(g);
      const action=bal>0
        ? `<button class="primary-btn pay-guide-btn" onclick="markGuidePaid('${g.id}')"><i class="bi bi-check2-circle"></i> Marcar pagada</button>`
        : `<span class="badge-soft badge-green"><i class="bi bi-check2"></i> Pagada</span>`;
      return `<tr><td><strong>N° ${esc(g.number)}</strong></td><td>${esc(getClient(g.clientId)?.name||'')}</td><td>${fmtDate(g.date)}</td><td>${fmtKg(g.kg)} kg</td><td>${money(g.total)}</td><td>${money(g.paid)}</td><td class="${bal>0?'money-pending':'money-positive'}">${money(bal)}</td><td>${badge(g.status)}</td><td>${action} <button class="icon-btn" onclick="editGuide('${g.id}')" title="Editar"><i class="bi bi-pencil"></i></button></td></tr>`;
    }).join('')||emptyRow(9,'No hay guías en este período');
    const total=list.reduce((s,g)=>s+Number(g.total||0),0);
    const paid=list.reduce((s,g)=>s+Number(g.paid||0),0);
    byId('guideStats').innerHTML=mini('Guías',list.length)+mini('Total',money(total))+mini('Pagado',money(paid))+mini('Por cobrar',money(Math.max(0,total-paid)));
  }

  function enhancedDashboard(){
    if (!byId('dashboardStats')) return;
    const td=today();
    const todayGuides=(db.guides||[]).filter(g=>g.date===td);
    const todayKg=todayGuides.reduce((s,g)=>s+Number(g.kg||0),0);
    const month=currentMonth();
    const monthGuides=(db.guides||[]).filter(g=>(g.date||'').slice(0,7)===month);
    const monthKg=monthGuides.reduce((s,g)=>s+Number(g.kg||0),0);
    const receivable=(db.guides||[]).reduce((s,g)=>s+guideBalance(g),0);
    byId('dashboardStats').innerHTML=
      stat('bi-file-earmark-text','Guías de hoy',todayGuides.length,`${fmtKg(todayKg)} kg despachados`)+
      stat('bi-box-seam','Kg del mes',`${fmtKg(monthKg)} kg`,formatMonth(month))+
      stat('bi-people','Clientes activos',(db.clients||[]).filter(c=>c.active!==false).length,'Clientes registrados')+
      stat('bi-cash-stack','Por cobrar',money(receivable),`${(db.guides||[]).filter(g=>guideBalance(g)>0).length} guías pendientes`);

    const recent=(db.guides||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);
    byId('dashboardOrders').innerHTML=recent.map(g=>`<tr><td><strong>${esc(getClient(g.clientId)?.name||'Cliente')}</strong></td><td>${fmtKg(g.kg)} kg</td><td>${fmtDate(g.date)}</td><td>${badge(g.status)}</td></tr>`).join('')||emptyRow(4,'Aún no hay guías registradas');
    const heading=byId('dashboardOrders')?.closest('.card-panel')?.querySelector('.panel-head h2');
    const sub=byId('dashboardOrders')?.closest('.card-panel')?.querySelector('.panel-head p');
    if(heading) heading.textContent='Guías recientes';
    if(sub) sub.textContent='Últimos despachos registrados';

    const unpaid=(db.guides||[]).filter(g=>guideBalance(g)>0).length;
    const trays=(db.trays||[]).filter(t=>Number(t.delivered||0)-Number(t.returned||0)>0).length;
    byId('dashboardAlerts').innerHTML=`<div class="alert-item danger"><i class="bi bi-cash"></i><div><strong>${unpaid} guías por pagar</strong><div>Total por cobrar: ${money(receivable)}.</div></div></div><div class="alert-item info"><i class="bi bi-boxes"></i><div><strong>${trays} clientes con bandejas pendientes</strong><div>Revisar devoluciones.</div></div></div>`;
  }

  window.addEventListener('DOMContentLoaded',()=>{
    hideOrdersModule();
    installGuideMonthFilter();
    try {
      renderGuides = enhancedRenderGuides;
      renderDashboard = enhancedDashboard;
      renderAll();
    } catch(e) { console.warn('No se pudo aplicar módulo operativo', e); }
  });
})();
