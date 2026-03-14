// 💜 SmartPOS - Módulo de Proveedores v1.6 (Tabla Grande + Teléfono Interactivo)
// ----------------------------------------------------------------------
// Multi-negocio REAL + SweetAlert tabla ancho completo
// ----------------------------------------------------------------------

import { supabaseClient, protegerSesion } from "./proteccion.js";

// 🔐 Sesión y rol permitido
const usuario = await protegerSesion(["cajero", "admin"]);
document.addEventListener("DOMContentLoaded", () => lucide.createIcons());

// 🟣 MULTINEGOCIO — negocio del usuario actual
const negocioId = usuario.negocio_id;

// 🧩 Elementos principales
const form = document.getElementById("formProveedor");
const btn = document.getElementById("btnGuardarProveedor");
const estado = document.getElementById("estadoProveedor");

/* -------------------------------------------------------------------------- */
/* 📝 GUARDAR PROVEEDOR                                                       */
/* -------------------------------------------------------------------------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  btn.disabled = true;
  estado.textContent = "Guardando...";

  const payload = {
    nombre: document.getElementById("nombreProveedor").value.trim(),
    telefono: document.getElementById("telefonoProveedor").value.trim(),
    direccion: document.getElementById("direccionProveedor").value.trim(),
    negocio_id: negocioId,
  };

  try {
    // 🔍 Validar duplicado por negocio
    const { data: existe } = await supabaseClient
      .from("proveedores")
      .select("id")
      .eq("nombre", payload.nombre)
      .eq("negocio_id", negocioId)
      .maybeSingle();

    if (existe) {
      await Swal.fire({
        icon: "warning",
        title: "Proveedor duplicado",
        text: `Ya existe un proveedor con el nombre "${payload.nombre}".`,
        customClass: { popup: "card-3d", confirmButton: "btn-3d" },
      });
      return;
    }

    const { error } = await supabaseClient.from("proveedores").insert(payload);
    if (error) throw error;

    await Swal.fire({
      icon: "success",
      title: "Proveedor guardado",
      timer: 1500,
      showConfirmButton: false,
      customClass: { popup: "card-3d" },
    });

    form.reset();
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: err.message,
      customClass: { popup: "card-3d", confirmButton: "btn-3d" },
    });
  } finally {
    btn.disabled = false;
    estado.textContent = "";
  }
});

/* -------------------------------------------------------------------------- */
/* 📋 LISTAR PROVEEDORES (Modal grande y legible)                             */
/* -------------------------------------------------------------------------- */
document.getElementById("btnVerProveedores")?.addEventListener("click", async () => {
  const { data, error } = await supabaseClient
    .from("proveedores")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("nombre", { ascending: true });

  if (error) {
    return Swal.fire({
      icon: "error",
      title: "Error",
      text: error.message,
      customClass: { popup: "card-3d", confirmButton: "btn-3d" },
    });
  }

  if (!data?.length) {
    return Swal.fire({
      icon: "info",
      title: "Sin registros",
      text: "No hay proveedores registrados.",
      customClass: { popup: "card-3d", confirmButton: "btn-3d" },
    });
  }

  // 🔥 FILAS GRANDES Y LEGIBLES
  const rows = data
    .map(
      (p) => `
      <tr class="border-b hover:bg-fuchsia-50 transition">
        <td class="py-3 px-3 font-semibold">${p.nombre}</td>

        <td class="py-3 px-3">
          ${
            p.telefono
              ? `<button class="text-fuchsia-600 underline text-md font-semibold"
                         onclick="accionesTelefono('${p.telefono}')">
                   ${p.telefono}
                 </button>`
              : "-"
          }
        </td>

        <td class="py-3 px-3">${p.direccion || "-"}</td>

        <td class="py-3 px-3 text-center flex items-center justify-center gap-4">
          <button class="text-blue-600 hover:text-blue-800" title="Editar"
            onclick="editarProveedor('${p.id}')">
            <i data-lucide="edit" class="w-5 h-5"></i>
          </button>

          <button class="text-red-600 hover:text-red-800" title="Eliminar"
            onclick="eliminarProveedor('${p.id}')">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
        </td>
      </tr>`
    )
    .join("");

  // 🔥 TABLA ANCHA + tipografía grande
  Swal.fire({
    title: "📦 Proveedores registrados",
    html: `
      <div style="max-height: 60vh; overflow-y: auto;">
        <table class="w-full text-base border-collapse" style="min-width: 850px;">
          <thead class="bg-fuchsia-100 text-fuchsia-700 text-lg">
            <tr>
              <th class="py-2 px-3 text-left">Nombre</th>
              <th class="py-2 px-3 text-left">Teléfono</th>
              <th class="py-2 px-3 text-left">Dirección</th>
              <th class="py-2 px-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="text-gray-800 text-md">
            ${rows}
          </tbody>
        </table>
      </div>
    `,
    showConfirmButton: true,
    confirmButtonText: "Cerrar",
    customClass: { popup: "card-3d" },
    width: "95%",     // 🔥 MODAL BIEN ANCHO
    didOpen: () => lucide.createIcons(),
  });
});

