// ✅ Archivo: /public/js/configuracion/logoNegocio.js
// 💜 SmartPOS - Logo del negocio con soporte MULTI-NEGOCIO + cache local

import { supabaseClient, protegerSesion } from "../proteccion.js";
import { LocalDB } from "../localdb.js";

await protegerSesion(["admin"]);

// ⭐ Obtener negocio actual
const negocioId = localStorage.getItem("negocio_id");

document.addEventListener("DOMContentLoaded", async () => {
  const fileInput = document.getElementById("fileLogo");
  const inputURL = document.getElementById("inputLogoURL");
  const btnReset = document.getElementById("btnRestablecerLogo");
  const preview = document.getElementById("previewLogo");

  if (!fileInput || !inputURL || !preview) return;

  // 🧱 Dexie Offline
  const db = new Dexie("SmartPOSOffline");
  db.version(1).stores({ negocio: "clave, valor" });

  /* ---------------------------------------------------------------------- */
  /* 🔄 Cargar logo actual (LocalDB → Dexie → Supabase)                      */
  /* ---------------------------------------------------------------------- */
  async function cargarLogoActual() {

    // ⭐ 1️⃣ LocalDB por negocio
    const cacheLogo = LocalDB.get("config_logo_" + negocioId);
    if (cacheLogo?.url) {
      inputURL.value = cacheLogo.url;
      preview.src = cacheLogo.url;
      toggleInput(cacheLogo.url);
      console.log("⚡ Logo cargado desde LocalDB (MultiNegocio)");
    }

    // ⭐ 2️⃣ Intentar desde Supabase
    try {
      const { data, error } = await supabaseClient
        .from("configuracion_sistema")
        .select("valor")
        .eq("clave", "ticket_logo_url")
        .eq("negocio_id", negocioId)
        .maybeSingle();

      if (error) throw error;

      let url = "";

      // 🟣 Si valor viene como JSON string → parsearlo
      if (typeof data?.valor === "string") {
        try {
          url = JSON.parse(data.valor)?.url || "";
        } catch {
          url = "";
        }
      } else {
        url = data?.valor?.url || "";
      }

      inputURL.value = url;
      preview.src = url || "";

      // Guardar en Dexie
      await db.negocio.put({
        clave: "ticket_logo_url_" + negocioId,
        valor: { url }
      });

      // Guardar en LocalDB por negocio
      LocalDB.set("config_logo_" + negocioId, { url });

      toggleInput(url);
      console.log("✅ Logo actualizado desde Supabase (MultiNegocio)");

    } catch (err) {
      console.warn("⚠️ Supabase no disponible, usando Dexie:", err.message);

      const local = await db.negocio.get("ticket_logo_url_" + negocioId);
      const urlLocal = local?.valor?.url || "";

      inputURL.value = urlLocal;
      preview.src = urlLocal;

      toggleInput(urlLocal);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 🔼 Subir logo a Supabase Storage y guardar en configuracion_sistema     */
  /* ---------------------------------------------------------------------- */
  async function subirLogo(archivo) {
    if (!archivo) return;

    const extension = archivo.name.split(".").pop().toLowerCase();
    const nombreArchivo = `logo_${negocioId}_${Date.now()}.${extension}`;
    const bucket = "logos";

    Swal.fire({
      title: "Subiendo logo...",
      html: "Por favor espera ⏳",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      /* ---------------------------------------------------
         📤 SUBIR ARCHIVO AL BUCKET "logos"
      --------------------------------------------------- */
      const { error: uploadError } = await supabaseClient.storage
        .from(bucket)
        .upload(nombreArchivo, archivo, {
          cacheControl: "3600",
          upsert: true,
          contentType: archivo.type,
        });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: urlData } = supabaseClient.storage
        .from(bucket)
        .getPublicUrl(nombreArchivo);

      const url = urlData.publicUrl;

      /* ---------------------------------------------------
         💾 GUARDAR EN configuracion_sistema (MULTI-NEGOCIO)
         ⚠️ FIX: usar upsert con UNIQUE (clave, negocio_id)
      --------------------------------------------------- */
      const { error } = await supabaseClient
        .from("configuracion_sistema")
        .upsert(
          {
            clave: "ticket_logo_url",
            descripcion: "Logo del negocio en el ticket",
            categoria: "negocio",
            negocio_id: negocioId,
            valor: JSON.stringify({ url }),
          },
          { onConflict: "clave,negocio_id" }  // ⭐ FIX MULTINEGOCIO
        );

      if (error) throw error;

      // Guardar en Dexie
      await db.negocio.put({
        clave: "ticket_logo_url_" + negocioId,
        valor: { url }
      });

      // Guardar en LocalDB por negocio
      LocalDB.set("config_logo_" + negocioId, { url });

      inputURL.value = url;
      preview.src = url;
      toggleInput(url);

      Swal.fire({
        icon: "success",
        title: "Logo actualizado",
        text: "El nuevo logo se guardó correctamente.",
        timer: 2000,
        showConfirmButton: false,
      });

    } catch (err) {
      console.error("❌ Error subiendo logo:", err);
      Swal.fire("Error", "No se pudo subir el logo", "error");
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 🗑 Restablecer logo                                                     */
  /* ---------------------------------------------------------------------- */
  async function restablecerLogo() {
    inputURL.value = "";
    preview.src = "";

    await supabaseClient
      .from("configuracion_sistema")
      .delete()
      .eq("clave", "ticket_logo_url")
      .eq("negocio_id", negocioId);

    await db.negocio.delete("ticket_logo_url_" + negocioId);
    LocalDB.remove("config_logo_" + negocioId);

    toggleInput("");

    Swal.fire({
      icon: "info",
      title: "Logo eliminado",
      text: "Se eliminó el logo del ticket.",
      timer: 1800,
      showConfirmButton: false,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* 🔧 Bloquear input si ya hay logo                                       */
  /* ---------------------------------------------------------------------- */
  function toggleInput(valor) {
    if (valor) {
      inputURL.readOnly = true;
      inputURL.classList.add("bg-gray-100", "cursor-not-allowed", "text-gray-600");
    } else {
      inputURL.readOnly = false;
      inputURL.classList.remove("bg-gray-100", "cursor-not-allowed", "text-gray-600");
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 🎧 Eventos                                                             */
  /* ---------------------------------------------------------------------- */
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) await subirLogo(file);
  });

  btnReset.addEventListener("click", restablecerLogo);

  await cargarLogoActual();
});
