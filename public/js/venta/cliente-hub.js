// ============================================================================
// 💜 SmartPOS – Cliente HUB (Clientes + Pedidos + Ruta + Historial)
// ----------------------------------------------------------------------------
// ✔ Multi-negocio
// ✔ Independiente de ventas
// ✔ Lazy-import
// ✔ Con indicadores reales
// ✔ UX claro (ver → crear → confirmar)
// ============================================================================

import { supabaseClient } from "/js/proteccion.js";

const Swal = window.Swal;

/* =========================================================
   👤 Abrir HUB de Cliente
========================================================= */
export async function abrirClienteHub() {
  const negocio_id = localStorage.getItem("negocio_id");

  if (!negocio_id) {
    Swal.fire("Error", "Negocio no identificado", "error");
    return;
  }

  /* =======================================================
     📊 CONTADORES (VISUAL REAL)
  ======================================================= */
  const [
    clientesCount,
    pedidosPendientesCount,
    pedidosEntregadosCount
  ] = await Promise.all([
    supabaseClient
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .eq("negocio_id", negocio_id),

    supabaseClient
      .from("pedidos")
      .select("*", { count: "exact", head: true })
      .eq("negocio_id", negocio_id)
      .eq("estado", "pendiente"),

    supabaseClient
      .from("pedidos")
      .select("*", { count: "exact", head: true })
      .eq("negocio_id", negocio_id)
      .eq("estado", "entregado")
  ]);

  const totalClientes = clientesCount.count || 0;
  const pedidosPendientes = pedidosPendientesCount.count || 0;
  const pedidosEntregados = pedidosEntregadosCount.count || 0;

  /* =======================================================
     🧠 HUB VISUAL
  ======================================================= */
  Swal.fire({
    title: "👤 Cliente",
    width: 420,
    showConfirmButton: false,
    showCloseButton: true,
    background: "#fff",
    html: `
      <div class="space-y-3">

        <button id="hubClientes"
          class="w-full btn-3d bg-gradient-to-r from-fuchsia-600 to-pink-500
                 text-white py-2 rounded-lg font-semibold shadow">
          📇 Clientes (${totalClientes})
        </button>

        <button id="hubCrearPedido"
          class="w-full btn-3d bg-gradient-to-r from-emerald-600 to-green-500
                 text-white py-2 rounded-lg font-semibold shadow">
          📦 Crear pedido
        </button>

        <button id="hubPedidos"
          class="w-full btn-3d bg-gradient-to-r from-orange-500 to-amber-500
                 text-white py-2 rounded-lg font-semibold shadow">
          🚚 Pedidos pendientes (${pedidosPendientes})
        </button>

        <button id="hubMapa"
          class="w-full btn-3d bg-gradient-to-r from-blue-600 to-sky-500
                 text-white py-2 rounded-lg font-semibold shadow">
          🗺️ Mapa / Rutas
        </button>

        <button id="hubHistorial"
          class="w-full btn-3d bg-gradient-to-r from-purple-600 to-indigo-500
                 text-white py-2 rounded-lg font-semibold shadow">
          📊 Historial (${pedidosEntregados})
        </button>

      </div>
    `,
    didOpen: () => {

      /* ===================================================
         📇 CLIENTES
      =================================================== */
      document.getElementById("hubClientes")?.addEventListener("click", async () => {
        Swal.close();
        const { abrirClientes } = await import("/js/venta/clientes.js");
        abrirClientes();
      });

      /* ===================================================
         📦 CREAR PEDIDO
      =================================================== */
      document.getElementById("hubCrearPedido")?.addEventListener("click", async () => {
        Swal.close();

        const { crearPedidoManual } = await import("/js/venta/crear-pedido.js");
        await crearPedidoManual(window.clienteSeleccionado || {});

        // UX: sugerencia después de crear
        Swal.fire({
          icon: "success",
          title: "Pedido creado",
          text: "¿Deseas ver los pedidos pendientes?",
          showCancelButton: true,
          confirmButtonText: "Ver pedidos",
          cancelButtonText: "Cerrar"
        }).then(async r => {
          if (r.isConfirmed) {
            const { abrirPedidosEntrega } = await import(
              "/js/venta/pedidos-entrega.js"
            );
            abrirPedidosEntrega();
          }
        });
      });

      /* ===================================================
         🚚 PEDIDOS PENDIENTES
      =================================================== */
      document.getElementById("hubPedidos")?.addEventListener("click", async () => {
        Swal.close();
        const { abrirPedidosEntrega } = await import(
          "/js/venta/pedidos-entrega.js"
        );
        abrirPedidosEntrega();
      });

      /* ===================================================
         🗺️ MAPA / RUTAS  ✅ AQUÍ FUNCIONA mapa-clientes.js
      =================================================== */
      document.getElementById("hubMapa")?.addEventListener("click", async () => {
        Swal.close();
        const { abrirMapaClientes } = await import(
          "/js/venta/mapa-clientes.js"
        );
        abrirMapaClientes();
      });

      /* ===================================================
         📊 HISTORIAL
      =================================================== */
      document.getElementById("hubHistorial")?.addEventListener("click", async () => {
        Swal.close();
        const { abrirHistorialEntregas } = await import(
          "/js/venta/historial-entregas.js"
        );
        abrirHistorialEntregas();
      });
    }
  });
}
