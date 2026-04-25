/* ============================================================
   💜 SmartPOS — Módulo de Pagos v4.6 ESTABLE
   ✔ Compatible con MULTI-NEGOCIO
   ✔ Mixto corregido (escritura libre + validación perfecta)
   ✔ Sin "0.00" forzado hasta blur()
   ✔ Lógica original intacta
============================================================ */
import { supabaseClient } from "/js/proteccion.js";

const lucide = window.lucide;
const Swal = window.Swal;

export let metodoPago = null;
export let pagoEfectivo = 0;
export let pagoTarjeta = 0;
export let pagoTransfer = 0;
export let voucherTarjeta = "";
export let cambio = 0;

let totalCarrito = 0;
let totalCallback = null;

let configMP = {
  comision_base: 0,
  meses: [],
  msi: {}
};



function animarBoton(btn){
    btn.style.transform = "scale(0.92)";
    btn.style.boxShadow = "0 0 10px rgba(255,0,255,0.6)";

    setTimeout(()=>{
        btn.style.transform = "scale(1)";
        btn.style.boxShadow = "none";
    },120);
}

function soloNumerosDecimal(input) {
    let valor = input.value;

    // ❌ Elimina todo lo que no sea número o punto
    valor = valor.replace(/[^0-9.]/g, "");

    // ❌ Evita más de un punto decimal
    const partes = valor.split(".");
    if (partes.length > 2) {
        valor = partes[0] + "." + partes[1];
    }

    input.value = valor;
}
function sugerirMontoPago(total) {

    if (total <= 20) return 20;
    if (total <= 50) return 50;
    if (total <= 100) return 100;
    if (total <= 200) return 200;

    if (total <= 300) return 500; // 🔥 clave real
    if (total <= 500) return 500;

    if (total <= 800) return 1000;
    if (total <= 1000) return 1000;

    return Math.ceil(total / 500) * 500;
}


/* ============================================================
   🔄 Escucha del total del carrito
============================================================ */
document.addEventListener("carrito-total-cambiado", (e) => {
    totalCarrito = Number(e.detail) || 0;

    const totalPanel = document.getElementById("panelPagoTotal");
    if (totalPanel) totalPanel.textContent = `$${totalCarrito.toFixed(2)}`;

    if (totalCarrito <= 0) {
        resetEstadosPago();
        limpiarFormulario();
        return;
    }

    if (metodoPago === "efectivo") {
        const inp = document.getElementById("inpEfec");
        const txt = document.getElementById("txtCambio");
        if (inp && txt) validarEfectivo(inp, txt);
    }

    

    if (metodoPago === "tarjeta") {

    const tipo = document.getElementById("tipoPagoTarjeta")?.value;

    // 🔥 SOLO si es normal
    if (tipo !== "msi") {
        pagoTarjeta = totalCarrito;

        const inp = document.getElementById("inpTar");
        if (inp) inp.value = totalCarrito.toFixed(2);
    }

}

    if (metodoPago === "transferencia") {
        pagoTransfer = totalCarrito;
        const inp = document.getElementById("inpTrans");
        if (inp) inp.value = totalCarrito.toFixed(2);
    }

    if (metodoPago === "mixto") recalcularMixto();
});

