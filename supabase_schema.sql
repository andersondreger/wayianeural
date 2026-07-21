
-- Extensão necessária para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Perfis (Extensão do auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    subscription_status TEXT DEFAULT 'TRIALING' CHECK (subscription_status IN ('ACTIVE', 'TRIALING', 'EXPIRED', 'INACTIVE')),
    stripe_customer_id TEXT,
    trial_end TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '15 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Trigger para criar perfil automaticamente no SignUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, subscription_status)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.email, 
    new.raw_user_meta_data->>'phone',
    COALESCE(new.raw_user_meta_data->>'subscription_status', 'TRIALING')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Atualizar tabelas existentes para usar perfis
ALTER TABLE agentes_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos_crm ENABLE ROW LEVEL SECURITY;

-- 4. Leads capturados no formulário interativo (Quiz de Negócio da Landing Page)
CREATE TABLE IF NOT EXISTS public.quiz_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name TEXT NOT NULL,
    segment TEXT NOT NULL,
    goals TEXT[] DEFAULT '{}',
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL CHECK (contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    contact_phone TEXT NOT NULL CHECK (char_length(regexp_replace(contact_phone, '\D', '', 'g')) BETWEEN 10 AND 13),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.quiz_leads ENABLE ROW LEVEL SECURITY;

-- O formulário é público (antes do login), então qualquer visitante pode enviar seus dados,
-- mas somente o backend (service_role, que ignora RLS) pode listá-los depois.
CREATE POLICY "Anyone can submit a quiz lead" ON public.quiz_leads FOR INSERT WITH CHECK (true);
