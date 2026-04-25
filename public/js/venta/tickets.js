// ============================================================================
// 💜 SmartPOS - tickets.js v5.0 (2025) — PARTE 1 / 2
// ✔ Sin perder lógica original
// ✔ Encabezado limpio
// ✔ Datos negocio 100% correctos
// ✔ Ticket digital + térmico
// ✔ Librerías mantenidas (jsPDF / html2canvas / SweetAlert / lucide)
// ============================================================================
import { formatoMX } from "./utilidades.js";
import { obtenerDatosNegocio } from "../tickets/datosNegocio.js";
import { plantillasTicket } from "/js/tickets/plantillasTicket.js";

window.__ULTIMO_TICKET_HTML = "";
window._generandoEnvio = false;
const Swal = window.Swal;
const lucide = window.lucide;

/* ============================================================
   🔧 QS Seguro dentro de SweetAlert
============================================================ */
function qs(sel) {
  const popup = document.querySelector(".swal2-popup");
  return popup ? popup.querySelector(sel) : document.querySelector(sel);
}

/* ============================================================
   🎨 Resolver plantilla de ticket seleccionada
============================================================ */
function obtenerPlantillaTicket(id) {
  return (
    plantillasTicket.find(p => p.id === id) ||
    plantillasTicket.find(p => p.id === "clasico")
  );
}


/* ============================================================
   📌 MENÚ PRINCIPAL (Impreso / Digital)
============================================================ */
export async function mostrarMenuTicket() {
  return new Promise(async (resolve) => {
    await Swal.fire({
      title: "¿Qué deseas hacer?",
      icon: "question",
      background: "#fff",
      width: 410,
      showConfirmButton: false,
      allowOutsideClick: false,
      html: `
        <div class="flex flex-col gap-3 mt-2 text-[15px]">
          <button id="btnTicketImpreso"
            class="px-4 py-3 rounded-lg w-full bg-gray-100 hover:bg-gray-200
                   font-semibold text-gray-700 flex items-center justify-center gap-2">
            <i data-lucide="printer"></i> Imprimir Ticket
          </button>

          <button id="btnTicketDigital"
            class="px-4 py-3 rounded-lg w-full bg-gray-100 hover:bg-gray-200
                   font-semibold text-gray-700 flex items-center justify-center gap-2">
            <i data-lucide="file-text"></i> Ticket Digital
          </button>

          <button id="btnTicketCancelar"
            class="px-3 py-2 text-red-500 font-semibold w-full">
            Cancelar
          </button>
        </div>
      `,
      didOpen: () => {
        lucide.createIcons();

        qs("#btnTicketImpreso").onclick = () => {
          Swal.close();
          resolve("impreso");
        };

        qs("#btnTicketDigital").onclick = () => {
          Swal.close();
          resolve("digital");
        };

        qs("#btnTicketCancelar").onclick = () => {
          Swal.close();
          resolve("cancelar");
        };
      }
    });
  });
}

/* ============================================================
   🔧 Convertir LOGO a Base64 para impresión térmica
============================================================ */
async function cargarLogoBase64(url) {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

  } catch (err) {
    console.error("❌ Error al convertir logo en Base64:", err);
    return null;
  }
}

const ANCHO = 42;  // ancho real de 80mm en caracteres monospace

function linea(textoIzq, textoDer) {
  const left = textoIzq.toString();
  const right = textoDer.toString();

  const espacios = ANCHO - left.length - right.length;

  return left +
    " ".repeat(Math.max(1, espacios)) +
    right;
}


function centro(txt) {
  txt = txt.toString();

  if (txt.length >= ANCHO) {
    return txt.slice(0, ANCHO);
  }

  const leftPad = Math.floor((ANCHO - txt.length) / 2);
  return " ".repeat(Math.max(0, leftPad)) + txt;
}