/* -------------------------------------------------------------------------- */
/* ✏️ EDITAR PROVEEDOR                                                        */
/* -------------------------------------------------------------------------- */
window.editarProveedor = async (id) => {
  const { data: prov, error } = await supabaseClient
    .from("proveedores")
    .select("*")
    .eq("id", id)
    .eq("negocio_id", negocioId)
    .single();

  if (error || !prov) {
    return Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo cargar el proveedor.",
      customClass: { popup: "card-3d" },
    });
  }

  const { value: valores } = await Swal.fire({
    title: "Editar proveedor",
    html: `
      <input id="swNombre" class="swal2-input" placeholder="Nombre" value="${prov.nombre || ""}">
      <input id="swTelefono" class="swal2-input" placeholder="Teléfono" value="${prov.telefono || ""}">
      <input id="swDireccion" class="swal2-input" placeholder="Dirección" value="${prov.direccion || ""}">
    `,
    preConfirm: () => ({
      nombre: document.getElementById("swNombre").value.trim(),
      telefono: document.getElementById("swTelefono").value.trim(),
      direccion: document.getElementById("swDireccion").value.trim(),
    }),
    showCancelButton: true,
    confirmButtonText: "Guardar",
    cancelButtonText: "Cancelar",
    customClass: {
      popup: "card-3d",
      confirmButton: "btn-3d",
      cancelButton: "btn-3d",
    },
  });

  if (!valores) return;

  const { error: errUpd } = await supabaseClient
    .from("proveedores")
    .update(valores)
    .eq("id", id)
    .eq("negocio_id", negocioId);

  if (errUpd) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: errUpd.message,
      customClass: { popup: "card-3d", confirmButton: "btn-3d" },
    });
  } else {
    Swal.fire({
      icon: "success",
      title: "Actualizado",
      text: "Proveedor editado correctamente.",
      customClass: { popup: "card-3d" },
    });
    document.getElementById("btnVerProveedores").click();
  }
};

/* -------------------------------------------------------------------------- */
/* 🗑️ ELIMINAR PROVEEDOR                                                     */
/* -------------------------------------------------------------------------- */
window.eliminarProveedor = async (id) => {
  const confirm = await Swal.fire({
    title: "¿Eliminar proveedor?",
    text: "Esta acción no se puede deshacer.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
    customClass: {
      popup: "card-3d",
      confirmButton: "btn-3d bg-red-600 text-white",
      cancelButton: "btn-3d",
    },
  });

  if (!confirm.isConfirmed) return;

  const { error } = await supabaseClient
    .from("proveedores")
    .delete()
    .eq("id", id)
    .eq("negocio_id", negocioId);

  if (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: error.message,
      customClass: { popup: "card-3d", confirmButton: "btn-3d" },
    });
  } else {
    Swal.fire({
      icon: "success",
      title: "Eliminado",
      text: "Proveedor eliminado correctamente.",
      customClass: { popup: "card-3d" },
    });
    document.getElementById("btnVerProveedores").click();
  }
};

/* -------------------------------------------------------------------------- */
/* 📞 TELÉFONO — Llamar / WhatsApp                                           */
/* -------------------------------------------------------------------------- */
window.accionesTelefono = async (telefono) => {
  const { value: accion } = await Swal.fire({
    title: `Contacto`,
    text: `¿Qué deseas hacer con ${telefono}?`,
    showCancelButton: true,
    confirmButtonText: "Llamar",
    cancelButtonText: "WhatsApp",
    reverseButtons: true,
    customClass: {
      popup: "card-3d",
      confirmButton: "btn-3d",
      cancelButton: "btn-3d bg-green-500 text-white",
    },
  });

  if (accion === undefined) return;

  if (accion) {
    window.open(`tel:${telefono}`, "_self");
  } else {
    window.open(`https://wa.me/${telefono}`, "_blank");
  }
};
