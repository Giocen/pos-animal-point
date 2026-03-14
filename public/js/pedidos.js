// 💜 SmartPOS - Pedidos de Reabastecimiento v1.4 (Multi-Negocio + Final)
// ---------------------------------------------------------------------
// ✔ Compatible con cajero / admin
// ✔ Totalmente multi-negocio (usa usuario.negocio_id)
// ✔ Lógica original intacta
// ✔ Exportar Excel y SweetAlert 3D
// ---------------------------------------------------------------------

import { supabaseClient, protegerSesion } from "./proteccion.js";

// 🔐 Sesión correcta con roles permitidos
const usuario = await protegerSesion(["cajero", "admin"]);
const NEGOCIO_ID = usuario?.negocio_id; // MULTI-NEGOCIO REAL

document.addEventListener("DOMContentLoaded", () => lucide.createIcons());

const tbody = document.getElementById("tbodyPedidos");

/* -------------------------------------------------------------------------- */
/* 🎨 Helper SweetAlert estilo SmartPOS                                       */
/* -------------------------------------------------------------------------- */
function showSwal3D(options) {
  return Swal.fire({
    customClass: {
      popup: "card-3d",
      confirmButton: "btn-3d",
      cancelButton: "btn-3d",
    },
    background: "#fff",
    ...options,
  });
}

/* -------------------------------------------------------------------------- */
/* 📦 Cargar Pedidos Pendientes (Multi-negocio)                               */
/* -------------------------------------------------------------------------- */
async function cargarPedidos() {
  tbody.innerHTML =
    `<tr><td colspan="8" class="text-center py-4 text-gray-500">⏳ Cargando pedidos...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("pedidos_reabastecimiento")
    .select(`
        id,
        producto_id,
        cantidad_sugerida,
        fecha,
        atendido,
        productos:producto_id (
          codigo_barras,
          nombre,
          descripcion
        ),
        v_productos_existencias!inner (
          descripcion,
          existencias_total,
          stock_minimo,
          unidad,
          negocio_id
        )
      `)
    .eq("atendido", false)
    .eq("negocio_id", NEGOCIO_ID)   // MULTI-NEGOCIO REAL
    .order("fecha", { ascending: false });

  if (error) {
    console.error("❌ Error cargando pedidos:", error);
    tbody.innerHTML =
      `<tr><td colspan="8" class="text-center py-4 text-red-600">⚠️ Error al cargar pedidos</td></tr>`;
    return;
  }

  if (!data?.length) {
    tbody.innerHTML =
      `<tr><td colspan="8" class="text-center py-4 text-gray-500">📭 No hay pedidos pendientes</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map((p) => {
      const existencias = parseFloat(p.v_productos_existencias?.existencias_total ?? 0);
      const minimo = p.v_productos_existencias?.stock_minimo ?? 5;
      const unidad = p.v_productos_existencias?.unidad || "";

      let badge = `<span class="badge-stock bg-green-100 text-green-700">${existencias} ${unidad}</span>`;
      if (existencias === 0)
        badge = `<span class="badge-stock bg-red-100 text-red-700">Sin stock</span>`;
      else if (existencias < minimo)
        badge = `<span class="badge-stock bg-yellow-100 text-yellow-700">Bajo (${existencias} ${unidad})</span>`;

      return `
        <tr class="bg-white hover:bg-fuchsia-50 transition">
          <td class="px-3 py-2">${p.productos?.codigo_barras || "—"}</td>
          <td class="px-3 py-2">${p.productos?.nombre || "—"}</td>
          <td class="px-3 py-2 text-gray-600">
            ${p.productos?.descripcion || p.v_productos_existencias?.descripcion || "—"}
          </td>
          <td class="px-3 py-2 text-center">${badge}</td>
          <td class="px-3 py-2 text-center">${minimo}</td>
          <td class="px-3 py-2 text-center font-bold text-fuchsia-700">${p.cantidad_sugerida}</td>
          <td class="px-3 py-2 text-center">${new Date(p.fecha).toLocaleString("es-MX")}</td>
          <td class="px-3 py-2 text-center">
            <button class="btn-3d bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 text-sm rounded"
                    onclick="marcarAtendido('${p.id}')">
              Marcar atendido
            </button>
          </td>
        </tr>`;
    })
    .join("");

  lucide.createIcons();
}

/* -------------------------------------------------------------------------- */
/* 🟢 Marcar Pedido como Atendido                                             */
/* -------------------------------------------------------------------------- */
window.marcarAtendido = async function (id) {
  try {
    const { error } = await supabaseClient
      .from("pedidos_reabastecimiento")
      .update({ atendido: true })
      .eq("id", id)
      .eq("negocio_id", NEGOCIO_ID); // Protección extra

    if (error) throw error;

    showSwal3D({
      icon: "success",
      title: "Pedido atendido",
      timer: 1000,
      showConfirmButton: false,
    });

    cargarPedidos();
  } catch (err) {
    console.error("❌ Error al marcar pedido:", err);
    showSwal3D({
      icon: "error",
      title: "Error",
      text: "No se pudo actualizar el pedido",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* 📤 Exportar a Excel (solo negocio actual)                                  */
/* -------------------------------------------------------------------------- */
document.getElementById("btnExport")?.addEventListener("click", async () => {
  showSwal3D({ title: "Generando Excel...", didOpen: () => Swal.showLoading() });

  const { data, error } = await supabaseClient
    .from("pedidos_reabastecimiento")
    .select(`
      id,
      producto_id,
      cantidad_sugerida,
      fecha,
      atendido,
      productos:producto_id (
        codigo_barras,
        nombre,
        descripcion
      ),
      v_productos_existencias!inner (
        existencias_total,
        stock_minimo,
        unidad,
        negocio_id
      )
    `)
    .eq("atendido", false)
    .eq("negocio_id", NEGOCIO_ID)
    .order("fecha", { ascending: false });

  if (error) {
    console.error(error);
    return showSwal3D({ icon: "error", title: "Error", text: "No se pudo generar el Excel" });
  }

  if (!data?.length) {
    return showSwal3D({ icon: "info", title: "Vacío", text: "No hay pedidos para exportar" });
  }

  const rows = data.map((p) => ({
    Codigo: p.productos?.codigo_barras || "",
    Nombre: p.productos?.nombre || "",
    Descripción: p.productos?.descripcion || "",
    Existencias: p.v_productos_existencias?.existencias_total ?? 0,
    Unidad: p.v_productos_existencias?.unidad || "",
    "Stock mínimo": p.v_productos_existencias?.stock_minimo ?? "",
    "Cantidad sugerida": p.cantidad_sugerida,
    Fecha: new Date(p.fecha).toLocaleString("es-MX"),
  }));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pedidos Pendientes");

  sheet.columns = Object.keys(rows[0]).map((key) => ({
    header: key,
    key,
    width: 20,
  }));

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "9333EA" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  rows.forEach((r) => sheet.addRow(r));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Pedidos_${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();

  Swal.close();
});

/* -------------------------------------------------------------------------- */
/* 🚀 Iniciar módulo                                                          */
/* -------------------------------------------------------------------------- */
cargarPedidos();