/* ============================================================
   🚀 Inicializador general
============================================================ */
export async function inicializarPagos(totalVentaCallback) {

    await cargarConfigPagos();

    if (!totalCallback) totalCallback = totalVentaCallback;

    totalCarrito = Number(totalCallback()) || 0;

    const totalPanel = document.getElementById("panelPagoTotal");
    if (totalPanel) totalPanel.textContent = `$${totalCarrito.toFixed(2)}`;

    document.addEventListener("carrito-actualizado", () => {
        totalCarrito = Number(totalCallback()) || 0;
        if (totalPanel)
            totalPanel.textContent = `$${totalCarrito.toFixed(2)}`;
    });

    const botones = document.querySelectorAll(".pago-metodo-btn");
    const form = document.getElementById("panelPagoFormulario");

    botones.forEach(btn => {
        btn.addEventListener("click", () => {
            limpiarVoucher();
            limpiarFormulario();

            botones.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            metodoPago = btn.dataset.metodo;
            renderFormulario(metodoPago, form);
        });
    });

    const btnFinalizar = document.getElementById("btnFinalizarVentaPanel");

    btnFinalizar?.addEventListener("click", () => {

        if (!metodoPago) {
            Swal.fire("Método faltante", "Selecciona un método de pago.", "warning");
            return;
        }

        if (metodoPago === "mixto") {
            const suma = pagoEfectivo + pagoTarjeta;
            if (suma < totalCarrito) {
                Swal.fire("Falta dinero", "Completa el total de la venta.", "warning");
                return;
            }
        }

        window.pagoFinal = {
            metodo: metodoPago,
            efectivo: pagoEfectivo,
            tarjeta: pagoTarjeta,
            transferencia: pagoTransfer,
            voucher: voucherTarjeta,
            cambio
        };

        document.dispatchEvent(new CustomEvent("pago-confirmado"));
    });
}

