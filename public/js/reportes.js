// 💜 SmartPOS - Módulo de Reportes (v1.9.1 con cache LocalDB + fix marcarBotonActivo)
// --------------------------------------------------------------------------
// ✅ Lógica original intacta
// ✅ Agrega recordatorio de último tipo de reporte (LocalDB)
// ✅ Sin NaN
// ✅ Sin cambios de fechas
// --------------------------------------------------------------------------

import { supabaseClient, protegerSesion } from "./proteccion.js";
import { LocalDB } from "./localdb.js";

/* -------------------------------------------------------------------------- */
/* 🔐 HELPERS (DEBEN EXISTIR ANTES DE await)                                  */
/* -------------------------------------------------------------------------- */

// 🔐 Obtener negocio_id de forma segura (SmartPOS estándar)
function getNegocioIdSeguro() {
  return (
    localStorage.getItem("negocio_id") ||
    window.usuarioActual?.negocio_id ||
    null
  );
}

/* -------------------------------------------------------------------------- */
/* 🎨 Marcar botón activo                                                     */
/* -------------------------------------------------------------------------- */
function marcarBotonActivo(tipo) {
  const botones = ["btnProducto", "btnCategoria", "btnFecha", "btnMargen"];
  botones.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.classList.remove(
      "ring-2",
      "ring-offset-2",
      "ring-fuchsia-600",
      "scale-105",
      "shadow-lg"
    );

    if (
      (tipo === "producto" && id === "btnProducto") ||
      (tipo === "categoria" && id === "btnCategoria") ||
      (tipo === "fecha" && id === "btnFecha") ||
      (tipo === "margen" && id === "btnMargen")
    ) {
      btn.classList.add(
        "ring-2",
        "ring-offset-2",
        "ring-fuchsia-600",
        "scale-105",
        "shadow-lg"
      );
    }
  });
}

/* -------------------------------------------------------------------------- */
/* 🔹 Mostrar u ocultar filtros                                                */
/* -------------------------------------------------------------------------- */
let tipoActual = null;

function toggleFiltros(tipo, forzarCerrar = false) {
  const filtros = document.getElementById("filtros");
  tipoActual = tipo;

  if (forzarCerrar || (tipo !== "fecha" && tipo !== "margen")) {
    filtros.classList.add("hidden");
  }
}

/* -------------------------------------------------------------------------- */
/* 🧩 Helper universal SweetAlert3D                                            */
/* -------------------------------------------------------------------------- */
function showSwal3D({ title, text, icon = "info", html = null }) {
  return Swal.fire({
    title,
    html: html || `<p>${text || ""}</p>`,
    icon,
    confirmButtonText: "Aceptar",
    customClass: {
      popup: "card-3d",
      confirmButton: "btn-3d",
      cancelButton: "btn-3d",
    },
    didOpen: () => lucide.createIcons(),
  });
}

/* -------------------------------------------------------------------------- */
/* 🔐 Protección REAL MultiNegocio                                            */
/* -------------------------------------------------------------------------- */
const usuario = await protegerSesion(["admin"]);

// 🟣 Activar iconos
document.addEventListener("DOMContentLoaded", () => lucide.createIcons());

// 🔒 Doble verificación
if (usuario.rol !== "admin") {
  Swal.fire({
    icon: "error",
    title: "Acceso denegado",
    text: "Solo el administrador puede acceder al módulo de reportes.",
    confirmButtonColor: "#a21caf",
  }).then(() => (window.location.href = "/ventas/venta.html"));

  throw new Error("Acceso restringido al módulo de reportes");
}

/* -------------------------------------------------------------------------- */
/* 📊 Vistas, alias, iconos y colores                                         */
/* -------------------------------------------------------------------------- */
const VISTAS = {
  producto: "v_reporte_ventas_producto",
  categoria: "v_reporte_ventas_categoria",
  fecha: "v_reporte_ventas_fecha_real", 
  margen: "v_reporte_margen_utilidad",
};

const ALIAS = {
  producto: "Producto",
  descripcion: "Descripción",
  categoria: "Categoría",
  fecha_venta: "Fecha Venta",
  fecha: "Fecha",
  piezas_vendidas: "Piezas Vendidas",
  ingreso_total: "Ingreso Total ($)",
  costo_total: "Costo Total ($)",
  utilidad: "Utilidad ($)",
  margen_porcentaje: "Margen (%)",
};

