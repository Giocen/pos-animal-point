// 🚚 SmartPOS – Ruta de Entrega (Clientes)
// ✔ Multi-negocio
// ✔ Independiente de ventas
// ✔ WhatsApp + Mapa
// ✔ Sin tablas nuevas

import { supabaseClient } from "/js/proteccion.js";

/* =========================================================
   📦 Abrir ruta de entrega (CLIENTES)
========================================================= */
export async function abrirRutaEntrega() {
  const negocio_id = localStorage.getItem("negocio_id");

  if (!negocio_id) {
    Swal.fire("Error", "Negocio no identificado", "error");
    return;
  }

  const { data: clientes, error } = await supabaseClient
    .from("clientes")
    .select("id, nombre, telefono, direccion, ultima_entrega, created_at")
    .eq("negocio_id", negocio_id)
    .order("created_at", { ascending: true });

  if (error) {
    Swal.fire("Error", "No se pudieron cargar las entregas", "error");
    return;
  }

  if (!clientes?.length) {
    Swal.fire("Sin entregas", "No hay clientes registrados para entrega", "info");
    return;
  }

  Swal.fire({
    title: "🚚 Ruta de entrega",
    width: 560,
    showConfirmButton: false,
    html: `
      <div class="space-y-2 max-h-[70vh] overflow-auto">
        ${clientes.map(c => `
          <div class="border rounded-xl p-3 hover:bg-emerald-50 transition">
            <div class="font-semibold text-gray-800">
              ${c.nombre}
            </div>

            ${c.direccion ? `
              <div class="text-xs text-gray-500 mt-1">
                📍 ${c.direccion}
              </div>` : ""}

            ${c.telefono ? `
              <div class="text-xs text-gray-500 mt-1">
                📞 ${c.telefono}
              </div>` : ""}

            ${c.ultima_entrega ? `
              <div class="text-xs text-emerald-600 mt-1">
                ✅ Última entrega: ${new Date(c.ultima_entrega).toLocaleDateString()}
              </div>` : `
              <div class="text-xs text-amber-600 mt-1">
                ⏳ Pendiente de entregar
              </div>`}

            <div class="flex gap-4 mt-3 text-sm">
              ${c.direccion ? `
                <button
                  class="btn-mapa underline text-blue-600"
                  data-direccion="${encodeURIComponent(c.direccion)}">
                  📍 Mapa
                </button>` : ""}

              ${c.telefono ? `
                <button
                  class="btn-whatsapp underline text-emerald-600"
                  data-nombre="${c.nombre}"
                  data-telefono="${c.telefono}">
                  📲 WhatsApp
                </button>` : ""}

              <button
                class="btn-entregado underline text-purple-600"
                data-id="${c.id}">
                ✔ Entregado
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `,
    didOpen: () => {
      document.querySelectorAll(".btn-mapa").forEach(btn => {
        btn.addEventListener("click", () =>
          abrirMapa(btn.dataset.direccion)
        );
      });

      document.querySelectorAll(".btn-whatsapp").forEach(btn => {
        btn.addEventListener("click", () =>
          enviarWhatsApp(btn.dataset.nombre, btn.dataset.telefono)
        );
      });

      document.querySelectorAll(".btn-entregado").forEach(btn => {
        btn.addEventListener("click", () =>
          marcarEntregado(btn.dataset.id)
        );
      });
    }
  });
}

/* =========================================================
   📍 Abrir mapa
========================================================= */
function abrirMapa(direccionEncoded) {
  const url = `https://www.google.com/maps/search/?api=1&query=${direccionEncoded}`;
  window.open(url, "_blank");
}

/* =========================================================
   📲 WhatsApp
========================================================= */
function enviarWhatsApp(nombre, telefono) {
  const tel = telefono.replace(/\D/g, "");
  const msg = `
Hola ${nombre} 👋
Vamos en camino con tu entrega 🚚📦
Gracias por tu preferencia 💜
  `.trim();

  const url = `https://wa.me/52${tel}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

/* =========================================================
   ✅ Marcar entrega realizada
========================================================= */
async function marcarEntregado(cliente_id) {
  const negocio_id = localStorage.getItem("negocio_id");

  const { error } = await supabaseClient
    .from("clientes")
    .update({ ultima_entrega: new Date().toISOString() })
    .eq("id", cliente_id)
    .eq("negocio_id", negocio_id);

  if (error) {
    Swal.fire("Error", "No se pudo marcar como entregado", "error");
    return;
  }

  Swal.fire({
    icon: "success",
    title: "Entrega registrada",
    text: "La entrega fue marcada correctamente",
    timer: 1200,
    showConfirmButton: false
  });

  // refrescar modal
  abrirRutaEntrega();
}
