// ============================================================================
// 💜 SmartPOS - Protección Universal v4.2 (Multi-Negocio SIN sucursal FIXED)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LocalDB } from "./localdb.js"; // ⭐ NECESARIO PARA namespace FIX

const SUPABASE_URL = "https://yssihgpqlnekrkjmefkz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc2loZ3BxbG5la3Jram1lZmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MTEwNDEsImV4cCI6MjA3MzQ4NzA0MX0.P65R38CV5KaV-fNcL4rKos0jmEEiYurnjQtcMgw7rt8";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========= Fix Swal global ========= */
function showSwalError(t, m) {
  if (window.Swal) {
    return Swal.fire({
      icon: "error",
      title: t,
      text: m,
      confirmButtonColor: "#a21caf"
    });
  } else {
    alert(`${t}\n${m}`);
  }
}

/* -------------------------------------------------------------------------- */
/* 🏪 RELACIÓN usuario-negocio                                                */
/* -------------------------------------------------------------------------- */
async function obtenerRelacionUsuarioNegocio(uid) {
  const { data, error } = await supabaseClient
    .from("usuarios_negocios")
    .select("usuario_id, negocio_id, rol, activo")
    .eq("usuario_id", uid)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    console.error("❌ Error cargando usuarios_negocios:", error);
    return null;
  }

  return data;
}

/* -------------------------------------------------------------------------- */
/* 🚪 Redirección segura al login                                             */
/* -------------------------------------------------------------------------- */
export function redirigirALogin() {
  if (!location.pathname.includes("login"))
    setTimeout(() => location.assign("/login.html"), 200);

  return null;
}

/* -------------------------------------------------------------------------- */
/* 🧠 PROTEGER SESIÓN — MultiNegocio (sin sucursal)                           */
/* -------------------------------------------------------------------------- */
export async function protegerSesion(rolesPermitidos = []) {
  try {
    // 1️⃣ Obtener sesión REAL
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const session = sessionData?.session;
    const user = session?.user;

    if (!user) {
      const offline = restaurarSesionOffline();
      if (offline) {
        window.usuarioActual = offline;
        return offline;
      }
      return redirigirALogin();
    }

    // 2️⃣ Cargar relación usuario-negocio
    const relacion = await obtenerRelacionUsuarioNegocio(user.id);

    if (!relacion) {
      console.warn("⚠ Usuario sin negocio asignado");
      return redirigirALogin();
    }

    const negocio_id = relacion.negocio_id;
    const rol = (relacion.rol || "").toLowerCase();

    // 3️⃣ Cargar datos del usuario
    const { data: info } = await supabaseClient
      .from("usuarios")
      .select("nombre, activo")
      .eq("id", user.id)
      .maybeSingle();

    if (!info?.activo) {
      await supabaseClient.auth.signOut();
      return redirigirALogin();
    }

    const userFinal = {
      id: user.id,
      nombre: info.nombre,
      rol,
      negocio_id
    };

    // 4️⃣ Guardar sesión local
    guardarSesionOffline(userFinal);

    // 5️⃣ Validar roles
    const permitidos = rolesPermitidos.map(r => r.toLowerCase());
    if (rolesPermitidos.length && !permitidos.includes(rol)) {
      await showSwalError("Acceso denegado", "No tienes permisos para acceder.");
      setTimeout(() => location.assign("/index.html"), 150);
      return null;
    }

    // 6️⃣ Exponer global
    window.usuarioActual = userFinal;
    return userFinal;

  } catch (e) {
    console.error("❌ Error en protegerSesion:", e);

    const offline = restaurarSesionOffline();
    if (offline) {
      window.usuarioActual = offline;
      return offline;
    }

    return redirigirALogin();
  }
}


/* -------------------------------------------------------------------------- */
/* 💾 SESIÓN OFFLINE + FIX LOCALDB                                           */
/* -------------------------------------------------------------------------- */
function guardarSesionOffline(usuario) {
  localStorage.setItem("usuario_id", usuario.id);
  localStorage.setItem("usuario_nombre", usuario.nombre);
  localStorage.setItem("usuario_rol", usuario.rol);

  // 🔥 NEGOCIO REAL
  localStorage.setItem("negocio_id", usuario.negocio_id);

  // ⭐ FIX CRÍTICO: actualizar namespace LocalDB una vez que negocio_id es real
  try {
    LocalDB.updateNamespace();
  } catch (e) {
    console.warn("⚠ No se pudo actualizar LocalDB namespace:", e);
  }
}

function restaurarSesionOffline() {
  const id = localStorage.getItem("usuario_id");
  const negocio = localStorage.getItem("negocio_id");

  if (!id || !negocio) return null;

  return {
    id,
    nombre: localStorage.getItem("usuario_nombre"),
    rol: localStorage.getItem("usuario_rol"),
    negocio_id: negocio
  };
}

/* -------------------------------------------------------------------------- */
/* 🔄 Eventos auth global                                                     */
/* -------------------------------------------------------------------------- */
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    localStorage.clear();

    if (!location.pathname.includes("login"))
      setTimeout(() => location.assign("/login.html"), 300);
  }
});
