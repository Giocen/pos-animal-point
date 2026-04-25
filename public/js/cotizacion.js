import { supabaseClient } from "/js/proteccion.js";



const negocioId =
  localStorage.getItem("negocio_id") ||
  window.usuarioActual?.negocio_id;

let productos = [];
let carrito = [];


let cotizacionId = new URLSearchParams(window.location.search).get("id");
let folioActual = null;
let fechaActual = null;


// 💰 formato dinero
const money = v =>
  Number(v || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2
  });


  function fechaArchivo(fecha) {
  const f = new Date(fecha || new Date());

  const yyyy = f.getFullYear();
  const mm = String(f.getMonth() + 1).padStart(2, "0");
  const dd = String(f.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

// ==========================
// 🔍 BUSCAR PRODUCTOS
// ==========================
const inputBuscar = document.getElementById("buscarProducto");
const resultados = document.getElementById("resultados");

inputBuscar.addEventListener("input", async () => {
  const q = inputBuscar.value.trim();

  if (q.length < 2) {
    resultados.classList.add("hidden");
    resultados.innerHTML = "";
    return;
  }

  const { data } = await supabaseClient
    .from("v_productos_existencias")
    .select("*")
    .eq("negocio_id", negocioId)
    .ilike("nombre", `%${q}%`)
    .limit(30);

  productos = data || [];
 

  resultados.innerHTML = productos.map(p => {

    const enCarrito = carrito.find(x => x.id == p.id);

    const stock = Number(p.existencias_total || 0);

    const colorStock =
      stock <= 0
        ? "text-red-500"
        : stock <= 5
        ? "text-yellow-500"
        : "text-green-600";

    return `
      <div class="px-3 py-2 cursor-pointer border-b flex justify-between items-center
        ${enCarrito ? "bg-green-50" : "hover:bg-purple-50"}"
        onclick="agregarProducto('${p.id}', this)">

        <div>
          <div class="font-medium">${p.nombre}</div>
          <div class="text-xs ${colorStock}">
            Stock: ${stock}
          </div>
        </div>

        <div class="text-right">
        <div class="font-bold">$${money(p.precio_base)}</div>
        ${enCarrito ? `<div class="text-xs text-green-600">✔ Agregado</div>` : ""}
        </div>

      </div>
    `;
  }).join("");

  // 🔥 AQUÍ EXACTO
  resultados.classList.remove("hidden");

});



// ==========================
// ➕ AGREGAR PRODUCTO
// ==========================
window.agregarProducto = (id, el) => {

  const p = productos.find(x => x.id == id);

  const existente = carrito.find(x => x.id == id);

  if (existente) {
    existente.cantidad++;
  } else {

    carrito.push({
  ...p,
  cantidad: 1,
  precio_editado: null,

  // 🔥 BASE ORIGINAL
  precio_original: p.precio_base,
  costo_original: p.costo,

  // 🔥 CALCULADO BASE
  margen_original:
    p.precio_base > 0
      ? ((p.precio_base - p.costo) / p.precio_base) * 100
      : 0,

  ganancia_original:
    (p.precio_base - p.costo)
});

  }

  // ✅ EFECTO VISUAL
  if (el) {
    el.classList.add("bg-green-100");

    setTimeout(() => {
      el.classList.remove("bg-green-100");
    }, 300);
  }

   Toastify({
    text: "Producto agregado",
    duration: 1200,
    gravity: "top",
    position: "right",
    style: {
      background: "#22c55e"
    }
  }).showToast();
  
inputBuscar.dispatchEvent(new Event("input"));

  render();
};


// ==========================
// 🔄 RENDER
// ==========================
const tabla = document.getElementById("tablaCotizacion");
const totalEl = document.getElementById("total");

function render() {
  const modo = document.getElementById("modoCotizacion").value;

  let total = 0;

  tabla.innerHTML = carrito.map(p => {

    let precioBase =
  modo === "costo"
    ? (p.costo_original ?? p.costo ?? 0)
    : (p.precio_original ?? p.precio_base ?? 0);

    const precio = p.precio_editado ?? precioBase;

    const subtotal = precio * p.cantidad;

    // 🔥 asegurar números válidos
    const costo = Number(p.costo_original ?? p.costo ?? 0);
    const precioUnit = Number(precio || 0);
    const cantidad = Number(p.cantidad || 0);


    // 🔥 GANANCIA
    const ganancia = (precioUnit - costo) * cantidad;

    // 🔥 MARGEN (% basado en precio)
    const margen =
      precioUnit > 0
        ? ((precioUnit - costo) / precioUnit) * 100
        : 0;

    total += subtotal;

    return `
  <tr class="border-b">

    <td class="w-1/2">${p.nombre}</td>

    <td class="text-center w-24">
      <input type="number" min="1" value="${p.cantidad}"
        onchange="cambiarCantidad('${p.id}', this.value)"
        class="w-16 border rounded p-1 text-center">
    </td>

    <td class="text-right w-28">
      <input 
        type="number"
        value="${precio}"
        step="0.01"
        onchange="cambiarPrecio('${p.id}', this.value)"
        class="w-24 border rounded p-1 text-right"
      >
    </td>

    <td class="text-right w-28">$${money(subtotal)}</td>

      <!-- 🔥 GANANCIA -->
      <td class="text-right w-28 font-semibold ${
        ganancia < 0
          ? "text-red-600"
          : ganancia === 0
          ? "text-gray-500"
          : "text-green-600"
      }">
        ${
          modo === "costo"
            ? `$${money(p.ganancia_original)}`
            : `$${money(ganancia)}`
        }
        ${
          p.precio_editado !== null
            ? `<div class="text-[10px] text-gray-400">
                base $${money(p.ganancia_original)}
              </div>`
            : ""
        }
      </td>

      <!-- 🔥 MARGEN -->
      <td class="text-right w-20 font-semibold ${
        margen < 0
          ? "text-red-600"
          : margen < 15
          ? "text-yellow-500"
          : "text-blue-600"
      }">
        ${
          modo === "costo"
            ? `${p.margen_original.toFixed(1)}%`
            : `${margen.toFixed(1)}%`
        }
        ${
          p.precio_editado !== null
            ? `<div class="text-[10px] text-gray-400">
                base ${p.margen_original.toFixed(1)}%
              </div>`
            : ""
        }
      </td>

    <td class="text-center w-12">
      <button onclick="eliminar('${p.id}')">❌</button>
    </td>

  </tr>
`;
  }).join("");

  totalEl.textContent = money(total);

  // 🔥 AUTO GUARDAR BORRADOR
localStorage.setItem("cotizacion_borrador", JSON.stringify({
  carrito,
  cliente: document.getElementById("clienteNombre").value,
  telefono: document.getElementById("clienteTelefono").value,
  modo: document.getElementById("modoCotizacion").value
}));


}



// ==========================
// ✏️ CAMBIAR CANTIDAD
// ==========================
window.cambiarCantidad = (id, val) => {
  const p = carrito.find(x => x.id == id);
  p.cantidad = Number(val) || 1;
  render();
};


window.cambiarPrecio = (id, val) => {
  const p = carrito.find(x => x.id == id);

  p.precio_editado = Number(val) || 0;

  render();
};
// ==========================
// ❌ ELIMINAR
// ==========================
window.eliminar = (id) => {
  carrito = carrito.filter(x => x.id != id);
  render();
};

// ==========================
// 🔄 CAMBIO DE MODO
// ==========================
document
  .getElementById("modoCotizacion")
  .addEventListener("change", render);

  async function cargarNegocio() {
  const { data } = await supabaseClient
    .from("v_config_negocio")
    .select("*")
    .eq("negocio_id", negocioId)
    .single();

  if (!data) return;

  document.getElementById("nombreNegocio").textContent =
    data.ticket_nombre_negocio || "";

  document.getElementById("direccionNegocio").textContent =
    data.ticket_direccion || "";

  document.getElementById("telefonoNegocio").textContent =
    data.ticket_telefono || "";

  if (data.ticket_logo_url) {
    const img = document.getElementById("logoNegocio");
    img.src = data.ticket_logo_url;
    img.classList.remove("hidden");
  }
}


document.addEventListener("click", (e) => {

  const dentroResultados = resultados.contains(e.target);
  const dentroInput = inputBuscar.contains(e.target);

  if (!dentroResultados && !dentroInput) {
    resultados.classList.add("hidden");
  }

});


function generarHTMLImpresion() {

  const cliente = document.getElementById("clienteNombre").value || "-";
  const telefono = document.getElementById("clienteTelefono").value || "-";

  const nombreNegocio = document.getElementById("nombreNegocio")?.textContent || "";
  const direccionNegocio = document.getElementById("direccionNegocio")?.textContent || "";
  const telefonoNegocio = document.getElementById("telefonoNegocio")?.textContent || "";
  const logo = document.getElementById("logoNegocio")?.src || "";

  const filas = carrito.map(p => {

    let precioBase =
      document.getElementById("modoCotizacion").value === "costo"
        ? (p.costo_original ?? p.costo ?? 0)
        : (p.precio_original ?? p.precio_base ?? 0);

    const precio = p.precio_editado ?? precioBase;

    const subtotal = precio * p.cantidad;

    return `
      <tr>
        <td style="padding:6px 0;">${p.nombre}</td>
        <td style="text-align:center">${p.cantidad}</td>
        <td style="text-align:right">$${money(precio)}</td>
        <td style="text-align:right">$${money(subtotal)}</td>
      </tr>
    `;
  }).join("");

  const total = document.getElementById("total").textContent;
  const folio = folioActual || "NUEVA";

  return `
    <div style="font-family: Arial; padding:30px; width:750px; background:#ffffff; color:#000;">

      <!-- HEADER -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #7c3aed; padding-bottom:10px; margin-bottom:20px;">

      <!-- IZQUIERDA -->
      <div style="display:flex; align-items:center; gap:12px;">

        ${logo ? `
          <img src="${logo}" crossorigin="anonymous"
            style="width:60px; height:60px; object-fit:contain;">
        ` : ""}

        <div>
          <h1 style="margin:0; font-size:22px;">${nombreNegocio}</h1>
          <div style="font-size:13px; color:#555;">
            ${direccionNegocio}<br>
            ${telefonoNegocio}
          </div>
        </div>

      </div>

      <!-- DERECHA -->
      <div style="text-align:right;">
        <div style="font-size:18px; font-weight:bold;">COTIZACIÓN</div>
        <div style="font-size:14px;">Folio: <strong>${folio}</strong></div>
        <div style="font-size:13px; color:#555;">
          Fecha: ${new Date(fechaActual || new Date()).toLocaleDateString("es-MX")}
        </div>
      </div>

    </div>

  <!-- CLIENTE -->
  <div style="margin-bottom:20px; padding:10px; border:1px solid #ddd; border-radius:6px;">
    <div><strong>Cliente:</strong> ${cliente}</div>
    <div><strong>Teléfono:</strong> ${telefono}</div>
  </div>

  <!-- TABLA -->
  <table style="width:100%; border-collapse: collapse; font-size:14px;">

    <thead>
      <tr style="background:#f3f4f6;">
        <th style="text-align:left; padding:8px; border-bottom:2px solid #ccc;">Producto</th>
        <th style="text-align:center; padding:8px; border-bottom:2px solid #ccc;">Cant.</th>
        <th style="text-align:right; padding:8px; border-bottom:2px solid #ccc;">Precio</th>
        <th style="text-align:right; padding:8px; border-bottom:2px solid #ccc;">Total</th>
      </tr>
    </thead>

    <tbody>
      ${filas}
    </tbody>

  </table>

  <!-- TOTAL -->
  <div style="margin-top:20px; text-align:right;">
    <div style="font-size:18px; font-weight:bold; color:#7c3aed;">
      Total: $${total}
    </div>
  </div>

  <!-- FOOTER -->
  <div style="margin-top:40px; font-size:12px; color:#777; text-align:center;">
    Gracias por su preferencia
  </div>

</div>
`;
}



window.imprimirCotizacion = () => {

  const contenido = generarHTMLImpresion();

  const win = window.open("", "", "width=800,height=600");

  win.document.write(`
    <html>
      <head>
        <title>Cotización</title>
      </head>
      <body>
        ${contenido}
      </body>
    </html>
  `);

  win.document.close();
  win.print();
};

window.descargarPDF = async () => {

  const btn = document.getElementById("btnPDF");
  btn.disabled = true;

  const loader = document.getElementById("loaderPDF");
  loader.classList.remove("hidden");
  loader.classList.add("flex");

  if (!folioActual) {
    await guardarCotizacion();
  }

  const { jsPDF } = window.jspdf;

  const contenedor = document.createElement("div");

  contenedor.style.position = "fixed";
  contenedor.style.left = "-9999px";
  contenedor.style.top = "0";
  contenedor.style.background = "#ffffff";
  contenedor.style.width = "750px";

  contenedor.innerHTML = generarHTMLImpresion();
  document.body.appendChild(contenedor);

  // 🔥 esperar imágenes (LOGO)
const imgs = contenedor.querySelectorAll("img");

await Promise.all(
  Array.from(imgs).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(res => {
      img.onload = res;
      img.onerror = res;
    });
  })
);

 
await new Promise(r => setTimeout(r, 200));

const canvas = await html2canvas(contenedor, {
  scale: 2,
  backgroundColor: "#ffffff",
  useCORS: true,
  allowTaint: true
});

  document.body.removeChild(contenedor);

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");

const margin = 10;

const pdfWidth = 210 - (margin * 2);
const pdfHeight = canvas.height * pdfWidth / canvas.width;

pdf.addImage(imgData, "PNG", margin, margin, pdfWidth, pdfHeight);
  const folio = folioActual || "SIN-FOLIO";
  const fecha = fechaArchivo(fechaActual);

  pdf.save(`Cotizacion_${folio}_${fecha}.pdf`);

  btn.disabled = false;

  // 🔥 ocultar loader
  loader.classList.add("hidden");
  loader.classList.remove("flex");
};

