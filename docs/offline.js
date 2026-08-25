const DB_NAME = "baches-offline";
const DB_VERSION = 1;
const STORE_PENDIENTES = "pendientes";
const STORE_CACHE = "cache_reportes";

function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PENDIENTES)) {
        db.createObjectStore(STORE_PENDIENTES, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: "clave" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function conTienda(nombreTienda, modo, fn) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nombreTienda, modo);
    const tienda = tx.objectStore(nombreTienda);
    const resultado = fn(tienda);
    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => reject(tx.error);
  });
}

function solicitudAPromesa(solicitud) {
  return new Promise((resolve, reject) => {
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

async function guardarPendiente(reporte) {
  return conTienda(STORE_PENDIENTES, "readwrite", (tienda) => {
    tienda.add({ ...reporte, creado_en_local: new Date().toISOString() });
  });
}

async function listarPendientes() {
  const db = await abrirDB();
  const tx = db.transaction(STORE_PENDIENTES, "readonly");
  return solicitudAPromesa(tx.objectStore(STORE_PENDIENTES).getAll());
}

async function eliminarPendiente(id) {
  return conTienda(STORE_PENDIENTES, "readwrite", (tienda) => {
    tienda.delete(id);
  });
}

async function guardarCache(reportes) {
  return conTienda(STORE_CACHE, "readwrite", (tienda) => {
    tienda.put({ clave: "reportes_publicos", datos: reportes });
  });
}

async function obtenerCache() {
  const db = await abrirDB();
  const tx = db.transaction(STORE_CACHE, "readonly");
  const registro = await solicitudAPromesa(tx.objectStore(STORE_CACHE).get("reportes_publicos"));
  return registro?.datos ?? [];
}

function obtenerNetworkPlugin() {
  return window.Capacitor?.Plugins?.Network ?? null;
}

function alRecuperarConexion(callback) {
  const networkPlugin = obtenerNetworkPlugin();
  if (networkPlugin) {
    networkPlugin.addListener("networkStatusChange", (estado) => {
      if (estado.connected) callback();
    });
    return;
  }
  window.addEventListener("online", callback);
}

window.OfflineBaches = {
  guardarPendiente,
  listarPendientes,
  eliminarPendiente,
  guardarCache,
  obtenerCache,
  alRecuperarConexion,
};
