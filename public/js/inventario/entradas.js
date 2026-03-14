// ============================================================
// 💜 SmartPOS | Entradas de Inventario (Versión con caducidad)
// ============================================================

import Dexie from "https://cdn.jsdelivr.net/npm/dexie@3.2.2/dist/dexie.mjs";
import { supabaseClient, protegerSesion } from "../proteccion.js";

await protegerSesion(["cajero", "admin"]);

const negocioId =
  localStorage.getItem("negocio_id") ||
  window.usuarioActual?.negocio_id ||
  null;

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
});

// ------------------------------------------------------------
// 🔎 PRODUCTO ACTUAL
// ------------------------------------------------------------
let productoId = null;

// ------------------------------------------------------------
// 🎨 SweetAlert 3D
// ------------------------------------------------------------
function showSwal3D(options) {
  return Swal.fire({
    customClass: {
      popup: "card-3d",
      confirmButton: "btn-3d",
      cancelButton: "btn-3d",
    },
    ...options,
  });
}

// ------------------------------------------------------------
// 🧩 REFERENCIAS
// ------------------------------------------------------------
const inputCodigo = document.getElementById("codigoBarras");
const infoBox = document.getElementById("infoProducto");
const nombreEl = document.getElementById("nombreProducto");
const stockEl = document.getElementById("stockActual");
const modoSelect = document.getElementById("modoCaptura");
const cantidadInput = document.getElementById("cantidad");

const unidadSelect = document.getElementById("unidadCaptura");
const fechaCadInput = document.getElementById("fechaCaducidad");
const boxCaducidad = document.getElementById("boxCaducidad");

// Mostrar u ocultar fecha caducidad
unidadSelect.addEventListener("change", () => {
  if (unidadSelect.value === "kg") boxCaducidad.classList.remove("hidden");
  else boxCaducidad.classList.add("hidden");
});

// ============================================================
// 🔍 BUSCAR PRODUCTO
// ============================================================
inputCodigo.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const codigo = inputCodigo.value.trim();
    if (!codigo) return;
    await procesarCodigo(codigo);
  }
});

async function procesarCodigo(codigo) {
  await buscarProducto(codigo);

  if (!productoId) return;

  const unidad = unidadSelect.value;
  const cantidad =
    modoSelect.value === "rapido"
      ? 1
      : parseFloat(cantidadInput.value) || 1;

  reproducirBeep();
  vibrar();

  if (modoSelect.value === "rapido") {
    await registrarEntradaRapida(cantidad, unidad);
    inputCodigo.value = "";
  } else {
    showSwal3D({
      icon: "success",
      title: "Producto detectado",
      text: "Ingresa la cantidad y presiona Guardar Entrada.",
    });
  }
}

async function buscarProducto(codigo) {
  const { data, error } = await supabaseClient
    .from("v_productos_existencias")
    .select(
      "id, nombre, sku, codigo_barras, existencias_total, unidad, negocio_id"
    )
    .or(`codigo_barras.eq.${codigo},sku.eq.${codigo}`)
    .eq("negocio_id", negocioId)
    .single();

  if (error || !data) {
    infoBox.classList.add("hidden");
    productoId = null;
    return showSwal3D({
      icon: "error",
      title: "Producto no encontrado",
      text: "Verifica el código o SKU ingresado.",
    });
  }

  productoId = data.id;
  nombreEl.textContent = data.nombre;
  stockEl.textContent = `Existencias: ${data.existencias_total ?? 0}`;
  infoBox.dataset.unidad = data.unidad;
  infoBox.classList.remove("hidden");
}

// ============================================================
// 📝 REGISTRO MANUAL
// ============================================================
document.getElementById("formEntrada").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (modoSelect.value === "rapido") return;
  await registrarEntradaManual();
});

