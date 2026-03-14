// 💜 SmartPOS — Alta de Productos (MULTI-NEGOCIO + OFFLINE + IMÁGENES)
import { optimizarImagen } from "../utilidades/optimizar-imagen.js";
import { supabaseClient, protegerSesion } from "../proteccion.js"; 
await protegerSesion(["cajero", "admin"]);

lucide.createIcons();
const supabase = supabaseClient;

// ⭐ NEGOCIO SEGURO
const negocioId =
  localStorage.getItem("negocio_id") ||
  window.usuarioActual?.negocio_id ||
  null;

// ⚙️ Configuración de bucket
const BUCKET = "product-images";
const IMAGEN_COL = "imagen_url";

const form = document.getElementById("formAlta");
const estado = document.getElementById("estado");
const resultado = document.getElementById("resultado");
const btn = document.getElementById("btnGuardar");
const imgInput = document.getElementById("imagen");
const preview = document.getElementById("preview");

let bloqueoBusqueda = false;

/* -------------------------------------------------------------
   🔍 Buscar producto por SKU o código de barras
------------------------------------------------------------- */
document.getElementById("sku").addEventListener("change", buscarProducto);
document.getElementById("barcode").addEventListener("change", buscarProducto);

async function buscarProducto(e) {

  if (bloqueoBusqueda) return; // 🚫 evita doble ejecución

  const valor = e.target.value.trim();
  if (!valor) return;

  bloqueoBusqueda = true; // 🔒 bloquea siguientes llamadas

  try {

    const { data: producto, error } = await supabaseClient
      .from("productos")
      .select("id, sku, codigo_barras, nombre, descripcion, categoria_id, precio_base, costo, unidad, imagen_url, negocio_id")
      .or(`sku.eq.${valor},codigo_barras.eq.${valor}`)
      .eq("negocio_id", negocioId)
      .maybeSingle();

    if (error) {
      console.error("Error buscando producto:", error);
      return;
    }

    if (producto) {

      if (producto.negocio_id !== negocioId) {
        Swal.fire("Denegado", "El producto pertenece a otro negocio.", "error");
        return;
      }

      const { data: lote } = await supabase
        .from("inventario_lotes")
        .select("ubicacion, fecha_caducidad")
        .eq("producto_id", producto.id)
        .eq("negocio_id", negocioId)
        .order("fecha", { ascending: false })
        .limit(1);

      // ⭐ Rellenar formulario
      document.getElementById("nombre").value = producto.nombre || "";
      document.getElementById("descripcion").value = producto.descripcion || "";
      document.getElementById("precio").value = producto.precio_base || 0;
      document.getElementById("costo").value = producto.costo || 0;
      document.getElementById("unidad").value = producto.unidad === "kg" ? "kg" : "pieza";
      document.getElementById("sku").value = producto.sku || "";
      document.getElementById("barcode").value = producto.codigo_barras || "";
      document.getElementById("ubicacion").value = lote?.[0]?.ubicacion || "Tienda";
      document.getElementById("caducidad").value = lote?.[0]?.fecha_caducidad || "";

      if (producto.imagen_url) {
        preview.src = producto.imagen_url;
        preview.classList.remove("hidden");
      } else {
        preview.src = "";
        preview.classList.add("hidden");
      }

      if (producto.categoria_id) {
        const { data: cat } = await supabaseClient
          .from("categorias")
          .select("nombre")
          .eq("id", producto.categoria_id)
          .eq("negocio_id", negocioId)
          .maybeSingle();

        document.getElementById("categoriaSugerida").textContent =
          cat ? `Sugerido: ${cat.nombre}` : "";
      } else {
        document.getElementById("categoriaSugerida").textContent = "";
      }

      Swal.fire({
        icon: "info",
        title: "Producto encontrado",
        text: "Se llenaron los campos con la información actual.",
        confirmButtonColor: "#9333ea",
      });

    } else {

      Swal.fire({
        icon: "warning",
        title: "Producto no encontrado",
        text: "Llena los campos para registrarlo como nuevo.",
        confirmButtonColor: "#9333ea",
      });

    }

  } finally {
    // 🔓 libera el bloqueo después de un pequeño delay
    setTimeout(() => {
      bloqueoBusqueda = false;
    }, 300);
  }
}
/* -------------------------------------------------------------
   Buscar ID por SKU
------------------------------------------------------------- */
async function findProductIdBySku(rawSku) {
  const skuTrim = (rawSku || "").trim();
  if (!skuTrim) return null;

  let { data: prod } = await supabase
    .from("productos")
    .select("id, sku")
    .eq("sku", skuTrim)
    .eq("negocio_id", negocioId)
    .maybeSingle();

  return prod?.id ?? null;
}



