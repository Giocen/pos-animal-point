// 💜 SmartPOS - Módulo de Usuarios (v3.0 offline-ready con MULTI-NEGOCIO)
import { supabaseClient, protegerSesion } from "./proteccion.js";

/* ------------------------------------------------------------- */
/* 🔐 PROTEGER SESIÓN Y CARGAR USUARIO REAL                      */
/* ------------------------------------------------------------- */
// protegerSesion devuelve el usuario con:
// id, nombre, rol, negocio_id
const usuario = await protegerSesion(["admin"]);

if (!usuario) {
  Swal.fire("Sesión inválida", "Inicia sesión nuevamente.", "error")
    .then(() => (window.location.href = "/login"));
  throw new Error("Sin usuario");
}

/* ------------------------------------------------------------- */
/* 🟣 MULTINEGOCIO - NEGOCIO ACTUAL                               */
/* ------------------------------------------------------------- */
const negocioId = usuario.negocio_id;

/* ------------------------------------------------------------- */
/* 🚫 VALIDAR QUE SEA ADMIN REAL                                  */
/* ------------------------------------------------------------- */
const rol = (usuario.rol || "").trim().toLowerCase();

if (rol !== "admin") {
  Swal.fire({
    icon: "error",
    title: "Acceso denegado",
    text: "Solo el administrador puede gestionar usuarios.",
    confirmButtonColor: "#a21caf",
  }).then(() => (window.location.href = "/ventas"));
  throw new Error("Acceso denegado (no admin)");
}

/* ------------------------------------------------------------- */
/* 🔹 INICIALIZACIÓN                                              */
/* ------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => lucide.createIcons());

/* ------------------------------------------------------------- */
/* 🔹 ELEMENTOS DOM                                               */
/* ------------------------------------------------------------- */
const btnRegistrar = document.getElementById("btnRegistrar");
const listaUsuarios = document.getElementById("listaUsuarios");
const modal = document.getElementById("modalEditar");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");
const switchActivo = document.getElementById("switchActivo");

let usuarioEditando = null;
let estadoActivo = true;

/* ------------------------------------------------------------- */
/* 🟣 MODAL EDITAR                                                 */
/* ------------------------------------------------------------- */
btnCancelar.addEventListener("click", () => modal.classList.add("hidden"));

switchActivo.addEventListener("click", () => {
  switchActivo.classList.toggle("active");
  estadoActivo = switchActivo.classList.contains("active");
});

// 💾 Guardar cambios
btnGuardar.addEventListener("click", async () => {
  const nuevoNombre = document.getElementById("editNombre").value.trim();
  const nuevoEmail = document.getElementById("editEmail").value.trim();
  const nuevoRol = document.getElementById("editRol").value;
  const nuevaPassword = document.getElementById("editPassword").value.trim();

  if (!nuevoNombre || !nuevoEmail || !nuevoRol) {
    return Swal.fire({
      icon: "warning",
      title: "Campos incompletos",
      text: "Completa todos los campos antes de guardar.",
      confirmButtonColor: "#a21caf",
    });
  }

  if (nuevaPassword && !esContrasenaSegura(nuevaPassword)) {
    return Swal.fire({
      icon: "error",
      title: "Contraseña débil",
      text: "Debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y un símbolo.",
      confirmButtonColor: "#a21caf",
    });
  }

  const confirm = await Swal.fire({
    title: "¿Guardar cambios?",
    text: "Se actualizará la información del usuario.",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#a21caf",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Sí, guardar",
    cancelButtonText: "Cancelar",
  });

  if (!confirm.isConfirmed) return;

  /* ------------------------------------------------------------- */
  /* 📴 MODO OFFLINE                                               */
  /* ------------------------------------------------------------- */
  const cacheKey = `usuarios_cache_${negocioId}`;

  if (!navigator.onLine) {
    const cache = JSON.parse(localStorage.getItem(cacheKey) || "[]");
    const idx = cache.findIndex((u) => u.usuario_id === usuarioEditando);
    if (idx >= 0) {
      cache[idx] = {
      ...cache[idx],
      rol: nuevoRol,
      activo: estadoActivo,
      usuarios: {
        ...cache[idx].usuarios,
        nombre: nuevoNombre,
        correo: nuevoEmail
      }
    };
      localStorage.setItem(cacheKey, JSON.stringify(cache));
    }
    Swal.fire("💾 Guardado local", "Cambios almacenados temporalmente (modo sin conexión).", "info");
    modal.classList.add("hidden");
    mostrarUsuarios();
    return;
  }

  /* ------------------------------------------------------------- */
  /* 🟣 UPDATE CON MULTI-NEGOCIO                                  */
  /* ------------------------------------------------------------- */
 // 🔹 actualizar datos base
const { error: errorUser } = await supabaseClient
  .from("usuarios")
  .update({
    nombre: nuevoNombre,
    correo: nuevoEmail,
    activo: estadoActivo
  })
  .eq("id", usuarioEditando);

// 🔹 actualizar rol en relación
const { error: errorRel } = await supabaseClient
  .from("usuarios_negocios")
  .update({
    rol: nuevoRol,
    activo: estadoActivo
  })
  .eq("usuario_id", usuarioEditando)
  .eq("negocio_id", negocioId);

if (errorUser || errorRel) {
  return Swal.fire({
    icon: "error",
    title: "Error al actualizar",
    text: errorUser?.message || errorRel?.message,
    confirmButtonColor: "#a21caf",
  });
}

  if (nuevaPassword) {
    Swal.fire({
      icon: "info",
      title: "Contraseña no actualizada",
      text: "Por seguridad, el cambio de contraseña solo puede hacerlo el propio usuario.",
      confirmButtonColor: "#a21caf",
    });
  }

  Swal.fire({
    icon: "success",
    title: "Usuario actualizado",
    text: "Datos actualizados correctamente.",
    confirmButtonColor: "#a21caf",
  });

  modal.classList.add("hidden");
  mostrarUsuarios();
});

