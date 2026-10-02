document.write('<script src="db-first.js?v=20261002-1846"><\/script>');
(() => {
  const MONTH_KEY='panaderiaMesTrabajo';
  const CLIENT_API='/api/panaderia/client-save';
  const GUIDE_PAID_API='/api/panaderia/guide-paid';
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

  async function markGuidePaidPersisted(id){
    if(window.panaderiaDbFirst?.mode==='row-level-d1' && typeof window.markGuidePaid==='function' && window.markGuidePaid!==markGuidePaidPersisted) return window.markGuidePaid(id);
    const g=(db.guides||[]).find(x=>x.id===id);
    if(!g) return;
    const balance=Math.max(0,Number(g.total||0)-Number(g.paid||0));
    if(balance<=0){ if(typeof toast==='function') toast(`Guía N° ${g.number} ya está pagada`); return; }
    if(!confirm(`¿Marcar la guía N° ${g.number} como pagada por ${money(balance)}?`)) return;
    try{
      const r=await fetch(GUIDE_PAID_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({guideId:id,date:today()}),keepalive:true});
      if(!r.ok) throw new Error(await r.text());
      g.paid=Number(g.total||0); g.status='Pagada';
      db.payments=db.payments||[];
      const pid=`auto-${id}`;
      if(!db.payments.some(p=>p.id===pid)) db.payments.unshift({id:pid,guideId:g.id,clientId:g.clientId,date:today(),amount:balance,method:'Pago total',notes:'Marcada como pagada desde Guías'});
      localStorage.setItem('panaderiaSistemaV1',JSON.stringify(db)); fixedRenderGuides();
      if(typeof renderPayments==='function') renderPayments(); if(typeof renderDashboard==='function') renderDashboard(); if(typeof renderClients==='function') renderClients();
      if(typeof toast==='function') toast(`Guía N° ${g.number} marcada como pagada`);
    }catch(e){console.error(e);alert('No se pudo guardar el pago en la base de datos. Intenta nuevamente.');}
  }

  function bindClientSave(){
    if(window.panaderiaDbFirst?.mode==='row-level-d1') return;
    const form=byId('entityForm'); if(!form || form.dataset.clientDirectSave) return;
    form.dataset.clientDirectSave='1';
    form.addEventListener('submit',()=>{
      if(typeof currentAction==='undefined' || currentAction!=='client') return;
      const fd=new FormData(form); const wantedName=String(fd.get('name')||'').trim(); const wantedRut=String(fd.get('rut')||'').trim();
      setTimeout(async()=>{
        const client=(db.clients||[]).find(c=>currentEditId && c.id===currentEditId) || (db.clients||[]).slice().reverse().find(c=>String(c.name||'').trim()===wantedName && (!wantedRut || String(c.rut||'').trim()===wantedRut));
        if(!client) return;
        try{const r=await fetch(CLIENT_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(client),keepalive:true});if(!r.ok)throw new Error(await r.text());if(typeof toast==='function')toast('Cliente guardado en la base de datos');}
        catch(e){console.error(e);alert('El cambio del cliente no pudo guardarse en la base de datos. Intenta nuevamente.');}
      },0);
    });
  }

  function bindMonthSelect(id){
    const node=byId(id); if(!node || node.dataset.monthFixBound) return;
    node.dataset.monthFixBound='1';
    node.addEventListener('change',()=>{
      localStorage.setItem(MONTH_KEY,node.value);
      const other=id==='workingMonthFilter'?byId('guideMonthFilter'):byId('workingMonthFilter'); if(other) other.value=node.value;
      fixedRenderGuides(); if(typeof renderPayments==='function') renderPayments(); if(typeof renderDashboard==='function') renderDashboard(); if(typeof renderClients==='function') renderClients();
    },true);
  }

  function install(){
    try{renderGuides=fixedRenderGuides;window.renderGuides=fixedRenderGuides;}catch(e){window.renderGuides=fixedRenderGuides;}
    if(!window.panaderiaDbFirst)window.markGuidePaid=markGuidePaidPersisted;
    bindClientSave(); bindMonthSelect('workingMonthFilter'); bindMonthSelect('guideMonthFilter'); fixedRenderGuides();
    setTimeout(()=>{bindClientSave();bindMonthSelect('workingMonthFilter');bindMonthSelect('guideMonthFilter');fixedRenderGuides()},250);
    setTimeout(()=>{bindClientSave();bindMonthSelect('workingMonthFilter');bindMonthSelect('guideMonthFilter');fixedRenderGuides()},1200);
  }

  window.addEventListener('DOMContentLoaded',install);
  window.addEventListener('load',()=>setTimeout(install,50));
})();
