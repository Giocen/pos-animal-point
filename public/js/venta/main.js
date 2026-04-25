// ============================================================================
// 💜 SmartPOS - Main Ventas Unificado v4.3 MULTI-NEGOCIO (CORREGIDO DEFINITIVO)
// ============================================================================
// ✔ Autenticación unificada (protegerSesion)
// ✔ negocio_id consistente y único
// ✔ Cache y perfil funcionando
// ✔ Productos sincronizados por negocio REAL
// ✔ Sin loops, sin swal oculto
// ✔ FIX: los imports ahora están ANTES del código que usa LocalDB
// ============================================================================

// ===================================================================================
// 1) IMPORTS (DEBEN IR HASTA ARRIBA SIEMPRE — MUY IMPORTANTE)
// ===================================================================================
import { supabaseClient, protegerSesion } from "/js/proteccion.js";
import { db, inicializarDB, sincronizarProductos } from "/js/db.js";
import { LocalDB } from "/js/localdb.js";
window.LocalDB = LocalDB;

import { abrirCajonPorTicket } from "/js/sistema/cajon-ticket.js";
import "/js/venta/panel-personalizado.js";

import { inicializarPagos } from "/js/venta/pagos.js";
import { abrirTopVendidos, abrirResumenDia, abrirUtilidadProductos } from "/js/venta/panel-reportes.js";
import { reanudarBasculaAuto } from "/js/sistema/bascula.js";

window.basculaActiva = false;

// ===================================================================================
// 2) FIX: Asegurar negocio_id antes de inicializar ventas (YA TIENE LocalDB DISPONIBLE)
// ===================================================================================
(function asegurarNegocioID() {
  const neg = localStorage.getItem("negocio_id");

  if (!neg) {
    console.warn("⚠ negocio_id faltante al cargar ventas. Intentando restaurar...");

    const offline =
      LocalDB?.get?.("usuario_activo") ||
      LocalDB?.get?.("usuario_sesion");

    if (offline?.negocio_id) {
      console.log("✔ negocio_id restaurado:", offline.negocio_id);
      localStorage.setItem("negocio_id", offline.negocio_id);
    } else {
      console.error("❌ No se pudo restaurar negocio_id. Redirigiendo a login.");
      window.location.href = "/login.html";
    }
  }
})();

// ===================================================================================
// 3) Caja de peso
// ===================================================================================
export function actualizarCajaPeso(estado) {
  const row = document.querySelector(".peso-manual-row");
  const input = document.getElementById("pesoManual");
  if (!row || !input) return;

  if (estado) {
    row.style.borderColor = "#22c55e";
    row.style.background = "#dcfce7";
  } else {
    row.style.borderColor = "#c7d2fe";
    row.style.background = "#eef2ff";
    input.value = "0.000";
  }
}

// ===================================================================================
// 4) Loader visual
// ===================================================================================
function mostrarLoaderSmartPOS() {
  const loader = document.createElement("div");
  loader.id = "smartpos-loader";

  loader.innerHTML = `
    <div class="fixed inset-0 flex items-center justify-center
      bg-gradient-to-br from-purple-900/20 to-fuchsia-900/20
      backdrop-blur-xl z-[99999]">

      <div class="flex flex-col items-center gap-3">
        <i data-lucide="shopping-cart"
           class="w-10 h-10 text-fuchsia-500 animate-pulse"></i>

        <div class="animate-spin rounded-full h-12 w-12
          border-4 border-fuchsia-600 border-t-transparent"></div>
      </div>
    </div>
  `;

  document.body.appendChild(loader);
  if (window.lucide) lucide.createIcons();
}

function ocultarLoaderSmartPOS() {
  const el = document.getElementById("smartpos-loader");
  if (!el) return;
  el.style.opacity = "0";
  setTimeout(() => el.remove(), 150);
}

// ===================================================================================
// 5) Sesión persistente (unificada)
// ===================================================================================
async function restaurarSesionPersistente() {
  const usuario = await protegerSesion();
  if (!usuario) return null;

  localStorage.setItem("negocio_id", usuario.negocio_id);
  LocalDB.set("usuario_activo", usuario, 1440);

  window.usuarioActual = usuario;
  return usuario;
}

// ===================================================================================
// 6) Perfil del usuario
// ===================================================================================
async function cargarPerfilUsuario(usuario) {
  if (!usuario) return;

  let perfil = LocalDB.get("perfil_usuario");

  if (!perfil && navigator.onLine) {
    const { data } = await supabaseClient
      .from("usuarios")
      .select("nombre")
      .eq("id", usuario.id)
      .single();

    perfil = {
      nombre: data?.nombre || "Usuario",
      rol: usuario.rol
    };

    LocalDB.set("perfil_usuario", perfil, 1440);
  }

  perfil ??= { nombre: "Usuario Offline", rol: usuario.rol };

  const userFinal = { ...usuario, nombre: perfil.nombre };
  window.usuarioActual = userFinal;

  const fUser = document.getElementById("footerUsuario");
  const fRol = document.getElementById("footerRol");

  if (fUser) fUser.textContent = perfil.nombre;
  if (fRol) fRol.textContent = perfil.rol;
}

