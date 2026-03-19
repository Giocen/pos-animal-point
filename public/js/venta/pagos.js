/* ============================================================
   💜 SmartPOS — Módulo de Pagos v4.6 ESTABLE
   ✔ Compatible con MULTI-NEGOCIO
   ✔ Mixto corregido (escritura libre + validación perfecta)
   ✔ Sin "0.00" forzado hasta blur()
   ✔ Lógica original intacta
============================================================ */

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
        pagoTarjeta = totalCarrito;
        const inp = document.getElementById("inpTar");
        if (inp) inp.value = totalCarrito.toFixed(2);
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
export function inicializarPagos(totalVentaCallback) {

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
            <label class="text-sm font-semibold text-gray-200">Monto tarjeta</label>
            <input id="inpTar" class="pago-input" value="${totalCarrito.toFixed(2)}">

            <label class="mt-2 text-sm font-semibold text-gray-200">Voucher</label>
            <input id="inpVouch" class="pago-input" value="">
        `;

        const t = document.getElementById("inpTar");
        const v = document.getElementById("inpVouch");

        t.addEventListener("input", () => {
            soloNumerosDecimal(t); // 🔥 NUEVO

            let val = parseFloat(t.value);
            if (isNaN(val)) val = 0;
            pagoTarjeta = val;
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

/* ============================================================
   ♻️ Después de confirmar venta
============================================================ */
document.addEventListener("pago-confirmado", () => {
    resetEstadosPago();
    limpiarFormulario();

    const totalPanel = document.getElementById("panelPagoTotal");
    if (totalPanel) totalPanel.textContent = "$0.00";

    console.log("💜 Métodos de pago reiniciados");
});
