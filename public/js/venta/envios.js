// 💌 SmartPOS - envios.js (v12.1 - UNIVERSAL + MULTI-NEGOCIO CORREGIDO)

import { supabaseClient } from "../proteccion.js";
import { clienteSeleccionado } from "./utilidades.js";

const Swal = window.Swal;

/* ============================================================
   📌 1) Obtener configuración EmailJS (por NEGOCIO)
============================================================ */
async function obtenerConfigEmail() {

  const negocio_id = localStorage.getItem("negocio_id");

  const claves = ["email_service_id", "email_template_id", "email_public_key"];

  const { data, error } = await supabaseClient
    .from("configuracion_sistema")
    .select("clave, valor")
    .eq("negocio_id", negocio_id)
    .in("clave", claves);

  if (error) {
    console.error("❌ Error cargando configuración de email:", error);
    return null;
  }

  const cfg = {};
  data?.forEach((r) => {
    cfg[r.clave] = r.valor; // <-- CORREGIDO (sin JSON.parse)
  });

  return cfg;
}

/* ============================================================
   📌 2) Datos del negocio (MULTI-NEGOCIO)
============================================================ */
async function obtenerDatosNegocioParaCorreo() {

  const negocio_id = localStorage.getItem("negocio_id");

  const { data, error } = await supabaseClient
    .from("v_config_negocio")
    .select("*")
    .eq("negocio_id", negocio_id)
    .single();

  if (error || !data) {
    console.warn("⚠️ No se pudieron cargar datos negocio:", error);
    return {
      ticket_nombre_negocio: "Mi Negocio",
      ticket_telefono: "",
      ticket_direccion: "",
      ticket_correo: "",
      ticket_rfc: "",
      ticket_mensaje_final: ""
    };
  }

  return {
    ticket_nombre_negocio: data.ticket_nombre_negocio || "Mi Negocio",
    ticket_telefono: data.ticket_telefono || "",
    ticket_direccion: data.ticket_direccion || "",
    ticket_correo: data.ticket_correo || "",
    ticket_rfc: data.ticket_rfc || "",
    ticket_mensaje_final: data.ticket_mensaje_final || ""
  };
}

/* ============================================================
   📌 3) Inicializar EmailJS
============================================================ */
async function inicializarEmailJS() {

  const cfg = await obtenerConfigEmail();
  if (!cfg) return false;

  const service = cfg.email_service_id;
  const template = cfg.email_template_id;
  const publicKey = cfg.email_public_key;

  if (!service || !template || !publicKey) {
    Swal.fire({
      icon: "warning",
      title: "Correo no configurado",
      html: `Configura EmailJS en:<br><b>Configuración → Correo</b>`,
      confirmButtonColor: "#a21caf"
    });
    return false;
  }

  let intentos = 0;
  while (!window.emailjs && intentos < 20) {
    await new Promise(r => setTimeout(r, 120));
    intentos++;
  }

  if (!window.emailjs) {
    Swal.fire("Error", "EmailJS no está disponible.", "error");
    return false;
  }

  window.emailjs.init(publicKey.trim());

  return { service, template };
}

/* ============================================================
   📧 4) Enviar CORREO – SOLO LINK HTML
============================================================ */
export async function enviarCorreoLink(correo, carrito) {

  const cfg = await inicializarEmailJS();
  if (!cfg) return;

  if (!correo) {
    const { value } = await Swal.fire({
      title: "Correo del cliente",
      input: "email",
      inputPlaceholder: "cliente@gmail.com",
      showCancelButton: true,
      confirmButtonColor: "#a21caf"
    });
    if (!value) return;
    correo = value;
  }

  const total = carrito.reduce((s, i) => s + i.totalFinal, 0).toFixed(2);

  // 🟣 Folio real
  const folio =
    window.folioVentaActual ||
    localStorage.getItem("folio_venta_actual");

  if (!folio)
    return Swal.fire("Error", "No se encontró el folio de la venta.", "error");

  const url = `https://smartposmid.web.app/ticket_public.html?f=${folio}`;

  const datos = await obtenerDatosNegocioParaCorreo();

  Swal.fire({
    title: "Enviando correo…",
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false
  });

  try {
    await window.emailjs.send(cfg.service, cfg.template, {
      email: correo,
      folio,
      total,
      url_ticket: url,

      negocio: datos.ticket_nombre_negocio,
      direccion: datos.ticket_direccion,
      telefono: datos.ticket_telefono,
      correo_negocio: datos.ticket_correo,
      rfc: datos.ticket_rfc,
      mensaje: datos.ticket_mensaje_final,
      anio: new Date().getFullYear()
    });

    Swal.fire({
      icon: "success",
      title: "📧 Ticket enviado",
      html: `Enviado a <b>${correo}</b><br>
        <a href="${url}" target="_blank" class="text-fuchsia-600 underline">
          Abrir Ticket
        </a>`,
      confirmButtonColor: "#a21caf"
    });

  } catch (err) {
    console.error("❌ EmailJS error:", err);
    Swal.fire("Error", "No se pudo enviar el email.", "error");
  }
}

/* ============================================================
   💬 5) WhatsApp — SOLO LINK HTML
============================================================ */
export async function enviarWhatsApp(carrito) {

  let telefono = clienteSeleccionado?.telefono;

  if (!telefono) {
    const { value } = await Swal.fire({
      title: "Número WhatsApp",
      input: "tel",
      inputAttributes: { maxlength: 10 },
      showCancelButton: true,
      confirmButtonColor: "#a21caf"
    });
    telefono = value;
  }

  if (!telefono || telefono.length < 10)
    return Swal.fire("Aviso", "Número incorrecto", "info");

  const total = carrito.reduce((s, i) => s + i.totalFinal, 0).toFixed(2);

  const folio =
    window.folioVentaActual ||
    localStorage.getItem("folio_venta_actual");

  const url = `https://smartposmid.web.app/ticket_public.html?f=${folio}`;

  const mensaje = encodeURIComponent(
`🧾 Ticket de compra
Folio: ${folio}
Total: $${total}

📄 Ver ticket:
${url}

¡Gracias por su compra!`
  );

  window.open(`https://wa.me/52${telefono}?text=${mensaje}`, "_blank");
}
