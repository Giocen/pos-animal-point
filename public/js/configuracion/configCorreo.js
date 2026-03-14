// ================================================================
// 💜 SmartPOS - Configuración del Correo (EmailJS) v1.1 FINAL
// ---------------------------------------------------------------
// ✔ Guarda Service ID, Template ID y Public Key
// ✔ Respeta estructura de configuracion_sistema (descripcion requerida)
// ✔ Prueba real con EmailJS (seguro y controlado)
// ✔ Cache en LocalDB para modo offline
// ✔ Compatible con envios.js v10.0
// ✔ 🟣 Ahora MULTI-NEGOCIO sin modificar tu lógica original
// ================================================================

import { supabaseClient } from "../proteccion.js";
import { LocalDB } from "/js/localdb.js";

const KEY_SERVICE = "email_service_id";
const KEY_TEMPLATE = "email_template_id";
const KEY_PUBLIC = "email_public_key";

const DESCRIPCIONES = {
  [KEY_SERVICE]: "ID del servicio EmailJS",
  [KEY_TEMPLATE]: "ID de la plantilla EmailJS",
  [KEY_PUBLIC]: "Clave pública EmailJS"
};

// 🟣 MULTI-NEGOCIO → negocio actual
const negocioId = localStorage.getItem("negocio_id");

// ================================================================
// 📌 Inicializador principal
// ================================================================
export async function inicializarCorreo() {
  console.log("⚡ Configuración de Correo cargada");

  const inputService = document.getElementById("email_service_id");
  const inputTemplate = document.getElementById("email_template_id");
  const inputPublic = document.getElementById("email_public_key");
  const form = document.getElementById("formCorreo");
  const btnProbar = document.getElementById("btnProbarCorreo");

  if (!sessionStorage.getItem("guiaCorreoMostrada")) {
    mostrarGuiaEmailJS();
    sessionStorage.setItem("guiaCorreoMostrada", "1");
  }

  // ================================================================
  // 🔄 Cargar valores guardados (SUPABASE + CACHE MULTI-NEGOCIO)
  // ================================================================
  const config = await cargarConfigCorreo();

  inputService.value = config[KEY_SERVICE] || "";
  inputTemplate.value = config[KEY_TEMPLATE] || "";
  inputPublic.value = config[KEY_PUBLIC] || "";

  // ================================================================
  // 💾 Guardar cambios
  // ================================================================
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const valores = {
      [KEY_SERVICE]: inputService.value.trim(),
      [KEY_TEMPLATE]: inputTemplate.value.trim(),
      [KEY_PUBLIC]: inputPublic.value.trim(),
    };

    // Guardar en Supabase (uno por uno)
    for (const clave in valores) {
      await guardarEnSupabase(
        clave,
        valores[clave],
        DESCRIPCIONES[clave] || "Configuración EmailJS"
      );
    }

    // 🟣 MULTI-NEGOCIO: cache separado
    await LocalDB.set(`config_correo_${negocioId}`, valores);

    Swal.fire({
      icon: "success",
      title: "Guardado",
      text: "Los datos del correo fueron actualizados.",
      confirmButtonColor: "#a21caf",
    });
  });

  // ================================================================
  // 🧪 Probar envío
  // ================================================================
  btnProbar.addEventListener("click", async () => {
    const servicio = inputService.value.trim();
    const template = inputTemplate.value.trim();
    const publico = inputPublic.value.trim();

    if (!servicio || !template || !publico) {
      return Swal.fire("Faltan datos", "Llena los 3 campos primero", "warning");
    }

    // 📧 Pedir correo para la prueba
    const { value: correoDestino } = await Swal.fire({
      title: "Correo para la prueba",
      input: "email",
      inputPlaceholder: "cliente@gmail.com",
      confirmButtonColor: "#a21caf",
      showCancelButton: true
    });

    if (!correoDestino) {
      return Swal.fire("Cancelado", "No se realizó la prueba.", "info");
    }

    // ✔ Inicializar EmailJS
    try {
      await esperarEmailJS();
      window.emailjs.init(publico);
    } catch {
      return Swal.fire("Error", "EmailJS no está disponible.", "error");
    }

    Swal.fire({
      title: "Enviando correo de prueba…",
      html: "Un momento…",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      await emailjs.send(servicio, template, {
        email: correoDestino,
        folio: "PRUEBA",
        total: "0.00",
        url_ticket: "https://smartposmid.web.app/ticket?f=000000",
      });

      Swal.fire({
        icon: "success",
        title: "Prueba enviada",
        html: `Se envió un correo de prueba a:<br><b>${correoDestino}</b>`,
        confirmButtonColor: "#a21caf",
      });
    } catch (err) {
      Swal.fire("Error", "No se pudo completar la prueba.", "error");
      console.error("❌ Error prueba EmailJS:", err);
    }
  });

}

