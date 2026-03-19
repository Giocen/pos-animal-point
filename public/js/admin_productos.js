/* -------------------------------------------------------------------------- */
/*   Productos SmartPOS                                                       */
/* -------------------------------------------------------------------------- */
/*   - Guarda localmente los resultados de búsqueda (v_productos_existencias).
   - Permite abrir y buscar productos sin conexión.
   - Cuando vuelve la conexión, sincroniza automáticamente con Supabase.
   - No modifica tu lógica ni tus consultas.
*/

// ✅ productos.js
import { optimizarImagen } from "./utilidades/optimizar-imagen.js";
import { supabaseClient, protegerSesion } from "./proteccion.js";
await protegerSesion(["admin", "cajero"]);

let cambiosPendientes = {} 
let hayCambios = false

function calcularMargen(precio, costo) {
  if (costo <= 0) return 0;
  return ((precio - costo) / costo) * 100;
}

function calcularPrecioDesdeMargen(costo, margen) {
  if (costo <= 0) return 0;
  return costo * (1 + margen / 100);
}

// 🔐 Usuario actual seguro (nuevo nombre de variable)
const usuario = window.usuarioActual || {};

const NEGOCIO_ID =
  localStorage.getItem("negocio_id") ||
  usuario?.negocio_id ||
  null;

if (!NEGOCIO_ID) {
  console.error("❌ NEGOCIO_ID es NULL");
}

// ✅ alias para no romper el código viejo
const negocioId = NEGOCIO_ID;


// ✅ Crear alias local, antes de usarlo en cualquier función
const supabase = supabaseClient;

const tbody = document.getElementById('tbody')
const modal = document.getElementById('modal')
const formEdit = document.getElementById('formEdit')
const e_id = document.getElementById('e_id')
const e_sku = document.getElementById('e_sku')
const e_barcode = document.getElementById('e_barcode')
const e_nombre = document.getElementById('e_nombre')
const e_desc = document.getElementById('e_desc')
const e_categoria = document.getElementById('e_categoria')
const e_precio = document.getElementById('e_precio')
const e_costo = document.getElementById('e_costo')
const e_activo = document.getElementById('e_activo')
const e_minimo = document.getElementById('e_minimo')
const btnCancel = document.getElementById('btnCancel')
const btnBuscar  = document.getElementById('btnBuscar')
const btnLimpiar = document.getElementById('btnLimpiar')
const prev       = document.getElementById('prev')
const next       = document.getElementById('next')
const pageSizeSel= document.getElementById('pageSize')
const q   = document.getElementById("q")
const cat = document.getElementById("cat")

let page = 1
let pageSize = Number(pageSizeSel?.value) || 20
let sortField = null
let sortAsc = true


// --- Eventos de paginación ---
prev?.addEventListener("click", () => {
  if (page > 1) {
    page--
    buscar()
  }
})

next?.addEventListener("click", () => {
  page++
  buscar()
})

// 📸 Variables globales para manejo de imagen
let fileInput = null;
let preview = null;
let placeholder = null;
let btnCamara = null;
let btnQuitarImg = null;
let imagenFile = null;

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();

  fileInput = document.getElementById("e_imagen");
  preview = document.getElementById("e_preview");
  placeholder = document.getElementById("placeholder");
  btnCamara = document.getElementById("btnCamara");
  btnQuitarImg = document.getElementById("btnQuitarImg");

  if (!fileInput) {
    console.error("❌ Input e_imagen no encontrado");
    return;
  }

  // 📁 Subir imagen desde archivo
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const optimizada = await optimizarImagen(file);
    imagenFile = optimizada;

    mostrarImagen(URL.createObjectURL(optimizada));
  });

  // 📸 CÁMARA (MOVER AQUÍ)
  btnCamara?.addEventListener("click", async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.className = "w-full rounded-lg";

      const { value: confirmed } = await Swal.fire({
        title: "📸 Cámara activa",
        html: `<div id="camContainer"></div>`,
        didOpen: () =>
          document.getElementById("camContainer").appendChild(video),
        showCancelButton: true,
        confirmButtonText: "Capturar",
        didClose: () => stream.getTracks().forEach(t => t.stop()),
      });

      if (!confirmed) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);

      const blob = await new Promise(r =>
        canvas.toBlob(r, "image/jpeg", 0.9)
      );

      const file = new File([blob], `foto_${Date.now()}.jpg`, {
        type: "image/jpeg"
      });

      const optimizada = await optimizarImagen(file);
      imagenFile = optimizada;

      mostrarImagen(URL.createObjectURL(optimizada));

    } catch {
      Swal.fire("Error", "No se pudo acceder a la cámara", "error");
    }
  });

  // 🗑️ QUITAR IMAGEN (MOVER AQUÍ)
  btnQuitarImg?.addEventListener("click", () => {
    imagenFile = null;
    if (fileInput) fileInput.value = "";
    mostrarImagen(null);
  });
});

// ---------- Categorías ----------
async function cargarCategorias() {
  const cat = document.getElementById('cat')
  const { data, error } = await supabase
    .from('categorias')
    .select('nombre')
    .eq('negocio_id', NEGOCIO_ID)
    .order('nombre', { ascending: true })
  cat.innerHTML = '<option value="">Todas las categorías</option>'
  if (!error && data) {
    data.forEach(c => {
      cat.innerHTML += `<option>${c.nombre}</option>`
    })
  }
}

// ---------- Buscar productos ----------

async function buscar() {
  tbody.innerHTML = `<tr><td class="td" colspan="10">🔎 Buscando...</td></tr>`

const qVal = q?.value.trim() || ""
  const catVal = cat?.value.trim() || ""

  pageSize = Number(pageSizeSel?.value) || 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1


 let query = supabase
  .from("v_productos_existencias")
  .select(`
    id,
    sku,
    nombre,
    descripcion,
    categoria_id,
    categoria_nombre,
    precio_base,
    costo,
    codigo_barras,
    activo,
    imagen_url,
    existencias_total,
    unidad,
    caducidad_proxima,
    stock_minimo,
    updated_at
  `, { count: "exact" })
  .eq("negocio_id", negocioId)
  .range(from, to);


  if (qVal) {
    query = query.or(`sku.ilike.%${qVal}%,nombre.ilike.%${qVal}%,codigo_barras.ilike.%${qVal}%`)
  }

  if (catVal) {
 const { data: catRow } = await supabase
  .from('categorias')
  .select('id')
  .eq('nombre', catVal)
  .eq('negocio_id', NEGOCIO_ID)   // 🟣 obligatorio
  .maybeSingle()


    if (catRow && catRow.id) {
      query = query.eq('categoria_id', catRow.id)
    }
  }

  // 👉 aplicar orden
  if (sortField) {
    query = query.order(sortField, { ascending: sortAsc })
  }

  const { data, error, count } = await query

  if (error) {
    console.error(error)
    tbody.innerHTML = `<tr><td class="td" colspan="10">⚠️ Error al consultar.</td></tr>`
    return
  }

  renderTabla(data || [])
  actualizarPaginacion(count)
  marcarOrden()
}

