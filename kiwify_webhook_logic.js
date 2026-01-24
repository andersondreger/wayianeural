
/**
 * EXEMPLO DE WEBHOOK PARA KIWIFY (Node.js / Supabase Edge Function)
 * Configure esta URL no painel da Kiwify (Apps -> Webhooks)
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use a service role para ignorar RLS
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = req.body;

  // Kiwify envia 'order_status' como 'paid' quando o PIX ou Cartão é aprovado
  if (body.order_status === 'paid' || body.order_status === 'approved') {
    const email = body.Customer.email;
    
    console.log(`Pagamento aprovado para: ${email}`);

    // Atualiza o status no banco de dados
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_status: 'ACTIVE' })
      .eq('email', email);

    if (error) {
      console.error('Erro ao ativar perfil:', error);
      return res.status(500).json({ error: 'Erro interno' });
    }

    return res.status(200).json({ status: 'Ativado com sucesso' });
  }

  return res.status(200).json({ status: 'Evento ignorado' });
}
