
-- Scripts para Supabase - WayFlow Neural v3.1

-- 1. Tabela de Agentes IA
CREATE TABLE agentes_ia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    tone TEXT,
    objective TEXT,
    knowledge_base TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Contatos CRM (Kanban + Sentimento)
CREATE TABLE contatos_crm (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    last_message TEXT,
    summary TEXT,
    sentiment TEXT CHECK (sentiment IN ('happy', 'neutral', 'angry')) DEFAULT 'neutral',
    stage TEXT CHECK (stage IN ('novo', 'qualificado', 'agendado', 'fechado')) DEFAULT 'novo',
    is_paused BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar Realtime nas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE contatos_crm;
ALTER PUBLICATION supabase_realtime ADD TABLE agentes_ia;

-- 4. RLS (Row Level Security) - Apenas o dono vê seus dados
ALTER TABLE agentes_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos_crm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own agents" ON agentes_ia FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only see their own contacts" ON contatos_crm FOR ALL USING (auth.uid() = user_id);