// --- Eventos botones búsqueda ---
btnBuscar?.addEventListener("click", () => {
  page = 1        // 👈 volver a la primera página
  buscar()
})

btnLimpiar?.addEventListener("click", () => {
  q.value = ""
  cat.value = ""
  page = 1        // 👈 volver a la primera página
  buscar()
})

// --- Render tabla ---
function renderTabla(rows) {
  if (!rows.length) {
    tbody.innerHTML = `<tr><td class="td text-center py-4" colspan="11">📭 Sin resultados.</td></tr>`
    return
  }

  const ph = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">
       <rect width="100%" height="100%" fill="#f3f4f6"/>
       <text x="50%" y="50%" font-size="10" fill="#9ca3af"
             dominant-baseline="middle" text-anchor="middle">Sin img</text>
     </svg>`
  )

  tbody.innerHTML = rows.map(r => {
    // --- Imagen con control de caché y verificación segura ---
    let img = r.imagen_url && typeof r.imagen_url === "string" ? r.imagen_url.trim() : null;

    // ⚙️ Corregir rutas con espacios o comillas accidentales
    if (img && img.startsWith("http")) {
      img = img.replaceAll(" ", "%20"); // evita error 403 si hay espacios
    }

    const imgSrc = img ? `${img}?v=${r.updated_at || ''}` : ph; 

    const imgTag = `
      <button type="button" class="btnImg" data-img="${img || ''}" 
        data-barcode="${r.codigo_barras || ''}" data-desc="${r.descripcion || ''}">
        <img class="thumb" 
            src="${imgSrc}" 
            alt="${r.nombre || ''}"
            loading="lazy"
            onerror="this.onerror=null;this.src='${ph}'">
      </button>`;
// --- Existencias con colores (más limpio) ---
const existenciasNum = r.existencias_total != null ? parseFloat(r.existencias_total) : 0
const unidadTxt = r.unidad ? ` ${r.unidad}` : ''
let existenciasBadge = `<span class="badge-stock bg-green-100 text-green-700">${existenciasNum}${unidadTxt}</span>`

if (existenciasNum === 0) {
  existenciasBadge = `<span class="badge-stock bg-red-100 text-red-700">Sin stock</span>`
} else if (existenciasNum < (r.stock_minimo || 5)) {
  existenciasBadge = `<span class="badge-stock bg-yellow-100 text-yellow-700">Bajo (${existenciasNum}${unidadTxt})</span>`
}
// --- Stock mínimo ---
const minimoBadge = r.stock_minimo != null
  ? `<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">${r.stock_minimo}</span>`
  : '—'
  const precio = Number(r.precio_base || 0)
    const costo = Number(r.costo || 0)

    const ganancia = (precio - costo)

   
    let colorGanancia = "bg-fuchsia-100 text-fuchsia-700"

if (ganancia < 0) {
  colorGanancia = "bg-red-200 text-red-800"
}

  const margen = calcularMargen(precio, costo)

let color = "bg-green-100 text-green-700"

if (margen < 20) {
  color = "bg-red-100 text-red-700"
} else if (margen < 40) {
  color = "bg-yellow-100 text-yellow-700"
}


 return `
  <tr class="bg-white shadow-sm rounded-lg hover:shadow-md transition cursor-pointer hover:bg-fuchsia-50 animate-fade-in">
    <td class="td font-mono">${r.sku ?? ''}</td>

      <td class="td font-mono text-xs">
      ${r.codigo_barras ?? ''}
      </td>

      <td class="td">${imgTag}</td>

      <td class="td editable" data-campo="nombre" data-id="${r.id}">
      <span class="valor">${r.nombre ?? ''}</span>
      </td>   
      <td class="td editable" data-campo="precio_base" data-id="${r.id}">
      <span class="valor">$${Number(precio).toFixed(2)}</span>
      </td>
      <td class="td editable" data-campo="costo" data-id="${r.id}">
      <span class="valor">$${Number(costo).toFixed(2)}</span>
      </td>
      <td class="td editable" data-campo="margen" data-id="${r.id}">
        <span class="valor margen px-2 py-1 rounded-full text-sm font-bold ${color}">
          ${margen.toFixed(1)}%
        </span>
      </td>

      <td class="td">
        <span class="ganancia px-2 py-1 rounded-full text-sm font-bold ${colorGanancia}">
          $${ganancia.toFixed(2)}
        </span>
      </td> 
      <td class="td">${existenciasBadge}</td>
    <td class="td editable" data-campo="stock_minimo" data-id="${r.id}">
      <span class="valor">${r.stock_minimo ?? 0}</span>
      </td>
      <td class="td">${r.caducidad_proxima ? new Date(r.caducidad_proxima).toLocaleDateString() : '—'}</td>
    
          <td class="td">
          <div class="flex gap-2 justify-center items-center">
            <button class="btn-icon hover:bg-fuchsia-100 hover:text-fuchsia-700 transition"
                    data-edit="${r.id}" title="Editar producto">
              <i data-lucide="edit-3" class="w-5 h-5"></i>
            </button>
            <button class="btn-icon hover:bg-red-100 hover:text-red-700 transition"
                    data-delete="${r.id}" data-name="${r.nombre}" title="Eliminar producto">
              <i data-lucide="trash-2" class="w-5 h-5"></i>
            </button>
          </div>
        </td>


  </tr>`
  }).join('')

  setTimeout(() => {
  lucide.createIcons()
}, 0)
}

