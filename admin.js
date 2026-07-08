const client = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginMensaje = document.getElementById("login-mensaje");
const adminPanel = document.getElementById("admin-panel");
const sesionInfo = document.getElementById("sesion-info");
const logoutBtn = document.getElementById("logout-btn");
const adminLista = document.getElementById("admin-lista");

const CATEGORIA_LABEL = { leve: "Leve", moderado: "Moderado", severo: "Severo" };
const ESTATUS_LABEL = {
  reportado: "Reportado",
  en_revision: "En revisión",
  en_reparacion: "En reparación",
  reparado: "Reparado",
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMensaje.textContent = "Entrando...";
  const { error } = await client.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value,
  });
  if (error) {
    loginMensaje.textContent = `Error: ${error.message}`;
    return;
  }
  loginMensaje.textContent = "";
  mostrarPanel();
});

logoutBtn.addEventListener("click", async () => {
  await client.auth.signOut();
  adminPanel.hidden = true;
  loginForm.hidden = false;
});

async function mostrarPanel() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) return;

  loginForm.hidden = true;
  adminPanel.hidden = false;
  sesionInfo.textContent = `Conectado como ${session.user.email}`;
  cargarReportes();
}

async function cargarReportes() {
  const { data, error } = await client
    .from("reportes")
    .select("*")
    .order("creado_en", { ascending: false });

  if (error) {
    adminLista.textContent = `No se pudieron cargar los reportes: ${error.message}`;
    return;
  }

  if (!data.length) {
    adminLista.textContent = "Todavía no hay reportes.";
    return;
  }

  adminLista.innerHTML = "";
  for (const reporte of data) {
    const card = document.createElement("article");
    card.className = "reporte-card";

    const select = document.createElement("select");
    for (const [valor, etiqueta] of Object.entries(ESTATUS_LABEL)) {
      const option = document.createElement("option");
      option.value = valor;
      option.textContent = etiqueta;
      option.selected = valor === reporte.estatus;
      select.appendChild(option);
    }
    select.addEventListener("change", () => actualizarEstatus(reporte.id, select));

    card.innerHTML = `
      <img src="${reporte.foto_url}" alt="Foto del bache" loading="lazy" />
      <div>
        <p><strong>${CATEGORIA_LABEL[reporte.categoria] ?? reporte.categoria}</strong></p>
        <p>${reporte.latitud.toFixed(5)}, ${reporte.longitud.toFixed(5)}</p>
        <p>${new Date(reporte.creado_en).toLocaleString("es-MX")}</p>
        <p>Contacto: ${reporte.nombre_contacto || "—"} ${reporte.telefono_contacto ? `· ${reporte.telefono_contacto}` : ""}</p>
      </div>
    `;
    card.appendChild(select);
    adminLista.appendChild(card);
  }
}

async function actualizarEstatus(id, select) {
  select.disabled = true;
  const { error } = await client.from("reportes").update({ estatus: select.value }).eq("id", id);
  select.disabled = false;
  if (error) {
    alert(`No se pudo actualizar: ${error.message}`);
  }
}

client.auth.onAuthStateChange((_event, session) => {
  if (session) mostrarPanel();
});

(async () => {
  const { data: { session } } = await client.auth.getSession();
  if (session) mostrarPanel();
})();
