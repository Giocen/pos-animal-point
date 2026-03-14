import { supabaseClient, protegerSesion } from "../proteccion.js";
import { LocalDB } from "../localdb.js";

await protegerSesion(["admin"]);

// 🔑 NEGOCIO ACTUAL
const negocioId = localStorage.getItem("negocio_id");

/* -------------------------------------------------------------------------- */
/* 💜 SmartPOS - Configuración del Sistema / Dispositivos (MULTI-NEGOCIO)     */
/* -------------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", async () => {
  const cont = document.getElementById("tab-sistema");
  if (!cont) return;

  renderBasculaConfig(cont);
  renderImpresoraConfig(cont);
  renderCajaConfig(cont);
});

/* -------------------------------------------------------------------------- */
/* ⚖️ SECCIÓN: CONFIGURACIÓN DE BÁSCULA                                       */
/* -------------------------------------------------------------------------- */
async function renderBasculaConfig(container) {
  container.insertAdjacentHTML(
    "beforeend",
    `
    <div class="card-3d p-5 mb-6">
      <div class="flex items-center gap-2 mb-3 text-fuchsia-700">
        <i data-lucide="scale" class="w-5 h-5"></i>
        <span class="font-semibold text-sm">Báscula</span>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">Tipo de conexión</label>
          <select id="basculaTipo"
            class="w-full border border-fuchsia-200 rounded-lg p-2 bg-gray-50 focus:ring-2 focus:ring-fuchsia-500 outline-none">
            <option value="usb">USB / Serial (Web Serial API)</option>
            <option value="ip">WiFi / IP</option>
          </select>
        </div>

        <div id="bloqueIP" class="hidden">
          <label class="block text-sm font-medium text-gray-600 mb-1">Dirección IP</label>
          <input id="basculaIP" type="text" placeholder="Ejemplo: 192.168.0.50"
            class="w-full border border-fuchsia-200 rounded-lg p-2 bg-gray-50 focus:ring-2 focus:ring-fuchsia-500 outline-none">
        </div>

        <div class="flex justify-end gap-3 pt-3">
          <button id="btnProbarBascula"
            class="btn-3d bg-blue-600 text-white flex items-center gap-2 px-4 py-2 text-sm">
            <i data-lucide="activity"></i> Probar
          </button>
          <button id="btnGuardarBascula"
            class="btn-3d bg-green-600 text-white flex items-center gap-2 px-4 py-2 text-sm">
            <i data-lucide="save"></i> Guardar
          </button>
        </div>
      </div>
    </div>
  `
  );

  lucide.createIcons();

  const selTipo = document.getElementById("basculaTipo");
  const bloqueIP = document.getElementById("bloqueIP");
  const inputIP = document.getElementById("basculaIP");

  selTipo.addEventListener("change", () => {
    bloqueIP.classList.toggle("hidden", selTipo.value !== "ip");
    if (selTipo.value !== "ip") inputIP.value = "";
  });

  /* ------------ CACHE LOCAL ------------ */
  const cache = LocalDB.get(`config_bascula_${negocioId}`);
  if (cache) {
    selTipo.value = cache.tipo ?? "usb";
    if (cache.tipo === "ip") {
      bloqueIP.classList.remove("hidden");
      inputIP.value = cache.ip ?? "";
    }
  }

  /* ------------ SUPABASE ------------ */
  try {
    const { data } = await supabaseClient
      .from("configuracion_sistema")
      .select("valor")
      .eq("negocio_id", negocioId)
      .eq("clave", "bascula")
      .maybeSingle();

    let conf = {};

    if (data?.valor) {
      try {
        conf = typeof data.valor === "string" ? JSON.parse(data.valor) : data.valor;
      } catch {
        conf = {};
      }

      LocalDB.set(`config_bascula_${negocioId}`, conf);

      selTipo.value = conf.tipo || "usb";
      if (conf.tipo === "ip") {
        bloqueIP.classList.remove("hidden");
        inputIP.value = conf.ip || "";
      }
    }
  } catch (err) {
    console.warn("⚠️ No se pudo cargar configuración de báscula:", err);
  }

  /* ------------ PROBAR ------------ */
  document.getElementById("btnProbarBascula").addEventListener("click", async () => {
    const tipo = selTipo.value;

    if (tipo === "usb") {
      const { conectarBasculaContinuo } = await import("../sistema/bascula.js");
      return conectarBasculaContinuo();
    }

    const ip = inputIP.value.trim();
    if (!ip) return Swal.fire("Error", "Debes ingresar la IP de la báscula", "error");

    const { leerBasculaIP } = await import("../sistema/bascula.js");
    await leerBasculaIP(ip);
  });

  /* ------------ GUARDAR ------------ */
  document.getElementById("btnGuardarBascula").addEventListener("click", async () => {
    const tipo = selTipo.value;
    const ip = tipo === "ip" ? inputIP.value.trim() : null;

    const payload = { tipo, ip };

    LocalDB.set(`config_bascula_${negocioId}`, payload);

    await supabaseClient
      .from("configuracion_sistema")
      .upsert(
        {
          negocio_id: negocioId,
          clave: "bascula",
          categoria: "sistema",
          valor: JSON.stringify(payload)
        },
        { onConflict: "clave,negocio_id" }
      );

    Swal.fire({
      icon: "success",
      title: "Báscula guardada",
      text: "Configuración actualizada correctamente",
      confirmButtonColor: "#a21caf",
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 🖨️ CONFIGURACIÓN DE IMPRESORA                                              */
/* -------------------------------------------------------------------------- */
async function renderImpresoraConfig(container) {
  container.insertAdjacentHTML(
    "beforeend",
    `
    <div class="card-3d p-5 mb-6">
      <div class="flex items-center gap-2 mb-3 text-fuchsia-700">
        <i data-lucide="printer" class="w-5 h-5"></i>
        <span class="font-semibold text-sm">Impresora de Tickets</span>
      </div>

      <div class="space-y-3">
        <label class="block text-sm font-medium text-gray-600 mb-1">Tipo de salida</label>
        <select id="impresoraTipo"
          class="w-full border border-fuchsia-200 rounded-lg p-2 bg-gray-50 focus:ring-2 focus:ring-fuchsia-500 outline-none">
          <option value="pdf">PDF / Vista previa</option>
          <option value="none">Sin impresión</option>
        </select>

        <div class="flex justify-end gap-3 pt-3">
          <button id="btnProbarImpresora"
            class="btn-3d bg-blue-600 text-white flex items-center gap-2 px-4 py-2 text-sm">
            <i data-lucide="printer"></i> Probar
          </button>
          <button id="btnGuardarImpresora"
            class="btn-3d bg-green-600 text-white flex items-center gap-2 px-4 py-2 text-sm">
            <i data-lucide="save"></i> Guardar
          </button>
        </div>
      </div>
    </div>
  `
  );

  lucide.createIcons();
  const selTipo = document.getElementById("impresoraTipo");

  /* -------- CACHE LOCAL -------- */
  const cache = LocalDB.get(`config_impresora_${negocioId}`);
  if (cache?.tipo) selTipo.value = cache.tipo;

  /* -------- SUPABASE -------- */
  try {
    const { data } = await supabaseClient
      .from("configuracion_sistema")
      .select("valor")
      .eq("clave", "impresora")
      .eq("negocio_id", negocioId)
      .maybeSingle();

    if (data?.valor) {
      let conf = {};

      try {
        conf = typeof data.valor === "string" ? JSON.parse(data.valor) : data.valor;
      } catch {
        conf = {};
      }

      selTipo.value = conf.tipo || "pdf";
      LocalDB.set(`config_impresora_${negocioId}`, conf);
    }
  } catch (err) {
    console.warn("⚠️ No se cargó configuración de impresora:", err);
  }

  /* -------- PROBAR -------- */
  document.getElementById("btnProbarImpresora").addEventListener("click", () => {
    if (selTipo.value === "pdf") {
      Swal.fire("Modo PDF", "Se abrirá vista previa del ticket.", "info");
    } else {
      Swal.fire("Impresión desactivada", "No se enviarán tickets a imprimir.", "warning");
    }
  });

  /* -------- GUARDAR -------- */
  document.getElementById("btnGuardarImpresora").addEventListener("click", async () => {
    const tipo = selTipo.value;

    LocalDB.set(`config_impresora_${negocioId}`, { tipo });

    await supabaseClient
      .from("configuracion_sistema")
      .upsert(
        {
          negocio_id: negocioId,
          clave: "impresora",
          categoria: "sistema",
          valor: JSON.stringify({ tipo })
        },
        { onConflict: "clave,negocio_id" }
      );

    Swal.fire({
      icon: "success",
      title: "Impresora guardada",
      confirmButtonColor: "#a21caf",
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 💵 CONFIGURACIÓN DE CAJA REGISTRADORA                                      */
/* -------------------------------------------------------------------------- */
async function renderCajaConfig(container) {
  container.insertAdjacentHTML(
    "beforeend",
    `
    <div class="card-3d p-5 mb-10">
      <div class="flex items-center gap-2 mb-3 text-fuchsia-700">
        <i data-lucide="archive" class="w-5 h-5"></i>
        <span class="font-semibold text-sm">Caja Registradora</span>
      </div>

      <div class="space-y-3">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" id="cajaAuto" class="rounded border-fuchsia-300">
          <span>Abrir automáticamente al finalizar venta</span>
        </label>

        <div class="flex justify-end gap-3 pt-3">
          <button id="btnProbarCaja"
            class="btn-3d bg-blue-600 text-white flex items-center gap-2 px-4 py-2 text-sm">
            <i data-lucide="zap"></i> Probar
          </button>
          <button id="btnGuardarCaja"
            class="btn-3d bg-green-600 text-white flex items-center gap-2 px-4 py-2 text-sm">
            <i data-lucide="save"></i> Guardar
          </button>
        </div>
      </div>
    </div>
  `
  );

  lucide.createIcons();

  const chkAuto = document.getElementById("cajaAuto");

  /* -------- CACHE -------- */
  const cache = LocalDB.get(`config_caja_${negocioId}`);
  if (cache) chkAuto.checked = Boolean(cache.auto);

  /* -------- PROBAR -------- */
  document.getElementById("btnProbarCaja").addEventListener("click", async () => {
    const { simularAperturaCaja } = await import("../sistema/cajon.js");
    await simularAperturaCaja("💵 Caja abierta (PRUEBA)");
  });

  /* -------- GUARDAR -------- */
  document.getElementById("btnGuardarCaja").addEventListener("click", async () => {
    const auto = chkAuto.checked;

    LocalDB.set(`config_caja_${negocioId}`, { auto });

    await supabaseClient
      .from("configuracion_sistema")
      .upsert(
        {
          negocio_id: negocioId,
          clave: "caja",
          categoria: "sistema",
          valor: JSON.stringify({ auto })
        },
        { onConflict: "clave,negocio_id" }
      );

    Swal.fire({
      icon: "success",
      title: "Caja guardada",
      confirmButtonColor: "#a21caf",
    });
  });
}