/* ============================================================
   FORMULARIOS
============================================================ */
function renderFormulario(metodo, form) {

    if (!form) return;

    /* 🟣 EFECTIVO ------------------------------------------- */
    if (metodo === "efectivo") {

        form.innerHTML = `
        <label class="block mb-2 text-white font-bold">¿Cuánto paga?</label>

        <div class="grid grid-cols-2 gap-4">

        <div class="flex flex-col">
            <label class="text-sm font-semibold text-gray-200 mb-1">Monto:</label>
            <input id="inpEfec" class="pago-input text-center" inputmode="decimal" value="">
        </div>

        <div class="flex flex-col">
            <label class="text-sm font-semibold text-gray-200 mb-1">Cambio:</label>
            <div class="flex items-center justify-center bg-fuchsia-900/30 
                        border border-fuchsia-500/40 rounded-lg text-white 
                        text-2xl font-bold py-3 px-4">
            <span id="txtCambio">$0.00</span>
            </div>
        </div>

        </div>

        <!-- 🔥 BOTÓN INTELIGENTE -->
        <button id="btnSugerido" class="btn-monto w-full mt-3 bg-emerald-600/30 border-emerald-400/40">
        💡 Pago sugerido
        </button>

        <!-- 🔥 BOTONES -->
        <div class="grid grid-cols-3 gap-2 mt-2">
        <button class="btn-monto" data-monto="50">$50</button>
        <button class="btn-monto" data-monto="100">$100</button>
        <button class="btn-monto" data-monto="200">$200</button>

        <button class="btn-monto" data-monto="500">$500</button>
        <button class="btn-monto" data-monto="1000">$1000</button>
        <button class="btn-monto" data-monto="exacto">Exacto</button>
        </div>
        `;
        const inp = document.getElementById("inpEfec");
        const txt = document.getElementById("txtCambio");

        // 🔥 BOTÓN SUGERIDO
            const btnSug = document.getElementById("btnSugerido");

            if (btnSug) {
                const monto = sugerirMontoPago(totalCarrito);
                btnSug.textContent = `💡 Cliente paga con $${monto}`;

                btnSug.addEventListener("click", () => {
                    inp.value = monto.toFixed(2);
                    validarEfectivo(inp, txt);

                    
                    animarBoton(btnSug);
                });
            }

        inp.addEventListener("input", () => {
            soloNumerosDecimal(inp); // 🔥 NUEVO
            validarEfectivo(inp, txt);
        });

        const botones = document.querySelectorAll(".btn-monto[data-monto]");

        botones.forEach(btn => {
            btn.addEventListener("click", () => {

                if (btn.dataset.monto === "exacto") {
                    inp.value = totalCarrito.toFixed(2);
                } else {
                    inp.value = Number(btn.dataset.monto);
                }

                validarEfectivo(inp, txt);

                
                animarBoton(btn);
            });
        });

        inp.addEventListener("blur", () => {
            if (inp.value !== "")
                inp.value = parseFloat(inp.value).toFixed(2);
        });

        return;
    }

    /* 🟣 TARJETA -------------------------------------------- */
if (metodo === "tarjeta") {

    form.innerHTML = `
        <div class="grid grid-cols-2 gap-3">

            <div class="flex flex-col">
                <label class="text-sm font-semibold text-gray-200">Monto</label>
                <input id="inpTar"
                class="pago-input text-center bg-white/10 text-white border border-white/20"
                value="${totalCarrito.toFixed(2)}">
            </div>

            <div class="flex flex-col">
                <label class="text-sm font-semibold text-gray-200">Voucher</label>
                <input id="inpVouch"
                class="pago-input text-center tracking-widest bg-white/10 text-white border border-white/20"
                placeholder="0000 0000">
            </div>

        </div>

        <div class="mt-3">
            <label class="text-sm text-gray-300">Tipo de pago</label>
            <select id="tipoPagoTarjeta"
            class="pago-input mt-1 bg-white text-black border border-gray-300">
                <option value="normal">Pago normal</option>
                <option value="msi">Meses sin intereses</option>
            </select>
        </div>

        <div id="bloqueMSI" class="mt-3 hidden">
            <label class="text-sm text-gray-300">Seleccionar meses</label>
            <select id="selectMSI"
            class="pago-input mt-1 bg-white text-black border border-gray-300">
            </select>

            <div id="infoMSI" class="text-xs text-gray-300 mt-2"></div>

            <button id="btnConfigMSI" 
                class="mt-2 text-xs text-fuchsia-300 underline">
                ⚙ Configurar meses
            </button>
        </div>
    `;

    const t = document.getElementById("inpTar");
    const v = document.getElementById("inpVouch");
    const tipoPago = document.getElementById("tipoPagoTarjeta");
    pagoTarjeta = totalCarrito;
    t.value = totalCarrito.toFixed(2);

    tipoPago.querySelectorAll("option").forEach(opt => {
        opt.style.color = "#111";
    });
    const bloqueMSI = document.getElementById("bloqueMSI");
    const selectMSI = document.getElementById("selectMSI");
    const infoMSI = document.getElementById("infoMSI");
    const btnConfig = document.getElementById("btnConfigMSI");

    // 🔥 si no hay config
        selectMSI.innerHTML = "";

        if (!configMP.meses.length) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "Configura meses";
            selectMSI.appendChild(opt);
        } else {
            configMP.meses.forEach(m => {
                const opt = document.createElement("option");
                opt.style.color = "#111"; 
                opt.value = m;
                opt.textContent = `${m} meses`;
                selectMSI.appendChild(opt);
            });
        }

    // 🔥 cálculo
   function calcularMP(total, meses) {

    // 🔥 SOLO MSI lleva comisión base
    const base = configMP.comision_base; // 3.5%
    const extra = configMP.msi[meses] || 0;

    const tasa = base + extra;

    const comision = total * tasa;
    const iva = comision * 0.16;

    const totalFinal = total + comision + iva;
    const mensualidad = totalFinal / meses;

    return {
        totalFinal,
        mensualidad,
        tasa,
        comision,
        iva
    };
}



    // 🔥 evento MSI
    selectMSI.addEventListener("change", () => {
        const meses = Number(selectMSI.value);
        if (!meses) return;

        const res = calcularMP(totalCarrito, meses);

        infoMSI.innerHTML = `
        <div class="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">

            <div class="text-center mb-2">
            <span class="text-xs text-gray-400">Pago mensual</span><br>
            <span class="text-xl font-bold text-emerald-400">
                $${res.mensualidad.toFixed(2)}
            </span>
            <span class="text-xs text-gray-400">x ${meses} meses</span>
            </div>

            <div class="flex justify-between text-xs mt-2">
            <span class="text-gray-400">Total</span>
            <span class="text-white font-semibold">
                $${res.totalFinal.toFixed(2)}
            </span>
            </div>

            <div class="flex justify-between text-xs">
            <span class="text-gray-400">Comisión</span>
            <span class="text-fuchsia-400 font-semibold">
                ${(res.tasa * 100).toFixed(2)}%
            </span>
            </div>

        </div>
        `;

        pagoTarjeta = res.totalFinal;
        t.value = res.totalFinal.toFixed(2);
    });

    // 🔥 seleccionar primer mes automático
    if (configMP.meses.length > 0) {
        selectMSI.value = configMP.meses[0];
    }

    // 🔥 mostrar / ocultar
    tipoPago.addEventListener("change", () => {

    if (tipoPago.value === "msi") {

        bloqueMSI.classList.remove("hidden");

        // 🔥 aquí sí aplica comisión
        selectMSI.dispatchEvent(new Event("change"));

    } else {

        bloqueMSI.classList.add("hidden");

        // 🔥 AQUÍ NO HAY COMISIÓN
        pagoTarjeta = totalCarrito;
        t.value = totalCarrito.toFixed(2);

        // 🔥 limpiar info
        infoMSI.innerHTML = "";
    }
});



    // 🔥 botón config
    btnConfig.addEventListener("click", abrirConfigMSI);

    // 🔥 input manual
    t.addEventListener("input", () => {
        soloNumerosDecimal(t);
        pagoTarjeta = parseFloat(t.value) || 0;
    });

    t.addEventListener("blur", () => {
        if (t.value !== "")
            t.value = parseFloat(t.value).toFixed(2);
    });

    v.addEventListener("input", () => voucherTarjeta = v.value);

    pagoTarjeta = totalCarrito;

    return;
}


    /* 🟣 TRANSFERENCIA -------------------------------------- */
    if (metodo === "transferencia") {

        form.innerHTML = `
            <label class="text-sm font-semibold text-gray-200">Monto transferido</label>
            <input id="inpTrans" class="pago-input" value="${totalCarrito.toFixed(2)}">
        `;

        const inp = document.getElementById("inpTrans");

        inp.addEventListener("input", () => {
            soloNumerosDecimal(inp); // 🔥 NUEVO

            const val = parseFloat(inp.value);
            pagoTransfer = isNaN(val) ? 0 : val;
        });

        inp.addEventListener("blur", () => {
            if (inp.value !== "")
                inp.value = parseFloat(inp.value).toFixed(2);
        });

        pagoTransfer = totalCarrito;
        return;
    }

    /* 🟣 MIXTO ---------------------------------------------- */
    if (metodo === "mixto") {

        form.innerHTML = `
            <label class="text-sm font-semibold text-gray-200">Efectivo</label>
            <input id="mxEfec" class="pago-input" value="">

            <label class="mt-2 text-sm font-semibold text-gray-200">Tarjeta</label>
            <input id="mxTar" class="pago-input" value="">

            <p id="mxValida" class="text-red-300 mt-1 text-sm"></p>
        `;

       const ef = document.getElementById("mxEfec");
        const tj = document.getElementById("mxTar");

        ef.addEventListener("input", () => {
            soloNumerosDecimal(ef); // 🔥 NUEVO
            recalcularMixto();
        });

        tj.addEventListener("input", () => {
            soloNumerosDecimal(tj); // 🔥 NUEVO
            recalcularMixto();
        });

        ef.addEventListener("blur", () => {
            if (ef.value !== "")
                ef.value = parseFloat(ef.value).toFixed(2);
        });

        tj.addEventListener("blur", () => {
            if (tj.value !== "")
                tj.value = parseFloat(tj.value).toFixed(2);
        });

        return;
    }
}

