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
      <tr class="border-t fila-carrito ${stockRestante < 0 ? 'bg-red-50' : ''}" data-index="${index}">
        
        <td class="p-2 producto-col">

          <div class="producto-nombre">
            ${item.nombre}
          </div>

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
                    <div class="text-sm text-gray-500 font-semibold">
                      ${
                        item.cantidad < 1
                          ? `${(item.cantidad * 1000).toFixed(0)} g`
                          : `${item.cantidad.toFixed(3)} kg`
                      }
                    </div>
                  `
                  : `
                   <div class="cantidad-pos">

                      <button onclick="disminuirCantidad(${index})" class="btn-cant">
                        -
                      </button>

                      <input 
                        type="number"
                        min="1"
                        value="${item.cantidad}"
                        class="input-cant"
                        onchange="actualizarCantidad(${index}, this.value)"
                      />

                      <button onclick="aumentarCantidad(${index})" class="btn-cant">
                        +
                      </button>

                    </div>

                  `
              }
            </td>
            <!-- 🔥 TOTAL + ACCIONES -->
            <td class="p-2 text-right">

              <div class="total-pos">

              <button onclick="editarDescuento(${index})" class="icon-descuento">
                <i data-lucide="percent"></i>
              </button>

              <button onclick="eliminarItem(${index})" class="icon-eliminar">
                <i data-lucide="trash-2"></i>
              </button>

              ${
                item.descuento > 0
                  ? `<span class="descuento">(-${item.descuento}%)</span>`
                  : ""
              }

              <span class="precio-total">$${item.totalFinal.toFixed(2)}</span>

            </div>



            </td>
            </tr>

      `
    );
  });

/* FLASH ÚLTIMO PRODUCTO */
const filas = tbody.querySelectorAll(".fila-carrito");

if(filas.length){

  const ultima = filas[filas.length-1];

  ultima.style.transition="background .4s";

  ultima.style.background="#bbf7d0";

  setTimeout(()=>{
    ultima.style.background="";
  },400);

}

  totalVentaEl.textContent = total.toFixed(2);

  try {
    await LocalDB.set(KEY_LOCAL, carrito);
  } catch {}

  localStorage.setItem(KEY_LOCAL, JSON.stringify(carrito));
  syncCarritoGlobal();

  document.dispatchEvent(new CustomEvent("carrito-actualizado"));
  document.dispatchEvent(new CustomEvent("carrito-total-cambiado", { detail: total }));

  if (window.lucide) lucide.createIcons();


  // 🔽 AUTO SCROLL AL FINAL DEL CARRITO
const tabla = document.querySelector(".carrito-card .tabla");

if (tabla) {
  tabla.scrollTo({
    top: tabla.scrollHeight,
    behavior: "smooth"
  });
}
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


export function aumentarCantidad(index) {
  const item = carrito[index];
  if (!item) return;

  item.cantidad += 1;

  renderCarrito();
}

export function disminuirCantidad(index) {
  const item = carrito[index];
  if (!item) return;

  item.cantidad -= 1;

  if (item.cantidad <= 0) {
    eliminarItem(index);
    return;
  }

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
  window.aumentarCantidad = aumentarCantidad;
  window.disminuirCantidad = disminuirCantidad;
});
