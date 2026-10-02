(() => {
  const KEY='panaderiaMesTrabajo';
  const byId=id=>document.getElementById(id);
  const nowMonth=()=>new Date().toISOString().slice(0,7);
  const label=ym=>{if(!ym)return'';const [y,m]=ym.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())};

  function months(){
    const out=new Set();
    (typeof db!=='undefined'&&db.guides||[]).forEach(g=>{const m=String(g.date||'').slice(0,7);if(m)out.add(m)});
    (window.panHistorial||[]).forEach(r=>{const m=String(r.date||'').slice(0,7);if(m)out.add(m)});
    out.add(nowMonth());
    return [...out].sort().reverse();
  }

  function renderEverything(){
    try{if(typeof renderGuides==='function')renderGuides()}catch(e){console.warn(e)}
    try{if(typeof renderPayments==='function')renderPayments()}catch(e){console.warn(e)}
    try{if(typeof renderDashboard==='function')renderDashboard()}catch(e){console.warn(e)}
    try{if(typeof renderClients==='function')renderClients()}catch(e){console.warn(e)}
    try{if(typeof renderDispatch==='function')renderDispatch()}catch(e){console.warn(e)}
  }

  function setMonth(month,{syncReports=true}={}){
    if(!month)return;
    localStorage.setItem(KEY,month);
    try{if(typeof window.setPanaderiaMonth==='function')window.setPanaderiaMonth(month)}catch(e){console.warn(e)}
    const top=byId('workingMonthFilter');if(top)top.value=month;
    const guides=byId('guideMonthFilter');if(guides)guides.value=month;
    renderEverything();

    if(syncReports){
      const report=byId('reportMonth');
      if(report&&[...report.options].some(o=>o.value===month)){
        report.value=month;
        report.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
  }
  window.setBakeryWorkingMonth=setMonth;

  function replaceSelect(id){
    const old=byId(id);if(!old)return null;
    const chosen=localStorage.getItem(KEY)||old.value||nowMonth();
    const clone=old.cloneNode(false);
    clone.id=id;clone.className=old.className;clone.style.cssText=old.style.cssText;
    const ms=months();
    if(!ms.includes(chosen))ms.push(chosen);
    clone.innerHTML=ms.sort().reverse().map(m=>`<option value="${m}"${m===chosen?' selected':''}>${label(m)}</option>`).join('');
    old.replaceWith(clone);
    clone.addEventListener('change',e=>setMonth(e.target.value));
    return clone;
  }

  function loadDispatchUI(){
    if(window.renderDispatch&&document.getElementById('section-despachos')?.dataset.redesigned)return;
    if(document.querySelector('script[data-dispatch-ui]'))return;
    const s=document.createElement('script');
    s.src='dispatch-ui.js?v=20261002-2139';
    s.dataset.dispatchUi='1';
    document.body.appendChild(s);
  }

  function install(){
    loadDispatchUI();
    const selected=localStorage.getItem(KEY)||nowMonth();
    replaceSelect('workingMonthFilter');
    replaceSelect('guideMonthFilter');
    setMonth(selected,{syncReports:false});
  }

  window.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  window.addEventListener('load',()=>setTimeout(install,150));
  setTimeout(install,900);
  setTimeout(install,1800);
})();