/* ============================================================
   🔍 MIXTO — Validación completa
============================================================ */
function recalcularMixto() {
    const ef = document.getElementById("mxEfec");
    const tj = document.getElementById("mxTar");
    const msg = document.getElementById("mxValida");

    if (!ef || !tj || !msg) return;

    pagoEfectivo = parseFloat(ef.value) || 0;
    pagoTarjeta = parseFloat(tj.value) || 0;

    const suma = pagoEfectivo + pagoTarjeta;

    if (suma < totalCarrito) {
        const falta = totalCarrito - suma;
        msg.style.color = "#fecaca";
        msg.textContent = `Faltan $${falta.toFixed(2)}`;
        cambio = 0;
        return;
    }

    cambio = suma - totalCarrito;

    msg.style.color = "#bbf7d0";
    msg.textContent = `Cambio: $${cambio.toFixed(2)}`;
}

/* ============================================================
   VALIDAR EFECTIVO
============================================================ */
function validarEfectivo(input, txt) {

    let val = parseFloat(input.value);
    if (isNaN(val)) val = 0;

    pagoEfectivo = val;
    cambio = pagoEfectivo - totalCarrito;

    txt.textContent = `$${cambio.toFixed(2)}`;
}

/* ============================================================
   ♻️ LIMPIAR ESTADOS INTERNOS
============================================================ */
function resetEstadosPago() {
    metodoPago = null;
    pagoEfectivo = 0;
    pagoTarjeta = 0;
    pagoTransfer = 0;
    voucherTarjeta = "";
    cambio = 0;
}

