// 💜 SmartPOS - extras.js (v2.4 FINAL MULTI-NEGOCIO)
// ------------------------------------------------------
// ✔ Ticket real basado en FOLIO
// ✔ WhatsApp usa datos reales del negocio (no texto fijo)
// ✔ Validaciones completas
// ✔ 100% Compatible con ventas.js + envios.js v12
// ------------------------------------------------------

import { supabaseClient } from "../proteccion.js";

const supabase = supabaseClient;

/* =======================================================
   Esperar evento principal
======================================================= */
document.addEventListener("ventasReady", () => {
  console.log("💬 Módulo Extras iniciado — ventas listas.");
  inicializarFuncionesExtras();
});

/* =======================================================
   Datos del negocio para WhatsApp / Ticket
======================================================= */
async function obtenerDatosNegocioWA() {
  const negocio_id = localStorage.getItem("negocio_id");

  const { data, error } = await supabase
    .from("v_config_negocio")
    .select("*")
    .eq("negocio_id", negocio_id)
    .maybeSingle();

  if (error || !data) {
    return {
      ticket_nombre_negocio: "Mi Negocio",
      ticket_mensaje_final: "¡Gracias por su compra!"
    };
  }

  return {
    ticket_nombre_negocio: data.ticket_nombre_negocio || "Mi Negocio",
    ticket_mensaje_final: data.ticket_mensaje_final || "¡Gracias por su compra!"
  };
}

/* =======================================================
   Inicializador principal
======================================================= */
function inicializarFuncionesExtras() {
  console.log("⚙️ Extras activos...");

  /* ------------------------------------------------------
     🖨 IMPRIMIR TICKET
  ------------------------------------------------------- */
  window.imprimirTicket = async function () {
    const folio = window.folioVentaActual;

    if (!folio) {
      return Swal.fire("Aviso", "No hay ticket para imprimir", "info");
    }

    const urlTicket = `https://smartposmid.web.app/ticket_public.html?f=${folio}`;

    try {
      toastInfo("🖨️ Abriendo ticket...", "#a21caf");

      const win = window.open(urlTicket, "_blank");
      if (win) setTimeout(() => win.print?.(), 600);
    } catch (err) {
      console.error("❌ Error imprimir:", err);
      Swal.fire("Error", "No se pudo imprimir el ticket", "error");
    }
  };

  /* ------------------------------------------------------
     💬 WHATSAPP — LINK REAL DEL TICKET + DATOS NEGOCIO
  ------------------------------------------------------- */
  window.enviarTicketWhatsApp = async function () {
    const folio = window.folioVentaActual;

    if (!folio)
      return Swal.fire("Aviso", "No hay ticket disponible", "info");

    const cliente = window.clienteSeleccionado;
    const telefono = cliente?.telefono?.replace(/\D/g, "");

    if (!telefono) {
      return Swal.fire("Aviso", "El cliente no tiene teléfono registrado", "info");
    }

    const urlTicket = `https://smartposmid.web.app/ticket_public.html?f=${folio}`;

    // 🟣 Datos del negocio
    const datos = await obtenerDatosNegocioWA();

    toastInfo("💬 Enviando WhatsApp...", "#10b981");

    const mensaje = encodeURIComponent(
`🧾 *${datos.ticket_nombre_negocio}*
${datos.ticket_mensaje_final}

Folio: ${folio}
Ticket:
${urlTicket}`
    );

    window.open(`https://wa.me/52${telefono}?text=${mensaje}`, "_blank");
  };

  /* ------------------------------------------------------
     💵 ABRIR CAJA (Simulada)
  ------------------------------------------------------- */
  window.abrirCajaPOSSimulada = async function () {
    try {
      toastInfo("💵 Simulando apertura...", "#9333ea");

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);

      Swal.fire({
        icon: "success",
        title: "Caja abierta (simulada)",
        timer: 1300,
        showConfirmButton: false,
        background: "#fff",
        customClass: { popup: "card-3d" },
      });

    } catch (err) {
      console.error("❌ Error caja:", err);
    }
  };
}

/* =======================================================
   Toastify Helper
======================================================= */
function toastInfo(texto, color = "#a21caf") {
  Toastify({
    text: texto,
    duration: 1600,
    gravity: "top",
    position: "right",
    style: {
      background: `linear-gradient(90deg, ${color}, #d946ef)`,
      color: "#fff",
      fontWeight: "600",
      borderRadius: "0.5rem",
    }
  }).showToast();
}
