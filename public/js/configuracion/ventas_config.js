// 💜 SmartPOS - Configuración de Ventas (v1.8.3 FIX FINAL + cache local)
// ✔ Soporta boolean / string / json en "valor"
// ✔ Multi-negocio real
// ✔ Sin errores de render
// ✔ Misma lógica original

import { supabaseClient, protegerSesion } from "/js/proteccion.js";
import {
  guardarConfiguracion,
  inicializarGuardadoAutomatico
} from "/js/configuracion/index.js";
import { LocalDB } from "/js/localdb.js";

const negocioId = localStorage.getItem("negocio_id"); // ⭐ MULTI-NEGOCIO

if (!negocioId) {
  Swal.fire("Error", "Negocio no identificado", "error");
  throw new Error("negocio_id no definido");
}

/* -------------------------------------------------------------
   🔐 CONTROL DE ACCESO
------------------------------------------------------------- */
const rol = (localStorage.getItem("usuario_rol") || "")
  .trim()
  .toLowerCase();

if (rol !== "admin" && rol !== "administrador") {
  Swal.fire({
    icon: "error",
    title: "Acceso denegado",
    text: "Solo el administrador puede acceder a la configuración de ventas.",
    confirmButtonColor: "#a21caf",
  }).then(() => {
    window.location.href = "/venta.html";
  });
}

/* -------------------------------------------------------------
   🚀 INIT
------------------------------------------------------------- */
(async () => {
  const usuario = await protegerSesion(["admin"]);
  if (!usuario) return;

  console.log(
    "🛒 Configuración de Ventas cargada para:",
    usuario.nombre,
    "| negocio:",
    negocioId
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => cargarConfiguracionesVentas(usuario),
      { once: true }
    );
  } else {
    await cargarConfiguracionesVentas(usuario);
  }
})();

/* --------------------------------------------------------------------------
   🧠 CARGAR CONFIGURACIONES
-------------------------------------------------------------------------- */
async function cargarConfiguracionesVentas(usuario) {
  const cont = document.getElementById("contenedor-ventas");
  if (!cont) return;

  cont.innerHTML = loader3D("Cargando configuraciones de ventas...");

  try {
    /* 🧱 1️⃣ CACHE LOCAL POR NEGOCIO */
    const cacheVentas = LocalDB.get("config_ventas_" + negocioId);
    if (Array.isArray(cacheVentas) && cacheVentas.length) {
      console.log("⚡ Configuraciones cargadas desde LocalDB");
      renderConfiguraciones(cacheVentas, cont, usuario);
    }

    /* 🛰️ 2️⃣ SUPABASE */
    const { data, error } = await supabaseClient
      .from("configuracion_sistema")
      .select("*")
      .eq("categoria", "ventas")
      .eq("negocio_id", negocioId)
      .order("descripcion", { ascending: true });

    if (error) throw error;

    if (Array.isArray(data) && data.length) {
      LocalDB.set("config_ventas_" + negocioId, data);
      renderConfiguraciones(data, cont, usuario);
      console.log(`✅ ${data.length} configuraciones cargadas desde Supabase`);
    } else if (!cacheVentas?.length) {
      cont.innerHTML = `
        <p class="text-center text-gray-400 mt-10">
          No hay configuraciones registradas para ventas.
        </p>`;
    }
  } catch (err) {
    console.error("❌ Error al cargar configuraciones de ventas:", err);
    cont.innerHTML = `
      <p class="text-center text-red-500 mt-10">
        Error al cargar configuraciones de ventas.
      </p>`;
  }
}

