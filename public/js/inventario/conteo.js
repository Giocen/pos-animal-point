import { supabaseClient, protegerSesion } from "../proteccion.js";
await protegerSesion(["cajero", "admin"]);
const negocioId =
  localStorage.getItem("negocio_id") ||
  window.usuarioActual?.negocio_id ||
  null;


// ==========================================================
// 💜 Función universal de diferencia segura (soporta negativos reales)
// ==========================================================
function calcularDiferencia(conteoFisico, existenciasSistema) {
  // Limpia posibles guiones o símbolos raros (–, —)
  const limpiar = (v) =>
    parseFloat(String(v).replace(/[^\d.-]/g, "").replace(",", ".")) || 0;

  const fisico = limpiar(conteoFisico);
  const sistema = limpiar(existenciasSistema);

  // 🔹 Diferencia algebraica real
  const diferencia = fisico - sistema;

  // 🔹 Redondeo matemático seguro (3 decimales)
  return Math.round((diferencia + Number.EPSILON) * 1000) / 1000;
}


// ==========================================================
// 🏷️ Etiqueta visual de diferencia (FALTANTE / SOBRANTE)
// ==========================================================
function etiquetaDiferencia(dif) {
  if (dif < 0) {
    return `<span class="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
      Faltante
    </span>`;
  }

  if (dif > 0) {
    return `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
      Sobrante
    </span>`;
  }

  return `<span class="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
    Cuadrado
  </span>`;
}

// ==========================================================
// ✅ Verifica si hay diferencias pendientes
// ==========================================================
function hayDiferenciasPendientes() {
  return Object.values(conteosEditados).some(
    (c) => Math.abs(c.diferencia) > 0.0001
  );
}

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
});

let productosConteo = {}; 
let conteosEditados = {}; 

