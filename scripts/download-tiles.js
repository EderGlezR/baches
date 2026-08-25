// Descarga tiles de MapTiler para la zona metropolitana de Monterrey y los guarda
// en tiles/{z}/{x}/{y}.png para que la app los use offline (ver app.js: TILE_URL_LOCAL).
//
// Uso:
//   MAPTILER_KEY=tu_api_key node scripts/download-tiles.js
//
// Requiere una cuenta gratuita en https://www.maptiler.com/ (su plan gratuito permite
// exportar tiles para uso offline en apps propias; revisa los términos vigentes en tu cuenta).

const fs = require("fs/promises");
const path = require("path");

const MAPTILER_KEY = process.env.MAPTILER_KEY;
if (!MAPTILER_KEY) {
  console.error("Falta la variable de entorno MAPTILER_KEY. Ejemplo:");
  console.error("  MAPTILER_KEY=tu_api_key node scripts/download-tiles.js");
  process.exit(1);
}

// Debe coincidir con TILES_ZOOM_MIN_LOCAL / TILES_ZOOM_MAX_LOCAL en app.js.
const ZOOM_MIN = 11;
const ZOOM_MAX = 16;

// Bounding box de la zona metropolitana de Monterrey.
const BBOX = { norte: 25.85, sur: 25.55, este: -100.15, oeste: -100.5 };

const TILE_TEMPLATE = `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
const OUT_DIR = path.join(__dirname, "..", "docs", "tiles");
const CONCURRENCIA = 3;
const REINTENTOS_429 = 5;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lonAX(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latAY(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom
  );
}

function listarTiles() {
  const tiles = [];
  for (let z = ZOOM_MIN; z <= ZOOM_MAX; z++) {
    const xMin = lonAX(BBOX.oeste, z);
    const xMax = lonAX(BBOX.este, z);
    const yMin = latAY(BBOX.norte, z);
    const yMax = latAY(BBOX.sur, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

async function descargarTile({ z, x, y }) {
  const destino = path.join(OUT_DIR, String(z), String(x), `${y}.png`);
  try {
    await fs.access(destino);
    return "existente";
  } catch {
    // no existe, continuar con la descarga
  }

  const url = TILE_TEMPLATE.replace("{z}", z).replace("{x}", x).replace("{y}", y);

  for (let intento = 0; ; intento++) {
    const respuesta = await fetch(url);
    if (respuesta.ok) {
      const buffer = Buffer.from(await respuesta.arrayBuffer());
      await fs.mkdir(path.dirname(destino), { recursive: true });
      await fs.writeFile(destino, buffer);
      return "descargado";
    }

    if (respuesta.status === 429 && intento < REINTENTOS_429) {
      await esperar(1000 * 2 ** intento);
      continue;
    }

    throw new Error(`HTTP ${respuesta.status} al descargar ${url}`);
  }
}

async function main() {
  const tiles = listarTiles();
  console.log(`Descargando ${tiles.length} tiles (zoom ${ZOOM_MIN}-${ZOOM_MAX}) a ${OUT_DIR}...`);

  let completados = 0;
  let fallidos = 0;
  let indice = 0;

  async function trabajador() {
    while (indice < tiles.length) {
      const tile = tiles[indice++];
      try {
        await descargarTile(tile);
      } catch (err) {
        fallidos++;
        console.error(`Error en tile ${tile.z}/${tile.x}/${tile.y}: ${err.message}`);
      }
      completados++;
      if (completados % 50 === 0 || completados === tiles.length) {
        console.log(`${completados}/${tiles.length} tiles procesados`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));

  console.log(`Listo. ${completados - fallidos} tiles guardados, ${fallidos} con error.`);
}

main();
