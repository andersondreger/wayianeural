
import { createClient } from '@supabase/supabase-js';

// Verificação segura para evitar crash em ambientes sem process.env definido
const getEnv = (key: string) => {
  try {
    return typeof process !== 'undefined' ? process.env[key] : undefined;
  } catch {
    return undefined;
  }
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://placeholder.supabase.co';
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 'placeholder-key';

// O createClient não deve receber strings vazias para não quebrar a árvore do React
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