// ================================================================
// 🔄 Cargar configuración desde Supabase / LocalDB
// ================================================================
async function cargarConfigCorreo() {
  try {
    const { data } = await supabaseClient
      .from("configuracion_sistema")
      .select("clave, valor")
      .eq("negocio_id", negocioId) // 🟣 MULTI-NEGOCIO
      .in("clave", [KEY_SERVICE, KEY_TEMPLATE, KEY_PUBLIC]);

    const obj = {};
    data?.forEach((r) => {
      let v = r.valor;

      // Si Supabase devuelve un objeto, lo convertimos a string
      if (typeof v === "object" && v !== null) {
        v = v.url || JSON.stringify(v);
      }

      // Si viene "undefined", null o vacío → dejar en string vacío
      if (!v || v === "undefined" || v === "null") v = "";

      obj[r.clave] = v;
    });


    // Guardar en cache local por negocio
    if (data?.length) {
      await LocalDB.set(`config_correo_${negocioId}`, obj);
      return obj;
    }
  } catch {
    console.warn("⚠️ No se pudo cargar correo desde Supabase");
  }

  // Fallback LocalDB por negocio
  return (await LocalDB.get(`config_correo_${negocioId}`)) || {};
}

// ================================================================
// 💾 Guardar valor en Supabase (con descripción obligatoria)
// ================================================================
async function guardarEnSupabase(clave, valor, descripcion) {
  try {
    await supabaseClient.from("configuracion_sistema").upsert(
      [{
        negocio_id: negocioId,   // 🟣 MULTI-NEGOCIO
        clave,
        valor: String(valor),
        descripcion
      }],
      { onConflict: "clave,negocio_id" } // 🟣 MULTI-NEGOCIO
    );
  } catch (err) {
    console.error("❌ Error guardando configuración:", err);
  }
}

// ================================================================
// 🕒 Esperar EmailJS disponible
// ================================================================
function esperarEmailJS() {
  return new Promise((resolve, reject) => {
    let intentos = 0;
    const interval = setInterval(() => {
      if (window.emailjs) {
        clearInterval(interval);
        return resolve();
      }
      if (intentos++ > 30) {
        clearInterval(interval);
        return reject();
      }
    }, 120);
  });
}


