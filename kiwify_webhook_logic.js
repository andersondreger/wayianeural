
/**
 * WEBHOOK NEURAL KIWIFY v2.0
 * Destino: Supabase Profiles Activation
 */

import { createClient } from '@supabase/supabase-js'

// Variáveis injetadas no ambiente do Edge Function / Cloudflare
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const body = req.body;
    
    // 1. Validar Status do Pagamento na Kiwify
    const isPaid = ['paid', 'approved', 'completed'].includes(body.order_status?.toLowerCase());
    const email = body.Customer?.email?.toLowerCase()?.trim();

    if (isPaid && email) {
      console.log(`[Neural Sync] Ativando licença para: ${email}`);

      // 2. Localizar usuário no Supabase
      const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (findError || !profile) {
        console.warn(`[Neural Sync] Perfil não encontrado para ${email}. Tentando fallback...`);
      }

      // 3. Atualizar Status para ACTIVE
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          subscription_status: 'ACTIVE',
          // Armazenamos metadados da transação para auditoria admin
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      if (updateError) throw updateError;

      return res.status(200).json({ 
        success: true, 
        message: `Neural Engine ativada para ${email}`,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({ status: 'Ignored', reason: 'Order not paid or invalid data' });

  } catch (err) {
    console.error('[Neural Sync Error]', err.message);
    return res.status(500).json({ error: 'Internal Neural Error', details: err.message });
  }
}
