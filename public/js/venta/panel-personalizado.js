import { supabaseClient } from "/js/proteccion.js";

document.addEventListener("DOMContentLoaded", renderPanelBase);

/* ====================================================================== */
/* 💎 PANEL PERSONALIZADO - SmartPOS Venta                                */
/* ====================================================================== */
async function renderPanelBase() {
  const panel = document.getElementById("panelPersonalizado");
  if (!panel) return;

  panel.innerHTML = `
    <h2 class="text-xl font-bold text-fuchsia-700 mb-4 flex items-center gap-2">
      <i data-lucide="layout-grid"></i> Panel Personalizado
    </h2>

    <div id="panelPrecios" class="card-3d p-4 mb-4 transition-all duration-300 opacity-100">
      <h3 class="text-fuchsia-600 font-semibold flex items-center gap-2 mb-2">
        <i data-lucide="store"></i> Precios en otros negocios
      </h3>
      <div id="contenedorPrecios" class="space-y-2 text-sm">
        <p class="text-gray-400 text-sm italic">Selecciona un producto para comparar precios.</p>
      </div>
    </div>

    <div id="panelButtons" class="grid grid-cols-2 gap-3 mb-4">
      <button data-section="favoritos" class="card-3d p-3 text-center hover:scale-105 transition">
        <i data-lucide="heart" class="w-7 h-7 text-fuchsia-600 mb-1 icon-3d"></i>
        <span class="font-semibold text-xs">Más Vendidos</span>
      </button>

      <button data-section="resumen" class="card-3d p-3 text-center hover:scale-105 transition">
        <i data-lucide="trending-up" class="w-7 h-7 text-purple-600 mb-1 icon-3d"></i>
        <span class="font-semibold text-xs">Resumen</span>
      </button>
    </div>

    <div id="panelContent" class="animate__animated animate__fadeIn"></div>
  `;

  lucide.createIcons();

  panel.querySelectorAll("[data-section]").forEach(btn => {
    btn.addEventListener("click", async () => {
      ocultarBloquePrecios();
      await mostrarSeccion(btn.dataset.section);
    });
  });

  document.addEventListener("producto-seleccionado", e => {
    consultarPreciosExternos(e.detail);
  });

  mostrarBloquePrecios();
  window.consultarPreciosExternos = consultarPreciosExternos;
}

/* ====================================================================== */
/* Mostrar / ocultar bloque precios                                       */
/* ====================================================================== */
function mostrarBloquePrecios() {
  document.getElementById("panelPrecios")?.classList.remove("opacity-0", "pointer-events-none");
}
function ocultarBloquePrecios() {
  document.getElementById("panelPrecios")?.classList.add("opacity-0", "pointer-events-none");
}

/* ====================================================================== */
async function mostrarSeccion(section) {
  const cont = document.getElementById("panelContent");
  cont.innerHTML = `<p class="text-center text-gray-400 text-sm py-4">Cargando...</p>`;

  if (section === "favoritos") return renderFavoritos(cont);
  if (section === "resumen") return renderResumen(cont);
}

/* ====================================================================== */
/* ⭐ MÁS VENDIDOS                                                         */
/* ====================================================================== */
async function renderFavoritos(container) {
  const negocio_id = localStorage.getItem("negocio_id") || null;

  try {
    let top = [];

    if (navigator.onLine) {
      const { data } = await supabaseClient.rpc("reporte_top_productos", { 
        limite: 5,
        v_negocio_id: negocio_id
      });

      top = data || [];
      cachearFavoritos(top);

    } else {
      top = JSON.parse(localStorage.getItem("cache_panel_favoritos") || "{}").data || [];
    }

    const lista = top.length
      ? top.map((p, i) => `
          <li class="flex justify-between items-center text-sm border-b border-fuchsia-100 pb-1">
            <div class="flex items-center gap-2">
              <span class="text-gray-400 text-xs w-4 text-right">${i + 1}.</span>
              <span>${p.nombre}</span>
            </div>
            <span class="text-fuchsia-600 font-semibold">${Number(p.total).toFixed(0)}</span>
          </li>`
        ).join("")
      : `<li class="text-gray-400 text-sm">Sin datos</li>`;

    container.innerHTML = `
      <div class="card-3d p-4">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-fuchsia-600 font-semibold flex items-center gap-2">
            <i data-lucide="heart"></i> Más vendidos
          </h3>
          <button id="btnVolver" class="text-xs text-fuchsia-600 hover:underline">← Volver</button>
        </div>
        <ul class="space-y-1">${lista}</ul>
      </div>`;

    document.getElementById("btnVolver")?.addEventListener("click", () => {
      container.innerHTML = "";
      mostrarBloquePrecios();
    });

  } catch {
    container.innerHTML = `<p class="text-red-500 text-sm text-center">Error cargando datos</p>`;
  }

  lucide.createIcons();
}

