(() => {
  const ROUTES=[
    {key:'ZONA LACUSTRE',label:'ZONA LACUSTRE',order:['cli-km-06','cli-israel-nancul','cli-fredy','cli-leonardo','cli-cyd','cli-hernan-astorga-pucon','cli-ibacache','cli-san-pedro','cli-el-refugio','cli-mys','cli-jjyd']},
    {key:'FREIRE-PITRUFQUEN-TEMUCO',label:'FREIRE · PITRUFQUÉN · TEMUCO',order:['cli-jerry','cli-isabel-pitru','cli-andrea-gorbea','cli-tote','cli-tote-2','cli-viejo-mundo','cli-walter','cli-metrenco','cli-el-huerto-jaramillo','cli-monica-san-ramon','cli-david-choroico','cli-la-vuelta','cli-rustico','cli-wilson']},
    {key:'LAURELES - MELIPEUCO',label:'LAURELES · MELIPEUCO',order:['cli-maria-flores','cli-maria-flores-cunco','cli-mica','cli-sandra','cli-la-coope','cli-la-coopeh','cli-el-laurel','cli-la-estrella','cli-texia-melipeuco','cli-don-juan-melipeuco']}
  ];
  const routeKey=c=>String(c?.route||c?.zone||'SIN RUTA').trim().toUpperCase();
  const pos=c=>{
    const key=routeKey(c),gi=ROUTES.findIndex(g=>g.key===key);
    const oi=gi>=0?ROUTES[gi].order.indexOf(c.id):-1;
    return [gi>=0?gi:999,oi>=0?oi:999,String(c?.name||'')];
  };
  const cmp=(a,b)=>{const A=pos(a),B=pos(b);return A[0]-B[0]||A[1]-B[1]||A[2].localeCompare(B[2],'es')};
  function safe(s){return typeof esc==='function'?esc(s):String(s??'')}
  function renderByRoute(){
    if(typeof db==='undefined'||!document.getElementById('clientsTable'))return;
    try{if(typeof ensureClientCatalog==='function')ensureClientCatalog()}catch{}
    const search=(document.getElementById('clientSearch')?.value||'').toLowerCase();
    const list=(db.clients||[]).filter(c=>c.active!==false).filter(c=>[c.name,c.rut,c.commune,c.route,c.zone].some(v=>String(v||'').toLowerCase().includes(search))).sort(cmp);
    if(!list.length){document.getElementById('clientsTable').innerHTML=typeof emptyRow==='function'?emptyRow(8,'Aún no hay clientes registrados'):'<tr><td colspan="8">Sin clientes</td></tr>';return}
    let last='';
    document.getElementById('clientsTable').innerHTML=list.map(c=>{
      const key=routeKey(c),g=ROUTES.find(x=>x.key===key),label=g?.label||(c.route||c.zone||'SIN RUTA');
      const header=label!==last?`<tr class="client-route-row"><td colspan="8"><i class="bi bi-signpost-split"></i> <strong>${safe(label)}</strong></td></tr>`:'';
      last=label;
      const balance=typeof clientBalance==='function'?clientBalance(c.id):0;
      const trays=typeof clientTrayBalance==='function'?clientTrayBalance(c.id):0;
      const oven=typeof badge==='function'?(c.oven?badge('Operativo'):badge('Inactivo')):(c.oven?'Sí':'No');
      return header+`<tr><td><strong>${safe(c.name)}</strong><div class="text-muted small">${safe(c.contact||'')}</div></td><td>${safe(c.rut||'-')}</td><td>${safe(c.commune||'-')}</td><td>${safe(c.route||c.zone||'-')}</td><td>${oven}</td><td class="${balance>0?'money-pending':'money-positive'}">${typeof money==='function'?money(balance):balance}</td><td>${trays}</td><td><button class="icon-btn" onclick="openClientDetail('${c.id}')"><i class="bi bi-eye"></i></button> <button class="icon-btn" onclick="editClient('${c.id}')"><i class="bi bi-pencil"></i></button></td></tr>`;
    }).join('');
  }
  function install(){
    if(!document.getElementById('clientRouteStyle')){
      const st=document.createElement('style');st.id='clientRouteStyle';st.textContent='.client-route-row td{background:#f5f6f8!important;color:#505765;font-size:.78rem;letter-spacing:.04em;padding-top:10px!important;padding-bottom:10px!important;border-top:2px solid #e3e6eb!important}.client-route-row i{margin-right:5px}';document.head.appendChild(st);
    }
    try{renderClients=renderByRoute}catch{}
    window.renderClients=renderByRoute;
    document.getElementById('clientSearch')?.addEventListener('input',renderByRoute);
    renderByRoute();
    setTimeout(renderByRoute,700);
  }
  window.addEventListener('DOMContentLoaded',install);
  window.addEventListener('load',()=>setTimeout(install,50));
})();
