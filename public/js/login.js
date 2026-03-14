// ============================================================================
// 💜 SmartPOS Login v3.0 (Multi-Negocio SIN sucursal – rol correcto)
// ============================================================================

import { supabaseClient } from "./proteccion.js";
import { LocalDB } from "./localdb.js";

/* -------------------------------------------------------------------------- */
/* 🧹 Limpieza de SW en pantalla de login                                     */
/* -------------------------------------------------------------------------- */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => {
      if (location.pathname.includes("login")) r.unregister();
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 🎨 UI Password Toggle                                                      */
/* -------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  const toggle = document.getElementById("togglePassword");
  const pass = document.getElementById("password");

  toggle.addEventListener("click", () => {
    const showing = pass.type === "text";
    pass.type = showing ? "password" : "text";
    toggle.innerHTML = `<i data-lucide="${showing ? "eye-off" : "eye"}"></i>`;
    lucide.createIcons();
  });
});

/* -------------------------------------------------------------------------- */
/* 🚀 Obtener negocios + rol desde usuarios_negocios                           */
/* -------------------------------------------------------------------------- */
async function obtenerNegociosYRoles(uid) {
  const { data, error } = await supabaseClient
    .from("usuarios_negocios")
    .select(`
      negocio_id,
      rol,
      negocios(nombre)
    `)
    .eq("usuario_id", uid)
    .eq("activo", true);

  if (error || !data) return [];

  return data.map(item => ({
    negocio_id: item.negocio_id,
    negocio_nombre: item.negocios?.nombre || "Negocio",
    rol: item.rol || "cajero"
  }));
}

/* -------------------------------------------------------------------------- */
/* 🚀 LOGIN PRINCIPAL                                                          */
/* -------------------------------------------------------------------------- */
document.getElementById("btnLogin").addEventListener("click", async () => {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    return Swal.fire("Campos incompletos", "Ingresa correo y contraseña", "warning");
  }

  try {
    Swal.fire({
      title: "Iniciando sesión...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    // -----------------------------------------------------
    // 🔐 LOGIN SUPABASE
    // -----------------------------------------------------
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const uid = data.user.id;

    // -----------------------------------------------------
    // 🧍 Obtener datos básicos del usuario
    // -----------------------------------------------------
    const { data: usuario } = await supabaseClient
      .from("usuarios")
      .select("nombre, activo")
      .eq("id", uid)
      .single();

    if (!usuario?.activo) {
      Swal.close();
      return Swal.fire("Cuenta inactiva", "Tu usuario está desactivado.", "error");
    }

    // -----------------------------------------------------
    // 🏪 Obtener negocios + rol desde usuarios_negocios
    // -----------------------------------------------------
    const negocios = await obtenerNegociosYRoles(uid);

    if (negocios.length === 0) {
      Swal.close();
      return Swal.fire("Sin negocio", "Tu usuario no tiene negocios asignados.", "error");
    }

    // =====================================================
    // 🟣 SOLO 1 NEGOCIO → Entra directo
    // =====================================================
    if (negocios.length === 1) {

      const unico = negocios[0];

      // 🔥 FIX SEGURO — Guardar negocio_id ANTES de redirigir
      localStorage.setItem("negocio_id", unico.negocio_id);

      // 🧠 Guardar sesión para restaurar ventas/offline
      const sesionObj = {
        id: uid,
        nombre: usuario.nombre,
        rol: unico.rol,
        email,
        negocio_id: unico.negocio_id,
        fecha: new Date().toISOString()
      };

      LocalDB.set("usuario_sesion", sesionObj);
      LocalDB.set("usuario_activo", sesionObj); // FIX espejo obligatorio

      Swal.close();
      return (window.location.href = "/index"); // no se toca
    }

    // =====================================================
    // 🟣 MULTI-NEGOCIO → selección externa
    // =====================================================
    Swal.close();
    window.location.href = "/seleccionar-negocio.html";

  } catch (err) {
    Swal.close();

    return Swal.fire({
      icon: "error",
      title: "Error al iniciar sesión",
      text: err.message.includes("Invalid login credentials")
        ? "Correo o contraseña incorrectos"
        : err.message
    });
  }
});