/* ====================================================================== */
/* 💵 RESUMEN POR RANGO DE FECHA                                          */
/* ====================================================================== */
async function renderResumen(container) {

  const negocio_id = localStorage.getItem("negocio_id") || null;
  const hoy = new Date().toISOString().split("T")[0];

  container.innerHTML = `
    <div class="card-3d p-4 animate__animated animate__fadeIn">
      
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-fuchsia-600 font-semibold flex items-center gap-2">
          <i data-lucide="trending-up"></i> Resumen de ventas
        </h3>
        <button id="btnVolver" class="text-xs text-fuchsia-600 hover:underline">
          ← Volver
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div>
          <label class="text-gray-500 text-xs">Desde:</label>
          <input type="date" id="fechaInicio"
          class="w-full bg-white text-gray-800 border border-fuchsia-300 
                rounded-lg px-2 py-2 mt-1 text-sm 
                focus:ring-2 focus:ring-fuchsia-400 focus:outline-none"
          style="color-scheme: light; appearance: auto; -webkit-appearance: auto;">
        </div>

        <div>
          <label class="text-gray-500 text-xs">Hasta:</label>
          <input type="date" id="fechaFin"
          class="w-full bg-white text-gray-800 border border-fuchsia-300 
                rounded-lg px-2 py-2 mt-1 text-sm 
                focus:ring-2 focus:ring-fuchsia-400 focus:outline-none"
          style="color-scheme: light; appearance: auto; -webkit-appearance: auto;">
        </div>
      </div>

      <button id="btnConsultarResumen"
        class="btn-3d w-full bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white py-2 rounded-lg text-sm font-semibold mb-4">
        Consultar
      </button>

      <div id="resultadoResumen" class="space-y-3 text-sm">
        <p class="text-gray-400 text-center text-sm">Selecciona un rango y consulta.</p>
      </div>

    </div>
  `;

  lucide.createIcons();

  document.getElementById("fechaInicio").value = hoy;
  document.getElementById("fechaFin").value = hoy;

  document.getElementById("btnVolver")?.addEventListener("click", () => {
    container.innerHTML = "";
    mostrarBloquePrecios();
  });

  document.getElementById("btnConsultarResumen")?.addEventListener("click", async () => {

    const inicio = document.getElementById("fechaInicio").value;
    const fin = document.getElementById("fechaFin").value;

    if (!inicio || !fin) return;

    const resultado = document.getElementById("resultadoResumen");
    resultado.innerHTML = `<p class="text-gray-400 text-center text-sm">Consultando...</p>`;

    try {

      let filas = [];

      if (navigator.onLine) {
        const { data, error } = await supabaseClient
          .from("v_reporte_margen_utilidad")
          .select("ingreso_total, costo_total, utilidad")
          .eq("negocio_id", negocio_id)
          .gte("fecha_venta", inicio)
          .lte("fecha_venta", fin);

        if (error) throw error;

        filas = data || [];
        cachearResumen({ filas, inicio, fin });

      } else {
        const cache = JSON.parse(localStorage.getItem("cache_panel_resumen") || "{}");
        filas = cache.data?.filas || [];
      }

      const totalVentas = filas.reduce((a, r) => a + Number(r.ingreso_total || 0), 0);
      const totalCosto = filas.reduce((a, r) => a + Number(r.costo_total || 0), 0);
      const totalUtilidad = filas.reduce((a, r) => a + Number(r.utilidad || 0), 0);

      const margen = totalVentas > 0
        ? (totalUtilidad / totalVentas) * 100
        : 0;

      resultado.innerHTML = `
        <div class="flex justify-between border-b pb-2">
          <span class="font-medium">Total vendido:</span>
          <b class="text-blue-600">$${totalVentas.toFixed(2)}</b>
        </div>

        <div class="flex justify-between border-b pb-2">
          <span class="font-medium">Inversión:</span>
          <b class="text-orange-600">$${totalCosto.toFixed(2)}</b>
        </div>

        <div class="flex justify-between border-b pb-2">
          <span class="font-medium">Ganancia:</span>
          <b class="text-green-600">$${totalUtilidad.toFixed(2)}</b>
        </div>

        <div class="flex justify-between pt-1">
          <span class="font-medium">Margen:</span>
          <b class="text-fuchsia-700">${margen.toFixed(2)}%</b>
        </div>
      `;

    } catch {
      resultado.innerHTML = `<p class="text-red-500 text-center text-sm">Error consultando datos</p>`;
    }

  });
}

/* ====================================================================== */
/* 🔍 CONSULTAR PRECIOS EXTERNOS                                           */
/* ====================================================================== */
export async function consultarPreciosExternos(producto) {
  const cont = document.getElementById("contenedorPrecios");
  if (!cont) return;

  const query = producto?.nombre || producto?.codigo_barras || "";

  if (!query) {
    cont.innerHTML = `<p class="text-gray-400 text-sm italic">🔎 Esperando producto...</p>`;
    return;
  }

  cont.innerHTML = `
    <div class="card-3d p-4 animate__animated animate__fadeIn">
      <h3 class="text-fuchsia-600 font-semibold flex items-center gap-2 mb-3">
        <i data-lucide="shopping-bag"></i> Comparar precios reales
      </h3>

      <div class="bg-gray-50 border border-fuchsia-100 rounded-lg p-3 text-center mb-4">
        <p class="font-semibold text-gray-700 text-sm">${query}</p>
      </div>

      <button 
        id="btnVerGoogle"
        class="btn-3d w-full bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white py-2 rounded-lg text-sm font-semibold shadow-md transition">
        🔍 Ver comparador de precios
      </button>
    </div>
  `;

  lucide.createIcons();

  document.getElementById("btnVerGoogle")?.addEventListener("click", () => {
    const redirectURL = `/google.html?q=${encodeURIComponent(query)}`;
    localStorage.setItem("volverSmartPOS", window.location.href);
    window.location.href = redirectURL;
  });
}

/* ====================================================================== */
/* 💾 CACHE                                                               */
/* ====================================================================== */
window.addEventListener("online", () => {
  localStorage.removeItem("cache_panel_favoritos");
  localStorage.removeItem("cache_panel_resumen");
});

async function cachearFavoritos(data) {
  localStorage.setItem(
    "cache_panel_favoritos",
    JSON.stringify({ fecha: new Date().toISOString(), data })
  );
}

async function cachearResumen(data) {
  localStorage.setItem(
    "cache_panel_resumen",
    JSON.stringify({ fecha: new Date().toISOString(), data })
  );
}