window.compartirWhatsApp = () => {

  let texto = "🧾 *Cotización*\n\n";

  carrito.forEach(p => {
    texto += `• ${p.nombre} x${p.cantidad}\n`;
  });

  texto += `\n💰 Total: $${totalEl.textContent}`;

  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;

  window.open(url, "_blank");
};


window.guardarCotizacion = async () => {

  if (carrito.length === 0) {
  Swal.fire({
    icon: "warning",
    title: "Sin productos",
    text: "Agrega productos primero",
    confirmButtonColor: "#7c3aed"
  });
  return;
}

  const modo = document.getElementById("modoCotizacion").value;

  // 🔹 1. INSERT CABECERA
let cotizacion;

if (cotizacionId) {
  // 🔥 UPDATE
  const { data, error } = await supabaseClient
    .from("cotizaciones")
    .update({
      tipo: modo,
      total: Number(totalEl.textContent.replace(/,/g, "")),
      cliente_nombre: document.getElementById("clienteNombre").value,
      cliente_telefono: document.getElementById("clienteTelefono").value
    })
    .eq("id", cotizacionId)
    .select()
    .single();

  if (error) {
  console.error(error);
  Swal.fire({
    icon: "error",
    title: "Error",
    text: "No se pudo actualizar la cotización",
    confirmButtonColor: "#7c3aed"
  });
  return;
}

  cotizacion = data;

  folioActual = cotizacion.folio;
  fechaActual = cotizacion.created_at;
  cotizacionId = cotizacion.id;

  
window.history.replaceState(null, "", `?id=${cotizacionId}`);

  // 🔥 BORRAR DETALLE ANTERIOR
  await supabaseClient
    .from("cotizaciones_detalle")
    .delete()
    .eq("cotizacion_id", cotizacionId);

} else {
  // 🆕 INSERT
  const { data, error } = await supabaseClient
    .from("cotizaciones")
    .insert({
      negocio_id: negocioId,
      tipo: modo,
      total: Number(totalEl.textContent.replace(/,/g, "")),
      cliente_nombre: document.getElementById("clienteNombre").value,
      cliente_telefono: document.getElementById("clienteTelefono").value
    })
    .select()
    .single();

 if (error) {
  console.error(error);
  Swal.fire({
    icon: "error",
    title: "Error",
    text: "No se pudo guardar la cotización",
    confirmButtonColor: "#7c3aed"
  });
  return;
}

  cotizacion = data;
  folioActual = cotizacion.folio;
  fechaActual = cotizacion.created_at;
  cotizacionId = cotizacion.id;

  // 🔥 importante: ya queda en modo edición
  window.history.replaceState(null, "", `?id=${cotizacionId}`);

}


// 🔹 INSERT DETALLE (SIEMPRE)
const detalle = carrito.map(p => {
  const precioBase =
    modo === "costo"
      ? Number(p.costo_original ?? p.costo ?? 0)
      : Number(p.precio_original ?? p.precio_base ?? 0);

  const precio = Number(p.precio_editado ?? precioBase);
  const cantidad = Number(p.cantidad ?? 0);
  const costo = Number(p.costo_original ?? p.costo ?? 0);

  return {
    cotizacion_id: cotizacionId,
    producto_id: p.id,
    nombre: p.nombre,
    cantidad,
    precio,
    costo,
    subtotal: precio * cantidad
  };
});

console.log("cotizacionId:", cotizacionId);
console.log("detalle a guardar:", detalle);

const { data: detalleGuardado, error: errorDetalle } = await supabaseClient
  .from("cotizaciones_detalle")
  .insert(detalle)
  .select();

if (errorDetalle) {
  console.error("Error detalle:", errorDetalle);
  Swal.fire({
  icon: "error",
  title: "Error al guardar",
  text: "No se pudo guardar el detalle de la cotización",
  confirmButtonColor: "#7c3aed"
});
  return;
}

console.log("detalle guardado:", detalleGuardado);


 Swal.fire({
  icon: "success",
  title: "Guardado",
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 1500
});

  localStorage.removeItem("cotizacion_borrador");
};


