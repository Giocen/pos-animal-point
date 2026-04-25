// 💜 SmartPOS | Módulo de Productos (Online/Offline + Báscula + Buscador)

import { supabaseClient, protegerSesion } from "/js/proteccion.js";
import { db, inicializarDB } from "../db.js";
import { carrito, renderCarrito } from "./carrito.js";

let resultadosBusqueda = [];
let indiceSeleccionado = -1;
let bloqueoSubmit = false;
let bloqueoAgregar = false;
let bloqueoNavegacion = false;
let indexSku = new Map();
let indexCodigo = new Map();
let indexNombre = new Map();
let productoSeleccionado = null;
let cacheProductos = [];
let productosInicializados = false;
let productosListos = false;

/* =========================================
   SCANNER GLOBAL SEPARADO DEL INPUT VISUAL
========================================= */
let bufferScanner = "";
let timeoutScanner = null;
let ultimoScannerAt = 0;
let ultimoCodigo = "";
let ultimoTiempo = 0;

let negocioId;

/* ========================================================== */
/* 🔧 HELPERS */
/* ========================================================== */

function esProductoKg(producto) {
  const unidad = (producto.unidad || "").toLowerCase().trim();
  return unidad.includes("kg") || unidad.includes("kilo");
}

function normalizarCodigo(c) {
  return (c || "").toString().trim();
}

function limpiarAutocomplete() {
  const autocompleteBox = document.getElementById("autocompleteProductos");
  if (!autocompleteBox) return;

  autocompleteBox.classList.add("hidden");
  autocompleteBox.innerHTML = "";
  
  indiceSeleccionado = -1;
}

function debounceSmartPOS(fn, delay = 150) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* ========================================================== */
/* 🔍 AGREGAR PRODUCTO */
/* ========================================================== */

async function agregarProductoDesdeBusqueda(prod) {
  limpiarAutocomplete();

  if (bloqueoAgregar) return;
  bloqueoAgregar = true;

  setTimeout(() => (bloqueoAgregar = false), 120);

  const inputSku = document.getElementById("sku");
  const form = document.getElementById("formBuscar");

  if (!inputSku || !form) return;

  inputSku.value = prod.codigo_barras || prod.sku;
  form.dispatchEvent(new Event("submit", { cancelable: true }));
}

/* ========================================================== */
/* 📡 SCANNER GLOBAL */
/* ========================================================== */

async function procesarScanner(codigo) {
  if (!codigo) return;

  const ahora = Date.now();

  // 🔥 anti doble scan
  if (codigo === ultimoCodigo && ahora - ultimoTiempo < 400) return;

  ultimoCodigo = codigo;
  ultimoTiempo = ahora;

  limpiarAutocomplete();

  const inputSku = document.getElementById("sku");
  if (inputSku) inputSku.value = codigo;

  const producto = await buscarProductoTotal(codigo);

  if (producto) {
    await agregarProductoDesdeBusqueda(producto);
  } else {
    if (inputSku) inputSku.value = "";
  }

  bufferScanner = "";
  clearTimeout(timeoutScanner);
}

/* ========================================================== */
/* 🚀 INICIALIZACIÓN */
/* ========================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  if (productosInicializados) return;
  productosInicializados = true;

  await protegerSesion(["admin", "cajero"]);

  negocioId = localStorage.getItem("negocio_id");

  if (!negocioId) {
    console.warn("⚠ negocio_id no disponible aún");
    return;
  }

  if (!db) {
    await inicializarDB();
  }

  /* ==========================================================
     🔥 CARGA INTELIGENTE (FIX DEFINITIVO)
  ========================================================== */

 const respaldoDexie = await db.productos
  .where("negocio_id")
  .equals(negocioId)
  .toArray();

// 🔥 validar global correctamente
let productos = (window.productosGlobal || [])
  .filter(p => p.negocio_id === negocioId);

// 🔥 SIEMPRE usar el mejor dataset
if (!productos.length) {
  productos = respaldoDexie;
}

