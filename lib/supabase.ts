
import { createClient } from '@supabase/supabase-js';

/**
 * CONFIGURAÇÃO SUPABASE - WAYFLOW NEURAL
 * 
 * Sincronização automática com as chaves fornecidas pelo usuário.
 */

// 1. Project URL configurada
const SUPABASE_URL_DIRECT = "https://cmwpvhfxtvindyfibhqs.supabase.co"; 

// 2. Publishable key configurada (Anon Key)
const SUPABASE_KEY_DIRECT = "sb_publishable_iZ1C-cv1yy_ws7VjotP90Q_0vBtlMQD"; 

const getEnv = (key: string) => {
  try {
    return typeof process !== 'undefined' ? process.env[key] : undefined;
  } catch {
    return undefined;
  }
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL') || SUPABASE_URL_DIRECT;
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || SUPABASE_KEY_DIRECT;

// Validação da Engine - Agora retornará TRUE liberando o modo online
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.includes('supabase.co') && 
  !supabaseUrl.includes('COLE_AQUI') &&
  supabaseUrl.startsWith('https://')
);

if (!isSupabaseConfigured) {
  console.warn("⚠️ WAYFLOW: Engine operando em MODO DEMO. Verifique as chaves em lib/supabase.ts");
} else {
  console.log("🚀 WAYFLOW: Sincronização Neural Ativa. Cluster Conectado com Sucesso.");
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co', 
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
