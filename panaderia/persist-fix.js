(() => {
  const STATE_API='/api/panaderia/state';
  const CLIENT_API='/api/panaderia/client-save';
  const GUIDE_PAID_API='/api/panaderia/guide-paid';
  let writeChain=Promise.resolve();

  const cloneState=()=>JSON.parse(JSON.stringify(db));

  function queueStateSave(){
    const snapshot=cloneState();
    writeChain=writeChain.catch(()=>{}).then(async()=>{
      const r=await fetch(STATE_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(snapshot),keepalive:true});
      if(!r.ok) throw new Error(await r.text());
    }).catch(e=>console.error('Persistencia D1:',e));
    return writeChain;
  }

  async function saveClientDirect(client){
    const r=await fetch(CLIENT_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(client),keepalive:true});
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function markGuidePaidDirect(id){
    const g=(db.guides||[]).find(x=>x.id===id);
    if(!g) return;
    const balance=Math.max(0,Number(g.total||0)-Number(g.paid||0));
    if(balance<=0){if(typeof toast==='function')toast(`Guía N° ${g.number} ya está pagada`);return;}
    if(!confirm(`¿Marcar la guía N° ${g.number} como pagada por ${money(balance)}?`)) return;

    try{
      const r=await fetch(GUIDE_PAID_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({guideId:id,date:today()}),keepalive:true});
      if(!r.ok) throw new Error(await r.text());
      g.paid=Number(g.total||0);
      g.status='Pagada';
      db.payments=db.payments||[];
      const pid=`auto-${id}`;
      if(!db.payments.some(p=>p.id===pid)) db.payments.unshift({id:pid,guideId:g.id,clientId:g.clientId,date:today(),amount:balance,method:'Pago total',notes:'Marcada como pagada desde Guías'});
      localStorage.setItem('panaderiaSistemaV1',JSON.stringify(db));
      if(typeof renderAll==='function') renderAll();
      if(typeof toast==='function') toast(`Guía N° ${g.number} marcada como pagada`);
    }catch(e){
      console.error(e);
      alert('No se pudo guardar el pago en la base de datos. Intenta nuevamente.');
    }
  }

  function installSaveWrapper(){
    if(typeof saveData!=='function' || saveData.__persistFix) return;
    const previous=saveData;
    const wrapped=function(){
      previous();
      queueStateSave();
    };
    wrapped.__persistFix=true;
    saveData=wrapped;
  }

  function installClientPersistence(){
    const form=document.getElementById('entityForm');
    if(!form || form.dataset.clientPersistBound) return;
    form.dataset.clientPersistBound='1';
    form.addEventListener('submit',()=>{
      if(typeof currentAction==='undefined' || currentAction!=='client') return;
      const fd=new FormData(form);
      const wantedName=String(fd.get('name')||'').trim();
      const wantedRut=String(fd.get('rut')||'').trim();
      setTimeout(async()=>{
        const client=(db.clients||[]).find(c=>currentEditId && c.id===currentEditId)
          || (db.clients||[]).slice().reverse().find(c=>String(c.name||'').trim()===wantedName && (!wantedRut || String(c.rut||'').trim()===wantedRut));
        if(!client) return;
        try{
          await saveClientDirect(client);
          if(typeof toast==='function') toast('Cliente guardado en la base de datos');
        }catch(e){
          console.error(e);
          alert('El cambio del cliente quedó en pantalla, pero no pudo guardarse en la base de datos. Intenta nuevamente.');
        }
      },0);
    });
  }

  function installGuidePaid(){
    window.markGuidePaid=markGuidePaidDirect;
  }

  function install(){
    installSaveWrapper();
    installClientPersistence();
    installGuidePaid();
    setTimeout(installSaveWrapper,800);
    setTimeout(installGuidePaid,800);
  }

  window.addEventListener('DOMContentLoaded',install);
  window.addEventListener('load',()=>setTimeout(install,50));
})();
