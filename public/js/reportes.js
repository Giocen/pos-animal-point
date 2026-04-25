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

function obtenerHoy() {
  const hoy = new Date();

  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0"); 
  const day = String(hoy.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}



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
  const botones = ["btnProducto", "btnCategoria", "btnFecha", "btnMargen", "btnInventario"];
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
      (tipo === "margen" && id === "btnMargen") ||
      (tipo === "inventario" && id === "btnInventario")
    )
    
    {
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

function toggleFiltros(tipo) {
  const filtros = document.getElementById("filtros");
  if (!filtros) return;

  tipoActual = tipo;

  // 🔥 SIEMPRE visibles (UX tipo sistema real)
  filtros.classList.remove("hidden");
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

    let query;

    /* -------------------------------------------------------------------------- */
    /* 🧾 REPORTE PRODUCTO (REAL DESDE ventas + detalle)                          */
    /* -------------------------------------------------------------------------- */

    if (tipo === "producto") {

    
      query = supabaseClient
        .from("ventas")
        .select(`
          id,
          fecha,
          metodo_pago,
          estado,
          negocio_id,
          ventas_detalle (
            cantidad,
            precio_total,
            costo_unitario,
            producto_id,
            productos (
              nombre,
              codigo_barras,
              sku
            )
          )
        `)
        .eq("negocio_id", negocioId)
        .neq("estado", "anulada");

      // 🔥 FILTRO FECHA
      if (fechaInicio && fechaFin) {
        query = query
          .gte("fecha", `${fechaInicio}T00:00:00`)
          .lte("fecha", `${fechaFin}T23:59:59`);
      }

      const { data, error } = await query;

     if (error || !data) {
  Swal.close();
  Swal.fire("Error", "No se pudo obtener el reporte", "error");
  return;
}      
      
     
  const filas = [];

  for (const v of data) {
    for (const d of (v.ventas_detalle || [])) {

      const venta = Number(d.precio_total || 0);
      const piezas = Number(d.cantidad || 0);
      const costoUnit = Number(d.costo_unitario || 0);

      const inversion = costoUnit * piezas;
      const ganancia = venta - inversion;
      const margen = venta > 0 ? (ganancia / venta) * 100 : 0;

      filas.push({
        codigo: d.productos?.codigo_barras || d.productos?.sku || "-",
        producto: d.productos?.nombre || "Sin nombre",
        venta,
        inversion,
        ganancia,
        metodo_pago: v.metodo_pago,
        margen,
        fecha: v.fecha
      });
    }
  }

  filas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  mostrarTablaProducto(filas);
  marcarBotonActivo(tipo);
  toggleFiltros(tipo);
  Swal.close();
  return;
}


query = supabaseClient
  .from(VISTAS[tipo])
  .select("*")
  .eq("negocio_id", negocioId);


    const colFecha =
      tipo === "margen" ? "fecha_venta" :
      tipo === "fecha" ? "fecha" :
      null;


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

document.getElementById("resumenFecha")?.classList.add("hidden");

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
  document.getElementById("resultado").classList.remove("tabla-producto-pro", "tabla-categoria");

  // 🔥 MODO ESPECIAL PARA CATEGORÍA (UI PRO)
if (tipo === "categoria") {
  return renderTablaCategoria(datos);
}

if (tipo === "fecha") {
  return renderTablaFechaProducto(datos);
}


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

function activarOrdenamiento(tablaId = "tablaCustom") {

  const tabla = document.getElementById(tablaId);
  if (!tabla) return;

  const headers = tabla.querySelectorAll("thead th");

  headers.forEach((th, index) => {
    th.style.cursor = "pointer";

    th.addEventListener("click", () => {

      const tbody = tabla.querySelector("tbody");
      const filas = Array.from(tbody.querySelectorAll("tr"));

      // 🔥 limpiar otros headers
      headers.forEach(h => {
        if (h !== th) {
          h.classList.remove("asc", "desc", "activo");
          h.innerHTML = h.innerHTML.replace(/ ↑| ↓/g, "");
        }
      });

      // 🔥 toggle estado
      const asc = !th.classList.contains("asc");

      th.classList.toggle("asc", asc);
      th.classList.toggle("desc", !asc);
      th.classList.add("activo");

      // 🔥 icono visual
      const textoBase = th.getAttribute("data-label") || th.innerText.replace(/ ↑| ↓/g, "");
      th.setAttribute("data-label", textoBase);
      th.innerHTML = textoBase + (asc ? " ↑" : " ↓");

      filas.sort((a, b) => {

        let A = a.children[index].innerText.replace(/[^\d.-]/g, "");
        let B = b.children[index].innerText.replace(/[^\d.-]/g, "");

        const aNum = parseFloat(A);
        const bNum = parseFloat(B);

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return asc ? aNum - bNum : bNum - aNum;
        }

        return asc
          ? A.localeCompare(B)
          : B.localeCompare(A);
      });

      filas.forEach(f => tbody.appendChild(f));
    });
  });

  // 🔥 ORDEN AUTOMÁTICO (GANANCIA DESC si existe)
  const headersTexto = Array.from(headers).map(h => h.innerText.toLowerCase());

  const idxGanancia = headersTexto.findIndex(h =>
    h.includes("ganancia")
  );

  if (idxGanancia !== -1) {
    headers[idxGanancia].click(); // primer click (asc)
    headers[idxGanancia].click(); // segundo click (desc)
  }
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

document.getElementById("btnProducto")?.addEventListener("click", () => {
  tipoActual = "producto";
  generarReporte("producto");
});

document.getElementById("btnCategoria")?.addEventListener("click", () => {
  tipoActual = "categoria";
  generarReporte("categoria");
});

document.getElementById("btnFecha")?.addEventListener("click", () => {
  const inicio = document.getElementById("fechaInicio").value;
  const fin = document.getElementById("fechaFin").value;

  tipoActual = "fecha";
  generarReporte("fecha", inicio, fin);
});

document.getElementById("btnInventario")?.addEventListener("click", () => {
  tipoActual = "inventario";
  marcarBotonActivo("inventario"); 
  cargarInventario();
});

/* -------------------------------------------------------------------------- */
/* 📅 Aplicar filtro                                                         */
/* -------------------------------------------------------------------------- */

document.getElementById("btnAplicarFiltro")?.addEventListener("click", () => {

  const periodo = document.getElementById("periodo").value;
  let inicio = document.getElementById("fechaInicio").value;
  let fin = document.getElementById("fechaFin").value;

  // 🔄 Autocalcular rango
  if (periodo) {
    const rango = calcularRangoPorPeriodo(periodo);
    inicio = rango.inicio;
    fin = rango.fin;

    document.getElementById("fechaInicio").value = inicio;
    document.getElementById("fechaFin").value = fin;
  }

  // ⚠ Validación
  if (!inicio || !fin) {
    return showSwal3D({
      title: "Aviso",
      text: "Selecciona un rango válido",
      icon: "warning",
    });
  }

  // 🔥 EJECUCIÓN CORRECTA SEGÚN REPORTE ACTIVO
  switch (tipoActual) {

    case "producto":
      generarReporte("producto", inicio, fin);
      break;

    case "categoria":
      generarReporte("categoria", inicio, fin);
      break;

    case "margen":
      generarReporte("margen", inicio, fin);
      break;

    case "fecha":
    default:
      generarReporte("fecha", inicio, fin);
      break;
  }

});
/* -------------------------------------------------------------------------- */
/* 💾 Restaurar último reporte                                               */
/* -------------------------------------------------------------------------- */
window.addEventListener("DOMContentLoaded", async () => {

  const inputInicio = document.getElementById("fechaInicio");
  const inputFin = document.getElementById("fechaFin");

  if (!inputInicio || !inputFin) return;

  // 🔥 1. INTENTAR RECUPERAR ÚLTIMO FILTRO
  const ultimo = LocalDB.get("ultimo_reporte");

  let inicio, fin, tipo;

  if (ultimo?.fechaInicio && ultimo?.fechaFin) {
    inicio = ultimo.fechaInicio;
    fin = ultimo.fechaFin;
    tipo = ultimo.tipo || "fecha";

    console.log("♻️ Restaurando filtro:", ultimo);

  } else {
    // 🔥 2. SI NO HAY, USAR HOY
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");

    inicio = `${yyyy}-${mm}-${dd}`;
    fin = inicio;
    tipo = "fecha";

    console.log("📅 Usando fecha actual:", inicio);
  }

  // ✅ SETEAR INPUTS
  inputInicio.value = inicio;
  inputFin.value = fin;

  tipoActual = tipo;

  // 🚀 GENERAR
  await generarReporte(tipo, inicio, fin);
  marcarBotonActivo(tipo);

  programarActualizacionMedianoche();
});

function mostrarTablaProducto(filas) {
  const contenedor = document.getElementById("resultado");
  contenedor.className = "tabla-producto-pro w-full overflow-x-auto";
 

  if (!filas.length) {
  contenedor.innerHTML =

      "<p class='text-gray-400'>Sin datos</p>";
    return;
  }

  const formato = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });

  const totalVenta = filas.reduce((a, v) => a + Number(v.venta || 0), 0);
  const totalInversion = filas.reduce((a, v) => a + Number(v.inversion || 0), 0);
  const totalGanancia = filas.reduce((a, v) => a + Number(v.ganancia || 0), 0);

  const html = `  

     <table id="tablaCustom" class="w-full text-sm table-auto">

      <thead class="bg-[#1a042d] text-fuchsia-300">
      <tr>

          <th class="text-left">Código</th>
          <th class="text-left">Producto</th>
          <th class="text-right">Venta</th>
          <th class="text-right">Inversión</th>
          <th class="text-right">Ganancia</th>
          <th class="text-right">Pago</th>
          <th class="text-right">Margen</th>
          <th class="text-right">Fecha</th>

        </tr>
      </thead>

     <tbody>
          ${filas.map(p => `
            <tr class="border-b border-fuchsia-600/20">
              <td>${p.codigo}</td>
              <td class="max-w-[300px] whitespace-normal break-words">${p.producto}</td>

              <td class="text-right text-blue-300 font-semibold">
                ${formato.format(p.venta)}
              </td>

              <td class="text-right text-orange-300 font-semibold">
                ${formato.format(p.inversion)}
              </td>

              <td class="text-right font-bold text-green-400 text-lg">
                ${formato.format(p.ganancia)}
              </td>

              <td class="text-right text-purple-300">
                ${p.metodo_pago?.toUpperCase()}
              </td>

              <td class="text-right text-pink-400 font-bold">
                ${p.margen.toFixed(2)}%
              </td>

              <td class="text-right text-gray-400">
                ${new Date(p.fecha).toLocaleDateString("es-MX")}
              </td>
            </tr>
          `).join("")}
        </tbody>

       <tfoot>
        <tr class="border-t border-fuchsia-600/30 bg-[#1a042d]">

          <!-- Código -->
          <td></td>

          <!-- Producto -->
          <td class="text-right pr-2 text-fuchsia-300 font-semibold">
            TOTAL:
          </td>

          <!-- Venta -->
          <td class="text-right text-blue-300 font-semibold">
            ${formato.format(totalVenta)}
          </td>

          <!-- Inversión -->
          <td class="text-right text-orange-300 font-semibold">
            ${formato.format(totalInversion)}
          </td>

          <!-- Ganancia -->
          <td class="text-right text-green-400 font-bold text-lg">
            ${formato.format(totalGanancia)}
          </td>

          <!-- Pago -->
          <td></td>

          <!-- Margen -->
          <td></td>

          <!-- Fecha -->
          <td></td>

        </tr>
        </tfoot>

    </table>

  
  `;

  contenedor.innerHTML = html; 
  activarOrdenamiento("tablaCustom");

}