// 🔥 si Dexie tiene más → usar Dexie
if (respaldoDexie.length > productos.length) {
  productos = respaldoDexie;
}

  /* ==========================================================
     🧠 CACHE CONTROLADO
  ========================================================== */

  if (productos && productos.length) {
    const nuevos = productos.filter(p => p.negocio_id === negocioId);

    if (nuevos.length) {
      cacheProductos = nuevos;
      window.cacheProductosGlobal = cacheProductos;
      indexarProductos(cacheProductos);
      resultadosBusqueda = cacheProductos.slice(0, 12);
      cachearProductos(cacheProductos);
    } else {
      console.warn("⚠ Evitando sobrescribir cache con vacío");
    }

  } else {

    /* 🔥 fallback Supabase SOLO si todo está vacío */

    const { data } = await supabaseClient
      .from("v_productos_existencias")
      .select(`
        id,
        negocio_id,
        nombre,
        descripcion,
        sku,
        codigo_barras,
        precio_base,
        costo,
        unidad,
        existencias_total,
        stock_minimo
      `)
      .eq("negocio_id", negocioId);

    if (data?.length) {
      const nuevos = data.filter(p => p.negocio_id === negocioId);

      if (nuevos.length) {
        cacheProductos = nuevos;
        indexarProductos(cacheProductos);
        resultadosBusqueda = cacheProductos.slice(0, 12);
        cachearProductos(cacheProductos);
      }
    }
  }

  /* ==========================================================
     🔥 FALLBACK FINAL (NUNCA VACÍO)
  ========================================================== */

  if (!cacheProductos.length) {
    console.warn("⚠ Cache vacío → recuperando respaldo Dexie...");

    const respaldo = await db.productos
      .where("negocio_id")
      .equals(negocioId)
      .toArray();

    if (respaldo.length) {
      cacheProductos = respaldo;
      indexarProductos(cacheProductos);
      resultadosBusqueda = cacheProductos.slice(0, 12);
      console.log("♻ Cache restaurado desde Dexie:", cacheProductos.length);
    }
  }

  window.cacheProductosGlobal = cacheProductos;
  console.log("🧠 Cache global lista:", cacheProductos.length);
  /* ==========================================================
     🔥 SIEMPRE LLENAR RESULTADOS
  ========================================================== */

  resultadosBusqueda = cacheProductos.slice(0, 12);

  /* ==========================================================
     🚀 INICIAR MÓDULO
  ========================================================== */

configurarProductos();
productosListos = true;
 /* =========================================
   🚀 SCANNER HÍBRIDO REAL (TC22 + USB)
========================================= */

let scanBuffer = "";
let scanTimer = null;

const SCAN_MIN_LENGTH = 4;
const SCAN_END_DELAY = 300; // 🔥 más tolerante para Bluetooth

const inputSku = document.getElementById("sku");

document.addEventListener("keydown", async (e) => {

  const target = e.target;
 const tag = target?.tagName?.toLowerCase();


if (tag === "textarea") return;

  const key = e.key;

  // ignorar teclas especiales
  if (
    key === "Shift" ||
    key === "Control" ||
    key === "Alt" ||
    key === "Meta"
  ) return;

  // ==============================
  // 📦 CAPTURA SIEMPRE
  // ==============================
  if (key.length === 1 && document.activeElement !== inputSku) {

    scanBuffer += key;

    clearTimeout(scanTimer);

    scanTimer = setTimeout(async () => {

      if (scanBuffer.length >= SCAN_MIN_LENGTH) {

        const codigo = scanBuffer.trim();

        scanBuffer = "";

        await procesarScanner(codigo);

      } else {
        scanBuffer = "";
      }

    }, SCAN_END_DELAY);

    return;
  }

  // ==============================
  // ⏎ ENTER (PRIORIDAD)
  // ==============================
  if (key === "Enter") {

    if (scanBuffer.length >= SCAN_MIN_LENGTH) {

      e.preventDefault();

      const codigo = scanBuffer.trim();

      scanBuffer = "";

      await procesarScanner(codigo);
      return;
    }

    scanBuffer = "";
  }

});

});

