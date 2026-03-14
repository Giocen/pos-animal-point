// 💜 SmartPOS - Impresora y Cajón unificados (ventas + corte) v2.6-MULTINEGOCIO
// --------------------------------------------------------------------------
// 🧩 Lógica original intacta
// 🧩 Solo se adaptó la obtención de datos del negocio para multi-negocio
// 🧩 Funciona con window.usuarioActual.negocio_id y obtenerDatosNegocio()

const NOMBRE_IMPRESORA = "POS-80"; // (referencial, no usado en modo nativo)

/* -------------------------------------------------------------------------- */
/* 💵 FUNCIÓN: ABRIR CAJÓN DE EFECTIVO (simulado)                            */
/* -------------------------------------------------------------------------- */
export async function abrirCajon() {
  try {
    const conf = window.configVentas || {};
    const cajaActiva =
      conf.ventas_caja_activa === true ||
      String(conf.ventas_caja_activa).toLowerCase() === "true";
    const impresoraActiva =
      conf.ventas_impresora_activa === true ||
      String(conf.ventas_impresora_activa).toLowerCase() === "true";

    if (!cajaActiva) return console.log("🚫 Cajón desactivado desde configuración.");
    if (!impresoraActiva) {
      window.dispatchEvent(new Event("impresora-estado"));
      return console.log("🚫 Impresora desactivada.");
    }

    const sonido = new Audio("/audio/cashdrawer.mp3");
    sonido.volume = 0.6;
    await sonido.play().catch(() => {});
    console.log("📦 Cajón simulado abierto (sin QZ-Tray)");
    toastOK("📦 Cajón abierto (modo simulado)");

  } catch (err) {
    console.error("❌ Error al abrir cajón simulado:", err);
    Swal.fire({
      icon: "error",
      title: "Error al abrir cajón",
      text: err.message || "No se pudo simular la apertura del cajón.",
      confirmButtonColor: "#a21caf",
      background: "#fff",
      customClass: { popup: "card-3d" },
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 🖨️ FUNCIÓN: IMPRIMIR TICKET (sin QZ-Tray, usando navegador)               */
/* -------------------------------------------------------------------------- */
export async function imprimirTicketQZ(carrito = []) {
  try {
    const conf = window.configVentas || {};
    const impresoraActiva =
      conf.ventas_impresora_activa === true ||
      String(conf.ventas_impresora_activa).toLowerCase() === "true";

    if (!impresoraActiva) {
      window.dispatchEvent(new Event("impresora-estado"));
      console.log("🚫 Impresora desactivada por configuración.");
      return;
    }

    // 🟣 MULTI-NEGOCIO → datos reales por negocio_id
    const obtenerNegocio = window.obtenerDatosNegocio;
    const datos = obtenerNegocio ? await obtenerNegocio() : {};

    // ----------------------------------------------
    //  TICKET SIMPLE (LÓGICA 100% TUYA, SIN CAMBIOS)
    // ----------------------------------------------
    let html = `
      <div style="font-family: monospace; font-size: 12px; width: 260px;">
        <center>
          <b>${datos.ticket_nombre_negocio || "SMARTPOS"}</b><br>
          ${datos.ticket_direccion || ""}<br>
          ${datos.ticket_telefono ? "Tel: " + datos.ticket_telefono + "<br>" : ""}
          ${datos.ticket_rfc ? "RFC: " + datos.ticket_rfc + "<br>" : ""}
          ------------------------------------------<br>
        </center>`;

    carrito.forEach((item) => {
      const nombre = item.nombre.slice(0, 25);
      const subtotal = item.subtotal.toFixed(2);
      const cantidad = item.cantidad.toFixed(2).replace(/\.00$/, "");
      html += `${nombre}<br>&nbsp;&nbsp;x${cantidad}  $${subtotal}<br>`;
    });

    const total = carrito.reduce((a, b) => a + b.subtotal, 0);
    html += `
        ------------------------------------------<br>
        <center><b>TOTAL: $${total.toFixed(2)}</b></center><br>
        <center>${datos.ticket_mensaje_final || "¡Gracias por su compra!"}</center>
        <br><br>
      </div>`;

    // 🖨️ Impresión nativa del navegador
    const ventana = window.open("", "_blank", "width=400,height=600");
    ventana.document.write(`
      <html>
        <head><title>Ticket SmartPOS</title></head>
        <body onload="window.print(); setTimeout(()=>window.close(),700);">
          ${html}
        </body>
      </html>
    `);
    ventana.document.close();

    // 💵 Abrir cajón (si está activo)
    if (String(conf.ventas_caja_activa).toLowerCase() === "true") {
      const sonido = new Audio("/audio/cashdrawer.mp3");
      sonido.volume = 0.6;
      await sonido.play().catch(() => {});
      console.log("📦 Cajón simulado abierto junto con impresión.");
    }

    window.dispatchEvent(new Event("impresora-estado"));
    toastOK("🖨️ Ticket enviado a impresión");

  } catch (err) {
    console.error("❌ Error al imprimir ticket:", err);
    Swal.fire({
      icon: "error",
      title: "Error al imprimir",
      text: err.message || "No se pudo imprimir el ticket.",
      confirmButtonColor: "#a21caf",
      background: "#fff",
      customClass: { popup: "card-3d" },
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 🔔 Helpers visuales                                                        */
/* -------------------------------------------------------------------------- */
function toastOK(texto) {
  Toastify({
    text: texto,
    duration: 1800,
    gravity: "top",
    position: "right",
    style: {
      background: "linear-gradient(90deg,#22c55e,#16a34a)",
      color: "#fff",
      borderRadius: "0.5rem",
      fontWeight: "600",
    },
  }).showToast();
}