// --- Listener clicks ---
  tbody.addEventListener('click', async (ev) => {
    const btnImg = ev.target.closest('button[data-img]');
    if (btnImg) {
      const url = btnImg.dataset.img;
      const barcode = btnImg.dataset.barcode || 'Código de barras';
      const desc = btnImg.dataset.desc || 'Sin descripción disponible';

      if (!url) {
        return Swal.fire('Sin imagen', 'Este producto aún no tiene imagen.', 'info');
      }

      Swal.fire({
        title: barcode,
        html: `
          <img src="${url}" alt="${barcode}" 
              style="max-width:90vw;max-height:60vh;border-radius:12px;display:block;margin:0 auto;">
          <p style="margin-top:1rem;font-size:14px;color:#374151;">${desc}</p>
        `,
        showCloseButton: true,
        showConfirmButton: false,
        width: 'auto',
        background: '#fff',
      });
      return;
    }

    // 🗑️ Eliminar producto
    const btnDelete = ev.target.closest('button[data-delete]');
    if (btnDelete) {
      const id = btnDelete.dataset.delete;
      const nombre = btnDelete.dataset.name;

      const confirm = await Swal.fire({
        icon: "warning",
        title: "¿Eliminar producto?",
        html: `<b>${nombre}</b><br>Esta acción no se puede deshacer.`,
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#dc2626",
        background: "#fff",
        customClass: { popup: "card-3d" },
      });

      if (!confirm.isConfirmed) return;

      // 🧹 Limpieza automática de imágenes viejas antes de eliminar
      try {
        await supabase.rpc("exec_sql", {
          query: `
            update productos
            set imagen_url = null, imagen_nombre = null
            where imagen_url ~ 'product-images/[a-zA-Z]+/[0-9]+'
              and imagen_url not like '%/prod_%';
          `,
        });

        await supabase.rpc("exec_sql", {
          query: `
            update productos
            set imagen_nombre = regexp_replace(imagen_url, '^.*product-images/', '')
            where imagen_url like '%/prod_%'
              and (imagen_nombre is null or imagen_nombre = '');
          `,
        });

        console.log("🧹 Limpieza de imágenes realizada automáticamente.");
      } catch (err) {
        console.warn("⚠️ Error limpiando imágenes previas:", err.message);
      }


      // 🔎 Buscar imagen actual (si tiene)
      const { data: prod, error: errProd } = await supabase
      .from("productos")
      .select("imagen_url")
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .maybeSingle();

      if (errProd) {
        console.error(errProd);
        Swal.fire("Error", "No se pudo obtener la imagen del producto.", "error");
        return;
      }

      // 🗑️ Eliminar imagen del bucket si existe
      if (prod?.imagen_url && !prod.imagen_url.includes("sin_imagen")) {
        try {
          // Extraer la ruta real dentro del bucket
          const partes = prod.imagen_url.split("/object/public/product-images/");
          if (partes.length > 1) {
            const oldPath = decodeURIComponent(partes[1]); // ✅ soporta subcarpetas y espacios

            const { error: delErr } = await supabase.storage
              .from("product-images")
              .remove([oldPath]);

            if (delErr) {
              console.warn("⚠️ No se pudo eliminar imagen:", delErr.message);
            } else {
              console.log("🧹 Imagen eliminada correctamente:", oldPath);
            }
          } else {
            console.warn("⚠️ No se pudo determinar la ruta interna del archivo:", prod.imagen_url);
          }
        } catch (err) {
          console.error("Error eliminando imagen:", err);
        }
      }

      // 🗑️ Eliminar registro del producto
      const { error: deleteError } = await supabase
        .from("productos")
        .delete()
        .eq("id", id)
        .eq("negocio_id", negocioId)


      if (deleteError) {
        console.error(deleteError);
        Swal.fire("Error", "No se pudo eliminar el producto.", "error");
        return;
      }

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Producto eliminado",
        timer: 1500,
        showConfirmButton: false,
      });

      buscar(); // 🔄 refrescar tabla
      return;
    }

    // ✏️ Editar producto
    const btnEdit = ev.target.closest('button[data-edit]');
    if (!btnEdit) return;
    const id = btnEdit.dataset.edit;

    const { data, error } = await supabase
    .from("productos")
    .select("*")
    .eq("id", id)
    .eq("negocio_id", negocioId)
    .maybeSingle();

    if (error) return Swal.fire('Error', 'No se pudo cargar el producto', 'error');
    if (!data) return Swal.fire('Sin datos', 'No se encontró el producto', 'info');

    // 🧩 Obtener inputs desde el modal (evita null)
    const f_id        = modal.querySelector('#e_id');
    const f_sku       = modal.querySelector('#e_sku');
    const f_barcode   = modal.querySelector('#e_barcode');
    const f_nombre    = modal.querySelector('#e_nombre');
    const f_desc      = modal.querySelector('#e_desc');
    const f_categoria = modal.querySelector('#e_categoria');
    const f_precio    = modal.querySelector('#e_precio');
    const f_costo     = modal.querySelector('#e_costo');
    const f_activo    = modal.querySelector('#e_activo');
    const f_minimo    = modal.querySelector('#e_minimo');

    // ✏️ Asignar valores de forma segura
    if (f_id)        f_id.value = data.id;
    if (f_sku)       f_sku.value = data.sku ?? '';
    if (f_barcode)   f_barcode.value = data.codigo_barras ?? '';
    if (f_nombre)    f_nombre.value = data.nombre ?? '';
    if (f_desc)      f_desc.value = data.descripcion ?? '';
    if (f_precio)    f_precio.value = data.precio_base ?? 0;
    if (f_costo)     f_costo.value = data.costo ?? 0;
    if (f_activo)    f_activo.value = String(!!data.activo);
    if (f_minimo)    f_minimo.value = data.stock_minimo ?? 0;

    // 🟣 CARGAR EXISTENCIAS REALES
    const f_existencias = modal.querySelector('#e_existencias');

    const { data: vistaStock } = await supabase
      .from("v_productos_existencias")
      .select("existencias_total, unidad")
      .eq("id", id)
      .eq("negocio_id", NEGOCIO_ID)
      .maybeSingle();

    if (f_existencias) {
      f_existencias.value = vistaStock?.existencias_total || 0;

      // 🔐 Solo admin puede editar
      if (usuario?.rol !== "admin") {
        f_existencias.disabled = true;
      } else {
        f_existencias.disabled = false;
      }
    }


    // 📂 Categoría (consulta igual que antes)
    let catRow = null;
    if (data.categoria_id) {
      const { data: catData } = await supabase
        .from('categorias')
        .select('nombre')
        .eq('id', data.categoria_id)
        .maybeSingle();
      catRow = catData;
    }

    if (f_categoria) {
      f_categoria.value = catRow?.nombre ?? '';
    }


    // 📸 Mostrar imagen actual
    mostrarImagen(data.imagen_url || null);
    if (preview) {
      preview.dataset.originalUrl = data.imagen_url || null;
    }
    // 🔄 Reset imagen temporal
    imagenFile = null;
    if (fileInput) fileInput.value = "";

    if (!data.imagen_url) {
      imagenFile = null;

    }

    openModal();
    setTimeout(inicializarImagenesModal, 0);

  });

/* ---------------------------------------------------------
   ✏️ EDICIÓN RÁPIDA EN TABLA (DOBLE CLICK)
--------------------------------------------------------- */

