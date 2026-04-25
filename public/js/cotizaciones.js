import { supabaseClient } from "/js/proteccion.js";

const negocioId =
  localStorage.getItem("negocio_id") ||
  window.usuarioActual?.negocio_id;

const tabla = document.getElementById("tablaCotizaciones");

const money = v =>
  Number(v || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2
  });

// ==========================
// 🔹 CARGAR COTIZACIONES
// ==========================
async function cargar() {

  const { data, error } = await supabaseClient
    .from("v_cotizaciones")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  tabla.innerHTML = data.map(c => `
  <tr class="group cursor-pointer hover:bg-purple-50 transition"
      onclick="abrir('${c.id}')">

    <td class="px-4 py-3 font-medium">${c.folio}</td>
    <td class="px-4">${c.cliente_nombre || "-"}</td>
    <td class="text-center">${c.tipo}</td>
    <td class="text-right font-semibold">$${money(c.total)}</td>
    <td class="text-right">
      ${new Date(c.created_at).toLocaleDateString()}
    </td>

    <td class="px-2">
      <div class="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition">

        <button onclick="event.stopPropagation(); abrir('${c.id}')"
          class="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md shadow">
          <i data-lucide="eye" class="w-4 h-4"></i>
        </button>

        <button onclick="event.stopPropagation(); editar('${c.id}')"
          class="bg-amber-500 hover:bg-amber-600 text-white p-2 rounded-md shadow">
          <i data-lucide="pencil" class="w-4 h-4"></i>
        </button>

        <button onclick="event.stopPropagation(); eliminar('${c.id}')"
          class="bg-red-600 hover:bg-red-700 text-white p-2 rounded-md shadow">
          <i data-lucide="trash" class="w-4 h-4"></i>
        </button>

      </div>
    </td>

  </tr>
`).join("");

lucide.createIcons();
}

// ==========================
// 🔍 VER / ABRIR
// ==========================
window.abrir = (id) => {
  window.location.href = `/cotizacion?id=${id}`;
};

// ==========================
// ✏️ EDITAR
// ==========================
window.editar = (id) => {
  window.location.href = `/cotizacion?id=${id}`;
};

// ==========================
// ❌ ELIMINAR
// ==========================
window.eliminar = async (id) => {

  Swal.fire({
    title: "¿Eliminar cotización?",
    text: "Esta acción no se puede deshacer",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280"
  }).then(async (result) => {

    if (!result.isConfirmed) return;

    // 🔹 eliminar detalle primero
    await supabaseClient
      .from("cotizaciones_detalle")
      .delete()
      .eq("cotizacion_id", id);

    // 🔹 eliminar cabecera
    const { error } = await supabaseClient
      .from("cotizaciones")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);

      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo eliminar la cotización",
        confirmButtonColor: "#7c3aed"
      });

      return;
    }

    Swal.fire({
      icon: "success",
      title: "Eliminada",
      text: "La cotización fue eliminada",
      confirmButtonColor: "#7c3aed"
    });

    cargar();

  });
};

cargar();