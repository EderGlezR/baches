const client = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const form = document.getElementById("report-form");
const personaRegistraInput = document.getElementById("persona_registra");
const fotoInput = document.getElementById("foto");
const categoriaInput = document.getElementById("categoria");
const nombreContactoInput = document.getElementById("nombre_contacto");
const telefonoContactoInput = document.getElementById("telefono_contacto");
const calleInput = document.getElementById("calle");
const numeroInput = document.getElementById("numero");
const coloniaInput = document.getElementById("colonia");
const ubicacionBtn = document.getElementById("ubicacion-btn");
const ubicacionMapaBtn = document.getElementById("ubicacion-mapa-btn");
const mapaSeleccionDiv = document.getElementById("mapa-seleccion");
const ubicacionEstado = document.getElementById("ubicacion-estado");
const submitBtn = document.getElementById("submit-btn");
const formMensaje = document.getElementById("form-mensaje");
const reportesLista = document.getElementById("reportes-lista");

let ubicacion = null;

const CATEGORIA_LABEL = { leve: "Leve", moderado: "Moderado", severo: "Severo" };
const ESTATUS_LABEL = {
  reportado: "Reportado",
  en_revision: "En revisión",
  en_reparacion: "En reparación",
  reparado: "Reparado",
};
const ESTATUS_COLOR = {
  reportado: "#dc2626",
  en_revision: "#f59e0b",
  en_reparacion: "#f59e0b",
  reparado: "#16a34a",
};

function formatearDireccion(reporte) {
  const calleNumero = [reporte.calle, reporte.numero].filter(Boolean).join(" ");
  return [calleNumero, reporte.colonia].filter(Boolean).join(", ");
}

const CENTRO_DEFAULT = [25.6866, -100.3161];

// Tiles precargados de la zona metropolitana de Monterrey (ver scripts/download-tiles.js).
// Fuera de este rango de zoom, o si el tile local no existe, se cae a OpenStreetMap en línea.
const TILES_ZOOM_MIN_LOCAL = 11;
const TILES_ZOOM_MAX_LOCAL = 16;
const TILE_URL_LOCAL = "tiles/{z}/{x}/{y}.png";
const TILE_URL_REMOTO = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const TileLayerConRespaldo = L.TileLayer.extend({
  createTile(coords, done) {
    const tile = document.createElement("img");

    tile.onload = () => done(null, tile);
    tile.onerror = () => {
      if (tile.dataset.respaldo) {
        done(new Error("tile no disponible"), tile);
        return;
      }
      tile.dataset.respaldo = "1";
      tile.src = L.Util.template(TILE_URL_REMOTO, {
        ...coords,
        s: TileLayerConRespaldo.subdominios[Math.abs(coords.x + coords.y) % TileLayerConRespaldo.subdominios.length],
      });
    };

    if (coords.z < TILES_ZOOM_MIN_LOCAL || coords.z > TILES_ZOOM_MAX_LOCAL) {
      tile.dataset.respaldo = "1";
      tile.src = L.Util.template(TILE_URL_REMOTO, {
        ...coords,
        s: TileLayerConRespaldo.subdominios[Math.abs(coords.x + coords.y) % TileLayerConRespaldo.subdominios.length],
      });
    } else {
      tile.src = this.getTileUrl(coords);
    }

    return tile;
  },
});
TileLayerConRespaldo.subdominios = ["a", "b", "c"];

function crearCapaTiles() {
  return new TileLayerConRespaldo(TILE_URL_LOCAL, {
    attribution: "&copy; OpenStreetMap contributors &copy; MapTiler",
    minZoom: 3,
    maxZoom: 18,
  });
}

const mapa = L.map("mapa").setView(CENTRO_DEFAULT, 12);
crearCapaTiles().addTo(mapa);
let marcadores = [];