/* -------------------------------------------------------------
   🖼️ Imagen estable sin rebote
------------------------------------------------------------- */

const zonaImagen = document.getElementById("zonaImagen");
const textoZonaImagen = document.getElementById("textoZonaImagen");
const btnEliminarImagen = document.getElementById("btnEliminarImagen");

/* -------- Click solo activa zona -------- */
zonaImagen?.addEventListener("click", () => {
  zonaImagen.focus();
});

/* -------- Doble click abre selector -------- */
zonaImagen?.addEventListener("dblclick", () => {
  imgInput.click();
});

/* -------- Selección manual -------- */
imgInput.addEventListener("change", async () => {

  const file = imgInput.files?.[0];
  if (!file) return;

  await procesarImagen(file);
});

/* -------- Pegar imagen -------- */
document.addEventListener("paste", async (e) => {

  if (document.activeElement !== zonaImagen) return;

  const items = e.clipboardData?.items;
  if (!items) return;

  for (let item of items) {
    if (item.type.includes("image")) {
      const file = item.getAsFile();
      if (file) {
        await procesarImagen(file);
      }
      break;
    }
  }
});
/* -------- Procesamiento -------- */
async function procesarImagen(file) {

  try {

    if (!file || !file.type.startsWith("image/")) {
      console.warn("Archivo no válido");
      return;
    }

    const optimizada = await optimizarImagen(file);
    const url = URL.createObjectURL(optimizada);

    // 🔎 Validación básica
    if (!preview || !zonaImagen) {
      console.error("Elementos de imagen no encontrados");
      return;
    }

    // 🖼️ Mostrar imagen
    preview.src = url;
    preview.classList.remove("hidden");
    preview.style.display = "block";

    // 📝 Ocultar texto
    if (textoZonaImagen) {
      textoZonaImagen.style.display = "none";
    }

    // 💾 Guardar archivo optimizado
    imgInput._optimizedFile = optimizada;

    // 🎨 Estilo visual activo
    zonaImagen.classList.remove("border-gray-300");
    zonaImagen.classList.add("border-emerald-400");

    // 🔥 Mostrar botón eliminar
    if (btnEliminarImagen) {
      btnEliminarImagen.classList.remove("hidden");
    }

  } catch (err) {
    console.error("Error procesando imagen:", err);
  }
}

