// ✅ Archivo: /public/js/configuracion/reportes.js
// 💜 SmartPOS - Configuración de Reportes (modo simple + cache local + MULTINEGOCIO)

import { supabaseClient, protegerSesion } from "../proteccion.js";
import { LocalDB } from "../localdb.js";

/* -------------------------------------------------------------
   🔐 VALIDACIÓN DE ADMIN — MISMA LÓGICA QUE OTROS MÓDULOS
------------------------------------------------------------- */
const rol = (localStorage.getItem("usuario_rol") || "").trim().toLowerCase();
if (rol !== "admin" && rol !== "administrador") {
  Swal.fire({
    icon: "error",
    title: "Acceso denegado",
    text: "Solo el administrador puede acceder a la configuración de reportes.",
    confirmButtonColor: "#a21caf",
  }).then(() => {
    window.location.href = "/venta.html";
  });
}

await protegerSesion(["admin"]);

const negocioId = localStorage.getItem("negocio_id"); // ⭐ MULTI-NEGOCIO

export async function renderSeccionReportes() {
  const cont = document.getElementById("tab-reportes");
  if (!cont) return;

  /* ---------------------------------------------------------------------- */
  /* 🧠 1️⃣ Cargar configuración del periodo desde cache POR NEGOCIO        */
  /* ---------------------------------------------------------------------- */
  const cacheReportes = LocalDB.get("config_reportes_" + negocioId);
  const valorInicial = cacheReportes?.periodo || "diario";

  const html = `
    <div class="card-3d p-6 mb-6">
      <div class="flex items-center gap-2 mb-4 text-fuchsia-700">
        <i data-lucide="calendar-days" class="w-5 h-5"></i>
        <h2 class="font-semibold text-sm">Periodo de reporte</h2>
      </div>
      <select id="periodo-reporte" class="border border-fuchsia-200 rounded-lg p-2 w-full shadow-inner">
        <option value="diario" ${valorInicial === "diario" ? "selected" : ""}>Diario</option>
        <option value="semanal" ${valorInicial === "semanal" ? "selected" : ""}>Semanal</option>
        <option value="mensual" ${valorInicial === "mensual" ? "selected" : ""}>Mensual</option>
      </select>
      <div class="flex justify-end mt-3">
        <button id="btn-guardar-reporte" class="btn-3d px-5 py-2 text-sm rounded-lg flex items-center gap-1">
          <i data-lucide="save" class="w-4 h-4"></i> Guardar
        </button>
      </div>
    </div>
  `;
  cont.innerHTML = html;
  lucide.createIcons();

  /* ---------------------------------------------------------------------- */
  /* 🛰️ 2️⃣ Obtener valor actualizado desde Supabase                          */
  /* ---------------------------------------------------------------------- */
  try {
    const { data, error } = await supabaseClient
      .from("configuracion_sistema")
      .select("valor")
      .eq("clave", "periodo_reporte")
      .eq("negocio_id", negocioId)                // ⭐ filtrado por negocio
      .maybeSingle();

    if (error) throw error;

    const val = data?.valor ? JSON.parse(data.valor) : "diario";

    document.getElementById("periodo-reporte").value = val;

    // 💾 Guardar cache local por negocio
    LocalDB.set("config_reportes_" + negocioId, { periodo: val });

  } catch (err) {
    console.warn("⚠️ No se pudo sincronizar configuraciones de reportes:", err.message);
  }

  /* ---------------------------------------------------------------------- */
  /* 💾 3️⃣ Guardar cambios en Supabase                                      */
  /* ---------------------------------------------------------------------- */
  document.getElementById("btn-guardar-reporte").addEventListener("click", async () => {
    const val = document.getElementById("periodo-reporte").value;

    try {
      await supabaseClient
        .from("configuracion_sistema")
        .update({
          valor: JSON.stringify(val),
          actualizado_en: new Date(),
        })
        .eq("clave", "periodo_reporte")
        .eq("negocio_id", negocioId);           // ⭐ asegurar multi-negocio

      // 💾 Actualizar cache local por negocio
      LocalDB.set("config_reportes_" + negocioId, { periodo: val });

      Swal.fire("Listo", "Periodo de reporte guardado", "success");
    } catch (err) {
      console.error("❌ Error al guardar periodo de reporte:", err);
      Swal.fire("Error", "No se pudo guardar el periodo de reporte", "error");
    }
  });
}
