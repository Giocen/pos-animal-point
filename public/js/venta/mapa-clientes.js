import { supabaseClient } from "/js/proteccion.js";
const Swal = window.Swal;

export async function abrirMapaClientes() {
  const negocio_id = localStorage.getItem("negocio_id");

  if (!negocio_id) {
    Swal.fire("Error", "Negocio no identificado", "error");
    return;
  }

  const { data: pedidos, error } = await supabaseClient
    .from("pedidos")
    .select("cliente_nombre, cliente_direccion")
    .eq("negocio_id", negocio_id)
    .eq("estado", "pendiente")
    .not("cliente_direccion", "is", null);

  if (error) {
    Swal.fire("Error", "No se pudieron cargar las direcciones", "error");
    return;
  }

  if (!pedidos.length) {
    Swal.fire("Sin rutas", "No hay direcciones pendientes", "info");
    return;
  }

  Swal.fire({
    title: "🗺️ Direcciones de entrega",
    width: 500,
    showConfirmButton: false,
    html: `
      <div class="space-y-2 max-h-80 overflow-auto">
        ${pedidos.map(p => `
          <div class="border rounded-lg p-3 hover:bg-blue-50 transition">
            <div class="font-semibold">${p.cliente_nombre || "Cliente"}</div>
            <div class="text-sm text-gray-600 mt-1">${p.cliente_direccion}</div>
            <button
              class="underline text-blue-600 mt-2 btn-mapa"
              data-dir="${encodeURIComponent(p.cliente_direccion)}">
              📍 Abrir en mapa
            </button>
          </div>
        `).join("")}
      </div>
    `,
    didOpen: () => {
      document.querySelectorAll(".btn-mapa").forEach(btn => {
        btn.addEventListener("click", () => {
          const dir = btn.dataset.dir;
          window.open(
            `https://www.google.com/maps/search/?api=1&query=${dir}`,
            "_blank"
          );
        });
      });
    }
  });
}
