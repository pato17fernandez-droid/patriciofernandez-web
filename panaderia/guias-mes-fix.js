(() => {
  const MONTH_KEY='panaderiaMesTrabajo';
  const byId=id=>document.getElementById(id);
  const selectedMonth=()=>byId('workingMonthFilter')?.value || byId('guideMonthFilter')?.value || localStorage.getItem(MONTH_KEY) || new Date().toISOString().slice(0,7);
  const monthLabel=ym=>{const [y,m]=String(ym).split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())};

  function fixedRenderGuides(){
    const table=byId('guidesTable');
    if(!table || typeof db==='undefined') return;
    const month=selectedMonth();
    if(month) localStorage.setItem(MONTH_KEY,month);
    const q=(byId('guideSearch')?.value||'').toLowerCase();
    const f=byId('guideStatusFilter')?.value||'';
    const list=(db.guides||[]).filter(g=>{
      const gm=String(g.date||'').slice(0,7);
      if(gm!==month) return false;
      const name=(typeof getClient==='function'?(getClient(g.clientId)?.name||''):'');
      const matchText=String(g.number||'').toLowerCase().includes(q)||name.toLowerCase().includes(q);
      const matchStatus=!f||g.status===f;
      return matchText&&matchStatus;
    }).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.number).localeCompare(String(a.number),undefined,{numeric:true}));

    table.innerHTML=list.map(g=>{
      const bal=typeof guideBalance==='function'?guideBalance(g):Math.max(0,Number(g.total||0)-Number(g.paid||0));
      const client=typeof getClient==='function'?(getClient(g.clientId)?.name||''):'';
      const action=bal>0
        ? `<button class="primary-btn pay-guide-btn" onclick="markGuidePaid('${g.id}')"><i class="bi bi-check2-circle"></i> Marcar pagada</button>`
        : `<span class="badge-soft badge-green"><i class="bi bi-check2"></i> Pagada</span>`;
      return `<tr><td><strong>N° ${esc(g.number)}</strong></td><td>${esc(client)}</td><td>${fmtDate(g.date)}</td><td>${Number(g.kg||0).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:3})} kg</td><td>${money(g.total)}</td><td>${money(g.paid)}</td><td class="${bal>0?'money-pending':'money-positive'}">${money(bal)}</td><td>${badge(g.status)}</td><td>${action} <button class="icon-btn" onclick="editGuide('${g.id}')" title="Editar"><i class="bi bi-pencil"></i></button></td></tr>`;
    }).join('') || emptyRow(9,`No hay guías en ${monthLabel(month)}`);

    const total=list.reduce((s,g)=>s+Number(g.total||0),0);
    const paid=list.reduce((s,g)=>s+Number(g.paid||0),0);
    const stats=byId('guideStats');
    if(stats) stats.innerHTML=mini(`Guías · ${monthLabel(month)}`,list.length)+mini('Total del mes',money(total))+mini('Pagado del mes',money(paid))+mini('Por cobrar del mes',money(Math.max(0,total-paid)));

    const top=byId('workingMonthFilter');
    const local=byId('guideMonthFilter');
    if(top && top.value!==month) top.value=month;
    if(local && local.value!==month) local.value=month;
  }

  function bindMonthSelect(id){
    const node=byId(id);
    if(!node || node.dataset.monthFixBound) return;
    node.dataset.monthFixBound='1';
    node.addEventListener('change',()=>{
      localStorage.setItem(MONTH_KEY,node.value);
      const other=id==='workingMonthFilter'?byId('guideMonthFilter'):byId('workingMonthFilter');
      if(other) other.value=node.value;
      fixedRenderGuides();
      if(typeof renderPayments==='function') renderPayments();
      if(typeof renderDashboard==='function') renderDashboard();
      if(typeof renderClients==='function') renderClients();
    },true);
  }

  function install(){
    try{ renderGuides=fixedRenderGuides; window.renderGuides=fixedRenderGuides; }catch(e){ window.renderGuides=fixedRenderGuides; }
    bindMonthSelect('workingMonthFilter');
    bindMonthSelect('guideMonthFilter');
    fixedRenderGuides();
    setTimeout(()=>{bindMonthSelect('workingMonthFilter');bindMonthSelect('guideMonthFilter');fixedRenderGuides()},250);
    setTimeout(()=>{bindMonthSelect('workingMonthFilter');bindMonthSelect('guideMonthFilter');fixedRenderGuides()},1200);
  }

  window.addEventListener('DOMContentLoaded',install);
  window.addEventListener('load',()=>setTimeout(install,50));
})();
