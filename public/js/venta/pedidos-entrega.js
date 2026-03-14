import { supabaseClient } from "/js/proteccion.js";

const Swal = window.Swal;

/* =========================================================
   🚚 Abrir pedidos pendientes de entrega
========================================================= */
export async function abrirPedidosEntrega() {
  const negocio_id = localStorage.getItem("negocio_id");

  if (!negocio_id) {
    Swal.fire("Error", "Negocio no identificado", "error");
    return;
  }

  const { data: pedidos, error } = await supabaseClient
    .from("pedidos")
    .select(`
      id,
      cliente_nombre,
      cliente_telefono,
      cliente_direccion,
      total,
      estado,
      fecha
    `)
    .eq("negocio_id", negocio_id)
    .eq("estado", "pendiente")
    .order("fecha", { ascending: true });

  if (error) {
    console.error(error);
    Swal.fire("Error", "No se pudieron cargar los pedidos", "error");
    return;
  }

  if (!pedidos || pedidos.length === 0) {
    Swal.fire("Sin pedidos", "No hay pedidos pendientes por entregar", "info");
    return;
  }

  Swal.fire({
    title: "🚚 Pedidos por entregar",
    width: 560,
    showConfirmButton: false,
    showCloseButton: true,
    html: `
      <div class="space-y-2 max-h-96 overflow-auto">
        ${pedidos.map(p => `
          <div class="border rounded-xl p-3 hover:bg-emerald-50 transition">
            <div class="font-semibold text-gray-800">
              ${p.cliente_nombre || "Cliente sin nombre"}
            </div>

            <div class="text-xs text-gray-500 mt-1">
              📅 ${new Date(p.fecha).toLocaleDateString()}
            </div>

            <div class="text-sm text-gray-600 mt-1">
              💵 Total: <b>$${Number(p.total).toFixed(2)}</b>
            </div>

            ${p.cliente_direccion ? `
              <div class="text-xs text-gray-500 mt-1">
                📍 ${p.cliente_direccion}
              </div>` : ""}

            <div class="flex gap-4 mt-3 text-sm">
              <button class="btn-ver underline text-blue-600" data-id="${p.id}">
                Ver detalle
              </button>

              <button class="btn-entregar underline text-emerald-600" data-id="${p.id}">
                ✔ Entregar
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `,
    didOpen: () => {
      document.querySelectorAll(".btn-ver").forEach(btn => {
        btn.addEventListener("click", () => verDetallePedido(btn.dataset.id));
      });

      document.querySelectorAll(".btn-entregar").forEach(btn => {
        btn.addEventListener("click", () => confirmarEntrega(btn.dataset.id));
      });
    }
  });
}

/* =========================================================
   🔍 Detalle del pedido (Mapa + WhatsApp + Entregar)
========================================================= */
async function verDetallePedido(id) {
  const negocio_id = localStorage.getItem("negocio_id");

  const { data: pedido, error } = await supabaseClient
    .from("pedidos")
    .select(`
      id,
      cliente_nombre,
      cliente_telefono,
      cliente_direccion,
      total,
      estado,
      fecha,
      fecha_entrega
    `)
    .eq("id", id)
    .eq("negocio_id", negocio_id)
    .single();

  if (error || !pedido) {
    Swal.fire("Error", "No se pudo cargar el pedido", "error");
    return;
  }

  Swal.fire({
    title: "📦 Detalle de pedido",
    width: 420,
    showCloseButton: true,
    showConfirmButton: false,
    html: `
      <div class="text-left space-y-2 text-sm">

        <p><b>👤 Cliente:</b><br>${pedido.cliente_nombre || "-"}</p>
        <p><b>📞 Teléfono:</b><br>${pedido.cliente_telefono || "-"}</p>
        <p><b>📍 Dirección:</b><br>${pedido.cliente_direccion || "-"}</p>

        <p><b>💵 Total:</b> $${Number(pedido.total).toFixed(2)}</p>
        <p><b>📅 Fecha:</b><br>${new Date(pedido.fecha).toLocaleString()}</p>

        <p><b>📦 Estado:</b>
          <span style="color:${pedido.estado === "entregado" ? "#16a34a" : "#f59e0b"}">
            ${pedido.estado.toUpperCase()}
          </span>
        </p>

        <div class="flex gap-4 pt-3">
          ${pedido.cliente_direccion ? `
            <button id="btnMapa" class="underline text-blue-600">📍 Mapa</button>
          ` : ""}

          ${pedido.cliente_telefono ? `
            <button id="btnWhats" class="underline text-green-600">📲 WhatsApp</button>
          ` : ""}

          ${pedido.estado !== "entregado" ? `
            <button id="btnEntregarDetalle" class="underline text-emerald-600">
              ✔ Entregar
            </button>
          ` : ""}
        </div>
      </div>
    `,
    didOpen: () => {
      document.getElementById("btnMapa")?.addEventListener("click", () => {
        window.open(
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            pedido.cliente_direccion
          )}`,
          "_blank"
        );
      });

      document.getElementById("btnWhats")?.addEventListener("click", () => {
        const tel = pedido.cliente_telefono.replace(/\D/g, "");
        const msg = `Hola ${pedido.cliente_nombre}, vamos en camino con tu pedido 🚚`;
        window.open(
          `https://wa.me/52${tel}?text=${encodeURIComponent(msg)}`,
          "_blank"
        );
      });

      document.getElementById("btnEntregarDetalle")?.addEventListener("click", () => {
        Swal.close(); // 🔥 cerrar detalle
        confirmarEntrega(pedido.id);
      });
    }
  });
}

/* =========================================================
   ❓ Confirmar entrega
========================================================= */
async function confirmarEntrega(id) {
  const res = await Swal.fire({
    icon: "question",
    title: "¿Confirmar entrega?",
    showCancelButton: true,
    confirmButtonText: "Sí, entregar",
    cancelButtonText: "Cancelar"
  });

  if (!res.isConfirmed) return;

  await marcarEntregado(id);
}

/* =========================================================
   ✅ Marcar pedido como entregado (FINAL)
========================================================= */
async function marcarEntregado(id) {
  const negocio_id = localStorage.getItem("negocio_id");

  const { error } = await supabaseClient
    .from("pedidos")
    .update({
      estado: "entregado",
      fecha_entrega: new Date().toISOString()
    })
    .eq("id", id)
    .eq("negocio_id", negocio_id);

  if (error) {
    console.error(error);
    Swal.fire("Error", "No se pudo marcar como entregado", "error");
    return;
  }

  await Swal.fire({
    icon: "success",
    title: "Pedido entregado",
    timer: 1200,
    showConfirmButton: false
  });

  abrirPedidosEntrega(); // 🔁 refresca limpio
}
