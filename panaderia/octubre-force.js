(() => {
  const MONTH='2026-10';
  function apply(){
    try{
      if(typeof db==='undefined' || !window.PANADERIA_OCT_2026?.guides?.length) return false;

      const pack=window.PANADERIA_OCT_2026;
      const existing=new Map((db.guides||[]).map(g=>[g.id,g]));
      const nonImportedOct=(db.guides||[]).filter(g=>{
        const isOct=String(g.date||'').slice(0,7)===MONTH;
        const isHist=String(g.id||'').startsWith('hist-');
        return !isOct || !isHist;
      });

      const october=pack.guides.map(seed=>{
        const old=existing.get(seed.id);
        const oldPaid=Number(old?.paid||0);
        return oldPaid>Number(seed.paid||0)
          ? {...seed,paid:oldPaid,status:oldPaid>=Number(seed.total||0)?'Pagada':'Parcial'}
          : {...seed};
      });

      db.guides=[...nonImportedOct,...october];

      if(Array.isArray(db.payments)) db.payments=db.payments;
      try{localStorage.setItem('panaderiaSistemaV1',JSON.stringify(db));}catch{}

      if(Array.isArray(pack.history)){
        const current=Array.isArray(window.panHistorial)?window.panHistorial:[];
        const base=current.filter(r=>String(r.date||'').slice(0,7)!==MONTH);
        window.panHistorial=[...base,...pack.history];
      }

      try{if(typeof renderAll==='function')renderAll();}catch{}
      try{if(typeof renderGuides==='function')renderGuides();}catch{}
      try{if(typeof renderHistoricalReports==='function')renderHistoricalReports();}catch{}
      try{if(typeof renderDispatch==='function')renderDispatch();}catch{}
      return true;
    }catch(e){
      console.error('No se pudo forzar octubre actualizado',e);
      return false;
    }
  }

  function retry(){
    let n=0;
    const timer=setInterval(()=>{
      n++;
      if(apply() || n>=20) clearInterval(timer);
    },250);
  }

  window.addEventListener('DOMContentLoaded',retry);
  window.addEventListener('load',()=>setTimeout(apply,300));
  window.addEventListener('focus',apply);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply()});
  setTimeout(apply,1800);
  setTimeout(apply,3500);
})();
