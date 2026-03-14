import { supabaseClient, protegerSesion } from "/js/proteccion.js";

document.addEventListener("DOMContentLoaded", async () => {

  // 🔐 Requiere admin
  await protegerSesion(["admin"]);

  // 🟣 Negocio activo (seguro)
  const negocioId =
    localStorage.getItem("negocio_id") ||
    window.usuarioActual?.negocio_id ||
    null;

  if (!negocioId) {
    Swal.fire("Error", "No se encontró el negocio activo.", "error");
    return;
  }

  // 📌 Elementos
  const tabla = document.getElementById("tablaMovimientos");
  const resultados = document.getElementById("resultadosContainer");
  const btnBuscar = document.getElementById("btnBuscarMovimiento");

  btnBuscar.addEventListener("click", buscarMovimientos);

  /* ==========================================================================
     🔍 Buscar movimientos POR SKU / CÓDIGO (Multi-Negocio)
     ========================================================================== */
  async function buscarMovimientos() {

    const skuInput = document.getElementById("inputSku").value.trim();
    const desde = document.getElementById("inputDesde").value;
    const hasta = document.getElementById("inputHasta").value;

    if (!skuInput) {
      Swal.fire("Falta información", "Escribe un SKU o código de barras", "warning");
      return;
    }

    /* ----------------------------------------------------------
       1️⃣ Buscar producto filtrando por negocio
    ----------------------------------------------------------- */
    const { data: producto, error: errProd } = await supabaseClient
      .from("productos")
      .select("id, sku, nombre, negocio_id")
      .or(`sku.eq.${skuInput},codigo_barras.eq.${skuInput}`)
      .eq("negocio_id", negocioId)   // 🔥 MULTI-NEGOCIO REAL
      .maybeSingle();

    if (errProd) {
      console.error(errProd);
      Swal.fire("Error", "No fue posible consultar el producto.", "error");
      return;
    }

    if (!producto) {
      Swal.fire("No encontrado", "No existe este SKU/código en este negocio.", "info");
      return;
    }

    /* ----------------------------------------------------------
       2️⃣ Construir consulta de movimientos SAP
    ----------------------------------------------------------- */
    let query = supabaseClient
      .from("v_movimientos_producto")
      .select("*")
      .eq("producto_id", producto.id)
      .eq("negocio_id", negocioId) // 🔥 FILTRO OBLIGATORIO
      .order("fecha", { ascending: false });

    // 🔹 Fechas opcionales
    if (desde) query = query.gte("fecha", desde);
    if (hasta) query = query.lte("fecha", hasta + " 23:59:59");

    const { data: movimientos, error } = await query;

    if (error) {
      console.error("❌ Error al cargar movimientos:", error);
      Swal.fire("Error", "No se pudieron cargar los movimientos", "error");
      return;
    }

    resultados.classList.remove("hidden");

    /* ----------------------------------------------------------
       3️⃣ Sin resultados
    ----------------------------------------------------------- */
    if (!movimientos || movimientos.length === 0) {
      tabla.innerHTML = `
        <tr>
          <td colspan="6" class="py-3 text-center text-gray-300">
            No hay movimientos registrados.
          </td>
        </tr>`;
      return;
    }

    /* ----------------------------------------------------------
       4️⃣ Render tabla
    ----------------------------------------------------------- */
    tabla.innerHTML = movimientos.map(m => {
      let clase = "row-ajuste";
      if (m.tipo_sap === "Entrada") clase = "row-entrada";
      else if (m.tipo_sap === "Salida") clase = "row-salida";

      return `
        <tr class="${clase}">
          <td>${formatFecha(m.fecha)}</td>
          <td>${m.tipo_sap}</td>
          <td>${m.clase_movimiento}</td>
          <td>${m.cantidad}</td>
          <td>${m.detalle ?? ""}</td>
          <td>${m.referencia ?? ""}</td>
        </tr>
      `;
    }).join("");
  }

  /* ==========================================================================
     🧩 Helper formato fecha
     ========================================================================== */
  function formatFecha(f) {
    if (!f) return "-";
    return new Date(f).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short"
    });
  }

});
