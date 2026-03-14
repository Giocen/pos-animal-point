// ======================================================================
// 💜 SmartPOS - utilidades.js (Cliente + Formato MX + Cache Multinegocio)
// Version 2025 FINAL
// ======================================================================

// --------------------------------------------------------
// 🔹 Cliente actual en memoria
// --------------------------------------------------------
export let clienteSeleccionado = null;

// --------------------------------------------------------
// 🔹 Formateador MX a 2 decimales
// --------------------------------------------------------
export const formatoMX = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// Exponer formateador global
window.formatoMX = formatoMX;

// --------------------------------------------------------
// 🔹 Almacenar cliente POR NEGOCIO
// --------------------------------------------------------
function getCacheKey() {
  const negocioID =
    window.usuarioActual?.negocio_id ||
    localStorage.getItem("negocio_id") ||
    "default";

  return `smartpos_cliente_actual_${negocioID}`;
}

function guardarClienteLocal() {
  try {
    localStorage.setItem(getCacheKey(), JSON.stringify(clienteSeleccionado));
  } catch (err) {
    console.warn("⚠️ No se pudo guardar cliente local:", err);
  }
}

// --------------------------------------------------------
// 🟣 GETTER / SETTER REACTIVO PARA window.clienteSeleccionado
// --------------------------------------------------------
Object.defineProperty(window, "clienteSeleccionado", {
  get() {
    return clienteSeleccionado;
  },
  set(value) {
    clienteSeleccionado = value;
    guardarClienteLocal();
  }
});

// --------------------------------------------------------
// 🔹 Restaurar cliente al cargar módulo
// --------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  try {
    const cache = localStorage.getItem(getCacheKey());
    if (!cache) return;

    const cliente = JSON.parse(cache);
    if (!cliente) return;

    clienteSeleccionado = cliente;

    console.log("👤 Cliente restaurado:", cliente.nombre || cliente.telefono);
  } catch (err) {
    console.warn("⚠️ No se pudo restaurar cliente:", err);
  }
});

// --------------------------------------------------------
// 🔹 Borrar cliente al finalizar venta
// --------------------------------------------------------
window.addEventListener("ventaFinalizada", () => {
  try {
    localStorage.removeItem(getCacheKey());
  } catch {}
});

// --------------------------------------------------------
// 🔥 Alerta genérica de error
// --------------------------------------------------------
export function mostrarError(titulo, mensaje) {
  return Swal.fire({
    icon: "error",
    title: titulo,
    text: mensaje,
    confirmButtonText: "Aceptar",
    background: "#fff",
    customClass: { popup: "card-3d" },
  });
}