/* -------------------------------------------------------------------------- */
/* 🧠 DEBOUNCE UNIVERSAL (para evitar lag al filtrar tabla)                  */
/* -------------------------------------------------------------------------- */
function debounce(fn, delay = 120) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* -------------------------------------------------------------------------- */
/* 🔒 NUMEROS SEGUROS (convierte "", null, undefined, "----" en 0)           */
/* -------------------------------------------------------------------------- */
function safeNumber(v, fallback = 0) {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

/* -------------------------------------------------------------------------- */
/* 🧩 CONFIGURAR PRODUCTOS (Eventos + Acciones Iniciales)                    */
/* -------------------------------------------------------------------------- */
export function configurarProductos() {

  const inputSku = document.getElementById("sku");

  if (!inputSku) {
    console.warn("⚠ inputSku no listo, reintentando...");
    setTimeout(configurarProductos, 100);
    return;
  }

  const formBuscar = document.getElementById("formBuscar");
  const inputCantidad = document.getElementById("cantidad");
  const autocompleteBox = document.getElementById("autocompleteProductos");

  if (autocompleteBox) {
    autocompleteBox.classList.add("hidden");
  }

  if (!formBuscar || !inputSku || !inputCantidad) {
    console.warn("⚠️ No se encontró el formulario de productos");
    return;
  }

  inputSku.addEventListener("focus", () => {
    bufferScanner = "";
    clearTimeout(timeoutScanner);
  });

  /* ==========================================================
     MODO ESCÁNER AUTOMÁTICO
  ========================================================== */

function renderAutocomplete(lista){

  if(!lista.length){
    autocompleteBox.classList.add("hidden");
    return;
  }

  indiceSeleccionado = -1;
  productoSeleccionado = null;

  autocompleteBox.innerHTML = lista.map((p,i)=>`

    <div class="autocomplete-item"
         data-index="${i}">

      <div class="autocomplete-info">
        <div class="autocomplete-nombre">${p.nombre}</div>
      </div>

      <div class="autocomplete-precio">$${p.precio_base}</div>

    </div>

  `).join("");

  autocompleteBox.classList.remove("hidden");
 
}


/* BUSCAR SOLO MANUAL */

inputSku.addEventListener("input", debounceSmartPOS(async (e) => {

  if (!productosListos) return;

  productoSeleccionado = null;

  // 🔥 SI HAY ACTIVIDAD DE SCANNER → IGNORAR INPUT
  if (bufferScanner.length > 0) return;

  const texto = e.target.value.trim();

  if (!texto) {
  indiceSeleccionado = -1;
  autocompleteBox.classList.add("hidden");
  autocompleteBox.innerHTML = "";
  return;
}
productoSeleccionado = null;
  
 
if (/^\d{8,}$/.test(texto)) {

  const producto = await buscarProductoTotal(texto);

  if (producto) {

  limpiarAutocomplete();

  // 🔥 SI ES KG → SOLO LLENAR INPUT, NO AGREGAR
  if (esProductoKg(producto)) {
    inputSku.value = producto.codigo_barras || producto.sku;
    return;
  }

  // 🔥 SI ES PIEZA → AGREGAR DIRECTO
  inputSku.value = "";
  await agregarProductoDesdeBusqueda(producto);
  return;
}

  autocompleteBox.classList.add("hidden");
  autocompleteBox.innerHTML = "";
 
  indiceSeleccionado = -1;
  return;
}


  if (texto.length >= 2) {
    resultadosBusqueda = await buscarProductosAutocomplete(texto);
    renderAutocomplete(resultadosBusqueda);
  } else {
    autocompleteBox.classList.add("hidden");
    autocompleteBox.innerHTML = "";
   
    indiceSeleccionado = -1;
  }

}, 120));
 


  /* ==========================================================
     SUBMIT → AGREGAR PRODUCTO
  ========================================================== */

formBuscar.addEventListener("submit", async (e) => {

  e.preventDefault();

  if (bloqueoSubmit) return;

  bloqueoSubmit = true;

  setTimeout(() => {
    bloqueoSubmit = false;
  }, 250);

  const sku = inputSku.value.trim();

  if (!sku) return;

  const producto = await buscarProductoTotal(sku);

  if (!producto) {
    return Swal.fire("Error", "Producto no encontrado", "error");
  }

  const precio = safeNumber(producto.precio_base);

  // 🔥 =========================
  // ⚖️ MANEJO CORRECTO DE KG
  // =========================
  let cantidad = 1;

  if (esProductoKg(producto)) {

    const pesoManual = safeNumber(
      document.getElementById("pesoManual")?.value,
      0
    );

    const pesoAuto = safeNumber(
      window.smartPOS?.bascula?.peso,
      0
    );

    const basculaActiva = window.smartPOS?.bascula?.activa === true;

    if (basculaActiva) {

      if (pesoAuto > 0) {
        cantidad = pesoAuto;
      } 
      else if (pesoManual > 0) {
        cantidad = pesoManual;
      } 
      else {
        cantidad = 1; // default
      }

    } else {

      cantidad = pesoManual > 0 ? pesoManual : 1;

    }

  } else {
    // 🔥 PIEZA NORMAL
    cantidad = safeNumber(inputCantidad.value, 1);
  }

  // 🔥 =========================
  // 🛒 CARRITO
  // =========================
  const existente = window.carrito.find(
    (i) =>
      i.id === producto.id ||
      i.sku === producto.sku ||
      i.codigo_barras === producto.codigo_barras
  );

  if (existente) {

  // 🔥 FORZAR UNIDAD CORRECTA
  const unidadRaw = (producto.unidad || "").toLowerCase().trim();

  existente.unidad =
    unidadRaw.includes("kg") || unidadRaw.includes("kilo")
      ? "kg"
      : "pieza";

  existente.cantidad = +(existente.cantidad + cantidad).toFixed(3);
  existente.subtotal = +(existente.cantidad * precio).toFixed(2);

}
 else {

    // 🔥 NORMALIZAR UNIDAD
const unidadRaw = (producto.unidad || "").toLowerCase().trim();

const unidad =
  unidadRaw.includes("kg") || unidadRaw.includes("kilo")
    ? "kg"
    : "pieza";

carrito.push({
  id: producto.id || producto.uuid_supabase,
  sku: producto.sku,
  codigo_barras: producto.codigo_barras,
  nombre: producto.nombre,

  precio,
  costo: (() => {
    const c =
      producto.costo ??
      producto.costo_unitario ??
      producto.costo_base ??
      producto.precio_compra ??
      null;

    console.log("🔥 DEBUG LISTA COSTO:", producto.nombre, c, producto);

    return c !== null ? Number(c) : null;
  })(),

  cantidad,
  subtotal: +(cantidad * precio).toFixed(2),
  unidad,

  existencias:
    producto.existencias_total !== undefined
      ? Number(producto.existencias_total)
      : producto.existencias !== undefined
      ? Number(producto.existencias)
      : null,

  stock_minimo: producto.stock_minimo ?? 0,
});

  }

  renderCarrito();

  limpiarAutocomplete();

  inputSku.value = "";
  inputCantidad.value = 1;

  // 🔥 LIMPIAR PESO DESPUÉS
  if (esProductoKg(producto)) {
    if (window.smartPOS?.bascula) {
      window.smartPOS.bascula.peso = 0;
    }

    const pesoInput = document.getElementById("pesoManual");
    if (pesoInput) pesoInput.value = "0.000";
  }

  inputSku.focus();

});

  /* ==========================================================
     AUTOCOMPLETE TECLADO
  ========================================================== */

 inputSku.addEventListener("keydown", (e) => {

  if (autocompleteBox.classList.contains("hidden")) return;
  if (!resultadosBusqueda.length) return;

  // 🔒 Evitar doble salto
  if (bloqueoNavegacion) return;

  const items = autocompleteBox.querySelectorAll(".autocomplete-item");

  if (e.key === "ArrowDown") {

    e.preventDefault();

    bloqueoNavegacion = true;
    setTimeout(()=> bloqueoNavegacion = false, 80);

    indiceSeleccionado++;

    if (indiceSeleccionado >= resultadosBusqueda.length) {
      indiceSeleccionado = 0;
    }
productoSeleccionado = resultadosBusqueda[indiceSeleccionado];
  }

 else if (e.key === "ArrowUp") {

  e.preventDefault();

  bloqueoNavegacion = true;
  setTimeout(()=> bloqueoNavegacion = false, 80);

  indiceSeleccionado--;

  if (indiceSeleccionado < 0) {
    indiceSeleccionado = resultadosBusqueda.length - 1;
  }

  productoSeleccionado = resultadosBusqueda[indiceSeleccionado]; 
}

  else if (e.key === "Enter" || e.key === "Tab") {

  e.preventDefault();

  // 🔥 SOLO SI REALMENTE SELECCIONÓ ALGO
  if (!productoSeleccionado) return;

  autocompleteBox.classList.add("hidden");

  agregarProductoDesdeBusqueda(productoSeleccionado);
  return;
}

  else if (e.key === "Escape") {

    autocompleteBox.classList.add("hidden");
    indiceSeleccionado = -1;
    return;

  } else {
    return;
  }

  items.forEach((el, i) => {
    el.classList.toggle("active", i === indiceSeleccionado);
  });

  const active = autocompleteBox.querySelector(".autocomplete-item.active");

  if (active) {
    active.scrollIntoView({
      block: "nearest"
    });
  }

});


  /* ==========================================================
     CLICK AUTOCOMPLETE
  ========================================================== */

  autocompleteBox.addEventListener("click",(e)=>{

    const row = e.target.closest("[data-index]");
    if(!row) return;

    const prod = resultadosBusqueda[Number(row.dataset.index)];

    autocompleteBox.classList.add("hidden");
    productoSeleccionado = prod;
    agregarProductoDesdeBusqueda(prod);

  });

/* ==========================================================
   CERRAR AUTOCOMPLETE AL HACER CLICK FUERA
========================================================== */

document.addEventListener("click",(e)=>{

  if(!autocompleteBox) return;

  if(
    !autocompleteBox.contains(e.target) &&
    e.target !== inputSku
  ){
    autocompleteBox.classList.add("hidden");
    indiceSeleccionado = -1;
  }

});

  /* ==========================================================
     BOTÓN BUSCAR GLOBAL
  ========================================================== */

  const btnBuscarForm = document.getElementById("btnBuscarProducto");

  if (btnBuscarForm) {
    btnBuscarForm.addEventListener("click", buscarGlobal);
  }

}

/* ========================================================================== */
/* 🔍 BÚSQUEDA GLOBAL (SKU directo o tabla completa)                          */
/* ========================================================================== */
export async function buscarGlobal() {
  const sku = (document.getElementById("sku")?.value || "").trim();

  /* ---------------------------------------------------------------------- */
  /* 1️⃣ SI SE INGRESÓ UN SKU → MOSTRAR DETALLE DEL PRODUCTO                */
  /* ---------------------------------------------------------------------- */
  if (sku) {
    const producto = await buscarProductoTotal(sku);

    if (!producto) {
      return Swal.fire({
        icon: "error",
        title: "❌ Producto no encontrado",
        text: "Verifica el código ingresado",
        confirmButtonText: "Aceptar",
        background: "#fff",
      });
    }

    return mostrarSwalProducto(producto);
  }

  /* ---------------------------------------------------------------------- */
  /* 2️⃣ SIN SKU → CARGAR TABLA COMPLETA DE PRODUCTOS                      */
  /* ---------------------------------------------------------------------- */
  Swal.fire({
    title: "Cargando productos...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  let productos = [];

  if (navigator.onLine) {
  const { data } = await supabaseClient
    .from("v_productos_existencias")
    .select(`
      id,
      negocio_id,
      nombre,
      descripcion,
      sku,
      codigo_barras,
      precio_base,
      costo,
      existencias_total,
      stock_minimo
    `)
    .eq("negocio_id", negocioId)
    .order("descripcion", { ascending: true });


    productos = data || [];
    cachearProductos(productos); // Guarda en localStorage
  } else {
    productos = await obtenerProductosOffline(); // Usa cache
  }

  Swal.close();

  if (!productos.length) {
    return Swal.fire("Sin datos", "No hay productos disponibles", "info");
  }

    Swal.fire({
      title: "Selecciona un producto",
      width: "90vw",
      padding: "24px",
      html: generarTablaProductos(productos),
      showConfirmButton: false,

      customClass: {
        popup: "swal-productos-popup"
      },

      didOpen: () => {

        inicializarTablaProductos(productos);
        lucide.createIcons();

        document
          .querySelectorAll("#tablaProdBody tr[data-tooltip]")
          .forEach(tr => {
            const t = tr.dataset.tooltip;
            tr.classList.add("has-tooltip");
            tr.innerHTML += `<div class="tooltip">${t}</div>`;
          });

      }
    });

}
/* ========================================================================== */
/* 🔍 BÚSQUEDA TOTAL (ONLINE + OFFLINE)                                       */
/* ========================================================================== */
export async function buscarProductoTotal(sku) {
 
sku = normalizarCodigo(sku); 

let producto =
  indexSku.get(sku) ||
  indexCodigo.get(sku);

if (producto) {
  producto.existencias_total =
    producto.existencias_total !== undefined && producto.existencias_total !== null
      ? Number(producto.existencias_total)
      : producto.existencias !== undefined && producto.existencias !== null
      ? Number(producto.existencias)
      : null;

  return producto;
}


  // --- ONLINE ---
  if (navigator.onLine) {
   
  const { data } = await supabaseClient
  .from("v_productos_existencias")
      .select(`
      id,
      negocio_id,
      nombre,
      descripcion,
      precio_base,
      costo,
      unidad,
      existencias_total,
      stock_minimo,
      sku,
      codigo_barras,
      imagen_url
    `)
  .eq("negocio_id", negocioId)
  .or(`sku.eq.${sku},codigo_barras.eq.${sku}`)
  .limit(1)
  .maybeSingle();



    if (data) producto = data;
  }

  // --- OFFLINE ---
    if (!producto) {
      producto = await db.productos
        .where("[negocio_id+sku]")
        .equals([negocioId, sku])
        .or("[negocio_id+codigo_barras]")
        .equals([negocioId, sku])
        .first();
    }

    if (!producto && sku.length >= 6) {
      console.warn("❌ SKU no encontrado:", sku, "Negocio:", negocioId);
    }

    if (producto) {
  // 🔥 auto indexado en caliente
  if (producto.sku) indexSku.set(producto.sku, producto);
  if (producto.codigo_barras) indexCodigo.set(producto.codigo_barras, producto);
}


if (producto) {
  producto.existencias_total =
    producto.existencias_total !== undefined && producto.existencias_total !== null
      ? Number(producto.existencias_total)
      : producto.existencias !== undefined && producto.existencias !== null
      ? Number(producto.existencias)
      : null;
}

return producto;

}
/* ========================================================================== */
/* 🧮 RENDER TABLA DE PRODUCTOS                                               */
/* ========================================================================== */
function generarTablaProductos(lista) {
  return `
    <div class="tabla-scroll" style="
      max-height: 65vh;
      overflow-y: auto;
      width: 100%;
    ">

      <input id="filtroBuscarProd" 
        class="w-full p-2 mb-3 border rounded" 
        placeholder="Buscar...">

      <table class="w-full text-sm">
        <thead class="bg-gray-100">
          <tr>
            <th>Código</th>
            <th>Producto</th>
            <th>Precio</th>
            <th>Existencias</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="tablaProdBody">
          ${lista
            .map(
              (p) => `
            <tr class="border-t hover:bg-gray-50"
                data-tooltip="${p.descripcion || p.nombre}">
                
              <td>${p.codigo_barras || p.sku}</td>
              <td>${p.nombre || p.descripcion}</td>
              <td>$${p.precio_base}</td>
              <td>${p.existencias_total ?? 0}</td>

              <td class="text-center flex gap-2 justify-center">

                <button class="btnSeleccionar bg-fuchsia-600 text-white px-2 py-1 rounded"
                  data-sku="${p.codigo_barras || p.sku}">
                  +
                </button>

                <button class="btnInfo bg-purple-600 text-white px-2 py-1 rounded"
                  data-sku="${p.codigo_barras || p.sku}">
                  <i data-lucide="eye" class="w-4 h-4"></i>
                </button>

              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ========================================================================== */
/* 🧠 INICIALIZAR TABLA (filtro + botones dentro del Swal)                    */
/* ========================================================================== */
function inicializarTablaProductos(lista) {
  const input = document.getElementById("filtroBuscarProd");
  const body = document.getElementById("tablaProdBody");

  /* ---------------------------------------------------------------------- */
  /* 🔎 FILTRO DE BUSQUEDA (DEBOUNCE)                                      */
  /* ---------------------------------------------------------------------- */
      input.addEventListener(
        "input",
        debounceSmartPOS((e) => {
      const q = e.target.value.toLowerCase();

      const filtrados = lista.filter(
        (p) =>
          (p.nombre && p.nombre.toLowerCase().includes(q)) ||
          (p.descripcion && p.descripcion.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      );

      body.innerHTML = filtrados
  .map(
    (p) => `
  <tr class="border-t hover:bg-gray-50"
      data-tooltip="${p.descripcion || p.nombre}">
      
    <td>${p.codigo_barras || p.sku}</td>
    <td>${p.nombre || p.descripcion}</td>
    <td>$${p.precio_base}</td>
    <td>${p.existencias_total ?? 0}</td>

    <td class="text-center flex gap-2 justify-center">
      <button class="btnSeleccionar bg-fuchsia-600 text-white px-2 py-1 rounded"
        data-sku="${p.codigo_barras || p.sku}">+</button>

      <button class="btnInfo bg-purple-600 text-white px-2 py-1 rounded"
        data-sku="${p.codigo_barras || p.sku}">
        <i data-lucide="eye" class="w-4 h-4"></i>
      </button>
    </td>
  </tr>`
  )
  .join("");

      lucide.createIcons();
    }, 120)
  );

  /* ---------------------------------------------------------------------- */
  /* 🟣 CLICK EN LA TABLA (AGREGAR O VER INFO)                              */
  /* ---------------------------------------------------------------------- */
  body.addEventListener("click", async (e) => {

    /* ==================================================================== */
    /* ➕ BOTÓN AGREGAR DESDE LA TABLA                                      */
    /* ==================================================================== */
    const btnAdd = e.target.closest(".btnSeleccionar");
    if (btnAdd) {
      const sku = btnAdd.dataset.sku;
      const producto = await buscarProductoTotal(sku);

      if (!producto) {
        return Swal.fire("Error", "Producto no encontrado", "error");
      }

      /* ------------------------------ */
      /* 🔥 VALIDACIÓN DE STOCK         */
      /* ------------------------------ */
      const existenciasActuales =
      producto.existencias_total ??
      producto.existencias ??
      0;

      if (existenciasActuales <= (producto.stock_minimo ?? 0)) {
        const esSinStock = existenciasActuales === 0;
        const r = await Swal.fire({
          icon: esSinStock ? "error" : "warning",
          title: esSinStock ? "❌ SIN STOCK" : "⚠️ STOCK BAJO",
          html: `
            <b>${producto.nombre}</b><br>
            Existencias: <b>${existenciasActuales}</b><br>
            Stock mínimo: <b>${producto.stock_minimo}</b><br><br>
            ¿Deseas continuar y generar pedido?
          `,
          showCancelButton: true,
          confirmButtonText: "Sí, continuar",
          cancelButtonText: "Cancelar",
          background: "#fff",
        });

        if (!r.isConfirmed) return;

        try {
         await supabaseClient.rpc("agregar_pedido_unico", {
            p_producto_id: producto.id,
            p_cantidad: 1
          });

        } catch {}
      }

/* ------------------------------ */
/* ⚖️ VALIDACIÓN DE PESO KG        */
/* ------------------------------ */
      let cantidad = 1;

      if (esProductoKg(producto)) {

          let pesoFinal = 0;

          const pesoManual = safeNumber(
              document.getElementById("pesoManual")?.value,
              0
          );

          const pesoAuto = safeNumber(
              window.smartPOS?.bascula?.peso,
              0
          );

          const basculaActiva = window.smartPOS?.bascula?.activa === true;

          if (basculaActiva) {

              if (pesoAuto > 0) {
                  pesoFinal = pesoAuto;
              } 
              else if (pesoManual > 0) {
                  pesoFinal = pesoManual;
              } 
              else {
                  // 🔥 Báscula activa pero sin lectura → default 1kg
                  pesoFinal = 1;
              }

          } else {

              // 🔥 Báscula apagada → default automático 1kg
              pesoFinal = pesoManual > 0 ? pesoManual : 1;

          }

          cantidad = pesoFinal;
      }
      /* ------------------------------ */
      /* 🟪 PRODUCTO PIEZA               */
      /* ------------------------------ */
      else {
          cantidad = 1;
      }

      /* ------------------------------ */
      /* ➕ AGREGAR AL CARRITO           */
      /* ------------------------------ */

      // 🚨 BLOQUEO DEFINITIVO DE PRODUCTOS SIN COSTO
const costoValido =
  producto.costo ??
  producto.costo_unitario ??
  producto.costo_base ??
  producto.precio_compra ??
  null;

if (costoValido === null || Number(costoValido) <= 0) {
  return Swal.fire({
    icon: "error",
    title: "Producto sin costo",
    html: `
      <b>${producto.nombre}</b><br><br>
      Este producto no tiene costo registrado.<br>
      Corrígelo antes de vender.
    `,
    confirmButtonText: "OK"
  });
}

const precio = parseFloat(producto.precio_base);

// 🔥 NORMALIZAR UNIDAD
const unidadRaw = (producto.unidad || "").toLowerCase().trim();

const unidad =
  unidadRaw.includes("kg") || unidadRaw.includes("kilo")
    ? "kg"
    : "pieza";

const existe = window.carrito.find(
  (i) =>
    i.id === producto.id ||
    i.sku === producto.sku ||
    i.codigo_barras === producto.codigo_barras
);

if (existe) {
  if (existe.costo === undefined || existe.costo === null) {
    const c =
      producto.costo ??
      producto.costo_unitario ??
      producto.costo_base ??
      producto.precio_compra ??
      null;

    existe.costo = c !== null ? Number(c) : null;
    console.log("🔥 DEBUG EXISTE COSTO:", producto.nombre, existe.costo, producto);
  }

  existe.cantidad = +(existe.cantidad + cantidad).toFixed(3);
  existe.subtotal = +(existe.cantidad * precio).toFixed(2);
} else {
  carrito.push({
  id: producto.id || producto.uuid_supabase,
  sku: producto.sku,
  codigo_barras: producto.codigo_barras,
  nombre: producto.nombre,

  precio,
  costo: (() => {
  const c =
    producto.costo ??
    producto.costo_unitario ??
    producto.costo_base ??
    producto.precio_compra ??
    null;

  return c !== null ? Number(c) : null;
})(),

  cantidad,
  subtotal: +(cantidad * precio).toFixed(2),
  unidad,

  existencias:
    producto.existencias_total !== undefined
      ? Number(producto.existencias_total)
      : producto.existencias !== undefined
      ? Number(producto.existencias)
    : null,

  stock_minimo: producto.stock_minimo ?? 0,
});
}

renderCarrito();

// 🧹 LIMPIAR PESO DESPUÉS DE AGREGAR PRODUCTO KG
if (unidad === "kg") { // 🔥 TAMBIÉN CAMBIA ESTO
  if (window.smartPOS?.bascula) {
    window.smartPOS.bascula.peso = 0;
  }

  const pesoInput = document.getElementById("pesoManual");
  if (pesoInput) pesoInput.value = "0.000";
}

      // ⭐ Efecto visual
      btnAdd.classList.add("scale-125", "bg-green-600");
      btnAdd.textContent = "✓";

      setTimeout(() => {
        btnAdd.classList.remove("scale-125", "bg-green-600");
        btnAdd.textContent = "+";
      }, 450);

      return;
    }

    /* ==================================================================== */
    /* 👁️ VER INFORMACIÓN DEL PRODUCTO (BOTÓN "eye")                        */
    /* ==================================================================== */
    const btnInfo = e.target.closest(".btnInfo");
    if (btnInfo) {
      const sku = btnInfo.dataset.sku;
      const producto = await buscarProductoTotal(sku);

      if (producto) {
        mostrarSwalProducto(producto);
      }
    }
  });
}

/* ========================================================================== */
/* 💾 CACHE PRODUCTOS (24 horas)                                              */
/* ========================================================================== */

const CACHE_EXPIRA_MS = 24 * 60 * 60 * 1000; // 24h

async function cachearProductos(data) {

  const payload = {
    fecha: Date.now(),
    negocio_id: negocioId,
    data
  };

  localStorage.setItem(
    `cache_productos_${negocioId}`,
    JSON.stringify(payload)
  );
}

async function obtenerProductosOffline(){

  const raw = localStorage.getItem(`cache_productos_${negocioId}`);

  if(!raw) return [];

  try{

    const cache = JSON.parse(raw);

    if(!cache.fecha || Date.now() - cache.fecha > CACHE_EXPIRA_MS){
      return [];
    }

    return (cache.data || []).filter(p => p.negocio_id === negocioId); 

  }catch{
    return [];
  }

}

/* ========================================================================== */
/* 🔎 BUSCAR DESDE EL HEADER                                                  */
/* ========================================================================== */

export function buscarProductoPorSkuHeader() {
  buscarGlobal(); // reusa el buscador principal
}

/* ========================================================================== */
/* 🟣 SWAL — INFORMACIÓN DEL PRODUCTO                                         */
/* ========================================================================== */

async function mostrarSwalProducto(producto) {
  const imagen = producto.imagen_url || "/img/sin_imagen.png";

  const query = encodeURIComponent(
      `${producto.nombre || ""} ${producto.descripcion || ""}`.trim()
    );

  return Swal.fire({
    title: `
      <div class="flex items-center justify-center gap-2">
        <i data-lucide="package" class="w-6 h-6 text-fuchsia-600"></i>
        <span class="text-fuchsia-600 font-extrabold text-xl">
          ${producto.nombre}
        </span>
      </div>
    `,
    html: `
      <div class="card-3d p-4 bg-white">
        <img src="${imagen}"
             class="w-32 h-32 object-cover rounded-lg mx-auto mb-4 shadow">

        <p><b>Código:</b> ${producto.sku || producto.codigo_barras}</p>
        <p><b>Precio:</b> $${producto.precio_base}</p>
        <p><b>Existencias:</b> ${
          producto.existencias_total ?? producto.existencias ?? 0
        }</p>

        <div class="mt-6 flex flex-col gap-3">

          <!-- 🔍 Google Directo -->
          <button id="btnBuscarGoogleDirecto"
            class="w-full bg-fuchsia-600 hover:bg-fuchsia-700 
                   text-white font-bold py-2 rounded flex items-center 
                   justify-center gap-2">
            <i data-lucide="search"></i> Buscar en Google Directo
          </button>

          <!-- 🛒 Comparar tiendas -->
          <button id="btnCompararTiendas"
            class="w-full bg-purple-600 hover:bg-purple-700 
                   text-white font-bold py-2 rounded flex items-center
                   justify-center gap-2">
            <i data-lucide="shopping-cart"></i> Comparar en tiendas
          </button>

        </div>
      </div>
    `,
    confirmButtonText: "Cerrar",
    background: "#fafafa",
    customClass: { popup: "card-3d" },

    didOpen: () => {
      lucide.createIcons();

      document.getElementById("btnBuscarGoogleDirecto").onclick = () =>
        window.open(`https://www.google.com/search?tbm=shop&q=${query}`, "_blank");

      document.getElementById("btnCompararTiendas").onclick = () =>
        window.location.href = `/google.html?q=${query}`;
    }
  });
}

async function buscarProductosAutocomplete(texto){

  if (!cacheProductos.length && !window.cacheProductosGlobal?.length) {
    console.warn("⏳ Esperando carga de productos...");
    return [];
  }

  const q = texto.toLowerCase().trim()

  if(q.length < 1) return []

  /* usar memoria primero */
 let productos = [];

// 🔥 1. PRIORIDAD: cache en memoria
// 🔥 SIEMPRE tomar el mejor dataset disponible
const localCache = cacheProductos || [];
const globalCache = window.cacheProductosGlobal || [];

if (localCache.length >= globalCache.length && localCache.length) {
  productos = localCache;
}
else if (globalCache.length) {
  productos = globalCache;
}
else {
  productos = await db.productos
    .where("negocio_id")
    .equals(negocioId)
    .toArray();
}

  if(!productos.length){
    productos = await obtenerProductosOffline()
  }

  if (!productos.length) {
  console.warn("⚠ Autocomplete sin datos → fallback forzado Dexie");

  productos = await db.productos
    .where("negocio_id")
    .equals(negocioId)
    .toArray();
}

  productos = productos.filter(p => p.negocio_id === negocioId)

  const palabras = q.split(" ").filter(Boolean)

  const resultados = productos
    .map(p => {

      const nombre = (p.nombre || "").toLowerCase()
      const sku = (p.sku || "").toLowerCase()
      const codigo = (p.codigo_barras || "").toLowerCase()

      let prioridad = 99

      /* SKU o código exacto */
      if(sku === q || codigo === q){
        prioridad = 0
      }

      /* nombre empieza con */
      else if(nombre.startsWith(q)){
        prioridad = 1
      }

      /* nombre contiene todas las palabras */
      else if(palabras.every(w => nombre.includes(w))){
        prioridad = 2
      }

      else{
        return null
      }

      return {
        ...p,
        __prioridad: prioridad,
        __nombre: nombre
      }

    })
    .filter(Boolean)

  /* ordenar */
  resultados.sort((a,b)=>{

    if(a.__prioridad !== b.__prioridad){
      return a.__prioridad - b.__prioridad
    }

    return a.__nombre.localeCompare(b.__nombre)

  })

  return resultados.slice(0,12)

}


function indexarProductos(lista = []) {

  indexSku.clear();
  indexCodigo.clear();
  indexNombre.clear();

  for (const p of lista) {

    if (p.sku) {
      indexSku.set(p.sku, p);
    }

    if (p.codigo_barras) {
      indexCodigo.set(p.codigo_barras, p);
    }

    if (p.nombre) {
      const nombre = p.nombre.toLowerCase();
      indexNombre.set(nombre, p);
    }

  }

  console.log("⚡ Productos indexados:", lista.length);
}