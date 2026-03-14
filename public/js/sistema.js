// 💜 SmartPOS - Módulo de Sistema y Dispositivos (v2.3 Multi-Negocio REAL)
import { supabaseClient, protegerSesion } from "/js/proteccion.js";

(async () => {
  // 🔐 Obtener usuario REAL usando la protección nueva
  let usuario = await protegerSesion(["admin"]);

  // Esperar si aún no estaba lista la sesión
  if (!usuario) {
    console.warn("⏳ Esperando sesión activa (evento sesionActiva)...");
    window.addEventListener(
      "sesionActiva",
      async (e) => {
        usuario = e.detail;
        await iniciarModuloSistema(usuario);
      },
      { once: true }
    );
    return;
  }

  // ✔ Sesión lista → iniciar módulo
  await iniciarModuloSistema(usuario);
})();

/* -------------------------------------------------------------------------- */
/* 🚀 Inicialización del módulo del sistema                                   */
/* -------------------------------------------------------------------------- */
function renderModulo(usuario) {
  lucide.createIcons();

  setTimeout(() => {
    inicializarMenuLateral();
    mostrarSeccion("conexion");

    console.log(
      `⚙️ Módulo Sistema cargado correctamente para ${usuario.nombre} (rol: ${usuario.rol})`
    );
  }, 50);
}


/* -------------------------------------------------------------------------- */
/* 🧠 Render principal del módulo                                             */
/* -------------------------------------------------------------------------- */
function renderModulo(usuario) {
  lucide.createIcons();
  setTimeout(() => {
    inicializarMenuLateral();
    mostrarSeccion("conexion");
    console.log(`⚙️ Módulo Sistema cargado correctamente para ${usuario.nombre} (${usuario.roles?.nombre})`);
  }, 50);
}