tbody.addEventListener("dblclick", (ev) => {

  const celda = ev.target.closest(".editable")
  if (!celda) return

  const campo = celda.dataset.campo
  const valorActual = celda.innerText
  .replace("$","")
  .replace("%","")
  .trim()

  let tipo = "number"
  let step = "0.01"

  let esTextoLargo = false

  if (campo === "nombre") {
    tipo = "text"
    step = ""
    esTextoLargo = true
  }

 celda.innerHTML = esTextoLargo
? `
<textarea
  class="editor w-full px-2 py-1 text-sm
  border border-fuchsia-400
  rounded-md
  bg-white
  shadow-sm
  focus:outline-none
  focus:ring-2
  focus:ring-fuchsia-400
  resize-none"
  rows="2">${valorActual}</textarea>
`
: `
<input
  class="editor w-full px-2 py-1 text-sm
  border border-fuchsia-400
  rounded-md
  bg-white
  shadow-sm
  focus:outline-none
  focus:ring-2
  focus:ring-fuchsia-400
  text-center"
  type="${tipo}"
  ${step ? `step="${step}"` : ""}
  value="${valorActual}"
  data-original="${valorActual}">
`

  const input = celda.querySelector(".editor")

  input.focus()
  input.select()

  // ⭐ NUEVO: manejo de teclado
  input.addEventListener("keydown", (e) => {

    if (e.key === "Enter") {
      input.blur() // guarda
    }

    if (e.key === "Escape") {
      celda.innerHTML = `<span class="valor">${valorActual}</span>` // cancela
    }

  })

})

function leerNumero(celda) {

  if (!celda) return 0

  // si está en edición
  const editor = celda.querySelector(".editor")
  if (editor) {
    return Number(editor.value.replace(/[$%]/g,"")) || 0
  }

  // si está normal
  const valor = celda.querySelector(".valor")
  if (valor) {
    return Number(valor.innerText.replace(/[$%]/g,"")) || 0
  }

  return 0
}

tbody.addEventListener("input", (ev) => {

  const input = ev.target
  if (!input.classList.contains("editor")) return

  const celda = input.closest(".editable")
  const fila = celda.closest("tr")
  const campo = celda.dataset.campo

  let precio = leerNumero(fila.querySelector('[data-campo="precio_base"]'))
  let costo  = leerNumero(fila.querySelector('[data-campo="costo"]'))
  let margen = leerNumero(fila.querySelector('[data-campo="margen"]'))
 

    let valor = String(input.value)
    .replace(/[^0-9.]/g, "")
    .trim()

  if (valor === "") return

  valor = Number(valor)

  if (campo === "margen") {
  valor = Math.min(valor, 500) // evita locuras
}

  if (isNaN(valor)) return

  /* ===============================
     CAMPO EDITADO
  ============================== */

  if (campo === "precio_base") {

    precio = valor

    margen = calcularMargen(precio, costo) // 🔥 FIX

  }

  if (campo === "costo") {

    costo = valor

    // mantener margen actual
    precio = calcularPrecioDesdeMargen(costo, margen)

  }

  if (campo === "margen") {

    margen = valor

    precio = calcularPrecioDesdeMargen(costo, margen) // 🔥 FIX

  }
  /* ===============================
     CALCULOS
  ============================== */

const ganancia = precio - costo

const margenCell = fila.querySelector(".margen")
const gananciaCell = fila.querySelector(".ganancia")
const precioCell = fila.querySelector('[data-campo="precio_base"] .valor')
if (precioCell) {
  precioCell.textContent = "$" + precio.toFixed(2)
}

let colorGanancia = "bg-fuchsia-100 text-fuchsia-700"

if (ganancia < 0) {
  colorGanancia = "bg-red-200 text-red-800"
}

if (gananciaCell) {
  gananciaCell.className =
    `ganancia px-2 py-1 rounded-full text-sm font-bold ${colorGanancia}`

  gananciaCell.textContent = "$" + ganancia.toFixed(2)
}

if (ganancia < 0) {
  gananciaCell.title = "⚠️ Estás perdiendo dinero"
} else {
  gananciaCell.title = ""
}


 if (margenCell) {

  let color = "bg-green-100 text-green-700"

  if (margen < 20) {
    color = "bg-red-100 text-red-700"
  } 
  else if (margen < 40) {
    color = "bg-yellow-100 text-yellow-700"
  }

  margenCell.className =
    `valor margen px-2 py-1 rounded-full text-sm font-bold ${color}`

  margenCell.textContent = margen.toFixed(1) + "%"
}

  })

tbody.addEventListener("blur", (ev) => {

  const input = ev.target
  if (!input.classList.contains("editor")) return

  const celda = input.closest(".editable")
  const fila = celda.closest("tr")

  const id = celda.dataset.id
    if (!id) return
  const campo = celda.dataset.campo

  if (!["precio_base","costo","stock_minimo","nombre","margen"].includes(campo)) return

  let valor = input.value

  // ⭐ evitar cambios si no modificó nada
  if (String(valor).trim() === String(input.dataset.original).trim()) {

    if (campo === "margen") {
      celda.innerHTML = `<span class="valor margen">${input.defaultValue}%</span>`
    } else {
      celda.innerHTML = `<span class="valor">${input.defaultValue}</span>`
    }

    return
  }

  // 🔢 normalizar número
  if (campo !== "nombre") {
    let v = String(valor).replace(/[^0-9.]/g, "").trim()

    if (v === "") {
      celda.innerHTML = `<span class="valor">${input.defaultValue}</span>`
      return
    }

    valor = Number(v)
  }

  let precio = leerNumero(fila.querySelector('[data-campo="precio_base"]'))
  let costo  = leerNumero(fila.querySelector('[data-campo="costo"]'))

  // 🔹 lógica de negocio
  if (campo === "costo") {
    costo = valor

    const margenActual = leerNumero(
      fila.querySelector('[data-campo="margen"]')
    )

    precio = calcularPrecioDesdeMargen(costo, margenActual)

    const precioCell = fila.querySelector('[data-campo="precio_base"] .valor')
    if (precioCell) {
      precioCell.textContent = "$" + precio.toFixed(2)
    }
  }

  if (campo === "margen") {
    precio = calcularPrecioDesdeMargen(costo, valor)

    const precioCell = fila.querySelector('[data-campo="precio_base"] .valor')
    if (precioCell) {
      precioCell.textContent = "$" + precio.toFixed(2)
    }
  }

  // 🖥️ pintar UI
  if (campo === "nombre") {
    celda.innerHTML = `<span class="valor">${valor}</span>`
  }
  else if (campo === "stock_minimo") {
    celda.innerHTML = `<span class="valor">${valor}</span>`
  }
  else if (campo === "margen") {

    let color = "bg-green-100 text-green-700"

    if (valor < 20) color = "bg-red-100 text-red-700"
    else if (valor < 40) color = "bg-yellow-100 text-yellow-700"

    celda.innerHTML = `
      <span class="valor margen px-2 py-1 rounded-full text-sm font-bold ${color}">
        ${valor}%
      </span>`
  }
  else {
    celda.innerHTML = `<span class="valor">$${Number(valor).toFixed(2)}</span>`
  }

  // 🔥 recalcular margen / ganancia visual
  const ganancia = precio - costo

  const margenCell = fila.querySelector(".margen")
  const gananciaCell = fila.querySelector(".ganancia")

  let margen = calcularMargen(precio, costo)

  if (margenCell) {

    let color = "bg-green-100 text-green-700"

    if (margen < 20) color = "bg-red-100 text-red-700"
    else if (margen < 40) color = "bg-yellow-100 text-yellow-700"

    margenCell.className =
      `valor margen px-2 py-1 rounded-full text-sm font-bold ${color}`

    margenCell.textContent = margen.toFixed(1) + "%"
  }

  let colorGanancia = "bg-fuchsia-100 text-fuchsia-700"
  if (ganancia < 0) colorGanancia = "bg-red-200 text-red-800"

  if (gananciaCell) {
    gananciaCell.className =
      `ganancia px-2 py-1 rounded-full text-sm font-bold ${colorGanancia}`

    gananciaCell.textContent = "$" + ganancia.toFixed(2)
  }

  /* ---------------------------------------------------------
     🧠 GUARDAR EN MEMORIA (AQUÍ VA TU BLOQUE)
  --------------------------------------------------------- */

  if (!cambiosPendientes[id]) {
    cambiosPendientes[id] = {}
  }

  if (campo === "margen") {
    cambiosPendientes[id]["precio_base"] = precio
  } else {
    cambiosPendientes[id][campo] = valor
  }

  hayCambios = true

  actualizarBotonGuardar()

  // 🎨 marcar fila
  fila.classList.add("bg-yellow-50", "ring-2", "ring-yellow-300")

}, true)

