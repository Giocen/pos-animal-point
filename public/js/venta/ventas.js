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

  btnFinalizarPanel.addEventListener("click", async () => {


  // 🔥 DECLARAR negocio_id PRIMERO
  const negocio_id =
    window.usuarioActual?.negocio_id ||
    localStorage.getItem("negocio_id");

  if (!negocio_id) {
    console.error("❌ negocio_id NO disponible");
    return Swal.fire("Error", "Negocio no identificado", "error");
  }

  // 🛑 ANTI-DOBLE CLICK
  if (btnFinalizarPanel.dataset.locked === "1") return;

    // 🛑 ANTI-DOBLE CLICK
    if (btnFinalizarPanel.dataset.locked === "1") return;
    btnFinalizarPanel.dataset.locked = "1";
    setTimeout(() => (btnFinalizarPanel.dataset.locked = "0"), 1500);

    // 🔥 Carrito real desde window
    const carritoReal = window.carrito || [];

    if (!carritoReal.length)
      return Swal.fire("Aviso", "El carrito está vacío.", "info");

    // 🟣 ANTI-DOBLE EVENTO pago-confirmado
    await new Promise(resolve => {
      const handler = () => {
        document.removeEventListener("pago-confirmado", handler);
        resolve();
      };
      document.addEventListener("pago-confirmado", handler);
    });

    const pago = window.pagoFinal;
    if (!pago || !pago.metodo)
      return Swal.fire("Falta método", "Selecciona un método.", "warning");

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
      if (!ok.isConfirmed) return;
    }

    /* ============================================================
       GENERAR FOLIO
    ============================================================ */
    window.folioVentaActual = Date.now().toString().slice(-6);

    /* ============================================================
       💾 GUARDAR VENTA (ONLINE / OFFLINE)
    ============================================================ */
    try {
      const fecha = fechaMexico();
      const online = navigator.onLine;

      const negocio_id =
        window.usuarioActual?.negocio_id ||
        localStorage.getItem("negocio_id");

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
          const nombres = productosInvalidos
            .map(p => `• ${p.nombre || "Producto sin nombre"}`)
            .join("<br>");

          return Swal.fire({
            icon: "error",
            title: "Producto no registrado",
            html: `
              Los siguientes productos no existen en el sistema:<br><br>
              ${nombres}<br><br>
              Regístralos antes de venderlos.
            `,
            confirmButtonColor: "#dc2626",
          });
        }

        const totalVenta = carritoReal.reduce(
          (acc, i) => acc + Number(i.totalFinal),
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
          producto_id: null, // ya no se usa a nivel ticket
          cantidad: 0,       // ya no se usa a nivel ticket
          precio_unitario: 0,
          total: totalVenta,
          fecha,
          unidad: "pieza",
          corte_id: corte.id,
          cliente_id: window.clienteSeleccionado?.id ?? null,
          folio: window.folioVentaActual,
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

        const { data: ventaCreada, error: errorVenta } = await supabaseClient
          .from("ventas")
          .insert(ventaHeader)
          .select("id, folio")
          .single();

        if (errorVenta || !ventaCreada) {
          console.error("❌ Error creando encabezado de venta:", errorVenta);
          throw new Error("No se pudo crear la venta");
        }

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
            costo_unitario: Number(i.costo || 0),
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

      /* ============================================================
        🖨 IMPRESO
      ============================================================ */
      if (opcion === "impreso") {
        await mostrarTicketTermico(copia);
        limpiarCarritoReal();
      }

      /* ============================================================
        💌 DIGITAL
      ============================================================ */
      if (opcion === "digital") {
        await mostrarTicket(copia);
        limpiarCarritoReal();
      }


    } catch (err) {
      Swal.fire("Error", err.message, "error");
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
    title: "🛑 Anular venta",
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

  const { data } = await supabaseClient
    .from("ventas")
    .select("id, folio, total_final, estado, negocio_id")
    .eq("negocio_id", negocio_id)
    .order("id", { ascending: false })
    .limit(20);

  const ventas = data || [];

  // 🔥 IMPORTANTE
  window.listaVentas = ventas;

  Swal.fire({
    title: "🧾 Ventas",
    width: 600,
    background: "#1A042D",
    color: "#fff",
    showConfirmButton: false,

    html: `
      <div style="max-height:400px;overflow:auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-fuchsia-600/40">
              <th>Folio</th>
              <th>Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            ${
              ventas.map(v => `
                <tr class="border-b border-fuchsia-600/20">
                  <td>${v.folio}</td>
                  <td>$${Number(v.total_final).toFixed(2)}</td>

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
              `).join("")
            }
          </tbody>
        </table>
      </div>
    `
  });
}