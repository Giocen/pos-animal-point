/* ============================================================
   ⭐ OPTIMIZAR IMAGENES SmartPOS (2025)
   Convierte a WEBP + Reduce tamaño + Comprime
============================================================ */

export async function optimizarImagen(file) {
  return new Promise((resolve, reject) => {

    if (!file || !file.type?.startsWith("image/")) {
      return reject(new Error("Archivo no válido"));
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Error leyendo imagen"));
    reader.onload = (e) => (img.src = e.target.result);

    img.onerror = () => reject(new Error("Imagen dañada"));

    img.onload = () => {
      const MAX = 1280;
      let { width, height } = img;

      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width *= ratio;
        height *= ratio;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size === 0) {
            return reject(new Error("Imagen vacía"));
          }

          resolve(
            new File([blob], `img_${Date.now()}.webp`, {
              type: "image/webp",
            })
          );
        },
        "image/webp",
        0.75
      );
    };

    reader.readAsDataURL(file);
  });
}