async function registrarEntradaManual() {
  if (!productoId)
    return showSwal3D({
      icon: "error",
      title: "Error",
      text: "Escanea un producto primero.",
    });

  let cantidad = parseFloat(cantidadInput.value);
  let unidad = unidadSelect.value;
  let fecha_caducidad = fechaCadInput.value || null;

  if (isNaN(cantidad) || cantidad <= 0)
    return showSwal3D({
      icon: "error",
      title: "Cantidad inválida",
    });

  if (unidad === "kg" && !fecha_caducidad)
    return showSwal3D({
      icon: "warning",
      title: "Fecha requerida",
      text: "Los productos por kilo requieren fecha de caducidad.",
    });

  if (unidad === "pieza") cantidad = Math.round(cantidad);

  agregarAHistorial(
    { id: productoId, nombre: nombreEl.textContent },
    cantidad,
    unidad,
    false,
    fecha_caducidad
  );

  reproducirBeep();
  vibrar();

  document.getElementById("formEntrada").reset();
  boxCaducidad.classList.add("hidden");
  inputCodigo.focus();

  showSwal3D({
    icon: "success",
    title: "Agregado al historial",
    text: "Presiona Registrar Todo para guardar en inventario.",
    timer: 1400,
    showConfirmButton: false,
  });
}

// ============================================================
// ⚡ REGISTRO RÁPIDO
// ============================================================
async function registrarEntradaRapida(cantidad, unidad) {
  let fecha_caducidad =
    unidad === "kg" ? fechaCadInput.value || null : null;

  if (unidad === "kg" && !fecha_caducidad)
    return showSwal3D({
      icon: "warning",
      title: "Fecha requerida",
      text: "Debes seleccionar fecha de caducidad.",
    });

  try {
    const { error } = await supabaseClient.from("entradas").insert([
      {
        producto_id: productoId,
        cantidad,
        unidad,
        fecha_caducidad,
        negocio_id: negocioId,
      },
    ]);

    if (error) throw error;

    agregarAHistorial(
      { id: productoId, nombre: nombreEl.textContent },
      cantidad,
      unidad,
      true,
      fecha_caducidad
    );

    await refrescarExistencias(productoId);
  } catch (err) {
    console.error("❌ Error rápido:", err);
    showSwal3D({
      icon: "error",
      title: "Error al registrar",
      text: "No se pudo guardar la entrada.",
    });
  }
}

// ============================================================
// 🔄 ACTUALIZAR EXISTENCIAS
// ============================================================
async function refrescarExistencias(productoId) {
  const { data } = await supabaseClient
    .from("v_productos_existencias")
    .select("existencias_total")
    .eq("id", productoId)
    .eq("negocio_id", negocioId)
    .maybeSingle();

  stockEl.textContent = `Existencias: ${data?.existencias_total ?? 0}`;
}

// ============================================================
// 🎵 Beep + vibración
// ============================================================
function reproducirBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 700;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {}
}
function vibrar() {
  if (navigator.vibrate) navigator.vibrate(120);
}

// ============================================================
// 📦 HISTORIAL
// ============================================================
const historialSection = document.getElementById("historialEntradas");
const tablaHistorial = document.getElementById("tablaHistorial");

let historial = [];

function agregarAHistorial(
  producto,
  cantidad,
  unidad = "pieza",
  registrado = false,
  fecha_caducidad = null
) {
  const existente = historial.find(
    (p) => p.id === producto.id && p.fecha_caducidad === fecha_caducidad
  );

  if (existente) {
    existente.cantidad += cantidad;
  } else {
    historial.push({
      id: producto.id,
      nombre: producto.nombre,
      cantidad,
      unidad,
      fecha_caducidad,
      registrado,
    });
  }

  renderizarHistorial();
}

