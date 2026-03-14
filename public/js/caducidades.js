// ✅ /public/js/caducidades.js
import { supabaseClient, protegerSesion } from "./proteccion.js";
await protegerSesion(["cajero", "admin"]);

// 🚀 Inicialización segura aunque DOMContentLoaded ya haya ocurrido
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarCaducidades);
} else {
  iniciarCaducidades();
}

function iniciarCaducidades() {
  lucide.createIcons();
  inicializarCaducidades();
}

/* -------------------------------------------------------------------------- */
/* 🎨 SweetAlert con estilo 3D                                                */
/* -------------------------------------------------------------------------- */
function showSwal3D(options) {
  return Swal.fire({
    customClass: {
      popup: "card-3d",
      confirmButton: "btn-3d",
      cancelButton: "btn-3d"
    },
    ...options
  });
}

/* -------------------------------------------------------------------------- */
/* 🚀 Inicialización                                                         */
/* -------------------------------------------------------------------------- */
function inicializarCaducidades() {
  const btnProximos = document.getElementById("btnProximos");
  const btnVencidos = document.getElementById("btnVencidos");
  const sectionProximos = document.getElementById("sectionProximos");
  const sectionVencidos = document.getElementById("sectionVencidos");

 async function mostrarSeccion(seccion) {
  sectionProximos.classList.add("hidden");
  sectionVencidos.classList.add("hidden");

  [btnProximos, btnVencidos].forEach(b =>
    b.classList.remove("ring-2", "ring-fuchsia-500")
  );

  if (seccion === "proximos") {
    sectionProximos.classList.remove("hidden");

    // ⭐ Necesario para mostrar la tabla
    setTimeout(() => sectionProximos.classList.remove("opacity-0"), 10);

    btnProximos.classList.add("ring-2", "ring-fuchsia-500");
    await cargarProximos();
  } else {
    sectionVencidos.classList.remove("hidden");

    // ⭐ Necesario para mostrar la tabla
    setTimeout(() => sectionVencidos.classList.remove("opacity-0"), 10);

    btnVencidos.classList.add("ring-2", "ring-fuchsia-500");
    await cargarVencidos();
  }
}

  btnProximos.addEventListener("click", () => mostrarSeccion("proximos"));
  btnVencidos.addEventListener("click", () => mostrarSeccion("vencidos"));

  // 🟢 Por defecto cargar Próximos
  mostrarSeccion("proximos");
}

