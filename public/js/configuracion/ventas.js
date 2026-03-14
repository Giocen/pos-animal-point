// ✅ Archivo: /public/js/configuracion/ventas.js
// 💜 SmartPOS - Configuración de Ventas (sincronizada con POS, Supabase y cache local)

import { supabaseClient, protegerSesion } from "../proteccion.js";
import { guardarConfiguracion } from "./index.js";
import { LocalDB } from "../localdb.js";

await protegerSesion(["admin"]);

const negocioId = localStorage.getItem("negocio_id"); // ⭐ MULTINEGOCIO

/* -------------------------------------------------------------
   🔐 CORRECCIÓN DE ACCESO — NO TOCA NADA DE TU LÓGICA
------------------------------------------------------------- */
const rol = (localStorage.getItem("usuario_rol") || "").trim().toLowerCase();
if (rol !== "admin" && rol !== "administrador") {
  Swal.fire({
    icon: "error",
    title: "Acceso denegado",
    text: "Solo el administrador puede acceder.",
    confirmButtonColor: "#a21caf",
  }).then(() => {
    window.location.href = "/venta.html";
  });
}

/* -------------------------------------------------------------------------- */
/* 🧠 RENDER PRINCIPAL                                                       */
/* -------------------------------------------------------------------------- */
export async function renderSeccionVentas(data) {
  const cont = document.getElementById("tab-ventas");
  if (!cont) return;
  cont.innerHTML = "";

  /* ---------------------------------------------------------------------- */
  /* ⚡ 1️⃣ Cargar configuraciones desde cache si no se recibió data          */
  /* ---------------------------------------------------------------------- */
  if (!data || !data.length) {
    const cache = LocalDB.get("config_ventas_" + negocioId); // ⭐ CACHE POR NEGOCIO
    if (cache?.length) {
      console.log("⚡ Configuraciones de ventas cargadas desde LocalDB");
      data = cache;
    } else {
      cont.innerHTML = `<p class="text-center text-gray-400 mt-10">No hay configuraciones registradas para ventas.</p>`;
      return;
    }
  } else {
    // 💾 Si llegaron desde Supabase (index.js), guarda cache POR NEGOCIO
    LocalDB.set("config_ventas_" + negocioId, data);
  }

  /* ---------------------------------------------------------------------- */
  /* 🧩 Render dinámico de cada configuración                               */
  /* ---------------------------------------------------------------------- */
  const campos = data.filter(
    (d) => d.categoria === "ventas" && String(d.negocio_id) === String(negocioId) // ⭐ MULTINEGOCIO
  );

  campos.forEach((c) => {
    const valor =
      typeof c.valor === "object" ? c.valor.valor || "" : c.valor || "";

    cont.insertAdjacentHTML(
      "beforeend",
      `
      <div class="card-3d p-5 mb-5">
        <div class="flex items-center gap-2 mb-2 text-fuchsia-700">
          <i data-lucide="shopping-cart" class="w-5 h-5"></i>
          <span class="font-semibold text-sm">${c.descripcion}</span>
        </div>
        <input id="conf-${c.id}" type="text"
          value="${valor.replace(/"/g, "")}"
          class="w-full border border-fuchsia-200 rounded-lg p-2 bg-gray-50 
                 focus:ring-2 focus:ring-fuchsia-500 outline-none shadow-inner">
        <div class="flex justify-end mt-3">
          <button 
            class="btn-3d bg-fuchsia-600 text-white px-4 py-2 text-sm rounded-lg flex items-center gap-1"
            data-id="${c.id}">
            <i data-lucide="save" class="w-4 h-4"></i> Guardar
          </button>
        </div>
      </div>
    `
    );
  });

  lucide.createIcons();

  /* ---------------------------------------------------------------------- */
  /* 💾 Guardar cambios individuales usando función global del index.js     */
  /* ---------------------------------------------------------------------- */
  cont.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const val = document.getElementById(`conf-${id}`).value.trim();

      if (!val) {
        Swal.fire("Atención", "El valor no puede estar vacío.", "warning");
        return;
      }

      Swal.fire({
        title: "Guardando...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      try {
        // ⭐ PASAR NEGOCIO_ID AL GUARDAR
        await guardarConfiguracion(id, val, negocioId);

        // ⭐ Actualizar cache local correctamente
        actualizarCacheLocal(id, val);

        Swal.fire({
          icon: "success",
          title: "Configuración actualizada",
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (err) {
        console.error("❌ Error al guardar configuración de ventas:", err);
        Swal.fire("Error", "No se pudo guardar la configuración", "error");
      }
    });
  });
}

/* -------------------------------------------------------------------------- */
/* ⚙️ FUNCIONES DE SINCRONIZACIÓN LOCAL                                       */
/* -------------------------------------------------------------------------- */
function actualizarCacheLocal(id, valor) {
  // ⭐ Cache por negocio
  const cache = LocalDB.get("config_ventas_" + negocioId) || [];
  const idx = cache.findIndex((c) => c.id === id);

  if (idx >= 0) cache[idx].valor = valor;
  else cache.push({ id, valor, negocio_id: negocioId });

  LocalDB.set("config_ventas_" + negocioId, cache);

  // ⭐ También actualizar en localStorage (usado por POS)
  const dataLS = JSON.parse(localStorage.getItem("config_ventas_" + negocioId) || "{}");
  dataLS[id] = valor;
  localStorage.setItem("config_ventas_" + negocioId, JSON.stringify(dataLS));

  // 🔄 Emitir evento global para POS
  window.dispatchEvent(
    new CustomEvent("configVentasActualizada", { detail: dataLS })
  );

  console.log(
    `💾 Cache de configuración de ventas actualizada para ID: ${id} (negocio ${negocioId})`
  );
}