// ===================================================================================
// 7) Boolean helper
// ===================================================================================
function esActivo(v) {
  if (v === undefined || v === null) return false;
  return ["true", "1", "si", "sí"].includes(String(v).trim().toLowerCase());
}

// ===================================================================================
// 8) Inicializar SmartPOS
// ===================================================================================
async function inicializarSmartPOS() {
  mostrarLoaderSmartPOS();

  // 🔑 Primero restaurar sesión para tener negocio_id
  const usuario = await restaurarSesionPersistente();
  if (!usuario) return;

  // 💾 Ahora que existe negocio_id, inicializamos Dexie
 await inicializarDB();

await cargarPerfilUsuario(usuario);

// 🔥 1. SINCRONIZAR
await sincronizarProductos();

const productosLocal = await db.productos
  .where("negocio_id")
  .equals(localStorage.getItem("negocio_id"))
  .toArray();

if (productosLocal?.length) {
  console.log("📦 Productos finales desde Dexie:", productosLocal.length);
}

// 🔥 siempre usar catálogo final de Dexie
window.productosGlobal = productosLocal;

if (!productosLocal.length) {
  console.warn("⚠ No hay productos en el negocio (real).");
}

if (!productosLocal.length) {
  console.warn("⚠ No hay productos en el negocio (real).");
}

// 🔥 4. CARGAR UI
await cargarModulosVentas();

ocultarLoaderSmartPOS();
}
// ===================================================================================
// 9) Cargar módulos (mismo código original)
// ===================================================================================
async function cargarModulosVentas() {
  try {
    const [
      clientesModule,
      productosModule,
      eventosModule,
      carritoModule,
      ventasModule,
      basculaModule,
    ] = await Promise.all([
      import("/js/venta/clientes.js"),
      import("/js/venta/productos.js"),
      import("/js/venta/eventosConexion.js"),
      import("/js/venta/carrito.js"),
      import("/js/venta/ventas.js"),
      import("/js/sistema/bascula.js"),
    ]);

    const { configurarClientes } = clientesModule;
    const { configurarProductos } = productosModule;
    const { configurarEventosConexion } = eventosModule;
    const { inicializarCarrito, carrito } = carritoModule;

    window.carrito = carrito;

    const { configurarVentas } = ventasModule;
    const { inicializarConexionManual } = basculaModule;

    await cargarConfiguracionVentas();
    aplicarConfiguracionVentas();

    configurarClientes();
    configurarProductos();
    configurarEventosConexion();
    inicializarCarrito();
    configurarVentas();

    inicializarPagos(() => carrito.reduce((a, i) => a + i.totalFinal, 0));

    conectarBuscadorHeader();

    
      inicializarConexionManual();

    document.dispatchEvent(new Event("ventasReady"));

    console.log("✔️ Ventas listas.");
  } catch (err) {
    console.error("💥 Error cargando módulos:", err);
    Swal.fire("Error", "Ocurrió un problema al cargar ventas.", "error");
  }
}

// ===================================================================================
// 10) Buscador Header
// ===================================================================================
function conectarBuscadorHeader() {
  const btn = document.getElementById("btnBuscarGlobal");
  const inputSku = document.getElementById("sku");

  if (!btn) return;

  btn.addEventListener("click", async () => {
    const sku = inputSku.value.trim();
    const negocio = localStorage.getItem("negocio_id");

    const { buscarProductoPorSkuHeader, buscarGlobal } = await import(
      "/js/venta/productos.js"
    );

    if (sku) return buscarProductoPorSkuHeader(sku, negocio);

    return buscarGlobal(negocio);
  });
}

// ===================================================================================
// 11) Configuración de ventas
// ===================================================================================
async function cargarConfiguracionVentas() {
  try {
    const negocio = localStorage.getItem("negocio_id");

    const { data } = await supabaseClient
      .from("configuracion_sistema")
      .select("clave, valor")
      .eq("categoria", "ventas")
      .eq("negocio_id", negocio);

    const config = {};
    data?.forEach(c => (config[c.clave] = c.valor));

    window.configVentas = config;
    localStorage.setItem("config_ventas", JSON.stringify(config));
  } catch (err) {
    console.warn("⚠️ Error cargando configuración:", err);
  }
}