/* ------------------------------------------------------------- */
/* 🧾 REGISTRAR USUARIO (MULTI-NEGOCIO)                           */
/* ------------------------------------------------------------- */
btnRegistrar.addEventListener("click", async () => {
  const nombre = document.getElementById("nombre").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const rol = document.getElementById("rol").value;

  if (!nombre || !email || !password || !rol) {
    return Swal.fire({
      icon: "warning",
      title: "Campos incompletos",
      text: "Completa todos los campos para registrar un usuario.",
      confirmButtonColor: "#a21caf",
    });
  }

  if (!esContrasenaSegura(password)) {
    return Swal.fire({
      icon: "error",
      title: "Contraseña débil",
      text: "Debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y símbolo.",
      confirmButtonColor: "#a21caf",
    });
  }

  const confirm = await Swal.fire({
    title: "¿Registrar nuevo usuario?",
    text: `${nombre} será agregado al sistema.`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#a21caf",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Registrar",
    cancelButtonText: "Cancelar",
  });

  if (!confirm.isConfirmed) return;

  /* ------------------------------------------------------------- */
  /* 📴 MODO OFFLINE                                               */
  /* ------------------------------------------------------------- */
  const cacheKey = `usuarios_cache_${negocioId}`;

  if (!navigator.onLine) {
    const cache = JSON.parse(localStorage.getItem(cacheKey) || "[]");
    const nuevo = {
      usuario_id: Date.now(),
      rol: rol,
      activo: true,
      usuarios: {
        nombre,
        correo: email
      },
      local: true
    };
    cache.push(nuevo);
    localStorage.setItem(cacheKey, JSON.stringify(cache));

    Swal.fire({
      icon: "info",
      title: "Usuario guardado localmente",
      text: "Será sincronizado cuando vuelva la conexión.",
      confirmButtonColor: "#a21caf",
    });
    limpiarFormulario();
    mostrarUsuarios();
    return;
  }


/* ------------------------------------------------------------- */
/* 🟣 BUSCAR SI YA EXISTE EN ESTE NEGOCIO                         */
/* ------------------------------------------------------------- */
const { data: existente } = await supabaseClient
  .rpc("fn_buscar_usuario_por_email", {
    email_input: email,
    negocio_id_input: negocioId
  })
  .maybeSingle();

if (existente) {

  // 🔹 actualizar usuario base
  await supabaseClient
    .from("usuarios")
    .update({
      nombre,
      correo: email,
      activo: true
    })
    .eq("id", existente.id);

  
  Swal.fire({
    icon: "info",
    title: "Usuario reactivado",
    html: `<p>El usuario <b>${nombre}</b> ya existía y fue reactivado.</p>
           <p>Debe restablecer su contraseña mediante correo.</p>`,
    confirmButtonColor: "#a21caf",
  });

  limpiarFormulario();
  mostrarUsuarios();
  return;
}

/* ------------------------------------------------------------- */
/* 🟣 REGISTRO NUEVO USUARIO                                      */
/* ------------------------------------------------------------- */
// 1. crear en auth
const { data, error } = await supabaseClient.auth.signUp({ email, password });

if (error) {
  return Swal.fire({
    icon: "error",
    title: "Error al registrar",
    text: error.message,
    confirmButtonColor: "#a21caf",
  });
}

if (!data?.user?.id) {
  return Swal.fire({
    icon: "error",
    title: "Error",
    text: "No se pudo crear el usuario",
  });
}

// 2. crear usuario base
await supabaseClient.from("usuarios").upsert({
  id: data.user.id,
  nombre,
  correo: email,
  activo: true
});

// 3. crear relación negocio
await supabaseClient.from("usuarios_negocios").upsert({
  usuario_id: data.user.id,
  negocio_id: negocioId,
  rol,
  activo: true
}, {
  onConflict: "usuario_id,negocio_id"
});

Swal.fire({
  icon: "success",
  title: "Usuario registrado",
  text: `${nombre} ha sido agregado exitosamente.`,
  confirmButtonColor: "#a21caf",
});

limpiarFormulario();
mostrarUsuarios();
});