// ==========================
// 🔥 CARGAR COTIZACIÓN DESDE URL
// ==========================
async function cargarCotizacionDesdeURL() {

  const params = new URLSearchParams(window.location.search);
  cotizacionId = params.get("id");
  const id = cotizacionId;

  if (!id) return;

  // 🔹 1. CABECERA
  const { data: cotizacion } = await supabaseClient
    .from("cotizaciones")
    .select("*")
    .eq("id", id)
    .single();

  if (!cotizacion) return;

  folioActual = cotizacion.folio;
  fechaActual = cotizacion.created_at;

  // 👉 llenar datos cliente
  document.getElementById("clienteNombre").value =
    cotizacion.cliente_nombre || "";

  document.getElementById("clienteTelefono").value =
    cotizacion.cliente_telefono || "";

  document.getElementById("modoCotizacion").value =
    cotizacion.tipo || "precio";

  // 🔹 2. DETALLE
const { data: detalle, error: errorDetalle } = await supabaseClient
  .from("cotizaciones_detalle")
  .select("*")
  .eq("cotizacion_id", id);

if (errorDetalle) {
  console.error("Error cargando detalle:", errorDetalle);
  return;
}

// 🔹 3. reconstruir carrito
carrito = (detalle || []).map(d => ({
  id: d.producto_id,
  nombre: d.nombre,
  cantidad: Number(d.cantidad ?? 0),

  precio_base: Number(d.precio ?? 0),
  precio_original: Number(d.precio ?? 0),

  costo: Number(d.costo ?? 0),
  costo_original: Number(d.costo ?? 0),

  precio_editado: Number(d.precio ?? 0),

  margen_original:
    Number(d.precio || 0) > 0
      ? ((Number(d.precio || 0) - Number(d.costo || 0)) / Number(d.precio || 0)) * 100
      : 0,

  ganancia_original:
    Number(d.precio || 0) - Number(d.costo || 0)
}));

  render();
}