// --- Guardar cambios ---
    formEdit.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = e_id.value;
    const nombre = e_nombre.value.trim();
    const desc = e_desc.value.trim();
    const precio = Number(e_precio.value || 0);
    const costo = Number(e_costo.value || 0);
    const barcode = e_barcode.value.trim() || null;
    const activo = e_activo.value === "true";
    const categoriaNombre = e_categoria.value.trim();
    const minimo = Number(e_minimo.value || 0);    
    let nuevoStock = document.getElementById("e_existencias")?.value;

    if (nuevoStock !== "" && nuevoStock !== null) {
      nuevoStock = Number(nuevoStock);
    }

    Swal.fire({
      title: "Guardando cambios...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    // 🔹 Resolver categoría
   let categoria_id = null;

    if (categoriaNombre) {
      const nombreCat = categoriaNombre.trim();

  const { data: existe } = await supabase
    .from("categorias")
    .select("id")
    .eq("nombre", nombreCat)
    .eq("negocio_id", NEGOCIO_ID)
    .maybeSingle();

  if (existe?.id) {
    categoria_id = existe.id;
  } else {
    const { data: nueva } = await supabase
      .from("categorias")
      .insert({
        nombre: nombreCat,
        negocio_id: NEGOCIO_ID,
      })
      .select()
      .single();

    categoria_id = nueva.id;
  }
}

    // ----------------------------------------------------------------------
    // 📸 Subida de imagen
    // ----------------------------------------------------------------------
 
      let imagen_url = null;
      let imagen_nombre = null;

      try {

     if (imagenFile) {
          // 🧹 eliminar imagen anterior si existe
          const { data: actual } = await supabase
            .from("productos")
            .select("imagen_nombre")
            .eq("id", id)
            .maybeSingle();

          if (actual?.imagen_nombre) {
            await supabase.storage
              .from("product-images")
              .remove([actual.imagen_nombre]);
          }

          // ⬆️ subir nueva imagen
          const archivoFinal = imagenFile;
          imagen_nombre = `prod_${id}_${Date.now()}.webp`;

          const { error: upErr } = await supabase.storage
            .from("product-images")
            .upload(imagen_nombre, archivoFinal, {
              contentType: "image/webp",
              upsert: true,
            });

          if (upErr) throw upErr;

          const { data: pub } = await supabase.storage
            .from("product-images")
            .getPublicUrl(imagen_nombre);

          imagen_url = pub.publicUrl;

        } else {
          // 🔒 conservar imagen existente
          const { data: actual } = await supabase
            .from("productos")
            .select("imagen_url, imagen_nombre")
            .eq("id", id)
            .maybeSingle();

          imagen_url =
            actual?.imagen_url ??
            preview?.dataset?.originalUrl ??
            null;
          imagen_nombre = actual?.imagen_nombre ?? null;
        }

      } catch (err) {
        console.error("⚠️ Error optimizando/subiendo imagen:", err);
        Swal.fire("Error", "No se pudo subir la imagen", "error");
        Swal.close();
        return; // ⛔ aborta todo el guardado
      }

    // ----------------------------------------------------------------------
    // 💾 Actualizar producto
    // ----------------------------------------------------------------------
    const campos = {
      sku: e_sku.value.trim(),
      nombre,
      descripcion: desc,
      categoria_id,
      precio_base: precio,
      costo,
      codigo_barras: barcode,
      stock_minimo: minimo,
      activo,
    };

    // 🔥 AGREGAR ESTO
    if (imagen_url) campos.imagen_url = imagen_url;
    if (imagen_nombre) campos.imagen_nombre = imagen_nombre;

    // 🔄 AJUSTE INTELIGENTE DE INVENTARIO (SOLO ADMIN)
      // 🔄 AJUSTE INTELIGENTE DE INVENTARIO (SOLO ADMIN)
if (usuario?.rol === "admin") {

  if (!NEGOCIO_ID) {
    console.error("❌ NEGOCIO_ID es NULL o undefined");
    Swal.fire("Error", "No se encontró el negocio_id", "error");
    return;
  }

  const { data: vistaActual, error: errVista } = await supabase
    .from("v_productos_existencias")
    .select("existencias_total, unidad")
    .eq("id", id)
    .eq("negocio_id", NEGOCIO_ID)
    .maybeSingle();

  if (errVista) {
    console.error("❌ Error obteniendo stock actual:", errVista);
    Swal.fire("Error", "No se pudo obtener el inventario actual", "error");
    return;
  }

  const stockActual = Number(vistaActual?.existencias_total) || 0;
  const unidadActual = vistaActual?.unidad || "pieza";

  const diferencia = Number(nuevoStock) - stockActual;

  console.log("Stock actual:", stockActual);
  console.log("Nuevo stock:", nuevoStock);
  console.log("Diferencia:", diferencia);
  console.log("NEGOCIO_ID:", NEGOCIO_ID);

  if (diferencia !== 0) {

    if (diferencia > 0) {

      const { error: errEntrada } = await supabase.rpc(
        "registrar_entrada_inventario",
        {
          p_producto_id: String(id),
          p_cantidad: Number(diferencia),
          p_unidad: String(unidadActual),
          p_ubicacion: "Ajuste manual admin",
          p_negocio_id: String(NEGOCIO_ID)
        }
      );

      if (errEntrada) {
        console.error("❌ Error en entrada:", errEntrada);
        Swal.fire("Error", errEntrada.message, "error");
        return;
      }

    } else {

      const { error: errSalida } = await supabase.rpc(
        "registrar_salida_inventario",
        {
          p_producto_id: String(id),
          p_cantidad: Number(Math.abs(diferencia)),
          p_unidad: String(unidadActual),
          p_ubicacion: "Ajuste manual admin",
          p_negocio_id: String(NEGOCIO_ID)
        }
      );

      if (errSalida) {
        console.error("❌ Error en salida:", errSalida);
        Swal.fire("Error", errSalida.message, "error");
        return;
      }
    }
  }
}


    const { error } = await supabase
    .from("productos")
    .update(campos)
    .eq("id", id)
    .eq("negocio_id", negocioId)


    Swal.close();

    if (error) {
      console.error("❌ Error actualizando producto:", error);
      Swal.fire("Error", "No se pudo guardar el producto", "error");
      return;
    }

    Swal.fire({
      icon: "success",
      title: "Producto actualizado",
      timer: 1200,
      showConfirmButton: false,
    });

    closeModal();
    setTimeout(() => buscar(), 500);
  });
           
