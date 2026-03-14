import { supabaseClient } from "/js/proteccion.js";

// 🟣 Negocio actual (multi-negocios)
const negocioId = localStorage.getItem("negocio_id");

const contenedor = document.getElementById("listaTickets");

async function cargarTickets() {
  if (!negocioId) {
    console.warn("⚠️ No hay negocio seleccionado.");
    contenedor.innerHTML = `
      <div class="text-center text-red-300 py-10">
        No se encontró el negocio actual.
      </div>`;
    return;
  }

  const { data, error } = await supabaseClient
    .from("v_reporte_tickets")
    .select("*")
    .eq("negocio_id", negocioId)     // 🔥 filtro MULTI-NEGOCIO
    .order("fecha", { ascending: false });

  if (error) {
    console.error("Error cargando tickets:", error);
    Swal.fire("Error", "No se pudieron cargar los tickets", "error");
    return;
  }

  if (!data || data.length === 0) {
    contenedor.innerHTML = `
      <div class="text-center text-gray-300 py-10">
        No hay tickets registrados para este negocio.
      </div>
    `;
    return;
  }

  contenedor.innerHTML = data
    .map(
      (t) => `
    <div class="bg-white/10 border border-white/10 p-4 rounded-lg flex justify-between items-center">

      <div>
        <div class="font-bold text-fuchsia-300 text-lg">Folio ${t.folio}</div>
        <div class="text-sm text-gray-300">
          ${new Date(t.fecha).toLocaleString()}
        </div>
        <div class="text-sm mt-1">Productos: <b>${t.productos}</b></div>
        <div class="text-sm">Total: <b>$${Number(t.total).toFixed(2)}</b></div>
      </div>

      <div class="flex flex-col gap-2">

        <button class="bg-fuchsia-600 hover:bg-fuchsia-700 px-3 py-1 rounded text-sm"
          onclick="abrirPDF('${t.archivo_pdf}')">
          PDF Normal
        </button>

        <button class="bg-pink-600 hover:bg-pink-700 px-3 py-1 rounded text-sm"
          onclick="abrirPDF('${t.archivo_termico}')">
          PDF Térmico
        </button>

      </div>

    </div>
  `
    )
    .join("");
}

// ------------------------------------------------------------
// 🔓 Obtener archivo PDF (normal o térmico)
// ------------------------------------------------------------
window.abrirPDF = async function (nombreArchivo) {
  const { data, error } = await supabaseClient.storage
    .from("tickets")
    .createSignedUrl(nombreArchivo, 60);

  if (error || !data) {
    Swal.fire("Archivo no encontrado", nombreArchivo, "error");
    return;
  }

  window.open(data.signedUrl, "_blank");
};

// iniciar
cargarTickets();
