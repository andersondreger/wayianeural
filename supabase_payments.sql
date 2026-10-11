-- Pagamentos do ecossistema WayIA (admin de pagamentos).
-- Rodar no SQL Editor do Supabase. Tudo e escrito so pelo servico payments-api
-- (service_role, ignora RLS); o navegador so le o catalogo e os proprios dados.

-- 1. Catalogo: um item por projeto (on-demand, cada cliente contrata so o que quer)
CREATE TABLE IF NOT EXISTS public.pay_products (
    slug TEXT PRIMARY KEY,                       -- pet360, imob360, bela360, wayar, criar, neural
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL CHECK (price_cents > 0),
    cycle TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (cycle IN ('MONTHLY', 'YEARLY')),
    app_url TEXT NOT NULL,                       -- para onde o cliente vai depois de pagar
    checkout_url TEXT,                           -- se preenchido, o projeto cobra pela PROPRIA pagina (Asaas dele): o portal so leva o cliente la, sem criar 2a assinatura
    active BOOLEAN NOT NULL DEFAULT true,
    sort INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Assinaturas por cliente e projeto = o "entitlement" que os outros projetos consultam
CREATE TABLE IF NOT EXISTS public.pay_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    product_slug TEXT NOT NULL REFERENCES public.pay_products(slug),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED')),
    billing_type TEXT,                           -- PIX | CREDIT_CARD | BOLETO | UNDEFINED
    asaas_customer_id TEXT,
    asaas_subscription_id TEXT UNIQUE,
    invoice_url TEXT,
    price_cents INTEGER NOT NULL,                -- preco travado no momento da contratacao
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (email, product_slug)
);

-- Vinculo da assinatura a UM negocio do projeto (ex.: 'pet360:<businessId>'): impede que outro
-- cadastro use o mesmo e-mail para ganhar acesso. Liberar so pelo admin.
ALTER TABLE public.pay_subscriptions ADD COLUMN IF NOT EXISTS claimed_ref TEXT;