const ICONOS = {
  producto: "package",
  descripcion: "align-left",
  categoria: "layers",
  fecha_venta: "calendar",
  fecha: "calendar",
  piezas_vendidas: "hash",
  ingreso_total: "dollar-sign",
  costo_total: "credit-card",
  utilidad: "trending-up",
  margen_porcentaje: "percent",
};

const COLORES = {
  producto: "bg-blue-600 text-white",
  categoria: "bg-indigo-600 text-white",
  fecha: "bg-teal-600 text-white",
  margen: "bg-pink-600 text-white",
};

/* -------------------------------------------------------------------------- */
/* 🚀 Generar reporte                                                         */
/* -------------------------------------------------------------------------- */
async function generarReporte(tipo, fechaInicio = null, fechaFin = null) {
  Swal.fire({
    title: "Generando reporte...",
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false,
    customClass: { popup: "card-3d" },
  });

  try {
    const negocioId = getNegocioIdSeguro();
    if (!negocioId) {
      Swal.fire({
        icon: "error",
        title: "Error de sesión",
        text: "No se pudo determinar el negocio activo.",
      });
      Swal.close();
      return;
    }

    let query = supabaseClient
      .from(VISTAS[tipo])
      .select("*")
      .eq("negocio_id", negocioId);

    const colFecha =
      tipo === "margen" ? "fecha_venta" :
      tipo === "fecha" ? "fecha" : null;

    if (colFecha && fechaInicio && fechaFin) {
      const fechaIni = new Date(fechaInicio);
      const fechaFinObj = new Date(fechaFin);
      fechaFinObj.setHours(23, 59, 59, 999);

      const formato = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        const ss = String(d.getSeconds()).padStart(2, "0");
        return `${y}-${m}-${day}T${hh}:${mm}:${ss}`;
      };

      query = query
        .gte(colFecha, formato(fechaIni))
        .lte(colFecha, formato(fechaFinObj))
        .order(colFecha, { ascending: false });
    } else if (colFecha) {
      query = query.order(colFecha, { ascending: false });
    }

    const { data, error } = await query;

if (data && !error) {
  LocalDB.set(`reporte_${tipo}`, { data, fechaInicio, fechaFin }, 30);
}

if (error || !data?.length) {
  const cached = LocalDB.get(`reporte_${tipo}`);
  if (cached?.data?.length) {
    mostrarTabla(cached.data, tipo);
    marcarBotonActivo(tipo);
    toggleFiltros(tipo);
    Swal.close();
    return;
  }

  Swal.fire({
    icon: "info",
    title: "Sin resultados",
    text: "No se encontraron registros.",
  });
  Swal.close();
  return;
}

/* ✅ RESUMEN REAL: SOLO DE LO VENDIDO */
if (tipo === "fecha" && fechaInicio && fechaFin) {

  let totalVentas = 0;
  let costo = 0;

  for (const row of data) {
    totalVentas += Number(row.ingreso_total || 0);

    // 🔑 costo REAL = costo_unitario × piezas_vendidas
      const piezas = Number(row.piezas_vendidas || 0);
    const costoUnit = Number(row.costo_unitario || 0);

    costo += costoUnit * piezas;

  }

  const totalUtilidad = totalVentas - costo;
  const margen = totalVentas > 0
    ? (totalUtilidad / totalVentas) * 100
    : 0;

  renderResumenFecha({
    totalVentas,
    costo,
    totalUtilidad,
    margen
  });

} else {
  document.getElementById("resumenFecha")?.classList.add("hidden");
}

/* ✅ Y DESPUÉS LA TABLA */
mostrarTabla(data, tipo);
marcarBotonActivo(tipo);
toggleFiltros(tipo);
LocalDB.set("ultimo_reporte", { tipo, fechaInicio, fechaFin }, 1440);
Swal.close();


  } catch (err) {
    console.error("❌ Error generando reporte:", err);
    showSwal3D({
      title: "Error",
      text: "No se pudo generar el reporte.",
      icon: "error",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 📊 Resumen de ventas por fecha (TOTAL / GANANCIA / MARGEN)                 */
/* -------------------------------------------------------------------------- */
function renderResumenFecha({ totalVentas, costo, totalUtilidad, margen }) {
  const cont = document.getElementById("resumenFecha");
  if (!cont) return;

  cont.classList.remove("hidden");

  cont.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
      
      <div class="card-3d p-4 text-center">
        <p class="text-sm text-gray-500">Total vendido</p>
        <p class="text-2xl font-bold text-fuchsia-600">
          $${totalVentas.toFixed(2)}
        </p>
      </div>

      <div class="card-3d p-4 text-center">
        <p class="text-sm text-gray-500">Para reinvertir</p>
        <p class="text-2xl font-bold text-orange-600">
          $${costo.toFixed(2)}
        </p>
      </div>

      <div class="card-3d p-4 text-center">
        <p class="text-sm text-gray-500">Ganancia</p>
        <p class="text-2xl font-bold text-green-600">
          $${totalUtilidad.toFixed(2)}
        </p>
      </div>

      <div class="card-3d p-4 text-center">
        <p class="text-sm text-gray-500">Margen</p>
        <p class="text-2xl font-bold text-purple-600">
          ${margen.toFixed(2)}%
        </p>
      </div>

    </div>
  `;
}


/* -------------------------------------------------------------------------- */
/* 📋 Mostrar tabla dinámica                                                  */
/* -------------------------------------------------------------------------- */
function mostrarTabla(datos, tipo) {
  if (!datos.length) {
    document.getElementById("resultado").innerHTML =
      "<p class='text-gray-500'>Sin datos</p>";
    return;
  }

  const headers = Object.keys(datos[0]);
  const headersVisibles = headers.filter(h => h !== "negocio_id");
  const colorHeader = COLORES[tipo] || "bg-gray-100";

  const totales = {};
  headers.forEach((h) => {
    if (
      h === "fecha" || h === "fecha_venta" ||
      h === "categoria" || h === "descripcion" || h === "producto"
    ) return;

    let suma = 0, esNumerico = true;
    for (let row of datos) {
      const num = parseFloat(row[h]);
      if (!isNaN(num)) suma += num;
      else { esNumerico = false; break; }
    }
    if (esNumerico) totales[h] = suma;
  });

  const formatoMoneda = new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", minimumFractionDigits: 2,
  });
  const formatoNumero = new Intl.NumberFormat("es-MX");

  let tabla = `
  <table id="tablaReporte" class="table-3d border-collapse text-sm w-full">
    <thead class="${colorHeader}">
      <tr>
        ${headersVisibles.map((h, i) => `
          <th data-index="${i}" class="px-4 py-2 border cursor-pointer">
            <i data-lucide="${ICONOS[h] || "circle"}"></i> ${ALIAS[h] || h}
            <span class="orden-indicador text-xs"></span>
          </th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${datos.map(row => `
        <tr>
          ${headersVisibles.map(h => {
            const val = row[h];
            if (["ingreso_total"].includes(h))
              return `<td class="text-right">${formatoMoneda.format(val || 0)}</td>`;
            if (h === "margen_porcentaje")
              return `<td class="text-right">${(+val || 0).toFixed(2)}%</td>`;
            if (h === "fecha" || h === "fecha_venta") {
                return `<td>${val ?? ""}</td>`;
              }

              if (!isNaN(parseFloat(val))) {
                return `<td class="text-right">${formatoNumero.format(val)}</td>`;
              }
            return `<td>${val ?? ""}</td>`;
          }).join("")}
        </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr class="font-bold bg-fuchsia-100">
        ${headers.map(h => {
          if (totales[h] !== undefined) {
            if (["ingreso_total"].includes(h))
              return `<td class="text-right">${formatoMoneda.format(totales[h])}</td>`;
            if (h === "margen_porcentaje")
              return `<td class="text-right">${(totales[h] / datos.length).toFixed(2)}%</td>`;
            return `<td class="text-right">${formatoNumero.format(totales[h])}</td>`;
          }
          return `<td></td>`;
        }).join("")}
      </tr>
    </tfoot>
  </table>`;

  document.getElementById("resultado").innerHTML = tabla;
  document.querySelectorAll("#tablaReporte thead th")
    .forEach(th => th.addEventListener("click", () => ordenarTabla(th.dataset.index)));
  lucide.createIcons();
}

/* -------------------------------------------------------------------------- */
/* 🔄 Ordenar columnas                                                       */
/* -------------------------------------------------------------------------- */
function ordenarTabla(colIndex) {
  const tabla = document.getElementById("tablaReporte");
  const tbody = tabla.querySelector("tbody");
  const filas = Array.from(tbody.querySelectorAll("tr"));

  const asc = tabla.getAttribute("data-sort-col") != colIndex ||
              tabla.getAttribute("data-sort-order") !== "asc";

  filas.sort((a, b) => {
    const A = a.children[colIndex].innerText.replace(/[^\d.-]/g, "");
    const B = b.children[colIndex].innerText.replace(/[^\d.-]/g, "");
    const aNum = parseFloat(A), bNum = parseFloat(B);

    if (!isNaN(aNum) && !isNaN(bNum)) return asc ? aNum - bNum : bNum - aNum;
    return asc ? A.localeCompare(B) : B.localeCompare(A);
  });

  filas.forEach(f => tbody.appendChild(f));
  tabla.setAttribute("data-sort-col", colIndex);
  tabla.setAttribute("data-sort-order", asc ? "asc" : "desc");
}

/* -------------------------------------------------------------------------- */
/* 📆 Calcular rango automático                                              */
/* -------------------------------------------------------------------------- */
function calcularRangoPorPeriodo(periodo) {
  const hoy = new Date();
  let inicio, fin;

  if (periodo === "semana") {
    const diaSemana = hoy.getDay();
    inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - diaSemana + 1);
    fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
  }

  if (periodo === "mes") {
    inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  }

  if (periodo === "30dias") {
    inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - 30);
    fin = hoy;
  }

  const toISO = (d) => d.toISOString().split("T")[0];
  return { inicio: toISO(inicio), fin: toISO(fin) };
}

/* -------------------------------------------------------------------------- */
/* 🔗 Eventos                                                                */
/* -------------------------------------------------------------------------- */
document.getElementById("btnProducto")?.addEventListener("click", () => generarReporte("producto"));
document.getElementById("btnCategoria")?.addEventListener("click", () => generarReporte("categoria"));
document.getElementById("btnFecha")?.addEventListener("click", () => generarReporte("fecha"));
document.getElementById("btnMargen")?.addEventListener("click", () => generarReporte("margen"));

document.getElementById("btnAplicarFiltro")?.addEventListener("click", () => {
  const periodo = document.getElementById("periodo").value;
  let inicio = document.getElementById("fechaInicio").value;
  let fin = document.getElementById("fechaFin").value;

  if (periodo) {
    const rango = calcularRangoPorPeriodo(periodo);
    inicio = rango.inicio;
    fin = rango.fin;
    document.getElementById("fechaInicio").value = inicio;
    document.getElementById("fechaFin").value = fin;
  }

  if (!inicio || !fin) {
    return showSwal3D({
      title: "Aviso",
      text: "Selecciona un rango válido",
      icon: "warning",
    });
  }

  if (document.getElementById("btnMargen").classList.contains("ring-2")) {
    generarReporte("margen", inicio, fin);
  } else {
    generarReporte("fecha", inicio, fin);
  }
});

/* -------------------------------------------------------------------------- */
/* 💾 Restaurar último reporte                                               */
/* -------------------------------------------------------------------------- */
window.addEventListener("DOMContentLoaded", async () => {
  const ultimo = LocalDB.get("ultimo_reporte");
  if (!ultimo?.tipo) return;

  try {
    await generarReporte(ultimo.tipo, ultimo.fechaInicio, ultimo.fechaFin);
    if (ultimo.fechaInicio && ultimo.fechaFin) {
      document.getElementById("fechaInicio").value = ultimo.fechaInicio;
      document.getElementById("fechaFin").value = ultimo.fechaFin;
    }
    marcarBotonActivo(ultimo.tipo);
    toggleFiltros(ultimo.tipo);
  } catch (err) {
    console.warn("⚠️ No se pudo restaurar el último reporte:", err.message);
  }
});
