import { supabaseClient, protegerSesion } from "/js/proteccion.js";


// 💰 FORMATO DINERO
const money = v =>
  Number(v || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

// =========================
// 🔹 VARIABLES EXTRA (NUEVO)
// =========================


document.addEventListener("DOMContentLoaded", async () => {

  await protegerSesion(["admin"]);

  const negocioId =
    localStorage.getItem("negocio_id") ||
    window.usuarioActual?.negocio_id;

  const tabla = document.getElementById("tablaProductos");
  const inputBuscar = document.getElementById("buscar");

  const filtro30 = document.getElementById("filtro30");
  const filtro60 = document.getElementById("filtro60");

  let listaOriginal = [];
  let filtroActivo = "todos";

  // =========================
  // 🚀 CARGA
  // =========================
  async function cargar() {

    const { data, error } = await supabaseClient
      .from("v_rotacion_productos")
      .select("*")
      .eq("negocio_id", negocioId)
      .order("valor_inventario", { ascending: false });

    if (error) {
      Swal.fire("Error", "No se pudo cargar", "error");
      return;
    }

    listaOriginal = data || [];
    datosOriginales = listaOriginal;

    aplicarFiltros();
    resumen();
  }

  // =========================
  // 🔍 FILTROS
  // =========================
  function aplicarFiltros() {

    let data = [...datosOriginales];

    const q = inputBuscar.value.toLowerCase();

    if (q) {
      data = data.filter(p =>
        (p.nombre || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q)
      );
    }

    // 🔥 FILTROS POR COLUMNA
    data = filtrarDatos(data);

    if (filtroActivo === "30") {
      data = data.filter(p => Number(p.dias || 0) >= 30);
    }

    if (filtroActivo === "60") {
      data = data.filter(p => Number(p.dias || 0) >= 60);
    }

    // 🔥 ORDEN
    data = ordenarDatos(data);

    render(data);

    }

  // =========================
  // 📊 RESUMEN
  // =========================
  function resumen() {

  let inventario = 0;
  let mas30 = 0;
  let mas60 = 0;

  listaOriginal.forEach(p => {
    const dias = Number(p.dias || 0);
    const valor = Number(p.valor_inventario || 0);

    inventario += valor;

    if (dias >= 30) mas30++;
    if (dias >= 60) mas60++;
  });

  const elTotal = document.getElementById("totalInventario");
    if (elTotal) elTotal.innerText = "$" + money(inventario);

    const el30 = document.getElementById("prod30");
    if (el30) el30.innerText = mas30;

    const el60 = document.getElementById("prod60");
    if (el60) el60.innerText = mas60;
    }

  // =========================
  // 🎯 RENDER
  // =========================
  function render(lista) {

    tabla.innerHTML = "";

        if (lista.length === 0) {
      tabla.innerHTML = `
        <tr>
          <td colspan="12" class="text-center py-4 text-gray-400">
            Sin resultados
          </td>
        </tr>
      `;

      const totalEl = document.getElementById("totalValor");
      if (totalEl) totalEl.innerText = "$0.00";
      return;
    }

    let total = 0; // 🔥 NUEVO

    lista.forEach(p => {

      total += Number(p.valor_inventario || 0); // 🔥 NUEVO

      const rot = p.rotacion;
      const dias = Number(p.dias || 0);
      const stock = Number(p.existencias || 0);

      const sugerido = Number(p.descuento_sugerido || 0);
      const precio = Number(p.precio_base || 0);
      const final = Number(p.precio_final || precio);
      const descuento = Number(p.descuento_porcentaje || 0);

      const costo = Number(p.costo || 0);

      // 🔥 PRECIO REAL
      const precioActual = final;

      // 🔥 GANANCIA
      const ganancia = precioActual - costo;

      // 🔥 MARGEN
      const margen = precioActual > 0
        ? (ganancia / precioActual) * 100
        : 0;

      let textoDias = dias + " días";
      if (stock <= 0) {
        textoDias = "-";
      }
      let sugerencia = obtenerSugerencia(p);
      let estado = obtenerEstadoVisual(p);
      let color = "";

    if (stock <= 0) {
        color = "text-red-700 font-bold";
      }
      else if (rot === "nuevo") {
        color = "text-blue-400";
      }
      else if (rot === "alta") {
        color = "text-green-600 font-bold";
      }
      else if (rot === "media") {
        color = "text-blue-500";
      }
      else if (rot === "baja") {
        color = "text-orange-500";
      }
      else if (rot === "lenta") {
        color = "text-orange-600 font-bold";
      }
      else if (rot === "critica") {
        color = "text-red-600 font-bold";
      }
      else {
        color = "text-gray-500";
      }
      
      let precioHTML = "";

      if (p.descuento_activo) {
        precioHTML = `
          <div class="text-right">
            <span class="line-through text-gray-400 text-xs">$${money(precio)}</span><br>
            <span class="text-red-600 font-bold">$${money(final)}</span><br>
            <span class="text-xs text-red-500">-${descuento}%</span>
          </div>
        `;
      } else {
        precioHTML = `<div class="text-right">$${money(precio)}</div>`;
      }

      let acciones = "";

      if (p.descuento_activo) {
        acciones = `
          <button onclick="quitarDescuento('${p.id}')"
            class="bg-gray-500 text-white px-2 py-1 rounded text-xs">
            Quitar
          </button>
        `;
      } else if (sugerido > 0 && stock > 0) {
        acciones = `
          <button onclick="aplicarDesdeInput('${p.id}')"
            class="bg-orange-600 text-white px-2 py-1 rounded text-xs">
            Aplicar -${sugerido}%
          </button>
        `;
      }

      let rowClass = stock <= 0 ? "bg-red-50" : "";

       const simulacionHTML = `
      <div class="flex items-center gap-1 justify-center">

        <input 
          type="number"
          value="0"
          min="0"
          max="100"
          step="1"
          class="w-12 border rounded px-1 text-xs text-center"
          oninput="simularDescuento('${p.id}', this.value)"
        >

        <span class="text-[10px]">%</span>

      </div>
      `;


      tabla.insertAdjacentHTML("beforeend", `
        <tr class="${rowClass}" data-id="${p.id}">
          <td>${p.sku || ""}</td>
          <td>${p.nombre || ""}</td>
          <td>${p.categoria || ""}</td>
          <td class="text-right">$${money(p.costo)}</td>
          <td class="text-right">${precioHTML}</td>
          <td class="text-right">${p.existencias || 0}</td>
          <td class="text-right">$${money(p.valor_inventario)}</td>
          <td class="text-right ${color}">${textoDias}</td>
          <td class="${color}">${estado}</td>
         <td class="text-xs text-orange-500">
            ${sugerido > 0 ? `-${sugerido}% sugerido` : sugerencia}
          </td>

          <td id="gan_${p.id}" class="text-right font-bold">
            $${money(ganancia)}
          </td>

          <td id="margen_${p.id}" class="text-right font-bold">
            ${margen.toFixed(1)}%
          </td>

            <td class="text-center">
            ${simulacionHTML}
            <div id="res_${p.id}" class="text-[10px] mt-1"></div>
          </td>

        </tr>
      `);

   setTimeout(() => {
      simularDescuento(p.id, 0);
    }, 0);


    });

        

    // 🔥 TOTAL FOOTER
    const totalEl = document.getElementById("totalValor");
    if (totalEl) {
      totalEl.innerText = "$" + money(total);
    }
  }

  // =========================
  // 🎯 ACCIONES
  // =========================

window.aplicarDescuento = async (productoId, porcentaje) => {

  const p = datosOriginales.find(x => x.id == productoId);
  if (!p) return;

  const costo = Number(p.costo || 0);
  const precio = Number(p.precio_base || 0);
  const final = precio - (precio * porcentaje / 100);

  if (final < costo) {
    Swal.fire("Error", "No puedes vender por debajo del costo", "error");
    return;
  }

  const confirm = await Swal.fire({
    title: "Aplicar descuento",
    text: `Se aplicará ${porcentaje}%`,
    icon: "question",
    showCancelButton: true
  });

  if (!confirm.isConfirmed) return;

  const { error } = await supabaseClient.rpc("aplicar_descuento_producto", {
    p_producto_id: productoId,
    p_porcentaje: porcentaje
  });

  if (error) {
    Swal.fire("Error", error.message, "error");
    return;
  }

  Swal.fire("Listo", "Descuento aplicado", "success");
  cargar();
};

  window.quitarDescuento = async (productoId) => {

    const { error } = await supabaseClient.rpc("quitar_descuento_producto", {
      p_producto_id: productoId
    });

    if (error) {
      Swal.fire("Error", error.message, "error");
      return;
    }

    Swal.fire("Listo", "Descuento eliminado", "success");
    cargar();
  };

if (filtro30) {
  filtro30.onclick = () => {
    filtroActivo = "30";
    aplicarFiltros();
  };
}

if (filtro60) {
  filtro60.onclick = () => {
    filtroActivo = "60";
    aplicarFiltros();
  };
}

inputBuscar.addEventListener("input", () => {
  aplicarFiltros();
});
 

  cargar();

});

// =========================
// 🔹 VARIABLES EXCEL
// =========================
let datosOriginales = [];
let ordenActual = { col: "valor_inventario", asc: false };
let filtros = {};

// =========================
// 🔹 FILTROS DROPDOWN (NUEVO)
// =========================
setTimeout(() => {
  document.querySelectorAll(".filtro-box input").forEach(input => {
    input.addEventListener("input", (e) => {
      const col = e.target.closest("th").dataset.col;
      filtros[col] = e.target.value.toLowerCase();
      document.getElementById("buscar")?.dispatchEvent(new Event("input"));
    });
  });
}, 500);


function obtenerSugerencia(p) {
  const rot = p.rotacion;
  const stock = Number(p.existencias || 0);

  if (stock <= 0) return "Resurtir urgente";
  if (rot === "nuevo") return "Dar visibilidad";
  if (rot === "alta") return "Reabastecer";
  if (rot === "media") return "Mantener";
  if (rot === "baja") return "Promoción leve";
  if (rot === "lenta") return "Mover inventario";
  if (rot === "critica") return "Descuento agresivo";
  return "Revisar producto";
}


function obtenerEstadoVisual(p) {
  const rot = p.rotacion;
  const stock = Number(p.existencias || 0);

  if (stock <= 0) return "Sin stock";
  if (rot === "nuevo") return "Nuevo";
  if (rot === "alta") return "Alta rotación";
  if (rot === "media") return "Media";
  if (rot === "baja") return "Baja";
  if (rot === "lenta") return "Lenta";
  if (rot === "critica") return "Crítica";
  return "Sin movimiento";
}

// =========================

// 🔹 ORDENAR
// =========================
function ordenarDatos(data) {
  if (!ordenActual.col) return data;
  if (ordenActual.col === "accion") return data;

  return [...data].sort((a, b) => {

  let valA;
  let valB;

  // 🔥 CASOS ESPECIALES
  if (ordenActual.col === "dias") {
  valA = Number(a.dias || 0);
  valB = Number(b.dias || 0);
    }
    else if (ordenActual.col === "rotacion") {

      const prioridad = {
        "Sin stock": 1,
        "Crítica": 2,
        "Lenta": 3,
        "Baja": 4,
        "Media": 5,
        "Alta rotación": 6,
        "Nuevo": 7,
        "Sin movimiento": 8
      };

      valA = prioridad[obtenerEstadoVisual(a)] || 99;
      valB = prioridad[obtenerEstadoVisual(b)] || 99;
    }
    else if (ordenActual.col === "sugerencia") {
      valA = obtenerSugerencia(a);
      valB = obtenerSugerencia(b);
    }
    else {
      valA = a[ordenActual.col];
      valB = b[ordenActual.col];
    }

    // 🔥 NUMÉRICOS REALES
    if (
      typeof valA === "number" &&
      typeof valB === "number"
    ) {
      return ordenActual.asc ? valA - valB : valB - valA;
    }

    // 🔥 CONVERTIR SI SON NUMÉRICOS STRING
    const numA = parseFloat(valA);
    const numB = parseFloat(valB);

    if (!isNaN(numA) && !isNaN(numB)) {
      return ordenActual.asc ? numA - numB : numB - numA;
    }

    // 🔥 TEXTO
    valA = (valA || "").toString().toLowerCase();
    valB = (valB || "").toString().toLowerCase();

    if (valA < valB) return ordenActual.asc ? -1 : 1;
    if (valA > valB) return ordenActual.asc ? 1 : -1;
    return 0;
  });
}
// =========================
// 🔹 FILTRAR
// =========================
function filtrarDatos(data) {
  return data.filter(item => {
    return Object.keys(filtros).every(col => {
      if (!filtros[col]) return true;
      return (item[col] + "").toLowerCase().includes(filtros[col]);
    });
  });
}

// =========================
// 🔹 ORDEN UI
// =========================
setTimeout(() => {

  const guardado = localStorage.getItem("ordenTabla");
  if (guardado) {
    ordenActual = JSON.parse(guardado);
  }

  const ths = document.querySelectorAll(".sortable");

  function actualizarUI() {

    ths.forEach(th => {
      th.classList.remove("sort-active");

      const icon = th.querySelector(".sort-icon");
      if (icon) icon.textContent = "";
    });

    if (!ordenActual.col) return;

    const activo = document.querySelector(`[data-col="${ordenActual.col}"]`);

    if (activo) {
      activo.classList.add("sort-active");

      const icon = activo.querySelector(".sort-icon");
      if (icon) {
        icon.textContent = ordenActual.asc ? "↑" : "↓";
      }
    }
  }

  ths.forEach(th => {
    th.addEventListener("click", () => {

      const col = th.dataset.col;

      if (ordenActual.col === col) {
        ordenActual.asc = !ordenActual.asc;
      } else {
        ordenActual.col = col;
        ordenActual.asc = true;
      }

      localStorage.setItem("ordenTabla", JSON.stringify(ordenActual));

      actualizarUI();
      document.getElementById("buscar")?.dispatchEvent(new Event("input"));
    });
  });

  actualizarUI();

}, 300);

// =========================
// 📥 EXPORTAR EXCEL
// =========================
document.addEventListener("DOMContentLoaded", () => {

 document.getElementById("btnExportar")?.addEventListener("click", () => {

  let data = [];

  data.push([
  "SKU",          // A
  "Producto",     // B
  "Categoría",    // C
  "Costo",        // D
  "Precio Base",  // E
  "% Desc",       // F 👈 editable en Excel
  "Precio Final", // G (formula)
  "Ganancia",     // H (formula)
  "Margen %",     // I (formula)
  "Existencias",  // J
  "Valor",        // K
  "Días",         // L
  "Estado"        // M
]);

  datosOriginales.forEach(p => {

    const rowIndex = data.length + 1; // 🔥 importante

data.push([
  p.sku || "",                     // A
  p.nombre || "",                  // B
  p.categoria || "",               // C
  Number(p.costo || 0),            // D
  Number(p.precio_base || 0),      // E

  0,                               // F 👉 editable en Excel (% descuento)

  { f: `E${rowIndex}*(1-F${rowIndex}/100)` },                  // G Precio final
  { f: `G${rowIndex}-D${rowIndex}` },                          // H Ganancia
  { f: `IF(G${rowIndex}=0,0,(H${rowIndex}/G${rowIndex}))` }, // I Margen %

  Number(p.existencias || 0),      // J
  Number(p.valor_inventario || 0), // K
  Number(p.dias || 0),             // L
  p.rotacion || ""                 // M
]);

  });

 const ws = XLSX.utils.aoa_to_sheet(data);


for (let i = 2; i <= data.length; i++) {

  const gananciaCell = ws[`H${i}`];
  const margenCell = ws[`I${i}`];

  // 🔥 FORMATO PORCENTAJE
  if (margenCell) {
    margenCell.z = "0.00%";
  }

}

// 🔥 luego tus columnas
ws['!cols'] = [
  { wch: 12 },
  { wch: 30 },
  { wch: 20 },
  { wch: 10 },
  { wch: 12 },
  { wch: 10 },
  { wch: 14 },
  { wch: 14 },
  { wch: 12 },
  { wch: 10 },
  { wch: 14 },
  { wch: 8 },
  { wch: 15 }
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Rotación");
XLSX.writeFile(wb, "rotacion_productos.xlsx");

});

});


window.simularDescuento = (id, porcentaje) => {

  const p = datosOriginales.find(x => x.id == id);
  if (!p) return;

  const costo = Number(p.costo || 0);
  const precioBase = Number(p.precio_base || 0);

  const desc = Number(porcentaje || 0);

  // 🔥 PRECIO NUEVO
  const precioFinal = precioBase - (precioBase * desc / 100);

  // 🔥 GANANCIA
  const ganancia = precioFinal - costo;

  // 🔥 MARGEN
  const margen = precioFinal > 0
    ? (ganancia / precioFinal) * 100
    : 0;

  // =========================
  // 🔥 ACTUALIZAR GANANCIA
  // =========================
  const elGan = document.getElementById(`gan_${id}`);
  if (elGan) {
    elGan.textContent = `$${money(ganancia)}`;
    elGan.style.color = ganancia < 0 ? "red" : "green";
  }

  // =========================
  // 🔥 ACTUALIZAR MARGEN
  // =========================
  const elMarg = document.getElementById(`margen_${id}`);
  if (elMarg) {
    elMarg.textContent = `${margen.toFixed(1)}%`;

    elMarg.style.color =
      margen < 10 ? "red" :
      margen < 20 ? "orange" :
      "green";
  }

  // =========================
  // 🔥 RESULTADO VISUAL
  // =========================
  const el = document.getElementById(`res_${id}`);

  let color = "text-green-600";
  let mensaje = "OK";

  if (precioFinal < costo) {
    color = "text-red-600";
    mensaje = "❌ PÉRDIDA";
  }
  else if (margen < 10) {
    color = "text-orange-500";
    mensaje = "⚠ Margen bajo";
  }

  if (el) {
    el.innerHTML = `
      <span class="${color} font-bold">${mensaje}</span><br>
      Precio: $${money(precioFinal)}
    `;
  }

};

window.aplicarDesdeInput = (id) => {

  const input = document.querySelector(`input[oninput*="${id}"]`);
  if (!input) return;

  const porcentaje = Number(input.value || 0);

  aplicarDescuento(id, porcentaje);
};

window.simularDescuentoSync = (id, porcentaje) => {

  const p = datosOriginales.find(x => x.id == id);
  if (!p) return;

  const costo = Number(p.costo || 0);
  const precioBase = Number(p.precio_base || 0);

  const desc = Number(porcentaje || 0);
  const precioFinal = precioBase - (precioBase * desc / 100);

  const ganancia = precioFinal - costo;
  const margen = precioFinal > 0 ? (ganancia / precioFinal) * 100 : 0;

  // 🔥 BUSCAR SOLO EN ESA FILA
  const fila = document.querySelector(`tr[data-id="${id}"]`);
  if (!fila) return;

  const inputMargen = fila.querySelector(`input[placeholder="% Margen"]`);
  if (inputMargen) inputMargen.value = margen.toFixed(1);

  pintarResultado(id, precioFinal, ganancia, margen, costo);
};

window.simularMargenSync = (id, margenDeseado) => {

  const p = datosOriginales.find(x => x.id == id);
  if (!p) return;

  const costo = Number(p.costo || 0);
  const precioBase = Number(p.precio_base || 0);

  const margen = Number(margenDeseado || 0);

  const precioFinal = costo / (1 - (margen / 100));
  const descuento = 100 - ((precioFinal / precioBase) * 100);

  const ganancia = precioFinal - costo;

  // 🔥 BUSCAR SOLO EN ESA FILA
  const fila = document.querySelector(`tr[data-id="${id}"]`);
  if (!fila) return;

  const inputDesc = fila.querySelector(`input[placeholder="% Desc"]`);
  if (inputDesc) inputDesc.value = descuento.toFixed(0);

  pintarResultado(id, precioFinal, ganancia, margen, costo);
};

function pintarResultado(id, precioFinal, ganancia, margen, costo) {

  const el = document.getElementById(`res_${id}`);

  let color = "text-green-600";
  let mensaje = "OK";

  if (precioFinal < costo) {
    color = "text-red-600";
    mensaje = "❌ PÉRDIDA";
  }
  else if (margen < 10) {
    color = "text-orange-500";
    mensaje = "⚠ Margen bajo";
  }

  el.innerHTML = `
    <span class="${color} font-bold">${mensaje}</span><br>
    $${money(precioFinal)}<br>
    G: $${money(ganancia)}<br>
    M: ${margen.toFixed(1)}%
  `;
}