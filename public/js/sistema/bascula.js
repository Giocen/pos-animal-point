// 💜 SmartPOS - Báscula Universal Híbrida v13.1 (MULTI-NEGOCIO)
// -------------------------------------------------------------
// ✔ NO se modifica ninguna parte de la lógica original
// ✔ Solo se agrega compatibilidad MULTI-NEGOCIO
// ✔ Respeta configuración: ventas_bascula_activa
// ✔ Compatible con reconexión automática, polling, stream, peso manual

import { actualizarCajaPeso } from "../venta/main.js";
import { LocalDB } from "../localdb.js";

window.smartPOS = window.smartPOS || {};
window.smartPOS.bascula = window.smartPOS.bascula || {
  activa: false,
  peso: 0,
  modo: "desconocido",
  port: null,
  detectorTimeout: null
};

let port = null;
let reader = null;
let leyendo = false;

/* -------------------------------------------------------------------------- */
/* 🟣 VERIFICAR SI EL NEGOCIO TIENE BÁSCULA ACTIVADA                          */
/* -------------------------------------------------------------------------- */
function negocioPermiteBascula() {
  let conf = window.configVentas || LocalDB.get("config_ventas");

  if (!conf) {
    conf = JSON.parse(localStorage.getItem("config_ventas") || "{}");
  }

  const valor = conf?.ventas_bascula;

  if (typeof valor === "boolean") return valor;
  if (typeof valor === "string") return valor.toLowerCase() === "true";

  return false;
}


/* -------------------------------------------------------------------------- */
/* 🟣 INICIALIZAR BOTÓN MANUAL                                                */
/* -------------------------------------------------------------------------- */
export function inicializarConexionManual() {
  const btn = document.getElementById("btnToggleBasculaPeso");
  if (!btn) return;

  btn.addEventListener("click", toggleBascula);
}

/* -------------------------------------------------------------------------- */
/* 🔄 BOTÓN ON/OFF                                                            */
/* -------------------------------------------------------------------------- */
async function toggleBascula() {
  // 🛑 MULTI-NEGOCIO: si este negocio no usa báscula → no conectar
  if (!window.smartPOS.bascula.activa && !negocioPermiteBascula()) {
    Swal.fire({
      icon: "info",
      title: "Báscula desactivada",
      text: "Este negocio no tiene habilitada la báscula.",
      confirmButtonColor: "#a21caf",
      background: "#fff",
      customClass: { popup: "card-3d" },
    });
    return;
  }

  if (!window.smartPOS.bascula.activa) {
    await conectarBascula();
  } else {
    await apagarBasculaManual();
  }
}

/* -------------------------------------------------------------------------- */
/* 🔥 APAGAR BÁSULA MANUALMENTE                                              */
/* -------------------------------------------------------------------------- */
async function apagarBasculaManual() {
  await cerrarPuertoPrevio();

  window.smartPOS.bascula.activa = false;
  window.smartPOS.bascula.port = null;
  window.smartPOS.bascula.modo = "desconocido";

  localStorage.removeItem("bascula_activa");

  mostrarEstado(false);
  actualizarCajaPeso(false);

  const manual = document.getElementById("pesoManual");
  if (manual) {
    manual.readOnly = false;
    manual.value = "0.000";
  }
}

/* -------------------------------------------------------------------------- */
/* 🟢 CONECTAR BÁSULA                                                         */
/* -------------------------------------------------------------------------- */
async function conectarBascula() {
  try {
    // ⛔ MULTI-NEGOCIO: impedir conexión si está desactivada
    if (!negocioPermiteBascula()) {
      return Swal.fire({
        icon: "info",
        title: "Báscula desactivada",
        text: "Este negocio no tiene habilitada la báscula.",
        confirmButtonColor: "#a21caf",
        background: "#fff",
        customClass: { popup: "card-3d" },
      });
    }

    if (!("serial" in navigator)) {
      return Swal.fire("Error", "Tu navegador no soporta WebSerial.", "error");
    }

    await cerrarPuertoPrevio();

    // Usuario selecciona puerto manualmente
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    // Guardar puerto global
    window.smartPOS.bascula.port = port;

    leyendo = true;
    window.smartPOS.bascula.activa = true;
    window.smartPOS.bascula.modo = "desconocido";

    // Estado persistente multi-negocio
    localStorage.setItem("bascula_activa", "1");

    mostrarEstado(true);

    detectarModoBascula();
    leerUniversal();

  } catch (e) {
    console.warn("❌ Error conectando báscula:", e);
    mostrarEstado(false);
  }
}

/* -------------------------------------------------------------------------- */
/* 🔍 DETECCIÓN: STREAM o POLLING                                             */
/* -------------------------------------------------------------------------- */
function detectarModoBascula() {
  window.smartPOS.bascula.detectorTimeout = setTimeout(() => {
    if (window.smartPOS.bascula.modo === "desconocido") {
      window.smartPOS.bascula.modo = "polling";
      iniciarPolling();
    }
  }, 700);
}