function centroMultiLinea(texto) {
  texto = texto.toString().trim();

  if (!texto) return "";

  const palabras = texto.split(" ");
  let linea = "";
  let resultado = "";

  palabras.forEach(p => {
    if ((linea + p).length > ANCHO) {
      resultado += centro(linea.trim()) + "\n";
      linea = p + " ";
    } else {
      linea += p + " ";
    }
  });

  if (linea.trim()) {
    resultado += centro(linea.trim()) + "\n";
  }

  return resultado;
}

function lineaGuiones() {
  return "-".repeat(ANCHO);
}

function linea80mm(desc, precio) {
  const maxDesc = 34;             // ancho ideal para 80mm
  if (desc.length > maxDesc)
    desc = desc.slice(0, maxDesc - 3) + "...";

  const totalWidth = 42;          // línea completa = 42 caracteres reales
  const precioTxt = precio.toString();

  const espacios = totalWidth - desc.length - precioTxt.length;
  return desc + " ".repeat(Math.max(1, espacios)) + precioTxt;
}

/* ============================================================
   🖨 TICKET TÉRMICO — Versión adaptada (corrige encabezado)
============================================================ */
export function mostrarTicketTermico(carritoParaTicket = []) {
  return new Promise(async (resolve) => {
    try {

    let datos = {};
    const negocio_id = localStorage.getItem("negocio_id") || null;

    try { datos = await obtenerDatosNegocio(); } catch {}
    console.log("LOGO URL:", datos.ticket_logo_url);

    const negocio = datos.ticket_nombre_negocio || "SMARTPOS";
    const dir = datos.ticket_direccion || "";
    const tel = datos.ticket_telefono || "";
    const correo = datos.ticket_correo || "";
    const rfc = datos.ticket_rfc || "";
    const msg = datos.ticket_mensaje_final || "¡Gracias por su compra!";
    const folio = window.folioVentaActual || Date.now().toString().slice(-6);
    const fecha = new Date().toLocaleString("es-MX");

    let logoURL = datos.ticket_logo_url;

    try {
      if (typeof logoURL === "string" && logoURL.trim().startsWith("{")) {
        const obj = JSON.parse(logoURL);
        logoURL = obj.url || "";
      }
    } catch {}


    /* ------------------------------
       CARGAR LOGO EN BASE64
    ------------------------------ */
    let logo = "";
    if (logoURL) {
      logo = await cargarLogoBase64(logoURL);
    }

    /* ------------------------------
       CONSTRUIR TICKET COMPACTO
    ------------------------------ */
    let contenido = "";

      contenido += centro(negocio) + "\n";
      if (dir) contenido += centroMultiLinea(dir);
      if (tel) contenido += centro(`Tel: ${tel}`) + "\n";
      if (correo) contenido += centro(correo) + "\n";
      if (rfc) contenido += centro(rfc) + "\n";

      contenido += lineaGuiones() + "\n";
      contenido += linea("Folio:", folio) + "\n";
      contenido += linea("Fecha:", fecha) + "\n";
      contenido += lineaGuiones() + "\n";

      // Encabezado productos
      contenido += linea("Descripción", "Importe") + "\n";
      contenido += lineaGuiones() + "\n";

      // Productos
      carritoParaTicket.forEach(item => {
        const cant = item.unidad === "kg"
          ? (item.cantidad < 1
              ? `${(item.cantidad * 1000).toFixed(0)} g`
              : `${item.cantidad.toFixed(3)} kg`)
          : item.cantidad.toFixed(0);

        let desc = `${item.nombre} (${cant})`;
        if (desc.length > 34) desc = desc.slice(0, 31) + "...";

        const precio = `$${item.totalFinal.toFixed(2)}`; // ← ESTA LÍNEA FALTABA

        contenido += linea(desc, precio) + "\n";
      });
    // -----------------------------------------
    // CALCULAR TOTALES (antes de usarlos)
    // -----------------------------------------
    const subtotal = carritoParaTicket.reduce((s, i) => s + i.subtotal, 0);
    const descuento = carritoParaTicket.reduce(
      (s, i) => s + (i.subtotal - i.totalFinal), 0
    );
    const total = carritoParaTicket.reduce((s, i) => s + i.totalFinal, 0);

    // -----------------------------------------
    // IMPRIMIR TOTALES EN FORMATO 80mm REAL
    // -----------------------------------------
    contenido += lineaGuiones() + "\n";
    contenido += linea("SUBTOTAL:", `$${subtotal.toFixed(2)}`) + "\n";
    contenido += linea("DESC:", `$${descuento.toFixed(2)}`) + "\n";
    contenido += linea("TOTAL:", `$${total.toFixed(2)}`) + "\n";
    contenido += lineaGuiones() + "\n";

    // -----------------------------------------
    // METODO DE PAGO
    // -----------------------------------------
    const pago = window.pagoFinal || {};
    const metodo = pago.metodo || "efectivo";

    contenido += centro("METODO DE PAGO") + "\n";
    contenido += lineaGuiones() + "\n";

    if (metodo === "mixto") {
      contenido += linea("EFECTIVO:", `$${(pago.efectivo || 0).toFixed(2)}`) + "\n";
      contenido += linea("TARJETA:",  `$${(pago.tarjeta || 0).toFixed(2)}`) + "\n";
    }
    else if (metodo === "tarjeta") {
      contenido += linea("TARJETA:", `$${(pago.tarjeta || 0).toFixed(2)}`) + "\n";
    }
    else if (metodo === "transferencia") {
      contenido += linea("TRANSFER:", `$${(pago.transferencia || 0).toFixed(2)}`) + "\n";
    }
    else {
      contenido += linea("EFECTIVO:", `$${(pago.efectivo || 0).toFixed(2)}`) + "\n";
    }

    if (pago.cambio && pago.cambio > 0) {
      contenido += linea("CAMBIO:", `$${pago.cambio.toFixed(2)}`) + "\n";
    }

    if (pago.voucher) {
      contenido += centro(`AUT: ${pago.voucher}`) + "\n";
    }

    contenido += lineaGuiones() + "\n";

    // -----------------------------------------
    // MENSAJE FINAL
    // -----------------------------------------
    contenido += centro(msg) + "\n";
    contenido += lineaGuiones() + "\n";


            
    /* ------------------------------
       IFRAME PARA IMPRESIÓN (80mm)
    ------------------------------ */
     const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (e) {}

          // 🔥 resolver SIEMPRE
          setTimeout(() => {
            iframe.remove();
            resolve();
          }, 800);

        }, 300);
      };

 iframe.srcdoc = `
<html>
  <head>
    <style>
      @page {
        margin: 0;
        size: 80mm auto;
      }

      body {
        margin: 0;
        padding: 0;
        width: 80mm;
        font-family: monospace;
      }

      /* 🔥 CONTENEDOR REAL DEL TICKET */
      .ticket {
        width: 72mm;          /* ancho útil real */
        margin: 0 auto;       /* 🔥 CENTRADO PERFECTO */
      }

      .logo {
        width: 100%;
        text-align: center;
        margin: 6px 0 4px 0;
      }

      .logo img {
        max-width: 48mm;
        max-height: 20mm;
        display: block;
        margin: 0 auto;
      }

      pre {
        margin: 0;
        padding: 0;           /* ❌ SIN PADDING */
        width: 100%;
        font-size: 11px;
        line-height: 1.35;
        white-space: pre;
        text-align: left;
      }
    </style>
  </head>

  <body>

    <div class="ticket">

      ${logo ? `
        <div class="logo">
          <img src="${logo}">
        </div>
      ` : ""}

      <pre>${contenido}</pre>

    </div>

    <script>
      window.onload = () => {
        window.print();
        setTimeout(() => window.close(), 300);
      };
    <\/script>

  </body>
</html>
`;


  } catch (err) {
      console.error("❌ Error ticket térmico:", err);
      resolve(); // 🔥 nunca dejes colgado el flujo
    }

    });

}

