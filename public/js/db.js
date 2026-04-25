// ============================================================================
// 💾 SmartPOS | DB Offline Dexie + MultiNegocio (ESTABLE FINAL)
// ============================================================================

import Dexie from "https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.mjs";
import { supabaseClient } from "./proteccion.js";
import { LocalDB } from "./localdb.js";

/* ----------------------------------------------- */
/* 🔹 Obtener negocio_id seguro                    */
/* ----------------------------------------------- */
function obtenerNegocioId() {

  const id = localStorage.getItem("negocio_id");

  if (!id) {
    console.warn("⚠ negocio_id no disponible aún");
    return null;
  }

  return id; // UUID string válido
}
/* ----------------------------------------------- */
/* 🔹 Nombre de DB por negocio                     */
/* ----------------------------------------------- */
function obtenerNombreDB() {
  const negocioId = obtenerNegocioId() || "default";
  return `SmartPOSOffline_${negocioId}`;
}


/* ----------------------------------------------- */
/* 🔹 Control de sincronización incremental        */
/* ----------------------------------------------- */
function getUltimaSync() {
  const negocioId = obtenerNegocioId();
  return localStorage.getItem(`ultima_sync_productos_${negocioId}`);
}

function setUltimaSync(fecha) {
  const negocioId = obtenerNegocioId();
  localStorage.setItem(
    `ultima_sync_productos_${negocioId}`,
    fecha || new Date().toISOString()
  );
}

/* ----------------------------------------------- */
/* 🔹 Inicializar Dexie                            */
/* ----------------------------------------------- */
export let db;

export async function inicializarDB() {

  if (db) return db;

 let negocioId = obtenerNegocioId();

/* esperar negocio_id si aún no existe */
let intentos = 0;

while (!negocioId && intentos < 20) {
  await new Promise(r => setTimeout(r, 100));
  negocioId = obtenerNegocioId();
  intentos++;
}

if (!negocioId) {
  console.warn("⚠ Dexie cancelado: negocio_id no disponible");
  return null;
}

  try {

    const nombreDB = obtenerNombreDB();

    db = new Dexie(nombreDB);

    db.version(114).stores({
      productos: `
        &id,
        uuid_supabase,
        negocio_id,
        sku,
        codigo_barras,
        nombre,
        precio_base,
        costo,
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

  const negocioId = obtenerNegocioId();

  if (!negocioId) {

    console.warn("⚠️ No hay negocio_id → no se sincronizan productos.");

    return [];

  }

  /* ---------------- OFFLINE ---------------- */

  if (!navigator.onLine) {

    const cache = LocalDB.get(`productos_cache_${negocioId}`);

    if (cache?.length) return cache;

    return await db.productos
      .where("negocio_id")
      .equals(negocioId)
      .toArray();
  }

  /* ---------------- ONLINE ---------------- */

  try {

    console.log("📡 Descargando catálogo desde v_productos_existencias...");

const ultimaSync = getUltimaSync();

// 🔥 verificar si Dexie ya tiene datos
const totalLocal = await db.productos
  .where("negocio_id")
  .equals(negocioId)
  .count();

let query = supabaseClient
  .from("v_productos_existencias")
  .select(`
    id,
    negocio_id,
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
    imagen_url,
    updated_at
  `)
  .eq("negocio_id", negocioId);

// 🔥 SOLO usar incremental si YA hay datos
if (ultimaSync && totalLocal > 0) {
  query = query.gt("updated_at", ultimaSync);
} else {
  console.log("📦 Primera carga completa");
}

const { data: productos, error } = await query;

    if (error) throw error;
if (!productos?.length) {
  console.log("⚡ Sin cambios en productos");

  // 🔥 ESPERAR un tick para asegurar Dexie listo
  await new Promise(r => setTimeout(r, 50));

  const respaldo = await db.productos
    .where("negocio_id")
    .equals(negocioId)
    .toArray();

  console.log("📦 Respaldo Dexie:", respaldo.length);

  return respaldo;
}

  

    let actualizados = 0;

    /* ==========================================================
      🚀 INSERT MASIVO (ULTRA RÁPIDO)
    ========================================================== */
    const registros = productos.map(p => ({
  id: p.id, // ✅ FIX CRÍTICO
  uuid_supabase: p.id,
  negocio_id: p.negocio_id,
  nombre: p.nombre,
  descripcion: p.descripcion,
  precio_base: p.precio_base,
  unidad: p.unidad,
  sku: p.sku,
  codigo_barras: p.codigo_barras,
  existencias: p.existencias_total,
  stock_minimo: p.stock_minimo,
  updated_at: p.updated_at,
  costo: p.costo,
  activo: p.activo,
  categoria_id: p.categoria_id,
  imagen_url: p.imagen_url,
}));

    await db.transaction("rw", db.productos, async () => {
      await db.productos.bulkPut(registros);
    });

    console.log("📊 Total en Dexie:",
  await db.productos.where("negocio_id").equals(negocioId).count()
);

const maxUpdated = productos.reduce((max, p) => {
  if (!p.updated_at) return max;
  return !max || p.updated_at > max ? p.updated_at : max;
}, null);

if (maxUpdated) {
  setUltimaSync(maxUpdated);
}

    /* ==========================================================
      📊 CONTADOR (se mantiene tu lógica)
    ========================================================== */
   actualizados = registros.length;

    console.log(`✅ Productos sincronizados (${actualizados}/${productos.length})`);

    await new Promise(r => setTimeout(r, 50));

  return await db.productos
  .where("negocio_id")
  .equals(negocioId)
  .toArray();
  } catch (err) {

    console.error("❌ Error sincronizando productos:", err);

    return await db.productos
      .where("negocio_id")
      .equals(negocioId)
      .toArray();
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