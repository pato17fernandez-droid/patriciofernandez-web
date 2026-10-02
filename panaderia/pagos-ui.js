(() => {
  const $id = id => document.getElementById(id);
  const MONTH_KEY = 'panaderiaMesTrabajo';
  const fmtKg = n => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const fmtDate2 = d => { if (!d) return ''; const [y,m,day] = d.split('-'); return `${day}-${m}-${y}`; };
  const esc2 = s => String(s ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));

  function workingMonth(){ return localStorage.getItem(MONTH_KEY) || new Date().toISOString().slice(0,7); }
  function pendingGuidesForMonth(){
    const month = workingMonth();
    return (db.guides || []).filter(g => (g.date || '').slice(0,7) === month && guideBalance(g) > 0);
  }

  function clientPendingSummary(clientId){
    const guides = pendingGuidesForMonth().filter(g => g.clientId === clientId);
    return {
      count: guides.length,
      balance: guides.reduce((s,g) => s + guideBalance(g), 0)
    };
  }

  function paymentModal(){
    currentAction = 'payment';
    currentEditId = null;
    const month = workingMonth();
    const [y,m] = month.split('-').map(Number);
    const monthLabel = new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());

    $('modalTitle').textContent = 'Registrar pago';
    $('modalSubtitle').textContent = `Guías pendientes de ${monthLabel}`;
    $('modalSubmit').classList.remove('d-none');
    $('modalBody').innerHTML = `
      <div class="payment-search-box mb-3">
        <label class="form-label fw-semibold">Buscar cliente</label>
        <div class="search-control w-100">
          <i class="bi bi-search"></i>
          <input id="paymentClientSearch" class="form-control" autocomplete="off" placeholder="Escribe el nombre del cliente...">
        </div>
        <div id="paymentClientResults" class="payment-client-results mt-2"></div>
      </div>

      <div id="paymentSelectedClient" class="alert alert-light border d-none mb-3"></div>

      <div class="form-grid">
        <div class="full">
          <label class="form-label fw-semibold">Guía que está pagando</label>
          <select id="paymentGuideSelect" name="guideId" class="form-select" required disabled>
            <option value="">Primero busca y selecciona un cliente</option>
          </select>
        </div>
        <div>
          <label class="form-label">Fecha del pago</label>
          <input name="date" type="date" class="form-control" value="${today()}" required>
        </div>
        <div>
          <label class="form-label">Monto</label>
          <input id="paymentAmount" name="amount" type="number" min="1" class="form-control" required readonly>
          <div class="form-text">Se completa automáticamente con el saldo de la guía.</div>
        </div>
        <div>
          <label class="form-label">Medio de pago</label>
          <select name="method" class="form-select">
            <option>Transferencia</option><option>Efectivo</option><option>Cheque</option><option>Otro</option>
          </select>
        </div>
        <div class="full">
          <div id="paymentGuideDetail" class="payment-guide-detail d-none"></div>
        </div>
        <div class="full">
          <label class="form-label">Detalle / observación</label>
          <textarea id="paymentNotes" name="notes" class="form-control" rows="3" placeholder="Se completará automáticamente al elegir la guía"></textarea>
        </div>
      </div>`;

    const search = $id('paymentClientSearch');
    const results = $id('paymentClientResults');
    const guideSelect = $id('paymentGuideSelect');
    let selectedClientId = '';

    function renderClients(q=''){
      const term = q.trim().toLowerCase();
      if (!term) { results.innerHTML = '<div class="text-muted small px-2 py-2">Escribe al menos una parte del nombre.</div>'; return; }
      const matches = (db.clients || [])
        .filter(c => c.active !== false && (c.name || '').toLowerCase().includes(term))
        .map(c => ({c, s:clientPendingSummary(c.id)}))
        .filter(x => x.s.count > 0)
        .slice(0,12);
      results.innerHTML = matches.length ? matches.map(({c,s}) => `
        <button type="button" class="payment-client-item" data-client="${esc2(c.id)}">
          <span><strong>${esc2(c.name)}</strong><small>${s.count} guía${s.count===1?'':'s'} pendiente${s.count===1?'':'s'}</small></span>
          <strong class="money-pending">${money(s.balance)}</strong>
        </button>`).join('') : `<div class="text-muted small px-2 py-2">No hay clientes con guías pendientes en ${monthLabel} que coincidan.</div>`;
      results.querySelectorAll('[data-client]').forEach(btn => btn.addEventListener('click', () => selectClient(btn.dataset.client)));
    }

    function selectClient(clientId){
      selectedClientId = clientId;
      const c = getClient(clientId);
      const guides = pendingGuidesForMonth().filter(g => g.clientId === clientId).sort((a,b) => String(a.date).localeCompare(String(b.date)));
      const summary = clientPendingSummary(clientId);
      search.value = c?.name || '';
      results.innerHTML = '';
      const box = $id('paymentSelectedClient');
      box.classList.remove('d-none');
      box.innerHTML = `<div class="d-flex justify-content-between align-items-center gap-2 flex-wrap"><div><strong>${esc2(c?.name || 'Cliente')}</strong><div class="small text-muted">${guides.length} guía${guides.length===1?'':'s'} pendiente${guides.length===1?'':'s'} en ${monthLabel}</div></div><strong class="money-pending">Total pendiente: ${money(summary.balance)}</strong></div>`;
      guideSelect.disabled = false;
      guideSelect.innerHTML = `<option value="">Seleccione la guía...</option>` + guides.map(g => `<option value="${esc2(g.id)}">N° ${esc2(g.number)} · ${fmtDate2(g.date)} · saldo ${money(guideBalance(g))}</option>`).join('');
      clearGuide();
      if (guides.length === 1) { guideSelect.value = guides[0].id; fillGuide(guides[0].id); }
    }

    function clearGuide(){
      $id('paymentAmount').value = '';
      $id('paymentGuideDetail').classList.add('d-none');
      $id('paymentGuideDetail').innerHTML = '';
      $id('paymentNotes').value = '';
    }

    function fillGuide(guideId){
      const g = (db.guides || []).find(x => x.id === guideId && x.clientId === selectedClientId);
      if (!g) { clearGuide(); return; }
      const bal = guideBalance(g);
      $id('paymentAmount').value = Math.round(bal);
      const detail = $id('paymentGuideDetail');
      detail.classList.remove('d-none');
      detail.innerHTML = `
        <div class="payment-detail-title"><i class="bi bi-receipt"></i> Detalle de lo que paga</div>
        <div class="payment-detail-grid">
          <div><span>Guía</span><strong>N° ${esc2(g.number)}</strong></div>
          <div><span>Fecha guía</span><strong>${fmtDate2(g.date)}</strong></div>
          <div><span>Kilos</span><strong>${fmtKg(g.kg)} kg</strong></div>
          <div><span>Total guía</span><strong>${money(g.total)}</strong></div>
          <div><span>Pagado antes</span><strong>${money(g.paid)}</strong></div>
          <div><span>Saldo a pagar</span><strong class="money-pending">${money(bal)}</strong></div>
        </div>`;
      $id('paymentNotes').value = `Pago guía N° ${g.number} · ${fmtDate2(g.date)} · ${fmtKg(g.kg)} kg · total ${money(g.total)} · saldo pagado ${money(bal)}`;
    }

    search.addEventListener('input', () => { selectedClientId=''; guideSelect.disabled=true; guideSelect.innerHTML='<option value="">Primero selecciona un cliente</option>'; $id('paymentSelectedClient').classList.add('d-none'); clearGuide(); renderClients(search.value); });
    guideSelect.addEventListener('change', () => fillGuide(guideSelect.value));
    renderClients('');
    bootstrap.Modal.getOrCreateInstance($('entityModal')).show();
  }

  window.addEventListener('DOMContentLoaded', () => {
    try {
      const originalOpenModal = openModal;
      openModal = function(action,id=null){
        if (action === 'payment') return paymentModal();
        return originalOpenModal(action,id);
      };
    } catch(e) { console.warn('No se pudo activar el buscador de pagos', e); }
  });
})();