-- 3. Log de eventos do gateway (auditoria + idempotencia do webhook)
CREATE TABLE IF NOT EXISTS public.pay_events (
    id TEXT PRIMARY KEY,                         -- id do evento Asaas
    event TEXT NOT NULL,
    asaas_subscription_id TEXT,
    amount_cents INTEGER,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pay_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Catalog is public" ON public.pay_products;
CREATE POLICY "Catalog is public" ON public.pay_products FOR SELECT USING (active);
DROP POLICY IF EXISTS "Users read own subscriptions" ON public.pay_subscriptions;
CREATE POLICY "Users read own subscriptions" ON public.pay_subscriptions
    FOR SELECT USING (lower(email) = lower(auth.jwt() ->> 'email'));
-- pay_events: sem policy = so service_role le/escreve.

-- Precos PROPOSTOS (pesquisa de mercado BR + docs internos). Anderson ajusta pelo admin.
INSERT INTO public.pay_products (slug, name, description, price_cents, app_url, sort) VALUES
  ('pet360',  'Pet360',          'Gestao de pet shop: agenda preditiva, fidelizacao via WhatsApp e estoque.',      14900, 'https://pet360.wayia.com.br/',   1),
  ('imob360', 'ImobiVision 360', 'CRM imobiliario com atendimento e qualificacao de leads 24/7.',                    24900, 'https://imob360.wayia.com.br/',  2),
  ('bela360', 'Bela360',         'WhatsApp do salao no automatico: confirma, lembra e reativa clientes.',            9700, 'https://bela360.wayia.com.br/',  3),
  ('wayar',   'WayAR',           'Realidade Aumentada no navegador, por QR code, sem app. Planos de R$97 a R$897.',   9700, 'https://wayar.wayia.com.br/',    4),
  ('criar',   'WayIA Criar',     'Identidade visual e sites por chat (com sua API Key OpenAI/Anthropic).',           7900, 'https://criar.wayia.com.br/',    5),
  ('neural',  'WayFlow Neural',  'Hub de marketing: WhatsApp, CRM, agentes de IA e automacoes.',                    19700, 'https://wayia.com.br/app/',      6)
ON CONFLICT (slug) DO NOTHING;

-- Bela360 e WayAR ja tem cobranca propria no Asaas (precos reais: Bela360 R$97; WayAR 97/297/897).
-- O portal so redireciona para a pagina de assinatura deles.
UPDATE public.pay_products SET checkout_url = 'https://bela360.wayia.com.br/assinatura' WHERE slug = 'bela360';
UPDATE public.pay_products SET checkout_url = 'https://wayar.wayia.com.br/dashboard/billing' WHERE slug = 'wayar';

-- ============================================================================
-- Projetos com cobranca PROPRIA que reportam ao painel (criar). RODAR ANTES de subir o payments-api novo:
-- o webhook central passa a filtrar por managed_by.
-- ============================================================================
-- price_cents e o valor cobrado por CICLO; o MRR divide o anual por 12.
ALTER TABLE public.pay_subscriptions ADD COLUMN IF NOT EXISTS cycle TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (cycle IN ('MONTHLY', 'YEARLY'));
-- central = criada/atualizada pelo payments-api; external = reportada pelo projeto via /ingest/subscription.
ALTER TABLE public.pay_subscriptions ADD COLUMN IF NOT EXISTS managed_by TEXT NOT NULL DEFAULT 'central' CHECK (managed_by IN ('central', 'external'));

-- WayIA Criar cobra pelo proprio checkout (Asaas): mensal R$ 89,90 / anual R$ 899,00 com 11 dias gratis.
UPDATE public.pay_products SET price_cents = 8990, checkout_url = 'https://criar.wayia.com.br/conta' WHERE slug = 'criar';

-- Suporte: tickets abertos pelos clientes dos projetos (chegam por /ingest/ticket).
CREATE TABLE IF NOT EXISTS public.pay_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_ref TEXT NOT NULL UNIQUE,             -- '<projeto>:<id do ticket no projeto>' (idempotencia)
    product_slug TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
    reply TEXT,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pay_tickets_status ON public.pay_tickets(status, created_at DESC);
ALTER TABLE public.pay_tickets ENABLE ROW LEVEL SECURITY;   -- sem policy: so service_role

-- Suporte por WhatsApp (Evolution): telefone e consentimento do cliente por chamado.
ALTER TABLE public.pay_tickets ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.pay_tickets ADD COLUMN IF NOT EXISTS whatsapp_optin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.pay_tickets ADD COLUMN IF NOT EXISTS wa_reply_status TEXT;   -- sent | failed | null

-- ============================================================================
-- Gratis / teste de 11 dias por produto / waySend. RODAR ANTES de subir o payments-api novo
-- (sem isso o /entitlement cai no comportamento antigo: sem teste e sem produto gratis).
-- ============================================================================
ALTER TABLE public.pay_products ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'paid' CHECK (tier IN ('free', 'paid'));
ALTER TABLE public.pay_products ADD COLUMN IF NOT EXISTS trial_days INTEGER NOT NULL DEFAULT 11 CHECK (trial_days >= 0);
ALTER TABLE public.pay_subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE public.pay_subscriptions DROP CONSTRAINT IF EXISTS pay_subscriptions_status_check;
ALTER TABLE public.pay_subscriptions ADD CONSTRAINT pay_subscriptions_status_check
  CHECK (status IN ('TRIAL', 'PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED'));

-- Projetos gratuitos (definidos pelo Anderson): WayAR e Neural. O 3o ainda esta em aberto: UPDATE ... SET tier='free'.
UPDATE public.pay_products SET tier = 'free' WHERE slug IN ('wayar', 'neural');

-- waySend entra como projeto pago. Preco PROPOSTO (ajustar no admin).
INSERT INTO public.pay_products (slug, name, description, price_cents, app_url, sort) VALUES
  ('waysend', 'WaySend', 'Disparos e campanhas de WhatsApp com opt-in, limites e relatorios.', 9700, 'https://send.wayia.com.br/', 7)
ON CONFLICT (slug) DO NOTHING;