function aplicarConfiguracionVentas() {
  const conf = window.configVentas || {};

  document
    .querySelectorAll(".btnImprimir")
    .forEach(b => b.classList.toggle("hidden", !esActivo(conf.ventas_ticket_pdf)));

  document
    .querySelectorAll(".btnCaja")
    .forEach(b => b.classList.toggle("hidden", !esActivo(conf.ventas_caja_activa)));

  const bascula = document.getElementById("contenedorBascula");
  if (bascula)
    bascula.classList.toggle("hidden", !esActivo(conf.ventas_bascula_activa));
}

// ===================================================================================
// 12) DOM READY
// ===================================================================================
document.addEventListener("DOMContentLoaded", () => {
  reanudarBasculaAuto();
  inicializarSmartPOS().then(() => actualizarIndicadores());

  setInterval(actualizarIndicadores, 5000);

  document.getElementById("btnAbrirCaja")
    ?.addEventListener("click", abrirCajonPorTicket);

  document.getElementById("btnLogout")
    ?.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      localStorage.clear();
      window.location.href = "/login.html";
    });

  const panel = document.getElementById("panelLateral");
const btnTogglePanel = document.getElementById("btnTogglePanel");

/* ==========================================================
   ABRIR PANEL
========================================================== */
btnTogglePanel?.addEventListener("click", (e) => {

  e.stopPropagation(); // evita que el click cierre el panel inmediatamente
  panel.classList.add("open");

  if (window.Swal && Swal.isVisible()) {
    Swal.close();
  }

});

/* ==========================================================
   CERRAR PANEL AL HACER CLICK FUERA
========================================================== */
document.addEventListener("click", (e) => {

  if (!panel.classList.contains("open")) return;

  const clickDentroPanel = panel.contains(e.target);
  const clickBoton = e.target.closest("#btnTogglePanel");

  if (!clickDentroPanel && !clickBoton) {
    panel.classList.remove("open");
  }

});
  document.getElementById("btnCerrarPanel")
    ?.addEventListener("click", () => panel.classList.remove("open"));

  document.getElementById("btnTopVendidos")
    ?.addEventListener("click", abrirTopVendidos);

  document.getElementById("btnResumen")
    ?.addEventListener("click", abrirResumenDia);

  document.getElementById("btnUtilidadProductos")
    ?.addEventListener("click", abrirUtilidadProductos);

    
    // 👤 CLIENTE HUB (CLIENTES + PEDIDOS + RUTA)
document.getElementById("btnClientePanel")
  ?.addEventListener("click", async () => {
    console.log("👤 Click Cliente");

    const { abrirClienteHub } = await import("/js/venta/cliente-hub.js");
    abrirClienteHub();
 
    });

  });

// ===================================================================================
// 13) Indicadores Footer
// ===================================================================================
function actualizarIndicadores() {
  const conf = window.configVentas || {};

  const red = document.getElementById("indicadorRedIcon");
  if (red)
    red.setAttribute(
      "class",
      "w-5 h-5 " + (navigator.onLine ? "text-green-400" : "text-red-500")
    );

  const caja = document.getElementById("indicadorCajaIcon");
  if (caja)
    caja.setAttribute(
      "class",
      "w-5 h-5 " +
        (esActivo(conf.ventas_caja_activa) ? "text-green-400" : "text-gray-400")
    );

  const impresora = document.getElementById("indicadorImpresoraIcon");
  if (impresora)
    impresora.setAttribute(
      "class",
      "w-5 h-5 " +
        (esActivo(conf.ventas_impresora_activa)
          ? "text-green-400"
          : "text-gray-400")
    );

  const sonido = document.getElementById("indicadorSonidoIcon");
  if (sonido)
    sonido.setAttribute(
      "class",
      "w-5 h-5 " +
        (esActivo(conf.ventas_sonido_alertas)
          ? "text-green-400"
          : "text-gray-400")
    );

  const btnBascula = document.getElementById("btnToggleBasculaPeso");
  const txtBascula = document.getElementById("estadoBasculaTexto");

  if (btnBascula && txtBascula) {
    const activa = window.basculaActiva === true;

    btnBascula.classList.toggle("on", activa);
    btnBascula.classList.toggle("off", !activa);

    txtBascula.classList.toggle("on", activa);
    txtBascula.classList.toggle("off", !activa);

    txtBascula.textContent = activa ? "● Conectada" : "● Desconectada";
    txtBascula.style.color = activa ? "#22c55e" : "#f43f5e";
  }
}

window.addEventListener("online", actualizarIndicadores);
window.addEventListener("offline", actualizarIndicadores);
window.addEventListener("bascula-estado", actualizarIndicadores);

