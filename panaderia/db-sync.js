(() => {
  const API = '/api/panaderia/state';
  const LOCAL_KEY = 'panaderiaSistemaV1';
  let syncing = false;
  let remoteReady = false;

  async function loadRemote() {
    try {
      const r = await fetch(API, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data && Array.isArray(data.clients)) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
        if (typeof db !== 'undefined') db = data;
        remoteReady = true;
        if (typeof renderAll === 'function') renderAll();
        console.info('Panadería: datos cargados desde Cloudflare D1');
      }
    } catch (e) {
      console.warn('Panadería: no se pudo cargar D1, se mantiene copia local.', e);
    }
  }

  async function pushRemote(snapshot) {
    if (syncing) return;
    syncing = true;
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(snapshot)
      });
      if (!r.ok) {
        const detail = await r.text();
        throw new Error(`${r.status}: ${detail}`);
      }
      remoteReady = true;
      console.info('Panadería: cambios guardados en Cloudflare D1');
    } catch (e) {
      console.error('Panadería: error guardando en D1.', e);
      if (typeof toast === 'function') toast('No se pudo sincronizar con la base de datos');
    } finally {
      syncing = false;
    }
  }

  window.addEventListener('DOMContentLoaded', async () => {
    await loadRemote();

    if (typeof saveData === 'function') {
      const originalSaveData = saveData;
      saveData = function () {
        originalSaveData();
        try {
          pushRemote(db);
        } catch (e) {
          console.error(e);
        }
      };
    }

    window.panaderiaDbStatus = () => ({ remoteReady });
  });
})();
