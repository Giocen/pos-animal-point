// 💜 SmartPOS - Sistema de Cache Local v1.7 (TTL + Multi-Negocio real)
// -----------------------------------------------------------------------------
// ⚡ Cachea configuraciones, sesión, ventas, y cualquier dato crítico
// 🧠 Namespacing REAL basado en negocio_id
// 🧹 Limpieza automática por expiración
// 🔍 Diagnóstico avanzado
// -----------------------------------------------------------------------------

export const LocalDB = {
  basePrefix: "smartpos_", // prefijo base
  prefix: "smartpos_",     // se actualizará dinámicamente

  /* ------------------------------------------------------------------------ */
  /* 🏪 Actualizar namespace según negocio_id                                 */
  /* ------------------------------------------------------------------------ */
  updateNamespace() {
    try {
      let negocioId = localStorage.getItem("negocio_id");

      // ⚠️ Corrección: evitar namespace "default" si el negocio ya está establecido
      if (!negocioId || negocioId === "null" || negocioId === "undefined" || negocioId.trim() === "") {
        negocioId = "default";
      }

      // 💡 Cache separada por negocio (NO sucursal)
      this.prefix = `${this.basePrefix}${negocioId}_`;
    } catch (e) {
      console.warn("⚠ No se pudo actualizar namespace LocalDB:", e);
      this.prefix = `${this.basePrefix}default_`;
    }
  },

  /* ------------------------------------------------------------------------ */
  /* 🏃 DESACTIVADO: No ejecutar al cargar el archivo                          */
  /* ------------------------------------------------------------------------ */
  // init() {
  //   this.updateNamespace();
  // },

  /* ------------------------------------------------------------------------ */
  /* 💾 Guardar valor con TTL (minutos)                                        */
  /* ------------------------------------------------------------------------ */
  set(key, data, ttlMin = null) {
    this.updateNamespace();

    try {
      const record = { value: data };

      if (ttlMin) {
        record.exp = Date.now() + ttlMin * 60 * 1000;
      }

      localStorage.setItem(this.prefix + key, JSON.stringify(record));
      return true;
    } catch (err) {
      console.error(`❌ LocalDB.set(${key}) falló:`, err);
      return false;
    }
  },

  /* ------------------------------------------------------------------------ */
  /* 📦 Obtener valor (si expiró → se elimina automáticamente)                 */
  /* ------------------------------------------------------------------------ */
  get(key, fallback = null) {
    this.updateNamespace();

    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (!raw) return fallback;

      const record = JSON.parse(raw);

      if (record?.exp && Date.now() > record.exp) {
        localStorage.removeItem(this.prefix + key);
        console.warn(`⏰ Cache expirada: ${key}`);
        return fallback;
      }

      return record?.value ?? fallback;
    } catch (err) {
      console.error(`❌ LocalDB.get(${key}) corrupto, limpiando...`, err);
      localStorage.removeItem(this.prefix + key);
      return fallback;
    }
  },

  /* ------------------------------------------------------------------------ */
  /* 🔍 Validar si existe y no expiró                                          */
  /* ------------------------------------------------------------------------ */
  has(key) {
    this.updateNamespace();
    const raw = localStorage.getItem(this.prefix + key);
    if (!raw) return false;

    try {
      const record = JSON.parse(raw);

      if (record?.exp && Date.now() > record.exp) {
        localStorage.removeItem(this.prefix + key);
        return false;
      }

      return true;
    } catch {
      localStorage.removeItem(this.prefix + key);
      return false;
    }
  },

  /* ------------------------------------------------------------------------ */
  /* 🗑️ Borrar clave específica                                                */
  /* ------------------------------------------------------------------------ */
  remove(key) {
    this.updateNamespace();
    localStorage.removeItem(this.prefix + key);
  },

  /* ------------------------------------------------------------------------ */
  /* 🧽 Limpiar TODO lo del negocio actual                                     */
  /* ------------------------------------------------------------------------ */
  clearAll() {
    this.updateNamespace();
    const removed = [];

    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(this.prefix)) {
        localStorage.removeItem(k);
        removed.push(k);
      }
    }

    console.log(`🧼 Cache SmartPOS limpiada (${removed.length} claves).`);
    return removed.length;
  },

  /* ------------------------------------------------------------------------ */
  /* 🩺 Diagnóstico completo del namespace actual                             */
  /* ------------------------------------------------------------------------ */
  debug() {
    this.updateNamespace();

    const items = Object.keys(localStorage)
      .filter((k) => k.startsWith(this.prefix))
      .map((k) => {
        try {
          const obj = JSON.parse(localStorage.getItem(k) || "{}");
          return {
            clave: k.replace(this.prefix, ""),
            expira: obj.exp ? new Date(obj.exp).toLocaleString() : "∞",
            tamaño: (localStorage.getItem(k)?.length || 0) + " bytes",
            valor: obj.value,
          };
        } catch {
          return { clave: k.replace(this.prefix, ""), valor: "❌ corrupto" };
        }
      });

    console.table(items);
    return items;
  },

  /* ------------------------------------------------------------------------ */
  /* 📋 Obtener todas las claves y valores                                     */
  /* ------------------------------------------------------------------------ */
  getAll() {
    this.updateNamespace();

    const all = {};
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(this.prefix)) {
        const key = k.replace(this.prefix, "");
        all[key] = this.get(key);
      }
    }
    return all;
  },
};

// ⛔ QUITADO: LocalDB.init();  (este causaba namespace default prematuro)
