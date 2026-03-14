// 💜 SmartPOS — Logout Universal v2.2 (2025 Multi-Negocio Actualizado)
// ---------------------------------------------------------------------

import { supabaseClient as supabase } from "/js/proteccion.js";
import { LocalDB } from "/js/localdb.js";

export function iniciarLogoutUniversal() {
  const btn = document.getElementById("btnLogout");
  if (!btn) return;

  // Evitar doble binding
  const nuevo = btn.cloneNode(true);
  btn.replaceWith(nuevo);

  nuevo.addEventListener("click", async (e) => {
    e.preventDefault();

    sessionStorage.setItem("smartpos_logout_in_progress", "true");

    const confirm = await Swal.fire({
      html: `
        <div class="flex flex-col items-center text-center">
          <div class="w-14 h-14 mb-3 rounded-full
            bg-gradient-to-br from-fuchsia-600 to-purple-700
            flex items-center justify-center animate-pulse-soft">
              <i data-lucide="log-out" class="w-8 h-8 text-white"></i>
          </div>

          <h2 class="text-xl font-extrabold text-gray-800 mb-1">
            ¿Cerrar sesión?
          </h2>

          <p class="text-gray-600 text-base">
            Tu sesión actual se cerrará y volverás al login.
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Sí, salir",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      allowOutsideClick: false,
      background: "#fff",
      width: 380,
      customClass: {
        popup: "card-3d animate-entrada-smart",
        confirmButton: "swal2-styled bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white font-semibold px-5 py-2 rounded-lg mx-1",
        cancelButton: "swal2-styled bg-gray-400 text-white font-semibold px-5 py-2 rounded-lg mx-1",
      },
      buttonsStyling: false,
      didOpen: () => lucide.createIcons(),
    });

    if (!confirm.isConfirmed) {
      sessionStorage.removeItem("smartpos_logout_in_progress");
      return;
    }

    Swal.fire({
      html: `
        <div class="flex flex-col items-center justify-center">
          <div class="animate-spin rounded-full h-12 w-12
            border-4 border-fuchsia-600 border-t-transparent mb-4"></div>

          <p class="text-lg font-semibold text-gray-700">
            Cerrando sesión...
          </p>

          <p class="text-sm text-gray-500">
            Limpiando datos locales y conexión
          </p>
        </div>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      background: "#fff",
      width: 360,
      customClass: { popup: "card-3d animate-entrada-smart" },
    });

    try {
      // 🔌 Logout Supabase
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("⚠ No se pudo cerrar sesión en Supabase:", err.message);
      }

      // 🧠 LocalDB
      await LocalDB.clearAll();

      // 📦 Limpieza multi-negocio real
      localStorage.removeItem("negocio_id");
      localStorage.removeItem("usuario_activo");

      // 🔥 Limpieza completa de storage
      localStorage.clear();
      sessionStorage.clear();

      // 🗃️ Borrar todas las bases Dexie
      if (window.Dexie) {
        await Promise.all([
          new Dexie("SmartPOSOffline").delete(),
          new Dexie("SmartPOSSync").delete(),
          new Dexie("SmartPOSCortes").delete(),
          new Dexie("SmartPOSCache").delete(),
        ].map(db => db.catch(()=>{})));
      }

      // 🧹 Caches PWA
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      await Swal.fire({
        html: `
          <div class="flex flex-col items-center">
            <div class="w-14 h-14 mb-3 rounded-full
              bg-gradient-to-br from-fuchsia-600 to-purple-700
              flex items-center justify-center animate-pulse-soft">
                <i data-lucide="hand" class="w-8 h-8 text-white"></i>
            </div>

            <h2 class="text-xl font-extrabold text-gray-800 mb-1">
              Sesión cerrada
            </h2>

            <p class="text-gray-600 text-base">Hasta pronto 👋</p>
          </div>
        `,
        showConfirmButton: false,
        timer: 1500,
        background: "#fff",
        width: 360,
        customClass: { popup: "card-3d animate-entrada-smart" },
        didOpen: () => lucide.createIcons(),
      });

      window.location.href = "/login.html";

    } catch (error) {
      console.error("❌ Error al cerrar sesión:", error);

      Swal.fire({
        icon: "error",
        title: "Error al cerrar sesión",
        text: "No se pudo cerrar sesión correctamente.",
        confirmButtonColor: "#a21caf",
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", iniciarLogoutUniversal);
