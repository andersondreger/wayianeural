import React, { useState } from 'react';
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
  if (/not confirmed/i.test(m)) return 'E-mail ainda não confirmado. Use "Entrar com código por e-mail".';
  if (/failed to fetch|network/i.test(m)) return 'Sem conexão com o servidor. Verifique sua internet.';
  return 'Não foi possível concluir agora. Tente novamente em instantes.';
}

export function OtpStep({ email, meta, password, onBack, onDone }: {
  email: string; password?: string; meta?: { full_name?: string; phone?: string }; onBack: () => void; onDone: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, data: meta, emailRedirectTo: `${window.location.origin}/dashboard/` } });
    setBusy(false);
    if (error) setErr(authErrorMessage(error));
    else setSent(true);
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (error) { setBusy(false); setErr('Código inválido ou expirado.'); return; }
    // Cadastro: grava a senha escolhida (a sessao ja existe apos o codigo). Sem ela, o cliente ainda entra por codigo.
    if (password) {
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) { setBusy(false); setErr('Entrou, mas não foi possível salvar a senha. Defina-a depois no painel.'); onDone(); return; }
    }
    setBusy(false); onDone();
  };

  return (
    <div className="max-w-md w-full space-y-6 z-10">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest"><ArrowLeft size={14} /> Voltar</button>
      <div className="flex items-center gap-3"><ShieldCheck className="text-blue-500" size={22} /><h2 className="text-3xl font-black uppercase italic tracking-tighter">Confirme seu acesso</h2></div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed flex items-center gap-2"><Mail size={12} /> {email}</p>
      {!sent ? (
        <>
          <p className="text-[11px] text-gray-400 leading-relaxed">Enviaremos um código de acesso para este e-mail. Sem senha: só quem recebe o código entra na conta.</p>
          <button disabled={busy} onClick={send} className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-[11px] uppercase tracking-widest italic disabled:opacity-50">{busy ? 'Enviando...' : 'Receber código'}</button>
        </>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-[11px] text-gray-400 leading-relaxed">Digite aqui o código que chegou no seu e-mail (olhe também o spam). Use o código; não precisa clicar no link do e-mail.</p>
          <input autoFocus required inputMode="numeric" autoComplete="one-time-code" placeholder="Código" value={code} onChange={e => setCode(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500/40 font-bold text-lg tracking-[0.4em] text-center" />
          <button disabled={busy || !code} className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-[11px] uppercase tracking-widest italic disabled:opacity-50">{busy ? 'Entrando...' : 'Entrar'}</button>
          <button type="button" disabled={busy} onClick={send} className="text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-blue-500">Reenviar código</button>
        </form>
      )}
      {err && <p role="alert" className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{err}</p>}
    </div>
  );
}
