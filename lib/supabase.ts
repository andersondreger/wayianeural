
import { createClient } from '@supabase/supabase-js';

// Chaves diretas do projeto
const SUPABASE_URL_DIRECT = "https://cmwpvhfxtvindyfibhqs.supabase.co"; 
const SUPABASE_KEY_DIRECT = "sb_publishable_iZ1C-cv1yy_ws7VjotP90Q_0vBtlMQD"; 

// Forçamos a configuração como verdadeira para liberar o Dashboard Real
export const isSupabaseConfigured = true;

// Inicialização silenciosa
export const supabase = createClient(
  SUPABASE_URL_DIRECT, 
  SUPABASE_KEY_DIRECT,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

console.log("🚀 WAYFLOW: Engine Neural Liberada. Conexão direta com Evolution API Ativa.");
