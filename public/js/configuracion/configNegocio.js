import { supabaseClient, protegerSesion } from "../proteccion.js";
import { LocalDB } from "../localdb.js";
import { db, inicializarDB } from "/js/db.js";

function normalizarLogoURL(logo) {
  if (!logo) return "";

  if (typeof logo === "string") {
    if (logo.trim().startsWith("{")) {
      try {
        const obj = JSON.parse(logo);
        return obj.url || "";
      } catch {
        return "";
      }
    }
    return logo;
  }

  if (typeof logo === "object" && logo.url) {
    return logo.url;
  }

  return "";
}


// -------------------------------------------------------------
// 🧩 FIX — Declarar variable antes de cualquier ejecución
// -------------------------------------------------------------
let inicializado = false;

// 🔑 NEGOCIO SELECCIONADO
const negocioId = localStorage.getItem("negocio_id");
if (!negocioId) {
  console.error("❌ negocio_id no definido"); 
}

// 🔐 Solo administradores
await protegerSesion(["admin"]);

// Export para router
export async function renderSeccionNegocio() {
  await inicializarConfiguracion();
}

console.log("🏪 Módulo Negocio importado → renderizando tab-negocio...");

const cont = document.getElementById("tab-negocio");
if (!cont) {
  console.warn("⚠️ No se encontró #tab-negocio. Deteniendo ejecución del módulo Negocio.");
} else {
  inicializarConfiguracion();
}

/* ------------------------------------------------------------- */
/* 🧩 FUNCIÓN PRINCIPAL                                           */
/* ------------------------------------------------------------- */
async function inicializarConfiguracion() {
  if (inicializado) return;
  inicializado = true;

  console.log("⚙️ Iniciando panel de configuración NEGOCIO...");

  await inicializarDB();

  await configurarLogoNegocio();
  await configurarDatosNegocio();
  configurarTabs();

  console.log("✅ Panel de configuración NEGOCIO listo");
}