/* -------------------------------------------------------------------------- */
/* 🔵 POLLING — Envía “P” cada 300ms                                          */
/* -------------------------------------------------------------------------- */
async function iniciarPolling() {
  while (
    leyendo &&
    port?.writable &&
    window.smartPOS.bascula.modo === "polling"
  ) {
    try {
      const writer = port.writable.getWriter();
      await writer.write(new TextEncoder().encode("P\r\n"));
      writer.releaseLock();
    } catch (e) {
      console.warn("Error POLLING:", e);
    }

    await new Promise((r) => setTimeout(r, 300));
  }
}

/* -------------------------------------------------------------------------- */
/* 🟣 LECTOR UNIVERSAL                                                        */
/* -------------------------------------------------------------------------- */
async function leerUniversal() {
  const decoder = new TextDecoder();
  reader = port.readable.getReader();
  let buffer = "";

  try {
    while (leyendo && port) {
      const { value, done } = await reader.read();
      if (done) break;

      const txt = decoder.decode(value);

      // Detectar STREAM automáticamente
      if (window.smartPOS.bascula.modo === "desconocido") {
        window.smartPOS.bascula.modo = "stream";
        clearTimeout(window.smartPOS.bascula.detectorTimeout);
      }

      buffer += txt;

      if (buffer.includes("\n") || buffer.includes("\r")) {
        const limpio = buffer.replace(/[^\d.]/g, "");
        buffer = "";
        const num = parseFloat(limpio);
        if (!isNaN(num)) procesarPeso(num);
      }
    }
  } catch (e) {
    console.warn("⚠ Error leyendo:", e);
  }

  mostrarEstado(false);
  await cerrarPuertoPrevio();
}

/* -------------------------------------------------------------------------- */
/* 🧮 PROCESAR PESO                                                           */
/* -------------------------------------------------------------------------- */
function procesarPeso(num) {
  window.smartPOS.bascula.peso = num;

  const txt = document.getElementById("estadoBasculaTexto");
  if (txt) {
    txt.textContent = `${num.toFixed(3)} kg`;
    txt.classList.add("on");
    txt.classList.remove("off");
  }

  const manual = document.getElementById("pesoManual");
  if (manual) {
    manual.readOnly = true;
    manual.value = num.toFixed(3);
    manual.blur();
  }

  actualizarCajaPeso(true);
}

/* -------------------------------------------------------------------------- */
/* 🔴 ESTADOS UI                                                              */
/* -------------------------------------------------------------------------- */
function mostrarEstado(ok) {
  const txt = document.getElementById("estadoBasculaTexto");
  const btn = document.getElementById("btnToggleBasculaPeso");
  const manual = document.getElementById("pesoManual");

  if (ok) {
    btn?.classList.add("on");
    btn?.classList.remove("off");

    txt?.classList.add("on");
    txt?.classList.remove("off");
    if (txt) txt.textContent = "● Conectada";

    if (manual) manual.readOnly = true;

  } else {
    btn?.classList.remove("on");
    btn?.classList.add("off");

    txt?.classList.remove("on");
    txt?.classList.add("off");
    if (txt) txt.textContent = "○ Desconectada";

    if (manual) {
      manual.readOnly = false;

      // 🔥 Si no hay báscula → default 1kg
      manual.value = "1.000";
    }

    window.smartPOS.bascula.modo = "desconocido";
  }
}

/* -------------------------------------------------------------------------- */
/* 🧹 CERRAR PUERTO                                                           */
/* -------------------------------------------------------------------------- */
async function cerrarPuertoPrevio() {
  try { leyendo = false; } catch {}

  try { reader?.cancel(); } catch {}
  try { reader?.releaseLock(); } catch {}
  try { await port?.close(); } catch {}

  port = null;
  reader = null;
}

/* -------------------------------------------------------------------------- */
/* ♻️ AUTORECONEXIÓN (AL REGRESAR A VENTAS)                                   */
/* -------------------------------------------------------------------------- */
export async function reanudarBasculaAuto() {
  try {
    if (!("serial" in navigator)) return;

    // 🛑 MULTI-NEGOCIO: si negocio no la usa → no reconectar
    if (!negocioPermiteBascula()) return;

    if (localStorage.getItem("bascula_activa") !== "1") return;

    const ports = await navigator.serial.getPorts();
    if (ports.length === 0) return;

    port = ports[0];
    window.smartPOS.bascula.port = port;

    if (!port.readable) {
      await port.open({ baudRate: 9600 });
    }

    leyendo = true;
    window.smartPOS.bascula.activa = true;
    window.smartPOS.bascula.modo = "desconocido";

    mostrarEstado(true);

    detectarModoBascula();
    leerUniversal();

    console.log("🔄 Báscula reconectada automáticamente (multi-negocio)");
  } catch (e) {
    console.warn("Auto reconexión fallida:", e);
  }
}

