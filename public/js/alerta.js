/* -------------------------------------------------------------------------- */
/* 💡 SmartPOS | Checar bajo stock (con modo offline + cache)                 */
/* -------------------------------------------------------------------------- */
async function checarBajoStock() {
  try {
    // 🌐 Si hay conexión → consultar Supabase normalmente
    if (navigator.onLine) {

      // 🟣 MULTI-NEGOCIO
      const negocio_id = localStorage.getItem("negocio_id");

      const { data, error } = await supabaseClient
        .from("v_productos_bajo_stock")
        .select("*")
        .eq("negocio_id", negocio_id);  // 🟣 FILTRO MULTI-NEGOCIO

      if (error) {
        console.error("❌ Error consultando bajo stock:", error);
        return;
      }

      // 💾 Guardar cache local para modo offline
      localStorage.setItem("smartpos_bajo_stock_cache", JSON.stringify(data || []));
      localStorage.setItem("smartpos_bajo_stock_time", new Date().toISOString());

      mostrarAlertasBajoStock(data);
    } else {
      // 📴 Sin conexión → usar cache local si existe
      const cache = JSON.parse(localStorage.getItem("smartpos_bajo_stock_cache") || "[]");
      if (cache.length) {
        console.log(`📦 ${cache.length} productos de bajo stock desde cache local`);
        mostrarAlertasBajoStock(cache, true);
      } else {
        console.warn("⚠️ Sin conexión y sin cache previo de bajo stock.");
      }
    }
  } catch (err) {
    console.error("⚠️ Error general en checarBajoStock:", err);
  }
}

/* -------------------------------------------------------------------------- */
/* 🧩 Función auxiliar para mostrar alertas                                    */
/* -------------------------------------------------------------------------- */
function mostrarAlertasBajoStock(lista, desdeCache = false) {
  if (!lista?.length) return;

  const fuente = desdeCache ? " (datos offline)" : "";

  lista.forEach((prod, i) => {
    setTimeout(() => {
      Swal.fire({
        icon: "warning",
        title: "⚠️ Bajo stock" + fuente,
        html: `
          <b>${prod.nombre}</b><br>
          <small>Existencias: ${prod.existencias} | Mínimo: ${prod.stock_minimo}</small>
        `,
        confirmButtonColor: "#f59e0b",
        background: "#fff",
        customClass: { popup: "card-3d" },
      });
    }, i * 400);
  });
}