btnEliminarImagen?.addEventListener("click", (e) => {

  e.stopPropagation();

  // 🔥 Limpiar imagen
  preview.removeAttribute("src");
  preview.classList.add("hidden");
  preview.style.display = "none";

  // 🔥 Mostrar texto otra vez
  if (textoZonaImagen) {
    textoZonaImagen.style.display = "block";
  }

  // 🔥 Limpiar input
  imgInput.value = "";
  imgInput._optimizedFile = null;

  // 🔥 Restaurar estilos
  zonaImagen.classList.remove("border-emerald-400");
  zonaImagen.classList.add("border-gray-300");

  // 🔥 Ocultar botón eliminar
  btnEliminarImagen.classList.add("hidden");

});
/* -------------------------------------------------------------
   Subida al Storage correctamente
------------------------------------------------------------- */
async function uploadProductImage(file, sku) {
  const optimizada = await optimizarImagen(file);

  if (optimizada.size > 4_000_000) {
    Swal.fire("Imagen muy grande", "Reduce la resolución antes de subir.", "warning");
    return null;
  }

  const path = `productos/${encodeURIComponent(sku)}/${Date.now()}.webp`;

  const { error: upErr } = await supabaseClient.storage
    .from(BUCKET)
    .upload(path, optimizada, { upsert: true });

  if (upErr) throw upErr;

  const { data: pub } = supabaseClient.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

/* -------------------------------------------------------------
   💾 Registrar producto (ONLINE)
------------------------------------------------------------- */
form.addEventListener("submit", async (e) => {
  if (!navigator.onLine) return;
  e.preventDefault();

  btn.disabled = true;
  estado.textContent = "Guardando...";

  const categoriaNombre = document.getElementById("categoria").value.trim();
  let categoriaId = null;

  // ⭐ Crear o recuperar categoría
  if (categoriaNombre) {
    const { data: catExists } = await supabase
      .from("categorias")
      .select("id")
      .eq("nombre", categoriaNombre)
      .eq("negocio_id", negocioId)
      .maybeSingle();

    if (catExists?.id) {
      categoriaId = catExists.id;
    } else {
      const { data: nuevaCat, error: catErr } = await supabase
        .from("categorias")
        .insert({ nombre: categoriaNombre, negocio_id: negocioId })
        .select()
        .single();

      if (catErr) throw new Error("No se pudo crear la categoría.");
      categoriaId = nuevaCat.id;
    }
  }

  let unidadRaw = document.getElementById("unidad").value;
    unidadRaw = String(unidadRaw || "").toLowerCase().trim();

    let unidadNormalizada;
    if (["kg", "kilo", "kilogramo"].includes(unidadRaw)) {
      unidadNormalizada = "kg";
    } else {
      unidadNormalizada = "pieza"; // default seguro
    }

  // ⭐ Payload oficial del RPC
  const payload = {
    p_sku: document.getElementById("sku").value.trim(),
    p_nombre: document.getElementById("nombre").value.trim(),
    p_precio_base: Number(document.getElementById("precio").value || 0),
    p_costo: Number(document.getElementById("costo").value || 0),
    p_categoria_id: categoriaId || null,
    p_codigo_barras: document.getElementById("barcode").value.trim() || null,
    p_ubicacion: document.getElementById("ubicacion").value.trim(),
    p_cantidad: Number(document.getElementById("cantidad").value || 0),
    p_unidad: unidadNormalizada,
    p_descripcion: document.getElementById("descripcion").value.trim() || null,
    p_fecha_caducidad: document.getElementById("caducidad").value || null,
    p_stock_minimo: Number(document.getElementById("stockMinimo").value || 0),
    p_negocio_id: negocioId,
  };

  try {
    document.body.classList.add("no-scroll");

    const { data, error } = await supabaseClient.rpc(
      "registrar_producto_y_entrada",
      payload
    );
    if (error) throw error;

    const registro = Array.isArray(data) ? data[0] : data;

    const productoIdDeRpc = registro.producto_id ?? null;
    const skuOficial = registro.sku ?? payload.p_sku;
    const existenciasActuales = registro.existencias ?? 0;

    /* ------------------- Imagen ------------------- */
    let imagenUrlGuardada = null;
    const file = imgInput._optimizedFile || imgInput.files?.[0];

    if (file) {
      try {
        const publicUrl = await uploadProductImage(file, skuOficial);

        let productId = productoIdDeRpc;
        if (!productId) productId = await findProductIdBySku(skuOficial);

        if (productId) {
          await supabase
            .from("productos")
            .update({ [IMAGEN_COL]: publicUrl })
            .eq("id", productId)
            .eq("negocio_id", negocioId);
        }

        imagenUrlGuardada = publicUrl;
      } catch {
        Swal.fire("Aviso", "El producto se guardó, pero la imagen no se pudo subir.", "warning");
      }
    }

    /* ------------------- Notificación ------------------- */
    Swal.fire({
      icon: "success",
      title: "Producto registrado",
      text: `SKU ${skuOficial} con entrada de ${payload.p_cantidad}`,
      timer: 1800,
      showConfirmButton: false,
    });

    setTimeout(() => {
      resultado.innerHTML = `
        <strong>¡Listo!</strong> SKU <b>${skuOficial}</b> actualizado.<br>
        Existencias: <b>${existenciasActuales}</b>.
        ${
          imagenUrlGuardada
            ? `<br>Imagen: <a class="text-fuchsia-700 underline" href="${imagenUrlGuardada}" target="_blank">ver</a>`
            : ""
        }
      `;
      resultado.classList.remove("hidden");
    }, 1900);

    setTimeout(() => {
      form.reset();
      preview.classList.add("hidden");
      preview.src = "";
    }, 2000);

  } catch (err) {
    Swal.fire({ icon: "error", title: "Error", text: err.message });
  } finally {
    btn.disabled = false;
    estado.textContent = "";
    document.body.classList.remove("no-scroll");
  }
});

/* -------------------------------------------------------------
   💾 MODO OFFLINE + SINCRONIZACIÓN AUTOMÁTICA
------------------------------------------------------------- */

const CACHE_KEY_ALTAS = "smartpos_altas_pendientes";

window.addEventListener("online", async () => {
  try {
    const pendientes = JSON.parse(localStorage.getItem(CACHE_KEY_ALTAS) || "[]");
    if (!pendientes.length) return;

    console.log(`📤 Sincronizando ${pendientes.length} productos pendientes...`);

    for (const p of pendientes) {
      try {
        p.payload.p_negocio_id = p.payload.p_negocio_id || negocioId;

        const { data, error } = await supabaseClient.rpc(
          "registrar_producto_y_entrada",
          p.payload
        );
        if (error) throw error;

        const registro = Array.isArray(data) ? data[0] : data;
        const sku = registro?.sku || p.payload?.p_sku;

        // Imagen offline
        if (p.imagenBase64) {
          const blob = await (await fetch(p.imagenBase64)).blob();
          const file = new File([blob], `${sku}_${Date.now()}.webp`, {
            type: "image/webp",
          });

          const publicUrl = await uploadProductImage(file, sku);

          const productoId =
            registro?.producto_id || (await findProductIdBySku(sku));

          if (productoId) {
            await supabase
              .from("productos")
              .update({ [IMAGEN_COL]: publicUrl })
              .eq("id", productoId)
              .eq("negocio_id", negocioId);
          }
        }

        console.log("✅ Producto sincronizado:", sku);
      } catch (err) {
        console.warn("⚠️ Error sincronizando producto pendiente:", err);
      }
    }

    localStorage.removeItem(CACHE_KEY_ALTAS);

    Toastify({
      text: "☁️ Productos sincronizados",
      duration: 2000,
      gravity: "top",
      position: "right",
      style: {
        background: "linear-gradient(90deg, #22c55e, #16a34a)",
        color: "#fff",
      },
    }).showToast();
  } catch (err) {
    console.error("⚠️ Error al sincronizar altas locales:", err);
  }
});

/* -------------------------------------------------------------
   🔒 Guardado OFFLINE puro
------------------------------------------------------------- */
form.addEventListener("submit", async (e) => {
  if (navigator.onLine) return; 
  e.preventDefault();

  let unidadRaw = document.getElementById("unidad").value;
    unidadRaw = String(unidadRaw || "").toLowerCase().trim();

    let unidadNormalizada =
      ["kg", "kilo", "kilogramo"].includes(unidadRaw) ? "kg" : "pieza";


  try {
    const payload = {
      p_sku: document.getElementById("sku").value.trim(),
      p_nombre: document.getElementById("nombre").value.trim(),
      p_precio_base: Number(document.getElementById("precio").value || 0),
      p_costo: Number(document.getElementById("costo").value || 0),
      p_categoria_id: null,
      p_codigo_barras: document.getElementById("barcode").value.trim() || null,
      p_ubicacion: document.getElementById("ubicacion").value.trim(),
      p_cantidad: Number(document.getElementById("cantidad").value || 0),
      p_unidad: unidadNormalizada,
      p_descripcion: document.getElementById("descripcion").value.trim() || null,
      p_fecha_caducidad: document.getElementById("caducidad").value || null,
      p_stock_minimo: Number(document.getElementById("stockMinimo").value || 0),
      p_negocio_id: negocioId,
      _offline_timestamp: new Date().toISOString(),
    };

    let imagenBase64 = null;
    const file = imgInput.files?.[0];

    if (file) {
      const optimizada = await optimizarImagen(file);

      imagenBase64 = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = (e) => res(e.target.result);
        reader.readAsDataURL(optimizada);
      });
    }

    const pendientes = JSON.parse(localStorage.getItem(CACHE_KEY_ALTAS) || "[]");
    pendientes.push({ payload, imagenBase64 });
    localStorage.setItem(CACHE_KEY_ALTAS, JSON.stringify(pendientes));

    Swal.fire({
      icon: "info",
      title: "💾 Guardado offline",
      text: "Se sincronizará cuando vuelva el internet.",
    });

    form.reset();
    preview.classList.add("hidden");
    preview.src = "";

  } catch (err) {
    Swal.fire("Error", "No se pudo guardar offline", "error");
  }
});