function limpiarFormulario() {
    const form = document.getElementById("panelPagoFormulario");
    if (form) form.innerHTML = "";

    document.querySelectorAll(".pago-metodo-btn")
        .forEach(b => b.classList.remove("active"));

    const cambioTxt = document.getElementById("txtCambio");
    if (cambioTxt) cambioTxt.textContent = "$0.00";

    const msg = document.getElementById("mxValida");
    if (msg) msg.textContent = "";
}

function limpiarVoucher() {
    voucherTarjeta = "";
}

document.addEventListener("venta-finalizada", () => {
    resetEstadosPago();
    limpiarFormulario();

    const totalPanel = document.getElementById("panelPagoTotal");
    if (totalPanel) totalPanel.textContent = "$0.00";

    console.log("💜 Métodos de pago reiniciados (post venta)");
});


async function cargarConfigPagos() {
  const negocioId = localStorage.getItem("negocio_id");

  const { data: base } = await supabaseClient
    .from("config_pago_tarjeta")
    .select("*")
    .eq("negocio_id", negocioId)
    .maybeSingle();

  const { data: meses } = await supabaseClient
    .from("config_pago_tarjeta_meses")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("activo", true)
    .order("meses");

  const msi = {};
  const listaMeses = [];

  meses?.forEach(m => {
    listaMeses.push(m.meses);
    msi[m.meses] = Number(m.comision_extra);
  });

  configMP = {
    comision_base: Number(base?.comision_base ?? 0.035),
    meses: listaMeses,
    msi
  };
}

