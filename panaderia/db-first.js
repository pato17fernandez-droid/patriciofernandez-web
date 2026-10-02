(() => {
  const ENTITY_API='/api/panaderia/entity';
  const STATE_API='/api/panaderia/state';
  const nativeFetch=window.fetch.bind(window);
  window.__panaderiaNativeFetch=nativeFetch;

  window.fetch=(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    const method=String(init?.method||'GET').toUpperCase();
    if(url.includes(STATE_API)&&method==='POST'){
      return Promise.resolve(new Response(JSON.stringify({ok:true,mode:'db-first'}),{status:200,headers:{'content-type':'application/json'}}));
    }
    return nativeFetch(input,init);
  };

  const post=async(type,data)=>{
    const r=await nativeFetch(ENTITY_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,data})});
    const out=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(out.error||`HTTP ${r.status}`);
    return out;
  };
  const persistLocal=()=>{
    try{localStorage.setItem('panaderiaSistemaV1',JSON.stringify(db));}catch{}
    try{renderAll();}catch{}
  };
  const closeModal=()=>{try{bootstrap.Modal.getInstance(document.getElementById('entityModal'))?.hide();}catch{}};
  const fail=e=>{console.error('D1:',e);if(typeof toast==='function')toast('No se pudo guardar en la base de datos');else alert('No se pudo guardar en la base de datos');};

  async function submitDbFirst(e){
    e.preventDefault();
    e.stopImmediatePropagation();
    const form=e.currentTarget;
    const fd=new FormData(form),v=Object.fromEntries(fd.entries());
    const btn=document.getElementById('modalSubmit');
    if(btn){btn.disabled=true;btn.textContent='Guardando...';}
    try{
      if(currentAction==='client'){
        const old=currentEditId?(db.clients||[]).find(x=>x.id===currentEditId):null;
        const obj={
          ...(old||{}),id:currentEditId||uid('c'),name:v.name,rut:v.rut||'',business:v.business||'',address:v.address||'',
          commune:v.commune||'',phone:v.phone||'',contact:v.contact||'',route:v.route||'',oven:v.oven==='true',active:old?.active!==false,
          zone:old?.zone||'',priceHallulla:Number(old?.priceHallulla||0),priceMarraqueta:Number(old?.priceMarraqueta||0),priceCiabatta:Number(old?.priceCiabatta||0)
        };
        await post('client',obj);
        db.clients=currentEditId?db.clients.map(x=>x.id===currentEditId?obj:x):[...db.clients,obj];
        if(typeof toast==='function')toast('Cliente guardado en D1');
      }

      else if(currentAction==='order'){
        const totalKg=Number(v.hallulla||0)+Number(v.marraqueta||0)+Number(v.ciabatta||0)+Number(v.medioBaguette||0)+Number(v.panCompleto||0);
        if(totalKg<=0)throw new Error('Ingresa al menos un tipo de pan');
        const obj={
          id:currentEditId?Number(currentEditId):Date.now(),clientId:v.clientId,
          hallulla:Number(v.hallulla||0),marraqueta:Number(v.marraqueta||0),ciabatta:Number(v.ciabatta||0),
          medioBaguette:Number(v.medioBaguette||0),panCompleto:Number(v.panCompleto||0),
          date:v.date,status:v.status||'Pendiente',notes:v.notes||''
        };
        await post('order',obj);
        db.orders=db.orders||[];
        db.orders=currentEditId?db.orders.map(x=>String(x.id)===String(currentEditId)?obj:x):[obj,...db.orders];
        if(typeof toast==='function')toast('Pedido guardado en D1');
      }

      else if(currentAction==='guide'){
        const old=currentEditId?(db.guides||[]).find(x=>x.id===currentEditId):null;
        const total=Number(v.total||0),paid=Math.min(Number(old?.paid||0),total);
        const obj={id:currentEditId||uid('g'),number:v.number,clientId:v.clientId,date:v.date,kg:Number(v.kg||0),total,paid,status:paid<=0?'Pendiente':paid<total?'Parcial':'Pagada',notes:v.notes||''};
        const out=await post('guide',obj); obj.status=out.status||obj.status; obj.paid=Number(out.paid??obj.paid);
        db.guides=currentEditId?db.guides.map(x=>x.id===currentEditId?obj:x):[...db.guides,obj];
        if(typeof toast==='function')toast('Guía guardada en D1');
      }

      else if(currentAction==='payment'){
        const g=(db.guides||[]).find(x=>x.id===v.guideId); if(!g)throw new Error('Guía no encontrada');
        const requested=Number(v.amount||0); if(requested<=0)throw new Error('Monto inválido');
        const payment={id:uid('p'),guideId:g.id,clientId:g.clientId,date:v.date,amount:requested,method:v.method||'',notes:v.notes||''};
        const out=await post('payment',payment);
        payment.amount=Number(out.amount||requested);
        db.payments=db.payments||[]; db.payments.push(payment);
        g.paid=Number(out.paid||0); g.status=out.status||'Parcial';
        if(typeof toast==='function')toast('Pago guardado en D1');
      }

      else if(currentAction==='tray'){
        const clientId=v.clientId; let t=(db.trays||[]).find(x=>x.clientId===clientId);
        const obj={clientId,delivered:Number(t?.delivered||0)+Number(v.delivered||0),returned:Number(t?.returned||0)+Number(v.returned||0),last:v.last||''};
        await post('tray',obj);
        if(t)Object.assign(t,obj);else{db.trays=db.trays||[];db.trays.push(obj);}
        if(typeof toast==='function')toast('Bandejas guardadas en D1');
      }

      else if(currentAction==='oven'){
        const obj={id:currentEditId||uid('o'),clientId:v.clientId,model:v.model||'',installed:v.installed||'',status:v.status||'Operativo',notes:v.notes||''};
        await post('oven',obj);
        db.ovens=currentEditId?db.ovens.map(x=>x.id===currentEditId?obj:x):[...(db.ovens||[]),obj];
        const c=typeof getClient==='function'?getClient(v.clientId):null;if(c)c.oven=obj.status!=='Inactivo';
        if(typeof toast==='function')toast('Horno guardado en D1');
      }
      else return;

      persistLocal(); closeModal();
      try{window.renderDispatch?.();}catch{}
    }catch(err){fail(err)}finally{if(btn){btn.disabled=false;btn.textContent='Guardar';}}
  }

  async function markPaidDbFirst(id){
    const g=(db.guides||[]).find(x=>x.id===id);if(!g)return;
    const bal=Math.max(0,Number(g.total||0)-Number(g.paid||0));
    if(bal<=0){if(typeof toast==='function')toast(`Guía N° ${g.number} ya está pagada`);return;}
    if(!confirm(`¿Marcar la guía N° ${g.number} como pagada por ${money(bal)}?`))return;
    try{
      const paymentId=uid('p');
      const out=await post('guidePaid',{guideId:g.id,paymentId,date:today(),method:'Pago total',notes:'Marcada como pagada desde Guías'});
      g.paid=Number(out.paid||g.total||0);g.status='Pagada';
      db.payments=db.payments||[];
      if(Number(out.amount||0)>0)db.payments.push({id:out.paymentId||paymentId,guideId:g.id,clientId:g.clientId,date:today(),amount:Number(out.amount),method:'Pago total',notes:'Marcada como pagada desde Guías'});
      persistLocal();if(typeof toast==='function')toast(`Guía N° ${g.number} marcada como pagada`);
    }catch(err){fail(err)}
  }

  window.addEventListener('DOMContentLoaded',()=>{
    const form=document.getElementById('entityForm');
    if(form)form.addEventListener('submit',submitDbFirst,true);
  });
  window.addEventListener('load',()=>{window.markGuidePaid=markPaidDbFirst;try{markGuidePaid=markPaidDbFirst}catch{};});
  window.panaderiaDbFirst={post,mode:'row-level-d1'};
})();
