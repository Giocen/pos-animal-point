// ============================================================================
// 💾 SmartPOS | DB Offline Dexie + MultiNegocio (ESTABLE FINAL)
// ============================================================================

import Dexie from "https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.mjs";
import { supabaseClient } from "./proteccion.js";
import { LocalDB } from "./localdb.js";

/* ----------------------------------------------- */
/* 🔹 Nombre de DB por negocio                     */
/* ----------------------------------------------- */
function obtenerNombreDB() {
  const negocioId = localStorage.getItem("negocio_id") || "default";
  return `SmartPOSOffline_${negocioId}`;
}

/* ----------------------------------------------- */
/* 🔹 Inicializar Dexie                            */
/* ----------------------------------------------- */
export let db;

export async function inicializarDB() {
  if (db) return db;

  try {
    const nombreDB = obtenerNombreDB();
    db = new Dexie(nombreDB);

    db.version(113).stores({
      productos: `
        &uuid_supabase,
        negocio_id,
        sku,
        codigo_barras,
        nombre,
        precio_base,
        unidad,
        existencias,
        stock_minimo,
        updated_at,
        [negocio_id+sku],
        [negocio_id+codigo_barras]
      `,
      ventas:
        "++id, producto_id, cantidad, precio_unitario, total, unidad, fecha, corte_id, cliente_id",
      inventario_lotes:
        "++id, producto_id, cantidad, fecha_caducidad, motivo, fecha",
      configuracion_sistema: "clave, valor",
      negocio: "clave, valor",
      cortes: "id, apertura, cierre, usuario, sincronizado",
      movimientos: "++id, corte_id, tipo, concepto, monto, sincronizado",
    });

    console.log(`💾 Dexie inicializada: ${nombreDB} (v113)`);
    return db;

  } catch (err) {
    if (err.name === "VersionError") {
      const nombreDB = obtenerNombreDB();
      console.warn(`⚠️ VersionError en ${nombreDB}, reiniciando DB...`);
      await indexedDB.deleteDatabase(nombreDB);
      setTimeout(() => location.reload(), 500);
    } else {
      console.error("❌ Error en inicializarDB:", err);
    }
  }
}

/* ----------------------------------------------- */
/* 🔹 Config caching local                         */
/* ----------------------------------------------- */
export async function getConfig(clave) {
  await inicializarDB();
  try {
    const r = await db.configuracion_sistema.get(clave);
    return r?.valor ?? null;
  } catch {
    return null;
  }
}

export async function setConfig(clave, valor) {
  await inicializarDB();
  await db.configuracion_sistema.put({ clave, valor });
}

/* ----------------------------------------------- */
/* 🔹 Sincronizar productos                        */
/* ----------------------------------------------- */
export async function sincronizarProductos() {
  await inicializarDB();

  const negocioId = localStorage.getItem("negocio_id");
  if (!negocioId) {
    console.warn("⚠️ No hay negocio_id → no se sincronizan productos.");
    return [];
  }

  /* ---------------- OFFLINE ---------------- */
  if (!navigator.onLine) {
    const cache = LocalDB.get(`productos_cache_${negocioId}`);
    if (cache?.length) return cache;
    return await db.productos.toArray();
  }

  /* ---------------- ONLINE ---------------- */
  try {
    console.log("📡 Descargando catálogo desde v_productos_existencias...");

    const { data: productos, error } = await supabaseClient
      .from("v_productos_existencias")
      .select(`
        id,
        nombre,
        descripcion,
        precio_base,
        unidad,
        sku,
        codigo_barras,
        existencias_total,
        stock_minimo,
        costo,
        activo,
        categoria_id,
        imagen_url
      `);

    if (error) throw error;
    if (!productos?.length) return [];

    // Cache rápido
    LocalDB.set(`productos_cache_${negocioId}`, productos, 60);

    let actualizados = 0;

    for (const p of productos) {
      await db.productos.put({
        uuid_supabase: p.id,
        negocio_id: negocioId,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio_base: p.precio_base,
        unidad: p.unidad,
        sku: p.sku,
        codigo_barras: p.codigo_barras,
        existencias: p.existencias_total,
        stock_minimo: p.stock_minimo,
        updated_at: null, // ✅ FIX DEFINITIVO
        costo: p.costo,
        activo: p.activo,
        categoria_id: p.categoria_id,
        imagen_url: p.imagen_url,
      });
      actualizados++;
    }

    console.log(`✅ Productos sincronizados (${actualizados}/${productos.length})`);
    return productos;

  } catch (err) {
    console.error("❌ Error sincronizando productos:", err);
    return await db.productos.toArray();
  }
}

/* ----------------------------------------------- */
/* 🔹 Limpiar Dexie                                */
/* ----------------------------------------------- */
export async function limpiarOffline() {
  await inicializarDB();
  const nombreDB = obtenerNombreDB();
  await db.delete();
  console.warn(`🧹 DB offline eliminada: ${nombreDB}`);
  location.reload();
}
