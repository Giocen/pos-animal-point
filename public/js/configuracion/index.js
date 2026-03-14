// ✅ Archivo: /public/js/configuracion/index.js
// 💜 SmartPOS - Configuración modular dinámica (MULTI-NEGOCIO) + cache local
// ✔ FIX crítico: evita classList sobre null
// ✔ Mantiene TODA la lógica original

import { supabaseClient, protegerSesion } from "../proteccion.js";
import { LocalDB } from "../localdb.js";
import { renderSeccionNegocio } from "./configNegocio.js";
import { renderSeccionReportes } from "./reportes.js";
import { renderSeccionDiseno } from "./diseno.js";

console.log("📁 index.js de configuración CARGADO correctamente");

// 🔑 NEGOCIO ACTUAL
const negocioId = localStorage.getItem("negocio_id");

await protegerSesion();

/* -------------------------------------------------------------------------- */
/* 🧠 Carga inicial y control de tabs                                         */
/* -------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();
  inicializarTabs();
});

async function inicializarTabs() {
  const botones = document.querySelectorAll(".tab-btn");
  const tabs = document.querySelectorAll(".tab-content");
  let cacheData = null;
  const cargadas = new Set();

  /* ---------------------------------------------------------------------- */
  /* ⚡ 1️⃣ Cargar configuración desde cache local por negocio               */
  /* ---------------------------------------------------------------------- */
  cacheData = LocalDB.get("config_cache_" + negocioId);

  if (cacheData) {
    window.cacheData = cacheData;
    console.log("⚡ Configuraciones cargadas desde LocalDB (negocio " + negocioId + ")");
  }

  /* ---------------------------------------------------------------------- */
  /* 🛰️ 2️⃣ Sincronizar con Supabase                                       */
  /* ---------------------------------------------------------------------- */
  try {
    const { data, error } = await supabaseClient
      .from("configuracion_sistema")
      .select("*")
      .eq("negocio_id", negocioId)
      .order("categoria", { ascending: true });

    if (error) throw error;

    cacheData = data;
    window.cacheData = data;
    LocalDB.set("config_cache_" + negocioId, data);

    console.log("🗃️ Configuraciones actualizadas desde Supabase");
  } catch (err) {
    console.warn("⚠️ Configuración en modo cache:", err.message);
  }

  /* ---------------------------------------------------------------------- */
  /* 🧩 Control de Tabs                                                     */
  /* ---------------------------------------------------------------------- */
  botones.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nombre = btn.dataset.tab;
      if (!nombre) return;

      botones.forEach((b) => b.classList.remove("tab-active"));
      tabs.forEach((t) => t.classList.add("hidden"));

      btn.classList.add("tab-active");
      document.getElementById(`tab-${nombre}`)?.classList.remove("hidden");

      if (cargadas.has(nombre)) return;

      switch (nombre) {
        case "negocio":
          renderSeccionNegocio(cacheData);
          break;

        case "ventas":
          window.location.href = "/configuracion_ventas.html";
          return;

        case "reportes":
          renderSeccionReportes(cacheData);
          break;

        case "diseño":
          renderSeccionDiseno(cacheData);
          break;

        case "sistema":
          window.location.href = "/sistema.html";
          return;
      }

      cargadas.add(nombre);
      if (window.lucide) lucide.createIcons();
    });
  });

  botones[0]?.click();
  console.log("✅ Tabs inicializados correctamente");
}

/* -------------------------------------------------------------------------- */
/* 💾 GUARDAR CONFIGURACIÓN (MULTI-NEGOCIO)                                  */
/* -------------------------------------------------------------------------- */
export async function guardarConfiguracion(id, valor, descripcion = "") {
  try {
    const { error } = await supabaseClient
      .from("configuracion_sistema")
      .update({ valor })
      .eq("id", id)
      .eq("negocio_id", negocioId);

    if (error) throw error;

    const activo = ["true", "sí", "si"].includes(String(valor).toLowerCase());

    Toastify({
      text: `${descripcion || "Configuración"} ${activo ? "activada" : "desactivada"}`,
      duration: 1500,
      gravity: "top",
      position: "right",
      style: {
        background: activo
          ? "linear-gradient(90deg,#a21caf,#d946ef)"
          : "linear-gradient(90deg,#6b7280,#9ca3af)",
        color: "#fff",
        borderRadius: "0.6rem",
        fontWeight: "600",
      },
    }).showToast();
  } catch (err) {
    console.error("❌ Error al guardar configuración:", err);

    Toastify({
      text: "⚠️ Error al guardar configuración",
      duration: 2000,
      gravity: "top",
      position: "right",
      style: {
        background: "linear-gradient(90deg,#b91c1c,#dc2626)",
        color: "#fff",
        borderRadius: "0.6rem",
      },
    }).showToast();
  }
}

/* -------------------------------------------------------------------------- */
/* 💾 GUARDADO AUTOMÁTICO (FIX DEFINITIVO)                                   */
/* -------------------------------------------------------------------------- */
export function inicializarGuardadoAutomatico(configs) {
  if (!Array.isArray(configs)) return;

  configs.forEach((c) => {
    const input = document.getElementById(`conf-${c.id}`);
    if (!input) return; // ✅ FIX 1: input inexistente

    const valorOriginal =
      typeof c.valor === "object" ? c.valor?.valor : c.valor;

    const esBool = ["true", "false", "sí", "no"].includes(
      String(valorOriginal).toLowerCase()
    );

    const handler = async () => {
      // ✅ FIX 2: el nodo ya no existe (re-render)
      if (!document.body.contains(input)) return;

      let nuevoValor;
      if (esBool) {
        nuevoValor = input.checked ? "true" : "false";
      } else {
        nuevoValor = input.value?.trim?.() ?? "";
      }

      await guardarConfiguracion(c.id, nuevoValor, c.descripcion);
    };

    input.addEventListener(esBool ? "change" : "blur", handler);
  });
}


/* -------------------------------------------------------------------------- */
/* 🧭 Listener global de seguridad                                            */
/* -------------------------------------------------------------------------- */
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-tab='sistema']")) {
    window.location.href = "/sistema.html";
  }
});
