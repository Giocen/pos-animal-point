// ============================================================================
// 💜 SmartPOS – Crear Pedido Manual
// ============================================================================

import { supabaseClient } from "/js/proteccion.js";

const Swal = window.Swal;

export async function crearPedidoManual(cliente = {}) {
  const negocio_id = localStorage.getItem("negocio_id");

  if (!negocio_id) {
    Swal.fire("Error", "Negocio no identificado", "error");
    return;
  }

  const { value: form } = await Swal.fire({
    title: "📦 Crear pedido",
    width: 420,
    showCancelButton: true,
    confirmButtonText: "Guardar pedido",
    cancelButtonText: "Cancelar",
    html: `
      <input id="pNombre" class="swal2-input" placeholder="Nombre cliente"
        value="${cliente.nombre || ""}">

      <input id="pTelefono" class="swal2-input" placeholder="Teléfono"
        value="${cliente.telefono || ""}">

      <input id="pDireccion" class="swal2-input" placeholder="Dirección"
        value="${cliente.direccion || ""}">

      <input id="pTotal" type="number" min="0" step="0.01"
        class="swal2-input" placeholder="Total del pedido">
    `,
    preConfirm: () => {
      const nombre = document.getElementById("pNombre").value.trim();
      const telefono = document.getElementById("pTelefono").value.trim();
      const direccion = document.getElementById("pDireccion").value.trim();
      const total = Number(document.getElementById("pTotal").value);

      if (!nombre) return Swal.showValidationMessage("Nombre requerido");
      if (!total || total <= 0)
        return Swal.showValidationMessage("Total inválido");

      return { nombre, telefono, direccion, total };
    }
  });

  if (!form) return;

  const payload = {
    cliente_id: cliente.id || null,
    cliente_nombre: form.nombre,
    cliente_telefono: form.telefono,
    cliente_direccion: form.direccion,
    total: form.total,
    negocio_id,
    estado: "pendiente"
  };

  const { error } = await supabaseClient
    .from("pedidos")
    .insert([payload]);

  if (error) {
    console.error(error);
    Swal.fire("Error", "No se pudo crear el pedido", "error");
    return;
  }

  Swal.fire("Pedido creado", "El pedido quedó pendiente de entrega", "success");
}
