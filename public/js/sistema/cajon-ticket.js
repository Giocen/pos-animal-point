// 💜 SmartPOS - Apertura física del cajón mediante ticket ESC/POS (v2.0 Multi-Negocio)
// --------------------------------------------------------------------------------------
// ✔ Lógica ORIGINAL intacta
// ✔ Solo se agrega validación de configuración multi-negocio
// ✔ Compatible con ventas, corte y módulos actuales

import { LocalDB } from "../localdb.js";

/**
 * 🟣 ABRIR CAJÓN enviando un ticket ESC/POS
 * Este método se usa cuando la impresora sí interpreta comandos ESC/POS
 */
export function abrirCajonPorTicket() {
  try {
    // 🟪 Obtener configuración del negocio actual
    let conf = window.configVentas || LocalDB.get("config_ventas");

    if (!conf) {
      const fallback = JSON.parse(localStorage.getItem("config_ventas") || "{}");
      conf = fallback;
    }

    // 🛑 Verificar si caja está activada para este negocio
    const cajaActiva =
      conf?.ventas_caja_activa === true ||
      String(conf?.ventas_caja_activa).toLowerCase() === "true";

    const impresoraActiva =
      conf?.ventas_impresora_activa === true ||
      String(conf?.ventas_impresora_activa).toLowerCase() === "true";

    if (!cajaActiva) {
      console.log("🚫 Cajón está desactivado para este negocio → no se abre.");
      return;
    }

    if (!impresoraActiva) {
      console.log("🚫 Impresora desactivada → No se puede enviar ESC/POS.");
      Swal?.fire({
        icon: "info",
        title: "Impresora desactivada",
        text: "Activa la impresora en Configuración → Ventas.",
        background: "#fff",
        confirmButtonColor: "#a21caf",
        customClass: { popup: "card-3d" },
      });
      return;
    }

    // -------------------------------------------------------------------
    // 🟣 PROCEDER A ABRIR EL CAJÓN ENVIANDO EL COMANDO ESC/POS
    // -------------------------------------------------------------------

    const win = window.open("", "_blank");

    if (!win) {
      alert("Activa las ventanas emergentes para usar apertura de cajón");
      return;
    }

    // 🔌 Comando ESC/POS para abrir el cajón físicamente
    const comando = `
      <html>
        <body>
          <pre style="font-size:10px;">
${String.fromCharCode(27)}p0${String.fromCharCode(55)}${String.fromCharCode(121)}
Apertura Cajón SmartPOS
          </pre>
          <script>
            window.print();
            setTimeout(() => window.close(), 500);
          <\/script>
        </body>
      </html>
    `;

    win.document.write(comando);
    win.document.close();

    console.log("📦 Cajón abierto mediante ticket ESC/POS (multi-negocio)");

  } catch (err) {
    console.error("❌ Error abriendo cajón por ticket:", err);
    Swal?.fire({
      icon: "error",
      title: "Error al abrir cajón",
      text: err.message || "Error inesperado.",
      background: "#fff",
      confirmButtonColor: "#a21caf",
      customClass: { popup: "card-3d" }
    });
  }
}