/* ================================================================
   📄 PLANTILLA EMAILJS (HTML COMPLETO)
================================================================ */
function plantillaCorreoHTML() {
  return `
    <div style="margin:0; padding:0; background:#f3f4f6; font-family:'Segoe UI', sans-serif; color:#222;">
      <div style="max-width:600px; margin:24px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.12);">

        <!-- HEADER -->
        <div style="background:linear-gradient(135deg, #a21caf, #ff00a6); color:#fff; padding:24px; text-align:center;">
          <h2 style="margin:0; font-size:22px; font-weight:700;">
            ¡Gracias por tu compra en {{negocio}}! 🛒
          </h2>
        </div>

        <!-- CONTENIDO -->
        <div style="padding:28px 30px;">
          
          <p style="margin:0 0 12px;">📄 <strong>Folio:</strong> <span style="color:#a21caf;">{{folio}}</span></p>
          <p style="margin:0 0 16px;">💰 <strong>Total:</strong> 
            <span style="color:#059669;">$ {{total}}</span>
          </p>

          <p style="margin:0 0 18px; line-height:1.6;">
            Tu ticket digital está listo. Puedes verlo haciendo clic en el botón siguiente:
          </p>

          <div style="text-align:center; margin:30px 0;">
            <a href="{{url_ticket}}" target="_blank"
              style="background:linear-gradient(135deg, #a21caf, #ff00a6); color:#fff;
              padding:14px 28px; border-radius:10px; font-weight:600; text-decoration:none;
              display:inline-block; box-shadow:0 4px 14px rgba(162,28,175,0.4);">
              🔗 Ver Ticket Completo
            </a>
          </div>

          <p style="margin:32px 0 0; text-align:center; line-height:1.5; font-style:italic; color:#555;">
            {{mensaje}}
          </p>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="max-width:600px; margin:12px auto; text-align:center; font-size:13px; color:#666; padding:10px;">
        <p style="margin:4px 0;">Este mensaje fue enviado a <b>{{email}}</b></p>
        <p style="margin:4px 0;">📍 {{direccion}}</p>
        <p style="margin:4px 0;">📞 {{telefono}}</p>
        <p style="margin:4px 0;">✉️ {{correo_negocio}}</p>
        <p style="margin:4px 0;">🧾 RFC: {{rfc}}</p>

        <p style="margin:12px 0 0;">© {{anio}} {{negocio}} · SmartPOS</p>
      </div>
    </div>
</div>`;
}


/* ================================================================
   🟢 VISTA PREVIA DEL CORREO (POPUP)
================================================================ */
document.getElementById("btnVistaPreviaCorreo")?.addEventListener("click", () => {

  const ejemplo = plantillaCorreoHTML()
    .replaceAll("{{negocio}}", "SmartPOS Demo")
    .replaceAll("{{folio}}", "A00123")
    .replaceAll("{{total}}", "150.00")
    .replaceAll("{{email}}", "cliente@ejemplo.com")
    .replaceAll("{{url_ticket}}", "https://smartposmid.web.app/ticket?f=A00123")
    .replaceAll("{{direccion}}", "Calle 123, Mérida")
    .replaceAll("{{telefono}}", "9991234567")
    .replaceAll("{{correo_negocio}}", "contacto@smartpos.com")
    .replaceAll("{{rfc}}", "RFC123456789")
    .replaceAll("{{anio}}", "2025")
    .replaceAll("{{mensaje}}", "💜 ¡Gracias por su compra!");

  Swal.fire({
    title: "Vista previa del correo",
    html: ejemplo,
    width: 650,
    showCloseButton: true,
    confirmButtonText: "Cerrar",
    confirmButtonColor: "#a21caf"
  });
});

document.getElementById("btnCopiarPlantilla")?.addEventListener("click", () => {

  const html = plantillaCorreoHTML();

  Swal.fire({
    title: "Plantilla HTML para EmailJS",
    html: `
      <p class="text-sm text-gray-600 mb-2">Copia este HTML y pégalo en tu plantilla EmailJS.</p>
      <textarea id="plantillaCode" style="
        width:100%; 
        height:260px; 
        font-size:12px; 
        padding:10px; 
        border-radius:6px; 
        border:1px solid #ddd;
      ">${html}</textarea>

      <button id="btnCopyNow" class="mt-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-md">
        Copiar al portapapeles
      </button>
    `,
    width: 700,
    didOpen: () => {
      document.getElementById("btnCopyNow").addEventListener("click", () => {
        const text = document.getElementById("plantillaCode").value;
        navigator.clipboard.writeText(text);

        Swal.fire({
          icon: "success",
          title: "¡Copiada!",
          text: "La plantilla se copió al portapapeles.",
          timer: 1500,
          showConfirmButton: false
        });
      });
    }
  });

});