/* -------------------------------------------------------------------------- */
/* 📅 Cargar Próximos                                                        */
/* -------------------------------------------------------------------------- */
async function cargarProximos() {
  try {

    // 🟣 AGREGADO PARA MULTINEGOCIO
    const negocio_id = localStorage.getItem("negocio_id");

    const { data, error } = await supabaseClient
      .from("v_lotes_por_caducar")
      .select("*")
      .eq("negocio_id", negocio_id)   // 🟣 AGREGADO
      .order("fecha_caducidad", { ascending: true });

    const tabla = document.getElementById("tablaProximos");
    tabla.innerHTML = "";

    if (error) throw error;

    if (!data || data.length === 0) {
      tabla.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-gray-500">Sin registros</td></tr>`;
      document.getElementById("totalProximosBtn").innerText = "(0)";
      document.getElementById("totalProximos").innerText = "0 registros";
      return;
    }

    document.getElementById("totalProximosBtn").innerText = `(${data.length})`;
    document.getElementById("totalProximos").innerText = `${data.length} registros`;

    data.forEach(r => {
      tabla.innerHTML += `
        <tr>
          <td class="p-2">${r.producto}</td>
          <td class="p-2 text-center">${r.sku || "-"}</td>
          <td class="p-2 text-center">${r.codigo_barras || "-"}</td>
          <td class="p-2 text-center">${formatearFecha(r.fecha_caducidad)}</td>
          <td class="p-2 text-center">${r.cantidad_lote ?? r.cantidad ?? 0}</td>
          <td class="p-2 text-center font-semibold text-emerald-600">${r.dias_restantes ?? 0}</td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("❌ Error cargando próximos:", err);
    showSwal3D({
      icon: "error",
      title: "Error al cargar",
      text: "No se pudo cargar Próximos a Caducar"
    });
  }
}

/* -------------------------------------------------------------------------- */
/* ⛔ Cargar Vencidos                                                        */
/* -------------------------------------------------------------------------- */
async function cargarVencidos() {
  try {

    // 🟣 AGREGADO PARA MULTINEGOCIO
    const negocio_id = localStorage.getItem("negocio_id");

    const { data, error } = await supabaseClient
      .from("v_lotes_vencidos")
      .select("*")
      .eq("negocio_id", negocio_id)   // 🟣 AGREGADO
      .order("fecha_caducidad", { ascending: true });

    const tabla = document.getElementById("tablaVencidos");
    tabla.innerHTML = "";

    if (error) throw error;

    if (!data || data.length === 0) {
      tabla.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-gray-500">Sin registros</td></tr>`;
      document.getElementById("totalVencidosBtn").innerText = "(0)";
      document.getElementById("totalVencidos").innerText = "0 registros";
      return;
    }

    document.getElementById("totalVencidosBtn").innerText = `(${data.length})`;
    document.getElementById("totalVencidos").innerText = `${data.length} registros`;

    data.forEach(r => {
      tabla.innerHTML += `
        <tr>
          <td class="p-2">${r.producto}</td>
          <td class="p-2 text-center">${r.sku || "-"}</td>
          <td class="p-2 text-center">${r.codigo_barras || "-"}</td>
          <td class="p-2 text-center">${formatearFecha(r.fecha_caducidad)}</td>
          <td class="p-2 text-center">${r.cantidad_lote ?? r.cantidad ?? 0}</td>
          <td class="p-2 text-center font-semibold text-orange-600">${r.dias_vencido ?? 0}</td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("❌ Error cargando vencidos:", err);
    showSwal3D({
      icon: "error",
      title: "Error al cargar",
      text: "No se pudo cargar productos vencidos"
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 📆 Helper de fecha                                                       */
/* -------------------------------------------------------------------------- */
function formatearFecha(fechaStr) {
  if (!fechaStr) return "-";
  const fecha = new Date(fechaStr);
  return fecha.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* -------------------------------------------------------------------------- */
/* 💾 MODO OFFLINE + CACHE AUTOMÁTICO                                        */
/* -------------------------------------------------------------------------- */
const CACHE_KEY_PROXIMOS = "smartpos_caducidades_proximos";
const CACHE_KEY_VENCIDOS = "smartpos_caducidades_vencidos";

async function guardarCache(nombre, datos) {
  try {
    localStorage.setItem(nombre, JSON.stringify({
      fecha: new Date().toISOString(),
      registros: datos
    }));
    console.log(`💾 Cache guardado: ${nombre} (${datos.length} registros)`);
  } catch (e) {
    console.warn(`⚠️ No se pudo guardar cache ${nombre}:`, e);
  }
}

function leerCache(nombre) {
  try {
    const cache = JSON.parse(localStorage.getItem(nombre) || "null");
    return cache?.registros || [];
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* 🔁 Fallback automático ONLINE / OFFLINE                                    */
/* -------------------------------------------------------------------------- */
const cargarProximosOriginal = cargarProximos;
const cargarVencidosOriginal = cargarVencidos;

cargarProximos = async function () {
  if (navigator.onLine) {
    const { data, error } = await supabaseClient
      .from("v_lotes_por_caducar")
      .select("*")
      .order("fecha_caducidad", { ascending: true });

    if (!error && data) {
      await guardarCache(CACHE_KEY_PROXIMOS, data);
      renderCaducidades("tablaProximos", data, "proximos");
      return;
    }
  }

  const cache = leerCache(CACHE_KEY_PROXIMOS);
  console.log(`📦 Usando cache (Proximos): ${cache.length}`);
  renderCaducidades("tablaProximos", cache, "proximos", true);
};

cargarVencidos = async function () {
  if (navigator.onLine) {
    const { data, error } = await supabaseClient
      .from("v_lotes_vencidos")
      .select("*")
      .order("fecha_caducidad", { ascending: true });

    if (!error && data) {
      await guardarCache(CACHE_KEY_VENCIDOS, data);
      renderCaducidades("tablaVencidos", data, "vencidos");
      return;
    }
  }

  const cache = leerCache(CACHE_KEY_VENCIDOS);
  console.log(`📦 Usando cache (Vencidos): ${cache.length}`);
  renderCaducidades("tablaVencidos", cache, "vencidos", true);
};

/* -------------------------------------------------------------------------- */
/* 🧾 Render reutilizable                                                     */
/* -------------------------------------------------------------------------- */
function renderCaducidades(tablaId, data, tipo, desdeCache = false) {
  const tabla = document.getElementById(tablaId);
  if (!tabla) return;

  tabla.innerHTML = "";
  if (!data?.length) {
    tabla.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-gray-500">
      Sin registros ${desdeCache ? "(offline)" : ""}
    </td></tr>`;
    document.getElementById(`total${tipo === "proximos" ? "Proximos" : "Vencidos"}Btn`).innerText = "(0)";
    document.getElementById(`total${tipo === "proximos" ? "Proximos" : "Vencidos"}`).innerText = "0 registros";
    return;
  }

  document.getElementById(`total${tipo === "proximos" ? "Proximos" : "Vencidos"}Btn`).innerText = `(${data.length})`;
  document.getElementById(`total${tipo === "proximos" ? "Proximos" : "Vencidos"}`).innerText =
    `${data.length} registros ${desdeCache ? "(offline)" : ""}`;

  data.forEach(r => {
    const cantidad = r.cantidad ?? 0; // FIX
    const dias = tipo === "proximos" 
      ? (r.dias_restantes ?? 0)
      : (r.dias_vencido ?? 0); // FIX

    const color = tipo === "proximos" ? "emerald-600" : "orange-600";

    tabla.innerHTML += `
      <tr>
        <td class="p-2">${r.producto}</td>
        <td class="p-2 text-center">${r.sku || "-"}</td>
        <td class="p-2 text-center">${r.codigo_barras || "-"}</td>
        <td class="p-2 text-center">${formatearFecha(r.fecha_caducidad)}</td>
        <td class="p-2 text-center">${cantidad}</td>
        <td class="p-2 text-center font-semibold text-${color}">${dias}</td>
      </tr>
    `;
  });
}

/* -------------------------------------------------------------------------- */
/* 🔁 Auto-recarga del cache al reconectarse                                 */
/* -------------------------------------------------------------------------- */
window.addEventListener("online", () => {
  console.log("☁️ Conexión restaurada, actualizando caducidades...");
  cargarProximos();
  cargarVencidos();
});

/* -------------------------------------------------------------------------- */
/* 🌐 Exportar funciones al contexto global (HTML las necesita)              */
/* -------------------------------------------------------------------------- */
window.cargarProximos = cargarProximos;
window.cargarVencidos = cargarVencidos;
