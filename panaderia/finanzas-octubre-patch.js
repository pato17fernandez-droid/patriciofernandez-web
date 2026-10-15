(() => {
  async function apply(){
    try{
      const r=await fetch('/api/panaderia/finance-oct-patch',{cache:'no-store'});
      if(!r.ok) return;
      const refresh=()=>{try{window.panaderiaFinanzas?.load?.()}catch{}};
      setTimeout(refresh,150);
      setTimeout(refresh,700);
    }catch(e){console.warn('No se pudieron aplicar los últimos ajustes de octubre',e)}
  }
  window.addEventListener('DOMContentLoaded',apply);
})();
