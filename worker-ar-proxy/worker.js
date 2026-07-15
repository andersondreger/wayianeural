/**
 * Cloudflare Worker: WayAR AR Proxy
 * Guarda WAYAR_API_KEY como secret e repassa chamadas do dashboard estatico
 * do wayianeural para a API publica do WayAR, sem nunca expor a chave no
 * navegador. Mesmo espirito do worker_bridge.js (WayFlow Neural Bridge) ja
 * usado neste ecossistema: um Worker pequeno, um proposito.
 */

const WAYAR_BASE_URL = "https://wayar.wayia.com.br";

const ALLOWED_ORIGINS = [
  "https://wayia.com.br",
  "https://wayianeural.pages.dev",
  "http://localhost:3000",
];

function corsHeaders(origin) {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin");
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Espera /experiences ou /experiences/<id>
    const match = url.pathname.match(/^\/experiences(?:\/([^/]+))?$/);
    if (!match) {
      return jsonResponse({ error: "not_found" }, 404, origin);
    }
    const id = match[1];

    if (!env.WAYAR_API_KEY) {
      return jsonResponse({ error: "proxy_misconfigured" }, 500, origin);
    }

    const targetPath = id ? `/api/v1/experiences/${id}` : "/api/v1/experiences";
    const targetUrl = `${WAYAR_BASE_URL}${targetPath}`;

    const init = {
      method: request.method,
      headers: {
        Authorization: `Bearer ${env.WAYAR_API_KEY}`,
        "Content-Type": "application/json",
      },
    };
    if (request.method === "POST") {
      init.body = await request.text();
    }

    const upstream = await fetch(targetUrl, init);
    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  },
};
