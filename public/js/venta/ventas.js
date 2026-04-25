// ============================================================
// 💜 SmartPOS - Ventas v4.6 ESTABLE (Carrito FIX DEFINITIVO)
// ============================================================
import { supabaseClient } from "/js/proteccion.js";
import { renderCarrito } from "./carrito.js"; 
import { 
  mostrarTicket, 
  mostrarMenuTicket, 
  mostrarTicketTermico
} from "./tickets.js";
import Dexie from "https://cdn.jsdelivr.net/npm/dexie@3.2.2/dist/dexie.mjs";
import {
  metodoPago,
  pagoEfectivo,
  pagoTarjeta,
  pagoTransfer,
  cambio,
  voucherTarjeta
} from "./pagos.js";

let guardandoVenta = false;

// ⚡ CONFIG RESILIENCIA POS
const TIMEOUT_VENTA = 10000; // 10s
const MAX_REINTENTOS = 2;

async function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Tiempo de espera agotado")), ms)
  );

  return Promise.race([promise, timeout]);
}

function resetUIVenta(btn) {
  Swal.close();
  if (btn) {
    btn.disabled = false;
    btn.innerText = "Finalizar venta";
  }
}

window.addEventListener("offline", () => {
  Swal.fire({
    icon: "warning",
    title: "Sin internet",
    text: "Se guardará en modo offline",
    toast: true,
    position: "top-end",
    timer: 3000,
    showConfirmButton: false
  });
});

const Swal = window.Swal;


function fechaMexico() {
  const ahora = new Date();

  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(ahora);

  const get = (type) => partes.find(p => p.type === type).value;

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}
/* ============================================================
   🟣 Cargar configuración
============================================================ */
async function cargarConfigVentas() {
  try {
    const { data } = await supabaseClient
      .from("configuracion_sistema")
      .select("clave, valor")
      .like("clave", "ventas_%");

    const config = {};

    if (data) {
      data.forEach(c => {
        try { config[c.clave] = JSON.parse(c.valor); }
        catch { config[c.clave] = c.valor; }
      });
    }

    for (const k in localStorage) {
      if (k.startsWith("ventas_")) {
        const v = localStorage.getItem(k);
        config[k] = v === "true" ? true : v === "false" ? false : v;
      }
    }

    window.configVentas = config;

  } catch (err) {
    console.warn("⚠️ No se cargó configuración de ventas:", err);
  }
}
cargarConfigVentas();

const esActivo = (v) => {
  if (v === undefined || v === null) return false;
  return ["true", "1", "si", "sí"].includes(String(v).trim().toLowerCase());
};