function dibujarMapa(reportes) {
  for (const marcador of marcadores) mapa.removeLayer(marcador);
  marcadores = [];

  for (const reporte of reportes) {
    const marcador = L.circleMarker([reporte.latitud, reporte.longitud], {
      radius: 8,
      color: "#fff",
      weight: 1,
      fillColor: ESTATUS_COLOR[reporte.estatus] ?? "#666",
      fillOpacity: 0.9,
    })
      .addTo(mapa)
      .bindPopup(
        `<strong>${CATEGORIA_LABEL[reporte.categoria] ?? reporte.categoria}</strong><br>${ESTATUS_LABEL[reporte.estatus] ?? reporte.estatus}`
      );
    marcadores.push(marcador);
  }

  if (reportes.length) {
    mapa.fitBounds(marcadores.map((m) => m.getLatLng()), { maxZoom: 15, padding: [20, 20] });
  }
}

ubicacionBtn.addEventListener("click", () => {
  ocultarMapaSeleccion();
  if (!navigator.geolocation) {
    ubicacionEstado.textContent = "Tu navegador no soporta geolocalización.";
    return;
  }
  ubicacionEstado.textContent = "Obteniendo ubicación...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      ubicacion = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      ubicacionEstado.textContent = `Ubicación capturada: ${ubicacion.lat.toFixed(5)}, ${ubicacion.lng.toFixed(5)}`;
    },
    () => {
      ubicacionEstado.textContent = "No se pudo obtener la ubicación. Revisa los permisos del navegador.";
    }
  );
});

