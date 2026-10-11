import { supabase } from './supabase';

// /dashboard/?ml=<token_hash>: link de acesso de uso unico gerado pelo admin. Entra sem pedir codigo por e-mail
// e tira o token da barra de endereco na hora (nao vaza em historico/compartilhamento).
export async function consumeAccessLink(): Promise<void> {
  const qs = new URLSearchParams(window.location.search);
  const ml = qs.get('ml');
  if (!ml || !/^[A-Za-z0-9_-]{20,128}$/.test(ml)) return;
  const { error } = await supabase.auth.verifyOtp({ token_hash: ml, type: 'magiclink' });
  if (error) console.error('Link de acesso invalido ou expirado:', error.message);
  qs.delete('ml');
  const rest = qs.toString();
  history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
}
