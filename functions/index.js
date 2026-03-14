/**
 * 💜 SmartPOS | Proxy simulado de precios externos
 * --------------------------------------------
 * - Sin conexión a Mercado Libre
 * - Devuelve precios estimados en distintas tiendas
 * - Totalmente libre de errores y rápido
 */

const functions = require("firebase-functions/v2/https");

exports.proxyMercadoLibre = functions.onRequest((req, res) => {
  // 🌍 CORS universal
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const q = req.query.q || "Producto";
  const base = Math.floor(100 + Math.random() * 400); // 💰 Precio base aleatorio

  const tiendas = [
    { nombre: "Mercado Libre", precio: base, color: "text-yellow-600", link: "https://www.mercadolibre.com.mx" },
    { nombre: "Amazon", precio: base * 1.05, color: "text-orange-500", link: "https://www.amazon.com.mx" },
    { nombre: "Walmart", precio: base * 0.98, color: "text-blue-600", link: "https://www.walmart.com.mx" },
    { nombre: "Chedraui", precio: base * 0.97, color: "text-emerald-600", link: "https://www.chedraui.com.mx" },
    { nombre: "Bodega Aurrerá", precio: base * 0.96, color: "text-green-700", link: "https://www.bodegaaurrera.com.mx" },
    { nombre: "Liverpool", precio: base * 1.08, color: "text-pink-600", link: "https://www.liverpool.com.mx" },
  ];

  res.status(200).json({
    producto: q,
    fecha: new Date().toISOString(),
    precios: tiendas,
  });
});