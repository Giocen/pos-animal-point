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

let cacheProductos = [];

/* =========================================
   SCANNER GLOBAL SEPARADO DEL INPUT VISUAL
========================================= */
let bufferScanner = "";
let timeoutScanner = null;
let ultimoScannerAt = 0;
let ultimoCodigo = "";
let ultimoTiempo = 0;

function normalizarCodigo(c) {
  return (c || "").toString().trim();
}


function limpiarAutocomplete(){

  const autocompleteBox = document.getElementById("autocompleteProductos");

  if(!autocompleteBox) return;

  autocompleteBox.classList.add("hidden");
  autocompleteBox.innerHTML = "";
  resultadosBusqueda = [];
  indiceSeleccionado = -1;
}

async function agregarProductoDesdeBusqueda(prod){

  limpiarAutocomplete();

  if (bloqueoAgregar) return;
  bloqueoAgregar = true;

  setTimeout(() => bloqueoAgregar = false, 120);

  const inputSku = document.getElementById("sku");
  const form = document.getElementById("formBuscar");

  if (!inputSku || !form) return;

  inputSku.value = prod.codigo_barras || prod.sku;
  form.dispatchEvent(new Event("submit", { cancelable: true }));
}

/* =========================================
   PROCESAR SCANNER GLOBAL
========================================= */
async function procesarScanner(codigo) {
  if (!codigo) return;

  const ahora = Date.now();

  // 🔥 evita doble scan
  if (codigo === ultimoCodigo && (ahora - ultimoTiempo) < 400) {
    return;
  }

  ultimoCodigo = codigo;
  ultimoTiempo = ahora;

  limpiarAutocomplete();

  const inputSku = document.getElementById("sku");
  if (inputSku) {
    inputSku.value = codigo;
  }

  const producto = await buscarProductoTotal(codigo);

  if (producto) {
  await agregarProductoDesdeBusqueda(producto);
} else {
  if (inputSku) inputSku.value = "";
}

// 🔥 LIMPIEZA TOTAL
bufferScanner = "";
clearTimeout(timeoutScanner);
}