/* ============================================================
   🟣 FINALIZAR VENTA
============================================================ */
export function configurarVentas() {

  const btnFinalizarPanel = document.getElementById("btnFinalizarVentaPanel");
  if (!btnFinalizarPanel) return;

  // 🔥 EVITA DUPLICADOS
  if (btnFinalizarPanel.dataset.listener === "true") return;
  btnFinalizarPanel.dataset.listener = "true";

  btnFinalizarPanel.addEventListener("click", async () => {

   if (guardandoVenta) return;

guardandoVenta = true;

btnFinalizarPanel.disabled = true;
btnFinalizarPanel.innerText = "Procesando...";

// 🔄 SPINNER AQUÍ (después del lock)
Swal.fire({
  title: "Procesando pago",
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
      
      <div class="spinner-pos"></div>
      
      <div style="font-size:14px;opacity:0.8">
        No cierres la app
      </div>

    </div>
  `,
  background: "#1A042D",
  color: "#fff",
  allowOutsideClick: false,
  allowEscapeKey: false,
  showConfirmButton: false,
  didOpen: () => {
    const style = document.createElement("style");
    style.innerHTML = `
      .spinner-pos {
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255,255,255,0.2);
        border-top: 4px solid #d946ef;
        border-radius: 50%;
        animation: spinPOS 0.8s linear infinite;
      }

      @keyframes spinPOS {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
});
    

  // 🔥 DECLARAR negocio_id PRIMERO
  const negocio_id =
    window.usuarioActual?.negocio_id ||
    localStorage.getItem("negocio_id");

  if (!negocio_id) {
    console.error("❌ negocio_id NO disponible");
    resetUIVenta(btnFinalizarPanel);
    return Swal.fire("Error", "Negocio no identificado", "error");
  }

    // 🔥 Carrito real desde window
    const carritoReal = window.carrito || [];

    if (!carritoReal.length) {
      resetUIVenta(btnFinalizarPanel);
      return Swal.fire("Aviso", "El carrito está vacío.", "info");
    }

// 🔥 CREAR PAGO REAL DESDE pagos.js
const pago = {
  metodo: metodoPago,
  efectivo: pagoEfectivo,
  tarjeta: pagoTarjeta,
  transferencia: pagoTransfer,
  cambio: cambio,
  voucher: voucherTarjeta
};

console.log("💰 Pago generado:", pago);

// 🔥 VALIDACIÓN REAL
if (!pago.metodo) {
  resetUIVenta(btnFinalizarPanel);  
  return Swal.fire("Error", "Selecciona método de pago correctamente", "error");
}


    /* ---------------------------------------------- Corte ---------------------------------------------- */
    let corte = null;
    try {
      if (navigator.onLine) {
        const { data } = await supabaseClient
          .from("cortes_caja")
          .select("id")
          .eq("negocio_id", negocio_id)
          .is("cierre", null)
          .order("apertura", { ascending: false })
          .limit(1);

        corte = data?.[0];
        if (!corte) throw new Error("No hay corte de caja abierto.");

        localStorage.setItem("corte_activo", JSON.stringify(corte));

      } else {
        corte = JSON.parse(localStorage.getItem("corte_activo"));
        if (!corte) throw new Error("No hay corte activo (offline).");
      }

    } catch (err) {
      resetUIVenta(btnFinalizarPanel);
      return Swal.fire("Error", err.message, "error");
    }

    /* -------------------------------------- Confirmación -------------------------------------- */
    const conf = window.configVentas || {};
    if (esActivo(conf.ventas_confirmar_pago)) {
      const ok = await Swal.fire({
        title: "¿Registrar venta?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sí",
        confirmButtonColor: "#a21caf",
      });
      if (!ok.isConfirmed) {
        guardandoVenta = false;
        resetUIVenta(btnFinalizarPanel);
        return;
      }
    }

    
    /* ============================================================
       💾 GUARDAR VENTA (ONLINE / OFFLINE)
    ============================================================ */
    try {
      const fecha = fechaMexico();
      const online = navigator.onLine;     

      // 🔥 GENERAR FOLIO UNIVERSAL (VISIBLE AL USUARIO)
    function generarFolioPOS() {
      const negocio = negocio_id.slice(0, 4).toUpperCase(); // multi negocio
      const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const random = Date.now().toString().slice(-5);

      return `${negocio}-${fecha}-${random}`;
    }

const folioPOS = generarFolioPOS();

      // 📶 detectar red lenta
      if (online && navigator.connection) {
        const tipo = navigator.connection.effectiveType;

        if (["slow-2g", "2g"].includes(tipo)) {
          Swal.update({
            title: "Red lenta...",
            text: "Esto puede tardar unos segundos"
          });
        }
      }

      if (!negocio_id) {
        console.error("❌ negocio_id NO disponible al guardar venta");
        throw new Error("Negocio no identificado. Cierra sesión y vuelve a entrar.");
      }

      /* ----------------------------------------
         🟣 ONLINE → Guardar en Supabase
      ---------------------------------------- */
          if (online) {

        /* ============================================================
          🚨 VALIDAR PRODUCTOS SIN SKU (CRÍTICO)
        ============================================================ */
        const productosInvalidos = carritoReal.filter(
          i => !i.id && !i.uuid_supabase
        );

        if (productosInvalidos.length > 0) {

          resetUIVenta(btnFinalizarPanel);

          return Swal.fire({
            icon: "error",
            title: "Producto no registrado",
            html: `
            Los siguientes productos no existen en el sistema:<br><br>
            ${productosInvalidos.map(p => `• ${p.nombre}`).join("<br>")}
            <br><br>Regístralos antes de venderlos.
          `,
            confirmButtonColor: "#dc2626",
          });
        }


        // 🔥 VALIDAR COSTO ANTES DE TODO
        const productosSinCosto = carritoReal.filter(i => {
          const costo = i.costo ?? i.costo_unitario ?? i.producto?.costo;
          return costo === null || costo === undefined;
        });

        if (productosSinCosto.length > 0) {

          resetUIVenta(btnFinalizarPanel);

          return Swal.fire({
            icon: "warning",
            title: "Productos sin costo",
            html: `
              Los siguientes productos no tienen costo:<br><br>
              ${productosSinCosto.map(p => `• ${p.nombre}`).join("<br>")}
              <br><br>Corrige el costo antes de vender.
            `,
            confirmButtonColor: "#dc2626"
          });
        }


        const totalVenta = carritoReal.reduce(
          (acc, i) =>
            acc +
            Number(
              i.totalFinal ??
              (Number(i.precio) * Number(i.cantidad))
            ),
          0
        );

        const efectivoReal = Math.min(
          Number(pago.efectivo) || 0,
          totalVenta
        );

        const tarjetaBruto = Number(pago.tarjeta) || 0;
        const COMISION_BASE = 0.035;
        const IVA = 0.16;
        const porcentajeComision = COMISION_BASE * (1 + IVA);
        const comisionTarjeta = tarjetaBruto * porcentajeComision;

        /* ============================================================
          1️⃣ CREAR ENCABEZADO EN ventas
        ============================================================ */
        const ventaHeader = {
          folio: folioPOS,
          producto_id: null, // ya no se usa a nivel ticket
          cantidad: 0,       // ya no se usa a nivel ticket
          precio_unitario: 0,
          total: totalVenta,
          fecha,
          unidad: "pieza",
          corte_id: corte.id,
          cliente_id: window.clienteSeleccionado?.id ?? null,
          
          metodo_pago: pago.metodo,
          pago_efectivo: efectivoReal,
          pago_tarjeta: tarjetaBruto,
          pago_transferencia: Number(pago.transferencia) || 0,
          cambio: Number(pago.cambio) || 0,
          voucher: pago.voucher || null,
          descuento: carritoReal.reduce((acc, i) => acc + (Number(i.descuento) || 0), 0),
          total_final: totalVenta,
          negocio_id,
          sucursal_id: null,
          comision_tarjeta: comisionTarjeta,
          porcentaje_comision: porcentajeComision,
          estado: "completada"
        };

        let ventaCreada = null;
let errorVenta = null;

for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {

  try {

    const resp = await withTimeout(
      supabaseClient
        .from("ventas")
        .insert(ventaHeader)
        .select("id, folio")
        .single(),
      TIMEOUT_VENTA
    );

    ventaCreada = resp.data;
    errorVenta = resp.error;

    if (!errorVenta) break;

  } catch (err) {
    errorVenta = err;
  }

  console.warn(`⚠ Reintento ${intento + 1}...`);

  Swal.update({
  title: `Reintentando conexión...`,
  html: `
    <div style="font-size:14px;opacity:0.8">
      Intento ${intento + 1} de ${MAX_REINTENTOS + 1}
    </div>
  `
});

  await new Promise(r => setTimeout(r, 1000));
}

if (errorVenta) {
  resetUIVenta(btnFinalizarPanel);
  return Swal.fire({
    icon: "error",
    title: "Error al guardar venta",
    text: errorVenta.message || "Intenta nuevamente",
    confirmButtonColor: "#dc2626"
  });
}

  

      window.folioVentaActual = folioPOS;
        
        /* ============================================================
          2️⃣ CREAR DETALLE EN ventas_detalle
        ============================================================ */
        const detalles = carritoReal.map((i) => {
          const productoUUID = i.uuid_supabase || i.id || null;

          if (!productoUUID) {
            console.warn("⚠️ Producto sin UUID Supabase:", i.nombre);
          }

          return {
            venta_id: ventaCreada.id,
            producto_id: productoUUID,
            cantidad: Number(i.cantidad),
            precio_unitario: Number(i.precio),
            costo_unitario: Number(i.costo ?? i.costo_unitario ?? i.producto?.costo ?? 0),
            precio_total: Number(i.totalFinal),
            negocio_id
          };
        });

        const { error: errorDetalle } = await supabaseClient
          .from("ventas_detalle")
          .insert(detalles);

        if (errorDetalle) {
          console.error("❌ Error insert ventas_detalle:", errorDetalle);
          throw new Error("No se pudo guardar el detalle de la venta");
        }
      }


      /* ----------------------------------------
         🟣 OFFLINE → Guardar en Dexie local
      ---------------------------------------- */
      else {

        const db = new Dexie("SmartPOSOffline");
        db.version(db.verno + 1).stores({
          ventas: "++id, producto_id, total, fecha, negocio_id"
        });

        await db.ventas.bulkAdd(
          carritoReal.map(i => ({
            producto_id: i.id ?? i.uuid_supabase,
            cantidad: i.cantidad,
            precio_unitario: i.precio,
            total: i.totalFinal,
            unidad: i.unidad,
            fecha,

            metodo_pago: pago.metodo,
            pago_efectivo: pago.efectivo,
            pago_tarjeta: pago.tarjeta,
            pago_transferencia: pago.transferencia,
            cambio: pago.cambio,
            voucher: pago.voucher,

            descuento: i.descuento,
            total_final: i.totalFinal,
            cliente_id: window.clienteSeleccionado?.id ?? null,
            negocio_id,
            sucursal_id: null
          }))
        );
      }

     /* ============================================================
        📦 REGENERAR PEDIDOS DE REABASTECIMIENTO (AUTO)
        Usando v_productos_existencias para obtener stock REAL
      ============================================================ */
      try {
        for (const item of carritoReal) {

          if (!item.id && !item.uuid_supabase) continue;

          const { data: prodVista, error: errVista } = await supabaseClient
            .from("v_productos_existencias")
            .select("existencias_total, stock_minimo")
            .eq("id", item.id || item.uuid_supabase)
            .eq("negocio_id", negocio_id)
            .maybeSingle();

          if (errVista || !prodVista) {
            console.warn("⚠️ No se pudo obtener existencias reales:", item.nombre);
            continue;
          }

          const existenciasReales = Number(prodVista.existencias_total) || 0;
          const minimo = Number(prodVista.stock_minimo) || 0;

          if (existenciasReales <= minimo) {
            await supabaseClient.rpc("agregar_pedido_unico", {
              p_producto_id: item.id || item.uuid_supabase,
              p_cantidad: item.unidad === "kg" ? item.cantidad : 1
            });
          }
        }
      } catch (err) {
        console.warn("⚠️ No se pudo generar pedido automático:", err);
      }

      /* ============================================================
         ✨ Preparar ticket correctamente
      ============================================================ */
      const copia = carritoReal.map(i => ({
        id: i.id ?? i.uuid_supabase,
        nombre: i.nombre,
        descripcion: i.descripcion || "",
        unidad: i.unidad,
        cantidad: Number(i.cantidad),
        precio: Number(i.precio),
        subtotal: Number(i.precio) * Number(i.cantidad),
        descuento: Number(i.descuento) || 0,
        totalFinal:
          Number(i.totalFinal) > 0
            ? Number(i.totalFinal)
            : Number(i.precio) * Number(i.cantidad)
      }));

      window.carritoParaTicket = copia;

      /* ============================================================
         🗑 LIMPIAR carrito real DESPUÉS del ticket
      ============================================================ */
      function limpiarCarritoReal() {
        window.carrito.length = 0;
        renderCarrito();
        window.dispatchEvent(new Event("ventaFinalizada"));
      }

      /* ============================================================
         🎫 Menú ticket
      ============================================================ */
        const opcion = await mostrarMenuTicket();

      /* ============================================================
        🛑 CANCELAR → NO IMPRIME, NO ENVÍA, SOLO LIMPIA CARRITO
      ============================================================ */
      if (opcion === "cancelar") {
        limpiarCarritoReal();   // limpia carrito después de que la venta ya se registró
        return;                 // No mostrar ticket
      }

    if (opcion === "impreso") {
        await mostrarTicketTermico(copia);
      }

      if (opcion === "digital") {
        await mostrarTicket(copia);
      }

    
      /* ============================================================
        🔥 ACTUALIZAR STOCK EN DEXIE (TIEMPO REAL)
      ============================================================ */
     try {
  const db = window.db;

  if (!db) {
    console.warn("⚠️ DB no inicializada");
    return;
  }

  for (const item of carritoReal) {
    const id = item.uuid_supabase || item.id;

    if (!id) continue;

    const producto = await db.productos.get(id);

    if (producto) {
      producto.existencias =
        Number(producto.existencias || 0) -
        Number(item.cantidad || 0);

      await db.productos.put(producto);
    }
  }

  console.log("📦 Stock actualizado en Dexie");

  window.dispatchEvent(new Event("productos-actualizados"));

} catch (err) {
  console.warn("⚠️ No se pudo actualizar Dexie:", err);
}
      
      limpiarCarritoReal();
      document.dispatchEvent(new CustomEvent("venta-finalizada"));

      } catch (err) {
        Swal.fire("Error", err.message, "error");
        } finally {
           guardandoVenta = false;
          resetUIVenta(btnFinalizarPanel);
        }


  });
}

  
/* ============================================================
   🔧 Inicializar módulo
============================================================ */

