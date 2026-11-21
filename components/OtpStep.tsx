import React, { useEffect, useState } from 'react';
import { Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Login real: o Supabase manda um codigo ao e-mail e so entra quem o digita (cria a conta no 1o acesso).
// Nome/telefone do cadastro vao para user_metadata. Sucesso = sessao criada; quem chamou reage via onAuthStateChange.
// Traduz o erro do Supabase Auth; so culpa o e-mail quando o erro realmente e de e-mail.
export function authErrorMessage(error: { message?: string; status?: number }): string {
  const m = error.message || '';
  if (error.status === 402 || /restricted|quota|violations/i.test(m)) return 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.';
  if (/rate|seconds/i.test(m) || error.status === 429) return 'Muitas tentativas. Aguarde um minuto e tente novamente.';
  if (/invalid.*email|email.*invalid|valid email/i.test(m)) return 'E-mail inválido. Confira o endereço digitado.';
  if (/invalid login|credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/not confirmed/i.test(m)) return 'E-mail ainda não confirmado. Fale com o suporte.';
  if (/failed to fetch|network/i.test(m)) return 'Sem conexão com o servidor. Verifique sua internet.';
  return 'Não foi possível concluir agora. Tente novamente em instantes.';
}

export function OtpStep({ email, password, meta, onBack, onDone }: {
  email: string; password?: string; meta?: { full_name?: string; phone?: string }; onBack: () => void; onDone: () => void;
}) {
  // Sem confirmação por e-mail: o cadastro cria a conta e já entra. (Código por WhatsApp entra numa próxima fase.)
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!password) { setErr('Entrar por código foi desativado. Use e-mail e senha ou Google.'); setBusy(false); return; }
      const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: meta } });
      if (!alive) return;
      if (error) {
        // e-mail já cadastrado: tenta entrar com a mesma senha
        if (/already/i.test(error.message)) {
          const r = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (!alive) return;
          if (r.error) { setErr('Este e-mail já tem conta. Entre com a senha cadastrada.'); setBusy(false); return; }
          onDone(); return;
        }
        setErr(authErrorMessage(error)); setBusy(false); return;
      }
      onDone();
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="max-w-md w-full space-y-6 z-10">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest"><ArrowLeft size={14} /> Voltar</button>
      <div className="flex items-center gap-3"><ShieldCheck className="text-blue-500" size={22} /><h2 className="text-3xl font-black uppercase italic tracking-tighter">{busy ? 'Criando sua conta' : 'Acesso'}</h2></div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed flex items-center gap-2"><Mail size={12} /> {email}</p>
      {err && <p role="alert" className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{err}</p>}
    </div>
  );
}