// Modal
function openModal(){ modal.classList.remove('hidden') }
function closeModal() {
  modal.classList.add('hidden');

  imagenFile = null;

  if (fileInput) fileInput.value = "";

  mostrarImagen(null);
}
btnCancel?.addEventListener('click', closeModal)


// ---------- CSV ----------
document.getElementById("btnPlantilla")?.addEventListener("click", async (e) => {
  e.preventDefault();

  Swal.fire({ title: "Generando Excel...", didOpen: () => Swal.showLoading() });

  const { data, error } = await supabase
  .from("v_productos_existencias")
  .select(`
    sku,
    nombre,
    categoria_nombre,
    precio_base,
    costo,
    codigo_barras,
    existencias_total,
    caducidad_proxima,
    activo
  `)
  .eq("negocio_id", negocioId)


  if (error) {
    console.error(error);
    Swal.fire("Error", "No se pudo generar el Excel", "error");
    return;
  }

  if (!data || !data.length) {
    Swal.fire("Vacío", "No hay productos para exportar", "info");
    return;
  }

  // Adaptamos encabezados como tu frontend
  const rows = data.map(r => ({
    SKU: r.sku || "-",
    Nombre: r.nombre || "-",
    Categoría: r.categoria_nombre || "-",
    Precio: Number(r.precio_base ?? 0).toFixed(2),
    Costo: Number(r.costo ?? 0).toFixed(2),
    "Código de Barras": r.codigo_barras || "-",
    Existencias: r.existencias_total || 0,
    "Caducidad Próxima": r.caducidad_proxima ? new Date(r.caducidad_proxima).toLocaleDateString() : "—",
    Activo: r.activo ? "Sí" : "No"
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");

  XLSX.writeFile(workbook, `Inventario_${new Date().toISOString().split("T")[0]}.xlsx`);

  Swal.close();
});


// --- Orden por encabezados ---
document.querySelectorAll("th[data-field]").forEach(th => {
  th.style.cursor = "pointer"
  th.addEventListener("click", () => {
    const field = th.dataset.field
    if (sortField === field) {
      sortAsc = !sortAsc
    } else {
      sortField = field
      sortAsc = true
    }
    page = 1
    buscar()
  })
})

function marcarOrden() {

  const columnasEditables = [
    "nombre",
    "precio_base",
    "costo",
    "margen",
    "stock_minimo"
  ]

  document.querySelectorAll("th[data-field]").forEach(th => {

    const label = th.dataset.label
    const field = th.dataset.field

    let iconoLapiz = ""

    if (columnasEditables.includes(field)) {
      iconoLapiz = `<i data-lucide="pencil" class="w-3 h-3 opacity-70"></i>`
    }

    th.innerHTML = `
      <span class="inline-flex items-center gap-1">
        ${label}
        ${iconoLapiz}
      </span>
    `

  })

  if (sortField) {

    const th = document.querySelector(`th[data-field="${sortField}"]`)

    if (th) {

      const icon = sortAsc
        ? `<i data-lucide="chevron-up" class="w-4 h-4 sort-icon"></i>`
        : `<i data-lucide="chevron-down" class="w-4 h-4 sort-icon"></i>`

      th.querySelector("span").insertAdjacentHTML("beforeend", icon)

    }
  }

  lucide.createIcons()
}
function actualizarPaginacion(totalRows) {
  const totalPages = Math.ceil(totalRows / pageSize) || 1

  // botones
  prev.disabled = page <= 1
  next.disabled = page >= totalPages

  // texto de página
  const pageLbl = document.getElementById("page")
  if (pageLbl) {
    pageLbl.textContent = `${page} / ${totalPages}`
  }

  // rango mostrado
  const desde = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, totalRows)

  const rangoLbl = document.getElementById("lblRango")
  if (rangoLbl) {
    rangoLbl.textContent = `${desde}–${hasta}`
  }
}


// ---------- CARGAR CSV (actualiza o inserta productos) ----------
document.getElementById("csvInput")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  Swal.fire({
    title: "Procesando CSV...",
    text: "Por favor espera mientras se cargan los productos",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const parsed = await new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: resolve,
        error: reject,
      });
    });

    const productos = parsed.data || [];
    if (!productos.length) {
      throw new Error("El archivo está vacío o sin formato válido");
    }

    console.log("📦 Productos leídos del CSV:", productos.length);

    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;

    for (const p of productos) {
      const sku = p.sku?.trim() || null;
      const codigo = p.codigo_barras?.trim() || p.codigo?.trim() || null;

      if (!sku && !codigo) {
        console.warn("⛔ Fila sin SKU ni código:", p);
        continue;
      }
    
      // 🔍 Buscar producto existente
      let filtros = [];
      if (sku) filtros.push(`sku.eq.${sku}`);
      if (codigo) filtros.push(`codigo_barras.eq.${codigo}`);

     const { data, error } = await supabase
      .from("v_productos_existencias")
      .select("id, existencias_total, unidad")
      .or(filtros.join(","))
      .eq("negocio_id", NEGOCIO_ID)
      .limit(1);

    const producto = data?.[0] || null;


       if (!producto) {
      // ➕ PRODUCTO NUEVO
      const unidad = ["kg", "kilo", "kilogramo"].includes(
        String(p.unidad || "").toLowerCase()
      )
        ? "kg"
        : "pieza";

      const { data: nuevo, error: errNuevo } = await supabase
        .from("productos")
        .insert({
          negocio_id: NEGOCIO_ID,
          sku,
          nombre: p.nombre?.trim() || "",
          descripcion: p.descripcion?.trim() || "",
          precio_base: Number(p.precio_base || 0),
          costo: Number(p.costo || 0),
          codigo_barras: codigo,
          stock_minimo: Number(p.stock_minimo || 0),
          unidad,
          activo: ["true", "si", "1"].includes(String(p.activo).toLowerCase()),
        })
        .select()
        .single();

      if (errNuevo) {
        console.error("❌ Error insertando producto:", errNuevo.message);
        continue;
      }

      const cantidadInicial = Number(p.existencias || 0);

      if (cantidadInicial > 0) {
        await supabase.rpc("registrar_entrada_inventario", {
          p_producto_id: nuevo.id,
          p_cantidad: cantidadInicial,
          p_unidad: unidad,
          p_ubicacion: "Carga CSV",
          p_negocio_id: NEGOCIO_ID,
        });
      }

      console.log(`🆕 Producto creado (${sku || codigo})`);
      creados++;
      continue;
    }
   
      /* -------------------------------------------------
        📦 LÓGICA DE EXISTENCIAS (CSV = SUMA DIRECTA)
      ------------------------------------------------- */
      const cantidad = Number(p.existencias || 0);

      if (cantidad > 0) {
        // ⚖️ Normalizar unidad
        let unidadRaw = String(p.unidad || producto.unidad || "")
          .toLowerCase()
          .trim();

        const unidad = ["kg", "kilo", "kilogramo"].includes(unidadRaw)
          ? "kg"
          : "pieza";

        const { error: errEntrada } = await supabase.rpc(
          "registrar_entrada_inventario",
          {
            p_producto_id: producto.id,
            p_cantidad: cantidad,
            p_unidad: unidad,
            p_ubicacion: "Carga CSV",
            p_negocio_id: NEGOCIO_ID,
          }
        );

        if (errEntrada) {
          console.error("❌ Error sumando stock:", errEntrada.message);
          continue;
        }

        console.log(`📥 Stock sumado (${sku || codigo}): +${cantidad}`);
        actualizados++;
      } else {
        console.log(`⏸ Sin movimiento de stock (${sku || codigo})`);
        sinCambios++;
      }


      /* -------------------------------------------------
        ✏️ ACTUALIZAR CAMPOS (NO INVENTARIO)
      ------------------------------------------------- */
      const campos = {
        precio_base: p.precio_base ? Number(p.precio_base) : undefined,
        costo: p.costo ? Number(p.costo) : undefined,
        stock_minimo: p.stock_minimo ? Number(p.stock_minimo) : undefined,
        activo:
          p.activo !== undefined
            ? ["true", "si", "1"].includes(String(p.activo).toLowerCase())
            : undefined,
        unidad: p.unidad
          ? ["kg", "kilo", "kilogramo"].includes(
              String(p.unidad).toLowerCase()
            )
            ? "kg"
            : "pieza"
          : undefined,
      };

      // 🧹 limpiar undefined
      Object.keys(campos).forEach(k => campos[k] === undefined && delete campos[k]);

      let huboCambios = false;

      if (Object.keys(campos).length) {
        await supabase
          .from("productos")
          .update(campos)
          .eq("id", producto.id)
          .eq("negocio_id", NEGOCIO_ID);

        huboCambios = true;
      }    
    }
  
    Swal.fire({
      icon: "success",
      title: "CSV procesado",
      html: `
        🆕 Nuevos: <b>${creados}</b><br>
        ✏️ Actualizados: <b>${actualizados}</b><br>
        ⏸️ Sin cambios: <b>${sinCambios}</b>
      `,
    });

    buscar(); // 🔄 refrescar tabla
  } catch (err) {
    console.error("❌ Error al cargar CSV:", err);
    Swal.fire(
      "Error",
      err.message || "No se pudo procesar el archivo CSV",
      "error"
    );
  } finally {
    e.target.value = ""; // limpiar input
  }
});