/* ------------------------------------------------------------- */
/* 🖼 LOGO DEL NEGOCIO                                             */
/* ------------------------------------------------------------- */
async function configurarLogoNegocio() {
  const fileInput = document.getElementById("inputLogoNegocio");
  const preview = document.getElementById("vistaLogoNegocio");
  const btnReset = document.getElementById("btnEliminarLogoNegocio");

  if (!fileInput || !preview || !btnReset) {
    console.warn("⚠️ Elementos de logo no existen en el HTML");
    return;
  }

  const PLACEHOLDER = "/img/sin_imagen.png";

  /* ---------------------- 1) Cargar logo ---------------------- */
  try {
    const { data, error } = await supabaseClient
      .from("negocios")
      .select("logo_url")
      .eq("id", negocioId)
      .maybeSingle();

    if (error) throw error;

    const url = normalizarLogoURL(data?.logo_url) || PLACEHOLDER;
    preview.src = url;
    fileInput.value = "";

    // cache
    await db.negocio.put({
      clave: `logo_negocio_${negocioId}`,
      valor: { url }
    });
    LocalDB.set(`logo_negocio_${negocioId}`, { url });


  } catch (err) {
    console.warn("⚠️ Error leyendo logo de Supabase, usando Dexie:", err.message);
    const local = await db.negocio.get(`logo_negocio_${negocioId}`);
    preview.src = local?.valor?.url || PLACEHOLDER;
  }

  /* ---------------------- 2) Subir logo ------------------------- */
  fileInput.addEventListener("change", async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const ext = archivo.name.split(".").pop().toLowerCase();
    const nombreArchivo = `logo_${negocioId}_${Date.now()}.${ext}`;

    Swal.fire({
      title: "Subiendo logo...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const { error: uploadError } = await supabaseClient.storage
      .from("logos")
      .upload(nombreArchivo, archivo, { upsert: true });

    if (uploadError) {
      Swal.fire("Error", "No se pudo subir el logo", "error");
      return;
    }

    const { data: urlData } = supabaseClient.storage
      .from("logos")
      .getPublicUrl(nombreArchivo);

    const url = urlData.publicUrl;

    const { error } = await supabaseClient
      .from("negocios")
      .update({ logo_url: url })
      .eq("id", negocioId);

    if (error) {
      Swal.fire("Error", "No se pudo guardar el logo", "error");
      return;
    }


    await db.negocio.put({
      clave: `logo_negocio_${negocioId}`,
      valor: { url }
    });

    LocalDB.set(`logo_negocio_${negocioId}`, { url });


    preview.src = url;
    fileInput.value = "";

    Swal.fire({
      icon: "success",
      title: "Logo actualizado",
      timer: 1500,
      showConfirmButton: false,
    });
  });

  /* ---------------------- 3) Eliminar logo --------------------- */
  btnReset.addEventListener("click", async () => {
   await supabaseClient
      .from("negocios")
      .update({ logo_url: null })
      .eq("id", negocioId);

    await db.negocio.delete(`logo_negocio_${negocioId}`);
    LocalDB.remove(`logo_negocio_${negocioId}`);

    preview.src = PLACEHOLDER;


    Swal.fire({
      icon: "info",
      title: "Logo eliminado",
      timer: 1200,
      showConfirmButton: false,
    });
  });
}

/* ------------------------------------------------------------- */
/* 🧾 DATOS DEL NEGOCIO                                           */
/* ------------------------------------------------------------- */
async function configurarDatosNegocio() {
  const form = document.getElementById("formDatosNegocio");
  if (!form) return;

  /* ---------------------- 1) Cache Local --------------------- */
  const cache = LocalDB.get(`config_datos_ticket_${negocioId}`);
  if (cache) asignarCampos(cache);

  /* ---------------------- 2) Supabase ------------------------- */
  try {
    const { data } = await supabaseClient
      .from("configuracion_sistema")
      .select("clave, valor")
      .eq("negocio_id", negocioId)
      .in("clave", [
        "ticket_nombre_negocio",
        "ticket_telefono",
        "ticket_direccion",
        "ticket_correo",
        "ticket_rfc",
        "ticket_mensaje_final"
      ]);

    const datos = {};

    (data || []).forEach(r => datos[r.clave] = r.valor);

    asignarCampos(datos);

    await db.negocio.put({
      clave: `ticket_datos_negocio_${negocioId}`,
      valor: datos
    });

    LocalDB.set(`config_datos_ticket_${negocioId}`, datos);

  } catch (err) {
    console.warn("⚠️ Error cargando datos del negocio:", err.message);
  }

  /* ---------------------- 3) Guardar --------------------------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const datos = obtenerCampos();

    Swal.fire({
      title: "Guardando...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    for (const clave in datos) {
      await supabaseClient
        .from("configuracion_sistema")
        .upsert(
          {
            negocio_id: negocioId,
            clave,
            descripcion: "Dato del ticket",
            categoria: "negocio",
            valor: datos[clave]
          },
          { onConflict: "clave,negocio_id" }
        );
    }

    await db.negocio.put({
      clave: `ticket_datos_negocio_${negocioId}`,
      valor: datos
    });

    LocalDB.set(`config_datos_ticket_${negocioId}`, datos);

    Swal.fire({
      icon: "success",
      title: "Datos guardados",
      timer: 1500,
      showConfirmButton: false
    });
  });

  /* Helpers */
  function asignarCampos(d) {
    const campos = {
      nombreNegocio: d.ticket_nombre_negocio || "",
      telefonoNegocio: d.ticket_telefono || "",
      direccionNegocio: d.ticket_direccion || "",
      correoNegocio: d.ticket_correo || "",
      rfcNegocio: d.ticket_rfc || "",
      leyendaNegocio: d.ticket_mensaje_final || ""
    };

    Object.entries(campos).forEach(([id, val]) => {
      const campo = document.getElementById(id);
      if (campo) campo.value = val;
    });
  }

  function obtenerCampos() {
    const get = (id) => document.getElementById(id)?.value.trim() || "";
    return {
      ticket_nombre_negocio: get("nombreNegocio"),
      ticket_telefono: get("telefonoNegocio"),
      ticket_direccion: get("direccionNegocio"),
      ticket_correo: get("correoNegocio"),
      ticket_rfc: get("rfcNegocio"),
      ticket_mensaje_final: get("leyendaNegocio")
    };
  }
}

/* ------------------------------------------------------------- */
/* 🎛️ Tabs                                                        */
/* ------------------------------------------------------------- */
function configurarTabs() {
  const botones = document.querySelectorAll(".tab-btn");
  const tabs = document.querySelectorAll(".tab-content");

  if (!botones.length || !tabs.length) return; // ✅ FIX CRÍTICO

  botones.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      if (!target) return;

      botones.forEach((b) => b.classList.remove("tab-active"));
      btn.classList.add("tab-active");

      tabs.forEach((t) => t.classList.add("hidden"));

      const tab = document.getElementById(`tab-${target}`);
      if (!tab) return; // ✅ FIX FINAL
      tab.classList.remove("hidden");
    });
  });
}