// ==========================================================
// 🔢 Normalizar cantidad / peso (kg, gramos, decimales)
// ==========================================================
function normalizarCantidad(valor) {
  if (!valor) return 0;

  valor = valor.toString().trim();

  // Caso: gramos con "g" (ej: 250g)
  if (/^\d+\s*g$/i.test(valor)) {
    const gramos = parseFloat(valor);
    return gramos / 1000; // convertir a KG
  }

  // Caso: solo número entero (ej: 250 → gramos)
  if (/^\d+$/.test(valor)) {
    return parseFloat(valor) / 1000; // asumir gramos
  }

  // Caso: decimal normal (ej: 0.25)
  const num = parseFloat(valor.replace(",", "."));
  return isNaN(num) ? 0 : num;
}
// ==========================
// Botón: Abrir Conteo
// ==========================
document.getElementById("abrirConteo").addEventListener("click", () => {
  Swal.fire({
    title: `
      <div class="flex items-center justify-center gap-2">
        <i data-lucide="package" class="w-6 h-6 text-fuchsia-600 icon-3d"></i>
        <span>Conteo de Inventario</span>
      </div>`,
    width: "85%",
    html: `
      <!-- ================= FILA DE CONTROLES ================= -->
      <div class="grid grid-cols-12 gap-3 mb-4 items-end">

        <!-- Código / SKU -->
        <div class="col-span-4">
          <label class="text-xs font-semibold text-gray-600 mb-1 block">
            Código / SKU
          </label>
          <div class="flex items-center gap-2">
            <i data-lucide="barcode" class="w-5 h-5 text-gray-500"></i>
            <input
              type="text"
              id="codigoBarrasModal"
              maxlength="20"
              class="w-full border rounded px-3 py-2 text-sm focus:ring focus:ring-fuchsia-300"
              placeholder="Escanea código o SKU"
            />
          </div>
        </div>

        <!-- Cantidad / Peso -->
        <div class="col-span-3">
          <label class="text-xs font-semibold text-gray-600 mb-1 block">
            Cantidad / Peso
          </label>
          <input
            type="text"
            id="cantidadConteo"
            maxlength="10"
            class="w-full border rounded px-3 py-2 text-sm focus:ring focus:ring-fuchsia-300"
            placeholder="Ej: 1, 0.250, 250g"
          />
        </div>

        <!-- Cantidad fija -->
        <div class="col-span-2 flex items-center gap-2 pt-6">
          <input type="checkbox" id="chkCantidadFija" class="scale-110" />
          <label for="chkCantidadFija" class="text-xs text-gray-700 leading-tight">
            Usar esta cantidad<br>en cada escaneo
          </label>
        </div>

        <!-- Usuario -->
        <div class="col-span-3">
          <label class="text-xs font-semibold text-gray-600 mb-1 block">
            Usuario
          </label>
          <div class="flex items-center gap-2">
            <i data-lucide="user" class="w-5 h-5 text-gray-500"></i>
            <input
              type="text"
              id="usuarioModal"
              maxlength="20"
              class="w-full border rounded px-3 py-2 text-sm focus:ring focus:ring-fuchsia-300"
              placeholder="Ej: cajero1"
            />
          </div>
        </div>

      </div>

      <!-- ================= TABLA ================= -->
      <div class="overflow-x-auto mb-3 max-h-[200px] overflow-y-auto">
        <table class="w-full border-collapse text-sm card-3d">
          <thead class="bg-fuchsia-100 text-fuchsia-700">
            <tr>
              <th class="p-2">Código</th>
              <th class="p-2">Producto</th>
              <th class="p-2">SKU</th>
              <th class="p-2">Existencias</th>
              <th class="p-2">Conteo</th>
              <th class="p-2">Diferencia</th>
            </tr>
          </thead>
          <tbody id="tablaConteoModal" class="bg-white divide-y"></tbody>
        </table>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    customClass: {
      popup: "card-3d",
      confirmButton: "btn-3d swal2-confirm",
      cancelButton: "btn-3d swal2-cancel",
    },
    confirmButtonText: `
      <span class="flex items-center gap-2">
        <i data-lucide="save" class="w-5 h-5"></i>
        Guardar Conteo
      </span>`,
    cancelButtonText: `
      <span class="flex items-center gap-2">
        <i data-lucide="x" class="w-5 h-5"></i>
        Cerrar
      </span>`,
    didOpen: () => {
      lucide.createIcons();
      document.getElementById("codigoBarrasModal").focus();

      const inputScan = document.getElementById("codigoBarrasModal");

      inputScan.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const codigo = inputScan.value.trim();
          if (!codigo) return;

          // 🔹 1️⃣ Buscar por código de barras
          let { data, error } = await supabaseClient
            .from("v_productos_existencias")
            .select("id, nombre, sku, codigo_barras, existencias_total, unidad")
            .eq("codigo_barras", codigo)
            .eq("negocio_id", negocioId)
            .maybeSingle();


          // 🔹 2️⃣ Si no existe, buscar por SKU
          if (!data) {
            const res2 = await supabaseClient
              .from("v_productos_existencias")
              .select("id, nombre, sku, codigo_barras, existencias_total, unidad")
              .eq("sku", codigo)
              .eq("negocio_id", negocioId) 
              .maybeSingle();


            data = res2.data;
            error = res2.error;
          }

                      // 🔹 3️⃣ Manejo de error o producto no encontrado (sin cerrar el modal)
            if (error || !data) {
              let sobranteExistente = Object.values(productosConteo).find(
                (p) => p.es_sobrante && p.codigo_manual === codigo
              );

              if (sobranteExistente) {
                sobranteExistente.conteo_fisico++;
              } else {
                productosConteo[`sobrante-${codigo}`] = {
                  id: null,
                  codigo_barras: codigo,
                  nombre: "Sobrante detectado (pendiente alta)",
                  sku: "-",
                  existencias_total: 0,
                  conteo_fisico: 1,
                  es_sobrante: true,
                  codigo_manual: codigo,
                };
              }

              renderTablaModal();

              // ✅ Mostrar notificación HTML fuera de SweetAlert (sin cerrarlo)
              const toastEl = document.createElement("div");
              toastEl.className =
                "fixed bottom-4 right-4 bg-fuchsia-600 text-white px-4 py-2 rounded-lg shadow-lg animate__animated animate__fadeInUp";
              toastEl.style.zIndex = "99999";
              toastEl.innerHTML = `<i data-lucide="info" class="w-4 h-4 inline-block mr-1"></i> Código <b>${codigo}</b> registrado como sobrante`;
              document.body.appendChild(toastEl);
              lucide.createIcons();

              setTimeout(() => {
                toastEl.classList.add("animate__fadeOutDown");
                setTimeout(() => toastEl.remove(), 500);
              }, 1500);

              // ✅ Mantiene flujo de escaneo
              setTimeout(() => {
                inputScan.value = "";
                inputScan.focus();
              }, 300);

              return;
            }
          // ==========================================================
          // 🟣 LOGICA FINAL: PIEZAS, KG, GRAMOS, CANTIDAD FIJA
          // ==========================================================

         // Leer cantidad introducida
          let cantidadInputRaw = document.getElementById("cantidadConteo")?.value || "";

          // 🔢 Normalizar según unidad
          let cantidadNormalizada = 0;

          // 👉 Si es producto por KG: usamos normalizarCantidad (kg / gramos)
          if (data.unidad === "kg") {
            cantidadNormalizada = normalizarCantidad(cantidadInputRaw);
          } else {
            // 👉 Si es por PIEZA: tomamos el número tal cual, sin dividir entre 1000
            const n = parseFloat(cantidadInputRaw.replace(",", "."));
            cantidadNormalizada = isNaN(n) ? 0 : n;
          }

          // Modo cantidad fija
          const cantidadFijaActiva =
            document.getElementById("chkCantidadFija")?.checked || false;


          // Cantidad final a sumar
          let cantidadFinal = 1;

          // ---------------------------------------
          // PRODUCTO POR PIEZAS
          // ---------------------------------------
          if (data.unidad !== "kg") {

            if (cantidadNormalizada > 0) {
              // 👉 Si el usuario escribió cantidad, úsala
              cantidadFinal = cantidadNormalizada;
            } else {
              // 👉 Si no escribió nada, usa 1
              cantidadFinal = 1;
            }

          }

          // ---------------------------------------
          // PRODUCTO POR KG
          // ---------------------------------------
          if (data.unidad === "kg") {

            if (cantidadNormalizada <= 0) {
              Swal.fire("Peso requerido", "Ingresa el peso en kilogramos o gramos (ej: 250g).", "warning");
              inputScan.value = "";
              inputScan.focus();
              return;
            }

            if (cantidadFijaActiva) {
              cantidadFinal = cantidadNormalizada; // repetir cada escaneo
            } else {
              cantidadFinal = cantidadNormalizada; // un solo peso por escaneo
            }
          }

          // ---------------------------------------
          // GUARDAR O SUMAR
          // ---------------------------------------
         if (!productosConteo[data.id]) {
            productosConteo[data.id] = {
              ...data,
              unidad: data.unidad,   // ⭐ NUEVO: asegura que la unidad quede guardada
              conteo_fisico: cantidadFinal
            };
          } else {
            productosConteo[data.id].unidad = productosConteo[data.id].unidad || data.unidad; // ⭐ soporte por si viene vacío
            productosConteo[data.id].conteo_fisico += cantidadFinal;
          }

          if (!cantidadFijaActiva) {
            document.getElementById("cantidadConteo").value = "";
          }
          renderTablaModal();
          inputScan.value = "";
        }
      });
    }, 

    preConfirm: async () => {
  const usuario = document.getElementById("usuarioModal").value.trim();
  if (!usuario) {
    Swal.showValidationMessage("⚠️ Ingresa un usuario");
    return false;
  }

  for (const p of Object.values(productosConteo)) {
    let existente = null;
    let errSel = null;

    if (p.id) {
      // ✅ Solo buscar si el producto tiene ID (no es sobrante)
      const resSel = await supabaseClient
        .from("conteos_inventario")
        .select("id, conteo_fisico, existencias_sistema")
        .eq("producto_id", p.id)
        .eq("aplicado", false)
        .maybeSingle();

      existente = resSel.data;
      errSel = resSel.error;
    }

    if (errSel) {
      Swal.showValidationMessage("❌ Error consultando conteo existente");
      return false;
    }

    if (existente) {
      // ✅ Si el producto ya tiene un conteo pendiente
      const nuevoConteo = existente.conteo_fisico + p.conteo_fisico;
      const nuevaDif = calcularDiferencia(nuevoConteo, p.existencias_total);

      const { error: errUpd } = await supabaseClient
        .from("conteos_inventario")
        .update({
          conteo_fisico: nuevoConteo,
          diferencia: nuevaDif,
          usuario,
        })
        .eq("id", existente.id)
        .eq("negocio_id", negocioId);


      if (errUpd) {
        Swal.showValidationMessage("❌ Error actualizando conteo existente");
        return false;
      }
    } else {
      // ✅ Si es un sobrante (sin producto_id)
      if (p.es_sobrante) {
        const { error: errIns } = await supabaseClient
          .from("conteos_inventario")
          .insert([
            {
              producto_id: null,
              existencias_sistema: 0,
              conteo_fisico: p.conteo_fisico,
              diferencia: calcularDiferencia(p.conteo_fisico, 0),
              usuario,
              aplicado: false,
              codigo_manual: p.codigo_manual,
              observacion: p.nombre,
              negocio_id: negocioId
            },
          ]);

        if (errIns) {
          Swal.showValidationMessage("❌ Error insertando sobrante");
          return false;
        }
      } else {
        // ✅ Producto normal
        const { error: errIns } = await supabaseClient
          .from("conteos_inventario")
          .insert([
            {
              producto_id: p.id,
              existencias_sistema: p.existencias_total,
              conteo_fisico: p.conteo_fisico,
              diferencia: calcularDiferencia(p.conteo_fisico, p.existencias_total),
              usuario,
              aplicado: false,
              negocio_id: negocioId     // ⭐ MULTI-NEGOCIO
            }
          ])


        if (errIns) {
          Swal.showValidationMessage("❌ Error insertando conteo nuevo");
          return false;
        }
      }
    }
  }

    productosConteo = {};
  return true;
    }
  }).then((result) => { // ✅ .then dentro del Swal.fire
    if (result.isConfirmed) {
      Swal.fire({
        icon: "success",
        title: "✅ Éxito",
        text: "Conteo registrado en historial",
        customClass: {
          popup: "card-3d",
          confirmButton: "btn-3d swal2-confirm",
        },
      });
    }
  }); 
});   

// ==========================
// Función para mostrar etiqueta de unidad (kg / pieza)
// ==========================
function etiquetaUnidad(unidad) {
  if (!unidad) return "";

  if (unidad === "kg") {
    return `<span class="ml-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-semibold">
      KG
    </span>`;
  }

  return `<span class="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold">
      PIEZA
    </span>`;
}

// ==========================
// Renderizar tabla en Conteo
// ==========================
function renderTablaModal() {
  const tbody = document.getElementById("tablaConteoModal");
  if (!tbody) return;
  tbody.innerHTML = "";

  Object.values(productosConteo).forEach((p) => {
    const dif = calcularDiferencia(p.conteo_fisico, p.existencias_total);
    const signo = dif > 0 ? "+" : dif < 0 ? "−" : ""; // signo visual

    tbody.innerHTML += `
      <tr>
        <td class="p-2">${p.codigo_barras || "-"}</td>
        <td class="p-2">
          ${p.nombre}
          ${etiquetaUnidad(p.unidad)}
        </td>
        <td class="p-2 text-center">${p.sku}</td>
        <td class="p-2 text-center">${p.existencias_total}</td>
      <td class="p-2 text-center">
        <input
          type="text"
          inputmode="decimal"
          value="${p.conteo_fisico ?? ''}"
          class="w-20 border rounded px-1 py-0.5 text-center text-sm focus:ring focus:ring-fuchsia-300"
          oninput="window.editarConteo('${p.id}', this.value)"
          onblur="window.confirmarConteo('${p.id}', this)"
        >

      </td>


        <td class="p-2 text-center font-bold ${
          dif < 0
            ? "text-red-600"
            : dif > 0
            ? "text-emerald-600"
            : "text-gray-600"
          }">
          ${signo}${Math.abs(dif).toFixed(2)}
        </td>

      </tr>
    `;
  });
}


// ==========================
// Botón: Revisión de Conteo
// ==========================
document.getElementById("abrirRevision").addEventListener("click", async () => {
  const { data, error } = await supabaseClient
    .from("conteos_inventario")
    .select(`
      id,
      producto_id,
      codigo_manual,
      observacion,
      conteo_fisico,
      diferencia,
      v_productos_existencias!inner (nombre, codigo_barras, sku, existencias_total)
    `)
    .eq("aplicado", false)
    .eq("negocio_id", negocioId);
    

  if (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo cargar pendientes",
      customClass: { popup: "card-3d" },
    });
    return;
  }

  let html = `
    <div style="max-height:300px;overflow-y:auto;">
      <table class="w-full border-collapse text-sm card-3d" id="tablaRevision">
        <thead class="bg-gray-100 text-gray-700 sticky top-0">
          <tr>
            <th class="p-2">Código de Barras</th>
            <th class="p-2">Producto</th>
            <th class="p-2">SKU</th>
            <th class="p-2">Existencias</th>
            <th class="p-2">Conteo</th>
            <th class="p-2">Diferencia</th>
          </tr>
        </thead>
        <tbody id="tbodyRevision">
  `;

const agrupados = {};

    data.forEach((r) => {
      const key = r.producto_id || `sobrante-${r.codigo_manual}`;

      if (!agrupados[key]) {
        agrupados[key] = {
          ...r,
          conteo_fisico: 0,
          existencias: r.v_productos_existencias?.existencias_total ?? 0
        };
      }

      agrupados[key].conteo_fisico += Number(r.conteo_fisico || 0);
    });

    Object.values(agrupados).forEach((r) => {
      const dif = calcularDiferencia(r.conteo_fisico, r.existencias);

      html += `
        <tr>
          <td class="p-2">${r.v_productos_existencias?.codigo_barras || r.codigo_manual || "-"}</td>
          <td class="p-2">
            ${r.v_productos_existencias?.nombre || r.observacion || "❓"}
            ${etiquetaUnidad(r.v_productos_existencias?.unidad)}
          </td>
          <td class="p-2">${r.v_productos_existencias?.sku || "-"}</td>
          <td class="p-2 text-center">${r.existencias}</td>
          <td class="p-2 text-center">
          <div class="flex items-center justify-center gap-2">
            <input
              type="number"
              value="${r.conteo_fisico}"
              class="border p-1 rounded w-20 text-center"
              oninput="actualizarDiferencia(this, ${r.existencias}, '${r.producto_id || `sobrante-${r.codigo_manual}`}')"
            />
            <span id="label-${r.producto_id || `sobrante-${r.codigo_manual}`}">
              ${etiquetaDiferencia(dif)}
            </span>
          </div>
        </td>

        <td class="p-2 text-center font-bold" id="dif-${r.producto_id || `sobrante-${r.codigo_manual}`}">
          ${dif}
        </td>
        </tr>
      `;
    });

  html += `</tbody></table></div>
           <div class="mt-4 flex justify-center gap-4 flex-wrap">
             <button
                id="btnAplicarAjuste"
                onclick="aplicarTodos()"
                class="btn-3d bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
               <span class="flex items-center gap-2">
                 <i data-lucide="check-circle" class="w-5 h-5 icon-3d"></i> Realizar Ajuste
               </span>
             </button>
             <button onclick="limpiarConteos()" class="btn-3d bg-red-600 hover:bg-red-700 text-white">
               <span class="flex items-center gap-2">
                 <i data-lucide="trash-2" class="w-5 h-5 icon-3d"></i> Nuevo Inventario
               </span>
             </button>
           </div>`;

  Swal.fire({
  title: `
    <div class="flex items-center justify-center gap-2 text-fuchsia-700">
      <i data-lucide="check-circle" class="w-6 h-6 icon-3d"></i>
      <span class="font-bold text-lg">Revisión de Conteo</span>
    </div>`,
  html: `
    <div class="p-2 bg-white/80 rounded-xl shadow-inner max-h-[420px] overflow-y-auto">
      ${html}
    </div>
  `,
  width: "90%",
  background: "linear-gradient(135deg, #faf5ff, #fdf4ff)",
  showCloseButton: true,
  showConfirmButton: false,
  customClass: {
    popup: "card-3d border border-fuchsia-200 shadow-lg",
    closeButton: "text-gray-400 hover:text-fuchsia-600 transition",
  },
  didOpen: () => {
    lucide.createIcons();

    // 💜 Estiliza los botones inferiores directamente
    const botones = document.querySelectorAll(".swal2-container .btn-3d");
    botones.forEach((b) => {
      b.classList.add(
        "rounded-md",
        "shadow-md",
        "px-4",
        "py-2",
        "font-semibold",
        "text-sm",
        "transition",
        "duration-200"
      );
    });
    // 🔒 Deshabilitar botón si no hay diferencias
    const btn = document.getElementById("btnAplicarAjuste");
    if (btn && !hayDiferenciasPendientes()) {
      btn.disabled = true;
      btn.classList.add("opacity-50", "cursor-not-allowed");
    }
  },
});

// ==========================
// Editar diferencias en memoria
// ==========================
function actualizarDiferencia(input, existencias, key) {
  const nuevoConteo = parseFloat(input.value) || 0;
  const nuevaDif = calcularDiferencia(nuevoConteo, existencias);

  // Guardar en memoria
  conteosEditados[key] = {
    conteo: nuevoConteo,
    diferencia: nuevaDif,
  };

  // 🔢 Actualizar número de diferencia
  const difCell = document.getElementById(`dif-${key}`);
  if (difCell) {
    difCell.textContent = nuevaDif;
    difCell.className =
      "p-2 text-center font-bold " +
      (nuevaDif < 0
        ? "text-red-600"
        : nuevaDif > 0
        ? "text-emerald-600"
        : "text-gray-600");
  }

  // 🏷️ Actualizar etiqueta (FALTANTE / SOBRANTE / CUADRADO)
  const label = document.getElementById(`label-${key}`);
  if (label) {
    label.innerHTML = etiquetaDiferencia(nuevaDif);
  }

  // 🔒 Revalidar botón aplicar
  const btn = document.getElementById("btnAplicarAjuste");
  if (btn) {
    if (!hayDiferenciasPendientes()) {
      btn.disabled = true;
      btn.classList.add("opacity-50", "cursor-not-allowed");
    } else {
      btn.disabled = false;
      btn.classList.remove("opacity-50", "cursor-not-allowed");
    }
  }
}


// ==========================
// Aplicar todos
// ==========================
    async function aplicarTodos() {

      if (!hayDiferenciasPendientes()) {
        Swal.fire({
          icon: "info",
          title: "Sin diferencias",
          text: "No hay ajustes que aplicar, todo está cuadrado.",
          customClass: { popup: "card-3d" },
        });
        return;
      }
      for (const [key, datos] of Object.entries(conteosEditados)) {
      const isSobrante = key.startsWith("sobrante-");

      let query = supabaseClient
        .from("conteos_inventario")
        .update({
          conteo_fisico: datos.conteo,
          diferencia: datos.diferencia,
        })
        .eq("aplicado", false)
        .eq("negocio_id", negocioId);

      if (isSobrante) {
        query = query.eq(
          "codigo_manual",
          key.replace("sobrante-", "")
        );
      } else {
        query = query.eq("producto_id", key);
      }

      const { error } = await query;
      if (error) {
        console.error("❌ Error guardando ajuste:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo guardar un ajuste pendiente",
          customClass: { popup: "card-3d" },
        });
        return;
      }
    }

  conteosEditados = {};

  const { data, error } = await supabaseClient
    .rpc("aplicar_todos_los_conteos", { p_negocio_id: negocioId });

  if (!data || !data.length) {
    Swal.fire("Sin cambios", "No se aplicaron ajustes.", "info");
    return;
  }

  const resultado = data[0];

  Swal.fire({
    icon: "success",
    title: "✅ Éxito",
    html: `
      <p>Se aplicaron <b>${resultado.ajustados}</b> conteos.</p>
      <p>Diferencia total: <b>${resultado.total_diferencia}</b></p>
      <p>Fecha: ${new Date(resultado.fecha).toLocaleString()}</p>
    `,
    customClass: {
      popup: "card-3d",
      confirmButton: "btn-3d swal2-confirm",
    },
  });

}

// ==========================
// Reinicio total
// ==========================
async function limpiarConteos() {
  const confirm = await Swal.fire({
    title: "¿Reiniciar inventario?",
    text: "Esto borrará TODOS los conteos (pendientes y aplicados).",
    icon: "warning",
    showCancelButton: true,
    customClass: {
      popup: "card-3d",
      confirmButton: "btn-3d swal2-confirm",
      cancelButton: "btn-3d swal2-cancel",
    },
    confirmButtonText: "Sí, reiniciar",
    cancelButtonText: "Cancelar",
  });

  if (!confirm.isConfirmed) return;

  const { error } = await supabaseClient.rpc("limpiar_conteos_todos", {
    p_negocio_id: negocioId
  });
  if (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo reiniciar el inventario",
      customClass: { popup: "card-3d" },
    });
  } else {
    Swal.fire({
      icon: "success",
      title: "✅ Listo",
      text: "Inventario reiniciado",
      customClass: { popup: "card-3d", confirmButton: "btn-3d swal2-confirm" },
    });
  }
}

// ==========================
// Exportar a Excel
// ==========================
document.getElementById("btnExportExcel")?.addEventListener("click", async () => {
  Swal.fire({
    title: "Generando Excel...",
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "card-3d" },
  });

  const { data, error } = await supabaseClient
    .from("conteos_inventario")
    .select(`
      conteo_fisico,
      diferencia,
      existencias_sistema,
      v_productos_existencias!inner (codigo_barras, nombre, sku, existencias_total)
    `)
    .eq("aplicado", false)
    .eq("negocio_id", negocioId);


    
    

  if (error) {
    console.error(error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo generar el Excel",
      customClass: { popup: "card-3d" },
    });
    return;
  }

  if (!data?.length) {
    Swal.fire({
      icon: "info",
      title: "Vacío",
      text: "No hay registros para exportar",
      customClass: { popup: "card-3d" },
    });
    return;
  }

 const rows = data.map(r => ({
  Codigo: r.v_productos_existencias?.codigo_barras || r.codigo_manual || "-",
  Producto: r.v_productos_existencias?.nombre || r.observacion || "-",
  SKU: r.v_productos_existencias?.sku || "-",
  Unidad: r.v_productos_existencias?.unidad || "-",  // ⭐ NUEVA COLUMNA
  Existencias: r.existencias_sistema ?? 0,
  Conteo: r.conteo_fisico ?? 0,
  Diferencia: r.diferencia ?? 0,
}));



  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Conteo Inventario");

  XLSX.writeFile(workbook, `Conteo_${new Date().toISOString().split("T")[0]}.xlsx`);

  Swal.close();
});

// ==========================
// Exportar a PDF
// ==========================
document.getElementById("btnExportPDF")?.addEventListener("click", async () => {
  Swal.fire({
    title: "Generando PDF...",
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "card-3d" },
  });

  const { data, error } = await supabaseClient
    .from("conteos_inventario")
    .select(`
      conteo_fisico,
      diferencia,
      existencias_sistema,
      v_productos_existencias!inner (codigo_barras, nombre, sku, existencias_total)
    `)

    .eq("aplicado", false)
    .eq("negocio_id", negocioId);

    

  if (error) {
    console.error(error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo generar el PDF",
      customClass: { popup: "card-3d" },
    });
    return;
  }

  if (!data?.length) {
    Swal.fire({
      icon: "info",
      title: "Vacío",
      text: "No hay registros para exportar",
      customClass: { popup: "card-3d" },
    });
    return;
  }

 const rows = data.map(r => [
  r.v_productos_existencias?.codigo_barras || r.codigo_manual || "-",
  r.v_productos_existencias?.nombre || r.observacion || "-",
  r.v_productos_existencias?.sku || "-",
  r.v_productos_existencias?.unidad || "-",  // ⭐ NUEVA COLUMNA
  r.existencias_sistema ?? 0,
  r.conteo_fisico ?? 0,
  r.diferencia ?? 0,
]);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Reporte de Conteo de Inventario", 14, 15);

  doc.autoTable({
    startY: 25,
    head: [["Codigo", "Producto", "SKU", "Existencias", "Conteo", "Diferencia"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [162, 28, 175] }, // fucsia
    styles: { fontSize: 9 },
  });

  doc.save(`Conteo_${new Date().toISOString().split("T")[0]}.pdf`);

  Swal.close();
});

// 👇 Permitir acceso global desde SweetAlert
window.limpiarConteos = limpiarConteos;
window.aplicarTodos = aplicarTodos;
window.actualizarDiferencia = actualizarDiferencia;

});

/* -------------------------------------------------------------------------- */
/* 💾 MODO OFFLINE + SINCRONIZACIÓN - Conteo de Inventario SmartPOS          */
/* -------------------------------------------------------------------------- */

const DB_CONTEO = new Dexie("SmartPOSOffline");
DB_CONTEO.version(1).stores({
  conteos_pendientes: "++id, producto_id, codigo_manual, conteo_fisico, existencias_sistema, diferencia, usuario, es_sobrante",
});

// 🔹 Guardar conteo localmente si no hay conexión
async function guardarConteoOffline(conteo) {
  try {
    await DB_CONTEO.conteos_pendientes.add(conteo);
    console.log("💾 Conteo guardado offline:", conteo);
  } catch (err) {
    console.error("❌ Error guardando conteo offline:", err);
  }
}

// 🔹 Sincronizar todos los conteos pendientes con Supabase
async function sincronizarConteosPendientes() {
  try {
    const pendientes = await DB_CONTEO.conteos_pendientes.toArray();
    if (!pendientes.length) return;

    console.log(`☁️ Sincronizando ${pendientes.length} conteos pendientes...`);

    for (const p of pendientes) {
      try {
        const { error } = await supabaseClient.from("conteos_inventario").insert([{
          producto_id: p.producto_id || null,
          codigo_manual: p.codigo_manual || null,
          existencias_sistema: p.existencias_sistema ?? 0,
          conteo_fisico: p.conteo_fisico ?? 0,
          diferencia: p.diferencia ?? 0,
          usuario: p.usuario || "offline",
          aplicado: false,
          observacion: p.es_sobrante ? "Registrado en modo offline (sobrante)" : null,
          negocio_id: negocioId,
        }]);

        if (!error) {
          console.log("✅ Conteo sincronizado:", p.codigo_manual || p.producto_id);
          await DB_CONTEO.conteos_pendientes.delete(p.id);
        } else {
          console.warn("⚠️ Error al sincronizar conteo:", error.message);
        }
      } catch (err) {
        console.error("❌ Error al sincronizar conteo:", err);
      }
    }

    Toastify({
      text: "☁️ Conteos sincronizados correctamente",
      duration: 2000,
      gravity: "top",
      position: "right",
      style: {
        background: "linear-gradient(90deg, #16a34a, #22c55e)",
        color: "#fff",
        borderRadius: "0.5rem",
        fontWeight: "600",
      },
    }).showToast();
  } catch (err) {
    console.error("❌ Error general sincronizando conteos:", err);
  }
}

// 🔹 Reemplazar parte del flujo del conteo (preConfirm) con fallback offline
// 🔹 Reemplazo de Swal.fire con soporte offline
const originalFire = Swal.fire.bind(Swal);

Swal.fire = async function (options = {}) {
  try {
    if (options?.preConfirm && options.title?.includes("Conteo de Inventario")) {
      const preConfirmOriginal = options.preConfirm;
        options.preConfirm = async () => {
        // ✅ EJECUTAR VALIDACIÓN ORIGINAL PRIMERO
        const validacion = await preConfirmOriginal();
        if (validacion === false) return false;

        const online = navigator.onLine;
        const usuario =
          document.getElementById("usuarioModal")?.value?.trim() || "offline";

        for (const p of Object.values(productosConteo)) {
          const registro = {
            producto_id: p.id || null,
            codigo_manual: p.codigo_manual || null,
            existencias_sistema: p.existencias_total ?? 0,
            conteo_fisico: p.conteo_fisico ?? 0,
            diferencia: calcularDiferencia(p.conteo_fisico, p.existencias_total),
            usuario,
            es_sobrante: !!p.es_sobrante,
            negocio_id: negocioId,
          };

          if (online) {
            try {
              const { error } = await supabaseClient
                .from("conteos_inventario")
                .insert([registro]);
              if (error) throw error;
            } catch (err) {
              await guardarConteoOffline(registro);
            }
          } else {
            await guardarConteoOffline(registro);
          }
        }

        productosConteo = {};
        return true;
      };
    }

    // ✅ Llamar al Swal original manteniendo el contexto
    return await originalFire(options);
  } catch (err) {
    console.error("❌ Error en override de Swal:", err);
    return originalFire({
      icon: "error",
      title: "Error",
      text: "Ocurrió un problema al mostrar el modal",
    });
  }
};


// 🔹 Escuchar reconexión
window.addEventListener("online", () => {
  console.log("🌐 Conexión restaurada, sincronizando conteos pendientes...");
  sincronizarConteosPendientes();
});

// 🔹 Mostrar advertencia visual de modo offline
window.addEventListener("offline", () => {
  const banner = document.createElement("div");
  banner.id = "offline-banner";
  banner.textContent = "📴 Modo sin conexión — los conteos se guardarán localmente";
  banner.className =
    "fixed top-0 left-0 w-full bg-yellow-500 text-white text-center py-2 text-sm font-medium shadow-md animate__animated animate__fadeInDown z-[9999]";
  document.body.appendChild(banner);
});

window.addEventListener("online", () => {
  const banner = document.getElementById("offline-banner");
  if (banner) {
    banner.classList.add("animate__fadeOutUp");
    setTimeout(() => banner.remove(), 500);
  }
});


window.editarConteo = function (productoId, valor) {
  if (!productosConteo[productoId]) return;

  // Guardar texto crudo mientras escribe
  productosConteo[productoId].conteo_tmp = valor;

  // Solo actualizar el número si es válido
  const n = parseFloat(valor.replace(",", "."));
  if (!isNaN(n)) {
    productosConteo[productoId].conteo_fisico = n;
  }
};

window.confirmarConteo = function (productoId, input) {
  if (!productosConteo[productoId]) return;

  const raw = input.value.replace(",", ".");
  const n = parseFloat(raw);

  const final = isNaN(n)
    ? 0
    : Math.round((n + Number.EPSILON) * 1000) / 1000;

  productosConteo[productoId].conteo_fisico = final;
  input.value = final.toString();
};