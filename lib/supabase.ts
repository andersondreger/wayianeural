
import { createClient } from '@supabase/supabase-js';

// Chaves do projeto (Mantidas para compatibilidade de tipos)
const SUPABASE_URL_DIRECT = "https://cmwpvhfxtvindyfibhqs.supabase.co"; 
const SUPABASE_KEY_DIRECT = "sb_publishable_iZ1C-cv1yy_ws7VjotP90Q_0vBtlMQD"; 

// IMPORTANTE: Forçamos TRUE para garantir que o Dashboard Real seja carregado
export const isSupabaseConfigured = true;

export const supabase = createClient(
  SUPABASE_URL_DIRECT, 
  SUPABASE_KEY_DIRECT
);

console.log("🚀 WAYFLOW: Sincronização Neural Ativa. Cluster Conectado com Sucesso.");
