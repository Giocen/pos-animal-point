// 💜 SmartPOS - Configuración del Negocio (bajo demanda)
import { supabaseClient, protegerSesion } from "../proteccion.js";  // ⬅️ CORREGIDO (faltaba protegerSesion)
await protegerSesion(["admin"]);

/* -------------------------------------------------------------------------- */
/* 🏪 MULTI-NEGOCIO (ÚNICO CAMBIO NECESARIO, NO AFECTA TU LÓGICA)             */
/* -------------------------------------------------------------------------- */
function obtenerNombreDB() {

  // ⬅️ CORREGIDO: negocio_activo / sucursal_activa YA NO existen
  const negocio = localStorage.getItem("negocio_id") || "default";

  // ⬅️ Mantengo tu estructura original, solo elimino sucursal porque no existe
  const sucursal = "main";

  return `SmartPOSOffline_${negocio}_${sucursal}`;
}

/* -------------------------------------------------------------------------- */
/* 🚀 FUNCIÓN PRINCIPAL EXPORTADA                                             */
/* -------------------------------------------------------------------------- */
export async function inicializarConfiguracion() {
  console.log("🏪 Iniciando panel de configuración del NEGOCIO...");

  const cont = document.getElementById("tab-negocio");
  if (!cont) {
    console.warn("⚠️ No se encontró el contenedor #tab-negocio, deteniendo carga.");
    return;
  }

  await configurarLogoNegocio();
  await configurarDatosNegocio();
  configurarTabs();

  console.log("✅ Panel de configuración NEGOCIO listo.");
}