/* ================================================================
   🟣 GUÍA PASO A PASO PARA CONFIGURAR EMAILJS
================================================================ */
export function mostrarGuiaEmailJS() {

  Swal.fire({
    title: "📧 Configurar EmailJS – Guía Paso a Paso",
    width: 750,
    html: `
      <div style="text-align:left; font-size:15px;">

        <h3 class="font-bold text-fuchsia-700 mb-2">1) Crear cuenta EmailJS</h3>
        <p>• Entra a <a href="https://www.emailjs.com/" target="_blank" class="text-indigo-600 underline">https://www.emailjs.com/</a></p>
        <p>• Regístrate y entra al panel.</p>

        <h3 class="font-bold text-fuchsia-700 mt-4 mb-2">2) Obtener la Public Key</h3>
        <p>• Ve al menú: <b>Integration → API Keys</b></p>
        <p>• Copia tu clave pública (Public Key).</p>

        <h3 class="font-bold text-fuchsia-700 mt-4 mb-2">3) Crear un Servicio de Email</h3>
        <p>• En EmailJS abre: <b>Email Services</b></p>
        <p>• Agrega Gmail, Outlook o SMTP.</p>
        <p>• Copia tu <b>Service ID</b>.</p>

        <h3 class="font-bold text-fuchsia-700 mt-4 mb-2">4) Crear Plantilla del Ticket</h3>
        <p>• En SmartPOS usa el botón <b>Copiar plantilla HTML</b>.</p>
        <p>• En EmailJS abre: <b>Email Templates → Create New Template</b></p>
        <p>• Pega el HTML y asigna estas variables:</p>

        <div style="margin-left:15px;">
          • {{email}} <br>
          • {{negocio}} <br>
          • {{folio}} <br>
          • {{total}} <br>
          • {{url_ticket}} <br>
          • {{direccion}} <br>
          • {{telefono}} <br>
          • {{correo_negocio}} <br>
          • {{rfc}} <br>
          • {{anio}}
        </div>

        <h3 class="font-bold text-fuchsia-700 mt-4 mb-2">5) Guardar en SmartPOS</h3>
        <p>• Copia tu <b>Service ID</b>, <b>Template ID</b> y <b>Public Key</b> aquí en el sistema.</p>

        <h3 class="font-bold text-fuchsia-700 mt-4 mb-2">6) Probar</h3>
        <p>• Usa el botón <b>Probar envío</b> para verificar.</p>
      </div>

      <div class="flex justify-center gap-3 mt-4">
        <button id="btnGuiaCopiar" class="bg-fuchsia-600 text-white px-4 py-2 rounded-md">
          📄 Copiar plantilla HTML
        </button>

        <button id="btnGuiaEjemplo" class="bg-indigo-600 text-white px-4 py-2 rounded-md">
          👁 Ver ejemplo visual
        </button>
      </div>
    `,
    showCloseButton: true,
    showConfirmButton: true,
    confirmButtonText: "Cerrar",
    confirmButtonColor: "#a21caf",
    didOpen: () => {

      // ➤ COPIAR PLANTILLA
      document.getElementById("btnGuiaCopiar").addEventListener("click", () => {
        const html = plantillaCorreoHTML();
        navigator.clipboard.writeText(html);

        Swal.fire({
          icon: "success",
          title: "Plantilla copiada",
          text: "Ahora pégala en tu plantilla de EmailJS.",
          timer: 1500,
          showConfirmButton: false
        });
      });

      // ➤ EJEMPLO VISUAL
      document.getElementById("btnGuiaEjemplo").addEventListener("click", () => {
        const ejemplo = plantillaCorreoHTML()
          .replaceAll("{{negocio}}", "SmartPOS Demo")
          .replaceAll("{{folio}}", "A00123")
          .replaceAll("{{total}}", "150.00")
          .replaceAll("{{email}}", "cliente@ejemplo.com")
          .replaceAll("{{url_ticket}}", "https://smartposmid.web.app/ticket?f=A00123")
          .replaceAll("{{direccion}}", "Calle 123, Mérida")
          .replaceAll("{{telefono}}", "9991234567")
          .replaceAll("{{correo_negocio}}", "contacto@smartpos.com")
          .replaceAll("{{rfc}}", "RFC123456789")
          .replaceAll("{{anio}}", "2025");

        Swal.fire({
          title: "Vista previa del correo",
          html: ejemplo,
          width: 650,
          showCloseButton: true,
          confirmButtonText: "Cerrar",
          confirmButtonColor: "#a21caf"
        });
      });

    }
  });
}