const PIN_ROJO = L.divIcon({
  className: "pin-seleccion",
  html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27c0-8.3-6.7-15-15-15z" fill="#c0392b" stroke="#fff" stroke-width="1.5"/>
      <circle cx="15" cy="15" r="5.5" fill="#fff"/>
    </svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

let mapaSeleccion = null;
let marcadorSeleccion = null;

function actualizarUbicacionSeleccion(lat, lng) {
  ubicacion = { lat, lng };
  ubicacionEstado.textContent = `Ubicación seleccionada: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function mostrarMapaSeleccion() {
  mapaSeleccionDiv.hidden = false;

  const centro = ubicacion ? [ubicacion.lat, ubicacion.lng] : CENTRO_DEFAULT;

  if (!mapaSeleccion) {
    mapaSeleccion = L.map(mapaSeleccionDiv).setView(centro, 14);
    crearCapaTiles().addTo(mapaSeleccion);

    marcadorSeleccion = L.marker(centro, { draggable: true, icon: PIN_ROJO }).addTo(mapaSeleccion);
    marcadorSeleccion.on("dragend", () => {
      const { lat, lng } = marcadorSeleccion.getLatLng();
      actualizarUbicacionSeleccion(lat, lng);
    });

    mapaSeleccion.on("click", (e) => {
      marcadorSeleccion.setLatLng(e.latlng);
      actualizarUbicacionSeleccion(e.latlng.lat, e.latlng.lng);
    });
  } else {
    mapaSeleccion.setView(centro, 14);
    marcadorSeleccion.setLatLng(centro);
  }

  actualizarUbicacionSeleccion(centro[0], centro[1]);

  setTimeout(() => mapaSeleccion.invalidateSize(), 0);
}

function ocultarMapaSeleccion() {
  mapaSeleccionDiv.hidden = true;
}

ubicacionMapaBtn.addEventListener("click", () => {
  mostrarMapaSeleccion();
});

async function subirReporte(datosReporte, foto) {
  const path = `${Date.now()}-${foto.name}`;
  const { error: uploadError } = await client.storage.from("fotos").upload(path, foto);
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = client.storage.from("fotos").getPublicUrl(path);

  const { error: insertError } = await client.from("reportes").insert({
    ...datosReporte,
    foto_url: publicUrlData.publicUrl,
  });
  if (insertError) throw insertError;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMensaje.textContent = "";

  const personaRegistra = personaRegistraInput.value.trim();
  const foto = fotoInput.files[0];
  const categoria = categoriaInput.value;

  if (!personaRegistra || !foto || !categoria || !ubicacion) {
    formMensaje.textContent = "Falta persona que registra, foto, categoría o ubicación.";
    return;
  }

  submitBtn.disabled = true;

  const datosReporte = {
    latitud: ubicacion.lat,
    longitud: ubicacion.lng,
    categoria,
    persona_registra: personaRegistra,
    nombre_contacto: nombreContactoInput.value.trim() || null,
    telefono_contacto: telefonoContactoInput.value.trim() || null,
    calle: calleInput.value.trim() || null,
    numero: numeroInput.value.trim() || null,
    colonia: coloniaInput.value.trim() || null,
  };

  if (!navigator.onLine) {
    await OfflineBaches.guardarPendiente({ datosReporte, foto });
    formMensaje.textContent = "Sin conexión: reporte guardado en el dispositivo. Se enviará cuando haya internet.";
    form.reset();
    ubicacion = null;
    ubicacionEstado.textContent = "Ubicación no capturada todavía.";
    ocultarMapaSeleccion();
    submitBtn.disabled = false;
    return;
  }

  formMensaje.textContent = "Enviando reporte...";

  try {
    await subirReporte(datosReporte, foto);

    formMensaje.textContent = "¡Reporte enviado! Gracias por ayudar a tu comunidad.";
    form.reset();
    ubicacion = null;
    ubicacionEstado.textContent = "Ubicación no capturada todavía.";
    ocultarMapaSeleccion();
    cargarReportes();
  } catch (err) {
    await OfflineBaches.guardarPendiente({ datosReporte, foto });
    formMensaje.textContent = "No se pudo enviar por la red: se guardó en el dispositivo y se reintentará automáticamente.";
    form.reset();
    ubicacion = null;
    ubicacionEstado.textContent = "Ubicación no capturada todavía.";
    ocultarMapaSeleccion();
  } finally {
    submitBtn.disabled = false;
  }
});

async function sincronizarPendientes() {
  const pendientes = await OfflineBaches.listarPendientes();
  for (const pendiente of pendientes) {
    try {
      await subirReporte(pendiente.datosReporte, pendiente.foto);
      await OfflineBaches.eliminarPendiente(pendiente.id);
    } catch {
      break;
    }
  }
  if (pendientes.length) cargarReportes();
}

OfflineBaches.alRecuperarConexion(sincronizarPendientes);

function pintarReportes(data, { sinConexion = false } = {}) {
  dibujarMapa(data);

  if (!data.length) {
    reportesLista.textContent = sinConexion
      ? "Sin conexión y sin reportes guardados todavía."
      : "Todavía no hay reportes.";
    return;
  }

  reportesLista.innerHTML = "";
  if (sinConexion) {
    const aviso = document.createElement("p");
    aviso.textContent = "Sin conexión: mostrando la última copia guardada en el dispositivo.";
    reportesLista.appendChild(aviso);
  }
  for (const reporte of data) {
    const card = document.createElement("article");
    const direccion = formatearDireccion(reporte);
    card.className = "reporte-card";
    card.innerHTML = `
      <img src="${reporte.foto_url}" alt="Foto del bache" loading="lazy" />
      <div>
        <p><strong>${CATEGORIA_LABEL[reporte.categoria] ?? reporte.categoria}</strong> · ${ESTATUS_LABEL[reporte.estatus] ?? reporte.estatus}</p>
        ${direccion ? `<p>${direccion}</p>` : ""}
        <p>${reporte.latitud.toFixed(5)}, ${reporte.longitud.toFixed(5)}</p>
        <p>${new Date(reporte.creado_en).toLocaleString("es-MX")}</p>
      </div>
    `;
    reportesLista.appendChild(card);
  }
}

async function cargarReportes() {
  const { data, error } = await client
    .from("reportes_publicos")
    .select("*")
    .order("creado_en", { ascending: false });

  if (error) {
    const cache = await OfflineBaches.obtenerCache();
    pintarReportes(cache, { sinConexion: true });
    return;
  }

  await OfflineBaches.guardarCache(data);
  pintarReportes(data);
}

cargarReportes();
sincronizarPendientes();
