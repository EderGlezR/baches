const client = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const form = document.getElementById("report-form");
const personaRegistraInput = document.getElementById("persona_registra");
const fotoInput = document.getElementById("foto");
const categoriaInput = document.getElementById("categoria");
const nombreContactoInput = document.getElementById("nombre_contacto");
const telefonoContactoInput = document.getElementById("telefono_contacto");
const ubicacionBtn = document.getElementById("ubicacion-btn");
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

const CENTRO_DEFAULT = [25.6866, -100.3161];
const mapa = L.map("mapa").setView(CENTRO_DEFAULT, 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
}).addTo(mapa);
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
  formMensaje.textContent = "Enviando reporte...";

  try {
    const path = `${Date.now()}-${foto.name}`;
    const { error: uploadError } = await client.storage.from("fotos").upload(path, foto);
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = client.storage.from("fotos").getPublicUrl(path);

    const { error: insertError } = await client.from("reportes").insert({
      foto_url: publicUrlData.publicUrl,
      latitud: ubicacion.lat,
      longitud: ubicacion.lng,
      categoria,
      persona_registra: personaRegistra,
      nombre_contacto: nombreContactoInput.value.trim() || null,
      telefono_contacto: telefonoContactoInput.value.trim() || null,
    });
    if (insertError) throw insertError;

    formMensaje.textContent = "¡Reporte enviado! Gracias por ayudar a tu comunidad.";
    form.reset();
    ubicacion = null;
    ubicacionEstado.textContent = "Ubicación no capturada todavía.";
    cargarReportes();
  } catch (err) {
    formMensaje.textContent = `Error al enviar el reporte: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});

async function cargarReportes() {
  const { data, error } = await client
    .from("reportes_publicos")
    .select("*")
    .order("creado_en", { ascending: false });

  if (error) {
    reportesLista.textContent = `No se pudieron cargar los reportes: ${error.message}`;
    return;
  }

  dibujarMapa(data);

  if (!data.length) {
    reportesLista.textContent = "Todavía no hay reportes.";
    return;
  }

  reportesLista.innerHTML = "";
  for (const reporte of data) {
    const card = document.createElement("article");
    card.className = "reporte-card";
    card.innerHTML = `
      <img src="${reporte.foto_url}" alt="Foto del bache" loading="lazy" />
      <div>
        <p><strong>${CATEGORIA_LABEL[reporte.categoria] ?? reporte.categoria}</strong> · ${ESTATUS_LABEL[reporte.estatus] ?? reporte.estatus}</p>
        <p>${reporte.latitud.toFixed(5)}, ${reporte.longitud.toFixed(5)}</p>
        <p>${new Date(reporte.creado_en).toLocaleString("es-MX")}</p>
      </div>
    `;
    reportesLista.appendChild(card);
  }
}

cargarReportes();
