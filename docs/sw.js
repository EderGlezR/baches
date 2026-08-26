const CACHE_VERSION = "baches-v1";
const CACHE_SHELL = `${CACHE_VERSION}-shell`;
const CACHE_TILES = `${CACHE_VERSION}-tiles`;

const ARCHIVOS_SHELL = [
  "index.html",
  "admin.html",
  "style.css",
  "app.js",
  "admin.js",
  "config.js",
  "offline.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon.svg",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      await Promise.allSettled(
        ARCHIVOS_SHELL.map((url) => cache.add(new Request(url, { mode: "cors" })))
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith("baches-") && nombre !== CACHE_SHELL && nombre !== CACHE_TILES)
          .map((nombre) => caches.delete(nombre))
      );
      await self.clients.claim();
      await precargarTiles();
    })()
  );
});

async function precargarTiles() {
  try {
    const cache = await caches.open(CACHE_TILES);
    const respuesta = await fetch("tiles-manifest.json");
    const rutas = await respuesta.json();

    const CONCURRENCIA = 6;
    let indice = 0;
    async function trabajador() {
      while (indice < rutas.length) {
        const ruta = rutas[indice++];
        const yaExiste = await cache.match(ruta);
        if (yaExiste) continue;
        try {
          const resp = await fetch(ruta);
          if (resp.ok) await cache.put(ruta, resp);
        } catch {
          // sin conexión o tile no disponible; se reintentará en la próxima activación
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));
  } catch {
    // no bloquea la app si falla la precarga de tiles
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const esTile = url.pathname.includes("/tiles/");

  if (esTile) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_TILES);
        const enCache = await cache.match(request);
        if (enCache) return enCache;
        try {
          const resp = await fetch(request);
          if (resp.ok) cache.put(request, resp.clone());
          return resp;
        } catch (err) {
          return enCache || Response.error();
        }
      })()
    );
    return;
  }

  const esSupabase = url.hostname.endsWith("supabase.co");
  if (esSupabase) return; // siempre red, nunca cache (datos vivos)

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      const enCache = await cache.match(request);
      const enRed = fetch(request)
        .then((resp) => {
          if (resp.ok) cache.put(request, resp.clone());
          return resp;
        })
        .catch(() => enCache);
      return enCache || enRed;
    })()
  );
});
