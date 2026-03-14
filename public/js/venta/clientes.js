// ===============================================================
// 💜 SmartPOS - CLIENTES (Versión Panel + Lógica Completa)
// ===============================================================

import { supabaseClient, protegerSesion } from "../proteccion.js";
import { LocalDB } from "../localdb.js";

await protegerSesion(["cajero", "admin"]);

// 🟣 MULTI-NEGOCIO (CORREGIDO)
const negocio_id = localStorage.getItem("negocio_id");

// Validación obligatoria
if (!negocio_id) {
  console.error("❌ No existe negocio_id en LocalStorage. Módulo clientes no puede funcionar.");
}

// ======================================================================
// 🟣 1. DUMMY requerido por main.js
// ======================================================================
export function configurarClientes() {
  console.log("configurarClientes() cargado (dummy para main.js)");
}

// ======================================================================
// 🟣 2. Estado global
// ======================================================================
export let clienteSeleccionado = null;

// ======================================================================
// 🟣 3. SweetAlert 3D
// ======================================================================
function showSwal3D(options) {
  return Swal.fire({
    customClass: {
      popup: "card-3d",
      confirmButton: "btn-3d",
      cancelButton: "btn-3d",
    },
    ...options,
  });
}

// ======================================================================
// 🟣 4. BUSCAR CLIENTE POR TELÉFONO
// ======================================================================
export async function buscarClientePorTelefono() {
  const { value: telefono } = await showSwal3D({
    title: `
      <div class="flex items-center gap-2 justify-center">
        <i data-lucide="phone" class="w-6 h-6 text-fuchsia-600"></i>
        <span class="font-bold text-fuchsia-700">Buscar Cliente</span>
      </div>
    `,
    input: "text",
    inputLabel: "Número de teléfono",
    inputPlaceholder: "Ej. 9991234567",
    showCancelButton: true,
    confirmButtonText: "Buscar",
    cancelButtonText: "Cancelar",
    inputValidator: (value) => (!value ? "El teléfono es obligatorio" : null),
    didOpen: () => lucide.createIcons(),
  });

  if (!telefono) return;

  // Buscar solo dentro del negocio actual
  const { data: cliente, error } = await supabaseClient
    .from("clientes")
    .select("id, nombre, telefono, correo, direccion")
    .eq("telefono", telefono)
    .eq("negocio_id", negocio_id)
    .maybeSingle();

  if (error) {
    console.error("❌ Error buscando cliente:", error);
    return showSwal3D({
      icon: "error",
      title: "Error",
      text: "No se pudo buscar el cliente",
    });
  }

  if (cliente) {
    clienteSeleccionado = cliente;
    await mostrarClienteEditable(cliente);
  } else {
    registrarCliente(telefono);
  }
}

// ======================================================================
// 🟣 5. BASE DE MOSTRAR CLIENTE + EDITAR
// ======================================================================
async function mostrarClienteEditableBase(cliente) {
  const direccion = cliente.direccion || "-";

  const { isConfirmed } = await showSwal3D({
    icon: "success",
    title: `
      <div class="flex items-center gap-2 justify-center">
        <i data-lucide="user-check" class="w-6 h-6 text-emerald-600"></i>
        <span class="text-emerald-700 font-bold text-lg">Cliente encontrado</span>
      </div>
    `,
    html: `
      <div class="bg-gray-50 p-4 rounded-lg text-left text-base space-y-2 border border-emerald-200">
        <p><b>👤 Nombre:</b> ${cliente.nombre || "-"}</p>
        <p><b>📞 Teléfono:</b> ${cliente.telefono || "-"}</p>
        <p><b>✉️ Correo:</b> ${cliente.correo || "-"}</p>
        <p><b>🏠 Dirección:</b> ${
          direccion !== "-"
            ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                direccion
              )}" target="_blank" class="text-blue-600 underline hover:text-blue-800">${direccion}</a>`
            : "-"
        }</p>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Editar",
    cancelButtonText: "Cerrar",
    didOpen: () => lucide.createIcons(),
  });

  if (!isConfirmed) return;

  // EDITAR
  const { value: formValues } = await showSwal3D({
    title: `
      <div class="flex items-center gap-2 justify-center">
        <i data-lucide="edit-3" class="w-6 h-6 text-blue-600"></i>
        <span class="text-blue-700 font-bold text-lg">Editar Cliente</span>
      </div>
    `,
    html: `
      <input id="swalNombre" class="swal2-input" placeholder="Nombre" value="${cliente.nombre}">
      <input id="swalCorreo" type="email" class="swal2-input" placeholder="Correo" value="${cliente.correo}">
      <input id="swalDireccion" class="swal2-input" placeholder="Dirección" value="${cliente.direccion}">
    `,
    showCancelButton: true,
    confirmButtonText: "Guardar cambios",
    cancelButtonText: "Cancelar",
    preConfirm: () => {
      const nombre = document.getElementById("swalNombre").value.trim();
      const correo = document.getElementById("swalCorreo").value.trim();
      const direccion = document.getElementById("swalDireccion").value.trim();

      if (!nombre) {
        Swal.showValidationMessage("El nombre es obligatorio");
        return false;
      }
      return { nombre, correo, direccion };
    },
    didOpen: () => lucide.createIcons(),
  });

  if (!formValues) return;

  // ACTUALIZAR
  const { data: actualizado, error } = await supabaseClient
    .from("clientes")
    .update(formValues)
    .eq("id", cliente.id)
    .eq("negocio_id", negocio_id)
    .select()
    .single();

  if (error) {
    console.error(error);
    return showSwal3D({
      icon: "error",
      title: "Error",
      text: "No se pudo actualizar el cliente",
    });
  }

  clienteSeleccionado = actualizado;
  return actualizado;
}