function renderizarHistorial() {
  if (historial.length === 0) {
    historialSection.classList.add("hidden");
    tablaHistorial.innerHTML = "";
    return;
  }

  historialSection.classList.remove("hidden");
  tablaHistorial.innerHTML = "";

  historial.forEach((p, index) => {
    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td class="py-2 font-medium">${p.nombre}</td>

      <td class="py-2 text-center">
        <input type="number"
               min="0.01"
               step="0.01"
               value="${p.cantidad}"
               class="input w-20 text-center"
               data-index="${index}"
               data-field="cantidad">
      </td>

      <td class="py-2 text-center">${p.unidad}</td>

      <td class="py-2 text-center">
        ${p.fecha_caducidad || "—"}
      </td>

      <td class="py-2 text-center">
        ${
          p.registrado
            ? `<span class="text-xs text-green-600 font-semibold">✔ Registrado</span>`
            : `<button class="btn-3d bg-red-600 text-white px-2 py-1 rounded"
                data-index="${index}" data-action="eliminar">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>`
        }
      </td>
    `;

    tablaHistorial.appendChild(fila);
  });

  lucide.createIcons();
}

// 🎯 Modificar cantidades directamente
tablaHistorial.addEventListener("input", (e) => {
  const index = e.target.dataset.index;
  const field = e.target.dataset.field;
  if (index !== undefined && field) {
    historial[index][field] =
      field === "cantidad" ? parseFloat(e.target.value) || 0 : e.target.value;
  }
});

// 🗑 Eliminar del historial
tablaHistorial.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action='eliminar']");
  if (!btn) return;

  const index = parseInt(btn.dataset.index);

  if (historial[index].registrado)
    return showSwal3D({
      icon: "warning",
      title: "No se puede eliminar",
      text: "Este registro ya está guardado en inventario.",
    });

  const confirm = await Swal.fire({
    icon: "warning",
    title: "¿Eliminar del historial?",
    text: historial[index].nombre,
    showCancelButton: true,
    confirmButtonText: "Eliminar",
  });

  if (confirm.isConfirmed) {
    historial.splice(index, 1);
    renderizarHistorial();
  }
});

// ============================================================
// 📝 REGISTRAR TODO
// ============================================================
document
  .getElementById("btnRegistrarTodo")
  ?.addEventListener("click", async () => {
    const pendientes = historial.filter((p) => !p.registrado);

    if (pendientes.length === 0)
      return showSwal3D({
        icon: "info",
        title: "Nada que registrar",
        text: "Todos los productos ya están registrados.",
      });

    const confirmar = await Swal.fire({
      icon: "question",
      title: "¿Registrar todas las entradas?",
      text: `${pendientes.length} productos serán guardados.`,
      showCancelButton: true,
      confirmButtonText: "Registrar",
    });

    if (!confirmar.isConfirmed) return;

    const registros = pendientes.map((p) => ({
      producto_id: p.id,
      cantidad: p.cantidad,
      unidad: p.unidad,
      fecha_caducidad: p.unidad === "kg" ? p.fecha_caducidad : null,
      negocio_id: negocioId,
    }));

    const { error } = await supabaseClient.from("entradas").insert(registros);

    if (error) {
      console.error(error);
      return showSwal3D({
        icon: "error",
        title: "Error",
        text: "No se pudieron registrar todas las entradas.",
      });
    }

    pendientes.forEach((p) => (p.registrado = true));
    renderizarHistorial();

    showSwal3D({
      icon: "success",
      title: "Entradas registradas",
      text: "Inventario actualizado.",
      timer: 1500,
      showConfirmButton: false,
    });
  });

// ============================================================
// 📄 EXPORTAR PDF
// ============================================================
document.getElementById("btnExportarPDF")?.addEventListener("click", async () => {
  if (historial.length === 0)
    return showSwal3D({
      icon: "info",
      title: "Nada que exportar",
      text: "El historial está vacío.",
    });

  await generarNotaRecepcionPDF(historial);
});

// ============================================================
// 📴 OFFLINE — Dexie + Sync
// ============================================================
const DB_ENTRADAS = new Dexie("SmartPOSOffline");
DB_ENTRADAS.version(2).stores({
  entradas_pendientes:
    "++id, producto_id, cantidad, unidad, fecha_caducidad, negocio_id, fecha",
});

// Guardar cuando falla internet
async function guardarEntradaOffline(entrada) {
  try {
    await DB_ENTRADAS.entradas_pendientes.add(entrada);
  } catch (err) {
    console.error("❌ Error guardando offline:", err);
  }
}

// Intentar sincronizar al volver internet
async function sincronizarEntradasPendientes() {
  const pendientes = await DB_ENTRADAS.entradas_pendientes.toArray();
  if (!pendientes.length) return;

  for (const e of pendientes) {
    const { error } = await supabaseClient.from("entradas").insert([e]);
    if (!error) await DB_ENTRADAS.entradas_pendientes.delete(e.id);
  }
}
window.addEventListener("online", sincronizarEntradasPendientes);

// ============================================================
// 🚫 REEMPLAZO INTELIGENTE INSERT
// ============================================================
const insertOriginal =
  supabaseClient.from("entradas").insert.bind(
    supabaseClient.from("entradas")
  );

supabaseClient.from("entradas").insert = async (data) => {
  if (navigator.onLine) {
    try {
      const res = await insertOriginal(data);
      if (!res.error) return res;
    } catch {}
  }

  // Guardar offline si falla
  await guardarEntradaOffline({
    ...data[0],
    fecha: new Date().toISOString(),
  });

  return { error: null };
};
