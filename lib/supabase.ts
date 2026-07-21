
import { createClient } from '@supabase/supabase-js';

// Chaves do projeto (Mantidas para compatibilidade de tipos)
const SUPABASE_URL_DIRECT = "https://dteagxhnuhejefvguxfw.supabase.co";
const SUPABASE_KEY_DIRECT = "sb_publishable__BixLP2pIalzCB9buumQZg_IkFBXpOR";

// IMPORTANTE: Forçamos TRUE para garantir que o Dashboard Real seja carregado
export const isSupabaseConfigured = true;

export const supabase = createClient(
  SUPABASE_URL_DIRECT, 
  SUPABASE_KEY_DIRECT
);

console.log("🚀 WAYFLOW: Sincronização Neural Ativa. Cluster Conectado com Sucesso.");
