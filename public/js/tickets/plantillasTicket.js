// ✅ Archivo: /public/js/tickets/plantillasTicket.js
// 💜 SmartPOS - Colección de Plantillas de Ticket predefinidas
// ------------------------------------------------------------
// Cada plantilla define estilo, íconos, separadores y mensaje final
// para personalizar la apariencia de los tickets generados (PDF o impresión).
// Estas opciones se cargan dinámicamente en el panel de configuración de diseño.

export const plantillasTicket = [
  {
    id: "clasico",
    nombre: "💜 Clásico Agradecido",
    descripcion: "Estilo universal con íconos simples y mensaje amistoso.",
    separador: "·······················",
    mensaje: "🙌 ¡Gracias por su compra! 😊",
    encabezado: {
      direccion: "📍",
      telefono: "📞",
      correo: "✉️",
      rfc: "🧾",
    },
  },
  {
    id: "minimalista",
    nombre: "⚪ Minimalista",
    descripcion: "Diseño limpio y neutro.",
    separador: "------------------------",
    mensaje: "¡Gracias por su preferencia!",
    encabezado: {
      direccion: "",
      telefono: "",
      correo: "",
      rfc: "",
    },
  },
  {
    id: "comercial",
    nombre: "🛍️ Comercial",
    descripcion: "Ideal para tiendas o negocios alegres.",
    separador: "✦✦✦✦✦✦✦✦✦✦✦✦",
    mensaje: "🛍️ ¡Agradecemos su preferencia! 🙌",
    encabezado: {
      direccion: "📍",
      telefono: "📞",
      correo: "📧",
      rfc: "💼",
    },
  },
  {
    id: "premium",
    nombre: "🌟 Premium",
    descripcion: "Perfecto para cafés o boutiques elegantes.",
    separador: "⸺⸺⸺⸺⸺⸺⸺⸺",
    mensaje: "🌟 ¡Esperamos verle pronto nuevamente!",
    encabezado: {
      direccion: "🏠",
      telefono: "📲",
      correo: "💌",
      rfc: "🧾",
    },
  },
  {
    id: "mascotas",
    nombre: "🐾 Mascotas",
    descripcion: "Diseño especial para veterinarias y pet shops.",
    separador: "🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾",
    mensaje: "🐶 ¡Gracias por consentir a tu peludito con nosotros! 💜",
    encabezado: {
      direccion: "📍",
      telefono: "📞",
      correo: "✉️",
      rfc: "🐾",
    },
  },
  {
    id: "tecnico",
    nombre: "⚙️ Taller / Servicios",
    descripcion: "Ideal para talleres o reparaciones técnicas.",
    separador: "══════════════════",
    mensaje: "⚙️ ¡Gracias por confiar en nosotros!",
    encabezado: {
      direccion: "📍",
      telefono: "📞",
      correo: "📧",
      rfc: "🧾",
    },
  },
];
