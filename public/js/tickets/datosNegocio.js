// 💜 SmartPOS - Datos del Negocio v4.0 (MULTI-NEGOCIO FINAL 2025)
// Fuente: v_config_negocio
// Usa el negocio_id real del usuario logueado
// Compatible con ticket.js y con todo tu flujo

import { supabaseClient } from "../proteccion.js";
import { LocalDB } from "../localdb.js";

export async function obtenerDatosNegocio() {
  try {
    /* 0️⃣ Obtener negocio_id actual */
    const negocio_id =
      window.usuarioActual?.negocio_id ||
      LocalDB.get("negocio_id") ||
      null;

    if (!negocio_id) {
      console.warn("⚠️ negocio_id no disponible. Usando fallback.");
      return normalizar(await LocalDB.get("datos_negocio_cache") || {});
    }

    /* 1️⃣ Cache inmediato */
    const cache = await LocalDB.get("datos_negocio_cache_" + negocio_id);
    if (cache && Object.keys(cache).length > 0) {
      console.log("⚡ Datos negocio desde cache LocalDB:", negocio_id);
      return normalizar(cache);
    }

    /* 2️⃣ Consultar la vista filtrada por negocio */
    const { data, error } = await supabaseClient
      .from("v_config_negocio")
      .select("*")
      .eq("negocio_id", negocio_id)
      .maybeSingle();   // ✅ más seguro que .single()

    if (error) throw error;

    if (!data) {
      console.warn("⚠️ v_config_negocio regresó vacío. Usando fallback.");
      return normalizar(await LocalDB.get("datos_negocio_cache_" + negocio_id) || {});
    }

    const limpio = normalizar(data);

    /* 3️⃣ Guardar cache separado por negocio */
    await LocalDB.set("datos_negocio_cache_" + negocio_id, limpio);

    console.log("✅ Datos negocio desde Supabase (negocio:", negocio_id, ")");
    return limpio;

  } catch (err) {
    console.warn("⚠️ Error o modo offline:", err.message);

    /* 4️⃣ Fallback cache */
    const negocio_id =
      window.usuarioActual?.negocio_id ||
      LocalDB.get("negocio_id") ||
      null;

    const fallback = await LocalDB.get("datos_negocio_cache_" + negocio_id);
    return normalizar(fallback || {});
  }
}

/* ============================================================
   Normalizador (evita undefined en ticket)
   Siempre devuelve valores seguros para imprimir
============================================================ */
function normalizar(obj = {}) {
  return {
    ticket_logo_url: obj.ticket_logo_url || "",
    ticket_nombre_negocio: obj.ticket_nombre_negocio || "SmartPOS",
    ticket_direccion: obj.ticket_direccion || "",
    ticket_telefono: obj.ticket_telefono || "",
    ticket_correo: obj.ticket_correo || "",
    ticket_rfc: obj.ticket_rfc || "",
    ticket_mensaje_final: obj.ticket_mensaje_final || "¡Gracias por su compra!",
  };
}