const negocioId = localStorage.getItem("negocio_id");
/* ==========================================================
   🔧 Debounce
========================================================== */
function debounceSmartPOS(fn, delay = 150) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}
/* -------------------------------------------------------------------------- */
/* 🚀 INICIALIZACIÓN                                                          */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {

  await protegerSesion(["admin", "cajero"]);

  

  if (!negocioId) {
    console.warn("⚠ negocio_id no disponible aún");
    return;
  }

  /* asegurar Dexie */
  if (!db) {
    await inicializarDB();
  }

  // precargar productos desde Dexie
  const productos = await db.productos
    .where("negocio_id")
    .equals(negocioId)
    .toArray();

  if (productos.length) {

  cacheProductos = productos.filter(p => p.negocio_id === negocioId); 
  indexarProductos(cacheProductos);

  cachearProductos(cacheProductos);

  resultadosBusqueda = cacheProductos.slice(0, 12);

  } else {

    /* 🔥 si Dexie está vacío cargar desde Supabase */

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
        existencias_total,
        stock_minimo
      `)
      .eq("negocio_id", negocioId);

    if (data?.length) {

  cacheProductos = data.filter(p => p.negocio_id === negocioId);

  indexarProductos(cacheProductos); // 🔥 FALTABA ESTO

  cachearProductos(cacheProductos);

  resultadosBusqueda = cacheProductos.slice(0, 12);

}

  }

  configurarProductos();

  /* =========================================
     LISTENER GLOBAL DEL SCANNER
  ========================================= */
  document.addEventListener("keydown", async (e) => {

    const target = e.target;
    const tag = target?.tagName?.toLowerCase();

    // Si está escribiendo en textarea o en otro input que NO sea sku, no interceptar
    if (tag === "textarea") return;

    // 🔥 CLAVE: evitar que el scanner escriba en inputs
    if (tag === "input") {
      // Si viene muy rápido (scanner), lo bloqueamos
      if (bufferScanner.length >= 2) {
        e.preventDefault();
      }
}

    // Enter = cerrar lectura del scanner
    if (e.key === "Enter") {

  // 🔥 SCANNER
  if (bufferScanner.length >= 8) {
    e.preventDefault();

    const codigo = bufferScanner;
    bufferScanner = "";
    clearTimeout(timeoutScanner);

    await procesarScanner(codigo);
    return;
  }

  // 🔥 MANUAL (usuario)
  if (e.target?.id === "sku") {
    return; // deja que el submit normal haga su trabajo
  }
}

    // Solo dígitos para scanner
    if (/^[0-9]$/.test(e.key)) {
      const ahora = Date.now();
      const delta = ahora - ultimoScannerAt;
      ultimoScannerAt = ahora;

      // Si pasó mucho tiempo, reiniciar buffer
      if (delta > 80) {
        bufferScanner = "";
      }

      bufferScanner += e.key;

      clearTimeout(timeoutScanner);
      timeoutScanner = setTimeout(() => {
        bufferScanner = "";
      }, 120);

      return;
    }

    // Cualquier otra tecla corta el buffer
    bufferScanner = "";
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

  const formBuscar = document.getElementById("formBuscar");
  const inputSku = document.getElementById("sku");
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

  indiceSeleccionado = 0;

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
  // 🔥 seleccionar automáticamente el primer resultado
setTimeout(()=>{

  const first = autocompleteBox.querySelector(".autocomplete-item");

  if(first){
    first.classList.add("active");
  }

});

}


/* BUSCAR SOLO MANUAL */

inputSku.addEventListener("input", debounceSmartPOS(async (e) => {

  // 🔥 SI HAY ACTIVIDAD DE SCANNER → IGNORAR INPUT
  if (bufferScanner.length > 0) return;

  const texto = e.target.value.trim();

  if (!texto) {
    indiceSeleccionado = -1;
    autocompleteBox.classList.add("hidden");
    autocompleteBox.innerHTML = "";
    resultadosBusqueda = [];
    return;
  }

  // Si parece código numérico largo, no mostrar autocomplete.
  // El scanner real ya se procesa globalmente por keydown.
  if (/^\d{8,}$/.test(texto)) {
    autocompleteBox.classList.add("hidden");
    autocompleteBox.innerHTML = "";
    resultadosBusqueda = [];
    indiceSeleccionado = -1;
    return;
  }

  if (texto.length >= 2) {
    resultadosBusqueda = await buscarProductosAutocomplete(texto);
    renderAutocomplete(resultadosBusqueda);
  } else {
    autocompleteBox.classList.add("hidden");
    autocompleteBox.innerHTML = "";
    resultadosBusqueda = [];
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
    let cantidad = safeNumber(inputCantidad.value, 1);

    if (!sku) return;

    const producto = await buscarProductoTotal(sku);

    if (!producto) {
      return Swal.fire("Error", "Producto no encontrado", "error");
    }

    const precio = safeNumber(producto.precio_base);

    const existente = window.carrito.find(
      (i) =>
        i.id === producto.id ||
        i.sku === producto.sku ||
        i.codigo_barras === producto.codigo_barras
    );

    if (existente) {

      existente.cantidad = +(existente.cantidad + cantidad).toFixed(3);
      existente.subtotal = +(existente.cantidad * precio).toFixed(2);

    } else {

      window.carrito.push({
        id: producto.id,
        sku: producto.sku,
        codigo_barras: producto.codigo_barras,
        nombre: producto.nombre,
        precio,
        cantidad,
        subtotal: +(cantidad * precio).toFixed(2),
        unidad: producto.unidad || "pieza",
        existencias: producto.existencias_total ?? 0,
        stock_minimo: producto.stock_minimo ?? 0
      });

    }

       renderCarrito();

    limpiarAutocomplete();

    inputSku.value = "";
    inputCantidad.value = 1;
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

  }

  else if (e.key === "ArrowUp") {

    e.preventDefault();

    bloqueoNavegacion = true;
    setTimeout(()=> bloqueoNavegacion = false, 80);

    indiceSeleccionado--;

    if (indiceSeleccionado < 0) {
      indiceSeleccionado = resultadosBusqueda.length - 1;
    }

  }

  else if (e.key === "Enter" || e.key === "Tab") {

    e.preventDefault();

    const prod =
      resultadosBusqueda[indiceSeleccionado] ||
      resultadosBusqueda[0];

    if (!prod) return;

    autocompleteBox.classList.add("hidden");

    agregarProductoDesdeBusqueda(prod);
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

if (producto) return producto;


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
      const existenciasActuales = producto.existencias_total ?? 0;

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

      if (producto.unidad === "kg") {

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
      const precio = parseFloat(producto.precio_base);

      const existe = window.carrito.find(
        (i) =>
          i.id === producto.id ||
          i.sku === producto.sku ||
          i.codigo_barras === producto.codigo_barras
      );

      if (existe) {
        existe.cantidad = +(existe.cantidad + cantidad).toFixed(3);
        existe.subtotal = +(existe.cantidad * precio).toFixed(2);
      } else {
        window.carrito.push({
          id: producto.id,
          sku: producto.sku,
          codigo_barras: producto.codigo_barras,
          nombre: producto.nombre,
          precio,
          cantidad,
          subtotal: parseFloat((cantidad * precio).toFixed(2)),
          unidad: producto.unidad || "pieza",
          existencias: producto.existencias_total ?? producto.existencias ?? 0,
          stock_minimo: producto.stock_minimo ?? 0,
        });
      }

      renderCarrito();

      // 🧹 LIMPIAR PESO DESPUÉS DE AGREGAR PRODUCTO KG
      if (producto.unidad === "kg") {
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
        <p><b>Existencias:</b> ${producto.existencias_total ?? 0}</p>

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

  const q = texto.toLowerCase().trim()

  if(q.length < 1) return []

  /* usar memoria primero */
  let productos = cacheProductos || []

  if(!productos.length){
    productos = await obtenerProductosOffline()
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