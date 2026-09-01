// Cloudflare Worker: firma de integridad para el Widget de Wompi.
//
// Wompi exige que la "firma de integridad" de cada pago se calcule en un servidor,
// nunca en el navegador, porque requiere tu Secreto de Integración (una clave
// que NUNCA debe aparecer en el código del sitio web).
//
// Este archivo es el código completo de ese pequeño servidor. No necesitas saber
// programar para usarlo: solo cópialo y pégalo en Cloudflare, siguiendo la guía.
//
// --- CÓMO DESPLEGARLO (una sola vez, gratis) ---
// 1. Entra a https://workers.cloudflare.com y crea una cuenta gratis (no pide tarjeta).
// 2. En el panel, click en "Create" > "Create Worker". Ponle un nombre, por ejemplo
//    "wompi-firma", y despliega la plantilla por defecto.
// 3. Click en "Edit code" (o "Quick edit") y BORRA todo el código de la plantilla.
//    Pega en su lugar TODO el contenido de este archivo.
// 4. Antes de guardar, ve a la pestaña "Settings" > "Variables and Secrets" de tu
//    Worker y agrega una variable secreta:
//      - Nombre:  WOMPI_INTEGRITY_SECRET
//      - Valor:   el "Secreto de integridad" que Wompi te muestra en
//                 comercios.wompi.co > Desarrolladores > Secretos para
//                 integración técnica (NO es la llave pública ni la privada,
//                 es una tercera clave aparte).
//    Guárdalo como "Secret" (encriptado), no como texto plano.
// 5. Guarda y despliega ("Save and deploy"). Cloudflare te da una URL como:
//      https://wompi-firma.tu-usuario.workers.dev
// 6. Copia esa URL y reemplázala en index.html, en la línea:
//      const WOMPI_SIGNATURE_URL = "REEMPLAZAR_CON_TU_URL_DE_WORKER";
//    En este mismo repo. El botón "Tarjeta / PSE / Nequi en línea" se activa
//    solo apenas esa línea empiece con "http".
//
// IMPORTANTE: el secreto de integridad NUNCA se lo mandes a nadie (ni a mí, ni
// lo pegues en index.html). Solo debe vivir dentro de este Worker.

export default {
  async fetch(request, env) {
    // Responder a la verificación CORS que hace el navegador antes del POST real.
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return json({ error: "Método no permitido" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }

    const { reference, amountInCents, currency } = body || {};
    if (!reference || !amountInCents || !currency) {
      return json({ error: "Faltan datos (reference, amountInCents, currency)" }, 400);
    }

    const secret = env.WOMPI_INTEGRITY_SECRET;
    if (!secret) {
      return json({ error: "Falta configurar WOMPI_INTEGRITY_SECRET en el Worker" }, 500);
    }

    const raw = `${reference}${amountInCents}${currency}${secret}`;
    const signature = await sha256Hex(raw);

    return json({ signature });
  }
};

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}