/* -------------------------------------------------------------------------- */
/* 🧭 CONTROL DE NAVEGACIÓN LATERAL                                           */
/* -------------------------------------------------------------------------- */
function inicializarMenuLateral() {
  const botones = document.querySelectorAll(".tab-btn");
  botones.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      botones.forEach((b) => b.classList.remove("bg-fuchsia-100", "text-fuchsia-700"));
      btn.classList.add("bg-fuchsia-100", "text-fuchsia-700");
      mostrarSeccion(tab);
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 🧩 FUNCIÓN PRINCIPAL DE RENDER DE SECCIONES                                */
/* -------------------------------------------------------------------------- */
function mostrarSeccion(nombre) {
  const cont = document.getElementById("sistema-container");
  if (!cont) return;
  cont.innerHTML = "";

  switch (nombre) {
    case "conexion":
      renderConexion(cont);
      break;
    case "dispositivos":
      renderDispositivos(cont);
      break;
    case "mantenimiento":
      renderMantenimiento(cont);
      break;
    default:
      cont.innerHTML = `<p class="text-gray-500 text-center mt-10">Sección no implementada.</p>`;
  }

  lucide.createIcons();
}

/* -------------------------------------------------------------------------- */
/* 🌐 CONEXIÓN SUPABASE (Offline Ready)                                       */
/* -------------------------------------------------------------------------- */
function renderConexion(cont) {
  cont.innerHTML = `
    <div class="card-3d p-6 max-w-2xl mx-auto">
      <div class="flex items-center gap-2 mb-3 text-fuchsia-700">
        <i data-lucide="wifi" class="w-5 h-5"></i>
        <h2 class="font-semibold text-sm">Prueba de Conexión con Supabase</h2>
      </div>
      <p class="text-gray-600 text-sm mb-4">
        Verifica si SmartPOS tiene conexión activa con la base de datos.
      </p>
      <button id="btn-test-conn"
              class="btn-3d bg-fuchsia-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 mx-auto">
        <i data-lucide="wifi" class="w-4 h-4"></i> Probar conexión
      </button>
      <div id="estado-conexion" class="mt-4 text-sm text-gray-700 text-center"></div>
    </div>
  `;

  document.getElementById("btn-test-conn")?.addEventListener("click", async () => {
    const estado = document.getElementById("estado-conexion");
    estado.textContent = "⏳ Verificando conexión...";
    estado.className = "mt-4 text-sm text-gray-500 text-center";

    // 🔹 Verificar si estamos offline
    if (!navigator.onLine) {
      estado.textContent = "📴 Modo sin conexión — Supabase no disponible.";
      estado.className = "mt-4 text-sm text-amber-600 text-center";
      return;
    }

    try {

      // 🔥 MULTI-NEGOCIO: filtrar por negocio_id (sin modificar lógica general)
      const negocioId = JSON.parse(localStorage.getItem("usuario_actual") || "{}")?.negocio_id;

      const { error } = await supabaseClient
        .from("ajustes")
        .select("id")
        .eq("negocio_id", negocioId)
        .limit(1);

      if (error) throw error;

      estado.textContent = "✅ Conexión activa con Supabase";
      estado.className = "mt-4 text-sm text-green-600 text-center";
      localStorage.setItem("conexion_supabase", "online");
    } catch (err) {
      console.error(err);
      estado.textContent = "❌ No se pudo conectar con Supabase";
      estado.className = "mt-4 text-sm text-red-600 text-center";
      localStorage.setItem("conexion_supabase", "offline");
    }
  });
}

/* -------------------------------------------------------------------------- */
/* 🖨️ DISPOSITIVOS (Offline Ready)                                           */
/* -------------------------------------------------------------------------- */
function renderDispositivos(cont) {
  cont.innerHTML = `
    <div class="card-3d p-6 max-w-3xl mx-auto">
      <div class="flex items-center gap-2 mb-3 text-fuchsia-700">
        <i data-lucide="printer" class="w-5 h-5"></i>
        <h2 class="font-semibold text-sm">Configuración de Dispositivos</h2>
      </div>
      <p class="text-gray-600 text-sm mb-4">
        Configura la impresora, cajón de dinero o báscula conectados a SmartPOS.
      </p>

      <div class="grid sm:grid-cols-2 gap-4">
        <button id="btn-printer-test"
                class="btn-3d bg-fuchsia-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 justify-center">
          <i data-lucide="printer" class="w-4 h-4"></i> Probar Impresora
        </button>

        <button id="btn-cashdrawer-test"
                class="btn-3d bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 justify-center">
          <i data-lucide="dollar-sign" class="w-4 h-4"></i> Abrir Cajón
        </button>

        <button id="btn-scale-test"
                class="btn-3d bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 justify-center sm:col-span-2">
          <i data-lucide="scale" class="w-4 h-4"></i> Probar Báscula
        </button>
      </div>
    </div>
  `;

  const registrarAccion = (accion) => {
    const registro = JSON.parse(localStorage.getItem("sistema_log") || "[]");
    registro.push({ accion, fecha: new Date().toISOString() });
    localStorage.setItem("sistema_log", JSON.stringify(registro));
  };

  document.getElementById("btn-printer-test")?.addEventListener("click", () => {
    Swal.fire("🖨️ Impresora", "Simulación de prueba de impresión POS.", "info");
    registrarAccion("Probar Impresora");
  });

  document.getElementById("btn-cashdrawer-test")?.addEventListener("click", () => {
    Swal.fire("💵 Cajón de dinero", "Comando de apertura enviado.", "success");
    registrarAccion("Abrir Cajón");
  });

  document.getElementById("btn-scale-test")?.addEventListener("click", () => {
    Swal.fire("⚖️ Báscula", "Lectura simulada: 2.345 kg", "info");
    registrarAccion("Probar Báscula");
  });
}

/* -------------------------------------------------------------------------- */
/* 🧹 MANTENIMIENTO (con soporte local y factory reset offline)               */
/* -------------------------------------------------------------------------- */
function renderMantenimiento(cont) {
  cont.innerHTML = `
    <div class="card-3d p-6 max-w-2xl mx-auto">
      <div class="flex items-center gap-2 mb-3 text-fuchsia-700">
        <i data-lucide="refresh-cw" class="w-5 h-5"></i>
        <h2 class="font-semibold text-sm">Mantenimiento del Sistema</h2>
      </div>
      <p class="text-gray-600 text-sm mb-5">
        Limpia la caché, restablece configuraciones o reinicia SmartPOS.
      </p>

      <div class="flex flex-wrap justify-center gap-3">
        <button id="btn-clear-cache"
                class="btn-3d bg-purple-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition">
          <i data-lucide="trash-2" class="w-4 h-4"></i> Limpiar Caché
        </button>

        <button id="btn-reset-app"
                class="btn-3d bg-red-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition">
          <i data-lucide="alert-triangle" class="w-4 h-4"></i> Restablecer App
        </button>

        <button id="btn-factory-reset"
                class="btn-3d bg-red-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-red-800 transition sm:col-span-2">
          <i data-lucide="zap" class="w-4 h-4"></i> Restablecer de Fábrica
        </button>
      </div>
    </div>
  `;

  document.getElementById("btn-clear-cache")?.addEventListener("click", async () => {
    await caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));    
    localStorage.clear();
    Swal.fire("✅ Listo", "Caché y datos locales limpiados correctamente.", "success");
  });

  document.getElementById("btn-reset-app")?.addEventListener("click", async () => {
    const res = await Swal.fire({
      title: "⚠️ Restablecer aplicación",
      text: "Esto eliminará configuraciones y caché locales (sin tocar Supabase).",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, restablecer",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!res.isConfirmed) return;

    await caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));    
    localStorage.clear();
    indexedDB.deleteDatabase("SmartPOSOffline");
    Swal.fire("💥 Sistema restablecido", "La aplicación se reiniciará.", "success");
    setTimeout(() => location.reload(), 1500);
  });

  document.getElementById("btn-factory-reset")?.addEventListener("click", async () => {
    if (!navigator.onLine) {
      return Swal.fire("📴 Sin conexión", "No puedes hacer un reinicio de fábrica en modo offline.", "warning");
    }

    const res = await Swal.fire({
      title: "🧨 Reinicio de Fábrica",
      html: `
        <p class='text-sm text-gray-600'>
          Esto <b>eliminará todos los datos de tu negocio</b> en Supabase:
          productos, ventas, inventario, configuraciones y usuarios (excepto el admin).
        </p>
        <p class='mt-3 text-red-500 text-sm font-semibold'>Esta acción no se puede deshacer.</p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar todo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#b91c1c",
    });

    if (!res.isConfirmed) return;

    try {
      const { error } = await supabaseClient.rpc("reiniciar_sistema");
      if (error) throw error;

      Swal.fire({
        icon: "success",
        title: "Reinicio completado",
        text: "El sistema fue restablecido correctamente. La app se reiniciará.",
        confirmButtonColor: "#a21caf",
      });
      setTimeout(() => location.reload(), 2000);
    } catch (err) {
      console.error(err);
      Swal.fire("❌ Error", "No se pudo reiniciar el sistema en Supabase.", "error");
    }
  });
}
