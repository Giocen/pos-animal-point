import { supabaseClient } from "/js/proteccion.js";

/* ============================================================
   🔥 TOP MÁS VENDIDOS
============================================================ */
export async function abrirTopVendidos() {

  const negocio_id = localStorage.getItem("negocio_id") || null;

  Swal.fire({
    title: "🔥 Productos más vendidos",
    width: 460,
    background: "#1A042D",
    color: "#fff",
    showConfirmButton: false,
    scrollbarPadding: false,

    didOpen: async () => {

      const cont = Swal.getHtmlContainer();
      cont.innerHTML = `<p class='text-gray-400 text-sm'>Cargando...</p>`;

      const { data } = await supabaseClient.rpc("reporte_top_productos", {
        limite: 10,
        v_negocio_id: negocio_id
      });

      const top = data || [];

      cont.innerHTML = `
        <div style="max-height:300px; overflow-y:auto; padding-right:6px">
          <ul class="space-y-3 mt-3">
            ${
              top.length
                ? top.map((p, i) => `
                  <li class="flex justify-between border-b border-fuchsia-600/20 pb-1">
                    <span class="flex items-center gap-2">
                      <span class="text-fuchsia-400 text-xs">${i + 1}.</span>
                      ${p.nombre}
                    </span>
                    <b class="text-fuchsia-200">${p.total}</b>
                  </li>
                `).join("")
                : "<p class='text-gray-400 text-sm'>Sin datos</p>"
            }
          </ul>
        </div>
      `;
    },
  });
}

