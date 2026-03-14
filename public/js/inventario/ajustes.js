/* -------------------------------------------------------------------------- */
/*   SmartPOS | Ajustes de Inventario (ONLINE + OFFLINE)                       */
/*   ✔ Un solo submit                                                         */
/*   ✔ Offline-first real                                                     */
/*   ✔ Multi-negocio                                                          */
/* -------------------------------------------------------------------------- */

import { supabaseClient, protegerSesion } from "../proteccion.js";
await protegerSesion(["admin"]);

const negocioId = localStorage.getItem("negocio_id");
const CACHE_KEY_AJUSTES = "smartpos_ajustes_pendientes";

// ---------------------------------------------------------------------------
// 🔐 Seguridad: solo administrador
// ---------------------------------------------------------------------------
const rolUsuario = (localStorage.getItem("usuario_rol") || "").trim().toLowerCase();
if (rolUsuario !== "administrador" && rolUsuario !== "admin") {
  Swal.fire({
    icon: "error",
    title: "Acceso denegado",
    text: "Solo el administrador puede acceder a ajustes de inventario",
    confirmButtonColor: "#a21caf",
  }).then(() => (window.location.href = "ventas"));
}

// ---------------------------------------------------------------------------
// 📦 Estado
// ---------------------------------------------------------------------------
let productoSeleccionado = null;

// ---------------------------------------------------------------------------
// 🔎 Búsqueda de productos
// ---------------------------------------------------------------------------
const inputBusqueda = document.getElementById("busquedaProducto");
const lista = document.getElementById("resultados");

inputBusqueda.addEventListener("input", async (e) => {
  const texto = e.target.value.trim();
  lista.innerHTML = "";
  lista.classList.add("hidden");
  productoSeleccionado = null;

  if (texto.length < 2) return;

  const { data, error } = await supabaseClient
    .from("v_productos_existencias")
    .select("id,nombre,sku,codigo_barras,existencias_total")
    .or(`codigo_barras.ilike.%${texto}%,nombre.ilike.%${texto}%,sku.ilike.%${texto}%`)
    .eq("negocio_id", negocioId)
    .limit(10);

  if (error || !data?.length) return;

  lista.classList.remove("hidden");
  data.forEach((p) => {
    const li = document.createElement("li");
    li.className = "p-2 hover:bg-fuchsia-100 cursor-pointer text-sm";
    li.textContent = `${p.nombre} (SKU: ${p.sku || "-"}, Stock: ${p.existencias_total})`;
    li.onclick = () => seleccionarProducto(p);
    lista.appendChild(li);
  });
});

inputBusqueda.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();

  const texto = inputBusqueda.value.trim();
  if (!texto) return;

  const { data } = await supabaseClient
    .from("v_productos_existencias")
    .select("id,nombre,sku,codigo_barras,existencias_total")
    .or(`sku.eq.${texto},codigo_barras.eq.${texto}`)
    .eq("negocio_id", negocioId)
    .maybeSingle();

  if (data) seleccionarProducto(data);
});

document.addEventListener("click", (e) => {
  if (!lista.contains(e.target) && e.target !== inputBusqueda) {
    lista.classList.add("hidden");
  }
});

function seleccionarProducto(p) {
  productoSeleccionado = p;
  inputBusqueda.value = p.nombre;
  document.getElementById("existenciasActuales").value = p.existencias_total;
  lista.innerHTML = "";
  lista.classList.add("hidden");
}

// ---------------------------------------------------------------------------
// 🧠 Helpers
// ---------------------------------------------------------------------------
function actualizarUIStock(cantidad) {
  productoSeleccionado.existencias_total += cantidad;
  document.getElementById("existenciasActuales").value =
    productoSeleccionado.existencias_total;
}

function limpiarFormulario() {
  document.getElementById("cantidad").value = "";
  document.getElementById("motivo").value = "";
}