/* ============================================================
   🧾 Crear ticket visual sin SweetAlert (para PDF)
============================================================ */
function crearTicketVisualSimple(datos, carrito) {

  const subtotal = carrito.reduce((s, i) => s + i.subtotal, 0);
  const descuento = carrito.reduce((s, i) => s + (i.subtotal - i.totalFinal), 0);
  const total = carrito.reduce((s, i) => s + i.totalFinal, 0);

  const div = document.createElement("div");
  div.className = "ticket-box";
  div.style.width = "80mm";
  div.style.maxWidth = "300px";
  div.style.background = "#fff";
  div.style.padding = "12px";
  div.style.fontFamily = "monospace";
  div.style.fontSize = "12px";
  div.style.color = "#000";
  div.style.border = "1px solid #eee";

  const filas = carrito.map(i => {
    const cant =
      i.unidad === "kg"
        ? (i.cantidad < 1 ? `${(i.cantidad*1000).toFixed(0)} g` : `${i.cantidad.toFixed(3)} kg`)
        : i.cantidad;

    return `
      <div style="display:flex;justify-content:space-between;">
        <span>${i.nombre} (${cant})</span>
        <span>$${i.totalFinal.toFixed(2)}</span>
      </div>`;
  }).join("");

  div.innerHTML = `
    <div style="text-align:center;margin-bottom:6px;">
      ${datos.ticket_logo_url ? `<img src="${datos.ticket_logo_url}" style="height:40px;margin-bottom:6px;">` : ""}
      <div><strong>${datos.ticket_nombre_negocio || "SmartPOS"}</strong></div>
      <div style="font-size:11px">${datos.ticket_direccion || ""}</div>
      <div style="font-size:11px">${datos.ticket_telefono || ""}</div>
    </div>

    <div style="font-size:11px;margin-bottom:6px;">
      <div><b>Folio:</b> ${window.folioVentaActual || "--"}</div>
      <div><b>Fecha:</b> ${new Date().toLocaleString()}</div>
    </div>

    <hr style="border:1px dashed #aaa;margin:8px 0;">

    ${filas}

    <hr style="border:1px dashed #aaa;margin:8px 0;">

    <div style="text-align:right;">
      Subtotal: <b>$${subtotal.toFixed(2)}</b><br>
      Desc:     <b>$${descuento.toFixed(2)}</b><br>
      Total:    <b>$${total.toFixed(2)}</b>
    </div>

    <div style="text-align:center;margin-top:10px;font-size:11px;">
      ${datos.ticket_mensaje_final || "¡Gracias por su compra!"}
    </div>
  `;

  return div;
}

