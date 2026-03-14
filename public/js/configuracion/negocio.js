// ============================================================
// 💜 SmartPOS - Configuración del Negocio (MULTI-NEGOCIO FINAL)
// ============================================================

import { supabaseClient, protegerSesion } from "/js/proteccion.js";
import { LocalDB } from "/js/localdb.js";
import { guardarConfiguracion } from "./index.js";  // asegúrate de que index.js exporte esto

// 🔐 VALIDAR ACCESO — SOLO ADMIN REAL (via supabase)
await protegerSesion(["admin", "administrador"]);

// NEGOCIO ACTUAL
const negocioId = localStorage.getItem("negocio_id");

/* ---------------------------------------------------------------------- */
/* 🚀 RENDER PRINCIPAL DE CONFIGURACIÓN DEL NEGOCIO                       */
/* ---------------------------------------------------------------------- */
export async function renderSeccionNegocio(data) {
  const cont = document.getElementById("tab-negocio");
  if (!cont) {
    console.warn("⚠️ No existe #tab-negocio en el HTML.");
    return;
  }

  cont.innerHTML = "";

  /* -------------------- 1) Cargar desde Cache por NEGOCIO -------------------- */
  let cache = LocalDB.get("config_negocio_" + negocioId);

  if (cache && !data) {
    console.log("⚡ Config del negocio desde cache LocalDB");
    data = cache;
  }

  /* -------------------- 2) Si data viene de Supabase → cache ------------------ */
  if (data && data.length) {
    const negocioData = data.filter((d) => d.categoria === "negocio");
    if (negocioData.length) {
      LocalDB.set("config_negocio_" + negocioId, negocioData);
    }
  }

  /* -------------------- 3) Filtrar configuraciones del negocio ---------------- */
  const campos = (data || []).filter((d) => d.categoria === "negocio");

  if (!campos.length) {
    cont.innerHTML =
      `<p class="text-center text-gray-400 mt-10">No hay configuraciones registradas.</p>`;
    return;
  }

  /* -------------------- 4) Render dinámico de tarjetas ------------------------ */
  campos.forEach((c) => {
    const valor =
      typeof c.valor === "object" ? (c.valor?.url ?? JSON.stringify(c.valor)) : c.valor;

    cont.insertAdjacentHTML(
      "beforeend",
      `
      <div id="card-${c.id}" class="card-3d p-5 mb-5 hover:scale-[1.02] transition">
        <div class="flex items-center gap-2 mb-2 text-fuchsia-700">
          <i data-lucide="store" class="w-5 h-5"></i>
          <span class="font-semibold text-sm">${c.descripcion}</span>
        </div>

        <input 
          id="conf-${c.id}" 
          type="text" 
          value="${valor || ""}" 
          class="w-full border border-fuchsia-200 rounded-lg p-2 bg-gray-50 
                 focus:ring-2 focus:ring-fuchsia-500 outline-none" />

        <div class="flex justify-end mt-3">
          <button 
            class="btn-3d bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-5 py-2 rounded-lg text-sm
                   flex items-center gap-1"
            data-id="${c.id}">
            <i data-lucide="save" class="w-4 h-4"></i> Guardar
          </button>
        </div>
      </div>`
    );
  });

  lucide.createIcons();

  /* -------------------- 5) Eventos de guardado ----------------------- */
  cont.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const input = document.getElementById(`conf-${id}`);
      if (!input) return;

      const valor = input.value.trim();

      // Guardar en supabase
      await guardarConfiguracion(id, valor, "Configuración del negocio");

      // Guardar en Cache Local por negocio
      const cache = LocalDB.get("config_negocio_" + negocioId) || [];
      const i = cache.findIndex((c) => c.id === id);

      if (i >= 0) {
        cache[i].valor = valor;
      }

      LocalDB.set("config_negocio_" + negocioId, cache);
      console.log(`💾 Cache de negocio actualizado para negocio ${negocioId}`);
    });
  });

  console.log(`🏪 Configuraciones del negocio renderizadas (${campos.length})`);
}
