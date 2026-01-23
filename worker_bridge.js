
/**
 * Cloudflare Worker: WayFlow Neural Bridge
 * Destino: Evolution API Webhooks -> n8n Neural Flow
 */

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const evolutionData = await request.json();

      // 1. Filtrar apenas mensagens recebidas (evitar loops)
      if (evolutionData.event !== "messages.upsert" || evolutionData.data.key.fromMe) {
        return new Response("Ignored event", { status: 200 });
      }

      // 2. Extrair dados básicos
      const payload = {
        message_id: evolutionData.data.key.id,
        phone: evolutionData.data.key.remoteJid.split("@")[0],
        message_text: evolutionData.data.message?.conversation || evolutionData.data.message?.extendedTextMessage?.text || "",
        instance: evolutionData.instance,
        timestamp: Date.now(),
        source: "WAYFLOW_NEURAL_BRIDGE_V3"
      };

      // 3. Encaminhar para o n8n do usuário (URL salva no Supabase ou Env)
      const N8N_URL = env.N8N_WEBHOOK_URL; 
      
      const response = await fetch(N8N_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      return new Response("Forwarded to n8n", { status: response.status });

    } catch (err) {
      return new Response("Internal Error: " + err.message, { status: 500 });
    }
  }
};