function iniciarModuloVentas() {
  configurarVentas();
}

if (document.readyState !== "loading") iniciarModuloVentas();
else document.addEventListener("DOMContentLoaded", iniciarModuloVentas());


export async function anularVenta(venta) {

  const negocio_id =
    window.usuarioActual?.negocio_id ||
    localStorage.getItem("negocio_id");

  const usuario_id = window.usuarioActual?.id || null;

  if (!venta?.id) return;

  if (venta.estado === "anulada") {
    return Swal.fire("Aviso", "La venta ya está anulada", "info");
  }

  // 🔥 Validación negocio
  if (venta.negocio_id !== negocio_id) {
    return Swal.fire("Error", "No puedes anular esta venta", "error");
  }

  // 🔥 Swal bonito
  const { value: motivo } = await Swal.fire({
    title: `🛑 Anular venta ${venta.folio}`,
    input: "textarea",
    inputLabel: "Motivo de cancelación",
    inputPlaceholder: "Ej: error en cobro, cliente canceló...",
    inputAttributes: {
      maxlength: 200
    },
    showCancelButton: true,
    confirmButtonText: "Anular",
    confirmButtonColor: "#dc2626",
    cancelButtonText: "Cancelar",
    inputValidator: (value) => {
      if (!value) return "Debes escribir un motivo";
    }
  });

  if (!motivo) return;

  try {

    const { error } = await supabaseClient
      .from("ventas")
      .update({
        estado: "anulada",
        motivo_anulacion: motivo,
        fecha_anulacion: new Date().toISOString(),
        anulada_por: usuario_id
      })
      .eq("id", venta.id)
      .eq("negocio_id", negocio_id);

    if (error) throw error;

    Swal.fire("Listo", "Venta anulada correctamente", "success");

    // 🔥 refrescar UI
    window.dispatchEvent(new Event("ventaAnulada"));

  } catch (err) {
    console.error(err);
    Swal.fire("Error", err.message, "error");
  }
}


