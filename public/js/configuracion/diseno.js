// ✅ Archivo: /public/js/configuracion/diseno.js (MULTI-NEGOCIO)
import { supabaseClient, protegerSesion } from "../proteccion.js";
await protegerSesion(["admin"]);

// 🔑 NEGOCIO ACTUAL
const negocioId = localStorage.getItem("negocio_id");

export function renderSeccionDiseno() {
  const cont = document.getElementById("tab-diseño");
  if (!cont) return;

  cont.innerHTML = `
    <div class="card-3d p-6 mb-6">
      <div class="flex items-center gap-2 mb-4 text-fuchsia-700">
        <i data-lucide="droplet" class="w-5 h-5"></i>
        <h2 class="font-semibold text-sm">Color principal</h2>
      </div>
      <input type="color" id="color-principal" class="w-16 h-10 rounded-lg shadow-inner border border-fuchsia-200 cursor-pointer">
      <button id="btn-guardar-color" class="btn-3d px-4 py-2 ml-3 rounded-lg text-sm flex items-center gap-1">
        <i data-lucide="save" class="w-4 h-4"></i> Guardar color
      </button>
      <div id="preview-color" class="mt-4 w-full h-10 rounded-xl shadow-inner"></div>
    </div>

    <div class="card-3d p-6">
      <div class="flex items-center gap-2 mb-4 text-fuchsia-700">
        <i data-lucide="moon" class="w-5 h-5"></i>
        <h2 class="font-semibold text-sm">Modo oscuro</h2>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" id="switch-oscuro" class="sr-only peer">
        <div class="w-14 h-7 bg-gray-200 rounded-full peer peer-checked:bg-fuchsia-600 transition-all duration-300 shadow-inner"></div>
        <span class="absolute left-1 top-1 w-5 h-5 bg-white rounded-full peer-checked:translate-x-7 transition-all shadow-md"></span>
      </label>
    </div>
  `;

  lucide.createIcons();
  inicializarDiseno();
}

/* -------------------------------------------------------------------------- */
/* 🔧 Inicializar valores desde la BD (y corregir valores faltantes)         */
/* -------------------------------------------------------------------------- */
async function inicializarDiseno() {
  let ajustes = {};

  try {
    const { data, error } = await supabaseClient
      .from("configuracion_sistema")
      .select("clave, valor")
      .eq("negocio_id", negocioId)           
      .in("clave", ["color_principal", "modo_oscuro"]);

    if (error) throw error;

    (data || []).forEach(a => {
      try {
        ajustes[a.clave] = JSON.parse(a.valor);
      } catch {
        ajustes[a.clave] = a.valor;
      }
    });

  } catch (err) {
    console.warn("⚠️ Error obteniendo configuraciones de diseño:", err);
  }

  // 🛡 Valores por defecto (si no existen en BD)
  if (!ajustes.color_principal) ajustes.color_principal = "#a21caf";
  if (!("modo_oscuro" in ajustes)) ajustes.modo_oscuro = false;

  const colorInput = document.getElementById("color-principal");
  const preview = document.getElementById("preview-color");
  const switchOscuro = document.getElementById("switch-oscuro");

  /* -------------------------------------- */
  /* 🎨 COLOR PRINCIPAL                     */
  /* -------------------------------------- */
  colorInput.value = ajustes.color_principal;
  preview.style.background = ajustes.color_principal;

  colorInput.addEventListener("input", () => {
    preview.style.background = colorInput.value;
  });

  document.getElementById("btn-guardar-color").addEventListener("click", async () => {
    const nuevoColor = colorInput.value;

    await supabaseClient
      .from("configuracion_sistema")
      .upsert(
        {
          clave: "color_principal",
          valor: JSON.stringify(nuevoColor),
          categoria: "diseño",
          negocio_id: negocioId,
          actualizado_en: new Date()
        },
        { onConflict: "clave" }
      );

    Swal.fire("Listo", "Color principal actualizado", "success");
  });

  /* -------------------------------------- */
  /* 🌙 MODO OSCURO                         */
  /* -------------------------------------- */
  switchOscuro.checked = ajustes.modo_oscuro === true || ajustes.modo_oscuro === "true";

  aplicarTemaOscuro(switchOscuro.checked);

  switchOscuro.addEventListener("change", async (e) => {
    const activo = e.target.checked;

    aplicarTemaOscuro(activo);

    await supabaseClient
      .from("configuracion_sistema")
      .upsert(
        {
          clave: "modo_oscuro",
          valor: JSON.stringify(activo),
          categoria: "diseño",
          negocio_id: negocioId,
          actualizado_en: new Date()
        },
        { onConflict: "clave" }
      );
  });
}

/* -------------------------------------------------------------------------- */
/* 🎨 Tema oscuro dinámico (tu lógica original)                              */
/* -------------------------------------------------------------------------- */
function aplicarTemaOscuro(activo) {
  if (activo) {
    document.body.style.background = "linear-gradient(135deg, #18181b, #3f3f46)";
    document.body.classList.add("text-gray-100");
  } else {
    document.body.style.background = "linear-gradient(135deg, #faf5ff, #fce7f3)";
    document.body.classList.remove("text-gray-100");
  }
}