/* ============================================================
   📅 RESUMEN CON RANGO DE FECHA (PRO)
============================================================ */
export async function abrirResumenDia() {

  const negocio_id = localStorage.getItem("negocio_id") || null;

  const hoy = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Mexico_City"
  });

  Swal.fire({
    title: "📅 Resumen de ventas",
    width: 520,
    background: "#1A042D",
    color: "#fff",
    showConfirmButton: false,

    html: `
      <div class="space-y-3">

        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <label class="text-gray-400 text-xs">Desde</label>
            <input type="date" id="fechaInicio"
              value="${hoy}"
              class="swal2-input"
              style="background:#2a0b45;color:#fff;border:1px solid #7c3aed">
          </div>

          <div>
            <label class="text-gray-400 text-xs">Hasta</label>
            <input type="date" id="fechaFin"
              value="${hoy}"
              class="swal2-input"
              style="background:#2a0b45;color:#fff;border:1px solid #7c3aed">
          </div>
        </div>

        <button id="btnConsultarResumen"
          class="w-full py-2 rounded-lg font-bold text-white"
          style="background:linear-gradient(90deg,#9333ea,#ec4899)">
          Consultar
        </button>

        <div id="resultadoResumen" class="mt-3 text-sm">
          <p class="text-gray-400 text-center">Selecciona rango y consulta</p>
        </div>

      </div>
    `,

    didOpen: () => {

      document.getElementById("btnConsultarResumen")
        .addEventListener("click", async () => {

          const inicio = document.getElementById("fechaInicio").value;
          const fin = document.getElementById("fechaFin").value;

          if (!inicio || !fin) return;

          const resultado = document.getElementById("resultadoResumen");
          resultado.innerHTML = "<p class='text-gray-400 text-center'>Consultando...</p>";

          try {

            /* ================================
               🔹 Margen y utilidad
            ================================ */
            const { data: filas } = await supabaseClient
              .from("v_reporte_margen_utilidad")
              .select("ingreso_total, costo_total, utilidad")
              .eq("negocio_id", negocio_id)
              .gte("fecha_venta", inicio)
              .lte("fecha_venta", fin);

            const totalVentas = filas?.reduce((a, r) => a + Number(r.ingreso_total || 0), 0) || 0;
            const totalCosto = filas?.reduce((a, r) => a + Number(r.costo_total || 0), 0) || 0;
            const totalUtilidad = filas?.reduce((a, r) => a + Number(r.utilidad || 0), 0) || 0;

            /* ================================
               🔹 Métodos pago
            ================================ */
            const { data: pagos } = await supabaseClient
              .from("ventas")
              .select("pago_efectivo, pago_tarjeta, pago_transferencia, comision_tarjeta, folio")
              .eq("negocio_id", negocio_id)
              .gte("fecha", `${inicio} 00:00:00`)
              .lte("fecha", `${fin} 23:59:59`);

            const efectivo = pagos?.reduce((a, v) => a + Number(v.pago_efectivo || 0), 0) || 0;
            const tarjetaBruto = pagos?.reduce((a, v) => a + Number(v.pago_tarjeta || 0), 0) || 0;
            const transferencia = pagos?.reduce((a, v) => a + Number(v.pago_transferencia || 0), 0) || 0;
            const PORCENTAJE_MP = 0.035;

            const comisionTotal = pagos?.reduce((a, v) => {

              if (v.comision_tarjeta !== null && v.comision_tarjeta !== undefined) {
                return a + Number(v.comision_tarjeta);
              }

              // Si no existe comisión guardada, la calculamos
              const tarjeta = Number(v.pago_tarjeta || 0);
              return a + (tarjeta * PORCENTAJE_MP);

            }, 0) || 0;

            const tarjetaNeto = tarjetaBruto - comisionTotal;
            const tickets = new Set(pagos?.map(v => v.folio)).size || 0;

            const utilidadReal = totalUtilidad - comisionTotal;

            const margen = totalVentas > 0
              ? (totalUtilidad / totalVentas) * 100
              : 0;

            const margenReal = totalVentas > 0
              ? (utilidadReal / totalVentas) * 100
              : 0;

            /* ================================
               🎨 Render
            ================================ */
            resultado.innerHTML = `
              <div class="space-y-2">

                <div class="flex justify-between">
                  <span>💰 Total vendido:</span>
                  <b class="text-fuchsia-300">$${totalVentas.toFixed(2)}</b>
                </div>

                <div class="flex justify-between">
                  <span>📦 Inversión:</span>
                  <b class="text-orange-300">$${totalCosto.toFixed(2)}</b>
                </div>

                <div class="flex justify-between">
                  <span>💚 Ganancia bruta:</span>
                  <b class="text-green-400">$${totalUtilidad.toFixed(2)}</b>
                </div>

                <div class="flex justify-between">
                  <span>💚 Ganancia real:</span>
                  <b class="text-emerald-400">$${utilidadReal.toFixed(2)}</b>
                </div>

                <div class="flex justify-between">
                  <span>🎟 Tickets:</span>
                  <b>${tickets}</b>
                </div>

                <div class="border-t border-fuchsia-600/30 pt-2 mt-2 space-y-1">

                  <div class="flex justify-between">
                    <span>📊 Margen bruto:</span>
                    <b class="text-fuchsia-400">${margen.toFixed(2)}%</b>
                  </div>

                  <div class="flex justify-between">
                    <span>📊 Margen real:</span>
                    <b class="text-pink-400">${margenReal.toFixed(2)}%</b>
                  </div>

                </div>

                <div class="border-t border-fuchsia-600/30 pt-2 mt-2 space-y-1">

                  <div class="flex justify-between">
                    <span>💵 Efectivo:</span>
                    <b class="text-emerald-400">$${efectivo.toFixed(2)}</b>
                  </div>

                  <div class="flex justify-between">
                    <span>💳 Tarjeta bruto:</span>
                    <b class="text-blue-400">$${tarjetaBruto.toFixed(2)}</b>
                  </div>

                  <div class="flex justify-between">
                    <span>🏦 Comisión MP:</span>
                    <b class="text-red-400">-$${comisionTotal.toFixed(2)}</b>
                  </div>

                  <div class="flex justify-between">
                    <span>💰 Tarjeta neto:</span>
                    <b class="text-green-400">$${tarjetaNeto.toFixed(2)}</b>
                  </div>

                  <div class="flex justify-between">
                    <span>🏦 Transferencia:</span>
                    <b class="text-purple-400">$${transferencia.toFixed(2)}</b>
                  </div>

                </div>

              </div>
            `;

          } catch (err) {
            resultado.innerHTML = "<p class='text-red-400 text-center'>Error consultando datos</p>";
          }

        });

    },

  });

}