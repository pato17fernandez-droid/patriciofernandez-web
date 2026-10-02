(() => {
  const KEY='panaderiaSeccionActual';
  const valid=new Set(['dashboard','clientes','despachos','guias','pagos','bandejas','hornos','informes','configuracion']);
  const remember=section=>{ if(valid.has(section)) sessionStorage.setItem(KEY,section); };
  const restore=()=>{
    const saved=sessionStorage.getItem(KEY);
    if(!saved||!valid.has(saved)||typeof navigate!=='function') return;
    const target=document.getElementById('section-'+saved);
    if(target) navigate(saved);
  };

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('.nav-item[data-section]');
    if(btn) remember(btn.dataset.section);
  },true);

  window.addEventListener('DOMContentLoaded',()=>setTimeout(restore,0));
  window.addEventListener('load',()=>setTimeout(restore,50));
})();