document.addEventListener("click", (e) => {

  const btn = e.target.closest(".btnAnular");
  if (!btn) return;

  const id = btn.dataset.id;

  // aquí necesitas tener la venta en memoria
  const venta = window.listaVentas?.find(v => v.id == id);

  if (!venta) return;

  anularVenta(venta);

});

export async function verVentas() {

  const negocio_id = localStorage.getItem("negocio_id");

  // 🔥 obtener inicio y fin del día (hora México)
  const hoy = new Date();
  const inicio = new Date(hoy.setHours(0, 0, 0, 0)).toISOString();

  const fin = new Date();
  fin.setHours(23, 59, 59, 999);

  const { data } = await supabaseClient
    .from("ventas")
    .select("id, folio, total_final, estado, negocio_id, fecha, metodo_pago")
    .eq("negocio_id", negocio_id)
    .gte("fecha", inicio)
    .lte("fecha", fin.toISOString())
    .order("fecha", { ascending: false });

  const ventas = data || [];

  // 🔥 IMPORTANTE
  window.listaVentas = ventas;

  Swal.fire({
    title: "🧾 Ventas del día",
    width: 700,
    background: "#1A042D",
    color: "#fff",
    showConfirmButton: false,

    html: `
      <div>

        <!-- 🔍 BUSCADOR -->
        <input 
          id="buscadorVentas"
          type="text"
          placeholder="Buscar folio, monto, hora (14:30) o método (efectivo)..."
          class="w-full mb-3 p-2 rounded bg-[#2A0A45] text-white border border-fuchsia-600/30 outline-none"
        />

        <!-- 📋 TABLA -->
        <div style="max-height:400px;overflow:auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-fuchsia-600/40">
                <th>Folio</th>
                <th>Hora</th>
                <th>Total</th>
                <th>Método</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>

            <tbody id="tablaVentas">
              ${
                ventas.map(v => {

                  const hora = new Date(v.fecha)
                    .toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                  return `
                    <tr class="border-b border-fuchsia-600/20">
                      <td>${v.folio}</td>
                      <td>${hora}</td>
                      <td>$${Number(v.total_final).toFixed(2)}</td>

                      <td class="uppercase text-xs">
                        ${v.metodo_pago || "-"}
                      </td>

                      <td>
                        ${
                          v.estado === "anulada"
                            ? `<span class="text-red-400">ANULADA</span>`
                            : `<span class="text-green-400">OK</span>`
                        }
                      </td>

                      <td>
                        ${
                          v.estado === "anulada"
                            ? ""
                            : `<button 
                                class="bg-red-600 text-white px-2 py-1 rounded btnAnular"
                                data-id="${v.id}">
                                ❌
                              </button>`
                        }
                      </td>
                    </tr>
                  `;
                }).join("")
              }
            </tbody>
          </table>
        </div>

      </div>
    `,

    didOpen: () => {

      const input = document.getElementById("buscadorVentas");
      const tabla = document.getElementById("tablaVentas");

      if (!input || !tabla) return;

      input.addEventListener("input", () => {

        const valor = input.value.toLowerCase().trim();

        const filtradas = window.listaVentas.filter(v => {

          const folio = (v.folio || "").toString().toLowerCase();
          const total = Number(v.total_final).toFixed(2);
          const metodo = (v.metodo_pago || "").toLowerCase();

          const hora = new Date(v.fecha)
            .toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            .toLowerCase();

          return (
            folio.includes(valor) ||
            total.includes(valor) ||
            metodo.includes(valor) ||
            hora.includes(valor)
          );
        });

        tabla.innerHTML = filtradas.map(v => {

          const hora = new Date(v.fecha)
            .toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

          return `
            <tr class="border-b border-fuchsia-600/20">
              <td>${v.folio}</td>
              <td>${hora}</td>
              <td>$${Number(v.total_final).toFixed(2)}</td>

              <td class="uppercase text-xs">
                ${v.metodo_pago || "-"}
              </td>

              <td>
                ${
                  v.estado === "anulada"
                    ? `<span class="text-red-400">ANULADA</span>`
                    : `<span class="text-green-400">OK</span>`
                }
              </td>

              <td>
                ${
                  v.estado === "anulada"
                    ? ""
                    : `<button 
                        class="bg-red-600 text-white px-2 py-1 rounded btnAnular"
                        data-id="${v.id}">
                        ❌
                      </button>`
                }
              </td>
            </tr>
          `;
        }).join("");

      });

    }

  });
}