// ---------- DESCARGAR PLANTILLA CSV ----------
document.getElementById("btnPlantillaCSV")?.addEventListener("click", async () => {
  Swal.fire({
    title: "Generando plantilla…",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    // 🔹 Traer TODOS los productos del negocio
    const { data, error } = await supabase
      .from("productos")
      .select(`
        id,
        negocio_id,
        sku,
        nombre,
        descripcion,
        categoria_id,
        precio_base,
        costo,
        codigo_barras,
        stock_minimo,
        unidad,
        activo
      `)
      .eq("negocio_id", negocioId)
      .order("nombre");

    if (error) throw error;

    // 🔹 Si no hay productos, aún así damos estructura vacía
    const rows = (data?.length ? data : [{}]).map(p => ({
      sku: p.sku || "",
      nombre: p.nombre || "",
      descripcion: p.descripcion || "",
      categoria: "",            // 👈 nombre humano
      precio_base: p.precio_base ?? "",
      costo: p.costo ?? "",
      codigo_barras: p.codigo_barras || "",
      existencias: "",
      stock_minimo: p.stock_minimo ?? "",
      unidad: ["kg", "pieza"].includes(p.unidad) ? p.unidad : "pieza",
      activo: p.activo === false ? "false" : "true",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");

    XLSX.writeFile(
      workbook,
      `Plantilla_Productos_${negocioId.slice(0, 6)}.xlsx`
    );

    Swal.fire({
      icon: "success",
      title: "Plantilla lista",
      text: "Edita este archivo y súbelo con 'Cargar CSV'",
      timer: 2200,
      showConfirmButton: false,
    });

  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudo generar la plantilla", "error");
  }
});

// ---------- Init ----------
await cargarCategorias();
await buscar();

q.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    page = 1;
    buscar();
  }
});

/* -------------------------------------------------------------------------- */
/* 💾 CACHE LOCAL Y SINCRONIZACIÓN OFFLINE                                   */
/* -------------------------------------------------------------------------- */


const CACHE_KEY_PRODS = "smartpos_productos_cache";
const CACHE_KEY_TIME = "smartpos_productos_cache_time";
const CACHE_SYNC_PENDING = "smartpos_productos_pendientes";

// 🕓 Guardar los productos mostrados en cache local
async function cachearProductos(rows) {
  if (!rows?.length) return;
  try {
    localStorage.setItem(CACHE_KEY_PRODS, JSON.stringify(rows));
    localStorage.setItem(CACHE_KEY_TIME, new Date().toISOString());
    console.log(`💾 ${rows.length} productos cacheados localmente.`);
  } catch (err) {
    console.warn("⚠️ Error al cachear productos:", err);
  }
}

// ♻️ Intentar recuperar productos cacheados si no hay internet
async function cargarDesdeCache() {
  const cache = localStorage.getItem(CACHE_KEY_PRODS);
  if (!cache) return null;
  try {
    const productos = JSON.parse(cache);
    console.log(`📦 Cargando ${productos.length} productos desde cache local.`);
    renderTabla(productos);
    marcarOrden();
    return productos;
  } catch (err) {
    console.warn("⚠️ Error leyendo cache local de productos:", err);
    return null;
  }
}

// 🧩 Interceptar buscar() para cachear resultados y fallback offline
const originalBuscar = buscar;
buscar = async function (...args) {
  if (!navigator.onLine) {
    console.log("📴 Sin conexión — usando cache local de productos");
    await cargarDesdeCache();
    return;
  }
  await originalBuscar.apply(this, args);
  // Cachear últimos resultados (tbody ya renderizado)
  const filas = [...tbody.querySelectorAll("tr")];
  if (filas.length > 0 && filas[0].textContent.includes("Sin resultados") === false) {
    try {
      const rows = Array.from(filas).map((tr) => {
        const celdas = tr.querySelectorAll("td");
        return {
          sku: celdas[0]?.innerText.trim(),
          codigo: celdas[1]?.innerText.trim(),
          nombre: celdas[3]?.innerText.trim(),
          precio_base: celdas[4]?.innerText.replace("$","").trim(),
          existencias: celdas[8]?.innerText.trim(),
        };
      });
      cachearProductos(rows);
    } catch {}
  }
};

// 🧮 Cachear cambios en ediciones locales cuando no hay conexión
window.addEventListener("offline", () => {
  console.warn("⚠️ Modo offline activo: los cambios se guardarán localmente.");
});
window.addEventListener("online", async () => {
  try {
    const pendientes = JSON.parse(localStorage.getItem(CACHE_SYNC_PENDING) || "[]");
    if (!pendientes.length) return;

    console.log(`📤 Sincronizando ${pendientes.length} productos pendientes...`);
    for (const p of pendientes) {
      const { error } = await supabase.from("productos").update(p.campos).eq("id", p.id);
      if (!error) console.log("✅ Producto sincronizado:", p.id);
    }
    localStorage.removeItem(CACHE_SYNC_PENDING);
    Toastify({
      text: "☁️ Productos sincronizados con Supabase",
      duration: 2000,
      gravity: "top",
      position: "right",
      style: {
        background: "linear-gradient(90deg, #22c55e, #16a34a)",
        color: "#fff",
        borderRadius: "0.5rem",
        fontWeight: "600",
      },
    }).showToast();
  } catch (err) {
    console.warn("⚠️ Error al sincronizar productos pendientes:", err);
  }
});

function mostrarImagen(url) {
  if (!preview || !placeholder) return;

  if (url) {
    preview.src = url;

    // mostrar imagen
    preview.classList.remove("hidden");
    preview.style.display = "block";

    // ocultar placeholder
    placeholder.classList.add("hidden");
    placeholder.style.display = "none";
  } else {
    preview.src = "";

    // ocultar imagen
    preview.classList.add("hidden");
    preview.style.display = "none";

    // mostrar placeholder
    placeholder.classList.remove("hidden");
    placeholder.style.display = "flex";
  }
}

function inicializarImagenesModal() {
  fileInput = document.getElementById("e_imagen");
  preview = document.getElementById("e_preview");
  placeholder = document.getElementById("placeholder");
  btnCamara = document.getElementById("btnCamara");
  btnQuitarImg = document.getElementById("btnQuitarImg");

  if (!fileInput) {
    console.error("❌ e_imagen no existe en modal");
    return;
  }

  // 🔁 Reset listeners (IMPORTANTE)
  fileInput.replaceWith(fileInput.cloneNode(true));
  fileInput = document.getElementById("e_imagen");

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("📂 Archivo seleccionado:", file.name);

    const optimizada = await optimizarImagen(file);
    imagenFile = optimizada;

    mostrarImagen(URL.createObjectURL(optimizada));
  });

  btnCamara?.addEventListener("click", async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.style.width = "100%";

      const { isConfirmed } = await Swal.fire({
        title: "📸 Cámara",
        html: `<div id="camContainer"></div>`,
        didOpen: () => {
          document.getElementById("camContainer").appendChild(video);
        },
        confirmButtonText: "Capturar",
        showCancelButton: true,
        didClose: () => stream.getTracks().forEach(t => t.stop())
      });

      if (!isConfirmed) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);

      const blob = await new Promise(r =>
        canvas.toBlob(r, "image/jpeg", 0.9)
      );

      const file = new File([blob], `foto_${Date.now()}.jpg`, {
        type: "image/jpeg"
      });

      const optimizada = await optimizarImagen(file);
      imagenFile = optimizada;

      mostrarImagen(URL.createObjectURL(optimizada));

    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudo acceder a la cámara", "error");
    }
  });

  btnQuitarImg?.addEventListener("click", () => {
    imagenFile = null;
    fileInput.value = "";
    mostrarImagen(null);
  });

  console.log("✅ Modal de imágenes inicializado");
}