function renderTablaCategoria(datos) {

  const contenedor = document.getElementById("resultado");
  contenedor.className = "tabla-producto-pro tabla-categoria w-full overflow-x-auto";

  

  if (!datos.length) {
    contenedor.innerHTML = "<p class='text-gray-400'>Sin datos</p>";
    return;
  }

  const formato = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });

  const totalPiezas = datos.reduce((a, v) => a + Number(v.piezas_vendidas || 0), 0);
  const totalIngreso = datos.reduce((a, v) => a + Number(v.ingreso_total || 0), 0);
  const totalCosto = datos.reduce((a, v) => a + Number(v.costo_total || 0), 0);
  const totalGanancia = totalIngreso - totalCosto;

  // 🔥 ORDENAR POR LO MÁS IMPORTANTE
  datos.sort((a, b) => Number(b.ingreso_total) - Number(a.ingreso_total));

  const html = `
    <table id="tablaCustom" class="w-full text-sm table-auto">

      <thead class="bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white">
        <tr>
          <th class="text-left px-4 py-3">Categoría</th>
          <th class="text-right px-4 py-3">Piezas</th>
          <th class="text-right px-4 py-3">% Ventas</th>
          <th class="text-right px-4 py-3">Ingreso</th>
          <th class="text-right px-4 py-3">Inversión</th>
          <th class="text-right px-4 py-3">Ganancia</th>
        </tr>
      </thead>

      <tbody>
        ${datos.map((c) => {

          const piezas = Number(c.piezas_vendidas || 0);
          const ingreso = Number(c.ingreso_total || 0);
          const costo = Number(c.costo_total || 0);
          const ganancia = ingreso - costo;

          const porcentaje = totalIngreso > 0
            ? (ingreso / totalIngreso) * 100
            : 0;

          return `
            <tr class="border-b border-fuchsia-600/20">
              <td class="px-4 py-2">
                ${c.categoria || "Sin categoría"}
              </td>

              <td class="px-4 py-2">
                ${piezas.toLocaleString()}
              </td>

              <td class="px-4 py-2">
                ${porcentaje.toFixed(2)}%
              </td>

              <td class="px-4 py-2">
                ${formato.format(ingreso)}
              </td>

              <td class="px-4 py-2">
                ${formato.format(costo)}
              </td>

              <td class="px-4 py-2">
                ${formato.format(ganancia)}
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>

     <tfoot>
          <tr class="border-t border-fuchsia-600/30 bg-[#1a042d]">

            <td class="px-4 py-3 text-right">
              TOTAL:
            </td>

            <td class="px-4 py-3">
              ${totalPiezas.toLocaleString()}
            </td>

            <td class="px-4 py-3"></td>

            <td class="px-4 py-3">
              ${formato.format(totalIngreso)}
            </td>

            <td class="px-4 py-3">
              ${formato.format(totalCosto)}
            </td>

            <td class="px-4 py-3">
              ${formato.format(totalGanancia)}
            </td>

          </tr>
        </tfoot>

    </table>
  `;

  contenedor.innerHTML = html;  
  activarOrdenamiento("tablaCustom");

}


function renderTablaFechaProducto(datos) {

  const contenedor = document.getElementById("resultado");

  // 🔥 activar estilos pro
  contenedor.className = "tabla-producto-pro tabla-categoria w-full overflow-x-auto";

  if (!datos.length) {
    contenedor.innerHTML = "<p class='text-gray-400'>Sin datos</p>";
    return;
  }

  const formato = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });

  // 🔥 AGRUPAR POR PRODUCTO
  const mapa = {};

  for (const row of datos) {
    const nombre = row.producto || "Sin nombre";

    if (!mapa[nombre]) {
      mapa[nombre] = {
        producto: nombre,
        piezas: 0,
        ingreso: 0,
        costo: 0,
      };
    }

    const piezas = Number(row.piezas_vendidas || 0);
    const ingreso = Number(row.ingreso_total || 0);
    const costo = Number(row.costo_total || 0);

    mapa[nombre].piezas += piezas;
    mapa[nombre].ingreso += ingreso;
    mapa[nombre].costo += costo;
  }

  const lista = Object.values(mapa);

  // 🔥 ORDENAR POR INGRESO
  lista.sort((a, b) => b.ingreso - a.ingreso);

  const totalIngreso = lista.reduce((a, v) => a + v.ingreso, 0);
  const totalPiezas = lista.reduce((a, v) => a + v.piezas, 0);
  const totalCosto = lista.reduce((a, v) => a + v.costo, 0);
  const totalGanancia = totalIngreso - totalCosto;

  const html = `
    <table id="tablaCustom" class="w-full text-sm table-auto">

      <thead>
        <tr>
          <th>Producto</th>
          <th>Piezas</th>
          <th>% Ventas</th>
          <th>Ingreso</th>
          <th>Inversión</th>
          <th>Ganancia</th>
        </tr>
      </thead>

      <tbody>
        ${lista.map(p => {

          const ganancia = p.ingreso - p.costo;

          const porcentaje = totalIngreso > 0
            ? (p.ingreso / totalIngreso) * 100
            : 0;

          return `
            <tr>
              <td>${p.producto}</td>
              <td>${p.piezas.toLocaleString()}</td>
              <td>${porcentaje.toFixed(2)}%</td>
              <td>${formato.format(p.ingreso)}</td>
              <td>${formato.format(p.costo)}</td>
              <td>${formato.format(ganancia)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>

      <tfoot>
        <tr>
          <td class="text-right">TOTAL:</td>
          <td>${totalPiezas.toLocaleString()}</td>
          <td></td>
          <td>${formato.format(totalIngreso)}</td>
          <td>${formato.format(totalCosto)}</td>
          <td>${formato.format(totalGanancia)}</td>
        </tr>
      </tfoot>

    </table>
  `;

  contenedor.innerHTML = html;  
  activarOrdenamiento("tablaCustom");

}

async function cargarInventario() {

  const contenedor = document.getElementById("resultado");

  const negocioId = getNegocioIdSeguro();

  const { data, error } = await supabaseClient
    .from("v_reporte_inventario_valorizado")
    .select("*")
    .eq("negocio_id", negocioId);

  if (error) {
    console.error(error);
    return;
  }

  // 🔥 FORMATO MONEDA (IGUAL QUE TODO EL SISTEMA)
  const formato = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });

  let totalVenta = 0;
  let totalInversion = 0;
  let totalGanancia = 0;

  const filas = data.map(p => {

    const venta = Number(p.valor_venta || 0);
    const inversion = Number(p.inversion_total || 0);
    const ganancia = Number(p.ganancia || 0);

    totalVenta += venta;
    totalInversion += inversion;
    totalGanancia += ganancia;

    return `
      <tr>
        <td>${p.producto}</td>

        <td class="text-right">
          ${Number(p.existencias || 0).toLocaleString("es-MX")}
        </td>

        <td class="text-right text-blue-600 font-semibold">
          ${formato.format(venta)}
        </td>

        <td class="text-right text-orange-600 font-semibold">
          ${formato.format(inversion)}
        </td>

        <td class="text-right text-green-600 font-bold">
          ${formato.format(ganancia)}
        </td>
      </tr>
    `;
  }).join("");

  contenedor.className = "tabla-producto-pro tabla-categoria w-full overflow-x-auto";

  contenedor.innerHTML = `
  <table id="tablaCustom">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Stock</th>
          <th>Valor Venta</th>
          <th>Inversión</th>
          <th>Ganancia</th>
        </tr>
      </thead>

      <tbody>
        ${filas}
      </tbody>

      <tfoot>
        <tr>
          <td>TOTAL</td>
          <td></td>

          <td class="text-right">
            ${formato.format(totalVenta)}
          </td>

          <td class="text-right">
            ${formato.format(totalInversion)}
          </td>

          <td class="text-right font-bold">
            ${formato.format(totalGanancia)}
          </td>
        </tr>
      </tfoot>
    </table>
  `;

  activarOrdenamiento("tablaCustom");
}