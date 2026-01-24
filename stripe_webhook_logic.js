
// Implementação para Supabase Edge Function (Deno)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@11.1.0"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
})

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  try {
    const body = await req.text()
    // Verifica se a requisição veio mesmo do Stripe
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
    )

    // Evento disparado quando o checkout é concluído (PIX pago ou Cartão aprovado)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const email = session.customer_details.email
      const stripeCustomerId = session.customer

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      )

      console.log(`Ativando licença para: ${email}`)

      // 1. Atualiza o perfil para ACTIVE
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          subscription_status: 'ACTIVE',
          stripe_customer_id: stripeCustomerId 
        })
        .eq('email', email)

      if (profileError) throw profileError

      // 2. Opcional: Registrar log de pagamento
      console.log(`Licença Neural ativada com sucesso para ${email}`)
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' } 
    })
  } catch (err) {
    console.error(`Erro Webhook: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
