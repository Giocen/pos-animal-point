// 💜 SmartPOS - eventosConexion.js (v3.0 MULTI-NEGOCIO + sincronización real)

import { supabaseClient, protegerSesion } from "../proteccion.js";
import { db } from "../db.js";
await protegerSesion(["cajero", "admin"]);

/* ==========================================================================
   🟣 CONFIG GLOBAL
=========================================================================== */
const negocio_id = localStorage.getItem("negocio_id") || null;
const sucursal_id = localStorage.getItem("sucursal_id") || null;

/* ==========================================================================
   🟣 EVENTOS DE CONEXIÓN
=========================================================================== */
export function configurarEventosConexion() {

  window.addEventListener("online", async () => {
    console.log("🌐 Conexión restaurada → sincronizando...");
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "info",
      title: "Reconectado",
      text: "Sincronizando datos pendientes...",
      timer: 2000,
      showConfirmButton: false,
      background: "#fff",
      customClass: { popup: "card-3d" },
    });

    await sincronizarPendientes();
  });

  window.addEventListener("offline", () => {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "warning",
      title: "Modo Offline",
      text: "Las ventas se guardarán localmente.",
      timer: 3000,
      showConfirmButton: false,
      background: "#fff",
      customClass: { popup: "card-3d" },
    });
  });
}

/* ==========================================================================
   🔄 SINCRONIZACIÓN PRINCIPAL
=========================================================================== */
export async function sincronizarPendientes() {

  if (!navigator.onLine) {
    console.warn("📴 Sin conexión → sincronización detenida.");
    return;
  }

  try {
    /* ───────────────────────────────────────────────────────────────
       1️⃣ SINCRONIZAR VENTAS
    ─────────────────────────────────────────────────────────────── */
    const ventasPendientes = await db.ventas.toArray();
    console.log(`🧾 Ventas pendientes: ${ventasPendientes.length}`);

    for (const v of ventasPendientes) {
      try {
        const uuid = v.uuid_supabase || crypto.randomUUID();

        // Verificar duplicado
        const { data: existe } = await supabaseClient
          .from("ventas")
          .select("id")
          .eq("uuid_supabase", uuid)
          .maybeSingle();

        if (existe) {
          await db.ventas.delete(v.id);
          console.log("🟢 Venta duplicada, eliminada local:", uuid);
          continue;
        }

        // Insertar venta principal
        const { data: ventaInsertada, error } = await supabaseClient
          .from("ventas")
          .insert([{
            uuid_supabase: uuid,
            folio: v.folio,
            total: Number(v.total),
            subtotal: Number(v.subtotal),
            descuento: Number(v.descuento ?? 0),
            metodo_pago: v.metodo_pago || "efectivo",
            cliente_id: v.cliente_id || null,
            fecha: v.fecha,
            corte_id: v.corte_id || null,
            negocio_id,
            sucursal_id
          }])
          .select()
          .single();

        if (error) {
          console.warn("⚠️ Error insertando venta:", error.message);
          continue;
        }

        /* ──────────────────────────────
           DETALLE DE LA VENTA (carrito)
        ────────────────────────────── */
        if (Array.isArray(v.detalle)) {
          for (const item of v.detalle) {
            await supabaseClient.from("ventas_detalle").insert([{
              venta_id: ventaInsertada.id,
              producto_id: item.producto_id,
              cantidad: item.cantidad,
              precio_unitario: item.precio,
              total: item.total,
              unidad: item.unidad || "pieza",
              negocio_id,
              sucursal_id
            }]);
          }
        }

        await db.ventas.delete(v.id);
        console.log("✅ Venta sincronizada:", uuid);

      } catch (error) {
        console.error("❌ Error en venta:", error);
      }
    }

    /* ───────────────────────────────────────────────────────────────
       2️⃣ SINCRONIZAR MOVIMIENTOS DE INVENTARIO
    ─────────────────────────────────────────────────────────────── */
    const movPendientes = await db.bitacora_inventario.toArray();
    console.log(`📦 Movimientos pendientes: ${movPendientes.length}`);

    for (const mov of movPendientes) {
      try {
        const { error } = await supabaseClient
          .from("bitacora_inventario")
          .insert([{
            producto_id: mov.producto_id,
            cantidad: mov.cantidad,
            motivo: mov.motivo,
            fecha: mov.fecha,
            usuario: mov.usuario,
            negocio_id,
            sucursal_id
          }]);

        if (!error) {
          await db.bitacora_inventario.delete(mov.id);
          console.log("📦 Movimiento sincronizado:", mov);
        }
      } catch (e) {
        console.error("❌ Error sincronizando inventario:", e);
      }
    }

    /* ───────────────────────────────────────────────────────────────
       ✔ ALERTA DE FINALIZACIÓN
    ─────────────────────────────────────────────────────────────── */
    if (ventasPendientes.length + movPendientes.length > 0) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Sincronización completada",
        text: "Todo ha sido enviado a la nube.",
        timer: 2500,
        showConfirmButton: false,
        background: "#fff",
        customClass: { popup: "card-3d" },
      });
    }

  } catch (error) {
    console.error("❌ Error general en sincronización:", error);
    Swal.fire({
      icon: "error",
      title: "Error en sincronización",
      text: "Se reintentará automáticamente.",
      background: "#fff",
      customClass: { popup: "card-3d" },
    });
  }
}