/* --------------------------------------------------------------------------
   🧩 RENDER CONFIGURACIONES
-------------------------------------------------------------------------- */
function renderConfiguraciones(data, cont, usuario) {
  data = data.filter(
    (c) => String(c.negocio_id) === String(negocioId)
  );

  const html = [
    `<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-4 w-full max-w-6xl mx-auto">`
  ];

  for (const c of data) {
    // 🔧 NORMALIZACIÓN DEFINITIVA DEL VALOR
    let valor = c.valor;

    if (typeof valor === "boolean") {
      valor = valor ? "true" : "false";
    } else if (typeof valor === "object" && valor !== null) {
      valor = valor.valor ?? "";
    }

    valor = String(valor);

    const valStr = valor.toLowerCase();
    const esBool = ["true", "false"].includes(valStr);
    const activo = valStr === "true";

    const icono = obtenerIconoPorClave(c.clave);
    const tooltip = obtenerTooltipPorClave(c.clave);

    html.push(`
      <div id="card-${c.id}" title="${tooltip}"
        class="card-3d flex flex-col items-center justify-between text-center
        p-6 rounded-2xl shadow-md transition-all duration-300 cursor-pointer select-none
        ${activo ? "bg-fuchsia-50 ring-2 ring-fuchsia-300" : "bg-white"}
        hover:scale-[1.02]">

        <div class="flex flex-col items-center space-y-3">
          <i data-lucide="${icono}"
             class="w-10 h-10 ${activo ? "text-fuchsia-700" : "text-gray-400"}"></i>
          <h2 class="text-sm font-semibold text-gray-700 leading-tight">
            ${c.descripcion}
          </h2>
        </div>

        ${
          esBool
            ? `
              <label class="relative inline-flex items-center cursor-pointer mt-5 scale-110">
                <input type="checkbox"
                       id="conf-${c.id}"
                       ${activo ? "checked" : ""}
                       class="sr-only peer">
                <div class="w-12 h-6 bg-gray-300 rounded-full
                            peer-checked:bg-fuchsia-600 transition-all
                            after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                            after:bg-white after:rounded-full after:h-5 after:w-5
                            after:transition-all peer-checked:after:translate-x-6"></div>
              </label>`
            : `
              <input id="conf-${c.id}"
                     type="text"
                     value="${valor.replace(/"/g, "")}"
                     class="mt-5 text-center border border-fuchsia-200 rounded-lg
                            p-2 w-40 bg-gray-50 focus:ring-2
                            focus:ring-fuchsia-500 outline-none shadow-inner" />`
        }
      </div>
    `);
  }

  html.push(`</section>`);
  cont.innerHTML = html.join("");

  if (window.lucide) lucide.createIcons();

  // ⭐ GUARDADO AUTOMÁTICO
  inicializarGuardadoAutomatico(data);

  console.log(
    `✅ ${data.length} configuraciones renderizadas para ${usuario.nombre}`
  );
}

/* --------------------------------------------------------------------------
   💡 ICONOS / TOOLTIP
-------------------------------------------------------------------------- */
function obtenerIconoPorClave(clave = "") {
  clave = clave.toLowerCase();
  if (clave.includes("ticket")) return "receipt";
  if (clave.includes("whatsapp")) return "message-circle";
  if (clave.includes("pdf")) return "file-down";
  if (clave.includes("impresora") || clave.includes("print")) return "printer";
  if (clave.includes("bascula") || clave.includes("peso")) return "scale";
  if (clave.includes("caja")) return "wallet";
  if (clave.includes("sonido") || clave.includes("alerta")) return "volume-2";
  if (clave.includes("confirmar")) return "check-circle";
  return "settings";
}

function obtenerTooltipPorClave(clave = "") {
  clave = clave.toLowerCase();
  if (clave.includes("ticket"))
    return "Configura el encabezado, pie o envío del ticket.";
  if (clave.includes("whatsapp"))
    return "Envía el ticket por WhatsApp.";
  if (clave.includes("pdf"))
    return "Habilita ticket PDF.";
  if (clave.includes("impresora"))
    return "Activa impresora física.";
  if (clave.includes("bascula"))
    return "Activa báscula en ventas.";
  if (clave.includes("caja"))
    return "Permite abrir la caja.";
  if (clave.includes("sonido"))
    return "Alertas sonoras.";
  if (clave.includes("confirmar"))
    return "Confirmar antes de vender.";
  return "Configuración de ventas.";
}

/* --------------------------------------------------------------------------
   ✨ LOADER
-------------------------------------------------------------------------- */
function loader3D(texto = "Cargando...") {
  return `
    <div class="flex flex-col items-center justify-center py-20">
      <div class="loader-cube mb-6"></div>
      <p class="text-fuchsia-600 font-medium">${texto}</p>
    </div>
  `;
}
