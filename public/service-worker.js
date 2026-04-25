/* ===========================================================
   💜 SmartPOS Service Worker v2.4 (2025 Final)
   - Misma lógica original
   - proteccion.js NUNCA se cachea
   - JS sí funciona offline
   - Estabilidad total POS
   =========================================================== */

const CACHE_NAME = "smartpos-v2.4";

const APP_SHELL = [
  "/index",
  "/manifest.json",
  "/venta",
  "/productos",
  "/reportes",
  "/caducidades",
  "/pedidos",
  "/proveedores",
  "/usuarios",
  "/configuracion",
  "/configuracion_ventas",
  "/sistema",
  "/corte-caja",
  "/inventario",
  "/inventario-alta",
  "/entradas",
  "/conteo",
  "/ajustes",

  "/css/venta.css",
  "/img/favicon-pos.png",

  // 🔥 JS CRÍTICO (para offline real)
  "/js/main.js",
  "/js/ventas.js",
  "/js/productos.js",
  "/js/carrito.js"
];

// 👆 proteccion.js sigue SIN cache

/* ------------------ INSTALACIÓN ------------------ */
self.addEventListener("install", (event) => {
  console.log(`⚙️ Instalando SmartPOS SW ${CACHE_NAME}...`);
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      for (const url of APP_SHELL) {
        try {
          const res = await fetch(url, { cache: "no-cache" });
          if (res.ok) await cache.put(url, res.clone());
        } catch {
          console.warn("⚠️ No se pudo cachear:", url);
        }
      }

      await self.skipWaiting();
    })()
  );
});

/* ------------------ ACTIVACIÓN ------------------ */
self.addEventListener("activate", (event) => {
  console.log(`🚀 Activando SmartPOS SW ${CACHE_NAME}...`);

  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🧹 Eliminando cache antigua:", key);
            return caches.delete(key);
          }
        })
      );

      try {
        await self.clients.claim();
        console.log(`✅ SmartPOS ${CACHE_NAME} listo`);
      } catch (err) {
        console.warn("⚠️ No se pudo reclamar clientes:", err);
        setTimeout(() => self.clients.claim().catch(() => {}), 1000);
      }
    })()
  );
});

/* ------------------ FETCH ------------------ */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* ---------------------------------------------------------
     🚫 1) proteccion.js nunca cache
     --------------------------------------------------------- */
  if (url.pathname.endsWith("proteccion.js")) {
    return event.respondWith(fetch(request, { cache: "no-store" }));
  }

  /* ---------------------------------------------------------
     🚫 2) externas / APIs
     --------------------------------------------------------- */
  if (
    url.hostname === "localhost" ||
    url.hostname.startsWith("127.") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("emailjs.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("unpkg.com") ||
    url.hostname.includes("cdn.jsdelivr.net")
  ) {
    return event.respondWith(fetch(request, { cache: "no-store" }));
  }

  /* ---------------------------------------------------------
     🚫 3) rutas dinámicas
     --------------------------------------------------------- */
  if (
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/js/configuracion/")
  ) {
    return event.respondWith(fetch(request, { cache: "no-store" }));
  }

  /* ---------------------------------------------------------
     ⚡ 4) CACHE FIRST + UPDATE SILENCIOSO (TU LÓGICA ORIGINAL)
     --------------------------------------------------------- */
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      if (cached) {
        fetch(request)
          .then(async (fresh) => {
            if (fresh.ok) await cache.put(request, fresh.clone());
          })
          .catch(() => {});
        return cached;
      }

      try {
        const res = await fetch(request);

        if (res && res.ok && res.type === "basic") {
          await cache.put(request, res.clone());
        }

        return res;

      } catch {
        if (request.destination === "document") {
          const offline =
            (await cache.match("/venta")) ||
            (await cache.match("/index"));

          if (offline) return offline;
        }
      }
    })()
  );
});

/* ------------------ MENSAJES ------------------ */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("🔁 Activación manual de nueva versión...");
    self.skipWaiting();
  }
});