// ======================================================================
// 🟣 6. WRAPPER COMPLETO (NO SOBREESCRIBE LA FUNCIÓN ERRÓNEAMENTE)
// ======================================================================
async function mostrarClienteEditable(cliente) {
  const actualizado = await mostrarClienteEditableBase(cliente);
  actualizarCamposCliente(actualizado || cliente);
}

// ======================================================================
// 🟣 7. REGISTRAR CLIENTE NUEVO
// ======================================================================
async function registrarCliente(telefonoInicial = "") {
  const { value: formValues } = await showSwal3D({
    title: `
      <div class="flex items-center gap-2 justify-center">
        <i data-lucide="user-plus" class="w-6 h-6 text-fuchsia-600"></i>
        <span class="text-fuchsia-700 font-bold text-lg">Registrar Cliente</span>
      </div>
    `,
    html: `
      <input id="swalTelefono" class="swal2-input" placeholder="Teléfono" value="${telefonoInicial}">
      <input id="swalNombre" class="swal2-input" placeholder="Nombre completo">
      <input id="swalCorreo" class="swal2-input" placeholder="Correo">
      <input id="swalDireccion" class="swal2-input" placeholder="Dirección">
    `,
    showCancelButton: true,
    confirmButtonText: "Guardar",
    cancelButtonText: "Cancelar",
    preConfirm: () => {
      const telefono = document.getElementById("swalTelefono").value.trim();
      const nombre = document.getElementById("swalNombre").value.trim();
      const correo = document.getElementById("swalCorreo").value.trim();
      const direccion = document.getElementById("swalDireccion").value.trim();

      if (!telefono) return Swal.showValidationMessage("El teléfono es obligatorio");
      if (!nombre) return Swal.showValidationMessage("El nombre es obligatorio");

      return { telefono, nombre, correo, direccion };
    },
    didOpen: () => lucide.createIcons(),
  });

  if (!formValues) return;

  // EXISTE YA?
  const { data: existente } = await supabaseClient
    .from("clientes")
    .select("id, nombre")
    .eq("telefono", formValues.telefono)
    .eq("negocio_id", negocio_id)
    .maybeSingle();

  if (existente) {
    clienteSeleccionado = existente;
    return showSwal3D({
      icon: "info",
      title: "Cliente ya registrado",
      text: `Seleccionado: ${existente.nombre}`,
    });
  }

  // CREAR NUEVO
  const { data: nuevoCliente, error } = await supabaseClient
    .from("clientes")
    .insert([{ ...formValues, negocio_id }])
    .select()
    .single();

  if (error) {
    console.error(error);
    return showSwal3D({
      icon: "error",
      title: "Error",
      text: "No se pudo registrar el cliente",
    });
  }

  clienteSeleccionado = nuevoCliente;
  actualizarCamposCliente(nuevoCliente);
}

// ======================================================================
// 🟣 8. ACTUALIZAR CAMPOS DEL PANEL
// ======================================================================
function actualizarCamposCliente(cliente) {
  const tel = document.getElementById("inputTelefonoCliente");
  const nom = document.getElementById("inputNombreCliente");
  const cor = document.getElementById("inputCorreoCliente");
  const dir = document.getElementById("inputDireccionCliente");

  if (!tel || !nom || !cor || !dir) return;

  tel.value = cliente?.telefono || "";
  nom.value = cliente?.nombre || "";
  cor.value = cliente?.correo || "";
  dir.value = cliente?.direccion || "";
}

// ======================================================================
// 🟣 9. Limpiar si borran teléfono
// ======================================================================
const inputTelefono = document.getElementById("inputTelefonoCliente");
if (inputTelefono) {
  inputTelefono.addEventListener("input", (e) => {
    if (!e.target.value.trim()) {
      actualizarCamposCliente(null);
      clienteSeleccionado = null;
    }
  });
}

// ======================================================================
// 🟣 10. HUB ENTRYPOINT (PARA CLIENTE-HUB)
// ======================================================================
export async function abrirClientes() {
  // reutilizamos tu flujo existente
  await buscarClientePorTelefono();
}