document.getElementById("btnGuardarCambios")?.addEventListener("click", async () => {

  if (!hayCambios) {
    return Swal.fire("Sin cambios", "No hay nada que guardar", "info")
  }

  Swal.fire({
    title: "Guardando cambios...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  })

  try {

    for (const id in cambiosPendientes) {

      const campos = cambiosPendientes[id]

      
      if (campos.margen !== undefined) {

        const fila = document.querySelector(`[data-id="${id}"]`)?.closest("tr")

        let costoActual = campos.costo

        if (costoActual === undefined && fila) {
          costoActual = leerNumero(
            fila.querySelector('[data-campo="costo"]')
          )
        }

        campos.precio_base = calcularPrecioDesdeMargen(
          costoActual || 0,
          campos.margen
        )

        delete campos.margen
      }

      const { error } = await supabase
        .from("productos")
        .update({
          ...campos,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .eq("negocio_id", negocioId)

      if (error) throw error

    }

    // 🔄 limpiar buffer
    cambiosPendientes = {}
    hayCambios = false
    actualizarBotonGuardar()

    document.querySelectorAll("tr").forEach(tr => {
  tr.classList.remove("bg-yellow-50", "ring-2", "ring-yellow-300")
})

    Swal.fire({
      icon: "success",
      title: "Cambios guardados",
      timer: 1200,
      showConfirmButton: false
    })

    buscar()

  } catch (err) {
    console.error(err)
    Swal.fire("Error", "No se pudieron guardar los cambios", "error")
  }

})

window.addEventListener("beforeunload", (e) => {
  if (hayCambios) {
    e.preventDefault()
    e.returnValue = ""
  }
})

function validarSalida() {
  if (!hayCambios) return true

  return confirm("Tienes cambios sin guardar ¿Deseas salir?")
}



function actualizarBotonGuardar() {
  const btn = document.getElementById("btnGuardarCambios")
  if (!btn) return
  btn.style.display = hayCambios ? "block" : "none"
}

document.addEventListener("DOMContentLoaded", () => {
  actualizarBotonGuardar()
})