/* -------------------------------------------------------------------------- */
/* 🧩 BLOQUE: LOGO DEL NEGOCIO                                                */
/* -------------------------------------------------------------------------- */
async function configurarLogoNegocio() {
  const fileInput = document.getElementById("fileLogo");
  const inputURL = document.getElementById("inputLogoURL");
  const btnReset = document.getElementById("btnRestablecerLogo");
  const preview = document.getElementById("previewLogo");
  if (!fileInput || !inputURL || !preview) return;

  // 🟣 SE MANTIENE TODO TAL CUAL
  const db = new Dexie(obtenerNombreDB());
  db.version(1).stores({ negocio: "clave, valor" });

  try {
    const { data, error } = await supabaseClient
      .from("configuracion_sistema")
      .select("valor")
      .eq("clave", "ticket_logo_url")
      .maybeSingle();

    if (error) throw error;
    const url = data?.valor?.url || "";
    inputURL.value = url;
    preview.src = url;
    await db.negocio.put({ clave: "ticket_logo_url", valor: { url } });
    toggleInput(inputURL, url);
  } catch {
    const local = await db.negocio.get("ticket_logo_url");
    const urlLocal = local?.valor?.url || "";
    inputURL.value = urlLocal;
    preview.src = urlLocal;
    toggleInput(inputURL, urlLocal);
  }

  fileInput.addEventListener("change", async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const extension = archivo.name.split(".").pop().toLowerCase();
    const nombreArchivo = `logo_${Date.now()}.${extension}`;
    const bucket = "logos";

    Swal.fire({ title: "Subiendo logo...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    const { error: uploadError } = await supabaseClient.storage
      .from(bucket)
      .upload(nombreArchivo, archivo, {
        cacheControl: "3600",
        upsert: true,
        contentType: archivo.type,
      });

    if (uploadError) {
      Swal.fire("Error", "No se pudo subir el logo", "error");
      return;
    }

    const { data: urlData } =
      supabaseClient.storage.from(bucket).getPublicUrl(nombreArchivo);

    const url = urlData.publicUrl;

    const { error } = await supabaseClient
      .from("configuracion_sistema")
      .upsert(
        {
          clave: "ticket_logo_url",
          descripcion: "Logo del ticket",
          categoria: "negocio",
          valor: { url },
        },
        { onConflict: "clave" }
      );

    if (!error) {
      await db.negocio.put({ clave: "ticket_logo_url", valor: { url } });
      inputURL.value = url;
      preview.src = url;
      toggleInput(inputURL, url);
      Swal.fire({ icon: "success", title: "Logo actualizado", timer: 1800, showConfirmButton: false });
    }
  });

  btnReset?.addEventListener("click", async () => {
    await supabaseClient.from("configuracion_sistema").delete().eq("clave", "ticket_logo_url");
    await db.negocio.delete("ticket_logo_url");
    inputURL.value = "";
    preview.src = "";
    toggleInput(inputURL, "");
    Swal.fire({ icon: "info", title: "Logo eliminado", timer: 1500, showConfirmButton: false });
  });
}

/* -------------------------------------------------------------------------- */
/* 🧾 BLOQUE: DATOS DEL NEGOCIO                                               */
/* -------------------------------------------------------------------------- */
async function configurarDatosNegocio() {

  // ✔ SE MANTIENE TODO EXACTAMENTE IGUAL
  const form = document.getElementById("formDatosNegocio");
  if (!form) return;

  const db = new Dexie(obtenerNombreDB());
  db.version(1).stores({ negocio: "clave, valor" });

  try {
    const { data, error } = await supabaseClient
      .from("configuracion_sistema")
      .select("valor")
      .eq("clave", "ticket_datos_negocio")
      .maybeSingle();

    if (error) throw error;
    const datos = data?.valor || {};
    asignarCampos(datos);
    await db.negocio.put({ clave: "ticket_datos_negocio", valor: datos });
  } catch {
    const local = await db.negocio.get("ticket_datos_negocio");
    if (local?.valor) asignarCampos(local.valor);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const datos = obtenerCampos();

    Swal.fire({ title: "Guardando...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    const { error } = await supabaseClient
      .from("configuracion_sistema")
      .upsert(
        {
          clave: "ticket_datos_negocio",
          descripcion: "Datos generales del ticket",
          categoria: "negocio",
          valor: datos,
        },
        { onConflict: "clave" }
      );

    if (error) {
      Swal.fire("Error", "No se pudieron guardar los datos", "error");
    } else {
      await db.negocio.put({ clave: "ticket_datos_negocio", valor: datos });
      Swal.fire({ icon: "success", title: "Datos guardados", timer: 1600, showConfirmButton: false });
    }
  });

  function asignarCampos(d) {
    document.getElementById("nombreNegocio").value = d.ticket_nombre_negocio || "";
    document.getElementById("telefonoNegocio").value = d.ticket_telefono || "";
    document.getElementById("direccionNegocio").value = d.ticket_direccion || "";
    document.getElementById("correoNegocio").value = d.ticket_correo || "";
    document.getElementById("rfcNegocio").value = d.ticket_rfc || "";
    document.getElementById("leyendaNegocio").value = d.ticket_mensaje_final || "";
  }

  function obtenerCampos() {
    const get = (id) => document.getElementById(id)?.value?.trim() || "";
    return {
      ticket_nombre_negocio: get("nombreNegocio"),
      ticket_telefono: get("telefonoNegocio"),
      ticket_direccion: get("direccionNegocio"),
      ticket_correo: get("correoNegocio"),
      ticket_rfc: get("rfcNegocio"),
      ticket_mensaje_final: get("leyendaNegocio"),
    };
  }
}

/* -------------------------------------------------------------------------- */
/* 🧠 HELPERS                                                                 */
/* -------------------------------------------------------------------------- */
function toggleInput(input, valor) {
  if (valor) {
    input.readOnly = true;
    input.classList.add("bg-gray-100", "cursor-not-allowed", "text-gray-600");
  } else {
    input.readOnly = false;
    input.classList.remove("bg-gray-100", "cursor-not-allowed", "text-gray-600");
  }
}

function configurarTabs() {
  const botones = document.querySelectorAll(".tab-btn");
  const tabs = document.querySelectorAll(".tab-content");

  botones.forEach((btn) =>
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      botones.forEach((b) => b.classList.remove("tab-active"));
      btn.classList.add("tab-active");
      tabs.forEach((tab) => tab.classList.add("hidden"));
      document.getElementById(`tab-${target}`).classList.remove("hidden");
    })
  );
}

/* -------------------------------------------------------------------------- */
/* 💾 MODO OFFLINE + SINCRONIZACIÓN AUTOMÁTICA (SE CONSERVA TAL CUAL)         */
/* -------------------------------------------------------------------------- */
const PENDIENTES_KEY_NEGOCIO = "smartpos_pendientes_config_negocio";
const PENDIENTES_KEY_LOGO = "smartpos_pendientes_logo_negocio";

window.addEventListener("offline", () => {
  console.warn("⚠️ SmartPOS está en modo sin conexión: cambios se guardarán localmente.");
});

