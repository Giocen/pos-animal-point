// 💜 SmartPOS — Datos públicos del negocio (Multi-Negocio REAL)

import { supabaseClient } from "../supabase.js";

/**
 * Trae los datos REALES del negocio a partir del FOLIO de la venta.
 */
export async function obtenerDatosNegocioPublic(folio) {

  // 1) Validar folio
  if (!folio || typeof folio !== "string") {
    return datosFallback();
  }

  folio = folio.trim();

  // 2) Buscar negocio_id desde la vista pública del ticket
  const { data: venta, error: errVenta } = await supabaseClient
    .from("v_ticket_publico")
    .select("negocio_id")
    .eq("folio", folio)
    .maybeSingle();

  if (errVenta || !venta?.negocio_id) {
    console.warn("⚠️ No se obtuvo negocio_id desde el ticket:", errVenta);
    return datosFallback();
  }

  const negocio_id = venta.negocio_id;

  // 3) Obtener la configuración del negocio
  const { data, error } = await supabaseClient
    .from("v_config_negocio")
    .select("*")
    .eq("negocio_id", negocio_id)
    .maybeSingle();

  if (error || !data) {
    console.warn("⚠️ No se encontraron datos del negocio:", error);
    return datosFallback();
  }

  // 🔥 DEVUELVE DATOS REALES (muy importante)
  return {
    ticket_logo_url: data.ticket_logo_url,
    ticket_nombre_negocio: data.ticket_nombre_negocio,
    ticket_direccion: data.ticket_direccion,
    ticket_telefono: data.ticket_telefono,
    ticket_correo: data.ticket_correo,
    ticket_rfc: data.ticket_rfc,
    ticket_mensaje_final: data.ticket_mensaje_final
  };
}

/* -------------------------
   Datos por defecto
--------------------------*/
function datosFallback() {
  return {
    ticket_logo_url: "",
    ticket_nombre_negocio: "",   // 🔥 YA NO ES SMARTPOS
    ticket_direccion: "",
    ticket_telefono: "",
    ticket_correo: "",
    ticket_rfc: "",
    ticket_mensaje_final: ""
  };
}
