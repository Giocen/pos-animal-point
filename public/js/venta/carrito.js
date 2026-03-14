// ============================================================
// 💜 SmartPOS - Carrito Global v4.6 (FINAL MULTI-NEGOCIO + FIX TOTAL)
// ============================================================

import { LocalDB } from "../localdb.js";
import { buscarProductoTotal } from "./productos.js";
import { supabaseClient } from "../supabase.js";

export let carrito = [];
window.carrito = carrito;
window.__carritoModulo = carrito;

// 🟣 MULTI-NEGOCIO
const negocio_id = localStorage.getItem("negocio_id") || "default";
const KEY_LOCAL = `carrito_${negocio_id}`;

// 🔥 Mantener sincronía global
function syncCarritoGlobal() {
  window.carrito = carrito;
  window.__carritoModulo = carrito;
}

/* ------------------------------------------------------------
   1️⃣ INICIALIZAR CARRITO (POR NEGOCIO)
------------------------------------------------------------ */
export async function inicializarCarrito() {
  try {
    const cache = await LocalDB.get(KEY_LOCAL);
    const data = Array.isArray(cache)
      ? cache
      : JSON.parse(localStorage.getItem(KEY_LOCAL) || "[]");

    carrito.length = 0;

    data.forEach((i) => {
      carrito.push({
        ...i,
        cantidad: Number(i.cantidad) || 0,
        precio: Number(i.precio) || 0,
        subtotal: Number(i.subtotal) || Number(i.cantidad * i.precio) || 0,
        descuento: Number(i.descuento) || 0,
        totalFinal:
          Number(i.totalFinal) ||
          Number(i.subtotal) ||
          Number(i.cantidad * i.precio),
      });
    });
  } catch {
    carrito.length = 0;
  }

  syncCarritoGlobal();
  renderCarrito();
}

/* ------------------------------------------------------------
   2️⃣ AGREGAR PRODUCTO
------------------------------------------------------------ */
export async function agregarProductoPorSku(
  sku,
  cantidadManual = "1",
  pesoManual = "0"
) {
  if (!sku) return;

  const producto = await buscarProductoTotal(sku);
  if (!producto)
    return Swal.fire("No encontrado", "Producto no existe.", "warning");

  const { data: vista } = await supabaseClient
    .from("v_productos_existencias")
    .select("existencias_total, stock_minimo")
    .eq("id", producto.id)
    .eq("negocio_id", negocio_id)
    .maybeSingle();

  const existenciasReales = Number(vista?.existencias_total ?? 0);
  const stockMinimo = Number(vista?.stock_minimo ?? 0);

  const unidadRaw = producto.unidad?.toLowerCase() || "pieza";

  const unidad = unidadRaw.includes("kg") || 
               unidadRaw.includes("kilo")
               ? "kg"
               : "pieza";

 let cantidad;

    if (unidad === "kg") {
      cantidad = Number(pesoManual);

      // 🔥 Si no hay báscula o viene vacío → default 1 kg
      if (!cantidad || cantidad <= 0) {
        cantidad = 1;
      }
    } else {
      cantidad = Number(cantidadManual) || 1;
    }


  const precio = Number(producto.precio_base) || 0;

  const existente = carrito.find((i) => i.id === producto.id);

  if (existente) {
    existente.cantidad = +(existente.cantidad + cantidad).toFixed(3);

    existente.subtotal = +(existente.cantidad * precio).toFixed(2);
    existente.totalFinal = +(
      existente.subtotal *
      (1 - (existente.descuento || 0) / 100)
    ).toFixed(2);

  } else {
    const subtotal = +(precio * cantidad).toFixed(2);

    carrito.push({
      id: producto.id,
      sku: producto.sku,
      codigo_barras: producto.codigo_barras,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio,
      cantidad: +cantidad.toFixed(3),
      subtotal,
      descuento: 0,
      totalFinal: subtotal,
      unidad,
      existencias: existenciasReales,
      stock_minimo: stockMinimo,
    });
  }

  syncCarritoGlobal();
  renderCarrito();
}

