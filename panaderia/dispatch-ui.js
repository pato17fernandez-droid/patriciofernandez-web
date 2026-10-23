(() => {
  const $=id=>document.getElementById(id);
  const API='/api/panaderia/dispatch-entry';
  const MONTH_KEY='panaderiaMesTrabajo';
  const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n||0));
  const kg=n=>Number(n||0).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:3});
  const fmt=d=>{if(!d)return'-';const [y,m,day]=String(d).split('-');return `${day}-${m}-${y}`};
  const currentMonth=()=>localStorage.getItem(MONTH_KEY)||new Date().toISOString().slice(0,7);
  const monthLabel=ym=>{const[y,m]=String(ym).split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())};
  const today=()=>new Date().toISOString().slice(0,10);
  const products=[
    ['hallulla','Hallulla','priceHallulla'],
    ['marraqueta','Marraqueta','priceMarraqueta'],
    ['ciabatta','Ciabatta','priceCiabatta'],
    ['medioBaguette','Medio baguette','priceMedioBaguette'],
    ['panCompleto','Pan completo','pricePanCompleto']
  ];
  let editing=null;
  const PRICE_FALLBACK={"cli-cyd":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1500,"pricePanCompleto":1600},"cli-david-choroico":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-don-juan-melipeuco":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1500,"pricePanCompleto":1600},"cli-el-huerto-jaramillo":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-el-laurel":{"priceHallulla":1500,"priceMarraqueta":1500,"priceCiabatta":1500,"priceMedioBaguette":0,"pricePanCompleto":1600},"cli-el-refugio":{"priceHallulla":1500,"priceMarraqueta":1500,"priceCiabatta":1700,"priceMedioBaguette":1700,"pricePanCompleto":1600},"cli-fredy":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-hernan-astorga-pucon":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-ibacache":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-isabel-pitru":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-israel-nancul":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-jerry":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-jjyd":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-km-06":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-la-coope":{"priceHallulla":1300,"priceMarraqueta":1300,"priceCiabatta":1300,"priceMedioBaguette":1300,"pricePanCompleto":1600},"cli-la-estrella":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-leonardo":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-maria-flores":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-maria-flores-cunco":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-metrenco":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-mys":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-rustico":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1400,"pricePanCompleto":1600},"cli-san-pedro":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-sandra":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1500,"priceMedioBaguette":1500,"pricePanCompleto":1600},"cli-texia-melipeuco":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1500,"pricePanCompleto":1600},"cli-tote":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1700},"cli-tote-2":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1700},"cli-viejo-mundo":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-walter":{"priceHallulla":1300,"priceMarraqueta":1300,"priceCiabatta":1300,"priceMedioBaguette":1300,"pricePanCompleto":1600},"cli-wilson":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1700},"cli-la-coopeh":{"priceHallulla":1300,"priceMarraqueta":1300,"priceCiabatta":1300,"priceMedioBaguette":1600,"pricePanCompleto":1700},"cli-la-vuelta":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-mica":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1500,"pricePanCompleto":1600},"cli-monica-san-ramon":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600},"cli-andrea-gorbea":{"priceHallulla":1400,"priceMarraqueta":1400,"priceCiabatta":1600,"priceMedioBaguette":1600,"pricePanCompleto":1600}};

  const clients=()=>Array.isArray(db?.clients)?db.clients.filter(c=>c.active!==false):[];
  const client=id=>{const found=clients().find(c=>String(c.id)===String(id));return found?{...(PRICE_FALLBACK[id]||{}),...found}:null;};
  const grossPrice=(c,key)=>{const net=Number(c?.[key]||0);return net>0?Math.round(net*1.19):0};
  const totalKg=o=>products.reduce((s,[k])=>s+Number(o?.[k]||0),0);

  function injectStyles(){
    if($('dispatchEntryStyles'))return;
    const st=document.createElement('style');st.id='dispatchEntryStyles';st.textContent=`
      .de-shell{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:18px;align-items:start}
      .de-card{background:#fff;border:1px solid #e7e9ee;border-radius:18px;padding:20px;box-shadow:0 8px 24px rgba(20,28,45,.04)}
      .de-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
      .de-head h2{font-size:1.18rem;margin:0}.de-head p{margin:4px 0 0;color:#7b8290;font-size:.9rem}
      .de-client-grid{display:grid;grid-template-columns:1.4fr .7fr .7fr;gap:12px;margin-bottom:16px}
      .de-products{display:grid;gap:10px}
      .de-product{display:grid;grid-template-columns:minmax(150px,1.3fr) 130px 125px 125px 145px;gap:10px;align-items:center;border:1px solid #eceef2;border-radius:14px;padding:12px 14px}
      .de-product-name strong{display:block}.de-product-name small{color:#848b97}
      .de-product input{font-size:1.05rem;font-weight:700;text-align:right}
      .de-price{text-align:right}.de-price small{display:block;color:#8a909a}.de-price strong{font-size:.94rem}
      .de-sub{text-align:right;font-weight:800}
      .de-total{background:#172033;color:#fff;border-radius:18px;padding:22px;position:sticky;top:90px}
      .de-total h3{font-size:1rem;margin:0 0 16px;color:#dbe1ea}.de-total-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.12)}
      .de-total-row.big{padding:16px 0}.de-total-row.big strong{font-size:1.7rem}.de-total .muted{color:#aeb7c5}
      .de-save{width:100%;margin-top:18px;border:0;border-radius:12px;padding:13px 16px;background:#f4b400;color:#111827;font-weight:800;font-size:1rem}
      .de-save:disabled{opacity:.6}.de-clear{width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:10px;background:transparent;color:#fff}
      .de-price-strip{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 16px}.de-pill{background:#f7f8fa;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px;font-size:.78rem;color:#505766}
      .de-alert{padding:10px 12px;border-radius:10px;background:#fff4d6;color:#745100;margin-top:12px;font-size:.86rem}
      .de-recent{margin-top:18px}.de-guide{font-weight:800}.de-money{font-weight:800}
      @media(max-width:1050px){.de-shell{grid-template-columns:1fr}.de-total{position:static}.de-product{grid-template-columns:1.2fr 120px 110px 110px}.de-sub{grid-column:4}}
      @media(max-width:720px){.de-client-grid{grid-template-columns:1fr}.de-product{grid-template-columns:1fr 1fr}.de-product-name{grid-column:1/-1}.de-price{text-align:left}.de-sub{text-align:right;grid-column:auto}.de-card{padding:14px}}
    `;document.head.appendChild(st);
  }

  function options(selected=''){
    return clients().slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'))
      .map(c=>`<option value="${esc(c.id)}"${String(c.id)===String(selected)?' selected':''}>${esc(c.name||c.id)}</option>`).join('');
  }

  function productRow([key,label,priceKey],value=0){
    return `<div class="de-product" data-product="${key}">
      <div class="de-product-name"><strong>${label}</strong><small>Valor por kilo del cliente</small></div>
      <div><label class="form-label small mb-1">Kilos</label><input class="form-control de-kg" inputmode="decimal" type="number" min="0" step="0.01" name="${key}" value="${Number(value||0)||''}" placeholder="0,00"></div>
      <div class="de-price"><small>Neto/kg</small><strong data-net="${key}">-</strong></div>
      <div class="de-price"><small>Con IVA/kg</small><strong data-gross="${key}">-</strong></div>
      <div class="de-sub" data-sub="${key}">$0</div>
    </div>`;
  }

  function buildForm(order=null,guide=null){
    const date=order?.date||today(),clientId=order?.clientId||'',guideNumber=guide?.number||'';
    return `<div class="de-shell">
      <div>
        <div class="de-card">
          <div class="de-head"><div><h2>${order?'Editar despacho registrado':'Registrar despacho realizado'}</h2><p>Ingresa lo que ya salió de la panadería, igual que en tu Excel.</p></div><span class="badge-soft badge-blue">${monthLabel(currentMonth())}</span></div>
          <div class="de-client-grid">
            <div><label class="form-label">Cliente</label><select id="deClient" class="form-select" required><option value="">Selecciona cliente...</option>${options(clientId)}</select></div>
            <div><label class="form-label">Fecha</label><input id="deDate" type="date" class="form-control" value="${esc(date)}" required></div>
            <div><label class="form-label">N° guía</label><input id="deGuide" class="form-control" inputmode="numeric" value="${esc(guideNumber)}" placeholder="Ej. 1975" required></div>
          </div>
          <div id="dePriceStrip" class="de-price-strip"></div>
          <div class="de-products">${products.map(p=>productRow(p,order?.[p[0]]||0)).join('')}</div>
          <div class="mt-3"><label class="form-label">Observación</label><textarea id="deNotes" class="form-control" rows="2" placeholder="Opcional">${esc(order?.notes||'')}</textarea></div>
        </div>
        <div class="de-card de-recent">
          <div class="de-head"><div><h2>Últimos despachos registrados</h2><p>Control rápido del mes seleccionado.</p></div></div>
          <div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Guía</th><th>Kg</th><th>Total</th><th></th></tr></thead><tbody id="deRecentBody"></tbody></table></div>
        </div>
      </div>
      <aside class="de-total">
        <h3>RESUMEN DE LA GUÍA</h3>
        <div class="de-total-row"><span>Cliente</span><strong id="deSummaryClient">Sin seleccionar</strong></div>
        <div class="de-total-row"><span>Total kilos</span><strong id="deSummaryKg">0,00 kg</strong></div>
        <div class="de-total-row big"><span>Total guía</span><strong id="deSummaryTotal">$0</strong></div>
        <small class="muted">El total usa el valor por kilo configurado para cada producto del cliente y agrega IVA.</small>
        <div id="deWarning" class="de-alert d-none"></div>
        <button id="deSave" class="de-save"><i class="bi bi-check2-circle"></i> Guardar despacho y guía</button>
        <button id="deClear" class="de-clear">Limpiar formulario</button>
      </aside>
    </div>`;
  }

  function calc(){
    const c=client($('deClient')?.value);
    let kilos=0,total=0;const missing=[];
    products.forEach(([key,label,priceKey])=>{
      const val=Math.max(0,Number(document.querySelector(`[name="${key}"]`)?.value||0));
      const net=Number(c?.[priceKey]||0),gross=grossPrice(c,priceKey),sub=Math.round(val*gross);
      kilos+=val;total+=sub;
      const ne=document.querySelector(`[data-net="${key}"]`),gr=document.querySelector(`[data-gross="${key}"]`),su=document.querySelector(`[data-sub="${key}"]`);
      if(ne)ne.textContent=net?money(net):'-';if(gr)gr.textContent=gross?money(gross):'-';if(su)su.textContent=val&&gross?money(sub):'$0';
      if(val>0&&!net)missing.push(label);
    });
    if($('deSummaryClient'))$('deSummaryClient').textContent=c?.name||'Sin seleccionar';
    if($('deSummaryKg'))$('deSummaryKg').textContent=`${kg(kilos)} kg`;
    if($('deSummaryTotal'))$('deSummaryTotal').textContent=money(total);
    const warn=$('deWarning');
    if(warn){warn.textContent=missing.length?`Falta precio configurado para: ${missing.join(', ')}.`:'';warn.classList.toggle('d-none',!missing.length)}
    const strip=$('dePriceStrip');
    if(strip)strip.innerHTML=c?products.map(([key,label,priceKey])=>`<span class="de-pill"><strong>${label}:</strong> ${Number(c[priceKey]||0)?money(c[priceKey])+' neto/kg':'Sin precio'}</span>`).join(''):'<span class="de-pill">Selecciona un cliente para ver sus precios.</span>';
    return {kilos,total,missing};
  }

  function recentRows(){
    const ms=currentMonth();
    const orders=(db.orders||[]).filter(o=>String(o.date||'').slice(0,7)===ms&&o.status==='Entregado');
    return orders.map(o=>{
      const g=(db.guides||[]).find(x=>x.id===`dispatch-${o.id}`||x.id===`order-guide-${o.id}`);
      return {o,g};
    }).sort((a,b)=>String(b.o.date||'').localeCompare(String(a.o.date||''))||Number(b.o.id)-Number(a.o.id));
  }

  function renderRecent(){
    const tb=$('deRecentBody');if(!tb)return;
    const rows=recentRows();
    tb.innerHTML=rows.length?rows.slice(0,30).map(({o,g})=>`<tr>
      <td>${fmt(o.date)}</td><td><strong>${esc(client(o.clientId)?.name||'Cliente')}</strong></td>
      <td class="de-guide">${g?'N° '+esc(g.number):'-'}</td><td>${kg(totalKg(o))} kg</td>
      <td class="de-money">${g?money(g.total):'-'}</td>
      <td><button class="icon-btn" data-de-edit="${esc(o.id)}" title="Editar"><i class="bi bi-pencil"></i></button></td>
    </tr>`).join(''):`<tr><td colspan="6" class="text-center text-muted py-4">No hay despachos registrados en ${monthLabel(currentMonth())}.</td></tr>`;
  }

  function readForm(){
    const data={clientId:$('deClient')?.value||'',date:$('deDate')?.value||'',guideNumber:($('deGuide')?.value||'').trim(),notes:$('deNotes')?.value||''};
    products.forEach(([key])=>data[key]=Math.max(0,Number(document.querySelector(`[name="${key}"]`)?.value||0)));
    if(editing){data.orderId=editing.orderId;data.guideId=editing.guideId;}
    return data;
  }

  async function save(){
    const data=readForm(),computed=calc();
    if(!data.clientId)return alert('Selecciona un cliente.');
    if(!data.date)return alert('Ingresa la fecha.');
    if(!data.guideNumber)return alert('Ingresa el número de guía.');
    if(computed.kilos<=0)return alert('Ingresa kilos en al menos un producto.');
    if(computed.missing.length)return alert('Hay productos sin precio configurado para este cliente.');

    const btn=$('deSave');btn.disabled=true;btn.innerHTML='<span class="spinner-border spinner-border-sm"></span> Guardando...';
    try{
      const res=await fetch(API,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
      const out=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(out.error||`HTTP ${res.status}`);

      const order={id:out.orderId,clientId:data.clientId,hallulla:data.hallulla,marraqueta:data.marraqueta,ciabatta:data.ciabatta,medioBaguette:data.medioBaguette,panCompleto:data.panCompleto,date:data.date,status:'Entregado',notes:data.notes};
      const oldGuide=(db.guides||[]).find(g=>g.id===out.guideId);
      const guide={id:out.guideId,number:data.guideNumber,clientId:data.clientId,date:data.date,kg:out.totalKg,total:out.total,paid:Number(out.paid||0),status:out.status||'Pendiente',notes:'Registrada desde Despachos'};
      db.orders=db.orders||[];db.guides=db.guides||[];
      db.orders=db.orders.some(o=>String(o.id)===String(order.id))?db.orders.map(o=>String(o.id)===String(order.id)?order:o):[order,...db.orders];
      db.guides=oldGuide?db.guides.map(g=>g.id===guide.id?guide:g):[guide,...db.guides];
      try{localStorage.setItem('panaderiaSistemaV1',JSON.stringify(db));}catch{}
      if(typeof toast==='function')toast(`Guía N° ${data.guideNumber} guardada por ${money(out.total)}`);
      clear(false);renderRecent();try{window.renderGuides?.();window.renderClients?.();window.renderDashboard?.();}catch{}
    }catch(e){alert(e.message||'No se pudo guardar el despacho');}
    finally{btn.disabled=false;btn.innerHTML='<i class="bi bi-check2-circle"></i> Guardar despacho y guía';}
  }

  function clear(resetDate=true){
    editing=null;
    if($('deClient'))$('deClient').value='';
    if($('deGuide'))$('deGuide').value='';
    if(resetDate&&$('deDate'))$('deDate').value=today();
    if($('deNotes'))$('deNotes').value='';
    products.forEach(([key])=>{const i=document.querySelector(`[name="${key}"]`);if(i)i.value=''});
    if($('deSave'))$('deSave').innerHTML='<i class="bi bi-check2-circle"></i> Guardar despacho y guía';
    calc();
  }

  function edit(id){
    const order=(db.orders||[]).find(o=>String(o.id)===String(id));if(!order)return;
    const guide=(db.guides||[]).find(g=>g.id===`dispatch-${id}`||g.id===`order-guide-${id}`);
    editing={orderId:order.id,guideId:guide?.id||`dispatch-${order.id}`};
    if($('deClient'))$('deClient').value=order.clientId;
    if($('deDate'))$('deDate').value=order.date||today();
    if($('deGuide'))$('deGuide').value=guide?.number||'';
    if($('deNotes'))$('deNotes').value=order.notes||'';
    products.forEach(([key])=>{const i=document.querySelector(`[name="${key}"]`);if(i)i.value=Number(order[key]||0)||''});
    calc();window.scrollTo({top:0,behavior:'smooth'});
  }

  function install(){
    injectStyles();
    const section=$('section-despachos');if(!section)return;
    section.innerHTML=`<div class="section-toolbar"><div><h2 class="section-inline-title">Despachos</h2><p class="muted mb-0">Carga rápida de pedidos ya realizados y cálculo automático de la guía.</p></div></div>${buildForm()}`;
    $('deClient')?.addEventListener('change',calc);
    products.forEach(([key])=>document.querySelector(`[name="${key}"]`)?.addEventListener('input',calc));
    $('deSave')?.addEventListener('click',save);
    $('deClear')?.addEventListener('click',()=>clear(true));
    $('deRecentBody')?.addEventListener('click',e=>{const b=e.target.closest('[data-de-edit]');if(b)edit(b.dataset.deEdit)});
    document.querySelector('[data-section="despachos"]')?.addEventListener('click',()=>setTimeout(()=>{renderRecent();calc()},0));
    calc();renderRecent();

    // El antiguo módulo de Pedidos queda fuera de la navegación; Despachos es el punto de ingreso.
    document.querySelector('[data-section="pedidos"]')?.remove();
    $('section-pedidos')?.remove();
    document.querySelectorAll('[data-action="new-order"]').forEach(el=>el.remove());
    const hist=document.querySelector('#historyDispatchNav');if(hist)hist.remove();
    $('section-historial-despachos')?.remove();
  }

  window.addEventListener('DOMContentLoaded',()=>setTimeout(install,80));
  window.addEventListener('load',()=>setTimeout(()=>{renderRecent();calc()},300));
  window.panaderiaDespachos={render:renderRecent,edit,clear};
})();