/* -------------------------------------------------------------
   📊 SmartPOS – Rentabilidad Visual Mejorada
------------------------------------------------------------- */

const inputPrecio = document.getElementById("precio");
const inputCosto = document.getElementById("costo");

const utilidadMonto = document.getElementById("utilidadMonto");
const margenPorcentaje = document.getElementById("margenPorcentaje");
const markupPorcentaje = document.getElementById("markupPorcentaje");
const alertaMargen = document.getElementById("alertaMargen");

function calcularRentabilidad() {

  if (!inputPrecio || !inputCosto) return;

  const precio = Number(inputPrecio.value || 0);
  const costo = Number(inputCosto.value || 0);

  if (precio <= 0) {
    utilidadMonto.textContent = "$0.00";
    margenPorcentaje.textContent = "0%";
    if (markupPorcentaje) markupPorcentaje.textContent = "0%";
    if (alertaMargen) alertaMargen.textContent = "";
    return;
  }

  const utilidad = precio - costo;
  const margen = (utilidad / precio) * 100;
  const markup = costo > 0 ? (utilidad / costo) * 100 : 0;

  // 💰 Utilidad
  utilidadMonto.textContent = `$${utilidad.toFixed(2)}`;

  // 📈 Margen
  margenPorcentaje.textContent = `${margen.toFixed(2)}%`;

  // 📊 Markup
  if (markupPorcentaje) {
    markupPorcentaje.textContent = `${markup.toFixed(2)}%`;
  }

  // 🎨 Semáforo visual
  if (precio < costo) {
    margenPorcentaje.className = "font-bold text-red-600 text-lg";
    utilidadMonto.className = "text-lg font-bold text-red-600";
    if (alertaMargen) {
      alertaMargen.textContent = "⚠️ Estás vendiendo por debajo del costo";
      alertaMargen.className = "text-red-600 font-semibold text-center";
    }
  }
  else if (margen < 20) {
    margenPorcentaje.className = "font-bold text-yellow-600 text-lg";
    utilidadMonto.className = "text-lg font-bold text-yellow-600";
    if (alertaMargen) {
      alertaMargen.textContent = "Margen bajo";
      alertaMargen.className = "text-yellow-600 font-semibold text-center";
    }
  }
  else {
    margenPorcentaje.className = "font-bold text-emerald-600 text-lg";
    utilidadMonto.className = "text-lg font-bold text-emerald-600";
    if (alertaMargen) {
      alertaMargen.textContent = "Margen saludable";
      alertaMargen.className = "text-emerald-600 font-semibold text-center";
    }
  }
}

inputPrecio?.addEventListener("input", calcularRentabilidad);
inputCosto?.addEventListener("input", calcularRentabilidad);

// Ejecutar al cargar si ya hay valores
calcularRentabilidad();