/* ------------------------------------------------------------
   3️⃣ RENDER CARRITO
------------------------------------------------------------ */
export async function renderCarrito() {
  const tbody = document.getElementById("carritoBody");
  const totalVentaEl = document.getElementById("totalVenta");

  if (!tbody || !totalVentaEl) return;

  tbody.innerHTML = "";
  let total = 0;

  carrito.forEach((item, index) => {

    const stockRestante = (item.existencias ?? 0) - item.cantidad;

    item.subtotal = +(item.cantidad * item.precio).toFixed(2);
    item.totalFinal = +(
      item.subtotal *
      (1 - (item.descuento || 0) / 100)
    ).toFixed(2);

    total += item.totalFinal;

    tbody.insertAdjacentHTML(
      "beforeend",
      `
      <tr class="border-t ${stockRestante < 0 ? 'bg-red-50' : ''}">
        
        <td class="p-2">
          ${item.nombre}
          ${
            stockRestante < 0
              ? `<div class="text-xs text-red-500">Inventario negativo</div>`
              : ""
          }
        </td>

        <!-- 🔥 COLUMNA PRECIO -->
        <td class="p-2 text-right">
          ${
            item.unidad === "kg"
              ? `
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Pesos"
                  value="${item.subtotal.toFixed(2)}"
                  class="w-24 text-right border rounded px-1 py-0.5"
                  onchange="actualizarPorImporte(${index}, this.value)"
                />
              `
              : `$${item.precio.toFixed(2)}`
          }
        </td>

        <!-- 🔥 COLUMNA CANTIDAD -->
        <td class="p-2 text-right">
          ${
            item.unidad === "kg"
              ? `
                <div class="text-xs text-gray-500">
                  ${
                    item.cantidad < 1
                      ? `${(item.cantidad * 1000).toFixed(0)} g`
                      : `${item.cantidad.toFixed(3)} kg`
                  }
                </div>
              `
              : `
                <input 
                  type="number"
                  min="1"
                  value="${item.cantidad}"
                  class="w-20 text-right border rounded px-1 py-0.5"
                  oninput="actualizarCantidad(${index}, this.value)"
                />
              `
          }
        </td>

        <!-- 🔥 TOTAL -->
        <td class="p-2 text-right">
          $${item.totalFinal.toFixed(2)}
          ${
            item.descuento > 0
              ? `<span class="ml-1 text-xs text-fuchsia-400">(-${item.descuento}%)</span>`
              : ""
          }
        </td>

        <td class="p-2 text-center flex gap-2 justify-center">
          <button class="text-purple-500 hover:text-purple-700"
                  onclick="editarDescuento(${index})">
            <i data-lucide="percent" class="w-5 h-5"></i>
          </button>

          <button class="text-red-500 hover:text-red-700"
                  onclick="eliminarItem(${index})">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
      `
    );
  });

  totalVentaEl.textContent = total.toFixed(2);

  try {
    await LocalDB.set(KEY_LOCAL, carrito);
  } catch {}

  localStorage.setItem(KEY_LOCAL, JSON.stringify(carrito));
  syncCarritoGlobal();

  document.dispatchEvent(new CustomEvent("carrito-actualizado"));
  document.dispatchEvent(new CustomEvent("carrito-total-cambiado", { detail: total }));

  if (window.lucide) lucide.createIcons();
}

/* ------------------------------------------------------------
   4️⃣ ELIMINAR ITEM
------------------------------------------------------------ */
export function eliminarItem(index) {
  carrito.splice(index, 1);
  syncCarritoGlobal();
  renderCarrito();
}

/* ------------------------------------------------------------
   5️⃣ DESCUENTO
------------------------------------------------------------ */
export async function editarDescuento(index) {
  const item = carrito[index];
  if (!item) return;

  const { value: desc } = await Swal.fire({
    title: `Descuento para: ${item.nombre}`,
    input: "number",
    inputLabel: "Porcentaje (%)",
    inputValue: item.descuento || 0,
    inputAttributes: { min: 0, max: 100 },
    confirmButtonText: "Aplicar",
    showCancelButton: true,
  });

  if (desc === undefined) return;

  item.descuento = Number(desc) || 0;

  item.subtotal = +(item.cantidad * item.precio).toFixed(2);
  item.totalFinal = +(
    item.subtotal *
    (1 - item.descuento / 100)
  ).toFixed(2);

  syncCarritoGlobal();
  renderCarrito();
}

/* ------------------------------------------------------------
   6️⃣ ACTUALIZAR CANTIDAD (PIEZA)
------------------------------------------------------------ */
export function actualizarCantidad(index, nuevaCantidad) {
  const item = carrito[index];
  if (!item) return;

  let cantidad = Number(nuevaCantidad);
  if (cantidad < 1) cantidad = 1;

  item.cantidad = +cantidad.toFixed(3);

  item.subtotal = +(item.cantidad * item.precio).toFixed(2);
  item.totalFinal = +(
    item.subtotal *
    (1 - (item.descuento || 0) / 100)
  ).toFixed(2);

  syncCarritoGlobal();
  renderCarrito();
}

/* ------------------------------------------------------------
   7️⃣ ACTUALIZAR POR IMPORTE (KG)
------------------------------------------------------------ */
export function actualizarPorImporte(index, nuevoImporte) {
  const item = carrito[index];
  if (!item) return;

  let importe = Number(nuevoImporte);

  if (!importe || importe <= 0) {
    item.cantidad = 0;
    item.subtotal = 0;
    item.totalFinal = 0;
  } else {

    // 🔥 Guardar peso con 6 decimales internos
    const pesoReal = importe / item.precio;

    item.cantidad = +pesoReal.toFixed(6); // ← precisión interna

    // 🔥 El importe escrito MANDA (no recalculamos desde el peso)
    item.subtotal = +importe.toFixed(2);

    // 🔥 Aplicar descuento después
    item.totalFinal = +(
      item.subtotal *
      (1 - (item.descuento || 0) / 100)
    ).toFixed(2);
  }

  syncCarritoGlobal();
  renderCarrito();
}

/* ------------------------------------------------------------
   8️⃣ EXPONER FUNCIONES
------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  window.inicializarCarrito = inicializarCarrito;
  window.agregarProductoPorSku = agregarProductoPorSku;
  window.eliminarItem = eliminarItem;
  window.renderCarrito = renderCarrito;
  window.editarDescuento = editarDescuento;
  window.actualizarCantidad = actualizarCantidad;
  window.actualizarPorImporte = actualizarPorImporte;
});