/* ============================================================
   🎟️ TICKET DIGITAL – Pantalla (SweetAlert)
============================================================ */
export async function mostrarTicket(carritoParaTicket = []) {
  window.carritoParaTicket = carritoParaTicket;

 let cfg = {};

try { cfg = await obtenerDatosNegocio(); }
catch { cfg = {}; }
const plantillaId = cfg.ticket_plantilla || "clasico";
const plantilla = obtenerPlantillaTicket(plantillaId);
const encabezado = plantilla.encabezado || {};


  const nombre = cfg.ticket_nombre_negocio || "SmartPOS";
  const direccion = cfg.ticket_direccion || "";
  const telefono = cfg.ticket_telefono || "";
  const correo = cfg.ticket_correo || "";
  const rfc = cfg.ticket_rfc || "";
  const msg = cfg.ticket_mensaje_final || "¡Gracias por su visita!";
  let logoURL = cfg.ticket_logo_url || "";

      try {
        if (typeof logoURL === "string" && logoURL.trim().startsWith("{")) {
          const obj = JSON.parse(logoURL);
          logoURL = obj.url || "";
        }
      } catch {
        logoURL = "";
      }

  const colorIconos = cfg.ventas_icono_color || "#a21caf";

  document.documentElement.style.setProperty("--color-iconos-ticket", colorIconos);

  const filas = carritoParaTicket.map(item => {
    let cant =
      item.unidad === "kg"
        ? item.cantidad < 1
            ? `${(item.cantidad * 1000).toFixed(0)} g`
            : `${item.cantidad.toFixed(3)} kg`
        : item.cantidad.toFixed(0);

    const descTxt =
      item.descuento > 0
        ? `<span class="text-fuchsia-500 text-xs">(-${item.descuento}%)</span>`
        : "";

    return `
      <div class="flex justify-between text-sm font-mono">
        <span>${item.nombre} (${cant}) ${descTxt}</span>
        <span>$${formatoMX.format(item.totalFinal)}</span>
      </div>
    `;
  }).join("");

  const folio = window.folioVentaActual || "000000";
  const fecha = new Date().toLocaleString();

  const subtotal = carritoParaTicket.reduce((s, i) => s + i.subtotal, 0);
  const descuento = carritoParaTicket.reduce((s, i) => s + (i.subtotal - i.totalFinal), 0);
  const totalFinal = carritoParaTicket.reduce((s, i) => s + i.totalFinal, 0);

  const mp = window.pagoFinal?.metodo || "efectivo";
  const pagoTotal =
    mp === "mixto"
      ? (window.pagoFinal?.efectivo || 0) + (window.pagoFinal?.tarjeta || 0)
      : window.pagoFinal?.efectivo ||
        window.pagoFinal?.tarjeta ||
        window.pagoFinal?.transferencia || 0;

  const cambio = window.pagoFinal?.cambio || 0;

  const htmlMetodo =
    mp === "mixto"
      ? `
          <div><b>Pago Mixto</b></div>
          <div class="text-xs">
            Efectivo: $${formatoMX.format(window.pagoFinal?.efectivo || 0)}<br>
            Tarjeta:  $${formatoMX.format(window.pagoFinal?.tarjeta || 0)}
          </div>`
      : `<div>Pago: <span>$${formatoMX.format(pagoTotal)}</span></div>`;

  const htmlVoucher =
    mp === "tarjeta" || (mp === "mixto" && window.pagoFinal?.tarjeta)
      ? window.pagoFinal?.voucher
        ? `<div class="text-xs mt-1">Autorización: ${window.pagoFinal.voucher}</div>`
        : ""
      : "";

// ============================================================================
// 💜 SmartPOS - tickets.js v5.0 — PARTE 2 / 2
// ============================================================================

  // Continuación del HTML del ticket digital
  const html = `
    <div class="ticket-box bg-white text-gray-800 rounded-lg shadow-xl w-[80mm] max-w-[95vw] p-4 border border-fuchsia-200">
     
      <div class="flex justify-center mb-1">
        ${logoURL ? `<img src="${logoURL}" class="h-10">` : ""}
      </div>

      <div class="text-center text-sm mb-2 font-mono">
        <strong>${nombre}</strong><br>
      ${direccion ? `${encabezado.direccion || ""} ${direccion}<br>` : ""}
      ${telefono ? `${encabezado.telefono || ""} ${telefono}<br>` : ""}
      ${correo ? `${encabezado.correo || ""} ${correo}<br>` : ""}
      ${rfc ? `${encabezado.rfc || ""} ${rfc}<br>` : ""}
      </div>

      <div class="flex justify-between text-xs font-mono mb-1">
        <span><b>Folio:</b> <span id="ticketFolio">${folio}</span></span>
        <span><b>Fecha:</b> <span id="ticketFecha">${fecha}</span></span>
      </div>

      <div class="text-center my-2 font-mono">
        ${plantilla.separador}
      </div>

      <div class="space-y-1 text-sm max-h-[240px] overflow-y-auto font-mono">
        ${filas}
      </div>

      <div class="text-center my-2 font-mono">
        ${plantilla.separador}
      </div>

      <div class="text-right text-sm font-mono space-y-1">

        <div>Subtotal:
          <span class="font-bold">$${formatoMX.format(subtotal)}</span>
        </div>

        <div class="text-fuchsia-600">
          Descuento:
          <span class="font-bold">-$${formatoMX.format(descuento)}</span>
        </div>

        <div>Total Final:
          <span class="text-fuchsia-600 font-bold">
            $${formatoMX.format(totalFinal)}
          </span>
        </div>

        ${htmlMetodo}

        <div>Cambio:
          <span>$${formatoMX.format(cambio)}</span>
        </div>
      </div>

      ${htmlVoucher}

      <div class="mt-3 text-xs italic text-center text-gray-600">
        ${plantilla.mensaje}
      </div>

      <div class="no-export mt-4 flex justify-center gap-3">
        <button id="btnDescargar" class="p-2 text-white rounded-full" style="background:${colorIconos}">
          <i data-lucide="file-down"></i>
        </button>

        <button id="btnCorreo" class="p-2 text-white rounded-full" style="background:${colorIconos}">
          <i data-lucide="mail"></i>
        </button>

        <button id="btnWhatsApp" class="p-2 text-white rounded-full" style="background:${colorIconos}">
          <i data-lucide="phone"></i>
        </button>
      </div>

    </div>
  `;

  window.__ULTIMO_TICKET_HTML = html; 

  await Swal.fire({
    html,
    width: 420,
    background: "transparent",
    showConfirmButton: false,
    showCloseButton: true,
    allowOutsideClick: false,
    customClass: {
      popup: "shadow-2xl rounded-xl p-0 bg-white"
    },
    didOpen: async () => {
  lucide.createIcons();

  const envio = await import("/js/venta/envios.js");

  // 📸 DESCARGAR TICKET COMO IMAGEN PNG (html2canvas)
  qs("#btnDescargar")?.addEventListener("click", async () => {
    const box = qs(".ticket-box");
    if (!box) return;

    const canvas = await html2canvas(box, { scale: 3 });
    const url = canvas.toDataURL("image/png");

    const folio = window.folioVentaActual || "ticket";

    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket_${folio}.png`;
    a.click();
  });

  // 📧 ENVIAR POR EMAIL (EmailJS)
  qs("#btnCorreo")?.addEventListener("click", () =>
    envio.enviarCorreoLink(
      window.clienteSeleccionado?.correo,
      window.carritoParaTicket
    )
  );

  // 💬 ENVIAR POR WHATSAPP (solo link)
  qs("#btnWhatsApp")?.addEventListener("click", () =>
    envio.enviarWhatsApp(window.carritoParaTicket)
  );
}

  });
}

export async function descargarPNG() {
  try {
    const ticket = document.querySelector(".ticket-box");
    if (!ticket) return Swal.fire("Error", "No se encontró el ticket", "error");

    const canvas = await html2canvas(ticket, { scale: 3 });
    const url = canvas.toDataURL("image/png");

    const folio = window.folioVentaActual || "ticket";

    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket_${folio}.png`;
    a.click();
  } catch (err) {
    console.error("❌ Error guardando PNG:", err);
    Swal.fire("Error", "No se pudo guardar la imagen del ticket", "error");
  }
}


/* ============================================================
   🖨️ IMPRESIÓN DIRECTA (PDF + LOGO)
============================================================ */
export async function simularImpresion(carritoParaTicket = [], soloPreview = false) {
  try {
    const { jsPDF } = window.jspdf;
    const cfg = await obtenerDatosNegocio();

    const pdf = new jsPDF({
      unit: "mm",
      format: [80, 80], // 🔥 más alto para logo
    });

    let y = 8;

    const expandir = (mm = 6) => {
      const h = pdf.internal.pageSize.height;
      if (y + mm > h - 10) pdf.internal.pageSize.height = h + mm + 10;
    };

    /* ---------------- LOGO ---------------- */
    let logoURL = cfg.ticket_logo_url || "";
    try {
      if (typeof logoURL === "string" && logoURL.startsWith("{")) {
        logoURL = JSON.parse(logoURL).url || "";
      }
    } catch {}

    if (logoURL) {
      const logo64 = await cargarLogoParaPDF(logoURL);
      if (logo64) {
        pdf.addImage(logo64, "PNG", 25, y, 30, 15); // centrado
        y += 18;
      }
    }

    /* ------------ NOMBRE NEGOCIO ----------- */
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(cfg.ticket_nombre_negocio || "SMARTPOS", 40, y, { align: "center" });
    y += 6;

    /* ------------ DATOS NEGOCIO ------------ */
    pdf.setFontSize(8);
    const lines = [
      cfg.ticket_direccion,
      cfg.ticket_telefono ? `Tel: ${cfg.ticket_telefono}` : "",
      cfg.ticket_correo,
      cfg.ticket_rfc ? `RFC: ${cfg.ticket_rfc}` : ""
    ].filter(Boolean);

    lines.forEach(l => {
      expandir(4);
      pdf.text(l, 40, y, { align: "center" });
      y += 4;
    });

    y += 3;
    pdf.line(5, y, 75, y); y += 6;

    const folio = qs("#ticketFolio")?.textContent || "---";
    const fecha = qs("#ticketFecha")?.textContent || "";

    pdf.text(`Folio: ${folio}`, 5, y); y += 4;
    pdf.text(`Fecha: ${fecha}`, 5, y); y += 6;

    /* ------------ PRODUCTOS --------------- */
    y += 2;
    pdf.line(5, y, 75, y); y += 4;
    pdf.text("Descripción                  Importe", 5, y); y += 5;
    pdf.line(5, y, 75, y); y += 6;

    pdf.setFont("helvetica", "normal");

    carritoParaTicket.forEach(item => {
      expandir(5);

      const cant =
        item.unidad === "kg"
          ? item.cantidad < 1
            ? `${(item.cantidad * 1000).toFixed(0)} g`
            : `${item.cantidad.toFixed(3)} kg`
          : item.cantidad.toFixed(0);

      const txt = `${item.nombre} (${cant}) $${item.totalFinal.toFixed(2)}`;
      pdf.text(txt.slice(0, 27), 5, y);
      y += 5;
    });

    /* ------------ TOTALES ---------------- */
    y += 3;
    pdf.line(5, y, 75, y); y += 6;

    const subtotal = carritoParaTicket.reduce((s, i) => s + i.subtotal, 0);
    const desc = carritoParaTicket.reduce((s, i) => s + (i.subtotal - i.totalFinal), 0);
    const total = carritoParaTicket.reduce((s, i) => s + i.totalFinal, 0);

    pdf.setFont("helvetica", "bold");
    pdf.text(`SUBTOTAL: $${formatoMX.format(subtotal)}`, 75, y, { align: "right" }); y += 5;
    pdf.text(`DESC:     -$${formatoMX.format(desc)}`, 75, y, { align: "right" }); y += 5;
    pdf.text(`TOTAL:    $${formatoMX.format(total)}`, 75, y, { align: "right" }); y += 8;

    /* ----------- MENSAJE FINAL ------------ */
    pdf.line(5, y, 75, y); y += 5;

    const wrapped = pdf.splitTextToSize(
      cfg.ticket_mensaje_final || "¡Gracias por su compra!",
      65
    );

    wrapped.forEach(line => {
      expandir(4);
      pdf.text(line, 40, y, { align: "center" });
      y += 4;
    });

    pdf.internal.pageSize.height = y + 10;

    if (soloPreview) return pdf;

    pdf.autoPrint();
    window.printJS(pdf.output("bloburl"));

  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudo imprimir el ticket.", "error");
  }
}

window.mostrarTicketTermico = mostrarTicketTermico;
window.mostrarTicket = mostrarTicket;

