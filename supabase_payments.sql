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

CREATE POLICY "Catalog is public" ON public.pay_products FOR SELECT USING (active);
CREATE POLICY "Users read own subscriptions" ON public.pay_subscriptions
    FOR SELECT USING (lower(email) = lower(auth.jwt() ->> 'email'));
-- pay_events: sem policy = so service_role le/escreve.

-- Precos PROPOSTOS (pesquisa de mercado BR + docs internos). Anderson ajusta pelo admin.
INSERT INTO public.pay_products (slug, name, description, price_cents, app_url, sort) VALUES
  ('pet360',  'Pet360',          'Gestao de pet shop: agenda preditiva, fidelizacao via WhatsApp e estoque.',      14900, 'https://pet360.wayia.com.br/',   1),
  ('imob360', 'ImobiVision 360', 'CRM imobiliario com atendimento e qualificacao de leads 24/7.',                    24900, 'https://imob360.wayia.com.br/',  2),
  ('bela360', 'Bela360',         'WhatsApp do salao no automatico: confirma, lembra e reativa clientes.',            9900, 'https://bela360.wayia.com.br/',  3),
  ('wayar',   'WayAR',           'Realidade Aumentada no navegador, por QR code, sem app.',                         12900, 'https://wayar.wayia.com.br/',    4),
  ('criar',   'WayIA Criar',     'Identidade visual e sites por chat (com sua API Key OpenAI/Anthropic).',           7900, 'https://criar.wayia.com.br/',    5),
  ('neural',  'WayFlow Neural',  'Hub de marketing: WhatsApp, CRM, agentes de IA e automacoes.',                    19700, 'https://wayia.com.br/app/',      6)
ON CONFLICT (slug) DO NOTHING;