function guardarAjusteOffline(ajuste) {
  const cache = JSON.parse(localStorage.getItem(CACHE_KEY_AJUSTES) || "[]");
  cache.push(ajuste);
  localStorage.setItem(CACHE_KEY_AJUSTES, JSON.stringify(cache));
}

// ---------------------------------------------------------------------------
// 📝 SUBMIT ÚNICO (ONLINE / OFFLINE)
// ---------------------------------------------------------------------------
document.getElementById("formAjuste").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!productoSeleccionado) {
    return Swal.fire("Error", "Selecciona un producto válido", "error");
  }

  let cantidad = parseFloat(document.getElementById("cantidad").value);
  let motivo = document.getElementById("motivo").value;
  let usuario = document.getElementById("usuario").value.trim() || "offline";
  let clasificacion = "otro";

  if (isNaN(cantidad) || !motivo) {
    return Swal.fire("Error", "Completa todos los campos", "warning");
  }

  // 🔁 Clasificación automática
  if (["merma", "caducidad", "robo", "conteo_faltante"].includes(motivo)) {
    clasificacion = "faltante";
    if (cantidad > 0) cantidad *= -1;
  }

  if (motivo === "conteo_sobrante") {
    clasificacion = "sobrante";
    if (cantidad < 0) cantidad = Math.abs(cantidad);
  }

  // ⚙️ Motivo personalizado
  if (motivo === "otro") {
    const { value } = await Swal.fire({
      title: "Ajuste personalizado",
      html: `
        <input id="swal-motivo" class="swal2-input" placeholder="Motivo">
        <select id="swal-tipo" class="swal2-select">
          <option value="">Tipo</option>
          <option value="suma">Suma</option>
          <option value="resta">Resta</option>
        </select>`,
      preConfirm: () => {
        const m = document.getElementById("swal-motivo").value.trim();
        const t = document.getElementById("swal-tipo").value;
        if (!m || !t) return Swal.showValidationMessage("Completa los campos");
        return { m, t };
      },
      showCancelButton: true,
    });

    if (!value) return;

    motivo = value.m;
    if (value.t === "suma") {
      clasificacion = "sobrante";
      cantidad = Math.abs(cantidad);
    } else {
      clasificacion = "faltante";
      if (cantidad > 0) cantidad *= -1;
    }
  }

   const ajuste = {
  producto_id: productoSeleccionado.id,
  cantidad,
  motivo,
  usuario,
  clasificacion,
  negocio_id: negocioId, 
};

if (navigator.onLine) {

  const { error } = await supabaseClient.rpc(
    "registrar_ajuste_inventario",
    {
      p_producto_id: productoSeleccionado.id,
      p_cantidad: cantidad,
      p_motivo: motivo,
      p_usuario: usuario,
      p_clasificacion: clasificacion,
      p_negocio_id: negocioId
    }
  );

  if (!error) {
    actualizarUIStock(cantidad);
    limpiarFormulario();
    return Swal.fire("✅ Ajuste registrado", "", "success");
  }
}

  // 💾 OFFLINE / FALLBACK
  guardarAjusteOffline(ajuste);
  actualizarUIStock(cantidad);
  limpiarFormulario();

  Swal.fire({
    icon: "info",
    title: "Guardado offline",
    text: "Se sincronizará al volver el internet",
    timer: 1600,
    showConfirmButton: false,
  });
});

// ---------------------------------------------------------------------------
// 🔄 Sincronización automática
// ---------------------------------------------------------------------------
window.addEventListener("online", async () => {
  const pendientes = JSON.parse(localStorage.getItem(CACHE_KEY_AJUSTES) || "[]");
  if (!pendientes.length) return;

  for (const a of pendientes) {
    delete a.fecha_local;
    await supabaseClient.from("ajustes_inventario").insert([a]);
  }

  localStorage.removeItem(CACHE_KEY_AJUSTES);
});
 