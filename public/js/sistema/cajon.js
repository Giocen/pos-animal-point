// 💜 SmartPOS - Módulo de Apertura de Cajón POS (v2.1 Multi-Negocio)
// ---------------------------------------------------------------------------
// ⚙️ Lógica original intacta
// 🔥 Solo se mejoró la obtención de configuración por negocio
// 🔊 Simula apertura del cajón sin QZ-Tray

import { LocalDB } from "../localdb.js";

/* -------------------------------------------------------------------------- */
/* 💵 ABRIR CAJÓN (modo normal, respeta configuración de ventas)              */
/* -------------------------------------------------------------------------- */
export async function abrirCajon() {
  try {
    // 🟣 Obtener config por negocio actual
    let conf = window.configVentas || LocalDB.get("config_ventas");

    // Si no llega desde LocalDB, tomar de localStorage como fallback
    if (!conf) {
      const local = JSON.parse(localStorage.getItem("config_ventas") || "{}");
      conf = local;
    }

    const cajaActiva =
      conf?.ventas_caja_activa === true ||
      String(conf?.ventas_caja_activa).toLowerCase() === "true";

    // 🚫 Si está desactivado para este negocio → no abre
    if (!cajaActiva) {
      console.log("💤 Caja desactivada → no se abre cajón (modo ventas).");
      return;
    }

    // 💡 Simular apertura visual + sonido
    await simularAperturaCaja("💵 Cajón abierto correctamente");

  } catch (err) {
    console.error("❌ Error abriendo cajón:", err);
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
/* 💰 ABRIR CAJÓN (modo corte/arqueo — forzado, ignora configuración)         */
/* -------------------------------------------------------------------------- */
export async function abrirCajonCorte() {
  try {
    await simularAperturaCaja("💰 Cajón abierto (modo corte)");
  } catch (err) {
    console.error("❌ Error abriendo cajón (corte):", err);
    Swal.fire({
      icon: "error",
      title: "No se pudo abrir el cajón",
      text: err.message || "Error simulando la apertura del cajón.",
      confirmButtonColor: "#a21caf",
      background: "#fff",
      customClass: { popup: "card-3d" },
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 🔊 Simulación realista con beep + alerta visual                            */
/* -------------------------------------------------------------------------- */
async function simularAperturaCaja(mensaje = "💵 Cajón abierto") {
  try {
    // 🔊 Sonido tipo "click" / apertura
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.value = 180;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);

    // 💜 Toast visual elegante
    Toastify({
      text: mensaje,
      duration: 1600,
      gravity: "top",
      position: "right",
      style: {
        background: "linear-gradient(90deg,#22c55e,#16a34a)",
        color: "#fff",
        borderRadius: "0.5rem",
        fontWeight: "600",
        boxShadow: "4px 4px 8px rgba(0,0,0,0.25)",
      },
    }).showToast();

    // ✨ Alerta rápida de confirmación
    Swal.fire({
      icon: "success",
      title: "Cajón abierto (simulado)",
      text: "Operación completada correctamente.",
      timer: 1400,
      showConfirmButton: false,
      background: "#fff",
      customClass: { popup: "card-3d" },
    });

  } catch (e) {
    console.warn("⚠️ Error durante simulación del cajón:", e);
  }
}