async function abrirConfigMSI() {

  const negocioId = localStorage.getItem("negocio_id");

  let { data } = await supabaseClient
    .from("config_pago_tarjeta_meses")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("meses");

   

  // 🔥 AQUÍ VA (ANTES DEL HTML)
  if (!data || data.length === 0) {

    await supabaseClient
      .from("config_pago_tarjeta_meses")
      .insert([
        { negocio_id: negocioId, meses: 3, comision_extra: 0.05, activo: true },
        { negocio_id: negocioId, meses: 6, comision_extra: 0.08, activo: true },
        { negocio_id: negocioId, meses: 9, comision_extra: 0.10, activo: true },
        { negocio_id: negocioId, meses: 12, comision_extra: 0.12, activo: true }
      ]);

    // 🔥 vuelve a cargar datos ya creados
    const res = await supabaseClient
      .from("config_pago_tarjeta_meses")
      .select("*")
      .eq("negocio_id", negocioId)
      .order("meses");

    data = res.data;
  }
// 🔥 traer base
const { data: baseConfig } = await supabaseClient
  .from("config_pago_tarjeta")
  .select("*")
  .eq("negocio_id", negocioId)
  .maybeSingle();


let html = `
<div class="text-left">

  <!-- 🔥 Comisión base -->
  <div class="mb-4">
    <label class="text-sm font-semibold text-gray-600">
      Comisión base (%)
    </label>

    <input 
      id="inpBase"
      type="number"
      step="0.01"
      value="${((baseConfig?.comision_base ?? 0.035) * 100).toFixed(2)}"
      class="w-32 mt-1 p-2 border rounded text-black"
    >
  </div>

  <!-- 🔥 Tabla -->
  <table class="w-full text-sm border-separate border-spacing-y-2">

    <thead>
      <tr class="text-gray-500 text-xs uppercase">
        <th class="text-left">Meses</th>
        <th class="text-left">Comisión %</th>
        <th class="text-center">Activo</th>
      </tr>
    </thead>

    <tbody>
`;

  (data || []).forEach(d => {
  html += `
    <tr class="bg-gray-100 rounded-lg">

      <td class="px-3 py-2 font-semibold text-gray-800">
        ${d.meses} meses
      </td>

      <td class="px-3 py-2">
        <input type="number" step="0.01"
          value="${(d.comision_extra * 100).toFixed(2)}"
          data-id="${d.id}"
          class="inp-comision w-24 p-2 text-black rounded border border-gray-300">
      </td>

      <td class="px-3 py-2 text-center">
        <input type="checkbox"
          ${d.activo ? "checked" : ""}
          data-id="${d.id}"
          class="chk-activo scale-110">
      </td>

    </tr>
  `;
});


  html += `
    </tbody>
  </table>

  <button id="btnAddMes"
    class="mt-4 text-sm text-emerald-500 hover:text-emerald-600 font-semibold">
    + Agregar mes personalizado
  </button>

</div>
`;

  const resSwal = await Swal.fire({
  title: "Configurar MSI",
  html,
  confirmButtonText: "Guardar",
  width: 600,

  didOpen: () => {

    const btnAdd = document.getElementById("btnAddMes");

    if (!btnAdd) return;

    btnAdd.addEventListener("click", async () => {

      const { value: meses } = await Swal.fire({
        title: "Nuevo plazo",
        input: "number",
        inputLabel: "Meses (ej: 18, 24)",
        inputPlaceholder: "Ej: 18",
        confirmButtonText: "Agregar"
      });

      if (!meses) return;

      // 🔥 VALIDAR DUPLICADO
      const yaExiste = (data || []).find(d => d.meses == meses);

      if (yaExiste) {
        Swal.fire("Error", "Ese plazo ya existe", "warning");
        return;
      }

      const negocioId = localStorage.getItem("negocio_id");

      await supabaseClient
        .from("config_pago_tarjeta_meses")
        .insert({
          negocio_id: negocioId,
          meses: Number(meses),
          comision_extra: 0,
          activo: true
        });

      await Swal.fire("Agregado", "Nuevo plazo creado", "success");

        Swal.close(); 
        abrirConfigMSI();

    });

  }
});

  if (!resSwal.isConfirmed) return;

  await guardarConfigMSI();
}




async function guardarConfigMSI() {

  const inputs = document.querySelectorAll(".inp-comision");
  const checks = document.querySelectorAll(".chk-activo");

  const negocioId = localStorage.getItem("negocio_id");

const inpBase = document.getElementById("inpBase");

if (inpBase) {
  const base = parseFloat(inpBase.value) || 0;

 await supabaseClient
  .from("config_pago_tarjeta")
  .upsert({
    negocio_id: negocioId,
    comision_base: base / 100,
    updated_at: new Date().toISOString()
  }, {
    onConflict: "negocio_id"
  });
  
}


  for (const inp of inputs) {

    const id = inp.dataset.id;
    const porcentaje = parseFloat(inp.value) || 0;

    const chk = [...checks].find(c => c.dataset.id === id);

    await supabaseClient
      .from("config_pago_tarjeta_meses")
      .update({
        comision_extra: porcentaje / 100,
        activo: chk.checked
      })
      .eq("id", id);
  }

  await cargarConfigPagos();

  Swal.fire("Guardado", "Configuración actualizada", "success");

  renderFormulario("tarjeta", document.getElementById("panelPagoFormulario"));
}