
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  try {
    return typeof process !== 'undefined' ? process.env[key] : undefined;
  } catch {
    return undefined;
  }
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Validação rigorosa: Não é configurado se a URL for placeholder ou se as chaves forem strings vazias/undefined
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.trim() !== '' &&
  !supabaseUrl.includes('placeholder') &&
  supabaseUrl.startsWith('http')
);

// Fallback seguro para evitar erros de inicialização que travam a renderização
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://placeholder-project.supabase.co', 
  isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