cargarNegocio();
cargarCotizacionDesdeURL();

// 🔥 RECUPERAR BORRADOR
function cargarBorrador() {
  const data = localStorage.getItem("cotizacion_borrador");

  if (!data || cotizacionId) return; // 🔥 no sobrescribir si es edición real

  try {
    const parsed = JSON.parse(data);

    carrito = parsed.carrito || [];

    document.getElementById("clienteNombre").value =
      parsed.cliente || "";

    document.getElementById("clienteTelefono").value =
      parsed.telefono || "";

    document.getElementById("modoCotizacion").value =
      parsed.modo || "precio";

    render();

    Toastify({
      text: "Se recuperó cotización pendiente 🧠",
      duration: 2000,
      gravity: "top",
      position: "right",
      style: { background: "#7c3aed" }
    }).showToast();

  } catch (e) {
    console.error("Error cargando borrador", e);
  }
}

cargarBorrador();

window.limpiarCotizacion = () => {

  Swal.fire({
    title: "¿Limpiar cotización?",
    text: "Se eliminarán todos los productos",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, limpiar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280"
  }).then((result) => {

    if (!result.isConfirmed) return;

    carrito = [];
    folioActual = null;
    fechaActual = null;

    window.history.replaceState(null, "", window.location.pathname);

    // 🔥 limpiar local
    localStorage.removeItem("cotizacion_borrador");

    // 🔥 limpiar inputs
    document.getElementById("clienteNombre").value = "";
    document.getElementById("clienteTelefono").value = "";

    render();

    Toastify({
      text: "Cotización limpiada 🧹",
      duration: 1500,
      gravity: "top",
      position: "right",
      style: { background: "#ef4444" }
    }).showToast();

  });
};
