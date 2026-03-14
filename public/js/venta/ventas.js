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
      
        const payload = carritoReal.map((i, index) => {

        const productoUUID = i.uuid_supabase || i.id || null;

        if (!productoUUID) {
          console.warn("⚠️ Producto sin UUID Supabase:", i.nombre);
          
        }

        const tarjetaBruto = Number(pago.tarjeta) || 0;

        const COMISION_BASE = 0.035;   // 3.5%
        const IVA = 0.16;              // 16%

        const porcentajeComision = COMISION_BASE * (1 + IVA);
        // Resultado: 0.0406 → 4.06%

        const comisionTarjeta = tarjetaBruto * porcentajeComision;

          return {        
          producto_id: productoUUID,
          cantidad: Number(i.cantidad),
          precio_unitario: Number(i.precio),
          total: Number(i.totalFinal),
          unidad: i.unidad === "kg" ? "kg" : "pieza",
          fecha,
          corte_id: corte.id,
          cliente_id: window.clienteSeleccionado?.id ?? null,
          folio: window.folioVentaActual,
          metodo_pago: pago.metodo,

          pago_efectivo: index === 0 ? efectivoReal : 0,
          pago_tarjeta: index === 0 ? tarjetaBruto : 0,
          pago_transferencia: index === 0 ? Number(pago.transferencia) || 0 : 0,

          comision_tarjeta: index === 0 ? comisionTarjeta : 0,
          porcentaje_comision: index === 0 ? porcentajeComision : 0,

          cambio: index === 0 ? Number(pago.cambio) || 0 : 0,
          voucher: index === 0 ? pago.voucher || null : null,

          descuento: Number(i.descuento) || 0,
          total_final: Number(i.totalFinal),
          negocio_id,
          sucursal_id: null
        };
      })


        const { error } = await supabaseClient
          .from("ventas")
          .insert(payload);

        if (error) {
          console.error("❌ Error insert ventas:", error);
          throw new Error("No se pudo guardar la venta en Supabase");
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
