import { supabaseClient, protegerSesion } from "/js/proteccion.js";

document.addEventListener("DOMContentLoaded", async () => {

  // 🔐 Proteger vista (solo administrador)
  await protegerSesion(["admin"]);

  // 🟣 Negocio activo (versión segura)
  const negocioId =
    localStorage.getItem("negocio_id") ||
    window.usuarioActual?.negocio_id ||
    null;

  if (!negocioId) {
    Swal.fire("Error", "No se encontró el negocio activo", "error");
    return;
  }

  // 📌 Elementos del DOM
  const tabla = document.getElementById("tablaProductos");
  const inputBuscar = document.getElementById("buscar");
  const resultadosContainer = document.getElementById("resultadosContainer");

  let listaOriginal = [];

  /* ==========================================================
     🔄 Cargar Productos NO Vendidos (Multi-Negocio seguro)
     ========================================================== */
  async function cargarProductos() {
    try {
      const { data, error } = await supabaseClient
        .from("v_productos_no_vendidos")
        .select("*")
        .eq("negocio_id", negocioId)   // 🔥 filtro MULTI-NEGOCIO
        .order("nombre");

      if (error) throw error;

      listaOriginal = data || [];

      renderTabla(listaOriginal);
      resultadosContainer?.classList.remove("hidden");

    } catch (err) {
      console.error("❌ Error cargando productos no vendidos:", err);
      Swal.fire("Error", "No se pudieron cargar los datos", "error");
    }
  }

  /* ==========================================================
     🧱 Render tabla
     ========================================================== */
  function renderTabla(lista) {
    tabla.innerHTML = "";

    if (!lista || lista.length === 0) {
      tabla.innerHTML = `
        <tr>
          <td colspan="6" class="py-3 text-center text-gray-300">
            No hay productos sin ventas
          </td>
        </tr>`;
      return;
    }

    lista.forEach(p => {
      const row = `
        <tr class="border-b border-white/10 hover:bg-white/5 transition">
          <td class="p-2">${p.sku ?? ""}</td>
          <td class="p-2">${p.nombre ?? ""}</td>
          <td class="p-2">${p.categoria ?? ""}</td>
          <td class="p-2">$${Number(p.costo || 0).toFixed(2)}</td>
          <td class="p-2">$${Number(p.precio_base || 0).toFixed(2)}</td>
          <td class="p-2">${p.existencias ?? 0}</td>
        </tr>
      `;
      tabla.insertAdjacentHTML("beforeend", row);
    });
  }

  /* ==========================================================
     🔍 Buscador en tiempo real (con null-safe)
     ========================================================== */
  inputBuscar?.addEventListener("input", () => {
    const texto = (inputBuscar.value || "").toLowerCase();

    const filtrados = listaOriginal.filter(p =>
      (p.nombre || "").toLowerCase().includes(texto) ||
      (p.sku || "").toLowerCase().includes(texto) ||
      (p.categoria || "").toLowerCase().includes(texto)
    );

    renderTabla(filtrados);
  });

  // ▶ Iniciar carga
  cargarProductos();

});