/* ------------------------------------------------------------- */
/* 🧹 LIMPIAR FORMULARIO                                          */
/* ------------------------------------------------------------- */
function limpiarFormulario() {
  ["nombre", "email", "password", "rol"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
}

/* ------------------------------------------------------------- */
/* 📋 MOSTRAR USUARIOS (MULTI-NEGOCIO + OFFLINE)                  */
/* ------------------------------------------------------------- */
async function mostrarUsuarios() {
  const cacheKey = `usuarios_cache_${negocioId}`;

  // Offline → mostrar cache
  if (!navigator.onLine) {
    const cache = JSON.parse(localStorage.getItem(cacheKey) || "[]");
    renderUsuarios(cache);
    console.warn("📴 Modo sin conexión: mostrando usuarios en cache local.");
    return;
  }

  const { data: usuarios, error } = await supabaseClient
    .from("usuarios_negocios")
    .select(`
      usuario_id,
      rol,
      activo,
      usuarios (
        id,
        nombre,
        correo
      )
    `)
    .eq("negocio_id", negocioId)
    .order("creado_en", { ascending: true });

  if (error) {
    listaUsuarios.innerHTML = `<p class="text-red-500 text-center">Error cargando usuarios.</p>`;
    return;
  }

  // Guardar cache por negocio
  localStorage.setItem(cacheKey, JSON.stringify(usuarios));
  renderUsuarios(usuarios);
}

function renderUsuarios(usuarios) {
  if (!usuarios?.length) {
    listaUsuarios.innerHTML = `<p class="text-gray-500 text-center">No hay usuarios registrados.</p>`;
    return;
  }

  listaUsuarios.innerHTML = usuarios
    .map((u) => {
      const nombre = u.usuarios?.nombre || "Sin nombre";
      const esAdmin = u.rol === "1" || u.rol === "admin";
      const rol = esAdmin ? "Administrador" : "Cajero";

      const color = u.activo ? "bg-green-500" : "bg-red-500";
      const estadoTexto = u.activo ? "Activo" : "Inactivo";

      const rolColor =
        rol === "Administrador"
          ? "text-purple-700 font-semibold"
          : "text-gray-700";

      return `
        <div class="flex justify-between items-center border-b pb-2">
          <div>
            <p class="font-medium flex items-center gap-2">
              ${nombre}
              <span class="${color} rounded-full w-3 h-3 inline-block"></span>
              <span>${estadoTexto}</span>
            </p>
            <p class="text-xs ${rolColor}">${rol}</p>
          </div>
          <div class="flex gap-2">
            <button onclick="editarUsuario('${u.usuario_id}', '${nombre}', '${rol}', ${u.activo})" class="btn-small btn-edit">
              Editar
            </button>
            <button onclick="confirmarDesactivar('${u.usuario_id}', ${u.activo}, '${nombre}')" class="btn-small ${u.activo ? 'bg-gray-500' : 'bg-green-600'}">
              ${u.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button onclick="confirmarEliminar('${u.usuario_id}', '${nombre}')" class="btn-small bg-red-600">
              Eliminar
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

/* ------------------------------------------------------------- */
/* ✏️ EDITAR / ACTIVAR / ELIMINAR (MULTI-NEGOCIO)                 */
/* ------------------------------------------------------------- */
window.editarUsuario = (id, nombre, rolNombre, activo) => {
  usuarioEditando = id;
  document.getElementById("editNombre").value = nombre;
  document.getElementById("editEmail").value = "";
  document.getElementById("editRol").value = rolNombre === "Administrador" ? "1" : "2";
  estadoActivo = activo;
  switchActivo.classList.toggle("active", activo);
  modal.classList.remove("hidden");
};

window.confirmarDesactivar = async (id, activo, nombre) => {
  const confirm = await Swal.fire({
    title: activo ? "¿Desactivar usuario?" : "¿Activar usuario?",
    text: activo
      ? `El usuario ${nombre} no podrá acceder al sistema.`
      : `El usuario ${nombre} volverá a tener acceso.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: activo ? "#ef4444" : "#22c55e",
    cancelButtonColor: "#6b7280",
    confirmButtonText: activo ? "Sí, desactivar" : "Sí, activar",
    cancelButtonText: "Cancelar",
  });

  if (!confirm.isConfirmed) return;

  const cacheKey = `usuarios_cache_${negocioId}`;

  if (!navigator.onLine) {
    const cache = JSON.parse(localStorage.getItem(cacheKey) || "[]");
    const idx = cache.findIndex((u) => u.usuario_id === id);
    if (idx >= 0) {
      cache[idx].activo = !activo;
      localStorage.setItem(cacheKey, JSON.stringify(cache));
    }
    Swal.fire("💾 Guardado local", "Cambio de estado almacenado (modo offline).", "info");
    mostrarUsuarios();
    return;
  }

  await supabaseClient
    .from("usuarios_negocios")
    .update({ activo: !activo })
    .eq("usuario_id", id)
    .eq("negocio_id", negocioId);

  Swal.fire({
    icon: "success",
    title: activo ? "Usuario desactivado" : "Usuario activado",
    text: `El estado de ${nombre} ha sido actualizado.`,
    confirmButtonColor: "#a21caf",
  });

  mostrarUsuarios();
};

window.confirmarEliminar = async (id, nombre) => {
  const confirm = await Swal.fire({
    title: "¿Eliminar usuario?",
    text: `El usuario ${nombre} será eliminado permanentemente.`,
    icon: "error",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
  });

  if (!confirm.isConfirmed) return;

  const cacheKey = `usuarios_cache_${negocioId}`;

  if (!navigator.onLine) {
    const cache = JSON.parse(localStorage.getItem(cacheKey) || "[]");
    const filtrado = cache.filter((u) => u.usuario_id !== id);
    localStorage.setItem(cacheKey, JSON.stringify(filtrado));
    Swal.fire("💾 Eliminado localmente", `${nombre} se eliminará al reconectar.`, "info");
    mostrarUsuarios();
    return;
  }

  await supabaseClient
    .from("usuarios_negocios")
    .delete()
    .eq("usuario_id", id)
    .eq("negocio_id", negocioId);

  Swal.fire({
    icon: "success",
    title: "Usuario eliminado",
    text: `${nombre} ha sido eliminado del sistema.`,
    confirmButtonColor: "#a21caf",
  });

  mostrarUsuarios();
};

/* ------------------------------------------------------------- */
/* 🚀 CARGA INICIAL                                               */
/* ------------------------------------------------------------- */
mostrarUsuarios();

/* ------------------------------------------------------------- */
/* 🔐 VALIDAR CONTRASEÑA SEGURA                                   */
/* ------------------------------------------------------------- */
function esContrasenaSegura(contrasena) {
  const tieneLongitud = contrasena.length >= 8;
  const tieneMayus = /[A-Z]/.test(contrasena);
  const tieneMinus = /[a-z]/.test(contrasena);
  const tieneNumero = /[0-9]/.test(contrasena);
  const tieneSimbolo = /[^A-Za-z0-9]/.test(contrasena);
  return tieneLongitud && tieneMayus && tieneMinus && tieneNumero && tieneSimbolo;
}

const passwordInput = document.getElementById("password");
const passwordText = document.getElementById("passwordStrengthText");
const editPasswordInput = document.getElementById("editPassword");
const editPasswordText = document.getElementById("editPasswordStrengthText");

function textoFortaleza(valor) {
  let fuerza = 0;
  if (valor.length >= 8) fuerza++;
  if (/[A-Z]/.test(valor)) fuerza++;
  if (/[a-z]/.test(valor)) fuerza++;
  if (/[0-9]/.test(valor)) fuerza++;
  if (/[^A-Za-z0-9]/.test(valor)) fuerza++;
  if (fuerza >= 4) return { nivel: "Fuerte ✅", color: "text-green-600" };
  if (fuerza === 3) return { nivel: "Media ⚠️", color: "text-yellow-500" };
  return { nivel: "Débil ❌", color: "text-red-600" };
}

function actualizarFortaleza(input, textEl) {
  const val = input.value;
  if (!val) return (textEl.textContent = "");
  const { nivel, color } = textoFortaleza(val);
  textEl.textContent = `Fortaleza: ${nivel}`;
  textEl.className = `text-xs mt-1 ${color}`;
}

passwordInput?.addEventListener("input", () =>
  actualizarFortaleza(passwordInput, passwordText)
);
editPasswordInput?.addEventListener("input", () =>
  actualizarFortaleza(editPasswordInput, editPasswordText)
);