window.addEventListener("online", async () => {

  console.log("☁️ Conexión restaurada: sincronizando configuración del negocio...");

  const db = new Dexie(obtenerNombreDB());
  db.version(1).stores({ negocio: "clave, valor" });

  try {
    const pendientes = JSON.parse(localStorage.getItem(PENDIENTES_KEY_NEGOCIO) || "[]");
    const logosPendientes = JSON.parse(localStorage.getItem(PENDIENTES_KEY_LOGO) || "[]");

    for (const datos of pendientes) {
      try {
        const { error } = await supabaseClient
          .from("configuracion_sistema")
          .upsert(
            {
              clave: "ticket_datos_negocio",
              descripcion: "Datos generales del ticket",
              categoria: "negocio",
              valor: datos,
            },
            { onConflict: "clave" }
          );

        if (!error) {
          await db.negocio.put({ clave: "ticket_datos_negocio", valor: datos });
          console.log("✅ Configuración del negocio sincronizada.");
        }
      } catch (err) {
        console.error("❌ Error al sincronizar datos del negocio:", err);
      }
    }

    for (const item of logosPendientes) {
      try {
        const blob = await (await fetch(item.base64)).blob();
        const file = new File([blob], `logo_sync_${Date.now()}.jpg`, { type: "image/jpeg" });

        const { error: upErr } = await supabaseClient.storage
          .from("logos")
          .upload(`logo_sync_${Date.now()}.jpg`, file, { upsert: true });

        if (upErr) throw upErr;

        const { data: urlData } = supabaseClient.storage
          .from("logos")
          .getPublicUrl(`logo_sync_${Date.now()}.jpg`);

        const url = urlData.publicUrl;

        await supabaseClient.from("configuracion_sistema").upsert(
          {
            clave: "ticket_logo_url",
            descripcion: "Logo del ticket",
            categoria: "negocio",
            valor: { url },
          },
          { onConflict: "clave" }
        );

        await db.negocio.put({ clave: "ticket_logo_url", valor: { url } });

        console.log("✅ Logo sincronizado correctamente:", url);

      } catch (err) {
        console.error("⚠️ Error sincronizando logo pendiente:", err);
      }
    }

    if (pendientes.length || logosPendientes.length) {
      Toastify({
        text: "☁️ Configuración sincronizada correctamente",
        duration: 2500,
        gravity: "top",
        position: "right",
        style: {
          background: "linear-gradient(90deg, #16a34a, #22c55e)",
          color: "#fff",
          borderRadius: "0.5rem",
          fontWeight: "600",
        },
      }).showToast();
    }

    localStorage.removeItem(PENDIENTES_KEY_NEGOCIO);
    localStorage.removeItem(PENDIENTES_KEY_LOGO);

  } catch (err) {
    console.error("⚠️ No se pudo sincronizar configuración del negocio:", err);
  }
});

/* -------------------------------------------------------------------------- */
/* 🖼️ Guardar logo en base64 si no hay conexión                              */
/* -------------------------------------------------------------------------- */
const fileInputLogo = document.getElementById("fileLogo");

if (fileInputLogo) {
  fileInputLogo.addEventListener("change", async (e) => {
    if (navigator.onLine) return;

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;

      const logosPendientes = JSON.parse(localStorage.getItem(PENDIENTES_KEY_LOGO) || "[]");
      logosPendientes.push({ base64, timestamp: Date.now() });

      localStorage.setItem(PENDIENTES_KEY_LOGO, JSON.stringify(logosPendientes));

      Swal.fire({
        icon: "info",
        title: "💾 Guardado offline",
        text: "El logo se subirá automáticamente cuando vuelva el internet.",
        background: "#fff",
        customClass: { popup: "card-3d" },
      });
    };
    reader.readAsDataURL(file);
  });
}

/* -------------------------------------------------------------------------- */
/* 💾 Guardar datos del formulario si no hay conexión                         */
/* -------------------------------------------------------------------------- */
const formNegocio = document.getElementById("formDatosNegocio");

if (formNegocio) {
  formNegocio.addEventListener("submit", (e) => {
    if (navigator.onLine) return;

    e.preventDefault();

    const get = (id) => document.getElementById(id)?.value?.trim() || "";

    const datos = {
      ticket_nombre_negocio: get("nombreNegocio"),
      ticket_telefono: get("telefonoNegocio"),
      ticket_direccion: get("direccionNegocio"),
      ticket_correo: get("correoNegocio"),
      ticket_rfc: get("rfcNegocio"),
      ticket_mensaje_final: get("leyendaNegocio"),
    };

    const pendientes = JSON.parse(localStorage.getItem(PENDIENTES_KEY_NEGOCIO) || "[]");
    pendientes.push(datos);

    localStorage.setItem(PENDIENTES_KEY_NEGOCIO, JSON.stringify(pendientes));

    Swal.fire({
      icon: "info",
      title: "💾 Guardado offline",
      text: "Los datos del negocio se sincronizarán cuando vuelva la conexión.",
      background: "#fff",
      customClass: { popup: "card-3d" },
    });
  });
}
